#!/usr/bin/env node
/**
 * Bible import pipeline.
 *
 * Converts raw source texts (USFM, OSIS, USFX, Zefania, aruljohn JSON) into
 * the app's compact format:
 *
 *   public/bibles/index.json              -> list of translations (metadata)
 *   public/bibles/<translationId>/<BOOK>.json -> { "c": [ ["v1", "v2", ...], ... ] }
 *   src/lib/bible/data/book-meta.json     -> verse counts per chapter (from KJV)
 *   src/lib/bible/data/canon.json         -> adds Telugu book names/aliases
 *
 * Usage: node scripts/bibles/build.mjs <sources-dir>
 * (run scripts/bibles/fetch-sources.sh <sources-dir> first)
 */
import fs from "node:fs";
import path from "node:path";

const SRC = process.argv[2];
if (!SRC) {
  console.error("usage: build.mjs <sources-dir>");
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUT = path.join(ROOT, "public/bibles");
const DATA = path.join(ROOT, "src/lib/bible/data");
const canon = JSON.parse(fs.readFileSync(path.join(DATA, "canon.json"), "utf8"));
const byOsis = Object.fromEntries(canon.map((b) => [b.osis, b.id]));
const byOrder = Object.fromEntries(canon.map((b) => [b.order, b.id]));
const ids = new Set(canon.map((b) => b.id));

// ---------- helpers ----------
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&(\w+);/g, (m, n) => ENT[n] ?? m);
}
function clean(s) {
  return decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}
/** book -> chapter -> verse -> text */
function newBible() {
  return {};
}
function put(bible, book, ch, v, text) {
  if (!ids.has(book) || !text) return;
  const chapters = (bible[book] ??= []);
  const verses = (chapters[ch - 1] ??= []);
  verses[v - 1] = verses[v - 1] ? `${verses[v - 1]} ${text}` : text;
}

// ---------- parsers ----------
function parseUSFM(dir) {
  const bible = newBible();
  const names = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".usfm")).sort()) {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    let book = null, ch = 0, v = 0, vEnd = 0, buf = "";
    const flush = () => {
      if (book && ch && v) {
        put(bible, book, ch, v, cleanUSFM(buf));
        // Combined verses ("\v 3-4"): later verses point back to the first one.
        for (let k = v + 1; k <= vEnd; k++) put(bible, book, ch, k, `^${v}`);
      }
      buf = "";
    };
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\\(\w+)\s?(.*)$/);
      if (!m) { if (v) buf += " " + line; continue; }
      const [, tag, rest] = m;
      if (tag === "id") { flush(); book = rest.slice(0, 3).toUpperCase(); ch = 0; v = 0; names[book] = {}; }
      else if (["h", "toc1", "toc2", "toc3"].includes(tag)) names[book][tag] = rest.trim();
      else if (tag === "c") { flush(); ch = parseInt(rest, 10); v = 0; }
      else if (tag === "v") { flush(); const mm = rest.match(/^(\d+)(?:-(\d+))?\s*(.*)$/); v = +mm[1]; vEnd = +(mm[2] ?? 0); buf = mm[3]; }
      else if (["p", "m", "q", "q1", "q2", "q3", "pi", "pi1", "b", "nb", "li", "li1", "li2", "pc", "pm", "mi"].includes(tag)) { if (v) buf += " " + rest; }
      else { /* headings, intros, remarks: not verse text */ flush(); v = 0; }
    }
    flush();
  }
  return { bible, names };
}
function cleanUSFM(s) {
  return s
    .replace(/\\f\s[\s\S]*?\\f\*/g, "")      // footnotes
    .replace(/\\x\s[\s\S]*?\\x\*/g, "")      // cross references
    .replace(/\\w\s([^|\\]*)(\|[^\\]*)?\\w\*/g, "$1") // word attributes
    .replace(/\\\+?\w+\*?/g, "")              // any other char marker
    .replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

function parseOSIS(file) {
  const bible = newBible();
  const xml = fs.readFileSync(file, "utf8").replace(/<note[\s\S]*?<\/note>/g, "").replace(/<title[\s\S]*?<\/title>/g, "");
  const re = /<verse[^>]*osisID="([^"]+)"[^>]*sID="[^"]*"[^>]*\/>([\s\S]*?)<verse[^>]*eID=/g;
  let m;
  while ((m = re.exec(xml))) {
    const [b, c, v] = m[1].split(" ")[0].split(".");
    put(bible, byOsis[b], +c, +v, clean(m[2]));
  }
  return bible;
}

