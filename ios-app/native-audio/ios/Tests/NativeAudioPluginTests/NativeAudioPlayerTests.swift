import XCTest
@testable import MelodyNativeAudio

final class NativeAudioPlayerTests: XCTestCase {
    private func track(_ id: Int) -> NativeTrack {
        NativeTrack(
            id: id,
            title: "Song \(id)",
            artist: "Artist",
            audioUrl: URL(string: "https://example.com/\(id).mp3")!,
            coverUrl: nil,
            album: "Album"
        )
    }

    func testReplaceQueueSelectsRequestedTrack() {
        let player = NativeAudioPlayer()
        player.replaceQueue([track(1), track(2), track(3)], startIndex: 1)

        XCTAssertEqual(player.queueIndex, 1)
        XCTAssertEqual(player.currentTrack?.id, 2)
    }

    func testNextAdvancesWithinQueue() {
        let player = NativeAudioPlayer()
        player.replaceQueue([track(1), track(2)], startIndex: 0)

        player.moveToNextWithoutPlaying()

        XCTAssertEqual(player.queueIndex, 1)
        XCTAssertEqual(player.currentTrack?.id, 2)
    }

    func testPreviousMovesBackWithinQueue() {
        let player = NativeAudioPlayer()
        player.replaceQueue([track(1), track(2)], startIndex: 1)

        player.moveToPreviousWithoutPlaying()

        XCTAssertEqual(player.queueIndex, 0)
        XCTAssertEqual(player.currentTrack?.id, 1)
    }

    func testQueueMovementStopsAtEdges() {
        let player = NativeAudioPlayer()
        player.replaceQueue([track(1), track(2)], startIndex: 0)
        player.moveToPreviousWithoutPlaying()
        XCTAssertEqual(player.queueIndex, 0)

        player.replaceQueue([track(1), track(2)], startIndex: 1)
        player.moveToNextWithoutPlaying()
        XCTAssertEqual(player.queueIndex, 1)
    }
}
