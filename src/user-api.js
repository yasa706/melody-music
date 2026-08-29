import { json } from './http.js';
import { requireUser } from './user-auth.js';

function validOrigin(request) {
  const origin = request.headers.get('origin');

  if (!origin) return true;

  return origin === new URL(request.url).origin;
}

function songIdFromPath(pathname) {
  const match = pathname.match(
    /^\/api\/user\/favorites\/(\d+)$/
  );

  return match ? Number(match[1]) : null;
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

/*
 * GET /api/user/favorites
 *
 * 返回当前用户收藏的歌曲
 */
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

/*
 * POST /api/user/favorites/:songId
 *
 * 收藏歌曲
 */
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

  const song = await env.DB
    .prepare(`
      SELECT id
      FROM songs
      WHERE id = ?
        AND is_published = 1
    `)
    .bind(songId)
    .first();

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

/*
 * DELETE /api/user/favorites/:songId
 *
 * 取消收藏
 */
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

export async function handleUserApi(
  request,
  env,
  url
) {
  /*
   * 我的收藏列表
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

  /*
   * 收藏 / 取消收藏
   */
  const songId = songIdFromPath(
    url.pathname
  );

  if (
    songId &&
    request.method === 'POST'
  ) {
    return addFavorite(
      request,
      env,
      songId
    );
  }

  if (
    songId &&
    request.method === 'DELETE'
  ) {
    return removeFavorite(
      request,
      env,
      songId
    );
  }

  return null;
}
