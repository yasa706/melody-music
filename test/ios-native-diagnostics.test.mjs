import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../ios-app/native-audio/ios/Sources/MelodyNativeAudio/NativeAudioPlayer.swift', import.meta.url),
  'utf8'
);

test('native audio logs the track URL and AVPlayerItem failure details', () => {
  assert.match(source, /track\.audioUrl\.absoluteString/);
  assert.match(source, /item\.observe\(\\\.status/);
  assert.match(source, /item\.error/);
  assert.match(source, /errorLog\(\)/);
  assert.match(source, /AVPlayerItemNewErrorLogEntry/);
});
