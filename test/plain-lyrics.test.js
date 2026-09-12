import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLyricsContent } from '../public/lyrics-fallback.js';

test('plain lyrics are returned when no timestamps exist', () => {
  const result = parseLyricsContent('第一句\n第二句\n\n第三句');
  assert.deepEqual(result.timed, []);
  assert.deepEqual(result.plain, ['第一句', '第二句', '第三句']);
});

test('timed LRC is detected and is not duplicated as plain lyrics', () => {
  const result = parseLyricsContent('[00:01.00]第一句\n[00:02.50]第二句');
  assert.equal(result.timed.length, 2);
  assert.deepEqual(result.plain, []);
});
