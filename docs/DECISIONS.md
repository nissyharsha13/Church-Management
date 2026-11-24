# Decision log

Each entry says what we decided, why, and what would make us revisit it.

### D-001: Web app (Next.js) with a second browser window as the screen
- **Why**: one codebase for planning and presenting, and later the public website. Runs on any laptop with Chrome or Edge, and is easy to distribute to other churches.
- **Revisit if**: we need IP/NDI cameras, local-network control without internet, or kiosk-style start-up. Then we wrap it in a desktop app (Tauri/Electron) rather than rewrite it.

### D-002: Local-first storage (IndexedDB) for the prototype
- **Why**: the pastor uses one computer. It works with no internet, there are no accounts or credentials to set up, and failures in the cloud can't break a Sunday service. Every record has `churchId` so cloud sync can be added later.
- **Trade-off**: data lives in that one browser profile. Back it up or add sync (Phase 4) before relying on it long-term.
- **Revisit when**: the media person needs a second device, or we need login.

### D-003: No separate Service entity yet
- **Why**: keeping the prototype small. `sermon.date` + `serviceName` carry the same information.
- **Plan**: introduce `Service` when the Events or Choir module starts, then migrate each sermon to a `serviceId`.

### D-004: Console is the source of truth; full state is broadcast on every change
- **Why**: a display that reloads, or a second display, gets everything in one message. There are no partial updates to drift out of sync. The transport is an interface, so a network transport can be added later.

### D-005: All actions are plain controller functions
- **Why**: buttons, keyboard, clicker and the future AI listener call the same functions. The AI starts in suggest mode (agreed with the pastor), then automatic.

### D-006: Bible translations bundled only if public domain or openly licensed
- **Why**: we intend to distribute to other churches. NIV, ESV, NKJV and NLT are copyrighted and need a licence or an API. See BIBLES.md.
- **Default**: Telugu IRV (primary) + KJV (secondary). Changeable per sermon and in Settings.

### D-007: Cameras: browser camera now, OBS decision deferred
- **Why**: one camera today, which works in the browser (USB or HDMI capture). Multiple cameras and livestreaming will probably be better handled by controlling OBS than by rebuilding a video switcher. To be decided in Phase 3 once we know the church's streaming setup.

### D-008: Telugu is primary on screen
- **Why**: requested by the pastor. Telugu on top in a larger size, English below, switchable (Both / Telugu / English) during the sermon.

### D-009: Short Telugu book names for display
- **Why**: "రోమా 8:28" reads better on screen than "రోమీయులకు రాసిన పత్రిక 8:28". The long forms stay as aliases for search. Needs native-speaker review.

### D-010: Single admin login with a signed cookie (no auth provider yet)
- **What**: `ADMIN_USERNAME` + scrypt `ADMIN_PASSWORD_HASH` + `AUTH_SECRET`, all set as environment variables. A successful login sets an HMAC-signed, httpOnly, SameSite=Lax, Secure cookie (30 days, renewed automatically so it never expires during a service). `src/proxy.ts` protects every page and API. Login and logout, Next static files and the public-domain `/bibles/*` data are exempt. If the variables are missing, the app stays locked.
- **Why**: one admin user for the prototype. There's no user database to run and no third-party account, and it works the same on Vercel and on the church laptop.
- **Limits**: one account, no password-reset flow (generate a new hash with `npm run auth:hash`), and the login throttle (5 failures per 15 minutes per IP) is per server instance.
- **Revisit when**: we add the media-person role or several churches. Then move to a real auth provider with per-user accounts and roles, together with the cloud database (Phase 4).

### D-011: Telugu transliteration through an AI model (Vercel AI Gateway)
- **What**: Each "తెలుగులో మార్చు" button (topic, gist, pointer titles, notes) sends the field to `/api/transliterate`. That route calls `anthropic/claude-haiku-5.5` (override with `AI_GATEWAY_MODEL`) through Vercel AI Gateway and replaces the field. Undo restores the previous text. Only the script changes, never the meaning; English words and verse references are kept.
- **Why**: chosen by the pastor over offline rules (which can't spell casual "Tenglish" such as "devudu" → దేవుడు correctly) and over Google's unofficial input-tools endpoint (no API agreement).
- **Auth/cost**: on Vercel the deployment authenticates with OIDC automatically. Running locally needs `AI_GATEWAY_API_KEY`. It costs about $0.0001 per conversion and is covered by AI Gateway's monthly free credit. Input is capped at 4,000 characters, and the route sits behind the admin login.
- **Offline**: needs internet while planning only. Presenting never calls it.

### D-012: Verse picking is select-first, type-second
- **Why**: pastor feedback. A book dropdown grouped by testament, then chapter, then a grid of every verse (tap one verse, or tap the first and last for a range) is easier than typing. Typing stays as the second tab, and is also available in the console as "Quick verse". The same `VerseSelector` component powers the planner and the console's "Pick a verse".

### D-013: White & gold theme; gold emblem traced from the YouTube banner
- **App**: warm white background, gold accents and glossy-gold primary buttons. The deeper gold gradient is used on white so highlights stay visible. The presenter console stays dark on purpose to avoid glare in a dim hall, with gold accents and red for "Live".
- **Screen**: black-and-gold backdrop, gold wordmark (Cinzel, bundled offline) and gold emblem.
- **Logo**: the crown + "DC" emblem was traced to a vector (`public/branding/divine-church-emblem.svg`) from the banner's orange shield. "DIVINE CHURCH" is typeset rather than traced, because the banner lettering was too low-resolution. The emblem is drawn as a CSS mask over a metallic gradient, so any transparent logo uploaded in Settings gets the same gold finish. The gold finish can be switched off for logos that have their own background.

### D-014: Sermon phases — welcome → live → thank-you
- **Welcome**: opening the console shows the Welcome board on the screen: greeting by time of day (Lord's-day greeting on Sundays), live clock, Telugu + English date, "the message will begin shortly", a rotating welcome verse, church name, pastor, address, service time and YouTube (QR code once the link is set). The timer starts with **Begin sermon** or automatically on the first verse, video, title or camera.
- **Thank-you**: **End sermon** switches the screen to the thank-you board (gratitude / live-by-the-Word verses), which stays up until the screen window is closed.
- **Verses**: welcome and ended verses (20 each, in `src/modules/presenter/occasion.ts`) rotate every 40 s, with a different starting verse each day.
- **Profile**: the church profile lives in Settings, seeded from the YouTube banner (`DEFAULT_SETTINGS` in `src/lib/db.ts`). Another church only changes these fields.

### D-015: Prayer screen
- **What**: a **Prayer** scene (console button or **R**) invites the congregation to join in prayer while the pastor or a speaker prays:
  - "మనం ప్రార్థన చేద్దాం · Let us pray"
  - a gentle request to bow heads, close eyes and join in
  - who is leading (defaults to the pastor; editable)
  - an optional topic (presets in Telugu + English, or typed / converted to Telugu)
  - a slowly rotating prayer verse
- **Look**: a calm visual (candle with a breathing glow) rather than text-heavy slides, so the screen supports the prayer without competing with it.
- **With the camera**: when the camera is the background and "Verses over camera" is on, it shows as a lower third, so people can still see who is praying.
- **Timer**: showing the prayer screen does not start the sermon timer, because opening prayer often comes before the message.
