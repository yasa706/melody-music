# Melody Music iOS App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Melody Music iOS 1.0 as an App Store-ready Capacitor iPhone app with a mobile-optimized interface, shared Cloudflare backend, and native Swift audio support for background playback and system media controls.

**Architecture:** Keep Cloudflare Worker + D1 + R2 as the single backend. Add an `ios-app/` Capacitor shell that loads the deployed Melody Music site, then bridge playback intents and state between the web UI and a focused Swift native audio plugin. Keep native playback authoritative while a track is active, and keep web UI synchronized through explicit events.

**Tech Stack:** Capacitor 8.x, iOS/Swift, AVFoundation, MediaPlayer, existing HTML/CSS/JavaScript frontend, Cloudflare Workers, D1, R2, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-12-ios-app-design.md`

## Global Constraints

- App name: `Melody Music`.
- Bundle ID: `com.glory.melodymusic`.
- Initial version: `1.0.0`.
- Existing Cloudflare Worker, D1, and R2 remain the single source of truth.
- Public listening must work without login.
- First release includes Home, Albums, Search, My, registration/login, favorites, play history, lyrics, native background playback, lock-screen controls, Control Center controls, and Bluetooth/AirPods media commands.
- Timed LRC stays synchronized; plain lyrics show in full; missing lyrics show `暂无歌词`.
- Do not add offline downloads, CarPlay, subscriptions, push notifications, microphone, camera, or location permissions in 1.0.
- Add Privacy Policy and Terms of Use entry points.
- iOS UI should preserve Melody Music branding but be optimized specifically for iPhone.

---

## File Structure

- Create `ios-app/package.json` — isolated Capacitor dependencies and iOS scripts.
- Create `ios-app/capacitor.config.json` — app identity, web directory, and production server URL.
- Create `ios-app/www/index.html` — minimal fallback shell required by Capacitor.
- Create generated `ios-app/ios/` Xcode project through Capacitor, then commit only the generated iOS project files needed for repeatable builds.
- Create `ios-app/ios/App/App/NativeAudioPlugin.swift` — Capacitor bridge surface only.
- Create `ios-app/ios/App/App/NativeAudioPlayer.swift` — AVPlayer/AVAudioSession playback state and queue ownership.
- Create `ios-app/ios/App/App/NowPlayingController.swift` — `MPNowPlayingInfoCenter` metadata and `MPRemoteCommandCenter` commands.
- Create `public/ios-app.js` — web/native bridge adapter, feature detection, and native event handling.
- Create `public/ios-mobile.css` — iPhone-only layout, bottom navigation, mini-player, and full player presentation.
- Modify `public/index.html` — load iOS bridge/CSS hooks and expose Privacy/Terms links.
- Modify `public/app.js` only where required to route playback intents through the bridge and synchronize state.
- Add `test/ios-bridge.test.mjs` — unit tests for bridge behavior without a native runtime.
- Add `test/ios-mobile-ui.test.mjs` — static assertions for required iPhone navigation/player hooks.
- Add `README-IOS.md` — local Xcode/TestFlight/App Store preparation instructions.

---

### Task 1: Scaffold the iOS Capacitor Application

**Files:**
- Create: `ios-app/package.json`
- Create: `ios-app/capacitor.config.json`
- Create: `ios-app/www/index.html`
- Create: `README-IOS.md`
- Generated/Commit: `ios-app/ios/**`

**Interfaces:**
- Consumes: deployed Melody Music HTTPS URL.
- Produces: a buildable Capacitor iOS project with app ID `com.glory.melodymusic` and app name `Melody Music`.

- [ ] **Step 1: Add a failing configuration test**

Create `test/ios-config.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));

test('iOS Capacitor config uses the approved app identity', () => {
  const config = readJson('ios-app/capacitor.config.json');
  assert.equal(config.appId, 'com.glory.melodymusic');
  assert.equal(config.appName, 'Melody Music');
  assert.equal(config.webDir, 'www');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test test/ios-config.test.mjs
```

Expected: FAIL because `ios-app/capacitor.config.json` does not exist.

- [ ] **Step 3: Create the iOS Capacitor package**

Create `ios-app/package.json`:

```json
{
  "name": "melody-music-ios",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "cap:add:ios": "npx cap add ios",
    "cap:sync": "npx cap sync ios",
    "cap:open": "npx cap open ios"
  },
  "dependencies": {
    "@capacitor/core": "8.4.2",
    "@capacitor/ios": "8.4.2"
  },
  "devDependencies": {
    "@capacitor/cli": "8.4.2"
  }
}
```

Create `ios-app/capacitor.config.json`:

```json
{
  "appId": "com.glory.melodymusic",
  "appName": "Melody Music",
  "webDir": "www",
  "server": {
    "url": "https://babavs.edu.kg/",
    "cleartext": false
  }
}
```

Create `ios-app/www/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>Melody Music</title></head>
  <body><p>Melody Music requires an internet connection.</p></body>
</html>
```

- [ ] **Step 4: Install and generate the iOS project**

Run:

```bash
cd ios-app
npm install
npx cap add ios
npx cap sync ios
```

Expected: `ios-app/ios/App/App.xcworkspace` exists and Capacitor reports a successful iOS sync.

- [ ] **Step 5: Enable background audio capability in Xcode project files**

Ensure the generated app has `UIBackgroundModes` containing only `audio` for this feature set.

Expected Info.plist value:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

- [ ] **Step 6: Re-run tests**

Run:

```bash
cd ..
node --test test/ios-config.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add ios-app test/ios-config.test.mjs README-IOS.md
git commit -m "feat: scaffold Melody Music iOS app"
```

---

### Task 2: Add the Web-to-Native Audio Bridge Contract

**Files:**
- Create: `public/ios-app.js`
- Create: `test/ios-bridge.test.mjs`
- Modify: `public/index.html`

**Interfaces:**
- Consumes: song objects shaped like `{ id, title, artist, audio_url, cover_url, album, duration }`.
- Produces: `window.MelodyIOSAudio` with `isAvailable()`, `setQueue(queue, index)`, `play(song)`, `pause()`, `resume()`, `seek(seconds)`, `next()`, `previous()`, and `getState()`.
- Emits browser `CustomEvent('melody:native-audio-state', { detail })` on native state updates.

- [ ] **Step 1: Write bridge tests first**

Create `test/ios-bridge.test.mjs` with a mock Capacitor plugin and assert that `play()` forwards normalized song metadata and that native state events become browser custom events.

Core test shape:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

function normalizeSong(song) {
  return {
    id: Number(song.id),
    title: String(song.title || ''),
    artist: String(song.artist || ''),
    audioUrl: String(song.audio_url || ''),
    coverUrl: String(song.cover_url || ''),
    album: String(song.album || ''),
    duration: Number(song.duration || 0)
  };
}

test('normalizes a song for native playback', () => {
  assert.deepEqual(normalizeSong({ id: '7', title: 'A', audio_url: '/a.mp3' }), {
    id: 7,
    title: 'A',
    artist: '',
    audioUrl: '/a.mp3',
    coverUrl: '',
    album: '',
    duration: 0
  });
});
```

- [ ] **Step 2: Run the tests and verify the implementation is absent**

Run:

```bash
node --test test/ios-bridge.test.mjs
```

Expected: initial bridge-specific imports/functions are missing.

- [ ] **Step 3: Implement `public/ios-app.js`**

Export a `normalizeSong(song)` helper and install `window.MelodyIOSAudio`. Use `window.Capacitor?.Plugins?.NativeAudio` only when present. Every operation must return a Promise and gracefully no-op/fall back when native support is absent.

Required normalized payload:

```js
{
  id: Number(song.id),
  title: String(song.title || ''),
  artist: String(song.artist || ''),
  audioUrl: new URL(song.audio_url, window.location.origin).href,
  coverUrl: song.cover_url ? new URL(song.cover_url, window.location.origin).href : '',
  album: String(song.album || ''),
  duration: Number(song.duration || 0)
}
```

- [ ] **Step 4: Load the bridge from the public app**

Add to `public/index.html` before the main application module:

```html
<script type="module" src="/ios-app.js"></script>
```

- [ ] **Step 5: Run bridge tests**

```bash
node --test test/ios-bridge.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/ios-app.js public/index.html test/ios-bridge.test.mjs
git commit -m "feat: add iOS native audio bridge contract"
```

---

### Task 3: Implement Native Swift Playback and Queue Ownership

**Files:**
- Create: `ios-app/ios/App/App/NativeAudioPlugin.swift`
- Create: `ios-app/ios/App/App/NativeAudioPlayer.swift`
- Create: `ios-app/ios/App/App/NowPlayingController.swift`
- Modify: generated Capacitor app registration only if explicit plugin registration is required by the generated project.

**Interfaces:**
- Consumes Capacitor calls: `setQueue`, `play`, `pause`, `resume`, `seek`, `next`, `previous`, `getState`.
- Produces plugin event `stateChanged` with `{ trackId, playing, currentTime, duration, queueIndex }`.

- [ ] **Step 1: Add native model and player tests in Xcode test target**

Create tests covering queue index movement and state serialization. Minimum assertions:

```swift
func testNextAdvancesWithinQueue() throws {
    let player = NativeAudioPlayer()
    player.replaceQueue([
        NativeTrack(id: 1, title: "One", artist: "", audioUrl: URL(string: "https://example.com/1.mp3")!, coverUrl: nil, album: ""),
        NativeTrack(id: 2, title: "Two", artist: "", audioUrl: URL(string: "https://example.com/2.mp3")!, coverUrl: nil, album: "")
    ], startIndex: 0)
    player.moveToNextWithoutPlaying()
    XCTAssertEqual(player.queueIndex, 1)
    XCTAssertEqual(player.currentTrack?.id, 2)
}
```

- [ ] **Step 2: Run the iOS unit test and confirm failure**

Run from macOS/Xcode environment:

```bash
cd ios-app
xcodebuild test -workspace ios/App/App.xcworkspace -scheme App -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: FAIL because native classes do not exist.

- [ ] **Step 3: Implement `NativeAudioPlayer.swift`**

Use `AVPlayer` with an `AVPlayerItem`. Configure `AVAudioSession.sharedInstance()` with category `.playback`, mode `.default`, and activate it before playback. Store queue, queue index, current track, playback state, position, and duration.

Required model:

```swift
struct NativeTrack: Codable, Equatable {
    let id: Int
    let title: String
    let artist: String
    let audioUrl: URL
    let coverUrl: URL?
    let album: String
}
```

- [ ] **Step 4: Implement `NowPlayingController.swift`**

Publish title, artist, album, artwork, duration, elapsed time, and playback rate to `MPNowPlayingInfoCenter.default().nowPlayingInfo`.

Register remote commands through `MPRemoteCommandCenter.shared()` for play, pause, next track, previous track, and change playback position.

- [ ] **Step 5: Implement `NativeAudioPlugin.swift`**

Expose the exact methods from Task 2 and convert Capacitor payloads to `NativeTrack` values. On playback/time/queue changes, call:

```swift
notifyListeners("stateChanged", data: [
    "trackId": track.id,
    "playing": player.isPlaying,
    "currentTime": player.currentTime,
    "duration": player.duration,
    "queueIndex": player.queueIndex
])
```

- [ ] **Step 6: Run iOS unit tests**

Run the `xcodebuild test` command again.

Expected: PASS for queue/state tests.

- [ ] **Step 7: Manual system-control test on a real iPhone**

Verify: start song → lock device → music continues → lock screen shows title/artwork → pause/resume works → next/previous works → AirPods/Bluetooth play-pause works.

- [ ] **Step 8: Commit**

```bash
git add ios-app/ios
git commit -m "feat: add native iOS audio playback and controls"
```

---

### Task 4: Route Existing Web Playback Through Native Audio on iOS

**Files:**
- Modify: `public/app.js`
- Modify: `public/player-data.js` if a small adapter field is needed.
- Test: `test/ios-bridge.test.mjs`

**Interfaces:**
- Consumes: `window.MelodyIOSAudio` from Task 2.
- Produces: one playback state model reflected both in native controls and existing web UI.

- [ ] **Step 1: Add failing tests for fallback behavior**

Add tests proving that when native audio is unavailable, existing browser playback remains unchanged, and when native audio is available, play/pause/seek/next/previous operations are delegated.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test test/ios-bridge.test.mjs
```

Expected: FAIL for delegation assertions.

- [ ] **Step 3: Add a focused playback adapter to `public/app.js`**

Do not replace the existing player wholesale. At the existing playback action boundaries:

```js
const nativeAudio = window.MelodyIOSAudio;
const useNativeAudio = () => Boolean(nativeAudio?.isAvailable?.());
```

For native iOS, send queue and actions to the native bridge. For browser/Android, retain current Amplitude/browser logic.

- [ ] **Step 4: Listen for native state**

Add one listener:

```js
window.addEventListener('melody:native-audio-state', (event) => {
  const state = event.detail;
  // update active song, play/pause UI, progress, and queue index
});
```

Ensure this update path does not recursively trigger another native command.

- [ ] **Step 5: Re-run tests**

```bash
npm test
```

Expected: all Node tests PASS.

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/player-data.js test/ios-bridge.test.mjs
git commit -m "feat: synchronize web player with iOS native audio"
```

---

### Task 5: Build the iPhone-Specific Interface

**Files:**
- Create: `public/ios-mobile.css`
- Modify: `public/index.html`
- Modify: `public/app.js`
- Create: `test/ios-mobile-ui.test.mjs`

**Interfaces:**
- Consumes: existing song/album/search/user APIs and native playback state.
- Produces: four-tab iPhone navigation, persistent mini-player, iPhone Now Playing layout, responsive album grid, Search, and My screens.

- [ ] **Step 1: Add static UI contract tests**

Test `public/index.html` contains hooks for:

```text
[data-ios-tab="home"]
[data-ios-tab="albums"]
[data-ios-tab="search"]
[data-ios-tab="my"]
#ios-mini-player
#ios-now-playing
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test test/ios-mobile-ui.test.mjs
```

Expected: FAIL because hooks are absent.

- [ ] **Step 3: Add semantic iPhone UI hooks to `public/index.html`**

Add the bottom tab bar with Home, Albums, Search, and My buttons, plus mini-player and full-player containers. Preserve existing desktop content rather than duplicating data-loading code.

- [ ] **Step 4: Add `public/ios-mobile.css`**

Scope all iOS presentation under a root class such as `html.capacitor-ios`. Define:

```css
html.capacitor-ios .ios-tabbar { position: fixed; left: 0; right: 0; bottom: 0; }
html.capacitor-ios #ios-mini-player { position: fixed; left: 12px; right: 12px; bottom: calc(64px + env(safe-area-inset-bottom)); }
html.capacitor-ios .album-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

Use safe-area environment variables for iPhone notch/home indicator spacing.

- [ ] **Step 5: Implement tab switching and mini-player opening**

Keep view state in one small controller in `public/app.js`; switching tabs must not stop playback. Tapping mini-player opens `#ios-now-playing`; closing it returns to the prior tab.

- [ ] **Step 6: Preserve lyric behavior**

Reuse current LRC/plain-lyrics behavior exactly:

```text
timed LRC -> synchronized/highlighted
plain lyrics -> all lines shown
missing lyrics -> 暂无歌词
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 8: Manual iPhone layout test**

Test portrait mode on a recent iPhone simulator/device. Verify safe areas, two-column albums, bottom tabs, mini-player, full-player scrolling, and lyrics readability.

- [ ] **Step 9: Commit**

```bash
git add public/index.html public/app.js public/ios-mobile.css test/ios-mobile-ui.test.mjs
git commit -m "feat: add iPhone-optimized Melody Music interface"
```

---

### Task 6: App Store Account, Privacy, and Release Readiness

**Files:**
- Create: `public/privacy.html`
- Create: `public/terms.html`
- Modify: `public/index.html`
- Modify: `README-IOS.md`
- Modify: iOS app metadata/Info.plist as generated by Capacitor.

**Interfaces:**
- Consumes: existing user account API.
- Produces: visible Privacy Policy, Terms of Use, account-management entry, minimal iOS permissions, and repeatable TestFlight preparation instructions.

- [ ] **Step 1: Add a release-readiness test**

Create `test/ios-release.test.mjs` that asserts `public/privacy.html` and `public/terms.html` exist and that `public/index.html` links to both.

- [ ] **Step 2: Run test and verify failure**

```bash
node --test test/ios-release.test.mjs
```

Expected: FAIL until the legal pages exist.

- [ ] **Step 3: Add Privacy Policy and Terms entry pages**

Privacy page must describe, in plain language, only the data the app actually uses: account email/display name, favorites, playlists where enabled, and listening/play history. State that audio/content is streamed from Melody Music infrastructure and that the app does not request camera, microphone, or location access in 1.0.

Terms page must cover acceptable use, streamed content availability, account responsibility, and service changes without inventing paid-subscription terms.

- [ ] **Step 4: Add account-management route or clear entry point**

The My screen must expose account settings. If account deletion is not yet supported by the API, add that backend endpoint before App Store submission rather than hiding the requirement.

Required API shape when implemented:

```http
DELETE /api/user/account
```

Authenticated request deletes or anonymizes the user's account-associated records according to the project's retention decision, then clears the session.

- [ ] **Step 5: Remove unrelated iOS permissions**

Inspect Info.plist and entitlements. There must be no camera, microphone, location, contacts, or push notification usage descriptions/capabilities for version 1.0.

- [ ] **Step 6: Document Apple Developer and TestFlight preparation**

Add to `README-IOS.md`:

```text
1. Enroll the Apple ID in Apple Developer Program.
2. Create/confirm App ID com.glory.melodymusic.
3. Open ios-app/ios/App/App.xcworkspace in Xcode.
4. Select the developer Team under Signing & Capabilities.
5. Confirm Background Modes > Audio is enabled.
6. Archive using Product > Archive.
7. Upload through Xcode Organizer to App Store Connect.
8. Test through TestFlight before production submission.
```

- [ ] **Step 7: Run the complete automated test suite**

```bash
npm test
```

Expected: all Node tests PASS.

- [ ] **Step 8: Run the iOS build/test verification on macOS**

```bash
cd ios-app
npx cap sync ios
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator build
```

Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 9: Final real-device acceptance checklist**

Verify all of the following before calling iOS 1.0 technically ready:

```text
[ ] Home loads songs and albums
[ ] Album Play All creates the correct queue
[ ] Search finds song/artist/album content
[ ] Public playback works while signed out
[ ] Register/login works
[ ] Favorites work
[ ] Play history updates
[ ] Timed LRC syncs
[ ] Plain lyrics display completely
[ ] Background playback survives screen lock
[ ] Lock-screen metadata/artwork is correct
[ ] Lock-screen play/pause/next/previous works
[ ] Bluetooth/AirPods media controls work
[ ] Returning to the foreground shows the true native state
[ ] Privacy and Terms links open
[ ] Account settings/deletion path is available before submission
```

- [ ] **Step 10: Commit**

```bash
git add public README-IOS.md ios-app test/ios-release.test.mjs
git commit -m "chore: prepare Melody Music iOS for App Store testing"
```

---

## Self-Review Notes

- Spec coverage: Home, Albums, Search, My, auth, favorites, history, lyrics, queue, native background playback, lock screen, Control Center, Bluetooth/AirPods, privacy/terms, and App Store preparation are all mapped to tasks.
- Deferred features remain excluded: offline downloads, CarPlay, subscriptions, push notifications, microphone, camera, and location.
- The bridge API names are consistent across Tasks 2–4.
- Native playback remains authoritative while active, matching the approved design.
- Android/browser fallback is explicitly preserved.
- Production readiness still requires a macOS/Xcode environment, a real iPhone for system-control validation, and Apple Developer Program enrollment; the plan does not claim those steps can be completed from GitHub alone.
