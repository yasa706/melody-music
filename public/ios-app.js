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

function resolveNativePlugin() {
  return globalThis.window?.Capacitor?.Plugins?.NativeAudio || null;
}

if (typeof window !== 'undefined') {
  window.MelodyIOSAudio = createMelodyIOSAudio({
    plugin: resolveNativePlugin(),
    target: window,
    origin: window.location.origin,
  });
}
