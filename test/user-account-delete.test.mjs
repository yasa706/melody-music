import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDeleteUserAccount } from '../src/user-auth.js';

function createDb({ user = null } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return {
            async first() {
              if (sql.includes('FROM user_sessions')) return user;
              return null;
            },
            async run() {
              return { success: true };
            },
          };
        },
      };
    },
  };
}

test('account deletion requires an authenticated user', async () => {
  const DB = createDb();
  const request = new Request('https://babavs.edu.kg/api/auth/account', {
    method: 'DELETE',
  });

  const response = await handleDeleteUserAccount(request, { DB });
  assert.equal(response.status, 401);
});

test('account deletion removes the authenticated user and clears the session cookie', async () => {
  const DB = createDb({
    user: {
      session_id: 3,
      user_id: 42,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      email: 'user@example.com',
      display_name: 'User',
      role: 'user',
      is_active: 1,
    },
  });
  const request = new Request('https://babavs.edu.kg/api/auth/account', {
    method: 'DELETE',
    headers: {
      cookie: 'melody_user_session=test-session-token',
      origin: 'https://babavs.edu.kg',
    },
  });

  const response = await handleDeleteUserAccount(request, { DB });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.match(response.headers.get('set-cookie') || '', /Max-Age=0/);
  assert.equal(
    DB.calls.some(({ sql, args }) => sql.includes('DELETE FROM users WHERE id = ?') && args[0] === 42),
    true
  );
});
