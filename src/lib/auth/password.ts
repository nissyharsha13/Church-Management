import "server-only";
import { scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashes look like: scrypt.<N>.<r>.<p>.<saltB64>.<hashB64>
 * (dots, not "$": .env files expand "$NAME", which would corrupt the hash)
 * Generate one with: npm run auth:hash -- '<password>'
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.trim().split(".");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = await new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, expected.length, { N: +N, r: +r, p: +p, maxmem: 256 * 1024 * 1024 }, (err, buf) => (err ? reject(err) : resolve(buf))),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Constant-time string comparison (for the username). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function adminConfig() {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  return username && passwordHash ? { username, passwordHash } : null;
}
