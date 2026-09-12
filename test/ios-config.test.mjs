import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));

test('iOS Capacitor config uses the approved app identity', () => {
  const config = readJson('ios-app/capacitor.config.json');
  assert.equal(config.appId, 'com.glory.melodymusic');
  assert.equal(config.appName, 'Melody Music');
  assert.equal(config.webDir, 'www');
});

test('iOS Capacitor config points to the canonical production site', () => {
  const config = readJson('ios-app/capacitor.config.json');
  assert.equal(config.server?.url, 'https://babavs.edu.kg/');
  assert.equal(config.server?.cleartext, false);
});
