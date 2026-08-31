import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePublicApi } from '../src/public-api.js';

test('public song list delegates to published query and returns song fields', async () => {
  const env = { DB: { prepare(sql){ assert.match(sql,/is_published\s*=\s*1/); return { all: async()=>({results:[{id:1,title:'T',audio_url:'/a.mp3',cover_url:'',lyrics_lrc:'',duration_seconds:3}]})}; } } };
  const res = await handlePublicApi(new Request('https://x/api/songs'), env, new URL('https://x/api/songs'));
  assert.equal(res.status,200); const body=await res.json(); assert.equal(body.songs[0].title,'T');
});

test('public albums endpoint returns published album summaries', async () => {
  const env = { DB: { prepare(sql){ assert.match(sql,/FROM albums/); assert.match(sql,/is_published\s*=\s*1/); return { all: async()=>({results:[{id:2,title:'Hope',song_count:1}]})}; } } };
  const res = await handlePublicApi(new Request('https://x/api/albums'), env, new URL('https://x/api/albums'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.albums[0].title, 'Hope');
});
