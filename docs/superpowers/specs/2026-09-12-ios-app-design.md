# Melody Music iOS App 1.0 Design

Date: 2026-09-12
Status: Approved design
Repository: `yasa706/melody-music`

## 1. Goal

Build an iPhone version of Melody Music that is suitable for eventual App Store release from the start. The iOS app must reuse the existing Melody Music backend and content model rather than creating a second music service.

The first release should feel like a real iPhone music app, not a simple website wrapper. It should preserve Melody Music branding while adapting layout and interaction patterns for iPhone.

## 2. Chosen Technical Direction

Use Capacitor for the iOS app shell and bridge selected features to native Swift code.

The app will continue to use the existing Cloudflare Worker, D1 database, and R2 media storage. Existing songs, albums, covers, lyrics, users, favorites, and play history remain shared between web, Android, and iOS.

The iOS app will use a dedicated native audio bridge for background playback and system media controls. Web UI and native playback state must stay synchronized.

Recommended app identity:

- App name: Melody Music
- Bundle ID: `com.glory.melodymusic`
- Initial version: `1.0.0`

## 3. First-Release Scope

Melody Music iOS 1.0 includes:

- Home screen
- Albums
- Search
- User account area
- Registration and login
- Favorites
- Play history
- Song playback
- Playback queue
- Synchronized lyrics when timed LRC exists
- Full plain lyrics when no timed LRC exists
- Background audio playback
- Lock-screen playback controls
- Control Center playback controls
- Bluetooth headset and AirPods remote controls
- Song title, artist, artwork, duration, and progress on the lock screen
- App Store-ready project structure
- Privacy Policy and Terms of Use entry points

The first release does not include:

- Offline downloads
- CarPlay
- Paid subscriptions
- Push notifications
- Microphone, camera, or location permissions

These can be added later without changing the core architecture.

## 4. Application Structure

The iOS app has three main layers.

### 4.1 Existing Backend

The current Cloudflare backend remains the single source of truth.

It provides:

- public songs
- albums
- cover images
- audio files
- lyrics
- user authentication
- favorites
- play history
- user playlists where available

No separate iOS database should be created for server-side music or user data.

### 4.2 iPhone UI Layer

The app uses a mobile-specific interface rather than simply reproducing the desktop website layout.

Primary bottom navigation:

1. Home
2. Albums
3. Search
4. My

A persistent mini-player sits above the bottom navigation while a song is active.

Tapping the mini-player opens the full Now Playing screen.

### 4.3 Native iOS Audio Layer

A Swift-based native playback layer handles system-level audio behavior.

Responsibilities:

- maintain the active track
- maintain the current playback queue
- play, pause, seek, previous, and next
- retain playback while the app is in the background
- publish Now Playing metadata to iOS
- receive lock-screen and headset commands
- report native playback state back to the web layer

Capacitor acts as the bridge between the web interface and the native audio layer.

## 5. Screen Design

### 5.1 Home

The Home screen should prioritize music discovery and returning to recent listening.

Recommended sections:

- Melody Music branding/header
- recent plays
- featured albums
- recommended or highlighted songs
- newest songs

Song cards emphasize cover art, title, and artist. Songwriter and composer details are reserved for the Now Playing view to avoid visual overload.

### 5.2 Mini Player

The mini-player appears above the bottom navigation whenever a track is active.

It includes:

- small cover image
- song title
- artist
- play/pause control

Tapping the body of the mini-player opens the full player.

### 5.3 Full Now Playing Screen

The Now Playing screen is the central playback experience.

Main content:

- large cover image
- song title
- artist
- lyricist
- composer
- playback progress
- elapsed time
- total duration
- previous
- play/pause
- next
- favorite
- queue/more action

Lyrics behavior:

- timed LRC: synchronized scrolling and active-line highlighting
- plain lyrics: show all lines as static readable text
- no lyrics: show `暂无歌词`

The lyric region may expand vertically to support a lyric-focused reading mode.

### 5.4 Albums

Album browse uses a two-column iPhone grid.

Album detail includes:

- album artwork
- album name
- optional description
- song count
- Play All action
- ordered track list

Selecting any song starts playback and loads the whole album as the active queue.

### 5.5 Search

The first release supports straightforward server-backed search for:

- song title
- artist
- album

Results should be grouped by content type where practical.

No recommendation engine or fuzzy AI search is required for version 1.0.

### 5.6 My

When signed in, show:

- user name/avatar area
- favorites
- recent plays
- playlists if available
- account settings

When signed out, show a clear Login / Register entry without blocking public listening.

## 6. Native Audio Design

### 6.1 Audio Session

Use `AVAudioSession` configured for playback so audio can continue when the app is backgrounded or the device is locked.

Only audio-related background capability should be enabled unless another capability becomes necessary later.

### 6.2 Playback Engine

