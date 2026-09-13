import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const configure = () => fs.readFileSync('ios-app/scripts/configure-ios.sh', 'utf8');
const packageJson = () => JSON.parse(fs.readFileSync('ios-app/package.json', 'utf8'));

test('iOS branding sources are committed as editable vector artwork', () => {
  assert.ok(fs.existsSync('ios-app/branding/icon-only.svg'));
  assert.ok(fs.existsSync('ios-app/branding/splash.svg'));
});

test('iOS project uses the official Capacitor asset generator', () => {
  const pkg = packageJson();
  assert.equal(pkg.devDependencies?.['@capacitor/assets'], '3.0.5');
});

test('iOS configure script rasterizes branding and generates AppIcon and Splash assets', () => {
  const script = configure();
  assert.match(script, /branding\/icon-only\.svg/);
  assert.match(script, /branding\/splash\.svg/);
  assert.match(script, /sips/);
  assert.match(script, /@capacitor\/assets generate --ios/);
  assert.match(script, /AppIcon\.appiconset/);
  assert.match(script, /Splash\.imageset/);
});
