import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
});
