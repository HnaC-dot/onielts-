import { describe, expect, it } from "vitest";
import { computeNextSm2, diffDictationSentence } from "@/lib/srs";

describe("SM-2 Spaced Repetition & Dictation Word-Level Diff", () => {
  it("increases interval on Good/Easy and resets repetitions on Again", () => {
    const now = new Date("2026-11-25T00:00:00.000Z");
    const first = computeNextSm2({ ease_factor: 2.5, interval_days: 0, repetitions: 0 }, 4, now);
    expect(first.repetitions).toBe(1);
    expect(first.interval_days).toBe(1);

    const second = computeNextSm2(first, 4, now);
    expect(second.repetitions).toBe(2);
    expect(second.interval_days).toBe(6);

    const lapsed = computeNextSm2(second, 1, now);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.interval_days).toBe(1);
  });

  it("scores 100% on exact sentence dictation regardless of punctuation/case", () => {
    const diff = diffDictationSentence(
      "Welcome to the central campus library.",
      "welcome to the central campus library"
    );
    expect(diff.accuracyPercent).toBe(100);
    expect(diff.tokens.every((t) => t.status === "correct")).toBe(true);
  });

  it("flags missing and wrong words accurately", () => {
    const diff = diffDictationSentence(
      "Quiet study booths on the third floor.",
      "Quiet booths on the second floor"
    );
    expect(diff.accuracyPercent).toBeLessThan(100);
    expect(diff.tokens.some((t) => t.status === "missing" && t.word === "study")).toBe(true);
    expect(diff.tokens.some((t) => t.status === "wrong" && t.word === "second")).toBe(true);
  });
});
