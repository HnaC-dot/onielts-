import type {
  IeltsTest,
  QuestionGroup,
  QuestionType,
  TestQuestion,
  TestSection,
} from "./types";
import type { GradedTestResult } from "./test-grader";
import {
  getPassageParagraphsForGroup,
  normalizeSectionToGroups,
  splitPassageParagraphs,
  type PassageParagraph,
} from "./test-groups";

export type ExamPracticeMode = "full" | "part" | "group";

export type ExamAnnotationColor = "amber" | "sky" | "emerald" | "rose";

export interface ExamTextAnnotation {
  id: string;
  sectionId: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
  color: ExamAnnotationColor;
  note?: string;
  createdAt?: string;
}

export interface ExamDraftPayload {
  testSlug: string;
  modeKey: string;
  answers: Record<string, string>;
  flagged: Record<string, boolean>;
  highlightedLines?: Record<string, boolean>;
  annotations: ExamTextAnnotation[];
  notesText: string;
  timerSeconds: number;
  activeSectionIdx: number;
  updatedAt: string;
}

export interface StoredTestSessionDraft extends ExamDraftPayload {
  userId: string;
}

export const SPLIT_RATIO_STORAGE_KEY = "onielts_exam_split_ratio_v1";
export const DEFAULT_SPLIT_RATIO = 50;
export const MIN_SPLIT_RATIO = 28;
export const MAX_SPLIT_RATIO = 72;

/**
 * Clamps the desktop split-pane left percentage into a safe readable range [28, 72].
 */
export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return DEFAULT_SPLIT_RATIO;
  const clamped = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
  return Math.round(clamped * 10) / 10;
}

function sanitizeModeSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/**
 * Builds a deterministic draft scope key so Full / Part / Group sessions
 * never overwrite each other's saved progress.
 */
export function buildModeKey(
  mode: ExamPracticeMode,
  sectionIdx = 0,
  groupId?: string
): string {
  if (mode === "part") {
    const safeIdx = Number.isFinite(sectionIdx) ? Math.max(0, Math.floor(sectionIdx)) : 0;
    return `part:${safeIdx}`;
  }
  if (mode === "group") {
    const safeGroup = sanitizeModeSegment(groupId || "g0") || "g0";
    return `group:${safeGroup}`;
  }
  return "full";
}

/**
 * Builds the localStorage key for an exam session draft.
 */
export function buildDraftStorageKey(testSlug: string, modeKey: string): string {
  return `onielts_exam_draft_v1:${testSlug}:${modeKey}`;
}

export function countFilledAnswers(answers?: Record<string, string> | null): number {
  if (!answers) return 0;
  let count = 0;
  for (const val of Object.values(answers)) {
    if (typeof val === "string" && val.trim().length > 0) {
      count += 1;
    }
  }
  return count;
}

export function hasMeaningfulDraftContent(
  draft?: Partial<ExamDraftPayload> | null
): boolean {
  if (!draft) return false;
  if (countFilledAnswers(draft.answers) > 0) return true;
  if (draft.flagged && Object.values(draft.flagged).some(Boolean)) return true;
  if (draft.highlightedLines && Object.values(draft.highlightedLines).some(Boolean)) {
    return true;
  }
  if (Array.isArray(draft.annotations) && draft.annotations.length > 0) return true;
  if (typeof draft.notesText === "string" && draft.notesText.trim().length > 0) {
    return true;
  }
  return false;
}

/**
 * Merges a localStorage draft snapshot and a server-synced draft snapshot,
 * selecting the newest meaningful snapshot cleanly.
 */
