import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const configure = () => fs.readFileSync('ios-app/scripts/configure-ios.sh', 'utf8');
const packageJson = () => JSON.parse(fs.readFileSync('ios-app/package.json', 'utf8'));

test('iOS branding sources are committed as portable encoded assets', () => {
  assert.ok(fs.existsSync('ios-app/branding/icon-only.jpg.b64'));
  assert.ok(fs.existsSync('ios-app/branding/splash.jpg.b64'));
});

test('iOS project uses the official Capacitor asset generator', () => {
  const pkg = packageJson();
  assert.equal(pkg.devDependencies?.['@capacitor/assets'], '3.0.5');
});

test('iOS configure script decodes branding and generates AppIcon and Splash assets', () => {
  const script = configure();
  assert.match(script, /icon-only\.jpg\.b64/);
  assert.match(script, /splash\.jpg\.b64/);
  assert.match(script, /base64 --decode|base64 -D/);
  assert.match(script, /@capacitor\/assets generate --ios/);
  assert.match(script, /AppIcon\.appiconset/);
  assert.match(script, /Splash\.imageset/);
});
