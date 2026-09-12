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

test('public page contains the approved iPhone navigation and player hooks', () => {
  const html = fs.readFileSync('public/index.html', 'utf8');
  for (const tab of ['home', 'albums', 'search', 'my']) {
    assert.match(html, new RegExp(`data-ios-tab=["']${tab}["']`));
  }
  assert.match(html, /id=["']ios-mini-player["']/);
  assert.match(html, /id=["']ios-now-playing["']/);
  assert.match(html, /id=["']iosBottomNav["']/);
});

test('iOS controller activates existing static app chrome instead of duplicating it', () => {
  const source = fs.readFileSync('public/ios-app.js', 'utf8');
  assert.match(source, /getElementById\?\.\(['"]iosBottomNav['"]\)/);
  assert.match(source, /removeAttribute\(['"]hidden['"]\)/);
});
