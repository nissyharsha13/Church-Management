import type { VerseRef } from "@/lib/bible/reference";

/**
 * Content for the welcome (before) and ended (after) screens.
 * Verses rotate automatically; the starting verse changes every day.
 */
const r = (book: string, chapter: number, start: number, end = start): VerseRef => ({ book, chapter, start, end });

/** Gathering, the Lord's day, the house of God, waiting on the Lord. */
export const WELCOME_VERSES: VerseRef[] = [
  r("PSA", 122, 1),
  r("PSA", 118, 24),
  r("MAT", 18, 20),
  r("HEB", 10, 24, 25),
  r("PSA", 100, 4),
  r("PSA", 95, 6),
  r("ISA", 40, 31),
  r("PSA", 27, 14),
  r("LAM", 3, 25),
  r("PSA", 46, 10),
  r("PSA", 84, 10),
  r("PSA", 133, 1),
  r("PSA", 34, 3),
  r("JHN", 4, 24),
  r("PSA", 62, 5),
  r("PSA", 5, 3),
  r("PSA", 16, 11),
  r("JAS", 4, 8),
  r("PSA", 92, 1),
  r("COL", 3, 16),
];

/** Gratitude, kindness, living by the Word, walking God's way, being an example. */
export const ENDED_VERSES: VerseRef[] = [
  r("NUM", 6, 24, 26),
  r("COL", 3, 17),
  r("1TH", 5, 16, 18),
  r("JAS", 1, 22),
  r("MIC", 6, 8),
  r("MAT", 5, 16),
  r("EPH", 4, 32),
  r("PSA", 107, 1),
  r("ROM", 12, 2),
  r("1TI", 4, 12),
  r("PSA", 119, 105),
  r("GAL", 5, 22, 23),
  r("2CO", 9, 15),
  r("PSA", 103, 2),
  r("PRO", 3, 5, 6),
  r("1CO", 15, 58),
  r("HEB", 13, 16),
  r("1JN", 3, 18),
  r("PHP", 4, 8),
  r("JOS", 1, 8),
];

/** Prayer: asking, trusting, praying together. Short so they read in a glance. */
export const PRAYER_VERSES: VerseRef[] = [
  r("PHP", 4, 6, 7),
  r("MAT", 18, 19, 20),
  r("1TH", 5, 17),
  r("JER", 33, 3),
  r("JAS", 5, 16),
  r("MAT", 7, 7),
  r("PSA", 145, 18),
  r("1JN", 5, 14),
  r("MRK", 11, 24),
  r("HEB", 4, 16),
  r("1PE", 5, 7),
  r("PSA", 141, 2),
  r("ROM", 12, 12),
  r("2CH", 7, 14),
  r("JHN", 14, 13, 14),
  r("PSA", 62, 8),
];

/** Quick topics for the prayer screen (console presets). Telugu to be reviewed by a native speaker. */
export const PRAYER_TOPICS: { te: string; en: string }[] = [
  { te: "", en: "" },
  { te: "ప్రారంభ ప్రార్థన", en: "Opening prayer" },
  { te: "రోగుల కొరకు ప్రార్థన", en: "Prayer for the sick" },
  { te: "కుటుంబాల కొరకు ప్రార్థన", en: "Prayer for families" },
  { te: "మన దేశం కొరకు ప్రార్థన", en: "Prayer for our nation" },
  { te: "సంఘం కొరకు ప్రార్థన", en: "Prayer for the church" },
  { te: "కృతజ్ఞతా ప్రార్థన", en: "Prayer of thanksgiving" },
  { te: "ముగింపు ప్రార్థన", en: "Closing prayer" },
  { te: "ఆశీర్వాద ప్రార్థన", en: "Prayer of blessing" },
];

/** How long each verse stays before the next one fades in. */
export const VERSE_ROTATE_MS = 40_000;

/** Which verse to show now: rotates over time, starting point shifts daily. */
export function rotatingIndex(now: number, length: number, salt = 0): number {
  const day = Math.floor(now / 86_400_000);
  return (((day * 7 + salt + Math.floor(now / VERSE_ROTATE_MS)) % length) + length) % length;
}

export interface Greeting {
  te: string;
  en: string;
  subTe: string;
  subEn: string;
}

/** Time-of-day greeting; Sunday gets a Lord's-day welcome. */
export function greetingFor(d: Date): Greeting {
  const h = d.getHours();
  const [te, en] = h < 12 ? ["శుభోదయం", "Good morning"] : h < 17 ? ["శుభ మధ్యాహ్నం", "Good afternoon"] : ["శుభ సాయంత్రం", "Good evening"];
  const sunday = d.getDay() === 0;
  return {
    te,
    en,
    subTe: sunday ? "ప్రభువు దినమున మీకు స్వాగతం" : "ప్రభువు మందిరానికి స్వాగతం",
    subEn: sunday ? "Welcome on the Lord's Day" : "Welcome to the house of the Lord",
  };
}

export const MESSAGES = {
  welcome: { te: "వాక్య సందేశం త్వరలో ప్రారంభమవుతుంది", en: "The message will begin shortly" },
  ended: { te: "వాక్య సందేశం ముగిసింది — వచ్చినందుకు ధన్యవాదాలు", en: "The message has ended — thank you for joining us" },
  blessing: { te: "దేవుడు మిమ్మల్ని దీవించును గాక", en: "God bless you" },
  thanks: { te: "ధన్యవాదాలు", en: "Thank you" },
  prayerTitle: { te: "మనం ప్రార్థన చేద్దాం", en: "Let us pray" },
  prayerInvite: { te: "దయచేసి తలలు వంచి, కన్నులు మూసుకుని ప్రార్థనలో పాల్గొనండి", en: "Please bow your heads, close your eyes and join in prayer" },
  prayerLedBy: { te: "ప్రార్థన నడిపించువారు", en: "Led by" },
};

/** Wrap a verse in quotes, removing any quote marks the translation already has at the ends. */
export function quoted(text: string): string {
  return `“${text.trim().replace(/^[“”"‘’']+/, "").replace(/[“”"‘’']+$/, "")}”`;
}
