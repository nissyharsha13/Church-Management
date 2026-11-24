# Roadmap

Legend: ✅ done · 🟡 partial · ⬜ not started

## Phase 0: Foundation ✅
- ✅ Next.js app, module folders (`src/modules/<module>`), docs and decision log
- ✅ Bible import pipeline: 8 translations in Telugu and English, compact per-book JSON
- ✅ Reference parser for Telugu and English names and abbreviations, with tests
- ✅ App interface in English and Telugu (switch in the header)
- ✅ Every record has `churchId`, ready for multiple churches
- ⬜ **Native-speaker review of the Telugu interface strings** (`src/lib/i18n/dictionary.ts`) and short book names

## Phase 1: Sermon planner ✅
- ✅ Sermon details: topic, date, service, speaker, status, gist, translations
- ✅ Pointers (outline) with notes and optional minutes; reorder and delete
- ✅ Verses: typed (TE/EN) or selected, with live bilingual preview, attached to a pointer or "general"
- ✅ Media library: upload video or image (stored offline), YouTube links with start/end trim
- ✅ Duplicate and delete sermons; sample sermon
- ✅ Verse picker v2: testament-grouped books, chapter, tap-a-verse grid with ranges (D-012)
- ✅ Save button + visible auto-save status; "Save & Start now"; collapsible pointer tiles
- ✅ Telugu transliteration ("తెలుగులో మార్చు") for topic, gist, pointers, notes (D-011)
- ⬜ Series (group sermons), sermon templates
- ⬜ Search and filter in the sermon library (by book, speaker, series)

## Phase 2: Live console + display ✅ (single computer)
- ✅ Console: pointers and notes, verse buttons, slide paging, quick verse, media buttons, live monitor, timer
- ✅ Console v2: verse count + clickable verse chips on each pointer; general verses in their own section; "Pick a verse" (book → chapter → verse) to show any verse on the spot
- ✅ Display window: verses (both / Telugu / English), auto-fitted text, title, logo, blank
- ✅ Videos (offline files), images, YouTube (needs internet); play, pause, restart, stop; back to the background when a clip ends
- ✅ Keyboard and clicker shortcuts; font size control
- ✅ Failsafes: the display recovers after reload; the console recovers after reload; the newest action always wins
- ✅ Session log (what was shown and when) for each delivered sermon
- 🟡 Camera: one camera, as a scene or as the background with verses over it. Uses USB webcams or HDMI capture devices
- ⬜ Preview-before-live mode (stage the next item without showing it)
- ✅ Church branding: gold emblem + wordmark, white & gold app theme, uploadable logo (D-013)
- ✅ Welcome board before the sermon and thank-you board after it, with clock, date, greeting, rotating verses, pastor, address, YouTube QR (D-014)
- ✅ Prayer screen: invitation to join in prayer, leader, topic presets, prayer verse; lower third over camera (D-015)
- ⬜ Plan prayer moments in the sermon planner (topic + leader per pointer)
- ⬜ YouTube channel link (needed for the QR code), plus optional co-pastor/leader names
- ⬜ **Offline app start**: a service worker so the app opens with no internet. Bibles and media already work offline; the app pages need the local server, which is fine when running `npm start` on the church laptop
- ⬜ Window Management permission prompt and guidance for placing the screen window automatically

## Phase 3: Cameras & livestream
- ✅ YouTube connection: schedule broadcasts from sermons, permanent stream key, go live / end, viewers, auto chapters (D-016)
- ✅ OBS remote control: push key, start/stop, scene (camera) buttons, mic mute + level meters
- ⬜ Map console actions to OBS scenes automatically (e.g. verse → "Screen + Pulpit")
- ⬜ Separate "stream layout" screen (lower-third verses over camera for online viewers)
- ⬜ Thumbnail from the title slide; live chat on the console
- ⬜ Optional: own relay server (WebRTC → RTMP) for streaming without OBS
- ⬜ Multiple cameras; switch between them; picture-in-picture layouts
- ✅ Decided: OBS does cameras/mics/encoding, the app controls it (D-016)
- ⬜ IP/PTZ/NDI cameras, which need a desktop helper (Tauri/Electron) or OBS
- ⬜ Verse overlays on the livestream output

## Phase 4: Multi-device & accounts
- ✅ Single admin login (D-010) and hosting on Vercel
- ⬜ Per-user accounts and roles (pastor, media person, admin) via an auth provider
- ⬜ Cloud database + sync of the local data
- ⬜ Network transport (WebSocket / realtime) so a tablet or second laptop can control the screen. The protocol is already transport-agnostic (D-004)
- ⬜ Media-person console alongside the pastor console (both control the screen; the last action wins)
- ⬜ Stage/confidence display for the pastor (notes + timer + what's on screen)

## Phase 5: AI listening
- ⬜ Record sermons now to build a Telugu–English test set
- ⬜ Speech-to-text (Telugu + English code-mixed); detect spoken references and quotations
- ⬜ Suggest mode: highlight the matching verse or video; one tap to show
- ⬜ Auto mode once trusted. It calls the same controller actions as the buttons (D-005)

## Other modules (to be planned)
Choir & music team · Donations · Prayer requests · Community engagement · Events (cottage prayers, gatherings, house prayers, retreats) · Social media · Website (public sermon archive, podcast) · Live streaming
