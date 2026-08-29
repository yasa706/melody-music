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
