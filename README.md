# Church Management

A church management app, built module by module. **Module 1 is Sermons**: plan a sermon during the week, then run it live on Sunday from a pastor console that controls the congregation screen.

- **Planner**: topic, date, gist, pointers (outline) with notes and timing, Bible verses and media attached to each pointer.
- **Bibles bundled offline**: Telugu (IRV, OV) and English (KJV, BSB, WEB, ASV, BBE, Darby). Verses are shown Telugu-first with English underneath, switchable live.
- **Pastor console**: pointers, verse buttons, video buttons, camera, live monitor, timer, keyboard and presentation-clicker shortcuts.
- **Display window**: a second browser window on the projector or TV, driven by the console. If it is reloaded or closed, it recovers its current state.

> Status: working prototype (Phase 1–2 of [docs/ROADMAP.md](docs/ROADMAP.md)), protected by a single admin login. Data is stored locally on the computer you use; there is no cloud sync yet.

## Run it

Requires Node.js 22+ and Chrome or Edge (needed for the second-screen window).

```bash
npm install
npm run build
npm start            # http://localhost:3000
```

For development: `npm run dev`.

## Admin login

Every page requires the admin login. Set three environment variables, in `.env.local` locally or under *Project → Settings → Environment Variables* on Vercel:

```bash
npm run auth:hash -- 'your-new-password'   # prints ADMIN_USERNAME, ADMIN_PASSWORD_HASH, AUTH_SECRET
```

To change the password, run the command again and replace `ADMIN_PASSWORD_HASH`, then redeploy. Keep `AUTH_SECRET` unchanged, unless you want to sign out every browser. See [D-010](docs/DECISIONS.md).

## Hosting

The app is deployed on Vercel from the `main` branch; every push redeploys. Sermons and media are still stored **in the browser of the computer you use** (D-002), so use the same computer and browser for planning and presenting until cloud sync arrives.

## Live streaming

The app creates the YouTube broadcast and controls **OBS**, which sends the video. From the console you can go live, switch cameras, mute mics and end the stream. Chapters are added to the YouTube description afterwards. One-time setup: [docs/STREAMING-SETUP.md](docs/STREAMING-SETUP.md), which needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on Vercel.

## Using it on Sunday

1. **Plan**: *Sermons → New sermon*. Add pointers, then add verses to each pointer. You can type `యోహాను 3:16` or `John 3:16`, or use the book/chapter/verse selector. Upload clips in *Media library* and attach them.
2. **Prepare**: in *Settings → Offline Bibles*, download the translations you use. Uploaded videos are already stored on the computer.
3. **Start**: on the dashboard, click **Start** on today's sermon. In the console, click **Open screen window**, drag that window to the projector, then click it once. That click enables full screen, video sound and the camera.
4. **Preach**: click a verse or video to show it. Use **Blank**, **Logo** or **Clear** at any time.

| Key | Action |
|---|---|
| → / PageDown / Space | Next slide, then the next verse (works with presentation clickers) |
| ← / PageUp | Previous slide |
| 1–9 | Show verse N of the current pointer |
| ↓ / N, ↑ / P | Next / previous pointer |
| B or . | Blank screen |
| L / T / C | Logo / title slide / camera |
| R | Prayer screen |
| Esc | Clear (back to camera or logo) |

## Tests

```bash
npm test                         # unit tests (reference parser, slides)
npm start -- -p 3100 &           # then:
E2E_PASSWORD='…' npm run test:e2e         # browser test: login → planner → console → display
E2E_PASSWORD='…' npm run test:e2e:stream  # YouTube + OBS flow against local mocks
```

## Project docs

- [docs/ROADMAP.md](docs/ROADMAP.md): phases and what's next
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the console, display and data fit together
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md): entities, including those planned for later modules
- [docs/DECISIONS.md](docs/DECISIONS.md): decision log (why things are the way they are)
- [docs/BIBLES.md](docs/BIBLES.md): Bible sources, licences, and how to rebuild the data
