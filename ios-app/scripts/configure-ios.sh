#!/usr/bin/env bash
set -euo pipefail

PLIST="ios/App/App/Info.plist"
ICON_SOURCE="branding/icon-only.svg"
SPLASH_SOURCE="branding/splash.svg"
ICON_SET="ios/App/App/Assets.xcassets/AppIcon.appiconset"
SPLASH_SET="ios/App/App/Assets.xcassets/Splash.imageset"

if [[ ! -f "$PLIST" ]]; then
  echo "Missing $PLIST. Run 'npx cap add ios' first." >&2
  exit 1
fi

if [[ ! -f "$ICON_SOURCE" || ! -f "$SPLASH_SOURCE" ]]; then
  echo "Missing Melody Music branding artwork in ios-app/branding." >&2
  exit 1
fi

/usr/libexec/PlistBuddy -c "Delete :UIBackgroundModes" "$PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes:0 string audio" "$PLIST"

echo "Configured UIBackgroundModes = [audio]"

mkdir -p assets
/usr/bin/sips -s format jpeg "$ICON_SOURCE" --out assets/icon-only.jpg >/dev/null
/usr/bin/sips --resampleHeightWidth 1024 1024 assets/icon-only.jpg >/dev/null
/usr/bin/sips -s format jpeg "$SPLASH_SOURCE" --out assets/splash.jpg >/dev/null
/usr/bin/sips --resampleHeightWidth 2732 2732 assets/splash.jpg >/dev/null

npx @capacitor/assets generate --ios

if [[ ! -d "$ICON_SET" ]]; then
  echo "Missing generated $ICON_SET" >&2
  exit 1
fi

if [[ ! -d "$SPLASH_SET" ]]; then
  echo "Missing generated $SPLASH_SET" >&2
  exit 1
fi

find "$ICON_SET" -type f \( -name '*.png' -o -name '*.jpg' \) | grep -q . || {
  echo "AppIcon asset generation produced no raster image." >&2
  exit 1
}

find "$SPLASH_SET" -type f \( -name '*.png' -o -name '*.jpg' \) | grep -q . || {
  echo "Splash asset generation produced no raster image." >&2
  exit 1
}

echo "Configured Melody Music AppIcon and Splash artwork"
