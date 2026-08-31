import { toAmplitudeSongs } from './player-data.js';

let apiSongs = [];
let apiAlbums = [];
let currentLyrics = [];
let lastLyricIndex = -2;
let currentUser = null;
let favoriteSongIds = new Set();
let showingFavoritesOnly = false;
let userPlaylists = [];
let selectedPlaylistSong = null;
let historySongs = [];
let showingHistoryOnly = false;
let lastHistorySongId = null;
let lastHistoryRecordedAt = 0;

/* =========================================================
   Player DOM
   ========================================================= */

const songListEl = document.getElementById('songList');
const lyricsEl = document.getElementById('lyrics');
const statusEl = document.getElementById('playbackStatus');
const searchInput = document.getElementById('searchInput');
const songCountEl = document.getElementById('songCount');
const albumCountEl = document.getElementById('albumCount');
const albumsGridEl = document.getElementById('albumsGrid');
const albumModal = document.getElementById('albumModal');
const albumBackdrop = document.getElementById('albumBackdrop');
const albumCloseButton = document.getElementById('albumCloseButton');
const albumDetailCover = document.getElementById('albumDetailCover');
const albumDetailTitle = document.getElementById('albumDetailTitle');
const albumDetailArtist = document.getElementById('albumDetailArtist');
const albumDetailDescription = document.getElementById('albumDetailDescription');
const albumDetailCount = document.getElementById('albumDetailCount');
const albumDetailSongs = document.getElementById('albumDetailSongs');


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
   Playlist Modal DOM
   ========================================================= */

const playlistModal = document.getElementById('playlistModal');
const playlistBackdrop = document.getElementById('playlistBackdrop');
const playlistCloseButton = document.getElementById(
  'playlistCloseButton'
);
const createPlaylistForm = document.getElementById(
  'createPlaylistForm'
);
const newPlaylistName = document.getElementById('newPlaylistName');
const createPlaylistButton = document.getElementById(
  'createPlaylistButton'
);
const playlistMessage = document.getElementById('playlistMessage');
const playlistList = document.getElementById('playlistList');

const addToPlaylistModal = document.getElementById(
  'addToPlaylistModal'
);
const addToPlaylistBackdrop = document.getElementById(
  'addToPlaylistBackdrop'
);
const addToPlaylistCloseButton = document.getElementById(
  'addToPlaylistCloseButton'
);
const addToPlaylistSongName = document.getElementById(
  'addToPlaylistSongName'
);
const addToPlaylistMessage = document.getElementById(
  'addToPlaylistMessage'
);
const addToPlaylistList = document.getElementById(
  'addToPlaylistList'
);
const quickCreatePlaylistButton = document.getElementById(
  'quickCreatePlaylistButton'
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
    PLAYLIST_NOT_FOUND: '歌单不存在',
    PLAYLIST_NAME_REQUIRED: '请输入歌单名称',
    PLAYLIST_NAME_TOO_LONG: '歌单名称太长',
    PLAYLIST_DESCRIPTION_TOO_LONG: '歌单说明太长',
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
    userPlaylists = [];
    selectedPlaylistSong = null;
    historySongs = [];
    showingHistoryOnly = false;
    lastHistorySongId = null;
    lastHistoryRecordedAt = 0;

    if (playlistModal) playlistModal.hidden = true;
    if (addToPlaylistModal) addToPlaylistModal.hidden = true;

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
   Playlist API + UI
   ========================================================= */

async function loadPlaylists() {
  if (!currentUser) {
    userPlaylists = [];
    return [];
  }

  const response = await fetch('/api/user/playlists', {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(payload, '歌单加载失败，请稍后再试')
    );
  }

  userPlaylists = payload.playlists || [];
  return userPlaylists;
}

async function createPlaylist(name) {
  const response = await fetch('/api/user/playlists', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(payload, '创建歌单失败，请稍后再试')
    );
  }

  return payload.playlist;
}

async function deletePlaylist(playlistId) {
  const response = await fetch(
    `/api/user/playlists/${playlistId}`,
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
      apiErrorMessage(payload, '删除歌单失败，请稍后再试')
    );
  }
}

async function loadPlaylistDetails(playlistId) {
  const response = await fetch(
    `/api/user/playlists/${playlistId}`,
    {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    }
  );

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(payload, '歌单加载失败，请稍后再试')
    );
  }

  return payload;
}

