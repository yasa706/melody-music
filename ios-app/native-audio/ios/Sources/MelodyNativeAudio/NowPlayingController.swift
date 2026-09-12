import Foundation
import MediaPlayer
import UIKit

final class NowPlayingController {
    private weak var player: NativeAudioPlayer?
    private var artworkTask: URLSessionDataTask?
    private var artworkTrackId: Int?

    init(player: NativeAudioPlayer) {
        self.player = player
        installRemoteCommands()
    }

    deinit {
        artworkTask?.cancel()
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.removeTarget(nil)
        center.pauseCommand.removeTarget(nil)
        center.nextTrackCommand.removeTarget(nil)
        center.previousTrackCommand.removeTarget(nil)
        center.changePlaybackPositionCommand.removeTarget(nil)
    }

    func update(track: NativeTrack?, state: NativeAudioState) {
        guard let track else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyArtist: track.artist,
            MPMediaItemPropertyAlbumTitle: track.album,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: state.currentTime,
            MPMediaItemPropertyPlaybackDuration: state.duration,
            MPNowPlayingInfoPropertyPlaybackRate: state.playing ? 1.0 : 0.0
        ]

        if let existingArtwork = MPNowPlayingInfoCenter.default().nowPlayingInfo?[MPMediaItemPropertyArtwork] {
            info[MPMediaItemPropertyArtwork] = existingArtwork
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        loadArtworkIfNeeded(for: track)
    }

    private func installRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.nextTrackCommand.isEnabled = true
        center.previousTrackCommand.isEnabled = true
        center.changePlaybackPositionCommand.isEnabled = true

        center.playCommand.addTarget { [weak self] _ in
            guard let player = self?.player else { return .commandFailed }
            do {
                try player.resume()
                return .success
            } catch {
                return .commandFailed
            }
        }

        center.pauseCommand.addTarget { [weak self] _ in
            guard let player = self?.player else { return .commandFailed }
            player.pause()
            return .success
        }

        center.nextTrackCommand.addTarget { [weak self] _ in
            guard let player = self?.player else { return .commandFailed }
            do {
                try player.next()
                return .success
            } catch {
                return .commandFailed
            }
        }

        center.previousTrackCommand.addTarget { [weak self] _ in
            guard let player = self?.player else { return .commandFailed }
            do {
                try player.previous()
                return .success
            } catch {
                return .commandFailed
            }
        }

        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard
                let player = self?.player,
                let positionEvent = event as? MPChangePlaybackPositionCommandEvent
            else {
                return .commandFailed
            }
            player.seek(to: positionEvent.positionTime)
            return .success
        }
    }

    private func loadArtworkIfNeeded(for track: NativeTrack) {
        guard let coverUrl = track.coverUrl else { return }
        guard artworkTrackId != track.id else { return }

        artworkTask?.cancel()
        artworkTrackId = track.id

        artworkTask = URLSession.shared.dataTask(with: coverUrl) { [weak self] data, _, _ in
            guard
                let self,
                self.artworkTrackId == track.id,
                let data,
                let image = UIImage(data: data)
            else {
                return
            }

            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            DispatchQueue.main.async {
                guard self.artworkTrackId == track.id else { return }
                var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                info[MPMediaItemPropertyArtwork] = artwork
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            }
        }
        artworkTask?.resume()
    }
}
