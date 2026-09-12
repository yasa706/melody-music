import { json } from './http.js';
import { getCurrentUser } from './user-auth.js';

const USER_SESSION_COOKIE = 'melody_user_session';

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function clearSessionCookie() {
  return `${USER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function handleDeleteUserAccount(request, env) {
  if (!sameOrigin(request)) {
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

  const user = await getCurrentUser(request, env);

  if (!user) {
    return json(
      {
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
        },
      },
      401,
      { 'cache-control': 'no-store' }
    );
  }

  await env.DB
    .prepare('DELETE FROM users WHERE id = ?')
    .bind(user.user_id)
    .run();

  return json(
    { ok: true },
    200,
    {
      'set-cookie': clearSessionCookie(),
      'cache-control': 'no-store',
    }
  );
}
