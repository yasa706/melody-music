CREATE TABLE IF NOT EXISTS user_play_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  song_id INTEGER NOT NULL,
  played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_play_history_user_time
ON user_play_history(user_id, played_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_play_history_song
ON user_play_history(song_id);
