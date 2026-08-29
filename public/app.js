import { toAmplitudeSongs } from './player-data.js';

let apiSongs = [];
let currentLyrics = [];
let lastLyricIndex = -2;
let currentUser = null;
let favoriteSongIds = new Set();
let showingFavoritesOnly = false;

/* =========================================================
   Player DOM
   ========================================================= */

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
const playerCoverFallback = document.getElementById(
  'playerCoverFallback'
);

/* =========================================================
   Account DOM
   ========================================================= */

const guestActions = document.getElementById('guestActions');
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');

const userArea = document.getElementById('userArea');
const userMenuButton = document.getElementById('userMenuButton');
const userMenu = document.getElementById('userMenu');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');

const favoritesMenuButton = document.getElementById(
  'favoritesMenuButton'
);
const playlistsMenuButton = document.getElementById(
  'playlistsMenuButton'
);
const historyMenuButton = document.getElementById(
  'historyMenuButton'
);
const logoutButton = document.getElementById('logoutButton');

/* =========================================================
   Auth Modal DOM
   ========================================================= */

const authModal = document.getElementById('authModal');
const authBackdrop = document.getElementById('authBackdrop');
const authCloseButton = document.getElementById(
  'authCloseButton'
);

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById(
  'loginPassword'
);
const loginMessage = document.getElementById(
  'loginMessage'
);
const loginSubmitButton = document.getElementById(
  'loginSubmitButton'
);

const registerDisplayName = document.getElementById(
  'registerDisplayName'
);
const registerEmail = document.getElementById(
  'registerEmail'
);
const registerPassword = document.getElementById(
  'registerPassword'
);
const registerPasswordConfirm = document.getElementById(
  'registerPasswordConfirm'
);
const registerMessage = document.getElementById(
  'registerMessage'
);
const registerSubmitButton = document.getElementById(
  'registerSubmitButton'
);

const showRegisterButton = document.getElementById(
  'showRegisterButton'
);
const showLoginButton = document.getElementById(
  'showLoginButton'
);

/* =========================================================
   Helpers
   ========================================================= */

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]
  );

