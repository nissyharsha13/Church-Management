# Bible sources & licences

| Id | Translation | Language | Licence | Source |
|---|---|---|---|---|
| `te-irv` | Indian Revised Version (Telugu), 2019 | Telugu | **CC BY-SA 4.0**. Attribution: "Original work available at http://www.freebiblesindia.in" | github.com/FreeBiblesIndia/Telugu_Bible (USFM) |
| `te-ov` | Telugu Old Version (BSI, 1880s text) | Telugu | See note ⚠️ | github.com/aruljohn/Bible-telugu (JSON) |
| `en-kjv` | King James Version | English | Public domain | github.com/seven1m/open-bibles (OSIS) |
| `en-bsb` | Berean Standard Bible | English | Public domain | open-bibles (USFX) |
| `en-web` | World English Bible | English | Public domain | open-bibles (USFX) |
| `en-asv` | American Standard Version 1901 | English | Public domain | open-bibles (Zefania) |
| `en-bbe` | Bible in Basic English | English | Public domain | open-bibles (USFX) |
| `en-darby` | Darby Translation | English | Public domain | open-bibles (Zefania) |

**⚠️ Telugu OV**: the original 1880s Old Version text is generally considered public domain, but the Bible Society of India claims copyright on its current printed editions. Using it in our own church is low-risk. **Before distributing the app to other churches**, confirm with BSI or ship only the IRV.

**CC BY-SA (IRV)**: we must show the attribution (done in *Settings → Offline Bibles*) and share modifications of the text under the same licence. We don't modify the text, only reformat it.

**Not included (licence needed)**: NIV (Biblica), ESV (Crossway), NKJV (Thomas Nelson), NLT (Tyndale). Options are API.Bible (online, with usage limits and caching restrictions) or a direct licence. The loader is per-translation, so a licensed provider can be added as another source.

**Known data notes**
- IRV has 88 combined verse ranges (e.g. Deuteronomy 1:3-4). These are stored once and shown with a "3-4" label.
- BBE and Darby include psalm titles inline (e.g. "<A Psalm. Of David.>"), as in their source editions.
- Verse counts in the pickers follow KJV versification.

## Rebuilding the data

```bash
npm run bibles:fetch   # clones sources into .bible-sources/ (git-ignored)
npm run bibles:build   # regenerates public/bibles/* and src/lib/bible/data/*
```

Adding a translation means adding a parser call in `scripts/bibles/build.mjs` (USFM, OSIS, USFX, Zefania and JSON are supported) and an entry in `src/lib/bible/translations.ts`. The open-bibles repo also has Spanish, Chinese, German and other languages for future churches.
