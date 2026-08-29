function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function handleUserHistoryApi(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!user?.id) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  if (path === '/api/user/history' && request.method === 'GET') {
    const rawLimit = Number(url.searchParams.get('limit') || 100);
    const limit = Math.max(1, Math.min(200, Number.isFinite(rawLimit) ? rawLimit : 100));

    const { results = [] } = await env.DB.prepare(`
      SELECT
        s.id,
        s.title,
        s.artist,
        s.album,
        s.audio_url,
        s.cover_url,
        s.lyrics_lrc,
        s.duration_seconds,
        c.name AS category_name,
        MAX(h.played_at) AS played_at
      FROM user_play_history h
      JOIN songs s ON s.id = h.song_id
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE h.user_id = ? AND s.is_published = 1
      GROUP BY s.id
      ORDER BY played_at DESC
      LIMIT ?
    `).bind(user.id, limit).all();

    return json({ history: results });
  }

  const match = path.match(/^\/api\/user\/history\/(\d+)$/);

  if (match && request.method === 'POST') {
    const songId = Number(match[1]);

    const song = await env.DB.prepare(`
      SELECT id
      FROM songs
      WHERE id = ? AND is_published = 1
      LIMIT 1
    `).bind(songId).first();

    if (!song) {
      return json({ error: 'SONG_NOT_FOUND' }, 404);
    }

    await env.DB.prepare(`
      INSERT INTO user_play_history (user_id, song_id)
      VALUES (?, ?)
    `).bind(user.id, songId).run();

    // 每位用户最多保留最近 200 条原始播放记录。
    await env.DB.prepare(`
      DELETE FROM user_play_history
      WHERE user_id = ?
        AND id NOT IN (
          SELECT id
          FROM user_play_history
          WHERE user_id = ?
          ORDER BY played_at DESC, id DESC
          LIMIT 200
        )
    `).bind(user.id, user.id).run();

    return json({ ok: true }, 201);
  }

  if (path === '/api/user/history' && request.method === 'DELETE') {
    await env.DB.prepare(`
      DELETE FROM user_play_history
      WHERE user_id = ?
    `).bind(user.id).run();

    return json({ ok: true });
  }

  return null;
}
