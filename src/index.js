import { json, apiError } from './http.js';
import { handleLogin, handleLogout, handleSession } from './auth.js';
import { handleAdminApi } from './admin-api.js';
import { handlePublicApi } from './public-api.js';
import { serveMedia } from './uploads.js';

async function route(request, env) {
  const url = new URL(request.url);
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
