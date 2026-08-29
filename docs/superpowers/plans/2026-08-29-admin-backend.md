# Melody Music Admin Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `melody-music` into a Cloudflare Worker application with a single-admin backend, D1 metadata storage, R2 media storage, CRUD management for songs/playlists/categories, public APIs, and synchronized LRC lyrics.

**Architecture:** A Cloudflare Worker serves both static assets and JSON APIs. D1 stores admin/session/content metadata, R2 stores uploaded MP3/images/LRC, and the browser admin UI calls cookie-authenticated `/api/admin/*` endpoints while the public player calls read-only `/api/*` endpoints.

**Tech Stack:** Cloudflare Workers, Wrangler 4, D1, R2, vanilla HTML/CSS/JavaScript, Web Crypto API, Node test runner with Miniflare/Workers-compatible request tests.

**Spec:** `docs/superpowers/specs/2026-08-29-admin-backend-design.md`

## Global Constraints

- GitHub repository: `yasa706/melody-music`, branch `main`.
- D1 binding name: `DB`.
- R2 binding name: `MEDIA`.
- One administrator account only in v1.
- Public listeners do not need accounts.
- Audio and cover sources support both uploaded files and external URLs.
- Lyrics support editable/pasted LRC and `.lrc` upload.
- Admin sessions default to 7 days and use Secure, HttpOnly, SameSite cookies.
- No plaintext passwords or secrets are committed to GitHub.
- Public APIs expose published content only.
- Uploaded media types are whitelisted and size-limited.

---

## File Structure

Create or populate these focused units:

- `package.json` — local scripts and test dependencies.
- `wrangler.jsonc` — Worker entry, static assets, D1/R2 bindings, compatibility date.
- `src/index.js` — top-level request router only.
- `src/http.js` — JSON responses, body parsing, validation helpers, cookie helpers.
- `src/auth.js` — password hashing/verification, session creation/verification/logout, CSRF token validation.
- `src/public-api.js` — public songs/playlists/categories endpoints.
- `src/admin-api.js` — authenticated admin CRUD and dashboard endpoints.
- `src/uploads.js` — R2 upload validation, object naming, deletion helpers.
- `migrations/0001_initial.sql` — D1 schema and indexes.
- `scripts/bootstrap-admin.mjs` — one-time admin password hash generation/bootstrap helper.
- `public/index.html` — public music UI.
- `public/styles.css` — public styles.
- `public/app.js` — API-backed player and LRC sync.
- `public/admin/index.html` — admin shell/login/dashboard.
- `public/admin/admin.css` — admin styles.
- `public/admin/admin.js` — login, CRUD forms, upload, playlist/category management.
- `test/auth.test.js` — authentication/session tests.
- `test/public-api.test.js` — publish visibility and public reads.
- `test/admin-api.test.js` — song/playlist/category CRUD tests.
- `test/uploads.test.js` — MIME/size/path upload validation tests.
- `test/lrc.test.js` — LRC parsing and active-line selection tests.

---

### Task 1: Worker Project Skeleton and Static Asset Delivery

**Files:**
- Create: `package.json`
- Create: `wrangler.jsonc`
- Create: `src/index.js`
- Create: `src/http.js`
- Copy/adapt: `public/index.html`
- Copy/adapt: `public/styles.css`
- Copy/adapt: `public/app.js`
- Test: `test/router.test.js`

**Interfaces:**
- Consumes: none.
- Produces: `fetch(request, env, ctx)` Worker entry and `json(data, status, headers)` response helper.

