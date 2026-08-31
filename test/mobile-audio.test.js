import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('player starts at full HTML media volume', () => {
  assert.match(app, /volume:\s*1(?:\.0)?[,\n]/);
});

test('Android WebView gets a guarded audio gain path with compressor fallback', () => {
  assert.match(app, /function configureAndroidAudioBoost\(/);
  assert.match(app, /Amplitude\.getAudio\(\)/);
  assert.match(app, /createDynamicsCompressor/);
  assert.match(app, /gain\.value\s*=\s*1\.45/);
});
