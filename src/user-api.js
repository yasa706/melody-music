import { json } from './http.js';
import { requireUser } from './user-auth.js';

function validOrigin(request) {
  const origin = request.headers.get('origin');

  if (!origin) return true;

  return origin === new URL(request.url).origin;
}

function favoriteSongIdFromPath(pathname) {
  const match = pathname.match(
    /^\/api\/user\/favorites\/(\d+)$/
  );

  return match ? Number(match[1]) : null;
}

function playlistIdFromPath(pathname) {
  const match = pathname.match(
    /^\/api\/user\/playlists\/(\d+)$/
  );

  return match ? Number(match[1]) : null;
}

function playlistSongFromPath(pathname) {
  const match = pathname.match(
    /^\/api\/user\/playlists\/(\d+)\/songs\/(\d+)$/
  );

  if (!match) return null;

  return {
    playlistId: Number(match[1]),
    songId: Number(match[2]),
  };
}

async function requireLoggedInUser(request, env) {
  const user = await requireUser(request, env);

  if (!user) {
    return {
      error: json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Please login first',
          },
        },
        401,
        {
          'cache-control': 'no-store',
        }
      ),
    };
  }

  return { user };
}

async function ensurePlaylistOwner(
  env,
  userId,
  playlistId
) {
  return env.DB
    .prepare(`
      SELECT
        id,
        user_id,
        name,
        description,
        created_at,
        updated_at
      FROM user_playlists
      WHERE
        id = ?
        AND user_id = ?
    `)
    .bind(
      playlistId,
      userId
    )
    .first();
}

async function ensurePublishedSong(
  env,
  songId
) {
  return env.DB
    .prepare(`
      SELECT id
      FROM songs
      WHERE
        id = ?
        AND is_published = 1
    `)
    .bind(songId)
    .first();
}

/* =========================================================
   Favorites
   ========================================================= */

async function listFavorites(request, env) {
  const auth = await requireLoggedInUser(
    request,
    env
  );

  if (auth.error) return auth.error;

  const result = await env.DB
    .prepare(`
      SELECT
        s.id,
        s.title,
        s.artist,
        s.album,
        s.category_id,
        s.audio_type,
        s.audio_url,
        s.cover_type,
        s.cover_url,
        s.lyrics_lrc,
        s.duration_seconds,
        s.sort_order,
        f.created_at AS favorited_at
      FROM user_favorites f
      JOIN songs s
        ON s.id = f.song_id
      WHERE
        f.user_id = ?
        AND s.is_published = 1
      ORDER BY f.created_at DESC
    `)
    .bind(auth.user.user_id)
    .all();

  return json(
    {
      favorites: result.results || [],
    },
    200,
    {
      'cache-control': 'no-store',
    }
  );
}

async function addFavorite(
  request,
  env,
  songId
) {
  if (!validOrigin(request)) {
    return json(
      {
        error: {
          code: 'ORIGIN_FORBIDDEN',
          message: 'Origin forbidden',
        },
      },
      403
    );
  }

  const auth = await requireLoggedInUser(
    request,
    env
  );

  if (auth.error) return auth.error;

  const song = await ensurePublishedSong(
    env,
    songId
  );

  if (!song) {
    return json(
      {
        error: {
          code: 'SONG_NOT_FOUND',
          message: 'Song not found',
        },
      },
      404
    );
  }

  await env.DB
    .prepare(`
      INSERT OR IGNORE INTO user_favorites
      (
        user_id,
        song_id
      )
      VALUES (?, ?)
    `)
    .bind(
      auth.user.user_id,
      songId
    )
    .run();

  return json(
    {
      ok: true,
      favorite: true,
      songId,
    },
    200,
    {
      'cache-control': 'no-store',
    }
  );
}

async function removeFavorite(
  request,
  env,
  songId
) {
  if (!validOrigin(request)) {
    return json(
      {
        error: {
          code: 'ORIGIN_FORBIDDEN',
          message: 'Origin forbidden',
        },
      },
      403
    );
  }

  const auth = await requireLoggedInUser(
    request,
    env
  );

  if (auth.error) return auth.error;

  await env.DB
    .prepare(`
      DELETE FROM user_favorites
      WHERE
        user_id = ?
        AND song_id = ?
    `)
    .bind(
      auth.user.user_id,
      songId
    )
    .run();

  return json(
    {
      ok: true,
      favorite: false,
      songId,
    },
    200,
    {
      'cache-control': 'no-store',
    }
  );
}

/* =========================================================
   Playlists
   ========================================================= */