export function mergeDraftSnapshots(
  local: ExamDraftPayload | null,
  remote: ExamDraftPayload | null
): ExamDraftPayload | null {
  const localValid = local && hasMeaningfulDraftContent(local) ? local : null;
  const remoteValid = remote && hasMeaningfulDraftContent(remote) ? remote : null;

  if (!localValid && !remoteValid) return null;
  if (localValid && !remoteValid) return localValid;
  if (!localValid && remoteValid) return remoteValid;

  const localTs = Date.parse(localValid!.updatedAt);
  const remoteTs = Date.parse(remoteValid!.updatedAt);

  const localTime = Number.isFinite(localTs) ? localTs : 0;
  const remoteTime = Number.isFinite(remoteTs) ? remoteTs : 0;

  if (localTime > remoteTime) {
    // Preserve server annotations if local snapshot has none (e.g. from another device)
    return {
      ...localValid!,
      annotations:
        localValid!.annotations.length > 0
          ? localValid!.annotations
          : remoteValid!.annotations,
    };
  }

  if (remoteTime > localTime) {
    return {
      ...remoteValid!,
      highlightedLines:
        remoteValid!.highlightedLines &&
        Object.keys(remoteValid!.highlightedLines).length > 0
          ? remoteValid!.highlightedLines
          : localValid!.highlightedLines,
    };
  }

  // Tie-breaker: prefer snapshot with more answered questions (or remote if equal)
  const localCount = countFilledAnswers(localValid!.answers);
  const remoteCount = countFilledAnswers(remoteValid!.answers);
  return localCount > remoteCount ? localValid! : remoteValid!;
}

export interface RelevantPassageResolution {
  paragraphs: PassageParagraph[];
  isFiltered: boolean;
  totalParagraphs: number;
  inferredFrom: "explicit" | "prompt" | "none";
}

function expandParagraphLetterRange(startChar: string, endChar: string): string[] {
  const start = startChar.toUpperCase().charCodeAt(0);
  const end = endChar.toUpperCase().charCodeAt(0);
  if (end < start || end - start > 12) return [startChar.toUpperCase()];
  const out: string[] = [];
  for (let code = start; code <= end; code += 1) {
    out.push(String.fromCharCode(code));
  }
  return out;
}

/**
 * Resolves the relevant paragraphs to display for a QuestionGroup in Group Practice mode.
 *
 * Security & fairness guarantee:
 * - Uses explicit `group.passageRange` first when authored.
 * - Otherwise inspects ONLY client-visible text (`group.title`, `group.instruction`,
 *   and `question.prompt`) for explicit paragraph/section mentions like "Paragraph B"
 *   or "Paragraphs C–E". NEVER reads `sectionRef` or answer explanations.
 * - Falls back to the full passage whenever no strict subset is determinable.
 */
export function inferRelevantPassageForGroup(
  section: TestSection,
  group: QuestionGroup | undefined,
  questions: TestQuestion[]
): RelevantPassageResolution {
  const all = splitPassageParagraphs(section.passage);
  if (!group || all.length === 0) {
    return {
      paragraphs: all,
      isFiltered: false,
      totalParagraphs: all.length,
      inferredFrom: "none",
    };
  }

  // 1. Explicit passageRange authored on the group
  if (group.passageRange) {
    const explicit = getPassageParagraphsForGroup(section.passage, group.passageRange);
    if (explicit.isFiltered) {
      return {
        ...explicit,
        inferredFrom: "explicit",
      };
    }
  }

  // 2. Fallback: explicit paragraph/section mentions already visible in group/prompt text
  const visibleCorpus = [
    group.title ?? "",
    group.instruction ?? "",
    ...questions.map((q) => q.prompt ?? ""),
  ].join("\n");

  const labelSet = new Set<string>();

  // Match "Paragraph C–E", "Paragraphs B to D", "Section A-C", "Paragraph B"
  const rangeRegex =
    /\b(?:Paragraphs?|Sections?)\s+([A-Z])(?:\s*(?:[-–—]|to)\s*([A-Z]))?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(visibleCorpus)) !== null) {
    const start = match[1].toUpperCase();
    const end = match[2]?.toUpperCase();
    if (end) {
      for (const letter of expandParagraphLetterRange(start, end)) {
        labelSet.add(letter);
      }
    } else {
      labelSet.add(start);
    }
  }

  // Match "Paragraphs B and C", "Sections A, B & C"
  const listRegex =
    /\b(?:Paragraphs|Sections)\s+([A-Z](?:\s*(?:,|and|&)\s*[A-Z])+)\b/gi;
  while ((match = listRegex.exec(visibleCorpus)) !== null) {
    const letters = match[1].match(/[A-Z]/gi) ?? [];
    for (const l of letters) {
      labelSet.add(l.toUpperCase());
    }
  }

  if (labelSet.size > 0) {
    const inferred = getPassageParagraphsForGroup(section.passage, {
      paragraphLabels: [...labelSet],
    });
    if (inferred.isFiltered) {
      return {
        ...inferred,
        inferredFrom: "prompt",
      };
    }
  }

  return {
    paragraphs: all,
    isFiltered: false,
    totalParagraphs: all.length,
    inferredFrom: "none",
  };
}

