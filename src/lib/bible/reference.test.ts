import { describe, expect, it } from "vitest";
import { findBook, formatReference, parseReference, parseReferences } from "./reference";
import { buildSlides } from "./slides";

describe("findBook", () => {
  it.each([
    ["John", "JHN"], ["jn", "JHN"], ["1 Cor", "1CO"], ["1cor", "1CO"], ["Psalm", "PSA"], ["Ps", "PSA"],
    ["Rev", "REV"], ["Song of Songs", "SNG"], ["philip", "PHP"],
    ["యోహాను", "JHN"], ["కీర్తనలు", "PSA"], ["ఆదికాండం", "GEN"], ["1 యోహాను", "1JN"], ["రోమా", "ROM"],
  ])("%s -> %s", (input, id) => expect(findBook(input)).toBe(id));

  it("rejects unknown names", () => expect(findBook("Hezekiah")).toBeNull());
});

describe("parseReference", () => {
  it("parses single verses and ranges", () => {
    expect(parseReference("John 3:16")).toEqual({ book: "JHN", chapter: 3, start: 16, end: 16 });
    expect(parseReference("Jn 3 16-18")).toEqual({ book: "JHN", chapter: 3, start: 16, end: 18 });
    expect(parseReference("1 Cor 13:4–7")).toEqual({ book: "1CO", chapter: 13, start: 4, end: 7 });
    expect(parseReference("యోహాను 3:16")).toEqual({ book: "JHN", chapter: 3, start: 16, end: 16 });
  });
  it("whole chapter when no verse", () => {
    expect(parseReference("Psalm 23")).toEqual({ book: "PSA", chapter: 23, start: 1, end: 6 });
    expect(parseReference("కీర్తనలు 23")).toEqual({ book: "PSA", chapter: 23, start: 1, end: 6 });
  });
  it("rejects bad chapters", () => {
    expect(parseReference("John 30:1")).toBeNull();
    expect(parseReference("John")).toBeNull();
  });
  it("parses lists", () => {
    expect(parseReferences("John 3:16; Rom 5:8, Psalm 23:1").map((r) => r.book)).toEqual(["JHN", "ROM", "PSA"]);
  });
});

describe("formatReference", () => {
  it("formats in both languages", () => {
    const r = { book: "JHN", chapter: 3, start: 16, end: 17 };
    expect(formatReference(r, "en")).toBe("John 3:16-17");
    expect(formatReference(r, "te")).toBe("యోహాను 3:16-17");
    expect(formatReference({ book: "PSA", chapter: 23, start: 1, end: 6 }, "en")).toBe("Psalms 23");
  });
});

describe("buildSlides", () => {
  it("pairs translations and splits long passages", () => {
    const long = "x".repeat(150);
    const p = [1, 2, 3, 4].map((n) => ({ n, text: long }));
    const s = [1, 2, 3, 4].map((n) => ({ n, text: "y" }));
    const slides = buildSlides(p, s);
    expect(slides.length).toBe(4);
    expect(slides[0].verses[0]).toMatchObject({ n: 1, primary: long, secondary: "y" });
    const short = buildSlides([{ n: 1, text: "a" }, { n: 2, text: "b" }], []);
    expect(short).toHaveLength(1);
    expect(short[0].span).toBe("1-2");
  });
});