async function addSongToPlaylist(playlistId, songId) {
  const response = await fetch(
    `/api/user/playlists/${playlistId}/songs/${songId}`,
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
      apiErrorMessage(payload, '添加歌曲失败，请稍后再试')
    );
  }
}

async function removeSongFromPlaylist(playlistId, songId) {
  const response = await fetch(
    `/api/user/playlists/${playlistId}/songs/${songId}`,
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
      apiErrorMessage(payload, '移除歌曲失败，请稍后再试')
    );
  }
}

function openPlaylistModal() {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  closeUserMenu();
  playlistModal.hidden = false;
  document.body.style.overflow = 'hidden';
  playlistMessage.textContent = '';
  renderPlaylistListLoading();

  loadPlaylists()
    .then(renderPlaylistList)
    .catch((error) => {
      playlistList.innerHTML = `
        <div class="state-card">
          ${esc(error?.message || '歌单加载失败')}
        </div>
      `;
    });
}

function closePlaylistModal() {
  playlistModal.hidden = true;
  playlistMessage.textContent = '';
  document.body.style.overflow = '';
}

function openAddToPlaylistModal(songId) {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  const song = apiSongs.find(
    (item) => String(item.id) === String(songId)
  );

  if (!song) return;

  selectedPlaylistSong = song;
  addToPlaylistModal.hidden = false;
  document.body.style.overflow = 'hidden';
  addToPlaylistMessage.textContent = '';
  addToPlaylistSongName.textContent =
    song.title || '选择一个歌单';

  addToPlaylistList.innerHTML =
    '<div class="state-card">正在加载歌单…</div>';

  loadPlaylists()
    .then(renderAddToPlaylistList)
    .catch((error) => {
      addToPlaylistList.innerHTML = `
        <div class="state-card">
          ${esc(error?.message || '歌单加载失败')}
        </div>
      `;
    });
}

function closeAddToPlaylistModal() {
  addToPlaylistModal.hidden = true;
  addToPlaylistMessage.textContent = '';
  selectedPlaylistSong = null;
  document.body.style.overflow = '';
}

function renderPlaylistListLoading() {
  playlistList.innerHTML =
    '<div class="state-card">正在加载歌单…</div>';
}

function renderPlaylistList(playlists = userPlaylists) {
  if (!playlists.length) {
    playlistList.innerHTML = `
      <div class="playlist-empty">
        <span class="playlist-empty-icon">♫</span>
        <strong>还没有歌单</strong>
        <span>在上方输入名称创建第一个歌单</span>
      </div>
    `;
    return;
  }

  playlistList.innerHTML = playlists
    .map(
      (playlist) => `
        <div class="playlist-item">
          <div class="playlist-icon">♫</div>

          <div class="playlist-item-copy">
            <span class="playlist-item-name">
              ${esc(playlist.name)}
            </span>
            <span class="playlist-item-meta">
              ${Number(playlist.song_count || 0)} 首歌曲
            </span>
          </div>

          <div class="playlist-item-actions">
            <button
              class="playlist-open-button"
              type="button"
              data-open-playlist-id="${esc(playlist.id)}"
            >
              查看
            </button>

            <button
              class="playlist-delete-button"
              type="button"
              data-delete-playlist-id="${esc(playlist.id)}"
            >
              删除
            </button>
          </div>
        </div>
      `
    )
    .join('');

  playlistList
    .querySelectorAll('[data-open-playlist-id]')
    .forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;

        try {
          const payload = await loadPlaylistDetails(
            button.dataset.openPlaylistId
          );
          renderPlaylistDetail(payload);
        } catch (error) {
          playlistMessage.textContent =
            error?.message || '歌单加载失败';
        } finally {
          button.disabled = false;
        }
      });
    });

  playlistList
    .querySelectorAll('[data-delete-playlist-id]')
    .forEach((button) => {
      button.addEventListener('click', async () => {
        const playlist = userPlaylists.find(
          (item) =>
            String(item.id) ===
            String(button.dataset.deletePlaylistId)
        );

        const confirmed = window.confirm(
          `确定删除歌单“${playlist?.name || '这个歌单'}”吗？`
        );

        if (!confirmed) return;

        button.disabled = true;

        try {
          await deletePlaylist(button.dataset.deletePlaylistId);
          await loadPlaylists();
          renderPlaylistList();
          playlistMessage.textContent = '歌单已删除';
        } catch (error) {
          playlistMessage.textContent =
            error?.message || '删除歌单失败';
        } finally {
          button.disabled = false;
        }
      });
    });
}

