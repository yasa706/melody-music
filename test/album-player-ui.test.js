import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('album modal contains an integrated player and two-column album layout', () => {
  assert.match(html, /album-detail-layout/);
  assert.match(html, /albumPlayerTitle/);
  assert.match(html, /album-player-controls/);
  assert.match(html, /amplitude-song-slider/);
  assert.match(css, /\.album-detail-layout\s*\{/);
  assert.match(css, /grid-template-columns:/);
});

test('album rows are highlighted with the active Amplitude song', () => {
  assert.match(app, /function highlightAlbumRows\(/);
  assert.match(app, /album-song-active/);
  assert.match(app, /syncAlbumPlayer/);
});

test('desktop album dialog overrides generic auth dialog sizing without changing mobile layout', () => {
  assert.match(css, /@media\s*\(min-width:\s*761px\)[\s\S]*?\.album-modal\s+\.album-detail-dialog\s*\{/);
  assert.match(css, /\.album-modal\s+\.album-detail-dialog\s*\{[\s\S]*?width:\s*min\(1080px,\s*calc\(100vw\s*-\s*36px\)\)/);
  assert.match(css, /\.album-modal\s+\.album-detail-dialog\s*\{[\s\S]*?padding:\s*0/);
});