function parseUSFX(file) {
  const bible = newBible();
  const xml = fs.readFileSync(file, "utf8")
    .replace(/<f\b[\s\S]*?<\/f>/g, "")
    .replace(/<x\b[\s\S]*?<\/x>/g, "")
    .replace(/<(s|h|toc|id|rem|d|ms|r|fig)\b[^>]*\/>/g, "")
    .replace(/<(s|h|toc|id|rem|d|ms|fig)\b[^>]*>[\s\S]*?<\/\1>/g, "")
    .replace(/<p\b[^>]*sfm="(r|mt|ms|d|s\d?)"[^>]*>[\s\S]*?<\/p>/g, "");
  const tok = /<book id="(\w+)"|<c id="(\d+)"[^>]*\/>|<v id="(\d+)[^"]*"[^>]*\/>|<ve\/>|<\/book>/g;
  let book = null, ch = 0, v = 0, start = 0, m;
  while ((m = tok.exec(xml))) {
    if (v) put(bible, book, ch, v, clean(xml.slice(start, m.index)));
    v = 0;
    if (m[1]) book = m[1].toUpperCase();
    else if (m[2]) ch = +m[2];
    else if (m[3]) { v = +m[3]; start = tok.lastIndex; }
  }
  return bible;
}

function parseZefania(file) {
  const bible = newBible();
  const xml = fs.readFileSync(file, "utf8").replace(/<NOTE[\s\S]*?<\/NOTE>/gi, "");
  const books = xml.split(/<BIBLEBOOK\b/).slice(1);
  for (const b of books) {
    const book = byOrder[+b.match(/bnumber="(\d+)"/)[1]];
    for (const c of b.split(/<CHAPTER\b/).slice(1)) {
      const ch = +c.match(/cnumber="(\d+)"/)[1];
      const re = /<VERS\b[^>]*vnumber="(\d+)"[^>]*>([\s\S]*?)<\/VERS>/g;
      let m;
      while ((m = re.exec(c))) put(bible, book, ch, +m[1], clean(m[2]));
    }
  }
  return bible;
}

function parseAruljohn(dir) {
  const bible = newBible();
  const list = JSON.parse(fs.readFileSync(path.join(dir, "Books.json"), "utf8"));
  const names = {};
  list.forEach((entry, i) => {
    const book = byOrder[i + 1];
    const data = JSON.parse(fs.readFileSync(path.join(dir, `${entry.book.english}.json`), "utf8"));
    names[book] = data.book.telugu ?? entry.book.telugu;
    for (const c of data.chapters) for (const v of c.verses) put(bible, book, +c.chapter, +v.verse, v.text.replace(/\s+/g, " ").trim());
  });
  return { bible, names };
}

