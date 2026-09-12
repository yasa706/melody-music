#!/usr/bin/env bash
set -euo pipefail

PLIST="ios/App/App/Info.plist"

if [[ ! -f "$PLIST" ]]; then
  echo "Missing $PLIST. Run 'npx cap add ios' first." >&2
  exit 1
fi

/usr/libexec/PlistBuddy -c "Delete :UIBackgroundModes" "$PLIST" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :UIBackgroundModes:0 string audio" "$PLIST"

echo "Configured UIBackgroundModes = [audio]"
