import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const path of ['public/privacy.html', 'public/terms.html']) {
  test(`${path} exists for App Store release`, () => {
    assert.equal(fs.existsSync(path), true);
    const html = fs.readFileSync(path, 'utf8');
    assert.match(html, /Melody Music/);
  });
}

test('iOS app chrome exposes privacy and terms links', () => {
  const source = fs.readFileSync('public/ios-app.js', 'utf8');
  assert.match(source, /href=["']\/privacy\.html["']/);
  assert.match(source, /href=["']\/terms\.html["']/);
});

test('iOS account menu exposes in-app account deletion', () => {
  const source = fs.readFileSync('public/ios-app.js', 'utf8');
  assert.match(source, /删除账号/);
  assert.match(source, /\/api\/auth\/account/);
  assert.match(source, /method:\s*['"]DELETE['"]/);
});
