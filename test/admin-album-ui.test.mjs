import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const adminJs = await readFile(new URL('../public/admin/admin.js', import.meta.url), 'utf8');

test('album editor exposes a multi-select for songs', () => {
  const albumEditor = adminJs.match(/if\(type==='albums'\)body\.innerHTML=([\s\S]*?);if\(type==='playlists'\)/)?.[1] || '';
  assert.match(albumEditor, /name="song_ids"/);
  assert.match(albumEditor, /multiple/);
});

test('album form payload sends selected song ids', () => {
  assert.match(adminJs, /type==='albums'[\s\S]*o\.song_ids=/);
});

test('song create and update SQL persist album_id', async () => {
  const source = await readFile(new URL('../src/admin-api.js', import.meta.url), 'utf8');
  assert.match(source, /INSERT INTO songs \([^)]*album_id/);
  assert.match(source, /UPDATE songs SET[^`]*album_id=\?/);
});
