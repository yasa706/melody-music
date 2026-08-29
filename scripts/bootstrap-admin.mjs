import { hashPassword } from '../src/auth.js';

const username = process.env.MELODY_ADMIN_USERNAME;
const password = process.env.MELODY_ADMIN_PASSWORD;
if (!username || !password) {
  console.error('Set MELODY_ADMIN_USERNAME and MELODY_ADMIN_PASSWORD.');
  process.exit(1);
}
if (password.length < 12) {
  console.error('Use a password with at least 12 characters.');
  process.exit(1);
}
const hash = await hashPassword(password);
const esc = value => String(value).replaceAll("'", "''");
console.log(`INSERT INTO admin_users (username, password_hash) VALUES ('${esc(username)}', '${esc(hash)}') ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, updated_at=CURRENT_TIMESTAMP;`);
