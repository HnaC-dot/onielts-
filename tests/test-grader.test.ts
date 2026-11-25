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

  it("grades a Reading test accurately and generates question-type breakdown", () => {
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
    expect(graded.rawScore).toBe(graded.maxScore);
    expect(graded.bandScore).toBe(9.0);
    expect(graded.breakdownByType.tfng.correct).toBe(graded.breakdownByType.tfng.total);
    expect(graded.breakdownByType.matching_headings.total).toBe(4);
  });
});
