# Data model

Stored locally in IndexedDB (database `church-management`, schema in `src/lib/db.ts`). Every table carries `churchId` (currently always `"default"`) so the same records can sync to a multi-church cloud database later.

## Current (v1)

| Table | Key fields | Notes |
|---|---|---|
| `churches` | id, name, tagline, uiLanguage, defaultPrimaryTranslation, defaultSecondaryTranslation, defaultSpeaker | Church settings |
| `sermons` | id, churchId, title, date, serviceName, speaker, gist, status, points[], verses[], media[], primaryTranslation, secondaryTranslation | See below |
| `media` | id, churchId, title, kind (video/image), source (file/youtube), fileId, youtubeId, startSec, endSec, tags | Media library |
| `mediaFiles` | id, blob | File contents, kept separate so listing the library stays fast |
| `sessions` | id, sermonId, startedAt, endedAt, events[] | What was shown and when |

### Sermon (embedded)

```ts
points: { id, title, notes, minutes? }[]                 // ordered outline ("cue list")
verses: { id, pointId | null, ref: { book, chapter, start, end } }[]
media:  { id, pointId | null, mediaId }[]
status: "draft" | "ready" | "delivered"                  // set to delivered by "End sermon"
```

- `book` is a USFM id (`JHN`). References are stored as structured data, never as text, so later we can search by book and see which parts of the Bible have been preached.
- A cross-chapter passage is stored as two references.
- Removing a pointer moves its verses and media to "general"; they are not deleted.

## Planned

| Entity | Purpose | Module |
|---|---|---|
| **Service** | A gathering: date, time, type (Sunday, cottage prayer, house prayer, retreat…), venue, language. Sermon, worship set, livestream and volunteers attach to it. Today `sermon.date` + `serviceName` stand in for it (D-003) | Events |
| Series | Ordered group of sermons | Sermons |
| Person / Speaker | Speakers, choir members, volunteers, members | People |
| User / Role | Pastor, media person, admin; per church | Accounts |
| WorshipSet / Song | Songs + lyrics for a service, shown through the same display | Choir |
| Church (tenant) | Several churches on one cloud deployment | Platform |
