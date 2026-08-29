import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, requireCsrf } from '../src/auth.js';

test('password hash round-trips and does not contain plaintext', async () => {
  const plain = 'correct horse battery staple';
  const stored = await hashPassword(plain);
  assert.equal(await verifyPassword(plain, stored), true);
  assert.equal(await verifyPassword('wrong', stored), false);
  assert.equal(stored.includes(plain), false);
  assert.match(stored, /^pbkdf2-sha256\$310000\$/);
});

test('csrf helper accepts only exact session token', () => {
  const req = new Request('https://x.test', { headers: { 'x-csrf-token': 'abc' } });
  assert.equal(requireCsrf(req, { csrf_token: 'abc' }), true);
  assert.equal(requireCsrf(req, { csrf_token: 'nope' }), false);
});
