// End-to-end smoke test: planner -> console -> display window.
// Usage: npm run build && npm start -- -p 3100   (in another terminal, with .env.local)
//        E2E_PASSWORD='<admin password>' npm run test:e2e [screenshot-dir] [deviceScaleFactor]
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

  // 0. Auth: everything is behind the admin login
  const USER = process.env.E2E_USERNAME || "admin";
  const PASS = process.env.E2E_PASSWORD;
  if (!PASS) throw new Error("Set E2E_PASSWORD (and optionally E2E_USERNAME) to the admin login");
  await page.goto(BASE + "/library");
  ok(page.url().includes("/login?next=%2Flibrary"), "signed-out visit redirects to /login");
  const api = await ctx.request.post(BASE + "/api/auth/logout");
  ok(api.ok(), "logout API reachable");
  const sermonsPage = await ctx.request.get(BASE + "/sermons/x", { maxRedirects: 0 });
  ok(sermonsPage.status() === 307, "pages are protected (307 to login)");
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Wrong username or password").waitFor({ timeout: 5000 });
  ok(true, "wrong password is rejected");
  await page.getByLabel("Password").fill(PASS);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/library$/);
  ok(true, "admin signs in and returns to the requested page");
  const cookie = (await ctx.cookies()).find((c) => c.name === "cm_session");
  ok(cookie && cookie.httpOnly && cookie.sameSite === "Lax", "session cookie is httpOnly + SameSite=Lax");

  // 1. Dashboard + sample sermon
  await page.goto(BASE + "/");
  await page.getByRole("button", { name: /sample sermon/i }).click();
  await page.getByText("Faith in the Storm").first().waitFor();
  ok(true, "sample sermon created");
  await page.screenshot({ path: `${OUT}/1-dashboard.png` });

  // 2. Editor: pointers collapsed into tiles; expand, pick a verse from the grid
  await page.getByRole("link", { name: /Faith in the Storm/ }).first().click();
  await page.getByLabel("Topic / title", { exact: true }).waitFor();
  ok(await page.getByTestId("point-tile").count() === 3 && await page.getByTestId("point").count() === 0, "filled pointers start collapsed as tiles");
  ok((await page.getByTestId("point-tile").first().innerText()).includes("మార్కు 4:35-38"), "collapsed tile lists its verses");
  await page.getByTestId("point-tile").first().click();
  const firstPoint = page.getByTestId("point").first();
  await firstPoint.getByTestId("open-verse-picker").click();
  await firstPoint.getByLabel("Select book").selectOption("ROM");
  await firstPoint.getByLabel("Chapter").selectOption("8");
  ok(await firstPoint.getByTestId("verse-tile").count() === 39, "chapter shows a tile for every verse (Romans 8 = 39)");
  await firstPoint.getByTestId("verse-tile").nth(27).click();
  await firstPoint.getByTestId("verse-tile").nth(29).click();
  await firstPoint.getByTestId("selection-summary").waitFor();
  ok((await firstPoint.getByTestId("selection-summary").innerText()).includes("రోమా 8:28-30"), "tapping first + last verse selects a range");
  await page.getByText("సమస్తమును").first().waitFor({ timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/2-editor.png`, fullPage: false });
  await firstPoint.getByTestId("confirm-add-verse").click();
  ok((await firstPoint.getByTestId("verse-cue").allInnerTexts()).some((t) => t.includes("8:28-30")), "range added to pointer 1");
  ok(await firstPoint.getByTestId("verse-tile").count() === 0, "picker closes after adding");
  ok(/Add another verse/.test(await firstPoint.getByTestId("open-verse-picker").innerText()), "button now says 'Add another verse'");
  await firstPoint.getByTestId("open-verse-picker").click();
  ok(await firstPoint.getByTestId("verse-tile").count() === 39 && await firstPoint.locator("[data-testid=verse-tile][aria-pressed=true]").count() === 0, "reopened picker keeps book/chapter but starts with no verse selected");
  // second way: typing
  await firstPoint.getByRole("tab", { name: "Type" }).click();
  await firstPoint.getByLabel("Type a reference").fill("యోహాను 16:33");
  await firstPoint.getByLabel("Type a reference").press("Enter");
  ok((await firstPoint.getByTestId("verse-cue").allInnerTexts()).some((t) => t.includes("16:33")), "typed Telugu reference added");

  // save feedback
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByTestId("save-status").getByText("All changes saved").waitFor();
  ok(true, "Save shows 'All changes saved'");

  // adding a pointer collapses the others
  await page.getByTestId("add-point").click();
  ok(await page.getByTestId("point").count() === 1 && await page.getByTestId("point-tile").count() === 3, "new pointer is expanded, others collapse");
  // remove the empty pointer again
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("point").getByRole("button", { name: "Delete" }).click();

  // Telugu conversion button exists (needs AI Gateway; locally it must fail gracefully)
  await page.getByLabel("Topic / title", { exact: true }).fill("devudu manatho unnadu");
  await page.getByRole("button", { name: /తెలుగులో మార్చు — Topic/ }).click();
  await page.getByRole("status").filter({ hasText: /set up|convert|internet/i }).or(page.locator("#title[value*='దేవుడు']")).first().waitFor({ timeout: 15000 });
  ok(true, "Telugu convert responds (converted, or a clear message when not configured)");
  await page.getByLabel("Topic / title", { exact: true }).fill("తుఫానులో విశ్వాసం — Faith in the Storm");
  await page.waitForTimeout(900);

  // 3. Console via "Save & Start now"
  await page.getByRole("button", { name: /Save & Start now/ }).click();
  await page.waitForURL(/\/present\//);
  await page.getByTestId("console-verse").first().waitFor();
  const counts = await page.getByTestId("point-verse-count").allInnerTexts();
  ok(counts[0].trim() === "3", "console pointer shows its verse count");
  ok((await page.getByTestId("general-verses").innerText()).includes("Psalms 23"), "general verses are in their own section at the bottom");

  // 4. Open display window
  const [display] = await Promise.all([ctx.waitForEvent("page"), page.getByTestId("open-screen").click()]);
  display.on("pageerror", (e) => errors.push("display: " + e.message));
  await display.setViewportSize({ width: 1280, height: 720 });
  await display.getByTestId("start-screen").click();
  await page.getByText("Screen connected").waitFor({ timeout: 8000 });
  ok(true, "console sees screen as connected");

  // 4b. Before the sermon: welcome board with greeting, clock, verse, "starting shortly"
  await display.getByTestId("board-verse").waitFor({ timeout: 8000 });
  const board = await display.locator("body").innerText();
  ok(/త్వరలో ప్రారంభమవుతుంది/.test(board) && /will begin shortly/.test(board), "welcome board says the message starts shortly (TE + EN)");
  ok(/DIVINE CHURCH|Divine Church/i.test(board) && /Prasanna Kumar/.test(board) && /Manikonda/.test(board), "welcome board shows church, pastor and address");
  ok(/\d{1,2}:\d{2}\s?(am|pm)/i.test(await display.getByTestId("board-clock").innerText()), "welcome board shows the current time");
  ok(await page.getByTestId("begin-sermon").isVisible(), "console offers 'Begin sermon' while the welcome board is up");
  await display.screenshot({ path: `${OUT}/4a-display-welcome.png` });

  // 5. Show first verse (Mark 4:35-38) — this also starts the sermon timer
  await page.getByTestId("console-verse").first().click();
  await page.getByTestId("begin-sermon").waitFor({ state: "detached", timeout: 5000 });
  ok(true, "showing the first verse starts the sermon (Begin button goes away)");
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

  // 8b. Pick any verse via book/chapter/verse selector
  await page.getByTestId("pick-verse").click();
  await page.getByLabel("Select book").selectOption("PSA");
  await page.getByLabel("Chapter").selectOption("121");
  await page.getByTestId("verse-tile").nth(0).click();
  await page.getByTestId("verse-tile").nth(1).click();
  await page.getByTestId("pick-show").click();
  await display.getByText("Psalms 121:1-2").first().waitFor({ timeout: 5000 });
  ok(true, "'Pick a verse' shows any verse on the spot");
  await page.screenshot({ path: `${OUT}/3b-console-pick.png` });
  await page.getByTestId("pick-verse").click();

  // 8c. Verse chip on a pointer shows that verse
  await page.getByTestId("point-verse-chip").filter({ hasText: "యెషయా" }).click();
  await display.getByText("Isaiah 43:2").first().waitFor({ timeout: 5000 });
  ok(true, "pointer verse chip shows the verse");

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
  await lib.getByTestId("point-tile").nth(1).click();
  const p2 = lib.getByTestId("point").first();
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

  // 11b. End sermon -> thank-you board stays on the screen
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /End sermon/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/present"));
  await display.getByTestId("board-message").getByText(/ముగిసింది/).waitFor({ timeout: 5000 });
  ok(/thank you for joining us/i.test(await display.getByTestId("board-message").innerText()), "after End sermon the screen shows the thank-you board");
  await display.getByTestId("board-verse").waitFor({ timeout: 8000 });
  await display.screenshot({ path: `${OUT}/4b-display-ended.png` });

  // 11c. Settings: profile preview + logo upload
  await page.goto(BASE + "/settings");
  await page.getByTestId("settings-preview").getByText("Ps Prasanna Kumar").first().waitFor({ timeout: 8000 });
  ok(true, "settings shows a live preview of the screen with the church profile");
  await page.screenshot({ path: `${OUT}/10-settings.png` });
  await page.getByTestId("logo-upload").setInputFiles(path.join(FIX, "cross.png"));
  await page.getByRole("button", { name: "Use default logo" }).waitFor({ timeout: 5000 });
  ok(true, "custom logo upload is saved");
  await page.getByRole("button", { name: "Use default logo" }).click();

  // 12. Sign out
  await page.goto(BASE + "/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  const locked = await ctx.request.get(BASE + "/", { maxRedirects: 0 });
  ok(locked.status() === 307, "after sign-out the app is locked again");

  ok(errors.length === 0, `no page errors ${errors.join(" | ")}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