function renderPlaylistDetail(payload) {
  const playlist = payload.playlist || {};
  const songs = payload.songs || [];

  playlistList.innerHTML = `
    <div class="playlist-detail-header">
      <div class="playlist-detail-title">
        <h3>${esc(playlist.name || '歌单')}</h3>
        <p>${songs.length} 首歌曲</p>
      </div>

      <button
        id="playlistBackButton"
        class="playlist-back-button"
        type="button"
      >
        ← 返回
      </button>
    </div>

    ${
      songs.length
        ? songs
            .map(
              (song) => `
                <div class="playlist-song-item">
                  <div class="playlist-song-copy">
                    <strong>${esc(song.title || '未命名歌曲')}</strong>
                    <span>${esc(song.artist || '未知歌手')}</span>
                  </div>

                  <button
                    class="playlist-remove-song-button"
                    type="button"
                    data-remove-playlist-id="${esc(playlist.id)}"
                    data-remove-song-id="${esc(song.id)}"
                    aria-label="从歌单移除"
                    title="从歌单移除"
                  >
                    ×
                  </button>
                </div>
              `
            )
            .join('')
        : `
          <div class="playlist-empty">
            <span class="playlist-empty-icon">♪</span>
            <strong>这个歌单还没有歌曲</strong>
            <span>在歌曲列表点击 ＋ 添加歌曲</span>
          </div>
        `
    }
  `;

  document
    .getElementById('playlistBackButton')
    ?.addEventListener('click', () => {
      renderPlaylistList();
    });

  playlistList
    .querySelectorAll('[data-remove-song-id]')
    .forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;

        try {
          await removeSongFromPlaylist(
            button.dataset.removePlaylistId,
            button.dataset.removeSongId
          );

          const refreshed = await loadPlaylistDetails(
            button.dataset.removePlaylistId
          );

          renderPlaylistDetail(refreshed);
          await loadPlaylists();
          playlistMessage.textContent = '歌曲已移出歌单';
        } catch (error) {
          playlistMessage.textContent =
            error?.message || '移除歌曲失败';
        } finally {
          button.disabled = false;
        }
      });
    });
}

function renderAddToPlaylistList(playlists = userPlaylists) {
  if (!playlists.length) {
    addToPlaylistList.innerHTML = `
      <div class="playlist-empty">
        <span class="playlist-empty-icon">♫</span>
        <strong>还没有歌单</strong>
        <span>请先创建一个歌单</span>
      </div>
    `;
    return;
  }

  addToPlaylistList.innerHTML = playlists
    .map(
      (playlist) => `
        <div class="playlist-item">
          <div class="playlist-icon">♫</div>

          <div class="playlist-item-copy">
            <span class="playlist-item-name">
              ${esc(playlist.name)}
            </span>
            <span class="playlist-item-meta">
              ${Number(playlist.song_count || 0)} 首歌曲
            </span>
          </div>

          <div class="playlist-item-actions">
            <button
              class="playlist-add-button"
              type="button"
              data-add-playlist-id="${esc(playlist.id)}"
            >
              ＋ 添加
            </button>
          </div>
        </div>
      `
    )
    .join('');

  addToPlaylistList
    .querySelectorAll('[data-add-playlist-id]')
    .forEach((button) => {
      button.addEventListener('click', async () => {
        if (!selectedPlaylistSong) return;

        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = '添加中…';

        try {
          await addSongToPlaylist(
            button.dataset.addPlaylistId,
            selectedPlaylistSong.id
          );

          await loadPlaylists();
          renderAddToPlaylistList();
          addToPlaylistMessage.textContent =
            `已将“${selectedPlaylistSong.title || '歌曲'}”加入歌单`;
        } catch (error) {
          addToPlaylistMessage.textContent =
            error?.message || '添加歌曲失败';
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });
}

playlistCloseButton.addEventListener('click', closePlaylistModal);
playlistBackdrop.addEventListener('click', closePlaylistModal);
addToPlaylistCloseButton.addEventListener(
  'click',
  closeAddToPlaylistModal
);
addToPlaylistBackdrop.addEventListener(
  'click',
  closeAddToPlaylistModal
);

createPlaylistForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = newPlaylistName.value.trim();

  if (!name) {
    playlistMessage.textContent = '请输入歌单名称';
    return;
  }

  createPlaylistButton.disabled = true;
  createPlaylistButton.textContent = '创建中…';
  playlistMessage.textContent = '';

  try {
    await createPlaylist(name);
    newPlaylistName.value = '';
    await loadPlaylists();
    renderPlaylistList();
    playlistMessage.textContent = '歌单创建成功';
  } catch (error) {
    playlistMessage.textContent =
      error?.message || '创建歌单失败';
  } finally {
    createPlaylistButton.disabled = false;
    createPlaylistButton.textContent = '＋ 创建';
  }
});

quickCreatePlaylistButton.addEventListener('click', () => {
  closeAddToPlaylistModal();
  openPlaylistModal();

  setTimeout(() => {
    newPlaylistName.focus();
  }, 0);
});

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
  if (event.key !== 'Escape') return;

  if (!addToPlaylistModal.hidden) {
    closeAddToPlaylistModal();
    return;
  }

  if (!playlistModal.hidden) {
    closePlaylistModal();
    return;
  }

  if (!authModal.hidden) {
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

    showingHistoryOnly = false;
    historyMenuButton.textContent = '◷ 播放历史';

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
    openPlaylistModal();
  }
);