- [ ] **Step 1: Write the failing router test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('unknown api route returns JSON 404', async () => {
  const res = await worker.fetch(new Request('https://example.com/api/nope'), {}, {});
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: { code: 'NOT_FOUND', message: 'Not found' } });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- test/router.test.js`

Expected: FAIL because `src/index.js` does not exist.

- [ ] **Step 3: Add the minimal Worker router and helper**

`src/http.js`:

```js
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}
```

`src/index.js`:

```js
import { json } from './http.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    }
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
};
```

Create `wrangler.jsonc` with `main: "src/index.js"`, static assets from `./public`, binding `ASSETS`, D1 binding `DB`, and R2 binding `MEDIA`. Do not place account IDs or secrets in the file.

- [ ] **Step 4: Run tests and local static serving check**

Run: `npm test -- test/router.test.js`

Expected: PASS.

Run: `npx wrangler dev`

Expected: `/` serves the public music UI and `/api/nope` returns JSON 404.

- [ ] **Step 5: Commit**

```bash
git add package.json wrangler.jsonc src public test/router.test.js
git commit -m "chore: scaffold cloudflare worker app"
```

---

### Task 2: D1 Schema and Content Persistence

**Files:**
- Create: `migrations/0001_initial.sql`
- Create: `src/db.js`
- Test: `test/db.test.js`

**Interfaces:**
- Consumes: `env.DB` D1 binding.
- Produces: `getSongById(db, id)`, `listPublishedSongs(db)`, `listPlaylists(db, publishedOnly)`, `listCategories(db)`.

- [ ] **Step 1: Write a failing schema/query test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { listPublishedSongs } from '../src/db.js';

test('listPublishedSongs filters drafts and orders by sort_order', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      calls.push(sql);
      return { all: async () => ({ results: [{ id: 2, title: 'Published' }] }) };
    },
  };
  const rows = await listPublishedSongs(db);
  assert.equal(rows[0].title, 'Published');
  assert.match(calls[0], /is_published\s*=\s*1/);
  assert.match(calls[0], /sort_order/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/db.test.js`

Expected: FAIL because `src/db.js` does not exist.

- [ ] **Step 3: Create migration and query module**

`migrations/0001_initial.sql` must create:

```sql
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL DEFAULT '',
  category_id INTEGER,
  audio_type TEXT NOT NULL CHECK (audio_type IN ('upload','external')),
  audio_url TEXT NOT NULL,
  cover_type TEXT NOT NULL CHECK (cover_type IN ('upload','external')),
  cover_url TEXT NOT NULL DEFAULT '',
  lyrics_lrc TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE playlist_songs (
  playlist_id INTEGER NOT NULL,
  song_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (playlist_id, song_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

CREATE INDEX idx_songs_published_sort ON songs(is_published, sort_order, id);
CREATE INDEX idx_sessions_token ON admin_sessions(token_hash);
CREATE INDEX idx_sessions_expiry ON admin_sessions(expires_at);
CREATE INDEX idx_playlist_songs_order ON playlist_songs(playlist_id, sort_order);
```

Implement `src/db.js` with parameterized D1 queries; joins should expose `category_name` and playlist song counts where useful.

- [ ] **Step 4: Run tests and migration locally**

Run: `npm test -- test/db.test.js`

Expected: PASS.

Run: `npx wrangler d1 migrations apply DB --local`

Expected: migration applies without SQL errors.

- [ ] **Step 5: Commit**

```bash
git add migrations src/db.js test/db.test.js
git commit -m "feat: add d1 content schema"
```

---

### Task 3: Single-Admin Password Authentication and Sessions

**Files:**
- Create: `src/auth.js`
- Modify: `src/http.js`
- Modify: `src/index.js`
- Create: `scripts/bootstrap-admin.mjs`
- Test: `test/auth.test.js`

**Interfaces:**
- Consumes: `env.DB`; request cookie `melody_admin_session`.
- Produces: `hashPassword(password)`, `verifyPassword(password, stored)`, `createSession(db, adminId)`, `requireAdmin(request, env)`, `requireCsrf(request, session)`, `handleLogin(request, env)`, `handleLogout(request, env)`.

- [ ] **Step 1: Write failing password/session tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/auth.js';