function parseLrc(text = '') {
  const lines = [];

  for (const raw of String(text).split(/\r?\n/)) {
    if (
      /^\[(ar|ti|al|by|offset|length):/i.test(raw)
    ) {
      continue;
    }

    const stamps = [
      ...raw.matchAll(
        /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g
      ),
    ];

    if (!stamps.length) continue;

    const lyric = raw
      .replace(
        /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g,
        ''
      )
      .trim();

    for (const stamp of stamps) {
      const fraction = (stamp[3] || '')
        .padEnd(3, '0')
        .slice(0, 3);

      lines.push({
        time:
          Number(stamp[1]) * 60 +
          Number(stamp[2]) +
          Number(fraction || 0) / 1000,
        text: lyric,
      });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

function activeLyricIndex(lines, seconds) {
  let index = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].time <= seconds) {
      index = i;
    } else {
      break;
    }
  }

  return index;
}

function formatDuration(seconds) {
  const value = Number(seconds);

  if (!Number.isFinite(value) || value <= 0) {
    return '—';
  }

  return `${Math.floor(value / 60)}:${Math.floor(
    value % 60
  )
    .toString()
    .padStart(2, '0')}`;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function apiErrorMessage(payload, fallback) {
  const code = payload?.error?.code;

  const messages = {
    INVALID_EMAIL: '请输入正确的邮箱地址',
    WEAK_PASSWORD: '密码至少需要 8 位',
    EMAIL_EXISTS: '这个邮箱已经注册过了',
    INVALID_DISPLAY_NAME: '昵称太长',
    INVALID_CREDENTIALS: '邮箱或密码错误',
    REGISTRATION_FAILED: '注册失败，请稍后再试',
    ORIGIN_FORBIDDEN: '请求来源验证失败',
    INVALID_JSON: '提交的数据格式不正确',
    UNAUTHORIZED: '请先登录',
    SONG_NOT_FOUND: '歌曲不存在',
  };

  return (
    messages[code] ||
    payload?.error?.message ||
    fallback
  );
}

function firstUserLetter(user) {
  const value =
    user?.displayName ||
    user?.email ||
    'M';

  return String(value)
    .trim()
    .charAt(0)
    .toUpperCase();
}

/* =========================================================
   User Interface State
   ========================================================= */

function renderUserState() {
  if (currentUser) {
    guestActions.hidden = true;
    userArea.hidden = false;

    userName.textContent =
      currentUser.displayName ||
      currentUser.email ||
      '用户';

    userAvatar.textContent =
      firstUserLetter(currentUser);
  } else {
    guestActions.hidden = false;
    userArea.hidden = true;
    userMenu.hidden = true;

    userMenuButton.setAttribute(
      'aria-expanded',
      'false'
    );
  }
}

function closeUserMenu() {
  userMenu.hidden = true;

  userMenuButton.setAttribute(
    'aria-expanded',
    'false'
  );
}

function toggleUserMenu() {
  const willOpen = userMenu.hidden;

  userMenu.hidden = !willOpen;

  userMenuButton.setAttribute(
    'aria-expanded',
    String(willOpen)
  );
}

/* =========================================================
   Auth Modal
   ========================================================= */

function clearAuthMessages() {
  loginMessage.textContent = '';
  registerMessage.textContent = '';

  loginMessage.classList.remove('success');
  registerMessage.classList.remove('success');
}

function showLoginForm() {
  clearAuthMessages();

  loginForm.hidden = false;
  registerForm.hidden = true;

  setTimeout(() => {
    loginEmail.focus();
  }, 0);
}

function showRegisterForm() {
  clearAuthMessages();

  loginForm.hidden = true;
  registerForm.hidden = false;

  setTimeout(() => {
    registerDisplayName.focus();
  }, 0);
}

function openAuthModal(mode = 'login') {
  closeUserMenu();

  authModal.hidden = false;

  document.body.style.overflow = 'hidden';

  if (mode === 'register') {
    showRegisterForm();
  } else {
    showLoginForm();
  }
}

function closeAuthModal() {
  authModal.hidden = true;

  document.body.style.overflow = '';

  clearAuthMessages();
}

/* =========================================================
   Authentication API
   ========================================================= */

async function loadCurrentUser() {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      currentUser = null;
      renderUserState();
      return;
    }

    const payload = await readJson(response);

    currentUser =
      payload.authenticated && payload.user
        ? payload.user
        : null;

    renderUserState();

    if (currentUser) {
      await loadFavorites();
    }
  } catch {
    currentUser = null;
    renderUserState();
  }
}

async function loginUser(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(
        payload,
        '登录失败，请稍后再试'
      )
    );
  }

  currentUser = payload.user || null;

  renderUserState();

  await loadFavorites();

  return payload;
}

async function registerUser(
  displayName,
  email,
  password
) {
  const response = await fetch(
    '/api/auth/register',
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        displayName,
        email,
        password,
      }),
    }
  );

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(
        payload,
        '注册失败，请稍后再试'
      )
    );
  }

  currentUser = payload.user || null;

  renderUserState();

  await loadFavorites();

  return payload;
}

async function logoutUser() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    });
  } finally {
    currentUser = null;
    favoriteSongIds = new Set();
    showingFavoritesOnly = false;

    renderUserState();
    renderSongList(apiSongs);

    closeUserMenu();
  }
}

/* =========================================================
   Favorites API
   ========================================================= */

async function loadFavorites() {
  if (!currentUser) {
    favoriteSongIds = new Set();
    return;
  }

  try {
    const response = await fetch(
      '/api/user/favorites',
      {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      favoriteSongIds = new Set();
      return;
    }

    const payload = await readJson(response);

    favoriteSongIds = new Set(
      (payload.favorites || []).map(
        (song) => String(song.id)
      )
    );

    if (apiSongs.length) {
      renderCurrentSongList();
    }
  } catch {
    favoriteSongIds = new Set();
  }
}

async function addFavorite(songId) {
  const response = await fetch(
    `/api/user/favorites/${songId}`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }
  );

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(
        payload,
        '收藏失败，请稍后再试'
      )
    );
  }

  favoriteSongIds.add(String(songId));
}

