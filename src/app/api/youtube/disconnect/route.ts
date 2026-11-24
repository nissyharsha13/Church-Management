import { GOOGLE, readSession, writeSession } from "@/lib/youtube/server";

export async function POST() {
  const s = await readSession();
  if (s) {
    // Best effort: revoke at Google so the token can't be reused.
    await fetch(GOOGLE.revokeUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: s.refreshToken }) }).catch(() => {});
  }
  await writeSession(null);
  return Response.json({ ok: true });
}
