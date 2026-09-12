import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('iOS mobile stylesheet contains required app chrome hooks', () => {
  const css = fs.readFileSync('public/ios-mobile.css', 'utf8');
  for (const selector of [
    '.ios-native-app',
    '.ios-bottom-nav',
    '.ios-bottom-nav-button',
    '.ios-native-app .player-bar',
    '.ios-native-app .albums-grid',
    '.ios-native-app .now-panel',
  ]) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('iOS bridge exposes four primary navigation destinations', () => {
  const source = fs.readFileSync('public/ios-app.js', 'utf8');
  for (const tab of ['home', 'albums', 'search', 'my']) {
    assert.match(source, new RegExp(`data-ios-tab=["']${tab}["']`));
  }
});