historyMenuButton.addEventListener(
  'click',
  async () => {
    closeUserMenu();

    if (!currentUser) {
      openAuthModal('login');
      return;
    }

    showingHistoryOnly = !showingHistoryOnly;
    showingFavoritesOnly = false;
    favoritesMenuButton.textContent = '♥ 我的收藏';
    searchInput.value = '';

    if (!showingHistoryOnly) {
      historyMenuButton.textContent = '◷ 播放历史';
      renderCurrentSongList();
      statusEl.textContent = '';
      return;
    }

    historyMenuButton.textContent = '♫ 查看全部歌曲';
    statusEl.textContent = '正在加载播放历史…';

    try {
      await loadPlayHistory();
      renderCurrentSongList();
      statusEl.textContent = historySongs.length
        ? '正在查看播放历史'
        : '还没有播放历史';
    } catch (error) {
      showingHistoryOnly = false;
      historyMenuButton.textContent = '◷ 播放历史';
      renderCurrentSongList();
      statusEl.textContent = error?.message || '播放历史加载失败';
    }
  }
);

/* =========================================================
   Playback History API
   ========================================================= */

async function loadPlayHistory() {
  if (!currentUser) {
    historySongs = [];
    return [];
  }

  const response = await fetch('/api/user/history?limit=100', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      apiErrorMessage(payload, '播放历史加载失败')
    );
  }

  historySongs = (payload.history || payload.songs || [])
    .map((entry) => entry.song || entry)
    .filter((song) => song && song.id != null);

  return historySongs;
}

async function recordPlayHistory() {
  if (!currentUser || !apiSongs.length) return;

  const activeIndex = Number(
    window.Amplitude.getActiveIndex?.() ?? -1
  );
  const song = apiSongs[activeIndex];
  if (!song?.id) return;

  const now = Date.now();
  const songKey = String(song.id);

  if (
    songKey === String(lastHistorySongId) &&
    now - lastHistoryRecordedAt < 30000
  ) {
    return;
  }

  lastHistorySongId = songKey;
  lastHistoryRecordedAt = now;

  const response = await fetch(
    `/api/user/history/${encodeURIComponent(song.id)}`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }
  );

  if (!response.ok) {
    lastHistorySongId = null;
    lastHistoryRecordedAt = 0;
  }
}

/* =========================================================
   Albums
   ========================================================= */

function renderAlbums() {
  albumCountEl.textContent = `${apiAlbums.length} 张`;
  if (!apiAlbums.length) {
    albumsGridEl.innerHTML = '<div class="state-card album-state">后台还没有发布专辑</div>';
    return;
  }
  albumsGridEl.innerHTML = apiAlbums.map((album) => {
    const cover = album.cover_url
      ? `<img class="album-card-cover" src="${esc(album.cover_url)}" alt="${esc(album.title)}" loading="lazy">`
      : '<div class="album-cover-fallback">♫</div>';
    return `<button class="album-card" type="button" data-album-id="${esc(album.id)}">
      <span class="album-card-cover-wrap">${cover}</span>
      <span class="album-card-title">${esc(album.title || '未命名专辑')}</span>
      <span class="album-card-meta">${esc(album.artist || 'Melody Music')} · ${Number(album.song_count || 0)} 首</span>
    </button>`;
  }).join('');
  albumsGridEl.querySelectorAll('[data-album-id]').forEach((button) => {
    button.addEventListener('click', () => openAlbum(button.dataset.albumId));
  });
}

