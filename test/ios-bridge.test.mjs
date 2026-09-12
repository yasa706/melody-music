import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMelodyIOSAudio,
  normalizeSong,
  NATIVE_AUDIO_EVENT,
} from '../public/ios-app.js';

test('normalizes a song for native playback', () => {
  const song = normalizeSong(
    {
      id: '7',
      title: 'A',
      artist: 'Singer',
      audio_url: '/media/a.mp3',
      cover_url: '/media/a.jpg',
      album: 'Album',
      duration: '123.5',
    },
    'https://babavs.edu.kg/'
  );

  assert.deepEqual(song, {
    id: 7,
    title: 'A',
    artist: 'Singer',
    audioUrl: 'https://babavs.edu.kg/media/a.mp3',
    coverUrl: 'https://babavs.edu.kg/media/a.jpg',
    album: 'Album',
    duration: 123.5,
  });
});

test('bridge is unavailable when the native plugin is missing', () => {
  const bridge = createMelodyIOSAudio({ plugin: null, origin: 'https://babavs.edu.kg/' });
  assert.equal(bridge.isAvailable(), false);
});

test('play forwards normalized metadata to the native plugin', async () => {
  const calls = [];
  const plugin = {
    async play(payload) {
      calls.push(payload);
      return { ok: true };
    },
  };
  const bridge = createMelodyIOSAudio({ plugin, origin: 'https://babavs.edu.kg/' });

  await bridge.play({ id: 3, title: 'Song', audio_url: '/song.mp3' });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    song: {
      id: 3,
      title: 'Song',
      artist: '',
      audioUrl: 'https://babavs.edu.kg/song.mp3',
      coverUrl: '',
      album: '',
      duration: 0,
    },
  });
});

test('native state changes are re-emitted as browser events', async () => {
  let nativeListener;
  const plugin = {
    async addListener(name, listener) {
      assert.equal(name, 'stateChanged');
      nativeListener = listener;
      return { remove() {} };
    },
  };
  const dispatched = [];
  const target = {
    dispatchEvent(event) {
      dispatched.push(event);
    },
  };

  createMelodyIOSAudio({ plugin, target, origin: 'https://babavs.edu.kg/' });
  await Promise.resolve();
  nativeListener({ trackId: 9, playing: true, currentTime: 12, duration: 100, queueIndex: 0 });

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, NATIVE_AUDIO_EVENT);
  assert.deepEqual(dispatched[0].detail, {
    trackId: 9,
    playing: true,
    currentTime: 12,
    duration: 100,
    queueIndex: 0,
  });
});
