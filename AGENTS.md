<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions

- Read `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md` and `docs/DECISIONS.md` before larger changes; record new decisions in `docs/DECISIONS.md` and update `docs/ROADMAP.md`.
- Features live in `src/modules/<module>`; routes in `src/app` stay thin. Every stored record carries `churchId`.
- UI strings go through `useT()` with entries in `src/lib/i18n/dictionary.ts` (English + Telugu).
- Presenter changes go through `useController` actions and the protocol in `src/modules/presenter/protocol.ts` — never talk to the display directly.
- Cache Components is on: don't read `Date.now()`, `Math.random()`, `new Date()` or dynamic params during render outside Suspense (see `src/app/present/[id]/page.tsx`).
- Bible data is generated: change `scripts/bibles/build.mjs`, never edit `public/bibles` by hand.
- Before committing: `npx tsc --noEmit && npx eslint src && npm test && npm run build`, and `npm run test:e2e` against `npm start -- -p 3100`.
