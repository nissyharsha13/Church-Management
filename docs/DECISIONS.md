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
