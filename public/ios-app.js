export const NATIVE_AUDIO_EVENT = 'melody:native-audio-state';

function absoluteUrl(value, origin) {
  if (!value) return '';
  return new URL(String(value), origin).href;
}

export function normalizeSong(song = {}, origin = globalThis.location?.origin || 'https://babavs.edu.kg/') {
  return {
    id: Number(song.id),
    title: String(song.title || ''),
    artist: String(song.artist || ''),
    audioUrl: absoluteUrl(song.audio_url || song.audioUrl, origin),
    coverUrl: absoluteUrl(song.cover_url || song.coverUrl, origin),
    album: String(song.album || song.album_title || ''),
    duration: Number(song.duration || 0),
  };
}

function createStateEvent(detail) {
  if (typeof CustomEvent === 'function') {
    return new CustomEvent(NATIVE_AUDIO_EVENT, { detail });
  }
  return { type: NATIVE_AUDIO_EVENT, detail };
}

export function createMelodyIOSAudio({
  plugin = null,
  target = globalThis.window,
  origin = globalThis.location?.origin || 'https://babavs.edu.kg/',
} = {}) {
  const available = () => Boolean(plugin);

  const call = async (method, payload = undefined) => {
    if (!plugin || typeof plugin[method] !== 'function') return null;
    return payload === undefined ? plugin[method]() : plugin[method](payload);
  };

  if (plugin && typeof plugin.addListener === 'function' && target?.dispatchEvent) {
    Promise.resolve(
      plugin.addListener('stateChanged', (state) => {
        target.dispatchEvent(createStateEvent(state));
      })
    ).catch(() => {});
  }

  return Object.freeze({
    isAvailable: available,

    async setQueue(queue = [], index = 0) {
      return call('setQueue', {
        queue: queue.map((song) => normalizeSong(song, origin)),
        index: Math.max(0, Number(index) || 0),
      });
    },

    async play(song) {
      return call('play', { song: normalizeSong(song, origin) });
    },

    async pause() {
      return call('pause');
    },

    async resume() {
      return call('resume');
    },

    async seek(seconds) {
      return call('seek', { seconds: Math.max(0, Number(seconds) || 0) });
    },

    async next() {
      return call('next');
    },

    async previous() {
      return call('previous');
    },

    async getState() {
      return call('getState');
    },
  });
}

export function installIOSLaunchSplash(doc = globalThis.document, options = {}) {
  if (!doc?.documentElement || !doc?.createElement) return false;

  const win = doc.defaultView || globalThis.window;
  const storage = win?.sessionStorage;
  if (storage?.getItem?.('melody_ios_splash_shown') === '1') return false;
  if (doc.getElementById?.('iosLaunchSplash')) return true;

  const duration = Number(options.duration ?? 1300);
  const fadeDuration = Number(options.fadeDuration ?? 260);

  const splash = doc.createElement('div');
  splash.id = 'iosLaunchSplash';
  splash.className = 'ios-launch-splash';
  splash.setAttribute('aria-hidden', 'true');
  splash.innerHTML = '<img src="/ios-launch.svg" alt="" draggable="false">';

  (doc.body || doc.documentElement).appendChild(splash);
  storage?.setItem?.('melody_ios_splash_shown', '1');

  const setTimer = win?.setTimeout?.bind(win) || globalThis.setTimeout;
  setTimer?.(() => splash.classList.add('is-hiding'), duration);
  setTimer?.(() => splash.remove?.(), duration + fadeDuration);
  return true;
}

async function deleteAccount(button) {
  const confirmed = globalThis.window?.confirm?.(
    '确定要永久删除账号吗？收藏、歌单和播放记录也会一起删除。此操作无法撤销。'
  );
  if (!confirmed) return;

  const original = button.textContent;
  button.disabled = true;
  button.textContent = '正在删除…';

  try {
    const response = await fetch('/api/auth/account', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error('删除账号失败，请重新登录后再试');
    }

    globalThis.window?.alert?.('账号已删除');
    globalThis.window?.location?.reload?.();
  } catch (error) {
    globalThis.window?.alert?.(error?.message || '删除账号失败');
    button.disabled = false;
    button.textContent = original;
  }
}

