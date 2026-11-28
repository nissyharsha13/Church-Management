// End-to-end test of YouTube + OBS streaming against local mocks.
// Starts its own `next start` (port 3101) with the Google endpoints pointed at the mocks.
// Usage: npm run build && E2E_PASSWORD='<admin password>' npm run test:e2e:stream [screenshot-dir]
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { startMocks } = require("./mocks.cjs");

const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const OUT = process.argv[2] || path.join(__dirname, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) process.exitCode = 1; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const PASS = process.env.E2E_PASSWORD;
  if (!PASS) throw new Error("Set E2E_PASSWORD");
  const mocks = startMocks();
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: path.join(__dirname, "../.."),
    env: {
      ...process.env,
      GOOGLE_CLIENT_ID: "test-client",
      GOOGLE_CLIENT_SECRET: "test-secret",
      GOOGLE_OAUTH_BASE: "http://localhost:3201/auth",
      GOOGLE_TOKEN_URL: "http://localhost:3201/token",
      GOOGLE_REVOKE_URL: "http://localhost:3201/revoke",
      YOUTUBE_API_BASE: "http://localhost:3201/youtube/v3",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group, so cleanup also stops next-server
  });
  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/login`)).ok) break; } catch { /* starting */ }
    await wait(500);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    // Sign in
    await page.goto(`${BASE}/login?next=/settings`);
    await page.getByLabel("Username").fill(process.env.E2E_USERNAME || "admin");
    await page.getByLabel("Password").fill(PASS);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/settings/);

    // 1. Connect YouTube (mock Google sign-in)
    await page.getByTestId("youtube-connect").click();
    await page.getByTestId("youtube-channel").waitFor({ timeout: 10000 });
    ok((await page.getByTestId("youtube-channel").innerText()) === "Divine Church Test", "YouTube channel connects via Google sign-in");
    ok(/connected/i.test(await page.getByTestId("youtube-card").innerText()), "settings confirms the connection");
    await page.waitForTimeout(500);
    await page.reload();
    await page.locator("#ytUrl").waitFor();
    ok((await page.locator("#ytUrl").inputValue()) === "https://www.youtube.com/@divinetest", "channel link auto-filled for the welcome-screen QR code");
    const cookie = (await ctx.cookies()).find((c) => c.name === "cm_youtube");
    ok(cookie && cookie.httpOnly && !cookie.value.includes("rt-1"), "YouTube tokens stored encrypted in an httpOnly cookie");

    // 2. Permanent stream key
    await page.getByTestId("youtube-key").click();
    await page.getByTestId("ingest-server").waitFor();
    ok((await page.getByTestId("ingest-server").innerText()).startsWith("rtmps://"), "permanent stream key + server shown (key masked)");
    ok(!(await page.getByTestId("ingest-key").innerText()).includes("test-stream-key"), "stream key is masked by default");

    // 3. OBS on this computer
    await page.getByLabel("OBS address").fill("ws://127.0.0.1:3202");
    await page.getByTestId("obs-test").click();
    await page.getByTestId("obs-status").getByText(/Connected — 3 scenes, 2 audio inputs/).waitFor({ timeout: 8000 });
    ok(true, "OBS connects; scenes and audio inputs detected");
    await page.getByTestId("obs-send-key").click();
    await page.getByText(/YouTube key loaded into OBS/).waitFor({ timeout: 8000 });
    ok(mocks.state.obsStreamSettings?.key === "test-stream-key-1234", "YouTube key pushed into OBS stream settings");
    await page.screenshot({ path: `${OUT}/s1-settings-streaming.png`, fullPage: true });

    // 4. Schedule a broadcast from the sermon editor
    await page.goto(`${BASE}/`);
    await page.getByRole("button", { name: /sample sermon/i }).click();
    await page.getByRole("link", { name: /Faith in the Storm/ }).first().click();
    await page.getByTestId("create-broadcast").click();
    await page.getByTestId("broadcast-link").waitFor({ timeout: 8000 });
    ok(mocks.state.broadcast?.snippet.title.includes("Faith in the Storm | Divine Church"), "broadcast created with the sermon title");
    ok(/Mark 4:35-38/.test(mocks.state.description) && /Manikonda/.test(mocks.state.description), "broadcast description has verses and church details");
    await page.waitForTimeout(900);

    // 5. Console: OBS auto-connects, scenes + mics
    await page.getByRole("button", { name: /Save & Start now/ }).click();
    await page.waitForURL(/\/present\//);
    const panel = page.getByTestId("stream-panel");
    await panel.getByTestId("obs-scene").first().waitFor({ timeout: 10000 });
    ok(await panel.getByTestId("obs-scene").count() === 3, "console shows OBS scenes as buttons");
    await panel.getByTestId("obs-scene").filter({ hasText: "Wide cam" }).click();
    await wait(400);
    ok(mocks.state.scene === "Wide cam", "switching camera scene from the console changes OBS");
    await panel.getByRole("button", { name: "Mute Pulpit mic" }).click();
    await wait(400);
    ok(mocks.state.muted["Pulpit mic"] === true, "muting a mic from the console mutes it in OBS");
    await wait(300);
    ok(await panel.getByTestId("obs-audio").count() === 2, "console lists mics with level meters");
    await panel.getByTestId("obs-preview").locator("img").waitFor({ timeout: 8000 });
    ok(true, "console shows what OBS is sending to YouTube");
    await panel.getByTestId("obs-black-warning").waitFor({ timeout: 8000 });
    ok(true, "console warns when OBS is sending a black picture");

    // 6. Go live
    await panel.getByTestId("go-live").click();
    await panel.getByText("LIVE", { exact: true }).first().waitFor({ timeout: 30000 });
    for (let i = 0; i < 40 && mocks.state.broadcast.status.lifeCycleStatus !== "live"; i++) await wait(500);
    ok(mocks.state.obsStreaming && mocks.state.broadcast.status.lifeCycleStatus === "live", "Go live starts OBS and takes the YouTube broadcast live");
    await panel.getByText("7").first().waitFor({ timeout: 15000 });
    ok(true, "live viewer count shown");
    await page.screenshot({ path: `${OUT}/s2-console-live.png` });

    // Show things on screen so there is something to make chapters from.
    await page.getByTestId("console-verse").nth(0).click();
    await wait(11000);
    await page.getByTestId("console-verse").nth(1).click();
    await wait(11000);
    await page.getByTestId("btn-prayer").click();
    await wait(1500);

    // 7. End stream -> YouTube complete, OBS stopped, chapters written
    page.once("dialog", (d) => d.accept());
    await panel.getByTestId("end-stream").click();
    await panel.getByText("ENDED", { exact: true }).waitFor({ timeout: 20000 });
    ok(mocks.state.broadcast.status.lifeCycleStatus === "complete" && !mocks.state.obsStreaming, "End stream completes the broadcast and stops OBS");
    const chapters = mocks.state.description.split("— Chapters · అధ్యాయాలు —")[1] || "";
    ok(/0:00 Welcome/.test(chapters) && chapters.trim().split("\n").length >= 3, "chapters added to the YouTube description from what was shown");
    console.log(chapters.trim().split("\n").slice(0, 5).map((l) => `      ${l}`).join("\n"));

    // 8. Go live again after the broadcast ended: an ended broadcast can't restart,
    //    so the console must create a fresh one instead of waiting on the old one.
    const firstId = mocks.state.broadcast.id;
    await panel.getByTestId("go-live").click();
    await panel.getByText("LIVE", { exact: true }).first().waitFor({ timeout: 30000 });
    for (let i = 0; i < 40 && mocks.state.broadcast.status.lifeCycleStatus !== "live"; i++) await wait(500);
    ok(mocks.state.broadcast.id !== firstId && mocks.state.broadcast.status.lifeCycleStatus === "live", "Go live after an ended stream creates a new broadcast and goes live");
    page.once("dialog", (d) => d.accept());
    await panel.getByTestId("end-stream").click();
    await panel.getByText("ENDED", { exact: true }).waitFor({ timeout: 20000 });
  } catch (e) {
    console.log("FAIL  " + e.message.split("\n")[0]);
    process.exitCode = 1;
    await page.screenshot({ path: `${OUT}/s-error.png` }).catch(() => {});
    if (process.env.DEBUG) console.log(serverLog.slice(-3000));
  } finally {
    ok(errors.length === 0, `no page errors ${errors.join(" | ")}`);
    await browser.close();
    try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill(); }
    mocks.close();
    setTimeout(() => process.exit(process.exitCode ?? 0), 500);
  }
})();
