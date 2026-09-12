const TIMESTAMP_PATTERN = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;

export function parseLyricsContent(text = '') {
  const source = String(text || '');
  const timed = [];

  for (const raw of source.split(/\r?\n/)) {
    if (/^\[(ar|ti|al|by|offset|length):/i.test(raw)) continue;

    const stamps = [...raw.matchAll(TIMESTAMP_PATTERN)];
    if (!stamps.length) continue;

    const lyric = raw.replace(TIMESTAMP_PATTERN, '').trim();

    for (const stamp of stamps) {
      const fraction = (stamp[3] || '').padEnd(3, '0').slice(0, 3);
      timed.push({
        time:
          Number(stamp[1]) * 60 +
          Number(stamp[2]) +
          Number(fraction || 0) / 1000,
        text: lyric,
      });
    }
  }

  timed.sort((a, b) => a.time - b.time);
  if (timed.length) return { timed, plain: [] };

  const plain = source
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\[(ar|ti|al|by|offset|length):.*?\]\s*/i, '')
        .trim()
    )
    .filter(Boolean);

  return { timed: [], plain };
}

function renderPlainLyricsFallback() {
  const lyricsEl = document.getElementById('lyrics');
  const song = window.Amplitude?.getActiveSongMetadata?.() || {};
  if (!lyricsEl || (!song.melody_id && !song.lyrics_lrc)) return;

  const raw = String(song.lyrics_lrc || '');
  const parsed = parseLyricsContent(raw);

  if (parsed.timed.length) {
    delete lyricsEl.dataset.plainLyricsKey;
    return;
  }

  if (!parsed.plain.length) {
    delete lyricsEl.dataset.plainLyricsKey;
    if (lyricsEl.textContent.trim() === '暂无同步歌词') {
      lyricsEl.innerHTML = '<p class="muted">暂无歌词</p>';
    }
    return;
  }

  if (lyricsEl.dataset.plainLyricsKey === raw) return;

  const fragment = document.createDocumentFragment();
  for (const line of parsed.plain) {
    const item = document.createElement('p');
    item.className = 'lyric-line plain-lyric-line';
    item.textContent = line;
    fragment.appendChild(item);
  }

  lyricsEl.replaceChildren(fragment);
  lyricsEl.dataset.plainLyricsKey = raw;
  lyricsEl.scrollTop = 0;
}

function installPlainLyricsFallback() {
  const lyricsEl = document.getElementById('lyrics');
  if (!lyricsEl || typeof MutationObserver === 'undefined') return;

  let queued = false;
  const scheduleRender = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      renderPlainLyricsFallback();
    });
  };

  const observer = new MutationObserver(scheduleRender);
  observer.observe(lyricsEl, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  scheduleRender();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPlainLyricsFallback, {
      once: true,
    });
  } else {
    installPlainLyricsFallback();
  }
}
