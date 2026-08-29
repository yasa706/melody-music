import { json, apiError } from './http.js';
import {
  handleLogin,
  handleLogout,
  handleSession,
  verifyPassword,
  hashPassword
} from './auth.js';
import { handleAdminApi } from './admin-api.js';
import { handlePublicApi } from './public-api.js';
import { serveMedia } from './uploads.js';

async function route(request, env) {
  const url = new URL(request.url);
 if (url.pathname === '/api/debug-admin' && request.method === 'GET') {
  const result = {
    step: 'start'
  };

  try {
    result.step = 'read_database';

    const row = await env.DB.prepare(
      'SELECT id, username, password_hash FROM admin_users WHERE username = ?'
    ).bind('admin').first();

    result.found = Boolean(row);
    result.username = row?.username ?? null;
    result.hash_length = row?.password_hash?.length ?? null;

    result.step = 'test_database_password';

    result.database_password_test = row
      ? await verifyPassword('Gloria2018Music', row.password_hash)
      : false;

    result.step = 'generate_fresh_hash';

    const freshHash = await hashPassword('Gloria2018Music');

    result.fresh_hash_length = freshHash.length;

    result.step = 'verify_fresh_hash';

    result.runtime_self_test =
      await verifyPassword('Gloria2018Music', freshHash);

    result.step = 'complete';

    return json(result);

  } catch (error) {
    return json({
      ...result,
      failed: true,
      error_name: error?.name ?? null,
      error_message: error?.message ?? String(error)
    });
  }
}
  if (url.pathname === '/api/admin/login' && request.method === 'POST') return handleLogin(request, env);
  if (url.pathname === '/api/admin/logout' && request.method === 'POST') return handleLogout(request, env);
  if (url.pathname === '/api/admin/session' && request.method === 'GET') return handleSession(request, env);
  if (url.pathname.startsWith('/api/admin/')) { const admin = await handleAdminApi(request, env, url); if (admin) return admin; }
  if (url.pathname.startsWith('/api/')) { const pub = await handlePublicApi(request, env, url); if (pub) return pub; }
  if (url.pathname.startsWith('/media/') && request.method === 'GET') return serveMedia(request, env, url.pathname.slice('/media/'.length));
  if (url.pathname.startsWith('/api/')) return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
}

export default {
  async fetch(request, env) {
    try { return await route(request, env); }
    catch (error) {
      if (new URL(request.url).pathname.startsWith('/api/')) return apiError(error);
      return new Response('Internal server error', { status: 500 });
    }
  },
};
