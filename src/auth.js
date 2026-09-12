import { json } from './http.js';

const SESSION_COOKIE = 'melody_admin_session';
const ITERATIONS = 100000;
const SESSION_DAYS = 7;

function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function randomBytes(length) {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

async function sha256Hex(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw new Error('Password must be at least 8 characters');
  const salt = randomBytes(16);
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256);
  return `pbkdf2-sha256$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, iterText, saltText, expectedText] = String(stored).split('$');
    if (scheme !== 'pbkdf2-sha256') return false;
    const iterations = Number(iterText);
    if (!Number.isInteger(iterations) || iterations < 1) return false;
    const salt = base64ToBytes(saltText);
    const expected = base64ToBytes(expectedText);
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, expected.length * 8);
    return constantTimeEqual(new Uint8Array(bits), expected);
  } catch {
    return false;
  }
}

function parseCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const pair of raw.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export async function createSession(db, adminId) {
  const token = bytesToBase64(randomBytes(32));
  const tokenHash = await sha256Hex(token);
  const csrfToken = bytesToBase64(randomBytes(24));
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await db.prepare(`INSERT INTO admin_sessions (admin_user_id, token_hash, csrf_token, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(adminId, tokenHash, csrfToken, expiresAt).run();
  return { token, csrfToken, expiresAt };
}

export async function requireAdmin(request, env) {
  const token = parseCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(`
    SELECT s.id AS session_id, s.admin_user_id, s.csrf_token, s.expires_at, u.username
    FROM admin_sessions s JOIN admin_users u ON u.id = s.admin_user_id
    WHERE s.token_hash = ?
  `).bind(tokenHash).first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(row.session_id).run();
    return null;
  }
  return row;
}

export function requireCsrf(request, session) {
  return Boolean(session && request.headers.get('x-csrf-token') === session.csrf_token);
}

export async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, 400); }
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '');
  const admin = await env.DB.prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?').bind(username).first();
  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    return json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } }, 401);
  }
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run();
  const session = await createSession(env.DB, admin.id);
  const headers = {
    'set-cookie': `${SESSION_COOKIE}=${encodeURIComponent(session.token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`,
    'cache-control': 'no-store',
  };
  return json({ authenticated: true, csrfToken: session.csrfToken, username: admin.username }, 200, headers);
}

export async function handleSession(request, env) {
  const session = await requireAdmin(request, env);
  if (!session) return json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401, { 'cache-control': 'no-store' });
  return json({ authenticated: true, csrfToken: session.csrf_token, username: session.username }, 200, { 'cache-control': 'no-store' });
}

export async function handleLogout(request, env) {
  const session = await requireAdmin(request, env);
  if (!session) return json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401, { 'cache-control': 'no-store' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: { code: 'ORIGIN_FORBIDDEN', message: 'Origin forbidden' } }, 403, { 'cache-control': 'no-store' });
  if (!requireCsrf(request, session)) return json({ error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' } }, 403, { 'cache-control': 'no-store' });
  await env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(session.session_id).run();
  return json({ ok: true }, 200, {
    'set-cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    'cache-control': 'no-store',
  });
}
