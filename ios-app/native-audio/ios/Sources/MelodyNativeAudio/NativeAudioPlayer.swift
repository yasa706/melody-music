import AVFoundation
import Foundation

struct NativeTrack: Codable, Equatable {
    let id: Int
    let title: String
    let artist: String
    let audioUrl: URL
    let coverUrl: URL?
    let album: String
}

struct NativeAudioState: Equatable {
    let trackId: Int?
    let playing: Bool
    let currentTime: Double
    let duration: Double
    let queueIndex: Int
}

final class NativeAudioPlayer {
    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var errorLogObserver: NSObjectProtocol?
    private var itemStatusObservation: NSKeyValueObservation?

    private(set) var queue: [NativeTrack] = []
    private(set) var queueIndex: Int = -1

    var onStateChange: ((NativeAudioState) -> Void)?
    var onTrackChange: ((NativeTrack?) -> Void)?

    var currentTrack: NativeTrack? {
        guard queue.indices.contains(queueIndex) else { return nil }
        return queue[queueIndex]
    }

    var isPlaying: Bool {
        guard let player else { return false }
        return player.rate > 0
    }

    var currentTime: Double {
        guard let player else { return 0 }
        let seconds = CMTimeGetSeconds(player.currentTime())
        return seconds.isFinite ? max(0, seconds) : 0
    }

    var duration: Double {
        guard let duration = player?.currentItem?.duration else { return 0 }
        let seconds = CMTimeGetSeconds(duration)
        return seconds.isFinite ? max(0, seconds) : 0
    }

    deinit {
        removeObservers()
    }

    func replaceQueue(_ tracks: [NativeTrack], startIndex: Int) {
        queue = tracks
        guard !tracks.isEmpty else {
            queueIndex = -1
            stop()
            onTrackChange?(nil)
            emitState()
            return
        }

        queueIndex = min(max(0, startIndex), tracks.count - 1)
        onTrackChange?(currentTrack)
        emitState()
    }

    func play(track: NativeTrack) throws {
        if let existingIndex = queue.firstIndex(where: { $0.id == track.id }) {
            queueIndex = existingIndex
        } else {
            queue = [track]
            queueIndex = 0
        }
        try playCurrent()
    }

    func playCurrent() throws {
        guard let track = currentTrack else { return }
        try configureAudioSession()
        replacePlayerItem(with: track)
        player?.play()
        onTrackChange?(track)
        emitState()
    }

    func pause() {
        player?.pause()
        emitState()
    }

    func resume() throws {
        guard currentTrack != nil else { return }
        try configureAudioSession()
        if player?.currentItem == nil {
            try playCurrent()
            return
        }
        player?.play()
        emitState()
    }

    func seek(to seconds: Double) {
        guard let player else { return }
        let safeSeconds = max(0, seconds)
        player.seek(to: CMTime(seconds: safeSeconds, preferredTimescale: 600)) { [weak self] _ in
            self?.emitState()
        }
    }

    func next() throws {
        let previous = queueIndex
        moveToNextWithoutPlaying()
        guard queueIndex != previous else { return }
        try playCurrent()
    }

    func previous() throws {
        let previous = queueIndex
        moveToPreviousWithoutPlaying()
        guard queueIndex != previous else {
            seek(to: 0)
            return
        }
        try playCurrent()
    }

    func moveToNextWithoutPlaying() {
        guard queue.indices.contains(queueIndex), queueIndex + 1 < queue.count else { return }
        queueIndex += 1
        onTrackChange?(currentTrack)
        emitState()
    }

    func moveToPreviousWithoutPlaying() {
        guard queue.indices.contains(queueIndex), queueIndex > 0 else { return }
        queueIndex -= 1
        onTrackChange?(currentTrack)
        emitState()
    }

    func stop() {
        player?.pause()
        removeObservers()
        player = nil
    }

    func state() -> NativeAudioState {
        NativeAudioState(
            trackId: currentTrack?.id,
            playing: isPlaying,
            currentTime: currentTime,
            duration: duration,
            queueIndex: queueIndex
        )
    }

    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [])
        try session.setActive(true)
    }

    private func replacePlayerItem(with track: NativeTrack) {
        removeObservers()

        print("🎵 NativeAudio loading track id=\(track.id) title=\(track.title) url=\(track.audioUrl.absoluteString)")

        let item = AVPlayerItem(url: track.audioUrl)
        let newPlayer = AVPlayer(playerItem: item)
        player = newPlayer

        itemStatusObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            switch item.status {
            case .unknown:
                print("🎵 NativeAudio status=unknown trackId=\(track.id) url=\(track.audioUrl.absoluteString)")
            case .readyToPlay:
                let seconds = CMTimeGetSeconds(item.duration)
                let duration = seconds.isFinite ? seconds : 0
                print("✅ NativeAudio status=readyToPlay trackId=\(track.id) duration=\(duration) url=\(track.audioUrl.absoluteString)")
            case .failed:
                let errorText = item.error?.localizedDescription ?? "unknown AVPlayerItem error"
                print("❌ NativeAudio status=failed trackId=\(track.id) url=\(track.audioUrl.absoluteString) error=\(errorText)")
                self?.printErrorLog(for: item, track: track)
            @unknown default:
                print("⚠️ NativeAudio status=unknown-default trackId=\(track.id) url=\(track.audioUrl.absoluteString)")
            }
            self?.emitState()
        }

        errorLogObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemNewErrorLogEntry,
            object: item,
            queue: .main
        ) { [weak self, weak item] _ in
            guard let item else { return }
            self?.printErrorLog(for: item, track: track)
        }

        timeObserver = newPlayer.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
            queue: .main
        ) { [weak self] _ in
            self?.emitState()
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            let previous = self.queueIndex
            self.moveToNextWithoutPlaying()
            if self.queueIndex != previous {
                try? self.playCurrent()
            } else {
                self.pause()
                self.seek(to: 0)
            }
        }
    }

    private func printErrorLog(for item: AVPlayerItem, track: NativeTrack) {
        guard let log = item.errorLog(), !log.events.isEmpty else {
            print("❌ NativeAudio errorLog empty trackId=\(track.id) itemError=\(item.error?.localizedDescription ?? "none") url=\(track.audioUrl.absoluteString)")
            return
        }

        for event in log.events.suffix(3) {
            let comment = event.errorComment ?? ""
            let uri = event.uri ?? track.audioUrl.absoluteString
            print("❌ NativeAudio errorLog trackId=\(track.id) domain=\(event.errorDomain) code=\(event.errorStatusCode) comment=\(comment) uri=\(uri)")
        }
    }

    private func removeObservers() {
        itemStatusObservation?.invalidate()
        itemStatusObservation = nil

        if let timeObserver, let player {
            player.removeTimeObserver(timeObserver)
        }
        timeObserver = nil

        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        endObserver = nil

        if let errorLogObserver {
            NotificationCenter.default.removeObserver(errorLogObserver)
        }
        errorLogObserver = nil
    }

    private func emitState() {
        onStateChange?(state())
    }
}