function installLegalLinks(doc) {
  const userMenu = doc.getElementById?.('userMenu');
  if (userMenu && !userMenu.querySelector?.('.ios-legal-links')) {
    const links = doc.createElement('div');
    links.className = 'ios-legal-links';
    links.innerHTML = '<a href="/privacy.html">隐私政策</a><a href="/terms.html">用户协议</a>';
    userMenu.appendChild(links);

    const deleteButton = doc.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'ios-delete-account';
    deleteButton.textContent = '删除账号';
    deleteButton.addEventListener('click', () => deleteAccount(deleteButton));
    userMenu.appendChild(deleteButton);
  }

  const authDialog = doc.querySelector?.('.auth-dialog');
  if (authDialog && !authDialog.querySelector?.('.ios-auth-legal')) {
    const links = doc.createElement('p');
    links.className = 'ios-auth-legal';
    links.innerHTML = '继续使用即表示你同意 <a href="/terms.html">用户协议</a> 和 <a href="/privacy.html">隐私政策</a>。';
    authDialog.appendChild(links);
  }
}

export function installIOSChrome(doc = globalThis.document) {
  if (!doc?.documentElement || !doc?.body) return false;
  if (doc.getElementById?.('iosBottomNav')) return true;

  doc.documentElement.classList.add('ios-native-app');

  if (!doc.querySelector?.('link[data-ios-mobile-style]')) {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/ios-mobile.css';
    link.dataset.iosMobileStyle = 'true';
    doc.head?.appendChild(link);
  }

  installIOSLaunchSplash(doc);
  installLegalLinks(doc);

  const nav = doc.createElement('nav');
  nav.id = 'iosBottomNav';
  nav.className = 'ios-bottom-nav';
  nav.setAttribute('aria-label', 'iPhone 主导航');
  nav.innerHTML = `
    <button class="ios-bottom-nav-button" type="button" data-ios-tab="home" aria-current="page"><span>⌂</span><span>首页</span></button>
    <button class="ios-bottom-nav-button" type="button" data-ios-tab="albums"><span>▦</span><span>专辑</span></button>
    <button class="ios-bottom-nav-button" type="button" data-ios-tab="search"><span>⌕</span><span>搜索</span></button>
    <button class="ios-bottom-nav-button" type="button" data-ios-tab="my"><span>♪</span><span>我的</span></button>
  `;
  doc.body.appendChild(nav);

  const setCurrent = (button) => {
    nav.querySelectorAll('[data-ios-tab]').forEach((item) => item.removeAttribute('aria-current'));
    button.setAttribute('aria-current', 'page');
  };

  nav.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-ios-tab]');
    if (!button) return;
    setCurrent(button);

    const tab = button.dataset.iosTab;
    if (tab === 'home') {
      globalThis.window?.scrollTo?.({ top: 0, behavior: 'smooth' });
    } else if (tab === 'albums') {
      doc.querySelector?.('.albums-section')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } else if (tab === 'search') {
      const input = doc.getElementById?.('searchInput');
      input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      setTimeout(() => input?.focus?.(), 250);
    } else if (tab === 'my') {
      const userButton = doc.getElementById?.('userMenuButton');
      const loginButton = doc.getElementById?.('loginButton');
      if (userButton && !userButton.closest?.('[hidden]')) userButton.click?.();
      else loginButton?.click?.();
    }
  });

  const miniPlayer = doc.querySelector?.('.player-song');
  miniPlayer?.addEventListener?.('click', () => {
    doc.querySelector?.('.now-panel')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  });

  return true;
}

function resolveNativePlugin() {
  return globalThis.window?.Capacitor?.Plugins?.NativeAudio || null;
}

if (typeof window !== 'undefined') {
  const plugin = resolveNativePlugin();
  window.MelodyIOSAudio = createMelodyIOSAudio({
    plugin,
    target: window,
    origin: window.location.origin,
  });

  if (plugin) {
    const install = () => installIOSChrome(document);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
      install();
    }
  }
}
