PRAGMA foreign_keys = ON;

CREATE TABLE albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE songs ADD COLUMN album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL;

CREATE INDEX idx_albums_published_sort ON albums(is_published, sort_order, id);
CREATE INDEX idx_songs_album_id ON songs(album_id);
