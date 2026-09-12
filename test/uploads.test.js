import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUpload, makeObjectKey, storeUpload } from '../src/uploads.js';

test('audio upload accepts supported formats and rejects executable data', () => {
  const supported = [
    ['audio/mpeg', 'a.mp3'],
    ['audio/mp4', 'a.m4a'],
    ['audio/aac', 'a.aac'],
    ['audio/wav', 'a.wav'],
    ['audio/ogg', 'a.ogg'],
    ['audio/opus', 'a.opus'],
    ['audio/flac', 'a.flac'],
  ];
  for (const [type, name] of supported) {
    assert.doesNotThrow(() => validateUpload({ type, size: 1024, name }, 'audio'), `${name} should be accepted`);
  }
  assert.throws(() => validateUpload({ type: 'application/x-msdownload', size: 1024, name: 'a.exe' }, 'audio'));
  assert.throws(() => validateUpload({ type: 'audio/mpeg', size: 1024, name: 'a.wav' }, 'audio'));
});

test('size limits and mime rules are enforced', () => {
  assert.throws(() => validateUpload({ type: 'audio/mpeg', size: 50 * 1024 * 1024 + 1, name: 'a.mp3' }, 'audio'));
  assert.doesNotThrow(() => validateUpload({ type: 'image/webp', size: 1000, name: 'a.webp' }, 'cover'));
  assert.throws(() => validateUpload({ type: 'image/gif', size: 1000, name: 'a.gif' }, 'cover'));
  assert.doesNotThrow(() => validateUpload({ type: 'text/plain', size: 1000, name: 'song.lrc' }, 'lyrics'));
  assert.throws(() => validateUpload({ type: 'text/plain', size: 1000, name: 'song.txt' }, 'lyrics'));
});

test('generated object keys use expected prefixes', () => {
  assert.match(makeObjectKey({ type: 'audio/mpeg', name: 'a.mp3' }, 'audio'), /^audio\/.+\.mp3$/);
  assert.match(makeObjectKey({ type: 'audio/mp4', name: 'a.m4a' }, 'audio'), /^audio\/.+\.m4a$/);
  assert.match(makeObjectKey({ type: 'audio/aac', name: 'a.aac' }, 'audio'), /^audio\/.+\.aac$/);
  assert.match(makeObjectKey({ type: 'audio/wav', name: 'a.wav' }, 'audio'), /^audio\/.+\.wav$/);
  assert.match(makeObjectKey({ type: 'audio/ogg', name: 'a.ogg' }, 'audio'), /^audio\/.+\.ogg$/);
  assert.match(makeObjectKey({ type: 'audio/opus', name: 'a.opus' }, 'audio'), /^audio\/.+\.opus$/);
  assert.match(makeObjectKey({ type: 'audio/flac', name: 'a.flac' }, 'audio'), /^audio\/.+\.flac$/);
  assert.match(makeObjectKey({ type: 'image/png', name: 'a.png' }, 'cover'), /^covers\/.+\.png$/);
  assert.match(makeObjectKey({ type: 'text/plain', name: 'a.lrc' }, 'lyrics'), /^lyrics\/.+\.lrc$/);
});

test('uploaded media URL preserves path separators', async () => {
  const bucket = { put: async () => {} };
  const file = { type: 'image/png', size: 1024, name: 'cover.png' };
  const stored = await storeUpload(bucket, file, 'cover');
  assert.match(stored.url, /^\/media\/covers\/.+\.png$/);
  assert.doesNotMatch(stored.url, /%2F/i);
});
