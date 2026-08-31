export function toAmplitudeSongs(rows = []) {
  return rows.map((song) => ({
    name: String(song?.title || '未命名歌曲'),
    artist: String(song?.artist || '未知歌手'),
    album: String(song?.album_name || song?.album || ''),
    url: String(song?.audio_url || ''),
    cover_art_url: String(song?.cover_url || ''),
    melody_id: song?.id ?? null,
    lyrics_lrc: String(song?.lyrics_lrc || ''),
  }));
}
