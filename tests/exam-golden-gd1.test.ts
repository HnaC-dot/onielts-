import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FULL_SEED_TESTS } from "../src/lib/seed-tests";
import { DEFAULT_BAND_CONVERSIONS } from "../src/lib/seed-data";
import { gradeObjectiveTest, sanitizeTestForClient } from "../src/lib/test-grader";
import {
  countAnswerWords,
  ensureTestGroups,
  extractBlankNumbers,
  extractGroupBlankNumbers,
  getPassageParagraphsForGroup,
  normalizeSectionToGroups,
  parseTemplateSegments,
  parseWordLimitFromText,
} from "../src/lib/test-groups";
import { validateIeltsTest } from "../src/lib/test-schema";
import { cmsTestFormSchema } from "../src/lib/test-cms-shared";
import type { QuestionGroup, TestSection } from "../src/lib/types";

const root = process.cwd();

describe("GĐ1 — Data Safety, QuestionGroup Model & Golden Regression Suite (All 54 Tests)", () => {
  describe("A. Data safety guardrails (seed protection & documentation)", () => {
    it("scripts/seed-supabase.ts uses ignoreDuplicates: true for ielts_tests to protect admin edits", () => {
      const seedSrc = fs.readFileSync(
        path.join(root, "scripts/seed-supabase.ts"),
        "utf8"
      );
      expect(seedSrc).toMatch(
        /\.from\("ielts_tests"\)\s*\.upsert\(testRows,\s*\{\s*onConflict:\s*"slug",\s*ignoreDuplicates:\s*true\s*\}\)/
      );
    });

    it("README.md documents the seed overwrite protection and backup/tag checklist", () => {
      const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
      expect(readme).toContain("ignoreDuplicates: true");
      expect(readme).toContain("sao lưu Supabase");
      expect(readme).toContain("git tag");
    });
  });

  describe("B. Golden tests locking ALL 54 existing tests (content, grouping & grading parity)", () => {
    const readingTests = FULL_SEED_TESTS.filter((t) => t.skill === "reading");
    const listeningTests = FULL_SEED_TESTS.filter((t) => t.skill === "listening");
    const objectiveTests = FULL_SEED_TESTS.filter(
      (t) => t.skill === "reading" || t.skill === "listening"
    );
    const writingTests = FULL_SEED_TESTS.filter((t) => t.skill === "writing");
    const speakingTests = FULL_SEED_TESTS.filter((t) => t.skill === "speaking");

    it("preserves exact catalog counts across all 54 tests (800 objective questions)", () => {
      expect(FULL_SEED_TESTS.length).toBe(54);
      expect(readingTests.length).toBe(10);
      expect(listeningTests.length).toBe(10);
      expect(writingTests.length).toBe(18);
      expect(speakingTests.length).toBe(16);

      const totalObjectiveQuestions = objectiveTests.reduce(
        (sum, t) => sum + t.sections.reduce((s, sec) => s + sec.questions.length, 0),
        0
      );
      expect(totalObjectiveQuestions).toBe(800);
    });

    it("converts every legacy Reading & Listening test into complete 1-to-1 QuestionGroups at read time without mutating stored data", () => {
      for (const test of objectiveTests) {
        // Original test must not be mutated by read-time conversion
        const hadGroupsBefore = test.sections.map((s) => s.groups);

        const grouped = ensureTestGroups(test);
        const sanitized = sanitizeTestForClient(test);

        expect(test.sections.map((s) => s.groups)).toEqual(hadGroupsBefore);
        expect(grouped.sections.length).toBe(test.sections.length);
        expect(sanitized.sections.length).toBe(test.sections.length);

        let totalQuestionsInGroups = 0;
        for (let sIdx = 0; sIdx < test.sections.length; sIdx += 1) {
          const origSec = test.sections[sIdx];
          const grpSec = grouped.sections[sIdx];
          const safeSec = sanitized.sections[sIdx];

          // Passage, audio, diagrams preserved identically
          expect(grpSec.passage).toBe(origSec.passage);
          expect(grpSec.audioUrl).toBe(origSec.audioUrl);
          expect(grpSec.diagramSvgType).toBe(origSec.diagramSvgType);

          // Groups must cover 100% of questions in exact order with zero drops or duplicates
          expect(grpSec.groups && grpSec.groups.length > 0).toBe(true);
          expect(safeSec.groups && safeSec.groups.length > 0).toBe(true);

          const groupedIds = (grpSec.groups ?? []).flatMap((g) => g.questionIds);
          const originalIds = origSec.questions.map((q) => q.id);
          expect(groupedIds, `${test.slug}/${origSec.id} question coverage`).toEqual(
            originalIds
          );
          expect(new Set(groupedIds).size).toBe(originalIds.length);
          totalQuestionsInGroups += groupedIds.length;

          // Every group range matches its member questions
          const qById = new Map(origSec.questions.map((q) => [q.id, q]));
          for (const g of grpSec.groups ?? []) {
            const nums = g.questionIds.map((id) => qById.get(id)!.number);
            expect(g.questionRange.start).toBe(Math.min(...nums));
            expect(g.questionRange.end).toBe(Math.max(...nums));
            expect(g.instruction && g.instruction.length > 5).toBe(true);
          }

          // Sanitized client payload must strip all answer keys & explanations
          for (const safeQ of safeSec.questions) {
            expect(safeQ.correctAnswers).toEqual([]);
            expect(safeQ.explanation_vi).toBe("");
            expect(safeQ.explanation_en).toBe("");
            expect(safeQ.sectionRef).toBeUndefined();
          }
        }
        expect(totalQuestionsInGroups).toBe(40);
      }
    });

    it("grades ALL 20 Reading & Listening tests identically before and after QuestionGroup read-time conversion", () => {
      for (const test of objectiveTests) {
        const groupedTest = ensureTestGroups(test);
        const allQ = test.sections.flatMap((s) => s.questions);

        // 1. All-correct sample submission
        const allCorrectAnswers: Record<string, string> = {};
        for (const q of allQ) {
          allCorrectAnswers[q.id] = q.correctAnswers[0];
        }
        const origPerfect = gradeObjectiveTest(
          test,
          allCorrectAnswers,
          DEFAULT_BAND_CONVERSIONS
        );
        const groupedPerfect = gradeObjectiveTest(
          groupedTest,
          allCorrectAnswers,
          DEFAULT_BAND_CONVERSIONS
        );
        expect(origPerfect.rawScore, `${test.slug} all-correct rawScore`).toBe(40);
        expect(origPerfect.maxScore).toBe(40);
        expect(origPerfect.bandScore).toBe(9.0);
        expect(groupedPerfect).toEqual(origPerfect);

        // 2. Half-correct (odd numbers right, even numbers wrong)
        const halfAnswers: Record<string, string> = {};
        for (const q of allQ) {
          halfAnswers[q.id] = q.number % 2 === 1 ? q.correctAnswers[0] : "__WRONG__";
        }
        const origHalf = gradeObjectiveTest(
          test,
          halfAnswers,
          DEFAULT_BAND_CONVERSIONS
        );
        const groupedHalf = gradeObjectiveTest(
          groupedTest,
          halfAnswers,
          DEFAULT_BAND_CONVERSIONS
        );
        expect(origHalf.rawScore, `${test.slug} half-correct rawScore`).toBe(20);
        expect(origHalf.accuracyPercent).toBe(50);
        expect(groupedHalf).toEqual(origHalf);

        // 3. Blank submission
        const blankRes = gradeObjectiveTest(groupedTest, {}, DEFAULT_BAND_CONVERSIONS);
        expect(blankRes.rawScore).toBe(0);
        expect(blankRes.accuracyPercent).toBe(0);
      }
    });

    it("preserves all 18 Writing and 16 Speaking tests intact through validation and grouping", () => {
      for (const t of [...writingTests, ...speakingTests]) {
        const grouped = ensureTestGroups(t);
        expect(validateIeltsTest(grouped).success, `${t.slug} schema valid`).toBe(true);
        if (t.skill === "writing") {
          expect(grouped.writingPrompt).toEqual(t.writingPrompt);
        } else {
          expect(grouped.speakingPrompts).toEqual(t.speakingPrompts);
        }
      }
    });
  });

  describe("C. QuestionGroup utilities ({{n}} placeholders, wordLimit, passageRange & explicit groups)", () => {
    it("parses {{n}} template placeholders across plain text, tables, flow-charts, and notes", () => {
      expect(parseTemplateSegments("Mix water hyacinth with {{8}} into a digester.")).toEqual([
        { type: "text", value: "Mix water hyacinth with " },
        { type: "blank", number: 8 },
        { type: "text", value: " into a digester." },
      ]);
      expect(extractBlankNumbers("Step {{ 1 }} -> {{2}} and {{12}}")).toEqual([1, 2, 12]);

      const group: Pick<QuestionGroup, "sharedContent"> = {
        sharedContent: {
          kind: "table",
          table: {
            title: "Research into sleep",
            headers: ["Subject", "Findings"],
            rows: [
              ["Humans", "Experience REM sleep"],
              ["{{1}}", "Similar brain patterns during {{2}}"],
            ],
          },
          flowchart: {
            steps: ["Step A {{3}}", "Step B {{4}}"],
          },
          notes: {
            sections: [{ heading: "Benefits", bullets: ["Save {{5}} each day"] }],
          },
        },
      };
      expect(extractGroupBlankNumbers(group)).toEqual([1, 2, 3, 4, 5]);
    });

    it("parses IELTS word-limit directives and counts hyphenated words properly", () => {
      expect(parseWordLimitFromText("Choose ONE WORD ONLY from the passage")).toEqual({
        maxWords: 1,
        allowNumber: false,
        numberMode: "word_only",
      });
      expect(parseWordLimitFromText("ONE WORD AND/OR A NUMBER")).toEqual({
        maxWords: 1,
        allowNumber: true,
        numberMode: "word_or_number",
      });
      expect(parseWordLimitFromText("NO MORE THAN TWO WORDS AND/OR A NUMBER")).toEqual({
        maxWords: 2,
        allowNumber: true,
        numberMode: "word_or_number",
      });
      expect(parseWordLimitFromText("NO MORE THAN THREE WORDS")).toEqual({
        maxWords: 3,
        allowNumber: false,
        numberMode: "word_only",
      });
      expect(parseWordLimitFromText("Write A NUMBER ONLY")).toEqual({
        maxWords: 0,
        allowNumber: true,
        numberMode: "number_only",
      });
      expect(countAnswerWords("well-known city")).toBe(2);
      expect(countAnswerWords("well-known")).toBe(1);
    });

    it("preserves explicit QuestionGroups and defensively appends orphan questions", () => {
      const section: TestSection = {
        id: "sec-custom",
        title: "Passage 1",
        passage: "A First para.\n\nB Second para.\n\nC Third para.",
        groups: [
          {
            id: "grp-features",
            questionRange: { start: 1, end: 2 },
            type: "matching_features",
            title: "List of Experts",
            instruction: "Match each statement with the correct expert, A, B or C.",
            answerBank: [
              { id: "A", text: "Martin Rees" },
              { id: "B", text: "Daniel Wolpert" },
              { id: "C", text: "Kathleen Richardson" },
            ],
            allowReuse: true,
            passageRange: { paragraphLabels: ["B", "C"] },
            questionIds: ["q1", "q2"],
          },
        ],
        questions: [
          {
            id: "q1",
            number: 1,
            type: "matching_features",
            prompt: "Robots need restrictions.",
            options: ["A", "B", "C"],
            correctAnswers: ["A"],
            explanation_vi: "Giải thích 1",
            explanation_en: "Explanation 1",
          },
          {
            id: "q2",
            number: 2,
            type: "matching_features",
            prompt: "Risk is overstated.",
            options: ["A", "B", "C"],
            correctAnswers: ["B"],
            explanation_vi: "Giải thích 2",
            explanation_en: "Explanation 2",
          },
          {
            id: "q3",
            number: 3,
            type: "tfng",
            prompt: "Orphan question not yet added to explicit group.",
            options: ["TRUE", "FALSE", "NOT GIVEN"],
            correctAnswers: ["TRUE"],
            explanation_vi: "Giải thích 3",
            explanation_en: "Explanation 3",
          },
        ],
      };

      const groups = normalizeSectionToGroups(section);
      expect(groups.length).toBe(2);
      expect(groups[0].id).toBe("grp-features");
      expect(groups[0].allowReuse).toBe(true);
      expect(groups[0].answerBank?.length).toBe(3);
      expect(groups[1].questionIds).toEqual(["q3"]);
      expect(groups[1].isAutoGenerated).toBe(true);

      const filtered = getPassageParagraphsForGroup(section.passage, groups[0].passageRange);
      expect(filtered.isFiltered).toBe(true);
      expect(filtered.paragraphs.map((p) => p.label)).toEqual(["B", "C"]);

      const byIndex = getPassageParagraphsForGroup(section.passage, {
        startParagraph: 0,
        endParagraph: 1,
      });
      expect(byIndex.isFiltered).toBe(true);
      expect(byIndex.paragraphs.map((p) => p.index)).toEqual([0, 1]);
    });

    it("validates new QuestionGroup payloads via cmsTestFormSchema", () => {
      const parsed = cmsTestFormSchema.safeParse({
        slug: "sample-grouped-reading",
        skill: "reading",
        module: "academic",
        title_vi: "Đề đọc mẫu theo nhóm câu hỏi",
        sections: [
          {
            id: "sec-1",
            title: "Passage 1",
            passage: "Paragraph one content.\n\nParagraph two content.",
            groups: [
              {
                id: "g-1",
                questionRange: { start: 1, end: 2 },
                type: "matching_sentence_endings",
                instruction: "Complete each sentence with the correct ending, A–D.",
                answerBank: [
                  { id: "A", text: "ending A" },
                  { id: "B", text: "ending B" },
                  { id: "C", text: "ending C" },
                ],
                allowReuse: false,
                questionIds: ["q-1", "q-2"],
              },
            ],
            questions: [
              {
                id: "q-1",
                number: 1,
                type: "matching_sentence_endings",
                prompt: "The study revealed that {{1}}",
                correctAnswers: ["A"],
              },
              {
                id: "q-2",
                number: 2,
                type: "matching_sentence_endings",
                prompt: "Researchers later concluded that {{2}}",
                correctAnswers: ["C"],
              },
            ],
          },
        ],
      });
      expect(parsed.success).toBe(true);
    });
  });
});