test('password hash round-trips and does not contain plaintext', async () => {
  const stored = await hashPassword('correct horse battery staple');
  assert.equal(await verifyPassword('correct horse battery staple', stored), true);
  assert.equal(await verifyPassword('wrong', stored), false);
  assert.equal(stored.includes('correct horse battery staple'), false);
});
```

Add request tests for invalid login returning `401 INVALID_CREDENTIALS`, valid login setting `HttpOnly; Secure; SameSite=Strict`, logout deleting the session, and expired sessions returning `401 UNAUTHORIZED`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/auth.test.js`

Expected: FAIL because auth functions/routes are absent.

- [ ] **Step 3: Implement password hashing and session flow**

Use Web Crypto PBKDF2-SHA-256 with a random 16-byte salt and 310,000 iterations, encoded as:

```text
pbkdf2-sha256$310000$<base64-salt>$<base64-derived-key>
```

Create 32-byte random session tokens, store only `SHA-256(token)` in D1, set raw token in `melody_admin_session`, default expiry 7 days, and create a random CSRF token stored with the session. `GET /api/admin/session` returns `{ authenticated: true, csrfToken, username }` for valid sessions.

`scripts/bootstrap-admin.mjs` accepts username/password from environment variables `MELODY_ADMIN_USERNAME` and `MELODY_ADMIN_PASSWORD`, hashes the password using the same format, and prints the SQL insert/update statement rather than embedding credentials in source.

- [ ] **Step 4: Run auth tests**

Run: `npm test -- test/auth.test.js`

Expected: PASS for success, failure, expiry, and logout cases.

- [ ] **Step 5: Commit**

```bash
git add src/auth.js src/http.js src/index.js scripts/bootstrap-admin.mjs test/auth.test.js
git commit -m "feat: add single admin authentication"
```

---

### Task 4: R2 Upload Pipeline

**Files:**
- Create: `src/uploads.js`
- Modify: `src/admin-api.js` or create it if not yet present
- Modify: `src/index.js`
- Test: `test/uploads.test.js`

**Interfaces:**
- Consumes: authenticated request, `env.MEDIA` R2 binding, multipart field `file`, query/body field `kind` in `audio|cover|lyrics`.
- Produces: `validateUpload(file, kind)`, `storeUpload(bucket, file, kind)`, `DELETE /api/admin/upload?key=...`, `POST /api/admin/upload` returning `{ key, url, contentType, size }`.

- [ ] **Step 1: Write failing validation tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUpload } from '../src/uploads.js';

test('audio upload accepts mp3 and rejects executable data', () => {
  assert.doesNotThrow(() => validateUpload({ type: 'audio/mpeg', size: 1024, name: 'a.mp3' }, 'audio'));
  assert.throws(() => validateUpload({ type: 'application/x-msdownload', size: 1024, name: 'a.exe' }, 'audio'));
});
```

Also test limits: audio 50 MiB, cover 8 MiB, LRC 1 MiB; allowed covers `image/jpeg`, `image/png`, `image/webp`; lyrics `text/plain`, `application/octet-stream` only when extension is `.lrc`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- test/uploads.test.js`

Expected: FAIL because `src/uploads.js` does not exist.

- [ ] **Step 3: Implement validation and R2 storage**

Object keys:

```text
audio/<crypto.randomUUID()>.mp3
covers/<crypto.randomUUID()>.<jpg|png|webp>
lyrics/<crypto.randomUUID()>.lrc
```

Store `httpMetadata.contentType`. Return a delivery URL through `/media/<encoded-key>` handled by the Worker so a separate public R2 domain is not required. `/media/*` reads the object from `env.MEDIA`, returns its content type, `Accept-Ranges: bytes`, and `Cache-Control: public, max-age=86400`.

- [ ] **Step 4: Run upload tests**

Run: `npm test -- test/uploads.test.js`

Expected: PASS for valid uploads, MIME rejection, size rejection, and generated path prefixes.

- [ ] **Step 5: Commit**

