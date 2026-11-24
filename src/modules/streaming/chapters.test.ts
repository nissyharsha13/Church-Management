import { describe, expect, it } from "vitest";
import { buildChapters, CHAPTERS_START, formatOffset, replaceChapters } from "./chapters";

const T0 = 1_800_000_000_000;
const at = (s: number) => T0 + s * 1000;

describe("buildChapters", () => {
  it("starts at 0:00, labels verses/prayer/video, skips blanks", () => {
    const lines = buildChapters([
      { t: at(-30), kind: "verse", label: "Before stream" },
      { t: at(95), kind: "begin", label: "" },
      { t: at(100), kind: "title", label: "Faith in the Storm" },
      { t: at(400), kind: "verse", label: "Mark 4:35-38" },
      { t: at(405), kind: "blank", label: "" },
      { t: at(900), kind: "prayer", label: "Prayer for the sick" },
      { t: at(1200), kind: "media", label: "Storm clip" },
    ], T0);
    expect(lines[0]).toBe("0:00 Welcome · స్వాగతం");
    expect(lines).toContain("6:40 Mark 4:35-38");
    expect(lines).toContain("15:00 Prayer — Prayer for the sick");
    expect(lines).toContain("20:00 Video: Storm clip");
    expect(lines.join("\n")).not.toMatch(/Before stream|blank/i);
  });
  it("collapses items shown for less than 10 seconds", () => {
    const lines = buildChapters([
      { t: at(100), kind: "verse", label: "John 3:16" },
      { t: at(104), kind: "verse", label: "John 3:17" },
      { t: at(300), kind: "verse", label: "Rom 8:28" },
    ], T0);
    expect(lines).toEqual(["0:00 Welcome · స్వాగతం", "1:40 John 3:17", "5:00 Rom 8:28"]);
  });
  it("content shown in the first 10 s becomes the 0:00 chapter", () => {
    const lines = buildChapters([
      { t: at(3), kind: "verse", label: "Mark 4:35" },
      { t: at(14), kind: "verse", label: "Rom 8:28" },
      { t: at(25), kind: "prayer", label: "" },
    ], T0);
    expect(lines).toEqual(["0:00 Mark 4:35", "0:14 Rom 8:28", "0:25 Prayer"]);
  });
  it("returns nothing when YouTube would reject (fewer than 3)", () => {
    expect(buildChapters([{ t: at(100), kind: "verse", label: "John 3:16" }], T0)).toEqual([]);
  });
  it("formats hours", () => expect(formatOffset(3725)).toBe("1:02:05"));
});

describe("replaceChapters", () => {
  it("appends once and replaces on re-run", () => {
    const a = replaceChapters("Sermon text", ["0:00 A", "1:00 B", "2:00 C"]);
    expect(a).toContain(CHAPTERS_START);
    const b = replaceChapters(a, ["0:00 A", "3:00 D", "4:00 E"]);
    expect(b.split(CHAPTERS_START).length).toBe(2);
    expect(b).toContain("3:00 D");
    expect(b).not.toContain("1:00 B");
    expect(b.startsWith("Sermon text")).toBe(true);
  });
});
