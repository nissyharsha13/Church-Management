// End-to-end smoke test: planner -> console -> display window.
// Usage: npm run build && npm start -- -p 3100   (in another terminal)
//        npm run test:e2e [screenshot-dir] [deviceScaleFactor]
// Uses fake camera + fixtures; run against a fresh browser profile.
const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const FIX = path.join(__dirname, "fixtures");
const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = process.argv[2] || path.join(__dirname, "screenshots");
const scale = Number(process.argv[3] || 1);
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale, permissions: ["camera"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("console page: " + e.message));
  const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) process.exitCode = 1; };

  // 1. Dashboard + sample sermon
  await page.goto(BASE + "/");
  await page.getByRole("button", { name: /sample sermon/i }).click();
  await page.getByText("Faith in the Storm").first().waitFor();
  ok(true, "sample sermon created");
  await page.screenshot({ path: `${OUT}/1-dashboard.png` });

  // 2. Editor: add a verse by typing a Telugu reference
  await page.getByRole("link", { name: /Faith in the Storm/ }).first().click();
  await page.getByLabel("Topic / title").waitFor();
  const firstPoint = page.getByTestId("point").first();
  await firstPoint.getByRole("button", { name: /Add verse/ }).first().click();
  await firstPoint.getByLabel("Add verse").fill("రోమా 8:28");
  await page.getByText("సమస్తమును").first().waitFor({ timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/2-editor.png`, fullPage: false });
  await firstPoint.getByLabel("Add verse").press("Enter");
  await page.waitForTimeout(900); // autosave debounce
  ok((await firstPoint.getByTestId("verse-cue").allInnerTexts()).some((t) => t.includes("8:28")), "Telugu reference added to pointer 1");

  // 3. Console
  await page.getByRole("button", { name: /^Start$/ }).click();
  await page.waitForURL(/\/present\//);
  await page.getByTestId("console-verse").first().waitFor();

  // 4. Open display window
  const [display] = await Promise.all([ctx.waitForEvent("page"), page.getByTestId("open-screen").click()]);
  display.on("pageerror", (e) => errors.push("display: " + e.message));
  await display.setViewportSize({ width: 1280, height: 720 });
  await display.getByTestId("start-screen").click();
  await page.getByText("Screen connected").waitFor({ timeout: 8000 });
  ok(true, "console sees screen as connected");

  // 5. Show first verse (Mark 4:35-38)
  await page.getByTestId("console-verse").first().click();
  await display.getByText("మార్కు").first().waitFor({ timeout: 8000 });
  const dText = await display.locator("body").innerText();
  ok(/Mark 4:35/.test(dText) && /మార్కు/.test(dText), "display shows Telugu + English verse with references");
  await page.screenshot({ path: `${OUT}/3-console.png` });
  await display.screenshot({ path: `${OUT}/4-display-verse.png` });

  // 6. Language toggle: Telugu only
  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "IRV", exact: true }).click();
  await display.waitForTimeout(400);
  const teOnly = await display.locator("body").innerText();
  ok(!/Mark 4:35/.test(teOnly) && /మార్కు/.test(teOnly), "Telugu-only mode hides English");
  await display.screenshot({ path: `${OUT}/5-display-telugu-only.png` });
  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: /Both/ }).click();

  // 7. Long passage paging (Psalm 23 in general section) + clicker key
  await page.getByTestId("console-verse").filter({ hasText: "Psalms 23" }).click();
  await display.getByText("Psalms 23").first().waitFor({ timeout: 5000 });
  const before = await display.locator("body").innerText();
  await page.keyboard.press("PageDown");
  await display.waitForTimeout(400);
  const after = await display.locator("body").innerText();
  ok(before !== after && /2\/\d/.test(after), "PageDown (clicker) advances to the next slide");

  // 8. Quick verse
  await page.getByLabel("Quick verse").fill("John 3:16");
  await page.getByLabel("Quick verse").press("Enter");
  await display.getByText(/For God so loved/).waitFor({ timeout: 5000 });
  ok(true, "quick verse (unplanned) shows on display");

  // 9. Blank / logo / camera
  await page.getByTestId("btn-blank").click();
  await display.waitForTimeout(300);
  ok(!(await display.locator("body").innerText()).includes("For God"), "Blank clears the screen");
  await page.getByRole("button", { name: /Enable camera/ }).click();
  await page.getByRole("button", { name: /^Camera$/ }).first().click();
  await display.waitForTimeout(1500);
  ok(await display.locator("video").count() > 0, "camera feed shown on display");
  await page.getByLabel("Quick verse").fill("Psalm 46:1");
  await page.getByLabel("Quick verse").press("Enter");
  await display.waitForTimeout(800);
  await display.screenshot({ path: `${OUT}/6-display-overlay-camera.png` });
  await page.screenshot({ path: `${OUT}/7-console-camera.png` });

  // 10. Reload the display: it must recover the current scene
  await display.reload();
  await display.getByTestId("start-screen").click();
  await display.waitForTimeout(800);
  ok((await display.locator("body").innerText()).includes("46"), "display recovers state after reload");

  // 11. Media: upload video + image, add YouTube, attach to sermon, play from console
  const lib = await ctx.newPage();
  lib.on("pageerror", (e) => errors.push("library: " + e.message));
  await lib.goto(BASE + "/library");
  await lib.getByTestId("upload").setInputFiles([path.join(FIX, "clip.webm"), path.join(FIX, "cross.png")]);
  await lib.getByText("clip").first().waitFor();
  await lib.getByLabel("YouTube URL").fill("https://youtu.be/dQw4w9WgXcQ?t=10");
  await lib.getByLabel("Title").fill("Storm clip (YouTube)");
  await lib.getByLabel("Start (m:ss)").fill("0:10");
  await lib.getByRole("button", { name: "Add", exact: true }).click();
  await lib.getByText("Storm clip (YouTube)").waitFor();
  await lib.screenshot({ path: `${OUT}/8-library.png` });
  const sermonUrl = page.url().replace("/present/", "/sermons/");
  await lib.goto(sermonUrl);
  const p2 = lib.getByTestId("point").nth(1);
  await p2.getByRole("button", { name: /Add from library/ }).click();
  for (const name of ["clip", "cross", "Storm clip (YouTube)"]) await p2.getByRole("button", { name, exact: true }).click();
  await lib.waitForTimeout(1000);
  await lib.close();
  await page.waitForTimeout(500);
  ok(await page.getByTestId("console-media").count() === 3, "console lists 3 attached media (live update from planner)");

  await page.getByTestId("console-media").filter({ has: page.getByText("clip", { exact: true }) }).first().click();
  await display.locator("video[src^='blob:']").waitFor({ timeout: 5000 });
  await page.waitForTimeout(1500);
  const status = (await page.locator("body").innerText()).includes("/ 0:04") ? 1 : 0;
  ok(status > 0, "video plays on display and reports progress to console");
  await page.screenshot({ path: `${OUT}/9-console-video.png` });
  await page.getByRole("button", { name: "Pause" }).first().click().catch(() => {});
  await page.waitForTimeout(4000);
  ok(await display.locator("video[src^='blob:']").count() === 1, "pause keeps the video on screen");
  await page.getByTestId("console-media").filter({ has: page.getByText("clip", { exact: true }) }).first().click();
  await page.waitForTimeout(5500);
  ok(await display.locator("video[src^='blob:']").count() === 0, "after the clip ends the display returns to background");

  await page.getByTestId("console-media").filter({ hasText: "cross" }).click();
  await display.locator("img[src^='blob:']").waitFor({ timeout: 5000 });
  ok(true, "image shows on display");
  await page.getByTestId("console-media").filter({ hasText: "YouTube" }).click();
  await display.locator("iframe[src*='youtube']").waitFor({ timeout: 5000 });
  ok((await display.locator("iframe").getAttribute("src")).includes("start=10"), "YouTube embed starts at the trim point");

  ok(errors.length === 0, `no page errors ${errors.join(" | ")}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

