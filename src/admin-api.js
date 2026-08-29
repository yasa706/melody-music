import { json, sameOriginOrAbsent } from './http.js';
import { requireAdmin, requireCsrf } from './auth.js';
import { storeUpload, deleteUpload, UploadError } from './uploads.js';
import { getSongById, getSongPlaylistIds, listAllSongs, replaceSongPlaylists } from './db.js';

const AUDIO_TYPES = new Set(['upload', 'external']);
const COVER_TYPES = new Set(['upload', 'external']);

async function authorize(request, env, mutation = false) {
  const session = await requireAdmin(request, env);
  if (!session) return { response: json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401, { 'cache-control': 'no-store' }) };
  if (mutation && !sameOriginOrAbsent(request)) return { response: json({ error: { code: 'ORIGIN_FORBIDDEN', message: 'Origin forbidden' } }, 403, { 'cache-control': 'no-store' }) };
  if (mutation && !requireCsrf(request, session)) return { response: json({ error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' } }, 403, { 'cache-control': 'no-store' }) };
  return { session };
}

function isHttpUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; }
}

export function normalizeSong(input = {}) {
  const out = {
    title: String(input.title || '').trim(), artist: String(input.artist || '').trim(), album: String(input.album || '').trim(),
    category_id: input.category_id ? Number(input.category_id) : null,
    audio_type: String(input.audio_type || ''), audio_url: String(input.audio_url || '').trim(),
    cover_type: String(input.cover_type || ''), cover_url: String(input.cover_url || '').trim(),
    lyrics_lrc: String(input.lyrics_lrc || ''),
    duration_seconds: Math.max(0, Number.parseInt(input.duration_seconds || 0, 10) || 0),
    is_published: input.is_published ? 1 : 0,
    sort_order: Math.max(0, Number.parseInt(input.sort_order || 0, 10) || 0),
    playlist_ids: Array.isArray(input.playlist_ids) ? input.playlist_ids.map(Number).filter(Number.isInteger) : [],
  };
  if (!out.title || !out.artist || !AUDIO_TYPES.has(out.audio_type) || !out.audio_url || !COVER_TYPES.has(out.cover_type)) return { error: 'Title, artist, audio source and cover type are required' };
  if (out.audio_type === 'external' && !isHttpUrl(out.audio_url)) return { error: 'Audio URL must use http or https' };
  if (out.cover_type === 'external' && out.cover_url && !isHttpUrl(out.cover_url)) return { error: 'Cover URL must use http or https' };
  if (out.category_id !== null && !Number.isInteger(out.category_id)) return { error: 'Invalid category' };
  return { value: out };
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function handleSongs(request, env, url) {
  const match = url.pathname.match(/^\/api\/admin\/songs(?:\/(\d+))?$/);
  if (!match) return null;
  const id = match[1] ? Number(match[1]) : null;
  const mutation = ['POST','PUT','DELETE'].includes(request.method);
  const auth = await authorize(request, env, mutation);
  if (auth.response) return auth.response;

  if (request.method === 'GET' && !id) return json({ songs: await listAllSongs(env.DB) }, 200, { 'cache-control': 'no-store' });
  if (request.method === 'GET' && id) {
    const song = await getSongById(env.DB, id);
    if (!song) return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    song.playlist_ids = await getSongPlaylistIds(env.DB, id);
    return json({ song }, 200, { 'cache-control': 'no-store' });
  }
  if (request.method === 'POST' && !id) {
    const body = await readJson(request); if (!body) return json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, 400);
    const normalized = normalizeSong(body); if (normalized.error) return json({ error: { code: 'VALIDATION_ERROR', message: normalized.error } }, 400);
    const s = normalized.value;
    const result = await env.DB.prepare(`INSERT INTO songs (title,artist,album,category_id,audio_type,audio_url,cover_type,cover_url,lyrics_lrc,duration_seconds,is_published,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(s.title,s.artist,s.album,s.category_id,s.audio_type,s.audio_url,s.cover_type,s.cover_url,s.lyrics_lrc,s.duration_seconds,s.is_published,s.sort_order).run();
    const newId = Number(result.meta?.last_row_id || result.lastRowId);
    await replaceSongPlaylists(env.DB, newId, s.playlist_ids);
    return json({ song: await getSongById(env.DB, newId) }, 201);
  }
  if (request.method === 'PUT' && id) {
    if (!(await getSongById(env.DB, id))) return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    const body = await readJson(request); if (!body) return json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, 400);
    const normalized = normalizeSong(body); if (normalized.error) return json({ error: { code: 'VALIDATION_ERROR', message: normalized.error } }, 400);
    const s = normalized.value;
    await env.DB.prepare(`UPDATE songs SET title=?,artist=?,album=?,category_id=?,audio_type=?,audio_url=?,cover_type=?,cover_url=?,lyrics_lrc=?,duration_seconds=?,is_published=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(s.title,s.artist,s.album,s.category_id,s.audio_type,s.audio_url,s.cover_type,s.cover_url,s.lyrics_lrc,s.duration_seconds,s.is_published,s.sort_order,id).run();
    await replaceSongPlaylists(env.DB, id, s.playlist_ids);
    return json({ song: await getSongById(env.DB, id) });
  }
  if (request.method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM songs WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  }
  return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }, 405);
}

