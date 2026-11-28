import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ExamTextAnnotation } from "@/lib/exam-session";
import type { PassageParagraph } from "@/lib/test-groups";
import {
  applyAnnotationsBatch,
  buildParagraphSegments,
  clampAnnotationRange,
  clearAnnotations,
  filterAnnotations,
  popAnnotationHistory,
  prepareFlashcardTerm,
  pushAnnotationHistory,
  removeAnnotationById,
  splitSelectionAcrossParagraphs,
  updateAnnotationById,
  upsertAnnotationWithOverlapResolution,
} from "@/lib/exam-annotations";

describe("Exam Upgrade GĐ4 — Offset Annotations, Floating 5-Button Toolbar & Flashcard Integration", () => {
  const root = process.cwd();

  describe("1. Range clamping & multi-paragraph selection splitting", () => {
    const paragraphs: PassageParagraph[] = [
      { index: 0, label: "A", text: "Paragraph A introduces urban microclimates in megacities." },
      { index: 1, label: "B", text: "Paragraph B explains reflective roof coatings and cool pavements." },
      { index: 2, label: "C", text: "Paragraph C evaluates thermal comfort improvements by 2030." },
    ];

    it("clamps and normalizes single-paragraph ranges cleanly", () => {
      expect(clampAnnotationRange(10, 4, 50)).toEqual({ startOffset: 4, endOffset: 10 });
      expect(clampAnnotationRange(-5, 99, 20)).toEqual({ startOffset: 0, endOffset: 20 });
      expect(clampAnnotationRange(5, 5, 20)).toBeNull();
      expect(clampAnnotationRange(Number.NaN, 5, 20)).toBeNull();
    });

    it("trims leading/trailing whitespace while keeping exact character offsets", () => {
      const chunks = splitSelectionAcrossParagraphs(paragraphs, {
        startParagraphIndex: 0,
        startOffset: 11, // " introduces " -> leading & trailing spaces
        endParagraphIndex: 0,
        endOffset: 23,
      });
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({
        paragraphIndex: 0,
        startOffset: 12,
        endOffset: 22,
        text: "introduces",
      });
      expect(
        paragraphs[0].text.slice(chunks[0].startOffset, chunks[0].endOffset)
      ).toBe("introduces");
    });

    it("splits multi-paragraph selections (including backward drags) into exact per-paragraph chunks", () => {
      // Dragged backwards from Paragraph 2 offset 11 up to Paragraph 0 offset 45
      const chunks = splitSelectionAcrossParagraphs(paragraphs, {
        startParagraphIndex: 2,
        startOffset: 11,
        endParagraphIndex: 0,
        endOffset: 45,
      });
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toMatchObject({
        paragraphIndex: 0,
        text: "megacities.",
      });
      expect(chunks[1]).toMatchObject({
        paragraphIndex: 1,
        startOffset: 0,
        endOffset: paragraphs[1].text.length,
        text: paragraphs[1].text,
      });
      expect(chunks[2]).toMatchObject({
        paragraphIndex: 2,
        startOffset: 0,
        text: "Paragraph C",
      });

      // Verify exact offset fidelity on every chunk
      for (const c of chunks) {
        expect(paragraphs[c.paragraphIndex].text.slice(c.startOffset, c.endOffset)).toBe(
          c.text
        );
      }
    });
  });

  describe("2. Overlap resolution & lossless paragraph segment rendering", () => {
    const sampleText =
      "Meanwhile, for anthropology Professor Kathleen Richardson, the idea seemed dubious.";

    const makeAnn = (
      id: string,
      startOffset: number,
      endOffset: number,
      color: "amber" | "sky" = "amber",
      note?: string
    ): ExamTextAnnotation => ({
      id,
      sectionId: "sec-1",
      paragraphIndex: 0,
      startOffset,
      endOffset,
      text: sampleText.slice(startOffset, endOffset),
      color,
      note,
    });

    it("splits an existing highlight cleanly when a middle portion is re-highlighted with another color", () => {
      const outer = makeAnn("a1", 15, 57, "amber", "Key scholar");
      const middle = makeAnn("a2", 28, 37, "sky"); // "Professor"

      const merged = upsertAnnotationWithOverlapResolution([outer], middle);
      expect(merged).toHaveLength(3);
      expect(merged.map((m) => [m.startOffset, m.endOffset, m.color])).toEqual([
        [15, 28, "amber"],
        [28, 37, "sky"],
        [37, 57, "amber"],
      ]);
      // Existing note stays attached on the left piece, never duplicated
      expect(merged[0].note).toBe("Key scholar");
      expect(merged[2].note).toBeUndefined();

      // Segments reconstruct the exact paragraph text character-for-character
      const segments = buildParagraphSegments(sampleText, merged);
      expect(segments.map((s) => s.text).join("")).toBe(sampleText);
      expect(segments.filter((s) => s.type === "annotation")).toHaveLength(3);
    });

    it("preserves existing note when recoloring exact range or expanding over an existing highlight", () => {
      const original = makeAnn("a1", 28, 37, "amber", "Important title");
      const recolored = makeAnn("a2", 28, 37, "sky");
      const afterRecolor = upsertAnnotationWithOverlapResolution([original], recolored);
      expect(afterRecolor).toHaveLength(1);
      expect(afterRecolor[0].color).toBe("sky");
      expect(afterRecolor[0].note).toBe("Important title");

      const expanded = makeAnn("a3", 15, 57, "amber");
      const afterExpand = upsertAnnotationWithOverlapResolution(afterRecolor, expanded);
      expect(afterExpand).toHaveLength(1);
      expect(afterExpand[0].startOffset).toBe(15);
      expect(afterExpand[0].endOffset).toBe(57);
      expect(afterExpand[0].note).toBe("Important title");
    });

    it("handles partial left/right overlaps and preserves lossless text invariant even with messy inputs", () => {
      const a1 = makeAnn("a1", 0, 20, "amber");
      const a2 = makeAnn("a2", 12, 35, "sky");
      const merged = applyAnnotationsBatch([], [a1, a2]);
      expect(merged.map((m) => [m.startOffset, m.endOffset, m.color])).toEqual([
        [0, 12, "amber"],
        [12, 35, "sky"],
      ]);

      // Even if passed raw overlapping / out-of-bounds annotations directly, buildParagraphSegments never corrupts text
      const messy: ExamTextAnnotation[] = [
        makeAnn("m1", 5, 25, "amber"),
        makeAnn("m2", 15, 40, "sky"),
        { ...makeAnn("m3", 0, 10, "amber"), startOffset: 70, endOffset: 999 },
      ];
      const segments = buildParagraphSegments(sampleText, messy);
      expect(segments.map((s) => s.text).join("")).toBe(sampleText);
    });
  });

  describe("3. CRUD, filtering, Undo history stack & Flashcard term normalization", () => {
    it("supports update, delete, section/full clear, note filtering, and bounded LIFO undo", () => {
      const a1: ExamTextAnnotation = {
        id: "1",
        sectionId: "sec-1",
        paragraphIndex: 0,
        startOffset: 0,
        endOffset: 5,
        text: "Hello",
        color: "amber",
      };
      const a2: ExamTextAnnotation = {
        id: "2",
        sectionId: "sec-2",
        paragraphIndex: 1,
        startOffset: 10,
        endOffset: 20,
        text: "ubiquitous",
        color: "sky",
        note: "Appears everywhere",
      };

      const updated = updateAnnotationById([a1, a2], "1", {
        color: "sky",
        note: "  Greeting  ",
      });
      expect(updated[0]).toMatchObject({ color: "sky", note: "Greeting" });

      expect(filterAnnotations([a1, a2], { onlyNotes: true })).toHaveLength(1);
      expect(removeAnnotationById([a1, a2], "1")).toHaveLength(1);
      expect(clearAnnotations([a1, a2], "sec-1")).toHaveLength(1);
      expect(clearAnnotations([a1, a2])).toEqual([]);

      // Bounded Undo stack
      let history: ExamTextAnnotation[][] = [];
      history = pushAnnotationHistory(history, [], 2);
      history = pushAnnotationHistory(history, [a1], 2);
      history = pushAnnotationHistory(history, [a1, a2], 2);
      expect(history).toHaveLength(2); // Oldest [] evicted

      const firstPop = popAnnotationHistory(history);
      expect(firstPop.previous).toEqual([a1, a2]);
      const secondPop = popAnnotationHistory(firstPop.nextHistory);
      expect(secondPop.previous).toEqual([a1]);
      const emptyPop = popAnnotationHistory(secondPop.nextHistory);
      expect(emptyPop.previous).toBeNull();
    });

    it("normalizes selected passage text cleanly for Save-to-Flashcard modal", () => {
      expect(prepareFlashcardTerm("  morally\n  dubious  ")).toBe("morally dubious");
      expect(prepareFlashcardTerm("a".repeat(150)).length).toBe(100);
    });
  });

  describe("4. GĐ4 UI & Flashcard Integration Contract Verification", () => {
    it("verifies 5-button toolbar, data-no-flashcard-popup, accessibility, drawer, Undo, and z-index layering", () => {
      const passageSrc = fs.readFileSync(
        path.join(root, "src/components/exam/annotatable-passage.tsx"),
        "utf8"
      );
      const drawerSrc = fs.readFileSync(
        path.join(root, "src/components/exam/annotations-drawer.tsx"),
        "utf8"
      );
      const engineSrc = fs.readFileSync(
        path.join(root, "src/components/test-engine-client.tsx"),
        "utf8"
      );
      const flashcardModalSrc = fs.readFileSync(
        path.join(root, "src/components/flashcard-quick-add.tsx"),
        "utf8"
      );

      // 1. Suppresses global flashcard popup inside passage & toolbar
      expect(passageSrc).toContain('data-no-flashcard-popup="true"');
      expect(drawerSrc).toContain('data-no-flashcard-popup="true"');

      // 2. Accessible floating toolbar with arrow-key navigation & >= 44px touch targets
      expect(passageSrc).toContain('role="toolbar"');
      expect(passageSrc).toContain("ArrowLeft");
      expect(passageSrc).toContain("ArrowRight");
      expect(passageSrc).toContain("min-h-[44px]");
      expect(passageSrc).toContain("min-w-[44px]");

      // 3. All 5 toolbar actions: 2 highlight colors, Note, Copy, and Save to Flashcard
      expect(passageSrc).toContain('handleApplyHighlight("amber")');
      expect(passageSrc).toContain('handleApplyHighlight("sky")');
      expect(passageSrc).toContain("setNewNoteMode(true)");
      expect(passageSrc).toContain("handleCopyText");
      expect(passageSrc).toContain("openAddFlashcardModal");
      expect(passageSrc).toContain("Lưu vào Flashcard");
      expect(passageSrc).toContain("Save to Flashcard");

      // 4. Notes drawer features: jump+flash, filter, inline edit, clear all, undo, flashcard
      expect(drawerSrc).toContain("Ghi chú của tôi");
      expect(drawerSrc).toContain("My Notes & Highlights");
      expect(drawerSrc).toContain("onJumpToAnnotation");
      expect(drawerSrc).toContain("onClearAllAnnotations");
      expect(drawerSrc).toContain("onUndo");
      expect(drawerSrc).toContain("openAddFlashcardModal");

      // 5. Wired cleanly into TestEngineClient for Reading + Listening transcripts + Ctrl/Cmd+Z undo
      expect(engineSrc).toContain("AnnotatablePassage");
      expect(engineSrc).toContain("AnnotationsDrawer");
      expect(engineSrc).toContain("handleUndoAnnotation");
      expect(engineSrc).toContain("flashedAnnotationId");
      expect(engineSrc).toContain("::transcript");

      // 6. Flashcard modal renders above Focus Mode (z-50) and Floating Toolbar (z-[60])
      expect(flashcardModalSrc).toContain("z-[70]");
    });
  });
});
