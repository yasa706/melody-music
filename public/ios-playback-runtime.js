import { createIOSPlaybackAdapter } from './ios-playback-adapter.js';
import { NATIVE_AUDIO_EVENT } from './ios-app.js';
import { parseLyricsContent } from './lyrics-fallback.js';

function getPublicSongs() {
  return Array.isArray(window.MelodyPublicSongs) ? window.MelodyPublicSongs : [];
}

function findSongByState(adapter, state) {
  const songs = getPublicSongs();
  const byId = songs.find((song) => String(song?.id) === String(state?.trackId));
  return byId || songs[adapter.getIndex()] || null;
}

function setImage(image, fallback, url) {
  if (!image || !fallback) return;
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

function renderLyrics(song, currentTime) {
  const root = document.getElementById('lyrics');
  if (!root) return;
  const parsed = parseLyricsContent(song?.lyrics_lrc || '');

  if (parsed.timed.length) {
    root.innerHTML = parsed.timed.map((line, index) => (
      `<button class="lyric-line" type="button" data-ios-lyric="${index}" data-seconds="${line.time}">${String(line.text || '♪').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])}</button>`
    )).join('');
  } else if (parsed.plain.length) {
    root.innerHTML = parsed.plain.map((line) => (
      `<p class="lyric-line plain-lyric-line">${String(line).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])}</p>`
    )).join('');
  } else {
    root.innerHTML = '<p class="muted">暂无歌词</p>';
  }

  syncTimedLyric(root, parsed.timed, currentTime);
}

function syncTimedLyric(root, timed, currentTime) {
  if (!timed.length) return;
  let active = -1;
  for (let index = 0; index < timed.length; index += 1) {
    if (timed[index].time <= currentTime) active = index;
    else break;
  }

  root.querySelector('.active')?.classList.remove('active');
  const line = root.querySelector(`[data-ios-lyric="${active}"]`);
  if (line) {
    line.classList.add('active');
    line.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function updatePlayButtons(playing) {
  document.querySelectorAll('.amplitude-play-pause').forEach((button) => {
    button.classList.toggle('amplitude-playing', playing);
    button.classList.toggle('amplitude-paused', !playing);
    button.setAttribute('aria-label', playing ? '暂停' : '播放');
  });
}

function updateProgress(state) {
  const duration = Number(state.duration) || 0;
  const current = Number(state.currentTime) || 0;
  const percent = duration > 0 ? Math.min(100, Math.max(0, current / duration * 100)) : 0;
  document.querySelectorAll('.amplitude-song-slider').forEach((slider) => {
    slider.value = String(percent);
  });

  const minutes = Math.floor(current / 60);
  const seconds = Math.floor(current % 60).toString().padStart(2, '0');
  document.querySelectorAll('.amplitude-current-minutes').forEach((el) => { el.textContent = String(minutes); });
  document.querySelectorAll('.amplitude-current-seconds').forEach((el) => { el.textContent = seconds; });

  const totalMinutes = Math.floor(duration / 60);
  const totalSeconds = Math.floor(duration % 60).toString().padStart(2, '0');
  document.querySelectorAll('.amplitude-duration-minutes').forEach((el) => { el.textContent = String(totalMinutes); });
  document.querySelectorAll('.amplitude-duration-seconds').forEach((el) => { el.textContent = totalSeconds; });
}

function renderNativeState(adapter, state) {
  const song = findSongByState(adapter, state);
  if (!song) return;

  const title = song.title || '未命名歌曲';
  const artist = song.artist || '未知歌手';
  for (const id of ['nowTitle', 'playerTitle', 'albumPlayerTitle']) {
    const el = document.getElementById(id);
    if (el) el.textContent = title;
  }
  for (const id of ['nowArtist', 'playerArtist', 'albumPlayerArtist']) {
    const el = document.getElementById(id);
    if (el) el.textContent = artist;
  }

  setImage(document.getElementById('nowCover'), document.getElementById('nowCoverFallback'), song.cover_url || '');
  setImage(document.getElementById('playerCover'), document.getElementById('playerCoverFallback'), song.cover_url || '');

  const activeIndex = String(adapter.getIndex());
  document.querySelectorAll('[data-song-index]').forEach((row) => {
    row.classList.toggle('active', row.dataset.songIndex === activeIndex);
    row.classList.toggle('album-song-active', row.dataset.songIndex === activeIndex);
  });

  updatePlayButtons(state.playing);
  updateProgress(state);
  renderLyrics(song, state.currentTime);
}

function installCaptureControls(adapter) {
  document.addEventListener('click', async (event) => {
    if (!adapter.isEnabled()) return;
    const songButton = event.target.closest?.('[data-song-index]');
    const previous = event.target.closest?.('.amplitude-prev');
    const next = event.target.closest?.('.amplitude-next');
    const playPause = event.target.closest?.('.amplitude-play-pause');

    if (songButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await adapter.playIndex(Number(songButton.dataset.songIndex));
      return;
    }
    if (previous) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await adapter.previous();
      return;
    }
    if (next) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await adapter.next();
      return;
    }
    if (playPause) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await adapter.toggle();
    }
  }, true);

  document.addEventListener('change', async (event) => {
    if (!adapter.isEnabled() || !event.target.matches?.('.amplitude-song-slider')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const duration = adapter.getState().duration || 0;
    const percent = Math.min(100, Math.max(0, Number(event.target.value) || 0));
    await adapter.seek(duration * percent / 100);
  }, true);

  document.addEventListener('click', async (event) => {
    const lyric = event.target.closest?.('[data-ios-lyric]');
    if (!lyric || !adapter.isEnabled()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    await adapter.seek(Number(lyric.dataset.seconds) || 0);
  }, true);
}

function installHistoryRecorder(adapter) {
  let lastTrackId = null;
  let lastAt = 0;
  window.addEventListener(NATIVE_AUDIO_EVENT, (event) => {
    const state = adapter.acceptState(event.detail);
    if (!state.playing || state.trackId == null) return;
    const now = Date.now();
    if (String(lastTrackId) === String(state.trackId) && now - lastAt < 30000) return;
    lastTrackId = state.trackId;
    lastAt = now;
    fetch(`/api/user/history/${encodeURIComponent(state.trackId)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).catch(() => {});
  });
}

export function installIOSPlaybackRuntime() {
  const nativeAudio = window.MelodyIOSAudio;
  if (!nativeAudio?.isAvailable?.()) return null;
  if (window.MelodyIOSPlayback) return window.MelodyIOSPlayback;

  const adapter = createIOSPlaybackAdapter({ nativeAudio, getSongs: getPublicSongs });
  window.MelodyIOSPlayback = adapter;
  document.documentElement.classList.add('ios-native-audio');

  installCaptureControls(adapter);
  installHistoryRecorder(adapter);

  window.addEventListener(NATIVE_AUDIO_EVENT, (event) => {
    const state = adapter.acceptState(event.detail);
    renderNativeState(adapter, state);
  });

  nativeAudio.getState?.().then((state) => {
    if (!state) return;
    const next = adapter.acceptState(state);
    renderNativeState(adapter, next);
  }).catch(() => {});

  return adapter;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const install = () => installIOSPlaybackRuntime();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