async function removeFavorite(songId) {
  const response = await fetch(
    `/api/user/favorites/${songId}`,
    {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }
  );

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(
        payload,
        '取消收藏失败，请稍后再试'
      )
    );
  }

  favoriteSongIds.delete(String(songId));
}

async function toggleFavorite(songId) {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  const key = String(songId);

  try {
    if (favoriteSongIds.has(key)) {
      await removeFavorite(songId);
      statusEl.textContent = '已取消收藏';
    } else {
      await addFavorite(songId);
      statusEl.textContent = '已收藏';
    }

    renderCurrentSongList();
  } catch (error) {
    statusEl.textContent =
      error?.message ||
      '收藏操作失败';
  }
}

/* =========================================================
   Auth Events
   ========================================================= */

loginButton.addEventListener('click', () => {
  openAuthModal('login');
});

registerButton.addEventListener('click', () => {
  openAuthModal('register');
});

authCloseButton.addEventListener(
  'click',
  closeAuthModal
);

authBackdrop.addEventListener(
  'click',
  closeAuthModal
);

showRegisterButton.addEventListener(
  'click',
  showRegisterForm
);

showLoginButton.addEventListener(
  'click',
  showLoginForm
);

document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    !authModal.hidden
  ) {
    closeAuthModal();
  }
});

loginForm.addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    loginMessage.textContent = '';
    loginMessage.classList.remove('success');

    const email = loginEmail.value
      .trim()
      .toLowerCase();

    const password = loginPassword.value;

    if (!email || !password) {
      loginMessage.textContent =
        '请输入邮箱和密码';

      return;
    }

    loginSubmitButton.disabled = true;
    loginSubmitButton.textContent = '登录中…';

    try {
      await loginUser(email, password);

      loginMessage.classList.add('success');
      loginMessage.textContent = '登录成功';

      loginForm.reset();

      setTimeout(() => {
        closeAuthModal();
      }, 350);
    } catch (error) {
      loginMessage.textContent =
        error?.message ||
        '登录失败，请稍后再试';
    } finally {
      loginSubmitButton.disabled = false;
      loginSubmitButton.textContent = '登录';
    }
  }
);

registerForm.addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    registerMessage.textContent = '';
    registerMessage.classList.remove(
      'success'
    );

    const displayName =
      registerDisplayName.value.trim();

    const email = registerEmail.value
      .trim()
      .toLowerCase();

    const password = registerPassword.value;

    const passwordConfirm =
      registerPasswordConfirm.value;

    if (!email) {
      registerMessage.textContent =
        '请输入邮箱';

      return;
    }

    if (password.length < 8) {
      registerMessage.textContent =
        '密码至少需要 8 位';

      return;
    }

    if (password !== passwordConfirm) {
      registerMessage.textContent =
        '两次输入的密码不一致';

      return;
    }

    registerSubmitButton.disabled = true;
    registerSubmitButton.textContent =
      '注册中…';

    try {
      await registerUser(
        displayName,
        email,
        password
      );

      registerMessage.classList.add(
        'success'
      );

      registerMessage.textContent =
        '注册成功';

      registerForm.reset();

      setTimeout(() => {
        closeAuthModal();
      }, 350);
    } catch (error) {
      registerMessage.textContent =
        error?.message ||
        '注册失败，请稍后再试';
    } finally {
      registerSubmitButton.disabled = false;
      registerSubmitButton.textContent =
        '注册';
    }
  }
);

/* =========================================================
   User Menu Events
   ========================================================= */

userMenuButton.addEventListener(
  'click',
  (event) => {
    event.stopPropagation();
    toggleUserMenu();
  }
);