```bash
git add src/uploads.js src/admin-api.js src/index.js test/uploads.test.js
git commit -m "feat: add r2 media uploads"
```

---

### Task 5: Song CRUD and Publish Visibility

**Files:**
- Create/Modify: `src/admin-api.js`
- Create: `src/public-api.js`
- Modify: `src/db.js`
- Modify: `src/index.js`
- Test: `test/admin-api.test.js`
- Test: `test/public-api.test.js`

**Interfaces:**
- Consumes: authenticated admin session + CSRF for mutations; `env.DB`.
- Produces: `GET/POST /api/admin/songs`, `GET/PUT/DELETE /api/admin/songs/:id`, `GET /api/songs`, `GET /api/songs/:id`.

- [ ] **Step 1: Write failing song API tests**

Create tests that assert:

```js
assert.equal((await unauthenticatedPost()).status, 401);
assert.equal((await createSong({ title: '', artist: 'A' })).status, 400);
assert.equal((await createValidSong()).status, 201);
assert.equal((await updateSong()).status, 200);
assert.equal((await deleteSong()).status, 204);
```

Public list must exclude `is_published = 0` and include `audio_url`, `cover_url`, `lyrics_lrc`, `duration_seconds`, and category metadata for published rows.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- test/admin-api.test.js test/public-api.test.js`

Expected: FAIL because CRUD routes are not implemented.

- [ ] **Step 3: Implement song validation and CRUD**

Required fields: `title`, `artist`, `audio_type`, `audio_url`, `cover_type`.

Validation rules:

```js
const AUDIO_TYPES = new Set(['upload', 'external']);
const COVER_TYPES = new Set(['upload', 'external']);
```

For `external` URLs accept only `https:` or `http:`. Trim text fields. Coerce `is_published` to `0|1`, `duration_seconds` and `sort_order` to non-negative integers. Replace playlist memberships transactionally after song updates.

All POST/PUT/DELETE admin endpoints call `requireAdmin` and `requireCsrf`.

- [ ] **Step 4: Run song API tests**

Run: `npm test -- test/admin-api.test.js test/public-api.test.js`

Expected: PASS, including draft exclusion from public APIs.

- [ ] **Step 5: Commit**

```bash
git add src/admin-api.js src/public-api.js src/db.js src/index.js test/admin-api.test.js test/public-api.test.js
git commit -m "feat: add song management api"
```

---

### Task 6: Category and Playlist CRUD

**Files:**
- Modify: `src/admin-api.js`
- Modify: `src/public-api.js`
- Modify: `src/db.js`
- Test: `test/admin-api.test.js`
- Test: `test/public-api.test.js`

**Interfaces:**
- Consumes: same auth/CSRF helpers as Task 5.
- Produces: admin CRUD for `/api/admin/categories` and `/api/admin/playlists`; public `GET /api/categories` and `GET /api/playlists`.

- [ ] **Step 1: Add failing category/playlist tests**

Test exact behaviors:

```js
// categories
POST { name: 'Worship', slug: 'worship' } -> 201
POST duplicate slug -> 409 DUPLICATE_SLUG
DELETE category -> 204 and songs retain with category_id NULL

