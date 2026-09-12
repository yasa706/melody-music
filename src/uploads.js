const LIMITS = { audio: 50 * 1024 * 1024, cover: 8 * 1024 * 1024, lyrics: 1 * 1024 * 1024 };
const AUDIO_FORMATS = new Map([
  ['mp3', new Set(['audio/mpeg', 'audio/mp3'])],
  ['m4a', new Set(['audio/mp4', 'audio/x-m4a', 'video/mp4'])],
  ['aac', new Set(['audio/aac', 'audio/x-aac'])],
  ['wav', new Set(['audio/wav', 'audio/x-wav', 'audio/wave'])],
  ['ogg', new Set(['audio/ogg', 'application/ogg'])],
  ['opus', new Set(['audio/opus', 'audio/ogg', 'application/ogg'])],
  ['flac', new Set(['audio/flac', 'audio/x-flac'])],
]);
const COVER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LYRICS_MIME = new Set(['text/plain', 'application/octet-stream']);

export class UploadError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function validateUpload(file, kind) {
  if (!file || typeof file.size !== 'number') throw new UploadError(400, 'FILE_REQUIRED', 'File is required');
  if (!LIMITS[kind]) throw new UploadError(400, 'INVALID_UPLOAD_KIND', 'Invalid upload kind');
  if (file.size > LIMITS[kind]) throw new UploadError(413, 'FILE_TOO_LARGE', 'File is too large');
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  if (kind === 'audio') {
    const ext = name.includes('.') ? name.split('.').pop() : '';
    const allowedMime = AUDIO_FORMATS.get(ext);
    if (!allowedMime || !allowedMime.has(type)) {
      throw new UploadError(415, 'INVALID_FILE_TYPE', 'Supported audio formats: MP3, M4A, AAC, WAV, OGG, Opus, FLAC');
    }
  }
  if (kind === 'cover' && !COVER_MIME.has(type)) throw new UploadError(415, 'INVALID_FILE_TYPE', 'Only JPEG, PNG or WebP images are allowed');
  if (kind === 'lyrics' && !(LYRICS_MIME.has(type) && name.endsWith('.lrc'))) throw new UploadError(415, 'INVALID_FILE_TYPE', 'Only LRC lyrics are allowed');
  return true;
}

function extFor(file, kind) {
  if (kind === 'audio') {
    const name = String(file.name || '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    return AUDIO_FORMATS.has(ext) ? ext : 'mp3';
  }
  if (kind === 'lyrics') return 'lrc';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export function makeObjectKey(file, kind) {
  const prefix = kind === 'cover' ? 'covers' : kind;
  return `${prefix}/${crypto.randomUUID()}.${extFor(file, kind)}`;
}

function resolveBucket(bucketOrEnv) {
  const bucket = bucketOrEnv?.put ? bucketOrEnv : bucketOrEnv?.MEDIA;
  if (!bucket?.put || !bucket?.get || !bucket?.delete) {
    throw new UploadError(500, 'MEDIA_BUCKET_UNAVAILABLE', 'Media storage is unavailable');
  }
  return bucket;
}

export async function storeUpload(bucketOrEnv, file, kind) {
  validateUpload(file, kind);
  const bucket = resolveBucket(bucketOrEnv);
  const key = makeObjectKey(file, kind);
  await bucket.put(key, file.stream ? file.stream() : file, { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
  const publicPath = key.split('/').map(encodeURIComponent).join('/');
  return { key, url: `/media/${publicPath}`, contentType: file.type || 'application/octet-stream', size: file.size };
}

export async function deleteUpload(bucketOrEnv, key) {
  if (!key || key.includes('..')) throw new UploadError(400, 'INVALID_KEY', 'Invalid media key');
  const bucket = resolveBucket(bucketOrEnv);
  await bucket.delete(key);
}

export async function serveMedia(request, env, encodedKey) {
  let key;
  try { key = decodeURIComponent(encodedKey); } catch { return new Response('Bad request', { status: 400 }); }
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });
  const bucket = resolveBucket(env);
  const object = await bucket.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  if (!headers.has('content-type') && object.httpMetadata?.contentType) headers.set('content-type', object.httpMetadata.contentType);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'public, max-age=86400');
  if (object.etag) headers.set('etag', object.etag);
  return new Response(object.body, { headers });
}
