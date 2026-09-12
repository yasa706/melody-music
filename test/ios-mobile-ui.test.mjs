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

test('iOS controller exposes the approved four-tab navigation', () => {
  const source = fs.readFileSync('public/ios-app.js', 'utf8');
  for (const tab of ['home', 'albums', 'search', 'my']) {
    assert.match(source, new RegExp(`data-ios-tab=["']${tab}["']`));
  }
  assert.match(source, /id\s*=\s*['"]iosBottomNav['"]/);
});

test('iOS controller reuses the existing mini-player and full Now Playing view', () => {
  const source = fs.readFileSync('public/ios-app.js', 'utf8');
  assert.match(source, /querySelector\?\.\(['"]\.player-song['"]\)/);
  assert.match(source, /querySelector\?\.\(['"]\.now-panel['"]\)/);
  assert.match(source, /scrollIntoView/);
});