// playlists
POST { name: 'Morning', description: '...', cover_url: '', is_published: true, song_ids: [3,1] } -> 201
PUT playlist with song_ids [1,3] -> membership order changes
GET public playlists -> unpublished playlists excluded
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- test/admin-api.test.js test/public-api.test.js`

Expected: FAIL on missing routes.

- [ ] **Step 3: Implement CRUD and ordering**

Use slug validation `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`. Playlist song replacement deletes old `playlist_songs` rows then inserts each supplied song ID with its array index as `sort_order`.

- [ ] **Step 4: Run API tests**

Run: `npm test -- test/admin-api.test.js test/public-api.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin-api.js src/public-api.js src/db.js test/admin-api.test.js test/public-api.test.js
git commit -m "feat: add playlist and category management"
```

---

### Task 7: Admin Dashboard and Content Editor UI

**Files:**
- Create/Replace: `public/admin/index.html`
- Create: `public/admin/admin.css`
- Create: `public/admin/admin.js`

**Interfaces:**
- Consumes: `/api/admin/login`, `/api/admin/logout`, `/api/admin/session`, `/api/admin/dashboard`, `/api/admin/songs`, `/api/admin/playlists`, `/api/admin/categories`, `/api/admin/upload`.
- Produces: usable `/admin` login/dashboard CRUD experience.

- [ ] **Step 1: Define a manual failing acceptance checklist before implementation**

At `/admin` before code is added:

```text
[FAIL] unauthenticated visitor sees login form
[FAIL] successful login reveals dashboard
[FAIL] song form can switch between upload and external URL
[FAIL] cover form can switch between upload and external URL
[FAIL] LRC can be pasted or uploaded
[FAIL] song can be created, edited, published/unpublished, deleted
[FAIL] playlists/categories can be created, edited, deleted
[FAIL] API errors appear inline without page crash
```

- [ ] **Step 2: Implement login/session shell**

`admin.js` starts with `GET /api/admin/session`. On `401`, render login; on success, keep the returned `csrfToken` in memory only. All mutation requests include header `x-csrf-token: <token>`.

- [ ] **Step 3: Implement dashboard and songs editor**

Dashboard cards show total songs, published, drafts, playlists, categories. Song modal/form fields exactly match the design spec, including multi-select playlist membership and publish toggle.

- [ ] **Step 4: Implement uploads and management panels**

Upload buttons POST `FormData` with `file` and `kind`. After successful upload, write returned `url` into the song form. LRC file upload reads returned media URL only for archive/reference and also loads the file text into `lyrics_lrc` before save so playback does not require a second network fetch.

- [ ] **Step 5: Run local manual acceptance checklist**

Run: `npx wrangler dev`

Expected: every checklist item changes from FAIL to PASS using local D1/R2 bindings.

- [ ] **Step 6: Commit**

```bash
git add public/admin
git commit -m "feat: build admin management interface"
```

---

### Task 8: Public API-Backed Player and LRC Synchronization

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Create: `src/lrc.js`
- Test: `test/lrc.test.js`

**Interfaces:**
- Consumes: `GET /api/songs`, `GET /api/playlists`, `GET /api/categories`.
- Produces: `parseLrc(text) -> Array<{ time: number, text: string }>` and `activeLyricIndex(lines, seconds) -> number`.

- [ ] **Step 1: Write failing LRC tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc, activeLyricIndex } from '../src/lrc.js';

test('parses multiple timestamps and selects active lyric', () => {
  const lines = parseLrc('[00:01.50]Hello\n[00:05.00][00:08.00]World');
  assert.deepEqual(lines.map(x => x.time), [1.5, 5, 8]);
  assert.equal(activeLyricIndex(lines, 6), 1);
});
```

- [ ] **Step 2: Run LRC test to verify failure**

Run: `npm test -- test/lrc.test.js`

Expected: FAIL because `src/lrc.js` does not exist.

- [ ] **Step 3: Implement LRC parser**

Support timestamps `[mm:ss]`, `[mm:ss.xx]`, `[mm:ss.xxx]`, multiple timestamps per line, blank lyric text, and ignore metadata tags such as `[ar:]`, `[ti:]`, `[by:]`.

- [ ] **Step 4: Replace hard-coded public data**

`public/app.js` fetches API data on load. Empty/loading/error states are rendered explicitly. Playback errors set the current item status to `无法播放` and keep the rest of the UI functional. Missing covers use a local CSS-generated placeholder rather than a broken `<img>`.

- [ ] **Step 5: Add synchronized lyric pane**

On `timeupdate`, call `activeLyricIndex`; add `.active` to the matching line and call `scrollIntoView({ block: 'center', behavior: 'smooth' })` only when the active index changes.