function closeAlbum() {
  albumModal.hidden = true;
  document.body.style.overflow = '';
}

async function openAlbum(albumId) {
  albumModal.hidden = false;
  document.body.style.overflow = 'hidden';
  albumDetailTitle.textContent = '正在加载…';
  albumDetailArtist.textContent = '';
  albumDetailDescription.textContent = '';
  albumDetailCount.textContent = '0 首';
  albumDetailCover.innerHTML = '♫';
  albumDetailCover.classList.add('album-cover-fallback');
  albumDetailSongs.innerHTML = '<div class="state-card">正在加载歌曲…</div>';
  try {
    const response = await fetch(`/api/albums/${encodeURIComponent(albumId)}`);
    const payload = await readJson(response);
    if (!response.ok) throw new Error('album');
    const album = payload.album || {};
    const songs = payload.songs || [];
    albumDetailTitle.textContent = album.title || '未命名专辑';
    albumDetailArtist.textContent = album.artist || 'Melody Music';
    albumDetailDescription.textContent = album.description || '';
    albumDetailCount.textContent = `${songs.length} 首`;
    if (album.cover_url) {
      albumDetailCover.classList.remove('album-cover-fallback');
      albumDetailCover.innerHTML = `<img src="${esc(album.cover_url)}" alt="${esc(album.title || '')}">`;
    }
    if (!songs.length) {
      albumDetailSongs.innerHTML = '<div class="state-card">这张专辑还没有发布歌曲</div>';
      return;
    }
    albumDetailSongs.innerHTML = songs.map((song) => {
      const globalIndex = apiSongs.findIndex((item) => String(item.id) === String(song.id));
      const cover = song.cover_url
        ? `<img class="song-cover" src="${esc(song.cover_url)}" alt="" loading="lazy">`
        : '<div class="song-cover-fallback">♪</div>';
      return `<button class="album-detail-song amplitude-play-pause" type="button" data-amplitude-song-index="${globalIndex}" data-song-index="${globalIndex}">
        ${cover}<span class="song-info"><span class="song-title">${esc(song.title)}</span><span class="song-artist">${esc(song.artist)}</span></span><span class="song-duration">${formatDuration(song.duration_seconds)}</span>
      </button>`;
    }).join('');
    window.Amplitude?.bindNewElements?.();
  } catch {
    albumDetailTitle.textContent = '专辑加载失败';
    albumDetailSongs.innerHTML = '<div class="state-card">请稍后重试</div>';
  }
}

albumCloseButton?.addEventListener('click', closeAlbum);
albumBackdrop?.addEventListener('click', closeAlbum);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && albumModal && !albumModal.hidden) closeAlbum();
});

async function initAlbums() {
  try {
    const response = await fetch('/api/albums');
    if (!response.ok) throw new Error('albums');
    const payload = await response.json();
    apiAlbums = payload.albums || [];
    renderAlbums();
  } catch {
    albumCountEl.textContent = '0 张';
    albumsGridEl.innerHTML = '<div class="state-card album-state">专辑加载失败，请稍后重试</div>';
  }
}

/* =========================================================
   Song List
   ========================================================= */

function currentBaseList() {
  if (showingHistoryOnly) {
    return historySongs;
  }

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
        song.album_name,
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
      showingHistoryOnly
        ? '<div class="state-card">还没有播放历史</div>'
        : showingFavoritesOnly
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
            class="add-to-playlist-btn"
            type="button"
            data-add-to-playlist-song-id="${esc(song.id)}"
            aria-label="添加到歌单"
            title="添加到歌单"
          >
            ＋
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
      '[data-add-to-playlist-song-id]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          openAddToPlaylistModal(
            button.dataset.addToPlaylistSongId
          );
        }
      );
    });

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
          recordPlayHistory().catch(() => {});
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
  await initAlbums();
  await loadCurrentUser();
}

init();