export interface SubsetGradingSummary {
  rawScore: number;
  maxScore: number;
  accuracyPercent: number;
  breakdownByType: Partial<Record<QuestionType, { correct: number; total: number }>>;
}

/**
 * Computes scoped grading metrics for Part or Group practice mode without
 * presenting a misleading official Band score for partial question subsets.
 */
export function computeSubsetGradingSummary(
  graded: GradedTestResult,
  scopedQuestionIds: string[]
): SubsetGradingSummary {
  const idSet = new Set(scopedQuestionIds);
  const scopedDetails = graded.details.filter((d) => idSet.has(d.questionId));
  const maxScore = scopedDetails.length;
  let rawScore = 0;
  const breakdownByType: Partial<
    Record<QuestionType, { correct: number; total: number }>
  > = {};

  for (const item of scopedDetails) {
    if (item.isCorrect) rawScore += 1;
    const entry = breakdownByType[item.type] ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (item.isCorrect) entry.correct += 1;
    breakdownByType[item.type] = entry;
  }

  const accuracyPercent =
    maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;

  return {
    rawScore,
    maxScore,
    accuracyPercent,
    breakdownByType,
  };
}

export interface ResolvedPracticeModeParams {
  practiceMode: ExamPracticeMode;
  sectionIdx: number;
  groupId?: string;
}

/**
 * Safely resolves URL searchParams (`?mode=part&part=2` or `?mode=group&group=...`)
 * against the given IELTS test sections and groups.
 */
export function parsePracticeModeQuery(
  query: { mode?: string; part?: string; group?: string },
  test: IeltsTest
): ResolvedPracticeModeParams {
  const rawMode = (query.mode ?? "").toLowerCase().trim();
  const sections = test.sections ?? [];
  const sectionCount = sections.length;

  let practiceMode: ExamPracticeMode = "full";
  if (rawMode === "part") practiceMode = "part";
  else if (rawMode === "group") practiceMode = "group";

  // Allow 1-indexed `?part=1..N` in user-facing URLs
  let sectionIdx = 0;
  if (query.part) {
    const parsedPart = Number.parseInt(query.part, 10);
    if (Number.isFinite(parsedPart) && parsedPart >= 1 && parsedPart <= sectionCount) {
      sectionIdx = parsedPart - 1;
    }
  }

  let groupId: string | undefined;
  if (practiceMode === "group" && sectionCount > 0) {
    if (query.group) {
      for (let i = 0; i < sectionCount; i += 1) {
        const groups = normalizeSectionToGroups(sections[i]);
        const found = groups.find((g) => g.id === query.group);
        if (found) {
          sectionIdx = i;
          groupId = found.id;
          break;
        }
      }
    }
    if (!groupId) {
      const fallbackGroups = normalizeSectionToGroups(sections[sectionIdx]);
      groupId = fallbackGroups[0]?.id;
    }
  }

  return { practiceMode, sectionIdx, groupId };
}