- [ ] **Step 6: Run automated and manual tests**

Run: `npm test -- test/lrc.test.js`

Expected: PASS.

Run: `npx wrangler dev`

Expected: published songs load from D1 and LRC lines highlight in sync.

- [ ] **Step 7: Commit**

```bash
git add public src/lrc.js test/lrc.test.js
git commit -m "feat: connect player to api and sync lyrics"
```

---

### Task 9: Security Hardening and Stable API Errors

**Files:**
- Modify: `src/http.js`
- Modify: `src/auth.js`
- Modify: `src/admin-api.js`
- Modify: `src/uploads.js`
- Modify: `src/index.js`
- Test: `test/security.test.js`

**Interfaces:**
- Consumes: all existing API handlers.
- Produces: stable error shape `{ error: { code, message } }`, origin checks, CSRF enforcement, safe headers.

- [ ] **Step 1: Write failing security tests**

Tests must verify:

```text
mutation without CSRF -> 403 CSRF_INVALID
mutation with wrong Origin -> 403 ORIGIN_FORBIDDEN
external javascript: URL -> 400 INVALID_URL
oversized multipart -> 413 FILE_TOO_LARGE
unknown server exception -> 500 INTERNAL_ERROR without stack trace
all API responses include X-Content-Type-Options: nosniff
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- test/security.test.js`

Expected: at least one security assertion fails.

- [ ] **Step 3: Add centralized error and origin handling**

Add `ApiError` with `status`, `code`, `message`; top-level API router catches it and serializes the stable shape. For state-changing admin methods, require `Origin` to match `new URL(request.url).origin` when the header is present. Add `Cache-Control: no-store` to admin/session responses.

- [ ] **Step 4: Run complete test suite**

Run: `npm test`

Expected: PASS with zero failed tests.

- [ ] **Step 5: Commit**

```bash
git add src test/security.test.js
git commit -m "fix: harden admin api security"
```

---

### Task 10: Cloudflare Deployment Setup and End-to-End Verification

**Files:**
- Modify: `README.md`
- Verify: `wrangler.jsonc`
- Verify: `migrations/0001_initial.sql`

**Interfaces:**
- Consumes: complete application and Cloudflare account resources.
- Produces: reproducible deployment instructions and a verified production deployment.

- [ ] **Step 1: Document exact Cloudflare provisioning commands**

README must include:

```bash
npx wrangler d1 create melody-music-db
npx wrangler r2 bucket create melody-music-media
npx wrangler d1 migrations apply DB --remote
MELODY_ADMIN_USERNAME=admin MELODY_ADMIN_PASSWORD='<strong-password>' node scripts/bootstrap-admin.mjs
```

Then explain running the generated SQL with `wrangler d1 execute DB --remote --command "..."` and replacing the placeholder D1 `database_id` in `wrangler.jsonc` with the value Cloudflare returns.

- [ ] **Step 2: Verify deployment configuration locally**

Run: `npx wrangler deploy --dry-run`

Expected: Worker bundles successfully and lists bindings `DB`, `MEDIA`, and static assets.

- [ ] **Step 3: Run the complete test suite immediately before deployment**

Run: `npm test`

Expected: PASS with zero failed tests.

- [ ] **Step 4: Deploy and smoke test production**

Run: `npx wrangler deploy`

Verify in browser/API:

```text
GET / -> 200
GET /api/songs -> 200 JSON
GET /admin -> 200
POST /api/admin/login with wrong password -> 401
POST /api/admin/login with correct password -> 200 + secure cookie
create a draft song -> visible in admin, absent from /api/songs
publish the song -> appears in /api/songs
upload MP3/cover/LRC -> playable/rendered/synchronized
logout -> subsequent admin mutation returns 401
```

- [ ] **Step 5: Commit deployment documentation**

```bash
git add README.md wrangler.jsonc
git commit -m "docs: add cloudflare deployment guide"
```
