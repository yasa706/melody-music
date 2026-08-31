import { json } from './http.js';
import { getSongById, listPublishedSongs, listCategories, listPlaylists, listAlbums, getAlbumById, listAlbumSongs } from './db.js';

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
  if (url.pathname === '/api/albums') return json({ albums: await listAlbums(env.DB, true) });
  const albumMatch = url.pathname.match(/^\/api\/albums\/(\d+)$/);
  if (albumMatch) {
    const album = await getAlbumById(env.DB, Number(albumMatch[1]), true);
    if (!album) return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    const songs = await listAlbumSongs(env.DB, Number(albumMatch[1]), true);
    return json({ album, songs });
  }
  return null;
}
