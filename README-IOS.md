# Melody Music iOS

This folder contains the iPhone application shell for Melody Music.

## App identity

- App name: `Melody Music`
- Bundle ID: `com.glory.melodymusic`
- Version: `1.0.0`
- Production site: `https://babavs.edu.kg/`
- Capacitor: `8.4.2`

## Generate the Xcode project on a Mac

Requirements: macOS, Xcode, Node.js 22+, and an internet connection.

```bash
cd ios-app
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

The generated Xcode workspace should be `ios-app/ios/App/App.xcworkspace`.

## Required iOS capability

In the app target, enable Background Modes and select **Audio, AirPlay, and Picture in Picture** only for the audio playback requirement. The resulting app configuration must include `UIBackgroundModes` with `audio`.

Do not request microphone, camera, location, push notification, CarPlay, subscription, or offline-download permissions/features for version 1.0.

## Signing and App Store

Before TestFlight/App Store delivery, enroll the Apple ID in the Apple Developer Program, register the bundle identifier `com.glory.melodymusic`, select the correct Team in Xcode Signing & Capabilities, create the App Store Connect app, and archive the Release build.

The project should be tested on a real iPhone for background playback, lock-screen metadata, Control Center commands, AirPods/Bluetooth commands, interruptions, and returning from background.

## Tests

From the repository root:

```bash
node --test test/ios-config.test.mjs
node --test test/ios-bridge.test.mjs
npm test
```

Native Swift tests require macOS/Xcode and are run with `xcodebuild` after the generated iOS project and test target exist.
