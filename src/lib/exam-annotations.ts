import type { ExamAnnotationColor, ExamTextAnnotation } from "./exam-session";
import type { PassageParagraph } from "./test-groups";

export const MAX_ANNOTATION_HISTORY = 30;
export const MAX_ANNOTATION_TEXT_LEN = 1000;
export const MAX_ANNOTATION_NOTE_LEN = 1000;

export interface ParagraphSelectionRange {
  startParagraphIndex: number;
  startOffset: number;
  endParagraphIndex: number;
  endOffset: number;
}

export interface SplitParagraphRange {
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

export interface ParagraphRenderSegment {
  type: "text" | "annotation";
  text: string;
  startOffset: number;
  endOffset: number;
  annotation?: ExamTextAnnotation;
}

export function createAnnotationId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `ann-${Date.now().toString(36)}-${rand}`;
}

/**
 * Clamps and normalizes a character offset range within [0, maxLength].
 * Returns null if the resulting range is empty.
 */
export function clampAnnotationRange(
  startOffset: number,
  endOffset: number,
  maxLength: number
): { startOffset: number; endOffset: number } | null {
  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || maxLength <= 0) {
    return null;
  }
  const rawStart = Math.floor(Math.min(startOffset, endOffset));
  const rawEnd = Math.floor(Math.max(startOffset, endOffset));
  const clampedStart = Math.max(0, Math.min(maxLength, rawStart));
  const clampedEnd = Math.max(0, Math.min(maxLength, rawEnd));
  if (clampedEnd <= clampedStart) return null;
  return { startOffset: clampedStart, endOffset: clampedEnd };
}

/**
 * Trims leading/trailing whitespace from a slice while keeping exact character offsets.
 */
function trimSliceWithOffsets(
  paragraphText: string,
  startOffset: number,
  endOffset: number
): { startOffset: number; endOffset: number; text: string } | null {
  const clamped = clampAnnotationRange(startOffset, endOffset, paragraphText.length);
  if (!clamped) return null;

  let s = clamped.startOffset;
  let e = clamped.endOffset;
  while (s < e && /\s/.test(paragraphText[s] ?? "")) {
    s += 1;
  }
  while (e > s && /\s/.test(paragraphText[e - 1] ?? "")) {
    e -= 1;
  }
  if (e <= s) return null;

  return {
    startOffset: s,
    endOffset: e,
    text: paragraphText.slice(s, e).slice(0, MAX_ANNOTATION_TEXT_LEN),
  };
}

/**
 * Splits a single- or multi-paragraph text selection into exact per-paragraph
 * character offset ranges, normalizing backward drags cleanly.
 */
export function splitSelectionAcrossParagraphs(
  paragraphs: PassageParagraph[],
  selection: ParagraphSelectionRange
): SplitParagraphRange[] {
  if (paragraphs.length === 0) return [];

  let startP = selection.startParagraphIndex;
  let startOff = selection.startOffset;
  let endP = selection.endParagraphIndex;
  let endOff = selection.endOffset;

  // Normalize backward drag across paragraphs or within the same paragraph
  if (startP > endP || (startP === endP && startOff > endOff)) {
    [startP, endP] = [endP, startP];
    [startOff, endOff] = [endOff, startOff];
  }

  const ordered = [...paragraphs]
    .filter((p) => p.index >= startP && p.index <= endP)
    .sort((a, b) => a.index - b.index);

  const chunks: SplitParagraphRange[] = [];

  for (const para of ordered) {
    const segStart = para.index === startP ? startOff : 0;
    const segEnd = para.index === endP ? endOff : para.text.length;
    const trimmed = trimSliceWithOffsets(para.text, segStart, segEnd);
    if (!trimmed) continue;
    chunks.push({
      paragraphIndex: para.index,
      startOffset: trimmed.startOffset,
      endOffset: trimmed.endOffset,
      text: trimmed.text,
    });
  }

  return chunks;
}