// ---------- translations ----------
const OB = path.join(SRC, "open-bibles");
const pd = "Public Domain";
const translations = [];
function add(meta, bible) {
  const dir = path.join(OUT, meta.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const books = [];
  let verses = 0;
  for (const b of canon) {
    const chapters = bible[b.id];
    if (!chapters) continue;
    const c = Array.from(chapters, (vs) => Array.from(vs ?? [], (t) => t ?? ""));
    verses += c.reduce((n, vs) => n + vs.filter(Boolean).length, 0);
    fs.writeFileSync(path.join(dir, `${b.id}.json`), JSON.stringify({ c }));
    books.push(b.id);
  }
  translations.push({ ...meta, books });
  console.log(`${meta.id.padEnd(9)} ${books.length} books, ${verses} verses`);
  return bible;
}

const irv = parseUSFM(path.join(SRC, "te-irv/usfm"));
add({ id: "te-irv", abbr: "IRV", name: "Indian Revised Version (Telugu)", nativeName: "ఇండియన్ రివైజ్డ్ వెర్షన్", language: "te", license: "CC BY-SA 4.0", attribution: "Original work available at http://www.freebiblesindia.in", source: "https://github.com/FreeBiblesIndia/Telugu_Bible" }, irv.bible);
const ov = parseAruljohn(path.join(SRC, "te-ov"));
add({ id: "te-ov", abbr: "OV", name: "Telugu Old Version (BSI)", nativeName: "పరిశుద్ధ గ్రంథము (పాత అనువాదము)", language: "te", license: "Public domain text (1880 OV); verify for redistribution — see docs/BIBLES.md", attribution: "Telugu Bible, Old Version", source: "https://github.com/aruljohn/Bible-telugu" }, ov.bible);
const kjv = add({ id: "en-kjv", abbr: "KJV", name: "King James Version", nativeName: "King James Version", language: "en", license: pd, attribution: "", source: "https://github.com/seven1m/open-bibles" }, parseOSIS(path.join(OB, "eng-kjv.osis.xml")));
add({ id: "en-bsb", abbr: "BSB", name: "Berean Standard Bible", nativeName: "Berean Standard Bible", language: "en", license: pd, attribution: "", source: "https://github.com/seven1m/open-bibles" }, parseUSFX(path.join(OB, "eng-bsb.usfx.xml")));
add({ id: "en-web", abbr: "WEB", name: "World English Bible", nativeName: "World English Bible", language: "en", license: pd, attribution: "", source: "https://github.com/seven1m/open-bibles" }, parseUSFX(path.join(OB, "eng-web.usfx.xml")));
add({ id: "en-asv", abbr: "ASV", name: "American Standard Version (1901)", nativeName: "American Standard Version", language: "en", license: pd, attribution: "", source: "https://github.com/seven1m/open-bibles" }, parseZefania(path.join(OB, "eng-asv.zefania.xml")));
add({ id: "en-bbe", abbr: "BBE", name: "Bible in Basic English", nativeName: "Bible in Basic English", language: "en", license: pd, attribution: "", source: "https://github.com/seven1m/open-bibles" }, parseUSFX(path.join(OB, "eng-bbe.usfx.xml")));
add({ id: "en-darby", abbr: "DARBY", name: "Darby Translation", nativeName: "Darby Translation", language: "en", license: pd, attribution: "", source: "https://github.com/seven1m/open-bibles" }, parseZefania(path.join(OB, "eng-darby.zefania.xml")));

fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(translations, null, 1));

// verse counts per chapter, from KJV (versification reference)
const meta = Object.fromEntries(canon.map((b) => [b.id, (kjv[b.id] ?? []).map((vs) => vs.length)]));
fs.writeFileSync(path.join(DATA, "book-meta.json"), JSON.stringify(meta));

// Telugu names for the reference parser and UI
const TE_SHORT = { ROM: "రోమా", ACT: "అపొస్తలుల కార్యములు", REV: "ప్రకటన" };
for (const b of canon) {
  const n = irv.names[b.id] ?? {};
  // Display name: short form used in Telugu churches ("1 కొరింతీ", not "1 కొరింతీ పత్రిక").
  const full = n.toc2 ?? ov.names[b.id];
  const name = TE_SHORT[b.id] ?? full.replace(/\s*పత్రిక$/, "");
  const aliases = [full, n.toc1, n.toc3, n.h, ov.names[b.id]].filter((x) => x && x !== name);
  b.names.te = { name, aliases: [...new Set(aliases)] };
}
fs.writeFileSync(path.join(DATA, "canon.json"), JSON.stringify(canon, null, 1));
console.log("done");
