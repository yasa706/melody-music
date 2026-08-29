export async function getSongById(db, id) {
  return db.prepare(`
    SELECT s.*, c.name AS category_name
    FROM songs s
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE s.id = ?
  `).bind(Number(id)).first();
}

export async function listPublishedSongs(db) {
  const { results = [] } = await db.prepare(`
    SELECT s.*, c.name AS category_name
    FROM songs s
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE s.is_published = 1
    ORDER BY s.sort_order ASC, s.id DESC
  `).all();
  return results;
}

export async function listAllSongs(db) {
  const { results = [] } = await db.prepare(`
    SELECT s.*, c.name AS category_name
    FROM songs s
    LEFT JOIN categories c ON c.id = s.category_id
    ORDER BY s.sort_order ASC, s.id DESC
  `).all();
  return results;
}

export async function listCategories(db) {
  const { results = [] } = await db.prepare(`
    SELECT id, name, slug, created_at, updated_at
    FROM categories
    ORDER BY name COLLATE NOCASE ASC
  `).all();
  return results;
}

export async function listPlaylists(db, publishedOnly = false) {
  const where = publishedOnly ? 'WHERE p.is_published = 1' : '';
  const { results = [] } = await db.prepare(`
    SELECT p.*, COUNT(ps.song_id) AS song_count
    FROM playlists p
    LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
    ${where}
    GROUP BY p.id
    ORDER BY p.id DESC
  `).all();
  return results;
}

export async function getPlaylistSongIds(db, playlistId) {
  const { results = [] } = await db.prepare(`
    SELECT song_id FROM playlist_songs
    WHERE playlist_id = ?
    ORDER BY sort_order ASC
  `).bind(Number(playlistId)).all();
  return results.map(r => r.song_id);
}

export async function getSongPlaylistIds(db, songId) {
  const { results = [] } = await db.prepare('SELECT playlist_id FROM playlist_songs WHERE song_id = ? ORDER BY sort_order ASC').bind(Number(songId)).all();
  return results.map(r => r.playlist_id);
}

export async function replaceSongPlaylists(db, songId, playlistIds = []) {
  const statements = [db.prepare('DELETE FROM playlist_songs WHERE song_id = ?').bind(Number(songId))];
  [...new Set(playlistIds.map(Number).filter(Number.isInteger))].forEach((playlistId, index) => {
    statements.push(db.prepare('INSERT INTO playlist_songs (playlist_id, song_id, sort_order) VALUES (?, ?, ?)').bind(playlistId, Number(songId), index));
  });
  if (db.batch) await db.batch(statements); else for (const stmt of statements) await stmt.run();
}
