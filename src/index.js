import { json, apiError } from './http.js';

import {
  handleLogin,
  handleLogout,
  handleSession
} from './auth.js';

import {
  handleRegister,
  handleUserLogin,
  handleUserLogout,
  handleUserMe
} from './user-auth.js';

import { handleAdminApi } from './admin-api.js';
import { handlePublicApi } from './public-api.js';
import { serveMedia } from './uploads.js';

async function route(request, env) {
  const url = new URL(request.url);

  /*
   * 普通用户账号 API
   */

  if (
    url.pathname === '/api/auth/register' &&
    request.method === 'POST'
  ) {
    return handleRegister(request, env);
  }

  if (
    url.pathname === '/api/auth/login' &&
    request.method === 'POST'
  ) {
    return handleUserLogin(request, env);
  }

  if (
    url.pathname === '/api/auth/logout' &&
    request.method === 'POST'
  ) {
    return handleUserLogout(request, env);
  }

  if (
    url.pathname === '/api/auth/me' &&
    request.method === 'GET'
  ) {
    return handleUserMe(request, env);
  }

  /*
   * 管理员 API
   */

  if (
    url.pathname === '/api/admin/login' &&
    request.method === 'POST'
  ) {
    return handleLogin(request, env);
  }

  if (
    url.pathname === '/api/admin/logout' &&
    request.method === 'POST'
  ) {
    return handleLogout(request, env);
  }

  if (
    url.pathname === '/api/admin/session' &&
    request.method === 'GET'
  ) {
    return handleSession(request, env);
  }

  if (url.pathname.startsWith('/api/admin/')) {
    const admin = await handleAdminApi(
      request,
      env,
      url
    );

    if (admin) return admin;
  }

  /*
   * 公共音乐 API
   */

  if (url.pathname.startsWith('/api/')) {
    const pub = await handlePublicApi(
      request,
      env,
      url
    );

    if (pub) return pub;
  }

  /*
   * R2 音乐、封面、歌词
   */

  if (
    url.pathname.startsWith('/media/') &&
    request.method === 'GET'
  ) {
    return serveMedia(
      request,
      env,
      url.pathname.slice('/media/'.length)
    );
  }

  /*
   * 未知 API
   */

  if (url.pathname.startsWith('/api/')) {
    return json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Not found'
        }
      },
      404
    );
  }

  /*
   * 前端静态文件
   */

  return env.ASSETS
    ? env.ASSETS.fetch(request)
    : new Response('Not found', {
        status: 404
      });
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      if (
        new URL(request.url)
          .pathname
          .startsWith('/api/')
      ) {
        return apiError(error);
      }

      return new Response(
        'Internal server error',
        {
          status: 500
        }
      );
    }
  }
};
