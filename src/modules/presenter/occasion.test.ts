import { describe, expect, it } from "vitest";
import { greetingFor, quoted, rotatingIndex } from "./occasion";

describe("quoted", () => {
  it("does not double quote marks the translation already has", () => {
    expect(quoted("“మీరు నా పేరిట”")).toBe("“మీరు నా పేరిట”");
    expect(quoted("plain")).toBe("“plain”");
  });
});

describe("greetingFor", () => {
  it("greets by time of day and welcomes on the Lord's day", () => {
    expect(greetingFor(new Date(2026, 10, 22, 9)).en).toBe("Good morning"); // Sunday
    expect(greetingFor(new Date(2026, 10, 22, 9)).subEn).toMatch(/Lord's Day/);
    expect(greetingFor(new Date(2026, 10, 24, 19)).en).toBe("Good evening");
  });
});

describe("rotatingIndex", () => {
  it("stays in range and changes over time", () => {
    const a = rotatingIndex(1_800_000_000_000, 20);
    const b = rotatingIndex(1_800_000_000_000 + 40_000, 20);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(20);
    expect(a).not.toBe(b);
  });
});
