import Capacitor
import Foundation

@objc(NativeAudioPlugin)
public class NativeAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAudioPlugin"
    public let jsName = "NativeAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setQueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "next", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "previous", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise)
    ]

    private let player = NativeAudioPlayer()
    private lazy var nowPlaying = NowPlayingController(player: player)

    public override func load() {
        _ = nowPlaying

        player.onTrackChange = { [weak self] track in
            guard let self else { return }
            self.nowPlaying.update(track: track, state: self.player.state())
        }

        player.onStateChange = { [weak self] state in
            guard let self else { return }
            self.nowPlaying.update(track: self.player.currentTrack, state: state)
            self.notifyListeners("stateChanged", data: self.payload(for: state))
        }
    }

    @objc public func setQueue(_ call: CAPPluginCall) {
        guard let values = call.getArray("queue", JSObject.self) else {
            call.reject("queue is required", "INVALID_QUEUE")
            return
        }

        do {
            let tracks = try values.map(parseTrack)
            let index = call.getInt("index") ?? 0
            player.replaceQueue(tracks, startIndex: index)
            call.resolve(payload(for: player.state()))
        } catch {
            call.reject(error.localizedDescription, "INVALID_TRACK")
        }
    }

    @objc public func play(_ call: CAPPluginCall) {
        guard let object = call.getObject("song") else {
            call.reject("song is required", "INVALID_TRACK")
            return
        }

        do {
            let track = try parseTrack(object)
            try player.play(track: track)
            call.resolve(payload(for: player.state()))
        } catch {
            call.reject(error.localizedDescription, "PLAYBACK_FAILED")
        }
    }

    @objc public func pause(_ call: CAPPluginCall) {
        player.pause()
        call.resolve(payload(for: player.state()))
    }

    @objc public func resume(_ call: CAPPluginCall) {
        do {
            try player.resume()
            call.resolve(payload(for: player.state()))
        } catch {
            call.reject(error.localizedDescription, "PLAYBACK_FAILED")
        }
    }

    @objc public func seek(_ call: CAPPluginCall) {
        let seconds = call.getDouble("seconds") ?? 0
        player.seek(to: seconds)
        call.resolve(payload(for: player.state()))
    }

    @objc public func next(_ call: CAPPluginCall) {
        do {
            try player.next()
            call.resolve(payload(for: player.state()))
        } catch {
            call.reject(error.localizedDescription, "PLAYBACK_FAILED")
        }
    }

    @objc public func previous(_ call: CAPPluginCall) {
        do {
            try player.previous()
            call.resolve(payload(for: player.state()))
        } catch {
            call.reject(error.localizedDescription, "PLAYBACK_FAILED")
        }
    }

    @objc public func getState(_ call: CAPPluginCall) {
        call.resolve(payload(for: player.state()))
    }

    private func parseTrack(_ object: JSObject) throws -> NativeTrack {
        guard
            let id = intValue(object["id"]),
            let title = object["title"] as? String,
            let audioString = object["audioUrl"] as? String,
            let audioUrl = URL(string: audioString),
            !title.isEmpty,
            !audioString.isEmpty
        else {
            throw NativeAudioPluginError.invalidTrack
        }

        let coverUrl: URL?
        if let coverString = object["coverUrl"] as? String, !coverString.isEmpty {
            coverUrl = URL(string: coverString)
        } else {
            coverUrl = nil
        }

        return NativeTrack(
            id: id,
            title: title,
            artist: object["artist"] as? String ?? "",
            audioUrl: audioUrl,
            coverUrl: coverUrl,
            album: object["album"] as? String ?? ""
        )
    }

    private func intValue(_ value: Any?) -> Int? {
        if let int = value as? Int { return int }
        if let number = value as? NSNumber { return number.intValue }
        if let string = value as? String { return Int(string) }
        return nil
    }

    private func payload(for state: NativeAudioState) -> JSObject {
        var result: JSObject = [
            "playing": state.playing,
            "currentTime": state.currentTime,
            "duration": state.duration,
            "queueIndex": state.queueIndex
        ]
        if let trackId = state.trackId {
            result["trackId"] = trackId
        }
        return result
    }
}

private enum NativeAudioPluginError: LocalizedError {
    case invalidTrack

    var errorDescription: String? {
        switch self {
        case .invalidTrack:
            return "Track requires id, title and a valid audioUrl"
        }
    }
}
