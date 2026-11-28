import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { IeltsTest } from "@/lib/types";
import { DEFAULT_BAND_CONVERSIONS } from "@/lib/seed-data";
import { FULL_SEED_TESTS } from "@/lib/seed-tests";
import {
  canonicalizeNumberWords,
  doesAnswerExceedWordLimit,
  evaluateAnswer,
  expandAcceptedAnswerVariants,
  gradeObjectiveTest,
  isAnswerCorrect,
  sanitizeTestForClient,
} from "@/lib/test-grader";
import { locateEvidenceParagraph } from "@/lib/exam-evidence";
import { splitPassageParagraphs } from "@/lib/test-groups";

describe("Exam Upgrade GĐ5 — Server Group Grading, Word-Limit Enforcement, Multi-Select & Evidence Review", () => {
  const root = process.cwd();

  describe("1. Slash variants, hyphen/case/space normalization & number-word equivalence", () => {
    it("expands slash variants while preserving numeric dates and ratios", () => {
      expect(expandAcceptedAnswerVariants(["colour / color", "grey/gray"])).toEqual([
        "colour",
        "color",
        "grey",
        "gray",
      ]);
      expect(expandAcceptedAnswerVariants(["12/05", "24/7"])).toEqual([
        "12/05",
        "24/7",
      ]);
      expect(isAnswerCorrect("color", ["colour / color"])).toBe(true);
      expect(isAnswerCorrect("12/05", ["12/05"])).toBe(true);
    });

    it("normalizes case, extra spaces, punctuation, and hyphens", () => {
      expect(
        isAnswerCorrect("  Well  Known. ", ["well-known"], "short_answer", {
          wordLimit: { maxWords: 2, allowNumber: false, numberMode: "word_only" },
        })
      ).toBe(true);
      expect(isAnswerCorrect("iii", ["iii. Historical context"])).toBe(true);
      expect(isAnswerCorrect("B. Solar mirrors", ["B"])).toBe(true);
    });

    it("supports configurable number-word equivalence only when enabled", () => {
      expect(canonicalizeNumberWords("twenty five")).toBe("25");
      expect(canonicalizeNumberWords("one hundred and forty five")).toBe("145");
      expect(canonicalizeNumberWords("first")).toBe("1st");

      // Off by default
      expect(isAnswerCorrect("ten", ["10"], "short_answer")).toBe(false);
      // Enabled per group
      expect(
        isAnswerCorrect("ten", ["10"], "short_answer", {
          allowNumberWordEquivalence: true,
        })
      ).toBe(true);
      expect(
        isAnswerCorrect("25", ["twenty-five"], "short_answer", {
          allowNumberWordEquivalence: true,
        })
      ).toBe(true);
      expect(
        isAnswerCorrect("first", ["1st"], "short_answer", {
          allowNumberWordEquivalence: true,
        })
      ).toBe(true);
    });
  });

  describe("2. Strict server-side IELTS word-limit enforcement", () => {
    it("marks answers exceeding ONE WORD ONLY as wrong with wordLimitExceeded=true", () => {
      const oneWord = {
        maxWords: 1,
        allowNumber: false,
        numberMode: "word_only" as const,
      };

      // Hyphenated compound counts as 1 IELTS word -> PASS
      expect(
        evaluateAnswer("well-known", ["well-known"], "summary_completion", {
          wordLimit: oneWord,
        })
      ).toEqual({ isCorrect: true, wordLimitExceeded: false });

      // Two space-separated words violate ONE WORD ONLY -> WRONG even though hyphen-normalized text matches
      expect(
        evaluateAnswer("well known", ["well-known"], "summary_completion", {
          wordLimit: oneWord,
        })
      ).toEqual({ isCorrect: false, wordLimitExceeded: true });

      expect(
        evaluateAnswer("solar energy", ["solar"], "note_completion", {
          wordLimit: oneWord,
        })
      ).toEqual({ isCorrect: false, wordLimitExceeded: true });
    });

    it("enforces ONE WORD AND/OR A NUMBER and A NUMBER ONLY accurately", () => {
      const wordOrNum = {
        maxWords: 1,
        allowNumber: true,
        numberMode: "word_or_number" as const,
      };
      expect(doesAnswerExceedWordLimit("15 days", wordOrNum)).toBe(false);
      expect(doesAnswerExceedWordLimit("150", wordOrNum)).toBe(false);
      expect(doesAnswerExceedWordLimit("fifteen extra days", wordOrNum)).toBe(true);

      const numOnly = {
        maxWords: 0,
        allowNumber: true,
        numberMode: "number_only" as const,
      };
      expect(doesAnswerExceedWordLimit("42", numOnly)).toBe(false);
      expect(doesAnswerExceedWordLimit("42 books", numOnly)).toBe(true);
      expect(
        doesAnswerExceedWordLimit("forty-two", numOnly, {
          allowNumberWordEquivalence: true,
        })
      ).toBe(false);

      // Word bank items are exempt from free-text word limit
      expect(
        evaluateAnswer("A", ["A"], "summary_completion", {
          wordLimit: { maxWords: 1, allowNumber: false, numberMode: "word_only" },
          hasAnswerBank: true,
        })
      ).toEqual({ isCorrect: true, wordLimitExceeded: false });
    });
  });

  describe("3. Unordered multi-select group grading across multiple question numbers (mcq_multi)", () => {
    const syntheticTest: IeltsTest = {
      id: "gd5-multi-test",
      slug: "gd5-multi-test",
      skill: "reading",
      module: "academic",
      title_vi: "GD5 Multi Test",
      title_en: "GD5 Multi Test",
      description_vi: "",
      description_en: "",
      duration_minutes: 60,
      difficulty: "band_6_7",
      questionCount: 6,
      is_published: true,
      is_daily_eligible: false,
      is_premium: false,
      created_at: "2026-11-27T00:00:00.000Z",
      sections: [
        {
          id: "s1",
          title: "Passage 1",
          passage: "Paragraph A: Sample passage.",
          groups: [
            {
              id: "g-two",
              type: "mcq_multi",
              questionRange: { start: 1, end: 2 },
              questionIds: ["q1", "q2"],
              maxSelections: 2,
              instruction: "Choose TWO letters, A–E.",
            },
            {
              id: "g-three",
              type: "mcq_multi",
              questionRange: { start: 3, end: 5 },
              questionIds: ["q3", "q4", "q5"],
              maxSelections: 3,
              instruction: "Choose THREE letters, A–F.",
            },
            {
              id: "g-comp",
              type: "summary_completion",
              questionRange: { start: 6, end: 6 },
              questionIds: ["q6"],
              wordLimit: { maxWords: 1, allowNumber: true, numberMode: "word_or_number" },
              allowNumberWordEquivalence: true,
              instruction: "Choose ONE WORD AND/OR A NUMBER.",
            },
          ],
          questions: [
            {
              id: "q1",
              number: 1,
              type: "mcq_multi",
              prompt: "Choose TWO reasons.",
              correctAnswers: ["B"],
              explanation_vi: "B đúng",
              explanation_en: "B is right",
              sectionRef: "Paragraph A",
            },
            {
              id: "q2",
              number: 2,
              type: "mcq_multi",
              prompt: "Choose TWO reasons.",
              correctAnswers: ["D"],
              explanation_vi: "D đúng",
              explanation_en: "D is right",
              sectionRef: "Paragraph A",
            },
            {
              id: "q3",
              number: 3,
              type: "mcq_multi",
              prompt: "Choose THREE features.",
              correctAnswers: ["A, C, E"],
              explanation_vi: "",
              explanation_en: "",
            },
            {
              id: "q4",
              number: 4,
              type: "mcq_multi",
              prompt: "Choose THREE features.",
              correctAnswers: ["A, C, E"],
              explanation_vi: "",
              explanation_en: "",
            },
            {
              id: "q5",
              number: 5,
              type: "mcq_multi",
              prompt: "Choose THREE features.",
              correctAnswers: ["A, C, E"],
              explanation_vi: "",
              explanation_en: "",
            },
            {
              id: "q6",
              number: 6,
              type: "summary_completion",
              prompt: "Total cost: {{6}}",
              correctAnswers: ["10"],
              explanation_vi: "",
              explanation_en: "",
            },
          ],
        },
      ],
    };

    it("awards full credit in any order for multi-number mcq_multi and supports group allowNumberWordEquivalence", () => {
      const graded = gradeObjectiveTest(
        syntheticTest,
        {
          q1: "D. Lower cost",
          q2: "B. Faster assembly",
          q3: "E. Thermal glass",
          q4: "A. Modular frame",
          q5: "C. Solar roof",
          q6: "ten",
        },
        DEFAULT_BAND_CONVERSIONS
      );
      expect(graded.rawScore).toBe(6);
      expect(graded.details.every((d) => d.isCorrect)).toBe(true);
    });

    it("prevents duplicate-choice cheating and API over-submission brute force on mcq_multi", () => {
      // Duplicate "B" in both q1 and q2 -> only 1/2 credit
      const dupGraded = gradeObjectiveTest(
        syntheticTest,
        { q1: "B", q2: "B", q6: "ten extra words" },
        DEFAULT_BAND_CONVERSIONS
      );
      expect(dupGraded.details.find((d) => d.questionId === "q1")?.isCorrect).toBe(true);
      expect(dupGraded.details.find((d) => d.questionId === "q2")?.isCorrect).toBe(false);
      // Word limit exceeded flagged cleanly on q6
      const q6Detail = dupGraded.details.find((d) => d.questionId === "q6");
      expect(q6Detail?.isCorrect).toBe(false);
      expect(q6Detail?.wordLimitExceeded).toBe(true);

      // Over-submitting 4 options into a 2-selection group -> 0/2 credit
      const bruteGraded = gradeObjectiveTest(
        syntheticTest,
        { q1: "A, B, C", q2: "D" },
        DEFAULT_BAND_CONVERSIONS
      );
      expect(bruteGraded.details.find((d) => d.questionId === "q1")?.isCorrect).toBe(false);
      expect(bruteGraded.details.find((d) => d.questionId === "q2")?.isCorrect).toBe(false);
    });
  });

  describe("4. Evidence locator across Academic Reading, General Training & Listening transcripts", () => {
    it("resolves Paragraph/Section labels, General Training headings, compound Pass labels, and transcript answer text", () => {
      const gtParagraphs = splitPassageParagraphs(
        [
          "Notice 1: Harbourview Municipal Library — Membership Guide\nOpen 9am daily.",
          "Notice 2: Community Pool Schedule\nLap swimming starts at 6am.",
          "Text 1 — Pass A: Coastal trail entry is free for residents.",
          "Text 1 — Pass B: Overnight camping requires a permit.",
        ].join("\n\n")
      );

      expect(locateEvidenceParagraph(gtParagraphs, "Notice 2")?.paragraphIndex).toBe(1);
      expect(
        locateEvidenceParagraph(gtParagraphs, "Text 1 — Pass B")?.paragraphIndex
      ).toBe(3);

      const transcript = splitPassageParagraphs(
        [
          "Receptionist: Welcome to the heritage centre.",
          "Guide: Please wear closed-toe shoes before entering the restoration workshop.",
        ].join("\n\n")
      );
      expect(
        locateEvidenceParagraph(transcript, undefined, ["closed-toe shoes"])
          ?.paragraphIndex
      ).toBe(1);
    });

    it("locates a valid evidence paragraph for every Reading question with sectionRef across ALL seeded Reading tests", () => {
      const readingTests = FULL_SEED_TESTS.filter((t) => t.skill === "reading");
      let checked = 0;
      for (const test of readingTests) {
        for (const sec of test.sections) {
          const paras = splitPassageParagraphs(sec.passage);
          for (const q of sec.questions) {
            if (!q.sectionRef) continue;
            checked += 1;
            const loc = locateEvidenceParagraph(paras, q.sectionRef, q.correctAnswers);
            expect(
              loc,
              `${test.slug}/${sec.id}/${q.id} sectionRef="${q.sectionRef}"`
            ).not.toBeNull();
          }
        }
      }
      expect(checked).toBeGreaterThan(200);
    });
  });

  describe("5. Zero pre-submit answer leakage & Grouped Review UI contracts", () => {
    it("guarantees sanitizeTestForClient leaks zero answer keys, explanations, or sectionRefs across all 20 objective tests", () => {
      const objectiveTests = FULL_SEED_TESTS.filter(
        (t) => t.skill === "reading" || t.skill === "listening"
      );
      for (const test of objectiveTests) {
        const sanitized = sanitizeTestForClient(test);
        for (const sec of sanitized.sections) {
          for (const q of sec.questions) {
            expect(q.correctAnswers).toEqual([]);
            expect(q.explanation_vi).toBe("");
            expect(q.explanation_en).toBe("");
            expect(q.sectionRef).toBeUndefined();
          }
        }
        // Verify serialized JSON contains no explanation_vi non-empty values
        const serialized = JSON.stringify(sanitized);
        expect(serialized).not.toContain('"sectionRef":');
      }
    });

    it("verifies GĐ5 review UI buttons, word-limit badge, group score pill, and passage evidence highlight wiring", () => {
      const rendererSrc = fs.readFileSync(
        path.join(root, "src/components/exam/question-group-renderer.tsx"),
        "utf8"
      );
      const passageSrc = fs.readFileSync(
        path.join(root, "src/components/exam/annotatable-passage.tsx"),
        "utf8"
      );
      const engineSrc = fs.readFileSync(
        path.join(root, "src/components/test-engine-client.tsx"),
        "utf8"
      );

      expect(rendererSrc).toContain("Xem đoạn chứa đáp án");
      expect(rendererSrc).toContain("View evidence in passage");
      expect(rendererSrc).toContain("wordLimitExceeded");
      expect(rendererSrc).toContain("Vượt giới hạn số từ");
      expect(rendererSrc).toContain("groupScore");

      expect(passageSrc).toContain("highlightedEvidenceParagraphIndex");
      expect(passageSrc).toContain("evidenceBadgeText");
      expect(passageSrc).toContain("data-section-id");

      expect(engineSrc).toContain("handleLocateEvidence");
      expect(engineSrc).toContain("locateEvidenceParagraph");
      expect(engineSrc).toContain("onLocateEvidence={handleLocateEvidence}");
    });
  });
});
