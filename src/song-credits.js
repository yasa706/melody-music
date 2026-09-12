export function withSongCredits(song = {}) {
  const artist = String(song?.artist || '').trim();
  const lyricist = String(song?.lyricist || '').trim();
  const composer = String(song?.composer || '').trim();
  const parts = [artist];
  if (lyricist) parts.push(`作词：${lyricist}`);
  if (composer) parts.push(`作曲：${composer}`);
  return { ...song, artist: parts.filter(Boolean).join(' · ') };
}

export function withSongCreditsList(songs = []) {
  return songs.map(withSongCredits);
}
