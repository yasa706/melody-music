import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUpload, makeObjectKey } from '../src/uploads.js';

test('audio upload accepts mp3 and rejects executable data', () => {
  assert.doesNotThrow(() => validateUpload({ type: 'audio/mpeg', size: 1024, name: 'a.mp3' }, 'audio'));
  assert.throws(() => validateUpload({ type: 'application/x-msdownload', size: 1024, name: 'a.exe' }, 'audio'));
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
  assert.match(makeObjectKey({ type: 'image/png', name: 'a.png' }, 'cover'), /^covers\/.+\.png$/);
  assert.match(makeObjectKey({ type: 'text/plain', name: 'a.lrc' }, 'lyrics'), /^lyrics\/.+\.lrc$/);
});
