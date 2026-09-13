import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const configure = () => fs.readFileSync('ios-app/scripts/configure-ios.sh', 'utf8');

test('iOS branding sources are committed as portable encoded assets', () => {
  assert.ok(fs.existsSync('ios-app/branding/AppIcon-1024.png.b64'));
  assert.ok(fs.existsSync('ios-app/branding/LaunchScreen.jpg.b64'));
});

test('iOS configure script installs the approved icon and launch artwork', () => {
  const script = configure();
  assert.match(script, /AppIcon\.appiconset/);
  assert.match(script, /AppIcon-1024\.png\.b64/);
  assert.match(script, /LaunchScreen\.imageset/);
  assert.match(script, /LaunchScreen\.jpg\.b64/);
  assert.match(script, /base64 --decode|base64 -D/);
});
