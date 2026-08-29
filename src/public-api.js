import { json } from './http.js';
import { getSongById, listPublishedSongs, listCategories, listPlaylists } from './db.js';

export async function handlePublicApi(request, env, url) {
  if (request.method !== 'GET') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }, 405);
  if (url.pathname === '/api/songs') return json({ songs: await listPublishedSongs(env.DB) });
  const songMatch = url.pathname.match(/^\/api\/songs\/(\d+)$/);
  if (songMatch) {
    const song = await getSongById(env.DB, Number(songMatch[1]));
    if (!song || Number(song.is_published) !== 1) return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    return json({ song });
  }
  if (url.pathname === '/api/categories') return json({ categories: await listCategories(env.DB) });
  if (url.pathname === '/api/playlists') return json({ playlists: await listPlaylists(env.DB, true) });
  return null;
}