async function listPlaylists(
  request,
  env
) {
  const auth = await requireLoggedInUser(
    request,
    env
  );

  if (auth.error) return auth.error;

  const result = await env.DB
    .prepare(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.created_at,
        p.updated_at,
        COUNT(ps.song_id) AS song_count
      FROM user_playlists p
      LEFT JOIN user_playlist_songs ps
        ON ps.playlist_id = p.id
      WHERE p.user_id = ?
      GROUP BY
        p.id,
        p.name,
        p.description,
        p.created_at,
        p.updated_at
      ORDER BY p.updated_at DESC, p.id DESC
    `)
    .bind(auth.user.user_id)
    .all();

  return json(
    {
      playlists: result.results || [],
    },
    200,
    {
      'cache-control': 'no-store',
    }
  );
}

async function createPlaylist(
  request,
  env
) {
  if (!validOrigin(request)) {
    return json(
      {
        error: {
          code: 'ORIGIN_FORBIDDEN',
          message: 'Origin forbidden',
        },
      },
      403
    );
  }

  const auth = await requireLoggedInUser(
    request,
    env
  );

  if (auth.error) return auth.error;

  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON',
        },
      },
      400
    );
  }

  const name = String(
    body?.name || ''
  ).trim();

  const description = String(
    body?.description || ''
  ).trim();

  if (!name) {
    return json(
      {
        error: {
          code: 'PLAYLIST_NAME_REQUIRED',
          message: 'Playlist name is required',
        },
      },
      400
    );
  }

  if (name.length > 100) {
    return json(
      {
        error: {
          code: 'PLAYLIST_NAME_TOO_LONG',
          message: 'Playlist name is too long',
        },
      },
      400
    );
  }

  if (description.length > 500) {
    return json(
      {
        error: {
          code: 'PLAYLIST_DESCRIPTION_TOO_LONG',
          message: 'Playlist description is too long',
        },
      },
      400
    );
  }

  const result = await env.DB
    .prepare(`
      INSERT INTO user_playlists
      (
        user_id,
        name,
        description
      )
      VALUES (?, ?, ?)
    `)
    .bind(
      auth.user.user_id,
      name,
      description || null
    )
    .run();

  return json(
    {
      ok: true,
      playlist: {
        id: result.meta.last_row_id,
        name,
        description:
          description || null,
        song_count: 0,
      },
    },
    201,
    {
      'cache-control': 'no-store',
    }
  );
}

async function getPlaylist(
  request,
  env,
  playlistId
) {
  const auth = await requireLoggedInUser(
    request,
    env
  );

  if (auth.error) return auth.error;

  const playlist = await ensurePlaylistOwner(
    env,
    auth.user.user_id,
    playlistId
  );

  if (!playlist) {
    return json(
      {
        error: {
          code: 'PLAYLIST_NOT_FOUND',
          message: 'Playlist not found',
        },
      },
      404
    );
  }

  const result = await env.DB
    .prepare(`
      SELECT
        s.id,
        s.title,
        s.artist,
        s.album,
        s.category_id,
        s.audio_type,
        s.audio_url,
        s.cover_type,
        s.cover_url,
        s.lyrics_lrc,
        s.duration_seconds,
        s.sort_order,
        ps.sort_order AS playlist_sort_order,
        ps.created_at AS added_at
      FROM user_playlist_songs ps
      JOIN songs s
        ON s.id = ps.song_id
      WHERE
        ps.playlist_id = ?
        AND s.is_published = 1
      ORDER BY
        ps.sort_order ASC,
        ps.created_at ASC
    `)
    .bind(playlistId)
    .all();

  return json(
    {
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description:
          playlist.description || null,
        created_at: playlist.created_at,
        updated_at: playlist.updated_at,
      },
      songs: result.results || [],
    },
    200,
    {
      'cache-control': 'no-store',
    }
  );
}

async function deletePlaylist(
  request,
  env,
  playlistId
) {
  if (!validOrigin(request)) {
    return json(
      {
        error: {
          code: 'ORIGIN_FORBIDDEN',
          message: 'Origin forbidden',
        },
      },
      403
    );
  }

  const auth = await requireLoggedInUser(
    request,
    env
  );

  if (auth.error) return auth.error;

  const playlist = await ensurePlaylistOwner(
    env,
    auth.user.user_id,
    playlistId
  );

  if (!playlist) {
    return json(
      {
        error: {
          code: 'PLAYLIST_NOT_FOUND',
          message: 'Playlist not found',
        },
      },
      404
    );
  }

  await env.DB
    .prepare(`
      DELETE FROM user_playlists
      WHERE
        id = ?
        AND user_id = ?
    `)
    .bind(
      playlistId,
      auth.user.user_id
    )
    .run();

  return json(
    {
      ok: true,
      playlistId,
    },
    200,
    {
      'cache-control': 'no-store',
    }
  );
}

async function addSongToPlaylist(
  request,
  env,
  playlistId,
  songId
) {
  if (!validOrigin(request)) {
    return json(
      {
        error: {
          code: 'ORIGIN_FORBIDDEN',
          message: 'Origin forbidden',
        },
      },
      403
    );
  }

  const auth = await requireLoggedInUser(
    request,
    env
  );

  if (auth.error) return auth.error;

  const playlist = await ensurePlaylistOwner(
    env,
    auth.user.user_id,
    playlistId
  );

  if (!playlist) {
    return json(
      {
        error: {
          code: 'PLAYLIST_NOT_FOUND',
          message: 'Playlist not found',
        },
      },
      404
    );
  }

  const song = await ensurePublishedSong(
    env,
    songId
  );

  if (!song) {
    return json(
      {
        error: {
          code: 'SONG_NOT_FOUND',
          message: 'Song not found',
        },
      },
      404
    );
  }

  const maxRow = await env.DB
    .prepare(`
      SELECT
        COALESCE(MAX(sort_order), -1) AS max_order
      FROM user_playlist_songs
      WHERE playlist_id = ?
    `)
    .bind(playlistId)
    .first();

  const nextOrder =
    Number(maxRow?.max_order ?? -1) + 1;

  await env.DB
    .prepare(`
      INSERT OR IGNORE INTO user_playlist_songs
      (
        playlist_id,
        song_id,
        sort_order
      )
      VALUES (?, ?, ?)
    `)
    .bind(
      playlistId,
      songId,
      nextOrder
    )
    .run();

  await env.DB
    .prepare(`
      UPDATE user_playlists
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(playlistId)
    .run();

  return json(
    {
      ok: true,
      playlistId,
      songId,
    },
    200,
    {
      'cache-control': 'no-store',
    }
  );
}

async function removeSongFromPlaylist(
  request,
  env,
  playlistId,
  songId
) {
  if (!validOrigin(request)) {
    return json(
      {
        error: {
          code: 'ORIGIN_FORBIDDEN',
          message: 'Origin forbidden',
        },
      },
      403
    );
  }

  const auth = await requireLoggedInUser(
    request,
    env
  );

  if (auth.error) return auth.error;

  const playlist = await ensurePlaylistOwner(
    env,
    auth.user.user_id,
    playlistId
  );

  if (!playlist) {
    return json(
      {
        error: {
          code: 'PLAYLIST_NOT_FOUND',
          message: 'Playlist not found',
        },
      },
      404
    );
  }

  await env.DB
    .prepare(`
      DELETE FROM user_playlist_songs
      WHERE
        playlist_id = ?
        AND song_id = ?
    `)
    .bind(
      playlistId,
      songId
    )
    .run();

  await env.DB
    .prepare(`
      UPDATE user_playlists
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(playlistId)
    .run();

  return json(
    {
      ok: true,
      playlistId,
      songId,
    },
    200,
    {
      'cache-control': 'no-store',
    }
  );
}

/* =========================================================
   Router
   ========================================================= */

export async function handleUserApi(
  request,
  env,
  url
) {
  /*
   * Favorites
   */

  if (
    url.pathname ===
      '/api/user/favorites' &&
    request.method === 'GET'
  ) {
    return listFavorites(
      request,
      env
    );
  }

  const favoriteSongId =
    favoriteSongIdFromPath(
      url.pathname
    );

  if (
    favoriteSongId &&
    request.method === 'POST'
  ) {
    return addFavorite(
      request,
      env,
      favoriteSongId
    );
  }

  if (
    favoriteSongId &&
    request.method === 'DELETE'
  ) {
    return removeFavorite(
      request,
      env,
      favoriteSongId
    );
  }

  /*
   * Playlists
   */

  if (
    url.pathname ===
      '/api/user/playlists' &&
    request.method === 'GET'
  ) {
    return listPlaylists(
      request,
      env
    );
  }

  if (
    url.pathname ===
      '/api/user/playlists' &&
    request.method === 'POST'
  ) {
    return createPlaylist(
      request,
      env
    );
  }

  const playlistSong =
    playlistSongFromPath(
      url.pathname
    );

  if (
    playlistSong &&
    request.method === 'POST'
  ) {
    return addSongToPlaylist(
      request,
      env,
      playlistSong.playlistId,
      playlistSong.songId
    );
  }

  if (
    playlistSong &&
    request.method === 'DELETE'
  ) {
    return removeSongFromPlaylist(
      request,
      env,
      playlistSong.playlistId,
      playlistSong.songId
    );
  }

  const playlistId =
    playlistIdFromPath(
      url.pathname
    );

  if (
    playlistId &&
    request.method === 'GET'
  ) {
    return getPlaylist(
      request,
      env,
      playlistId
    );
  }

  if (
    playlistId &&
    request.method === 'DELETE'
  ) {
    return deletePlaylist(
      request,
      env,
      playlistId
    );
  }

  return null;
}
