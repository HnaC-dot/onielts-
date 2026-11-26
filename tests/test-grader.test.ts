import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FULL_SEED_TESTS } from "@/lib/seed-tests";
import { DEFAULT_BAND_CONVERSIONS } from "@/lib/seed-data";
import { gradeObjectiveTest, isAnswerCorrect } from "@/lib/test-grader";

describe("IELTS Practice Tests & Auto-Grading Engine", () => {
  it("seeds at least 3 original tests for EVERY skill (Reading, Listening, Writing, Speaking)", () => {
    const counts = { reading: 0, listening: 0, writing: 0, speaking: 0 };
    for (const t of FULL_SEED_TESTS) {
      counts[t.skill] += 1;
    }
    expect(counts.reading).toBeGreaterThanOrEqual(3);
    expect(counts.listening).toBeGreaterThanOrEqual(3);
    expect(counts.writing).toBeGreaterThanOrEqual(3);
    expect(counts.speaking).toBeGreaterThanOrEqual(3);
  });

  it("provides FULL 40-question, 3-passage Reading tests and 40-question, 4-part Listening tests with real MP3 audio files", () => {
    const readingTests = FULL_SEED_TESTS.filter((t) => t.skill === "reading");
    const listeningTests = FULL_SEED_TESTS.filter((t) => t.skill === "listening");

    for (const rt of readingTests) {
      expect(rt.sections.length).toBe(3);
      const questions = rt.sections.flatMap((s) => s.questions);
      expect(questions.length).toBe(40);
      expect(rt.questionCount).toBe(40);
      expect(questions.map((q) => q.number)).toEqual(
        Array.from({ length: 40 }, (_, i) => i + 1)
      );
    }

    for (const lt of listeningTests) {
      expect(lt.sections.length).toBe(4);
      const questions = lt.sections.flatMap((s) => s.questions);
      expect(questions.length).toBe(40);
      expect(lt.questionCount).toBe(40);
      expect(questions.map((q) => q.number)).toEqual(
        Array.from({ length: 40 }, (_, i) => i + 1)
      );
      for (const sec of lt.sections) {
        expect(sec.audioUrl).toMatch(/^\/audio\/listening\/.+\.mp3$/);
        const absPath = path.join(process.cwd(), "public", sec.audioUrl!);
        expect(fs.existsSync(absPath)).toBe(true);
        expect(fs.statSync(absPath).size).toBeGreaterThan(100_000);
      }
    }
  });

  it("covers all required IELTS objective question types across seeded tests", () => {
    const types = new Set(
      FULL_SEED_TESTS.flatMap((t) =>
        t.sections.flatMap((s) => s.questions.map((q) => q.type))
      )
    );
    const required = [
      "mcq",
      "tfng",
      "ynng",
      "matching_headings",
      "matching_info",
      "sentence_completion",
      "summary_completion",
      "table_completion",
      "note_completion",
      "flowchart_completion",
      "map_labelling",
      "short_answer",
    ];
    for (const reqType of required) {
      expect(types.has(reqType as never)).toBe(true);
    }
  });

  it("matches answers case-insensitively and handles MCQ prefixes", () => {
    expect(isAnswerCorrect("  Evapotranspiration. ", ["evapotranspiration"])).toBe(true);
    expect(isAnswerCorrect("B. Fish sensory lines", ["B"])).toBe(true);
    expect(isAnswerCorrect("FALSE", ["TRUE"])).toBe(false);
  });

  it("awards official Band 9.0 on a full 40-question Reading test", () => {
    const test = FULL_SEED_TESTS.find(
      (t) => t.slug === "academic-reading-01-urban-microclimates"
    )!;
    const perfectAnswers: Record<string, string> = {};
    for (const sec of test.sections) {
      for (const q of sec.questions) {
        perfectAnswers[q.id] = q.correctAnswers[0];
      }
    }
    const graded = gradeObjectiveTest(test, perfectAnswers, DEFAULT_BAND_CONVERSIONS);
    expect(graded.rawScore).toBe(40);
    expect(graded.maxScore).toBe(40);
    expect(graded.accuracyPercent).toBe(100);
    expect(graded.isFullIeltsTest).toBe(true);
    expect(graded.bandScore).toBe(9.0);
    expect(graded.breakdownByType.tfng.correct).toBe(graded.breakdownByType.tfng.total);
  });

  it("does NOT award a misleading Band 9.0 on short (<40 question) practice sprints", () => {
    const fullTest = FULL_SEED_TESTS.find(
      (t) => t.slug === "academic-reading-01-urban-microclimates"
    )!;
    const miniSprint = {
      ...fullTest,
      sections: [fullTest.sections[0]],
      questionCount: fullTest.sections[0].questions.length,
    };
    const perfectAnswers: Record<string, string> = {};
    for (const q of miniSprint.sections[0].questions) {
      perfectAnswers[q.id] = q.correctAnswers[0];
    }
    const graded = gradeObjectiveTest(miniSprint, perfectAnswers, DEFAULT_BAND_CONVERSIONS);
    expect(graded.maxScore).toBe(13);
    expect(graded.accuracyPercent).toBe(100);
    expect(graded.isFullIeltsTest).toBe(false);
    expect(graded.bandScore).toBeNull();
  });
});