The native layer owns the authoritative playback state while audio is active.

The player must track:

- current song
- queue
- queue index
- playback state
- current position
- duration

The web interface sends playback intents to the native layer. The native layer returns state changes to the web layer.

This prevents cases where the lock screen shows music playing but the app UI incorrectly shows a paused state.

### 6.3 Now Playing Metadata

Use `MPNowPlayingInfoCenter` to publish:

- song title
- artist
- album title when available
- cover artwork
- total duration
- current playback position
- playback rate

### 6.4 Remote Commands

Use `MPRemoteCommandCenter` for:

- play
- pause
- previous track
- next track
- seek when practical

These commands should also work from Bluetooth headsets and AirPods when iOS routes them through the media command center.

### 6.5 Queue Behavior

The native layer stores the current queue.

Examples:

- starting a song from an album loads the album track list as the queue
- starting from search loads the selected result context according to the UI flow
- next/previous on the lock screen uses the same queue as the app

Version 1.0 does not require advanced queue editing.

## 7. Web-to-Native Bridge Contract

The Capacitor plugin or bridge should expose a small, stable interface instead of tightly coupling Swift code to the entire web application.

Recommended commands from web to native:

- setQueue
- playTrack
- play
- pause
- seek
- next
- previous
- getState

Recommended events from native to web:

- stateChanged
- trackChanged
- progressChanged
- playbackError

Track payloads should include only the fields necessary for playback and system metadata, such as:

- id
- title
- artist
- album
- audio URL
- cover URL
- duration when known
- lyricist
- composer

## 8. Error Handling

Playback failures should be surfaced clearly without crashing the app.

Examples:

- network unavailable
- audio URL invalid
- server error
- unsupported media response

The native layer should emit a playback error event. The UI should show a concise user-facing message and preserve the rest of the queue where possible.

The first release does not require offline caching.

## 9. Authentication and Account Requirements

The app reuses the existing user authentication endpoints.

Public music remains accessible without login where current backend policy allows it.

Login is required for account-specific features such as favorites and history.

Because users can create accounts, the App Store version must provide a clear account management path, including account deletion capability before submission if it is not already available through the existing account flow.

## 10. App Store Readiness

The project should be structured for App Store distribution from the start.

Release path:

1. local iOS development
2. physical-device testing
3. Apple Developer Program enrollment
4. signing and provisioning
5. TestFlight
6. App Store submission

The user currently has an Apple ID but is not yet enrolled in the Apple Developer Program. Enrollment is not required to write the project structure, but it will be required before full TestFlight/App Store distribution.

Store preparation will eventually require:

- app icon
- launch assets where applicable
- iPhone screenshots
- app description
- keywords
- support URL
- Privacy Policy URL
- Terms of Use entry
- App Privacy disclosures

## 11. Privacy and Permissions

Version 1.0 should request no unrelated device permissions.

Do not request:

- camera
- microphone
- location
- contacts

unless a later feature genuinely requires them.

Privacy disclosures should explain the use of account information, favorites, and play history.

## 12. Visual Direction

The app should preserve Melody Music identity while adopting iPhone-native spacing and interaction patterns.

Design principles:

- light-first visual direction
- strong use of album artwork
- generous spacing
- rounded cards and controls
- clear typographic hierarchy
- one-handed reachability where practical
- familiar iOS navigation behavior

The goal is not to clone Apple Music. Melody Music should remain visually recognizable as its own product.

## 13. Testing Strategy

Implementation should include tests at the appropriate layers.

Web/application tests:

- track payload mapping
- queue construction
- lyric display fallback
- native bridge state synchronization logic

Native tests where practical:

- queue state transitions
- previous/next behavior
- metadata mapping
- command handling

Manual device validation is required for behaviors that simulators do not fully represent, especially:

- background playback
- lock-screen controls
- Bluetooth/AirPods control
- interruption handling
- app foreground/background state synchronization

## 14. Acceptance Criteria for iOS 1.0

The release is considered functionally ready when all of the following are true:

- the app launches and loads Melody Music content
- users can browse songs and albums
- users can search music
- users can register and log in
- favorites and play history work for signed-in users
- songs play reliably on iPhone
- playback continues with the screen locked
- lock-screen play/pause works
- previous/next works from the lock screen
- Bluetooth/AirPods media controls work through iOS
- lock screen shows song metadata and artwork
- web UI stays synchronized with native playback state
- timed lyrics sync when available
- plain lyrics display in full when timed lyrics are unavailable
- the project can be signed and submitted through TestFlight after developer enrollment

## 15. Deferred Features

The following are intentionally deferred:

- offline downloads
- CarPlay
- subscriptions or in-app purchases
- push notifications
- advanced recommendation algorithms
- advanced queue editing

These should be evaluated only after the core playback experience is stable.
