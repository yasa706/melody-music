import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('unknown api route returns JSON 404', async () => {
  const res = await worker.fetch(new Request('https://example.com/api/nope'), {}, {});
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: { code: 'NOT_FOUND', message: 'Not found' } });
});
