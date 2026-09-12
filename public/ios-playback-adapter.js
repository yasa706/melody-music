export function stateToViewModel(state = {}) {
  return {
    trackId: state.trackId == null ? null : Number(state.trackId),
    playing: Boolean(state.playing),
    currentTime: Math.max(0, Number(state.currentTime) || 0),
    duration: Math.max(0, Number(state.duration) || 0),
    queueIndex: Number.isFinite(Number(state.queueIndex)) ? Number(state.queueIndex) : -1,
  };
}

export function createIOSPlaybackAdapter({ nativeAudio, getSongs }) {
  let state = stateToViewModel();
  let activeIndex = -1;

  const isEnabled = () => Boolean(nativeAudio?.isAvailable?.());
  const songs = () => (Array.isArray(getSongs?.()) ? getSongs() : []);

  const acceptState = (nextState) => {
    state = stateToViewModel(nextState);
    const list = songs();
    const byId = list.findIndex((song) => String(song?.id) === String(state.trackId));
    if (byId >= 0) activeIndex = byId;
    else if (state.queueIndex >= 0 && state.queueIndex < list.length) activeIndex = state.queueIndex;
    return state;
  };

  return Object.freeze({
    isEnabled,
    acceptState,
    getState: () => state,
    getIndex: () => activeIndex,
    getSong: () => songs()[activeIndex] || null,

    async playIndex(index) {
      if (!isEnabled()) return false;
      const list = songs();
      const safeIndex = Number(index);
      if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= list.length) return false;
      activeIndex = safeIndex;
      await nativeAudio.setQueue(list, safeIndex);
      await nativeAudio.play(list[safeIndex]);
      return true;
    },

    async toggle() {
      if (!isEnabled()) return false;
      if (activeIndex < 0 && songs().length) return this.playIndex(0);
      if (state.playing) await nativeAudio.pause();
      else await nativeAudio.resume();
      return true;
    },

    async next() {
      if (!isEnabled()) return false;
      await nativeAudio.next();
      return true;
    },

    async previous() {
      if (!isEnabled()) return false;
      await nativeAudio.previous();
      return true;
    },

    async seek(seconds) {
      if (!isEnabled()) return false;
      await nativeAudio.seek(Math.max(0, Number(seconds) || 0));
      return true;
    },
  });
}
