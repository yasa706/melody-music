# Melody Music Albums Design

## Goal
Add first-class albums to the existing Cloudflare Worker + D1 + R2 music app without breaking existing songs, login, favorites, playlists, history, or playback.

## Data model
Create `albums` with title, artist, cover_url, description, publication state, sort order, timestamps. Add nullable `songs.album_id` referencing albums. Keep the legacy `songs.album` text field for compatibility with existing records.

## Public experience
Expose `GET /api/albums` and `GET /api/albums/:id`. The home page shows a responsive album cover wall above the song/player layout. Clicking an album opens an album detail dialog with cover, title, artist, description, song count, and its published songs. Clicking a song uses the existing Amplitude queue.

## Admin experience
Add an Albums tab with create/edit/delete. Album editor supports title, artist, description, cover URL/upload, published state, and sort order. Song editor uses an album selector backed by `album_id` while retaining legacy album text server-side for compatibility.

## Compatibility and errors
Albums default to published. Public endpoints return only published albums/songs. Deleting an album sets `songs.album_id` to NULL. Existing songs without `album_id` continue to appear normally. Album UI degrades to a music-note placeholder when no cover exists.

## Testing
Add database query tests, public API route tests, admin normalization tests, and run the full Node test suite. Validate static JS syntax and package a fresh ZIP.