export function sortAnnotations(
  annotations: ExamTextAnnotation[]
): ExamTextAnnotation[] {
  return [...annotations].sort((a, b) => {
    if (a.sectionId !== b.sectionId) {
      return a.sectionId.localeCompare(b.sectionId);
    }
    if (a.paragraphIndex !== b.paragraphIndex) {
      return a.paragraphIndex - b.paragraphIndex;
    }
    if (a.startOffset !== b.startOffset) {
      return a.startOffset - b.startOffset;
    }
    return a.endOffset - b.endOffset;
  });
}

function sliceAnnotationText(
  ann: ExamTextAnnotation,
  newStart: number,
  newEnd: number
): string {
  const relStart = Math.max(0, newStart - ann.startOffset);
  const relEnd = Math.max(relStart, newEnd - ann.startOffset);
  return ann.text.slice(relStart, relEnd);
}

/**
 * Inserts or updates an annotation while cleanly resolving any overlapping
 * annotations inside the same (sectionId, paragraphIndex):
 * - Non-overlapping annotations remain untouched.
 * - Exact-match range updates color and preserves existing note unless overwritten.
 * - Fully enclosed annotations are replaced (inheriting their note if incoming has none).
 * - Partially overlapping annotations are trimmed or split cleanly around the incoming
 *   range so rendered `<mark>` elements NEVER overlap or nest.
 */
export function upsertAnnotationWithOverlapResolution(
  existing: ExamTextAnnotation[],
  incoming: ExamTextAnnotation
): ExamTextAnnotation[] {
  if (incoming.endOffset <= incoming.startOffset) {
    return existing;
  }

  const normalizedIncoming: ExamTextAnnotation = {
    ...incoming,
    text: incoming.text.slice(0, MAX_ANNOTATION_TEXT_LEN),
    note: incoming.note?.trim()
      ? incoming.note.trim().slice(0, MAX_ANNOTATION_NOTE_LEN)
      : undefined,
    createdAt: incoming.createdAt ?? new Date().toISOString(),
  };

  const next: ExamTextAnnotation[] = [];
  let inheritedNote = normalizedIncoming.note;

  for (const ann of existing) {
    if (
      ann.sectionId !== normalizedIncoming.sectionId ||
      ann.paragraphIndex !== normalizedIncoming.paragraphIndex
    ) {
      next.push(ann);
      continue;
    }

    // Disjoint: completely before or completely after incoming
    if (
      ann.endOffset <= normalizedIncoming.startOffset ||
      ann.startOffset >= normalizedIncoming.endOffset
    ) {
      next.push(ann);
      continue;
    }

    // Exact match or fully enclosed inside incoming
    if (
      normalizedIncoming.startOffset <= ann.startOffset &&
      normalizedIncoming.endOffset >= ann.endOffset
    ) {
      if (!inheritedNote && ann.note) {
        inheritedNote = ann.note;
      }
      continue;
    }

    // Partial overlap: trim left and/or right remainder of existing annotation
    const hasLeft = ann.startOffset < normalizedIncoming.startOffset;
    const hasRight = ann.endOffset > normalizedIncoming.endOffset;

    if (hasLeft) {
      const leftEnd = normalizedIncoming.startOffset;
      next.push({
        ...ann,
        endOffset: leftEnd,
        text: sliceAnnotationText(ann, ann.startOffset, leftEnd),
      });
    }

    if (hasRight) {
      const rightStart = normalizedIncoming.endOffset;
      next.push({
        ...ann,
        id: hasLeft ? `${ann.id}-r` : ann.id,
        startOffset: rightStart,
        text: sliceAnnotationText(ann, rightStart, ann.endOffset),
        note: hasLeft ? undefined : ann.note,
      });
    }
  }

  next.push({
    ...normalizedIncoming,
    note: inheritedNote,
  });

  return sortAnnotations(next);
}

/**
 * Applies a batch of annotations (e.g. from a multi-paragraph selection) in order.
 */
export function applyAnnotationsBatch(
  existing: ExamTextAnnotation[],
  incomingList: ExamTextAnnotation[]
): ExamTextAnnotation[] {
  let acc = existing;
  for (const item of incomingList) {
    acc = upsertAnnotationWithOverlapResolution(acc, item);
  }
  return acc;
}

