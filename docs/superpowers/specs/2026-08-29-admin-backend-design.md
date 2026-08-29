# Melody Music Admin Backend Design

Date: 2026-08-29

## Goal

Add a production-ready admin backend to the existing `melody-music` site so a single administrator can manage songs, playlists, categories, covers, audio files, and synchronized LRC lyrics without editing source code.

## Scope

### Included
- Single administrator login at `/admin`
- Song CRUD: title, artist, album, category, playlist, duration metadata, publish status
- Audio source supports either uploaded MP3 or external audio URL
- Cover source supports either uploaded image or external image URL
- LRC lyrics support paste/edit and `.lrc` upload
- Playlist CRUD
- Category CRUD
- Frontend reads published content from backend APIs
- Cloudflare D1 stores structured data
- Cloudflare R2 stores uploaded MP3, images, and LRC files
- Public playback without user accounts

### Not included in v1
- Public user registration/login
- User favorites
- User-created playlists
- Multi-admin roles
- Billing/subscriptions
- Copyright/DRM workflows

## Architecture

### Hosting
- Cloudflare Worker serves the API and static site assets.
- GitHub remains the source repository and Cloudflare deploys from the `main` branch.

### Storage
- Cloudflare D1: admin credential metadata, songs, playlists, categories, sessions.
- Cloudflare R2: uploaded audio, covers, and optional raw LRC files.

### Routes
Public:
- `/`
- `/api/songs`
- `/api/songs/:id`
- `/api/playlists`
- `/api/categories`

Admin:
- `/admin`
- `/api/admin/login`
- `/api/admin/logout`
- `/api/admin/songs`
- `/api/admin/playlists`
- `/api/admin/categories`
- `/api/admin/upload`

## Authentication

- One administrator account.
- Password is never stored in plaintext.
- Store a strong password hash plus salt.
- Successful login issues a secure, HttpOnly, SameSite cookie session.
- Admin API routes reject unauthenticated requests.
- Session expiration is configurable; default 7 days.

## D1 Schema

### `admin_users`
- `id`
- `username`
- `password_hash`
- `created_at`
- `updated_at`

### `admin_sessions`
- `id`
- `admin_user_id`
- `token_hash`
- `expires_at`
- `created_at`

### `songs`
- `id`
- `title`
- `artist`
- `album`
- `category_id`
- `audio_type` (`upload` or `external`)
- `audio_url`
- `cover_type` (`upload` or `external`)
- `cover_url`
- `lyrics_lrc`
- `duration_seconds`
- `is_published`
- `sort_order`
- `created_at`
- `updated_at`

### `playlists`
- `id`
- `name`
- `description`
- `cover_url`
- `is_published`
- `created_at`
- `updated_at`

### `playlist_songs`
- `playlist_id`
- `song_id`
- `sort_order`

### `categories`
- `id`
- `name`
- `slug`
- `created_at`
- `updated_at`

## R2 Object Layout

- `audio/<uuid>.<ext>`
- `covers/<uuid>.<ext>`
- `lyrics/<uuid>.lrc`

Uploaded objects receive generated unique names. The database stores their public delivery URL or object path.

## Admin UI

### Login
- Username field
- Password field
- Clear error message for invalid credentials

### Dashboard
- Song count
- Playlist count
- Category count
- Published/unpublished song count

### Songs
- Search/filter songs
- Add song
- Edit song
- Delete song with confirmation
- Publish/unpublish toggle

Song editor fields:
- Song title
- Artist
- Album
- Category
- Playlists
- Audio: upload MP3 or enter external URL
- Cover: upload image or enter external URL
- LRC: paste/edit or upload `.lrc`
- Publish status

### Playlists
- Create/edit/delete
- Name, description, cover
- Reorder songs

### Categories
- Create/edit/delete

## Frontend Changes

- Replace hard-coded song arrays with `/api/songs` fetches.
- Fetch playlists/categories from backend APIs.
- Keep existing player behavior.
- Add synchronized LRC parser and active-line scrolling.
- Gracefully handle missing cover, missing lyrics, or unavailable audio.

## Data Flow

1. Admin logs in.
2. Admin uploads file or enters an external URL.
3. Uploaded file is stored in R2.
4. Song metadata is stored in D1.
5. Published songs are exposed by public API.
6. Frontend fetches songs and playlists at runtime.
7. During playback, parsed LRC timestamps are matched against the audio current time.

## Error Handling

- Validate required song fields before save.
- Restrict upload MIME types.
- Enforce file size limits.
- Return JSON API errors with stable error codes.
- Show upload/save failures in the admin interface.
- Public site hides unpublished songs.
- Broken external URLs do not crash the player; UI shows playback unavailable.

## Security

- Password hashing using a strong standard implementation supported in Workers.
- HttpOnly secure cookies.
- CSRF protection for state-changing admin endpoints.
- Admin route authorization on every request.
- Validate and sanitize user-entered URLs and text.
- Upload whitelist for audio/image/LRC file types.
- No secrets committed to GitHub.

## Deployment Configuration

Cloudflare bindings:
- D1 binding: `DB`
- R2 binding: `MEDIA`

Secrets/config:
- Initial admin username/password bootstrap values or a one-time setup flow
- Session signing/encryption secret if needed by chosen implementation

GitHub repository:
- `yasa706/melody-music`
- branch: `main`

## Testing

Minimum tests:
- Login success/failure
- Session expiry/logout
- Unauthorized admin API rejection
- Song create/edit/delete
- Publish/unpublish visibility
- External audio/cover URLs
- MP3/image/LRC upload validation
- Playlist/category CRUD
- LRC timestamp parsing and active lyric selection
- Frontend fallback when audio or cover is unavailable

## Implementation Order

1. Convert deployment to a Worker project with static assets.
2. Add D1 schema and migrations.
3. Add R2 binding and upload endpoint.
4. Implement admin authentication/session handling.
5. Implement song/category/playlist APIs.
6. Build functional `/admin` UI.
7. Connect public frontend to APIs.
8. Add synchronized LRC lyrics.
9. Add validation, error states, and security hardening.
10. Run deployment and end-to-end verification.

## Acceptance Criteria

The v1 is complete when:
- Admin can log in at `/admin`.
- Admin can create, edit, publish, unpublish, and delete songs.
- Admin can upload MP3/cover/LRC files or use external URLs.
- Admin can manage playlists and categories.
- Public homepage loads published songs from D1-backed APIs.
- Player can play uploaded/external songs.
- LRC lyrics scroll and highlight in sync with playback.
- Unauthenticated users cannot call admin mutation APIs.
- Site deploys successfully from GitHub to Cloudflare.
