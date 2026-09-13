import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const supportEmail = 'support@babavs.edu.kg';

test('App Store public support pages expose support contact and required account guidance', () => {
  const privacy = read('public/privacy.html');
  const support = read('public/support.html');
  const deletion = read('public/account-deletion.html');

  assert.match(privacy, /Melody Music.*隐私政策/s);
  assert.match(privacy, new RegExp(supportEmail.replace('.', '\\.')));
  assert.match(privacy, /删除账号/);

  assert.match(support, /Melody Music Support/i);
  assert.match(support, new RegExp(supportEmail.replace('.', '\\.')));
  assert.match(support, /后台播放|background playback/i);
  assert.match(support, /锁屏|Lock Screen/i);

  assert.match(deletion, /删除账号|Delete Account/i);
  assert.match(deletion, new RegExp(supportEmail.replace('.', '\\.')));
  assert.match(deletion, /收藏.*歌单.*播放历史/s);
  assert.match(deletion, /无法撤销|cannot be undone/i);
});