export function updateAnnotationById(
  existing: ExamTextAnnotation[],
  id: string,
  patch: { color?: ExamAnnotationColor; note?: string | null }
): ExamTextAnnotation[] {
  return existing.map((ann) => {
    if (ann.id !== id) return ann;
    const nextColor = patch.color ?? ann.color;
    let nextNote = ann.note;
    if (patch.note !== undefined) {
      const cleaned = (patch.note ?? "").trim();
      nextNote = cleaned ? cleaned.slice(0, MAX_ANNOTATION_NOTE_LEN) : undefined;
    }
    return {
      ...ann,
      color: nextColor,
      note: nextNote,
    };
  });
}

export function removeAnnotationById(
  existing: ExamTextAnnotation[],
  id: string
): ExamTextAnnotation[] {
  return existing.filter((ann) => ann.id !== id);
}

export function clearAnnotations(
  existing: ExamTextAnnotation[],
  sectionId?: string
): ExamTextAnnotation[] {
  if (!sectionId) return [];
  return existing.filter((ann) => ann.sectionId !== sectionId);
}

/**
 * Splits a single paragraph string into contiguous plain-text and annotated segments.
 * Invariant: concatenating `segments.map(s => s.text).join("")` ALWAYS equals `paragraphText`.
 */
export function buildParagraphSegments(
  paragraphText: string,
  paragraphAnnotations: ExamTextAnnotation[]
): ParagraphRenderSegment[] {
  if (!paragraphText) return [];
  if (paragraphAnnotations.length === 0) {
    return [
      {
        type: "text",
        text: paragraphText,
        startOffset: 0,
        endOffset: paragraphText.length,
      },
    ];
  }

  const sorted = [...paragraphAnnotations].sort((a, b) => {
    if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
    return a.endOffset - b.endOffset;
  });

  const segments: ParagraphRenderSegment[] = [];
  let cursor = 0;

  for (const ann of sorted) {
    const start = Math.max(cursor, Math.min(paragraphText.length, ann.startOffset));
    const end = Math.max(start, Math.min(paragraphText.length, ann.endOffset));
    if (end <= start) continue;

    if (start > cursor) {
      segments.push({
        type: "text",
        text: paragraphText.slice(cursor, start),
        startOffset: cursor,
        endOffset: start,
      });
    }

    segments.push({
      type: "annotation",
      text: paragraphText.slice(start, end),
      startOffset: start,
      endOffset: end,
      annotation: ann,
    });

    cursor = end;
  }

  if (cursor < paragraphText.length) {
    segments.push({
      type: "text",
      text: paragraphText.slice(cursor),
      startOffset: cursor,
      endOffset: paragraphText.length,
    });
  }

  return segments;
}

export function pushAnnotationHistory(
  history: ExamTextAnnotation[][],
  snapshot: ExamTextAnnotation[],
  maxDepth = MAX_ANNOTATION_HISTORY
): ExamTextAnnotation[][] {
  const next = [...history, snapshot];
  if (next.length > maxDepth) {
    return next.slice(next.length - maxDepth);
  }
  return next;
}

export function popAnnotationHistory(history: ExamTextAnnotation[][]): {
  previous: ExamTextAnnotation[] | null;
  nextHistory: ExamTextAnnotation[][];
} {
  if (history.length === 0) {
    return { previous: null, nextHistory: history };
  }
  const previous = history[history.length - 1] ?? null;
  return {
    previous,
    nextHistory: history.slice(0, -1),
  };
}

export function filterAnnotations(
  annotations: ExamTextAnnotation[],
  opts?: { sectionId?: string; onlyNotes?: boolean }
): ExamTextAnnotation[] {
  return sortAnnotations(annotations).filter((ann) => {
    if (opts?.sectionId && ann.sectionId !== opts.sectionId) return false;
    if (opts?.onlyNotes && !(ann.note && ann.note.trim().length > 0)) return false;
    return true;
  });
}

/**
 * Cleans selected passage text into a concise vocabulary term/phrase suitable
 * for Ôn IELTS's Save-to-Flashcard modal (max 100 chars).
 */
export function prepareFlashcardTerm(selectedText: string): string {
  return selectedText.replace(/\s+/g, " ").trim().slice(0, 100);
}