document.addEventListener('click', (event) => {
  if (!userArea.contains(event.target)) {
    closeUserMenu();
  }
});

logoutButton.addEventListener(
  'click',
  async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = '退出中…';

    try {
      await logoutUser();
    } finally {
      logoutButton.disabled = false;
      logoutButton.textContent = '退出登录';
    }
  }
);

favoritesMenuButton.addEventListener(
  'click',
  () => {
    closeUserMenu();

    showingFavoritesOnly =
      !showingFavoritesOnly;

    favoritesMenuButton.textContent =
      showingFavoritesOnly
        ? '♫ 查看全部歌曲'
        : '♥ 我的收藏';

    searchInput.value = '';

    renderCurrentSongList();

    statusEl.textContent =
      showingFavoritesOnly
        ? '正在查看我的收藏'
        : '';
  }
);

playlistsMenuButton.addEventListener(
  'click',
  () => {
    closeUserMenu();

    statusEl.textContent =
      '我的歌单功能下一步接入';
  }
);

historyMenuButton.addEventListener(
  'click',
  () => {
    closeUserMenu();

    statusEl.textContent =
      '播放历史功能下一步接入';
  }
);

/* =========================================================
   Song List
   ========================================================= */

function currentBaseList() {
  if (!showingFavoritesOnly) {
    return apiSongs;
  }

  return apiSongs.filter((song) =>
    favoriteSongIds.has(String(song.id))
  );
}

function renderCurrentSongList() {
  const query = searchInput.value
    .trim()
    .toLowerCase();

  let list = currentBaseList();

  if (query) {
    list = list.filter((song) =>
      [
        song.title,
        song.artist,
        song.album,
        song.category_name,
      ].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(query)
      )
    );
  }

  renderSongList(list);
}

function renderSongList(list = apiSongs) {
  songCountEl.textContent =
    `${list.length} 首`;

  if (!list.length) {
    songListEl.innerHTML =
      showingFavoritesOnly
        ? '<div class="state-card">还没有收藏歌曲</div>'
        : '<div class="state-card">没有找到歌曲</div>';

    return;
  }

  songListEl.innerHTML = list
    .map((song) => {
      const globalIndex = apiSongs.findIndex(
        (item) =>
          String(item.id) ===
          String(song.id)
      );

      const cover = song.cover_url
        ? `<img class="song-cover" src="${esc(
            song.cover_url
          )}" alt="" loading="lazy">`
        : '<div class="song-cover-fallback">♪</div>';

      const isFavorite =
        favoriteSongIds.has(String(song.id));

      return `
        <div class="song-row-wrap">

          <button
            class="song-row amplitude-play-pause"
            type="button"
            data-amplitude-song-index="${globalIndex}"
            data-song-index="${globalIndex}"
            aria-label="播放 ${esc(song.title)}"
          >
            ${cover}

            <span class="song-info">
              <span class="song-title">
                ${esc(
                  song.title ||
                    '未命名歌曲'
                )}
              </span>

              <span class="song-artist">
                ${esc(
                  song.artist ||
                    '未知歌手'
                )}
              </span>
            </span>

            <span class="song-duration">
              ${formatDuration(
                song.duration_seconds
              )}
            </span>
          </button>

          <button
            class="favorite-btn ${
              isFavorite ? 'active' : ''
            }"
            type="button"
            data-favorite-song-id="${esc(song.id)}"
            aria-label="${
              isFavorite
                ? '取消收藏'
                : '收藏歌曲'
            }"
            title="${
              isFavorite
                ? '取消收藏'
                : '收藏歌曲'
            }"
          >
            ${isFavorite ? '♥' : '♡'}
          </button>

        </div>
      `;
    })
    .join('');

  window.Amplitude.bindNewElements();

  songListEl
    .querySelectorAll(
      '[data-favorite-song-id]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        async (event) => {
          event.preventDefault();
          event.stopPropagation();

          const songId =
            button.dataset.favoriteSongId;

          button.disabled = true;

          try {
            await toggleFavorite(songId);
          } finally {
            button.disabled = false;
          }
        }
      );
    });

  highlightActiveRow();
}