async function handleCategories(request, env, url) {
  const match = url.pathname.match(/^\/api\/admin\/categories(?:\/(\d+))?$/);
  if (!match) return null;
  const id = match[1] ? Number(match[1]) : null;
  const mutation = ['POST','PUT','DELETE'].includes(request.method);
  const auth = await authorize(request, env, mutation); if (auth.response) return auth.response;
  if (request.method === 'GET' && !id) { const { results=[] } = await env.DB.prepare('SELECT * FROM categories ORDER BY name COLLATE NOCASE').all(); return json({ categories: results }); }
  if (request.method === 'POST' && !id) {
    const body = await readJson(request); const name=String(body?.name||'').trim(); const slug=String(body?.slug||'').trim().toLowerCase();
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({error:{code:'VALIDATION_ERROR',message:'Invalid name or slug'}},400);
    try { const r=await env.DB.prepare('INSERT INTO categories (name,slug) VALUES (?,?)').bind(name,slug).run(); return json({category:{id:Number(r.meta?.last_row_id||r.lastRowId),name,slug}},201); }
    catch(e){ if (String(e).toLowerCase().includes('unique')) return json({error:{code:'DUPLICATE_SLUG',message:'Category slug already exists'}},409); throw e; }
  }
  if (request.method === 'PUT' && id) { const body=await readJson(request); const name=String(body?.name||'').trim(); const slug=String(body?.slug||'').trim().toLowerCase(); if(!name||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({error:{code:'VALIDATION_ERROR',message:'Invalid name or slug'}},400); try { await env.DB.prepare('UPDATE categories SET name=?,slug=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(name,slug,id).run(); return json({category:{id,name,slug}}); } catch(e){ if(String(e).toLowerCase().includes('unique')) return json({error:{code:'DUPLICATE_SLUG',message:'Category slug already exists'}},409); throw e; } }
  if (request.method === 'DELETE' && id) { await env.DB.prepare('DELETE FROM categories WHERE id=?').bind(id).run(); return new Response(null,{status:204}); }
  return json({error:{code:'METHOD_NOT_ALLOWED',message:'Method not allowed'}},405);
}

async function replacePlaylistSongs(db, playlistId, songIds=[]) {
  const stmts=[db.prepare('DELETE FROM playlist_songs WHERE playlist_id=?').bind(playlistId)];
  songIds.map(Number).filter(Number.isInteger).forEach((songId,index)=>stmts.push(db.prepare('INSERT INTO playlist_songs (playlist_id,song_id,sort_order) VALUES (?,?,?)').bind(playlistId,songId,index)));
  if(db.batch) await db.batch(stmts); else for(const st of stmts) await st.run();
}

async function handlePlaylists(request, env, url) {
  const match=url.pathname.match(/^\/api\/admin\/playlists(?:\/(\d+))?$/); if(!match) return null; const id=match[1]?Number(match[1]):null;
  const mutation=['POST','PUT','DELETE'].includes(request.method); const auth=await authorize(request,env,mutation); if(auth.response) return auth.response;
  if(request.method==='GET'&&!id){ const {results=[]}=await env.DB.prepare('SELECT * FROM playlists ORDER BY id DESC').all(); return json({playlists:results}); }
  if(request.method==='GET'&&id){ const playlist=await env.DB.prepare('SELECT * FROM playlists WHERE id=?').bind(id).first(); if(!playlist)return json({error:{code:'NOT_FOUND',message:'Not found'}},404); const {results=[]}=await env.DB.prepare('SELECT song_id FROM playlist_songs WHERE playlist_id=? ORDER BY sort_order ASC').bind(id).all(); playlist.song_ids=results.map(x=>x.song_id); return json({playlist}); }
  if(request.method==='POST'&&!id){ const b=await readJson(request); const name=String(b?.name||'').trim(); if(!name) return json({error:{code:'VALIDATION_ERROR',message:'Name is required'}},400); const r=await env.DB.prepare('INSERT INTO playlists (name,description,cover_url,is_published) VALUES (?,?,?,?)').bind(name,String(b.description||'').trim(),String(b.cover_url||'').trim(),b.is_published?1:0).run(); const pid=Number(r.meta?.last_row_id||r.lastRowId); await replacePlaylistSongs(env.DB,pid,Array.isArray(b.song_ids)?b.song_ids:[]); return json({playlist:{id:pid,name}},201); }
  if(request.method==='PUT'&&id){ const b=await readJson(request); const name=String(b?.name||'').trim(); if(!name) return json({error:{code:'VALIDATION_ERROR',message:'Name is required'}},400); await env.DB.prepare('UPDATE playlists SET name=?,description=?,cover_url=?,is_published=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(name,String(b.description||'').trim(),String(b.cover_url||'').trim(),b.is_published?1:0,id).run(); await replacePlaylistSongs(env.DB,id,Array.isArray(b.song_ids)?b.song_ids:[]); return json({playlist:{id,name}}); }
  if(request.method==='DELETE'&&id){ await env.DB.prepare('DELETE FROM playlists WHERE id=?').bind(id).run(); return new Response(null,{status:204}); }
  return json({error:{code:'METHOD_NOT_ALLOWED',message:'Method not allowed'}},405);
}

export async function handleUpload(request, env) {
  const auth = await authorize(request, env, true); if (auth.response) return auth.response;
  try {
    if (request.method === 'POST') {
      const form = await request.formData();
      const result = await storeUpload(env.MEDIA, form.get('file'), String(form.get('kind') || ''));
      return json(result, 201);
    }
    if (request.method === 'DELETE') {
      await deleteUpload(env.MEDIA, new URL(request.url).searchParams.get('key'));
      return new Response(null, { status: 204 });
    }
  } catch (error) {
    if (error instanceof UploadError) return json({ error: { code: error.code, message: error.message } }, error.status);
    throw error;
  }
  return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }, 405);
}

export async function handleAdminApi(request, env, url) {
  if (url.pathname === '/api/admin/upload') return handleUpload(request, env);
  if (url.pathname === '/api/admin/dashboard' && request.method === 'GET') {
    const auth = await authorize(request, env, false); if (auth.response) return auth.response;
    const row = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM songs) AS songs,
      (SELECT COUNT(*) FROM songs WHERE is_published=1) AS published,
      (SELECT COUNT(*) FROM songs WHERE is_published=0) AS drafts,
      (SELECT COUNT(*) FROM playlists) AS playlists,
      (SELECT COUNT(*) FROM categories) AS categories`).first();
    return json({ dashboard: row }, 200, { 'cache-control': 'no-store' });
  }
  return (await handleSongs(request, env, url)) || (await handleCategories(request, env, url)) || (await handlePlaylists(request, env, url));
}
