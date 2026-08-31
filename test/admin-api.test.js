import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSong } from '../src/admin-api.js';

test('song validation rejects missing title and unsafe external urls', () => {
  assert.ok(normalizeSong({ artist:'A', audio_type:'external', audio_url:'https://x', cover_type:'external' }).error);
  assert.ok(normalizeSong({ title:'T', artist:'A', audio_type:'external', audio_url:'javascript:alert(1)', cover_type:'external' }).error);
});

test('song validation normalizes valid values', () => {
  const { value } = normalizeSong({ title:' T ', artist:' A ', audio_type:'external', audio_url:'https://example.com/a.mp3', cover_type:'external', cover_url:'https://example.com/a.jpg', is_published:true, duration_seconds:'12', playlist_ids:[2,3] });
  assert.equal(value.title, 'T'); assert.equal(value.is_published, 1); assert.equal(value.duration_seconds, 12); assert.deepEqual(value.playlist_ids,[2,3]);
});

test('category slug rule accepts lowercase kebab-case only', () => {
  assert.match('worship-music', /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.doesNotMatch('Worship Music', /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test('song validation accepts optional album_id', () => {
  const { value } = normalizeSong({ title:'T', artist:'A', album_id:'4', audio_type:'external', audio_url:'https://example.com/a.mp3', cover_type:'external' });
  assert.equal(value.album_id, 4);
});

test('album validation trims fields and normalizes publication state', async () => {
  const { normalizeAlbum } = await import('../src/admin-api.js');
  const { value } = normalizeAlbum({ title:' Hope ', artist:' Choir ', cover_url:'https://example.com/c.jpg', description:' D ', is_published:true, sort_order:'2' });
  assert.equal(value.title, 'Hope');
  assert.equal(value.artist, 'Choir');
  assert.equal(value.is_published, 1);
  assert.equal(value.sort_order, 2);
});

test('album validation preserves selected song ids', async () => {
  const { normalizeAlbum } = await import('../src/admin-api.js');
  const { value } = normalizeAlbum({ title:'Hope', song_ids:['2','5','bad',5] });
  assert.deepEqual(value.song_ids, [2,5,5]);
});
