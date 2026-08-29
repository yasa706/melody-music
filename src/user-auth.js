import { json } from './http.js';
import { hashPassword, verifyPassword } from './auth.js';

const USER_SESSION_COOKIE = 'melody_user_session';
const SESSION_DAYS = 30;

function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function randomBytes(length) {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

async function sha256Hex(value) {
  const bytes =
    typeof value === 'string'
      ? new TextEncoder().encode(value)
      : value;

  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', bytes)
  );

  return [...digest]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseCookie(request, name) {
  const raw = request.headers.get('cookie') || '';

  for (const pair of raw.split(';')) {
    const [key, ...rest] = pair.trim().split('=');

    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateOrigin(request) {
  const origin = request.headers.get('origin');

  if (!origin) return true;

  return origin === new URL(request.url).origin;
}

async function createUserSession(db, userId) {
  const token = bytesToBase64(randomBytes(32));
  const tokenHash = await sha256Hex(token);

  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 86400_000
  ).toISOString();

  await db
    .prepare(`
      INSERT INTO user_sessions
      (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `)
    .bind(userId, tokenHash, expiresAt)
    .run();

  return {
    token,
    expiresAt,
  };
}

export async function getCurrentUser(request, env) {
  const token = parseCookie(
    request,
    USER_SESSION_COOKIE
  );

  if (!token) return null;

  const tokenHash = await sha256Hex(token);

  const row = await env.DB
    .prepare(`
      SELECT
        s.id AS session_id,
        s.user_id,
        s.expires_at,
        u.email,
        u.display_name,
        u.role,
        u.is_active
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE s.token_hash = ?
    `)
    .bind(tokenHash)
    .first();

  if (!row) return null;

  if (
    !row.is_active ||
    new Date(row.expires_at).getTime() <= Date.now()
  ) {
    await env.DB
      .prepare(
        'DELETE FROM user_sessions WHERE id = ?'
      )
      .bind(row.session_id)
      .run();

    return null;
  }

  return row;
}

export async function requireUser(request, env) {
  return getCurrentUser(request, env);
}

export async function handleRegister(request, env) {
  if (!validateOrigin(request)) {
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

  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');
  const displayName = String(
    body?.displayName || ''
  ).trim();

  if (!validEmail(email)) {
    return json(
      {
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email address',
        },
      },
      400
    );
  }

  if (password.length < 8) {
    return json(
      {
        error: {
          code: 'WEAK_PASSWORD',
          message:
            'Password must be at least 8 characters',
        },
      },
      400
    );
  }

  if (displayName.length > 80) {
    return json(
      {
        error: {
          code: 'INVALID_DISPLAY_NAME',
          message: 'Display name is too long',
        },
      },
      400
    );
  }

  const existing = await env.DB
    .prepare(
      'SELECT id FROM users WHERE email = ?'
    )
    .bind(email)
    .first();

  if (existing) {
    return json(
      {
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered',
        },
      },
      409
    );
  }

  const passwordHash =
    await hashPassword(password);

  let result;

  try {
    result = await env.DB
      .prepare(`
        INSERT INTO users
        (
          email,
          display_name,
          password_hash,
          role,
          is_active
        )
        VALUES (?, ?, ?, 'user', 1)
      `)
      .bind(
        email,
        displayName || null,
        passwordHash
      )
      .run();
  } catch (error) {
    return json(
      {
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'Registration failed',
        },
      },
      500
    );
  }

  const userId = result.meta.last_row_id;

  const session = await createUserSession(
    env.DB,
    userId
  );

  return json(
    {
      authenticated: true,
      user: {
        id: userId,
        email,
        displayName: displayName || null,
        role: 'user',
      },
    },
    201,
    {
      'set-cookie':
        `${USER_SESSION_COOKIE}=` +
        `${encodeURIComponent(session.token)}; ` +
        `Path=/; HttpOnly; Secure; ` +
        `SameSite=Lax; ` +
        `Max-Age=${SESSION_DAYS * 86400}`,
      'cache-control': 'no-store',
    }
  );
}

export async function handleUserLogin(
  request,
  env
) {
  if (!validateOrigin(request)) {
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

  const email = normalizeEmail(body?.email);
  const password = String(
    body?.password || ''
  );

  const user = await env.DB
    .prepare(`
      SELECT
        id,
        email,
        display_name,
        password_hash,
        role,
        is_active
      FROM users
      WHERE email = ?
    `)
    .bind(email)
    .first();

  if (
    !user ||
    !user.is_active ||
    !(await verifyPassword(
      password,
      user.password_hash
    ))
  ) {
    return json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      },
      401
    );
  }

  await env.DB
    .prepare(
      'DELETE FROM user_sessions WHERE expires_at <= ?'
    )
    .bind(new Date().toISOString())
    .run();

  const session = await createUserSession(
    env.DB,
    user.id
  );

  return json(
    {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName:
          user.display_name || null,
        role: user.role,
      },
    },
    200,
    {
      'set-cookie':
        `${USER_SESSION_COOKIE}=` +
        `${encodeURIComponent(session.token)}; ` +
        `Path=/; HttpOnly; Secure; ` +
        `SameSite=Lax; ` +
        `Max-Age=${SESSION_DAYS * 86400}`,
      'cache-control': 'no-store',
    }
  );
}

export async function handleUserMe(
  request,
  env
) {
  const user = await getCurrentUser(
    request,
    env
  );

  if (!user) {
    return json(
      {
        authenticated: false,
        user: null,
      },
      200,
      {
        'cache-control': 'no-store',
      }
    );
  }

  return json(
    {
      authenticated: true,
      user: {
        id: user.user_id,
        email: user.email,
        displayName:
          user.display_name || null,
        role: user.role,
      },
    },
    200,
    {
      'cache-control': 'no-store',
    }
  );
}

export async function handleUserLogout(
  request,
  env
) {
  if (!validateOrigin(request)) {
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

  const token = parseCookie(
    request,
    USER_SESSION_COOKIE
  );

  if (token) {
    const tokenHash =
      await sha256Hex(token);

    await env.DB
      .prepare(
        'DELETE FROM user_sessions WHERE token_hash = ?'
      )
      .bind(tokenHash)
      .run();
  }

  return json(
    {
      ok: true,
    },
    200,
    {
      'set-cookie':
        `${USER_SESSION_COOKIE}=; ` +
        `Path=/; HttpOnly; Secure; ` +
        `SameSite=Lax; Max-Age=0`,
      'cache-control': 'no-store',
    }
  );
}
Commit changes
