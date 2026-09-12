import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIOSPlaybackAdapter,
  stateToViewModel,
} from '../public/ios-playback-adapter.js';

const songs = [
  { id: 1, title: 'One', artist: 'A', audio_url: '/1.mp3' },
  { id: 2, title: 'Two', artist: 'B', audio_url: '/2.mp3' },
];

test('native adapter stays disabled when the native bridge is unavailable', () => {
  const adapter = createIOSPlaybackAdapter({
    nativeAudio: { isAvailable: () => false },
    getSongs: () => songs,
  });

  assert.equal(adapter.isEnabled(), false);
});

test('playIndex sends the whole queue and selected song to native audio', async () => {
  const calls = [];
  const nativeAudio = {
    isAvailable: () => true,
    async setQueue(queue, index) { calls.push(['queue', queue, index]); },
    async play(song) { calls.push(['play', song]); },
  };
  const adapter = createIOSPlaybackAdapter({ nativeAudio, getSongs: () => songs });

  await adapter.playIndex(1);

  assert.deepEqual(calls, [
    ['queue', songs, 1],
    ['play', songs[1]],
  ]);
  assert.equal(adapter.getIndex(), 1);
});

test('toggle resumes a paused native track and pauses a playing track', async () => {
  const calls = [];
  const nativeAudio = {
    isAvailable: () => true,
    async resume() { calls.push('resume'); },
    async pause() { calls.push('pause'); },
  };
  const adapter = createIOSPlaybackAdapter({ nativeAudio, getSongs: () => songs });

  adapter.acceptState({ trackId: 1, playing: false, currentTime: 4, duration: 20, queueIndex: 0 });
  await adapter.toggle();
  adapter.acceptState({ trackId: 1, playing: true, currentTime: 5, duration: 20, queueIndex: 0 });
  await adapter.toggle();

  assert.deepEqual(calls, ['resume', 'pause']);
});

test('stateToViewModel normalizes native state for web rendering', () => {
  assert.deepEqual(
    stateToViewModel({ trackId: '2', playing: 1, currentTime: '8.5', duration: '99', queueIndex: '1' }),
    { trackId: 2, playing: true, currentTime: 8.5, duration: 99, queueIndex: 1 }
  );
});
