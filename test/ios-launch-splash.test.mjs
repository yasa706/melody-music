import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as iosApp from '../public/ios-app.js';

test('iOS app exposes a branded in-app launch splash installer', () => {
  assert.equal(typeof iosApp.installIOSLaunchSplash, 'function');
});

test('iOS launch splash stays visible for about 1.3 seconds and fades out', () => {
  const js = fs.readFileSync('public/ios-app.js', 'utf8');
  const css = fs.readFileSync('public/ios-mobile.css', 'utf8');

  assert.match(js, /1300/);
  assert.match(js, /iosLaunchSplash/);
  assert.match(js, /is-hiding/);
  assert.match(css, /\.ios-launch-splash/);
  assert.match(css, /opacity/);
  assert.match(css, /transition/);
});
