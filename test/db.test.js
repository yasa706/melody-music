import test from 'node:test';
import assert from 'node:assert/strict';
import { listPublishedSongs, listCategories, listPlaylists, getSongById } from '../src/db.js';

test('listPublishedSongs filters drafts and orders by sort_order', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      calls.push(sql);
      return { all: async () => ({ results: [{ id: 2, title: 'Published' }] }) };
    },
  };
  const rows = await listPublishedSongs(db);
  assert.equal(rows[0].title, 'Published');
  assert.match(calls[0], /is_published\s*=\s*1/);
  assert.match(calls[0], /sort_order/);
});

test('getSongById binds id', async () => {
  let bound;
  const db = { prepare() { return { bind(v) { bound = v; return this; }, first: async () => ({ id: vSafe(bound) }) }; } };
  function vSafe(v){ return v; }
  const row = await getSongById(db, 7);
  assert.equal(bound, 7);
  assert.equal(row.id, 7);
});

test('category and playlist queries return results', async () => {
  const db = { prepare() { return { all: async () => ({ results: [{ id: 1 }] }) }; } };
  assert.equal((await listCategories(db)).length, 1);
  assert.equal((await listPlaylists(db, true)).length, 1);
});

test('album queries return published albums and bind album id', async () => {
  const calls = [];
  let bound;
  const db = {
    prepare(sql) {
      calls.push(sql);
      return {
        bind(v) { bound = v; return this; },
        all: async () => ({ results: [{ id: 1, title: 'Album', song_count: 2 }] }),
        first: async () => ({ id: bound, title: 'Album' }),
      };
    },
  };
  const mod = await import('../src/db.js');
  const albums = await mod.listAlbums(db, true);
  assert.equal(albums[0].title, 'Album');
  assert.match(calls[0], /is_published\s*=\s*1/);
  const album = await mod.getAlbumById(db, 9, true);
  assert.equal(bound, 9);
  assert.equal(album.id, 9);
});

test('album song query filters unpublished songs for public detail', async () => {
  const calls = [];
  const db = { prepare(sql) { calls.push(sql); return { bind(){ return this; }, all: async()=>({results:[]}) }; } };
  const mod = await import('../src/db.js');
  await mod.listAlbumSongs(db, 3, true);
  assert.match(calls[0], /album_id\s*=\s*\?/);
  assert.match(calls[0], /is_published\s*=\s*1/);
});
