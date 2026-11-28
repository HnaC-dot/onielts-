import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { QuestionGroup, TestQuestion } from "../src/lib/types";
import { FULL_SEED_TESTS } from "../src/lib/seed-tests";
import {
  checkWordLimitSoftWarning,
  extractGroupBlankNumbers,
  getOptionDisplayParts,
  normalizeSectionToGroups,
  parseWordLimitFromText,
  promptToBlankTemplate,
  resolveGroupDisplayContent,
  stripLegacyPromptPrefix,
} from "../src/lib/test-groups";

const root = process.cwd();

describe("GĐ2 — Question-Type CBT UI Helpers, Inline Layouts & Accessibility", () => {
  describe("1. Legacy prompt normalization & inline blank templates", () => {
    it("strips redundant legacy prefixes cleanly and inserts {{n}} inline placeholders", () => {
      expect(
        stripLegacyPromptPrefix(
          "Note Completion (ONE WORD ONLY): Heavy tropical __________ creates noise."
        )
      ).toBe("Heavy tropical __________ creates noise.");

      expect(
        promptToBlankTemplate(
          "Sentence Completion (ONE WORD ONLY): Roots trap river __________ naturally.",
          23
        )
      ).toBe("Roots trap river {{23}} naturally.");

      expect(
        promptToBlankTemplate("The glider alters its {{9}} bladder.", 9)
      ).toBe("The glider alters its {{9}} bladder.");

      expect(
        promptToBlankTemplate("Short Answer (ONE WORD): Which day?", 4)
      ).toBe("Which day? {{4}}");
    });

    it("synthesizes inline table, flow-chart, notes, summary, and sentence structures for ALL legacy completion groups without dropping any question number", () => {
      const objectiveTests = FULL_SEED_TESTS.filter(
        (t) => t.skill === "reading" || t.skill === "listening"
      );
      let checkedGroups = 0;

      for (const test of objectiveTests) {
        for (const sec of test.sections) {
          const qById = new Map(sec.questions.map((q) => [q.id, q]));
          const groups = normalizeSectionToGroups(sec);
          for (const g of groups) {
            if (
              g.type === "table_completion" ||
              g.type === "flowchart_completion" ||
              g.type === "note_completion" ||
              g.type === "summary_completion" ||
              g.type === "sentence_completion"
            ) {
              const memberQs = g.questionIds.map((id) => qById.get(id)!);
              const content = resolveGroupDisplayContent(g, memberQs, false);
              expect(content, `${test.slug}/${g.id} display content`).not.toBeNull();

              const blanks = extractGroupBlankNumbers({ sharedContent: content! });
              const expectedNums = memberQs.map((q) => q.number);
              expect(
                blanks,
                `${test.slug}/${g.id} (${g.type}) must render every inline {{n}} blank`
              ).toEqual(expectedNums);
              checkedGroups += 1;
            }
          }
        }
      }

      expect(checkedGroups).toBeGreaterThan(80);
    });
  });

  describe("2. Word-count & soft-warning validation", () => {
    it("warns softly when exceeding ONE WORD ONLY and accepts hyphenated compounds as 1 word", () => {
      const oneWord = parseWordLimitFromText("ONE WORD ONLY");
      expect(checkWordLimitSoftWarning("", oneWord, false).exceeded).toBe(false);
      expect(checkWordLimitSoftWarning("evapotranspiration", oneWord, false)).toEqual({
        wordCount: 1,
        exceeded: false,
      });
      expect(checkWordLimitSoftWarning("well-known", oneWord, false)).toEqual({
        wordCount: 1,
        exceeded: false,
      });
      const over = checkWordLimitSoftWarning("solar panels", oneWord, false);
      expect(over.wordCount).toBe(2);
      expect(over.exceeded).toBe(true);
      expect(over.message).toContain("1 từ");
    });

    it("supports ONE WORD AND/OR A NUMBER and (ONE NUMBER) legacy directives", () => {
      const wordOrNum = parseWordLimitFromText("ONE WORD AND/OR A NUMBER");
      expect(checkWordLimitSoftWarning("40%", wordOrNum, true).exceeded).toBe(false);
      expect(checkWordLimitSoftWarning("14 years", wordOrNum, true).exceeded).toBe(false);
      expect(
        checkWordLimitSoftWarning("three extra separate words", wordOrNum, true).exceeded
      ).toBe(true);

      const numOnly = parseWordLimitFromText("Form Completion (ONE NUMBER): Rent");
      expect(numOnly?.numberMode).toBe("number_only");
      expect(checkWordLimitSoftWarning("1350", numOnly, true).exceeded).toBe(false);
      expect(checkWordLimitSoftWarning("twenty-four", numOnly, true).exceeded).toBe(false);
      expect(checkWordLimitSoftWarning("solar panels", numOnly, true).exceeded).toBe(true);
    });

    it("splits lettered choices cleanly while preserving original option value for server grading", () => {
      expect(getOptionDisplayParts("B. Electric buses", 1)).toEqual({
        letter: "B",
        label: "Electric buses",
        value: "B. Electric buses",
      });
      expect(getOptionDisplayParts("TRUE", 0)).toEqual({
        letter: "A",
        label: "TRUE",
        value: "TRUE",
      });
      expect(getOptionDisplayParts("NOT GIVEN", 2)).toEqual({
        letter: "C",
        label: "NOT GIVEN",
        value: "NOT GIVEN",
      });
    });
  });

  describe("3. QuestionGroupRenderer & TestEngineClient GĐ2 interactive capabilities", () => {
    it("implements all required question-type UX, accessibility roles, drag-drop + click-place, and multi-select cap", () => {
      const rendererSrc = fs.readFileSync(
        path.join(root, "src/components/exam/question-group-renderer.tsx"),
        "utf8"
      );
      const engineSrc = fs.readFileSync(
        path.join(root, "src/components/test-engine-client.tsx"),
        "utf8"
      );

      // Wired into TestEngineClient
      expect(engineSrc).toContain("QuestionGroupRenderer");
      expect(engineSrc).toContain("normalizeSectionToGroups");

      // Accessible roles & touch targets
      expect(rendererSrc).toContain('role="radiogroup"');
      expect(rendererSrc).toContain('role="radio"');
      expect(rendererSrc).toContain('role="checkbox"');
      expect(rendererSrc).toContain('role="listbox"');
      expect(rendererSrc).toContain('role="option"');
      expect(rendererSrc).toContain("min-h-[44px]");

      // Drag-and-drop + click-to-place + keyboard removal + one-time dimming
      expect(rendererSrc).toContain("onDragStart");
      expect(rendererSrc).toContain("onDragOver");
      expect(rendererSrc).toContain("onDrop");
      expect(rendererSrc).toContain("armedOptionId");
      expect(rendererSrc).toContain("Backspace");
      expect(rendererSrc).toContain("isSingleUseBank");

      // Matching Info & Features radio matrix + reuse notice
      expect(rendererSrc).toContain("NB You may use any letter more than once.");
      expect(rendererSrc).toContain("Bạn có thể dùng một chữ cái nhiều hơn một lần.");

      // Multi-select cap & multi-question numbers
      expect(rendererSrc).toContain("maxSelections");
      expect(rendererSrc).toContain("atLimit");

      // Matching Headings single-use + dropdown
      expect(rendererSrc).toContain("List of Headings");
      expect(rendererSrc).toContain("usedElsewhere");

      // Inline table, flowchart arrows, notes, summary
      expect(rendererSrc).toContain("ArrowDown");
      expect(rendererSrc).toContain("checkWordLimitSoftWarning");
    });
  });

  describe("4. Shared legacy prompt deduplication, [Qn: ___] markers, title hoisting & downward arrows", () => {
    it("strips 'Complete the summary using the list of words (A–J): Title —', converts [Qn: ___], and deduplicates shared sentences", () => {
      const group: QuestionGroup = {
        id: "g-delhi",
        type: "summary_completion",
        questionRange: { start: 14, end: 17 },
        questionIds: ["q14", "q15", "q16", "q17"],
      };
      const questions: TestQuestion[] = [
        {
          id: "q14",
          number: 14,
          type: "summary_completion",
          prompt:
            "Complete the summary using the list of words (A–J): Multilingualism in Delhi — The city of Delhi has a ________ and as you walk through its streets you hear people speaking a variety of languages.",
          correctAnswers: ["A"],
          explanation_vi: "",
          explanation_en: "",
        },
        {
          id: "q15",
          number: 15,
          type: "summary_completion",
          prompt:
            "Complete the summary using the list of words (A–J): Multilingualism in Delhi — Some of them have spent their entire life in Delhi, while others are ________.",
          correctAnswers: ["B"],
          explanation_vi: "",
          explanation_en: "",
        },
        {
          id: "q16",
          number: 16,
          type: "summary_completion",
          prompt:
            "Complete the summary using the list of words (A–J): Multilingualism in Delhi — Whether they have come from a ________ or have travelled from the other side of India, they have all come in search of things such as improved [Q17: ___].",
          correctAnswers: ["C"],
          explanation_vi: "",
          explanation_en: "",
        },
        {
          id: "q17",
          number: 17,
          type: "summary_completion",
          prompt:
            "Complete the summary using the list of words (A–J): Multilingualism in Delhi — Whether they have come from a [Q16: ___] or have travelled from the other side of India, they have all come in search of things such as improved ________.",
          correctAnswers: ["D"],
          explanation_vi: "",
          explanation_en: "",
        },
      ];

      const display = resolveGroupDisplayContent(group, questions, false);
      expect(display?.kind).toBe("summary");
      expect(display?.listTitle).toBe("Multilingualism in Delhi");
      expect(display?.text).not.toContain("Complete the summary");
      expect(display?.text).not.toContain("Multilingualism in Delhi");
      expect(display?.text).not.toContain("[Q17:");
      expect(display?.text).not.toContain("[Q16:");
      expect(display?.text).not.toContain("____");
      // Each placeholder 14, 15, 16, 17 appears exactly once in order (no duplicate Q16/Q17 sentence)
      expect(display?.text?.match(/\{\{\d+\}\}/g)).toEqual([
        "{{14}}",
        "{{15}}",
        "{{16}}",
        "{{17}}",
      ]);
      expect(display?.text?.match(/Whether they have come/g)).toHaveLength(1);
    });

    it("never misplaces Q28 inside [Q27: ___] and deduplicates shared multi-blank summary sentences", () => {
      const group: QuestionGroup = {
        id: "g-gift",
        type: "summary_completion",
        questionRange: { start: 27, end: 29 },
        questionIds: ["q27", "q28", "q29"],
      };
      const questions: TestQuestion[] = [
        {
          id: "q27",
          number: 27,
          type: "summary_completion",
          prompt:
            "Complete the summary using the list of words (A–J): A birthday gift — Peter Bellerby's plan to give his father a globe for his birthday was an unexpectedly ________ for which he had to overcome [Q28: ___].",
          correctAnswers: ["A"],
          explanation_vi: "",
          explanation_en: "",
        },
        {
          id: "q28",
          number: 28,
          type: "summary_completion",
          prompt:
            "Complete the summary using the list of words (A–J): A birthday gift — Peter Bellerby’s plan to give his father a globe for his birthday was an unexpectedly [Q27: ___] for which he had to overcome ________.",
          correctAnswers: ["B"],
          explanation_vi: "",
          explanation_en: "",
        },
        {
          id: "q29",
          number: 29,
          type: "summary_completion",
          prompt:
            "Complete the summary using the list of words (A–J): A birthday gift — He soon learnt that a straightforward ________ would not be possible.",
          correctAnswers: ["C"],
          explanation_vi: "",
          explanation_en: "",
        },
      ];

      // Individual promptToBlankTemplate on Q28 places {{27}} and {{28}} in exact positions
      const q28Tpl = promptToBlankTemplate(questions[1].prompt, 28);
      expect(q28Tpl).toContain("unexpectedly {{27}} for which he had to overcome {{28}}.");
      expect(q28Tpl).not.toContain("[Q27:");

      const display = resolveGroupDisplayContent(group, questions, false);
      expect(display?.listTitle).toBe("A birthday gift");
      expect(display?.text?.match(/Peter Bellerby/g)).toHaveLength(1);
      expect(display?.text?.match(/\{\{\d+\}\}/g)).toEqual([
        "{{27}}",
        "{{28}}",
        "{{29}}",
      ]);
    });

    it("deduplicates shared flow-charts and splits downward arrows (↓) into clean vertical steps", () => {
      const group: QuestionGroup = {
        id: "g-flow",
        type: "flowchart_completion",
        questionRange: { start: 8, end: 10 },
        questionIds: ["q8", "q9", "q10"],
      };
      const questions: TestQuestion[] = [
        {
          id: "q8",
          number: 8,
          type: "flowchart_completion",
          prompt:
            "Complete the flow-chart (NO MORE THAN TWO WORDS): Generating biogas for domestic use in Dunga — First, place water hyacinth together with some ________ into a digester ↓ Leave the mixture until the [Q9: ___] is completed ↓ Capture the gas emitted by the digester and use [Q10: ___] to transport it to individual homes ↓ Then use the gas for cooking as well as making water fit for human consumption",
          correctAnswers: ["cow dung"],
          explanation_vi: "",
          explanation_en: "",
        },
        {
          id: "q9",
          number: 9,
          type: "flowchart_completion",
          prompt:
            "Complete the flow-chart (NO MORE THAN TWO WORDS): Generating biogas for domestic use in Dunga — First, place water hyacinth together with some [Q8: ___] into a digester ↓ Leave the mixture until the ________ is completed ↓ Capture the gas emitted by the digester and use [Q10: ___] to transport it to individual homes ↓ Then use the gas for cooking as well as making water fit for human consumption",
          correctAnswers: ["fermentation"],
          explanation_vi: "",
          explanation_en: "",
        },
        {
          id: "q10",
          number: 10,
          type: "flowchart_completion",
          prompt:
            "Complete the flow-chart (NO MORE THAN TWO WORDS): Generating biogas for domestic use in Dunga — First, place water hyacinth together with some [Q8: ___] into a digester ↓ Leave the mixture until the [Q9: ___] is completed ↓ Capture the gas emitted by the digester and use ________ to transport it to individual homes ↓ Then use the gas for cooking as well as making water fit for human consumption",
          correctAnswers: ["pipes"],
          explanation_vi: "",
          explanation_en: "",
        },
      ];

      const display = resolveGroupDisplayContent(group, questions, false);
      expect(display?.kind).toBe("flowchart");
      expect(display?.flowchart?.title).toBe("Generating biogas for domestic use in Dunga");
      expect(display?.flowchart?.steps).toHaveLength(4);
      expect(display?.flowchart?.steps[0]).toBe(
        "First, place water hyacinth together with some {{8}} into a digester"
      );
      expect(display?.flowchart?.steps[1]).toBe(
        "Leave the mixture until the {{9}} is completed"
      );
      expect(display?.flowchart?.steps[2]).toBe(
        "Capture the gas emitted by the digester and use {{10}} to transport it to individual homes"
      );
      expect(display?.flowchart?.steps[3]).toBe(
        "Then use the gas for cooking as well as making water fit for human consumption"
      );
    });

    it("deduplicates shared note_completion blocks across Q11–Q13 without misplacing [Q11: ___]", () => {
      const group: QuestionGroup = {
        id: "g-notes",
        type: "note_completion",
        questionRange: { start: 11, end: 13 },
        questionIds: ["q11", "q12", "q13"],
      };
      const questions: TestQuestion[] = [
        {
          id: "q11",
          number: 11,
          type: "note_completion",
          prompt:
            "Complete the notes (ONE WORD ONLY): Cooking with biogas in Dunga — Benefits: spend so much ________ collecting fuel; bring in [Q12: ___]; Drawbacks: the [Q13: ___] is high.",
          correctAnswers: ["time"],
          explanation_vi: "",
          explanation_en: "",
        },
        {
          id: "q12",
          number: 12,
          type: "note_completion",
          prompt:
            "Complete the notes (ONE WORD ONLY): Cooking with biogas in Dunga — Benefits: spend so much [Q11: ___] collecting fuel; bring in ________; Drawbacks: the [Q13: ___] is high.",
          correctAnswers: ["income"],
          explanation_vi: "",
          explanation_en: "",
        },
        {
          id: "q13",
          number: 13,
          type: "note_completion",
          prompt:
            "Complete the notes (ONE WORD ONLY): Cooking with biogas in Dunga — Benefits: spend so much [Q11: ___] collecting fuel; bring in [Q12: ___]; Drawbacks: the ________ is high.",
          correctAnswers: ["cost"],
          explanation_vi: "",
          explanation_en: "",
        },
      ];

      const display = resolveGroupDisplayContent(group, questions, false);
      expect(display?.kind).toBe("notes");
      expect(display?.notes?.title).toBe("Cooking with biogas in Dunga");
      expect(display?.notes?.sections[0]?.bullets).toHaveLength(1);
      expect(display?.notes?.sections[0]?.bullets[0]).toBe(
        "Benefits: spend so much {{11}} collecting fuel; bring in {{12}}; Drawbacks: the {{13}} is high."
      );
    });
  });
});
