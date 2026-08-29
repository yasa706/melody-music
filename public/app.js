import { toAmplitudeSongs } from './player-data.js';

let apiSongs = [];
let currentLyrics = [];
let lastLyricIndex = -2;

const songListEl = document.getElementById('songList');
const lyricsEl = document.getElementById('lyrics');
const statusEl = document.getElementById('playbackStatus');
const searchInput = document.getElementById('searchInput');
const songCountEl = document.getElementById('songCount');
const nowTitle = document.getElementById('nowTitle');
const nowArtist = document.getElementById('nowArtist');
const nowCover = document.getElementById('nowCover');
const nowCoverFallback = document.getElementById('nowCoverFallback');
const playerTitle = document.getElementById('playerTitle');
const playerArtist = document.getElementById('playerArtist');
const playerCover = document.getElementById('playerCover');
const playerCoverFallback = document.getElementById('playerCoverFallback');

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
      lines.push({
        time: Number(stamp[1]) * 60 + Number(stamp[2]) + Number(fraction || 0) / 1000,
        text: lyric,
      });
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

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
}

function renderSongList(list = apiSongs) {
  songCountEl.textContent = `${list.length} 首`;
  if (!list.length) {
    songListEl.innerHTML = '<div class="state-card">没有找到歌曲</div>';
    return;
  }

  songListEl.innerHTML = list.map((song) => {
    const globalIndex = apiSongs.findIndex((item) => String(item.id) === String(song.id));
    const cover = song.cover_url
      ? `<img class="song-cover" src="${esc(song.cover_url)}" alt="" loading="lazy">`
      : '<div class="song-cover-fallback">♪</div>';

    return `
      <button class="song-row amplitude-play-pause" type="button" data-amplitude-song-index="${globalIndex}" data-song-index="${globalIndex}" aria-label="播放 ${esc(song.title)}">
        ${cover}
        <span class="song-info">
          <span class="song-title">${esc(song.title || '未命名歌曲')}</span>
          <span class="song-artist">${esc(song.artist || '未知歌手')}</span>
        </span>
        <span class="song-duration">${formatDuration(song.duration_seconds)}</span>
      </button>`;
  }).join('');

  window.Amplitude.bindNewElements();
  highlightActiveRow();
}

function renderLyrics() {
  lastLyricIndex = -2;
  if (!currentLyrics.length) {
    lyricsEl.innerHTML = '<p class="muted">暂无同步歌词</p>';
    return;
  }

  lyricsEl.innerHTML = currentLyrics.map((line, index) =>
    `<button class="lyric-line" type="button" data-lyric="${index}" data-seconds="${line.time}">${esc(line.text || '♪')}</button>`
  ).join('');

  lyricsEl.querySelectorAll('.lyric-line').forEach((button) => {
    button.addEventListener('click', () => {
      const activeIndex = window.Amplitude.getActiveIndex();
      window.Amplitude.skipTo(Number(button.dataset.seconds), activeIndex);
    });
  });
}

function setCover(url) {
  for (const [image, fallback] of [[nowCover, nowCoverFallback], [playerCover, playerCoverFallback]]) {
    if (url) {
      image.src = url;
      image.hidden = false;
      fallback.hidden = true;
    } else {
      image.removeAttribute('src');
      image.hidden = true;
      fallback.hidden = false;
    }
  }
}

function syncNowPlaying() {
  const song = window.Amplitude.getActiveSongMetadata?.() || {};
  const title = song.name || '选择一首歌曲';
  const artist = song.artist || 'Melody Music';

  nowTitle.textContent = title;
  nowArtist.textContent = artist;
  playerTitle.textContent = title;
  playerArtist.textContent = artist;
  setCover(song.cover_art_url || '');

  currentLyrics = parseLrc(song.lyrics_lrc || '');
  renderLyrics();
  highlightActiveRow();
}

function highlightActiveRow() {
  const active = String(window.Amplitude.getActiveIndex?.() ?? '');
  document.querySelectorAll('.song-row').forEach((row) => {
    row.classList.toggle('active', row.dataset.songIndex === active);
  });
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

searchInput.addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  if (!query) {
    renderSongList(apiSongs);
    return;
  }
  const results = apiSongs.filter((song) =>
    [song.title, song.artist, song.album, song.category_name]
      .some((value) => String(value || '').toLowerCase().includes(query))
  );
  renderSongList(results);
});

async function init() {
  if (!window.Amplitude) {
    statusEl.textContent = '播放器加载失败';
    songListEl.innerHTML = '<div class="state-card">AmplitudeJS 未能加载，请刷新页面</div>';
    return;
  }

  try {
    const response = await fetch('/api/songs');
    if (!response.ok) throw new Error('songs');
    const payload = await response.json();
    apiSongs = payload.songs || [];

    if (!apiSongs.length) {
      songListEl.innerHTML = '<div class="state-card">后台还没有发布歌曲</div>';
      songCountEl.textContent = '0 首';
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
        play: () => { statusEl.textContent = ''; highlightActiveRow(); },
        pause: highlightActiveRow,
        error: () => { statusEl.textContent = '音频加载失败'; },
      },
    });

    renderSongList(apiSongs);
    syncNowPlaying();
  } catch {
    songListEl.innerHTML = '<div class="state-card">音乐加载失败，请稍后重试</div>';
    songCountEl.textContent = '0 首';
  }
}

init();