/* =========================================================
   Lyrics
   ========================================================= */

function renderLyrics() {
  lastLyricIndex = -2;

  if (!currentLyrics.length) {
    lyricsEl.innerHTML =
      '<p class="muted">暂无同步歌词</p>';

    return;
  }

  lyricsEl.innerHTML = currentLyrics
    .map(
      (line, index) =>
        `
        <button
          class="lyric-line"
          type="button"
          data-lyric="${index}"
          data-seconds="${line.time}"
        >
          ${esc(line.text || '♪')}
        </button>
      `
    )
    .join('');

  lyricsEl
    .querySelectorAll('.lyric-line')
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const activeIndex =
            window.Amplitude.getActiveIndex();

          window.Amplitude.skipTo(
            Number(button.dataset.seconds),
            activeIndex
          );
        }
      );
    });
}

/* =========================================================
   Covers / Current Song
   ========================================================= */

function setCover(url) {
  for (const [image, fallback] of [
    [nowCover, nowCoverFallback],
    [playerCover, playerCoverFallback],
  ]) {
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
  const song =
    window.Amplitude
      .getActiveSongMetadata?.() || {};

  const title =
    song.name || '选择一首歌曲';

  const artist =
    song.artist || 'Melody Music';

  nowTitle.textContent = title;
  nowArtist.textContent = artist;

  playerTitle.textContent = title;
  playerArtist.textContent = artist;

  setCover(song.cover_art_url || '');

  currentLyrics = parseLrc(
    song.lyrics_lrc || ''
  );

  renderLyrics();
  highlightActiveRow();
}

function highlightActiveRow() {
  const active = String(
    window.Amplitude
      .getActiveIndex?.() ?? ''
  );

  document
    .querySelectorAll('.song-row')
    .forEach((row) => {
      row.classList.toggle(
        'active',
        row.dataset.songIndex === active
      );
    });
}

function syncLyrics() {
  if (!currentLyrics.length) return;

  const index = activeLyricIndex(
    currentLyrics,
    window.Amplitude
      .getSongPlayedSeconds()
  );

  if (index === lastLyricIndex) {
    return;
  }

  lyricsEl
    .querySelector('.active')
    ?.classList.remove('active');

  const line = lyricsEl.querySelector(
    `[data-lyric="${index}"]`
  );

  if (line) {
    line.classList.add('active');

    line.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  }

  lastLyricIndex = index;
}

/* =========================================================
   Search
   ========================================================= */

searchInput.addEventListener(
  'input',
  () => {
    renderCurrentSongList();
  }
);

/* =========================================================
   Application Init
   ========================================================= */

async function initPlayer() {
  if (!window.Amplitude) {
    statusEl.textContent =
      '播放器加载失败';

    songListEl.innerHTML =
      '<div class="state-card">AmplitudeJS 未能加载，请刷新页面</div>';

    return;
  }

  try {
    const response = await fetch(
      '/api/songs'
    );

    if (!response.ok) {
      throw new Error('songs');
    }

    const payload =
      await response.json();

    apiSongs = payload.songs || [];

    if (!apiSongs.length) {
      songListEl.innerHTML =
        '<div class="state-card">后台还没有发布歌曲</div>';

      songCountEl.textContent =
        '0 首';

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

        play: () => {
          statusEl.textContent = '';
          highlightActiveRow();
        },

        pause: highlightActiveRow,

        error: () => {
          statusEl.textContent =
            '音频加载失败';
        },
      },
    });

    renderCurrentSongList();

    syncNowPlaying();
  } catch {
    songListEl.innerHTML =
      '<div class="state-card">音乐加载失败，请稍后重试</div>';

    songCountEl.textContent =
      '0 首';
  }
}

async function init() {
  renderUserState();

  await initPlayer();
  await loadCurrentUser();
}

init();
