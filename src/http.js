export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status=status; this.code=code; }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

export function apiError(error) {
  if (error instanceof ApiError) return json({ error: { code: error.code, message: error.message } }, error.status);
  return json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
}

export function sameOriginOrAbsent(request) {
  const origin=request.headers.get('origin');
  if (!origin) return true;
  try { return origin === new URL(request.url).origin; } catch { return false; }
}
