import { toAmplitudeSongs } from './player-data.js';

let apiSongs = [];
let playlists = [];
let currentLyrics = [];
let lastLyricIndex = -2;

const lyricsEl = document.getElementById('lyrics');
const statusEl = document.getElementById('playbackStatus');
const playerTitle = document.getElementById('playerTitle');
const playerArtist = document.getElementById('playerArtist');
const playerCover = document.getElementById('playerCover');
const coverFallback = document.getElementById('coverFallback');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function parseLrc(text = '') {
  const lines = [];
  for (const raw of String(text).split(/\r?\n/)) {
    if (/^\[(ar|ti|al|by|offset|length):/i.test(raw)) continue;
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const lyric = raw.replace(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g, '').trim();
    for (const stamp of stamps) {
      const fraction = (stamp[3] || '').padEnd(3, '0').slice(0, 3);
      lines.push({ time: Number(stamp[1]) * 60 + Number(stamp[2]) + Number(fraction || 0) / 1000, text: lyric });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

function activeLyricIndex(lines, seconds) {
  let index = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].time <= seconds) index = i;
    else break;
  }
  return index;
}

function coverMarkup(url, className = 'song-cover') {
  return url
    ? `<img class="${className}" src="${esc(url)}" alt="" loading="lazy">`
    : `<div class="cover-placeholder ${className}">♪</div>`;
}

function renderPlaylists() {
  const root = document.getElementById('playlistCards');
  document.getElementById('playlistCount').textContent = playlists.length ? `${playlists.length} 个` : '';
  root.innerHTML = playlists.length
    ? playlists.slice(0, 8).map((playlist) => `
      <article class="card">
        ${playlist.cover_url ? `<img src="${esc(playlist.cover_url)}" alt="" loading="lazy">` : '<div class="card-cover-placeholder">♫</div>'}
        <div class="card-title">${esc(playlist.name)}</div>
        <div class="card-sub">${esc(playlist.description || `${playlist.song_count || 0} 首歌曲`)}</div>
      </article>`).join('')
    : '<div class="loading-state">还没有公开歌单</div>';
}

function songRows(list) {
  if (!list.length) return '<div class="empty-box">没有找到歌曲</div>';
  return list.map((song) => {
    const globalIndex = apiSongs.findIndex((item) => String(item.id) === String(song.id));
    return `
      <div class="song-row" data-song-index="${globalIndex}">
        <button class="row-play amplitude-play-pause" type="button" data-amplitude-song-index="${globalIndex}" aria-label="播放 ${esc(song.title)}">
          <span class="row-play-icon">▶</span><span class="row-pause-icon">Ⅱ</span>
        </button>
        <div class="song-main">${coverMarkup(song.cover_url)}<div><div class="song-title">${esc(song.title)}</div><div class="song-meta">${esc(song.artist || '未知歌手')}</div></div></div>
        <div class="song-album">${esc(song.album || song.category_name || '—')}</div>
        <div class="song-time">${song.duration_seconds ? formatDuration(song.duration_seconds) : '—'}</div>
      </div>`;
  }).join('');
}

function renderSongs() {
  const root = document.getElementById('songList');
  root.innerHTML = songRows(apiSongs);
  document.getElementById('songCount').textContent = `${apiSongs.length} 首`;
  window.Amplitude.bindNewElements();
}

function renderLyrics() {
  lastLyricIndex = -2;
  lyricsEl.innerHTML = currentLyrics.length
    ? currentLyrics.map((line, index) => `<button class="lyric-line" type="button" data-lyric="${index}" data-seconds="${line.time}">${esc(line.text || '♪')}</button>`).join('')
    : '<p class="muted">暂无同步歌词</p>';

  lyricsEl.querySelectorAll('.lyric-line').forEach((button) => {
    button.addEventListener('click', () => {
      const index = window.Amplitude.getActiveIndex();
      window.Amplitude.skipTo(Number(button.dataset.seconds), index);
    });
  });
}

function syncNowPlaying() {
  const song = window.Amplitude.getActiveSongMetadata?.() || {};
  playerTitle.textContent = song.name || '选择一首歌曲';
  playerArtist.textContent = song.artist || 'Melody';

  if (song.cover_art_url) {
    playerCover.src = song.cover_art_url;
    playerCover.hidden = false;
    coverFallback.hidden = true;
  } else {
    playerCover.removeAttribute('src');
    playerCover.hidden = true;
    coverFallback.hidden = false;
  }

  currentLyrics = parseLrc(song.lyrics_lrc || '');
  renderLyrics();
  highlightActiveRow();
}

function highlightActiveRow() {
  const active = String(window.Amplitude.getActiveIndex?.() ?? '');
  document.querySelectorAll('.song-row').forEach((row) => row.classList.toggle('active', row.dataset.songIndex === active));
}

function syncLyrics() {
  if (!currentLyrics.length) return;
  const index = activeLyricIndex(currentLyrics, window.Amplitude.getSongPlayedSeconds());
  if (index === lastLyricIndex) return;
  lyricsEl.querySelector('.active')?.classList.remove('active');
  const line = lyricsEl.querySelector(`[data-lyric="${index}"]`);
  if (line) {
    line.classList.add('active');
    line.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  lastLyricIndex = index;
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
}

function showView(name) {
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${name}View`));
}

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));

document.getElementById('searchInput').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  if (!query) return;
  showView('search');
  const results = apiSongs.filter((song) => [song.title, song.artist, song.album].some((value) => String(value || '').toLowerCase().includes(query)));
  document.getElementById('searchResults').innerHTML = songRows(results);
  window.Amplitude.bindNewElements();
});

document.getElementById('playFeatured').addEventListener('click', () => {
  if (apiSongs.length) window.Amplitude.playSongAtIndex(0);
});

async function init() {
  if (!window.Amplitude) {
    statusEl.textContent = '播放器加载失败';
    document.getElementById('songList').innerHTML = '<div class="empty-box">AmplitudeJS 未能加载，请刷新页面</div>';
    return;
  }

  try {
    const [songResponse, playlistResponse] = await Promise.all([
      fetch('/api/songs').then((response) => {
        if (!response.ok) throw new Error('songs');
        return response.json();
      }),
      fetch('/api/playlists').then((response) => response.ok ? response.json() : ({ playlists: [] })),
    ]);

    apiSongs = songResponse.songs || [];
    playlists = playlistResponse.playlists || [];
    renderPlaylists();

    if (!apiSongs.length) {
      document.getElementById('songList').innerHTML = '<div class="empty-box">后台还没有发布歌曲</div>';
      document.getElementById('songCount').textContent = '0 首';
      return;
    }

    window.Amplitude.init({
      songs: toAmplitudeSongs(apiSongs),
      start_song: 0,
      volume: 0.8,
      continue_next: true,
      preload: 'metadata',
      callbacks: {
        initialized: syncNowPlaying,
        song_change: syncNowPlaying,
        timeupdate: syncLyrics,
        error: () => { statusEl.textContent = '音频加载失败'; },
        play: () => { statusEl.textContent = ''; },
      },
    });

    renderSongs();
    syncNowPlaying();
  } catch (error) {
    document.getElementById('songList').innerHTML = '<div class="empty-box">音乐加载失败，请稍后重试</div>';
    document.getElementById('playlistCards').innerHTML = '<div class="loading-state">歌单加载失败</div>';
  }
}

init();
