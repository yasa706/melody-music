# Melody Music Android APK

This overlay adds an automated Android APK build to the existing `melody-music` GitHub repository.

## App identity

- App name: Melody Music
- App ID: com.glory.melodymusic
- Version: 1.0.0
- Website loaded by the app: https://melody-music.gotoulus.workers.dev
- Capacitor: 8.4.2

## What to upload to GitHub

Copy these two paths into the root of the existing repository:

- `.github/workflows/build-android-apk.yml`
- `android-app/`

Do not replace `public/`, `src/`, `migrations/`, or `wrangler.jsonc`.

## How the APK is built

After committing the files to the `main` branch, GitHub Actions runs **Build Melody Music Android APK** automatically. It installs Node 22, Java 21, Android SDK 36, Capacitor 8.4.2, generates the Android project, and builds a debug APK.

The resulting file is named:

`Melody-Music-1.0.0-debug.apk`

In GitHub, open **Actions** → **Build Melody Music Android APK** → latest successful run → **Artifacts** → **Melody-Music-Android-1.0.0**.

The artifact ZIP contains the APK. Extract it on an Android phone and install it. Android may ask for permission to install apps from the browser or file manager used to open it.

## Important

This is a debug-signed APK intended for direct installation/testing. It is not the Play Store release package. A Play Store release later needs a private signing key and normally an AAB build.

The app loads the deployed Melody Music site over HTTPS, so D1, R2, songs, covers, lyrics, and admin data remain on the existing Cloudflare backend. An internet connection is required.
