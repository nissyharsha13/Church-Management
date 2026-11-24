/**
 * AES-GCM encryption for the YouTube token cookie, keyed from AUTH_SECRET.
 * The refresh token never reaches client-side JavaScript in readable form.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`youtube-tokens:${secret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(data: unknown, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), enc.encode(JSON.stringify(data))));
  return `${b64url(iv)}.${b64url(ct)}`;
}

export async function unseal<T>(token: string | undefined, secret: string): Promise<T | null> {
  if (!token) return null;
  const [iv, ct] = token.split(".");
  if (!iv || !ct) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(iv) }, await key(secret), fromB64url(ct));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    return null;
  }
}
