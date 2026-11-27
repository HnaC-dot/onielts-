import type { IeltsSkill, QuestionType } from "./types";

export const QUESTION_TYPE_LABELS: Record<
  QuestionType,
  { vi: string; en: string; short: string }
> = {
  tfng: { vi: "True / False / Not Given", en: "True / False / Not Given", short: "T/F/NG" },
  ynng: { vi: "Yes / No / Not Given", en: "Yes / No / Not Given", short: "Y/N/NG" },
  mcq: { vi: "Trắc nghiệm (1 đáp án)", en: "Multiple Choice", short: "MCQ" },
  mcq_multi: { vi: "Trắc nghiệm (nhiều đáp án)", en: "Multiple Choice (Multi)", short: "MCQ Multi" },
  matching_headings: { vi: "Nối tiêu đề (Matching Headings)", en: "Matching Headings", short: "Headings" },
  matching_info: { vi: "Nối thông tin (Matching Info)", en: "Matching Information", short: "Matching Info" },
  sentence_completion: { vi: "Điền vào câu", en: "Sentence Completion", short: "Sentence" },
  summary_completion: { vi: "Điền đoạn tóm tắt", en: "Summary Completion", short: "Summary" },
  table_completion: { vi: "Điền bảng biểu", en: "Table Completion", short: "Table" },
  note_completion: { vi: "Điền ghi chú", en: "Note Completion", short: "Note" },
  flowchart_completion: { vi: "Điền lưu đồ (Flowchart)", en: "Flowchart Completion", short: "Flowchart" },
  map_labelling: { vi: "Điền nhãn bản đồ / sơ đồ", en: "Map / Diagram Labelling", short: "Map/Diagram" },
  short_answer: { vi: "Trả lời ngắn", en: "Short Answer", short: "Short Answer" },
};

export function getQuestionTypeLabel(type: string, isEn = false): string {
  const found = QUESTION_TYPE_LABELS[type as QuestionType];
  if (!found) return type.replace(/_/g, " ");
  return isEn ? found.en : found.vi;
}

/**
 * Returns the previous calendar date string (YYYY-MM-DD) for a given YYYY-MM-DD date.
 */
export function getPreviousDateString(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Computes the next study streak count using Vietnam calendar dates (YYYY-MM-DD):
 * - Same day -> unchanged (at least 1)
 * - Consecutive day (yesterday) -> prevStreak + 1
 * - Gap > 1 day or first activity -> reset to 1
 */
export function computeNextStreak(
  lastActiveDate: string | null | undefined,
  currentStreak: number,
  vnToday: string
): { streakCount: number; changed: boolean } {
  const cleanPrev = (lastActiveDate ?? "").slice(0, 10);
  if (cleanPrev === vnToday) {
    const safe = Math.max(1, currentStreak);
    return { streakCount: safe, changed: safe !== currentStreak };
  }
  const yesterday = getPreviousDateString(vnToday);
  if (cleanPrev && cleanPrev === yesterday) {
    return { streakCount: Math.max(1, currentStreak) + 1, changed: true };
  }
  return { streakCount: 1, changed: true };
}

export function calculateBandGap(
  currentBand: number | null,
  targetBand: number
): number | null {
  if (currentBand === null || !Number.isFinite(currentBand)) return null;
  return Math.round((targetBand - currentBand) * 10) / 10;
}

export function formatStudyTime(seconds: number, isEn = false): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) {
    return isEn ? `${safe}s` : `${safe} giây`;
  }
  const mins = Math.round(safe / 60);
  if (mins < 60) {
    return isEn ? `${mins}m` : `${mins} phút`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (remMins === 0) {
    return isEn ? `${hours}h` : `${hours} giờ`;
  }
  return isEn ? `${hours}h ${remMins}m` : `${hours}g ${remMins}p`;
}

// =============================================================================
// SHARED PAYLOAD INTERFACES
// =============================================================================
export interface SkillBandPoint {
  date: string; // ISO
  label: string; // e.g. "26/11"
  band: number;
  title: string;
}

export interface QuestionTypeStatItem {
  type: string;
  labelVi: string;
  labelEn: string;
  correct: number;
  wrong: number;
  total: number;
  accuracyPercent: number;
  practiceHref: string;
  practiceTestTitle?: string;
}

export interface RecommendedPracticeItem {
  reasonVi: string;
  reasonEn: string;
  titleVi: string;
  titleEn: string;
  skill: IeltsSkill;
  href: string;
  weakType?: string;
  badgeText: string;
}

export interface ProgressSummaryPayload {
  isPremium: boolean;
  targetBand: number;
  streakCount: number;
  weeklyStudySeconds: number;
  counts: {
    testsCompleted: number;
    dailyExamsCompleted: number;
    writingCount: number;
    speakingCount: number;
    flashcardsTotal: number;
    flashcardsLearned: number;
  };
  estimatedBands: {
    reading: number | null;
    listening: number | null;
    writing: number | null;
    speaking: number | null;
    overall: number | null;
  };
  latestScores: {
    reading: { band: number; rawScore: number; maxScore: number; completedAt: string; title: string } | null;
    listening: { band: number; rawScore: number; maxScore: number; completedAt: string; title: string } | null;
    writing: { band: number; taskType: string; completedAt: string } | null;
    speaking: { band: number; part: string; completedAt: string } | null;
  };
  /** Populated ONLY when server confirms user.isPremium === true (or admin) */
  charts: {
    reading: SkillBandPoint[];
    listening: SkillBandPoint[];
    writing: SkillBandPoint[];
    speaking: SkillBandPoint[];
  } | null;
  questionTypeStats: QuestionTypeStatItem[] | null;
  recommendations: RecommendedPracticeItem[] | null;
  /** Safe teaser metadata for Free users (never exposes private locked breakdown) */
  lockedMeta: {
    trackedQuestionTypesCount: number;
    chartPointsCount: number;
  };
  courseProgress: Array<{
    courseId: string;
    slug: string;
    titleVi: string;
    titleEn: string;
    progressPercent: number;
  }>;
}

export type HistorySkillFilter =
  | "all"
  | "reading"
  | "listening"
  | "writing"
  | "speaking"
  | "daily";

export interface ProgressHistoryItem {
  id: string;
  kind: "test" | "daily" | "writing" | "speaking";
  skill: IeltsSkill;
  title: string;
  subtitle: string;
  testSlug?: string;
  rawScore?: number;
  maxScore?: number;
  bandScore: number | null;
  durationSeconds: number;
  completedAt: string;
  isPublic?: boolean;
}

export interface ProgressHistoryPage {
  items: ProgressHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProgressAttemptReviewPayload {
  kind: "test" | "daily" | "writing" | "speaking";
  id: string;
  title: string;
  skill: IeltsSkill;
  completedAt: string;
  durationSeconds: number;
  rawScore?: number;
  maxScore?: number;
  bandScore: number | null;
  testSlug?: string;
  breakdownByType?: Record<string, { correct: number; total: number }>;
  questionDetails?: Array<{
    questionId: string;
    number: number;
    type: string;
    prompt: string;
    userAnswer: string;
    acceptedAnswers: string[];
    isCorrect: boolean;
    explanationVi: string;
    explanationEn: string;
    sectionRef?: string;
  }>;
  writingReview?: {
    taskType: string;
    promptText: string;
    essayText: string;
    wordCount: number;
    isPublic: boolean;
    summaryVi: string;
    criteria: {
      taskResponse: { band: number; feedbackVi: string };
      coherenceCohesion: { band: number; feedbackVi: string };
      lexicalResource: { band: number; feedbackVi: string };
      grammaticalRange: { band: number; feedbackVi: string };
    };
    band8Rewrite: string;
  };
  speakingReview?: {
    part: string;
    promptText: string;
    transcript: string;
    isPublic: boolean;
    criteria: {
      fluencyCoherence: { band: number; feedbackVi: string };
      lexicalResource: { band: number; feedbackVi: string };
      grammaticalRange: { band: number; feedbackVi: string };
      pronunciation: { band: number; feedbackVi: string; referenceNoteVi: string };
    };
    improvedAnswer: string;
  };
}

export interface AdminAnonymousAnalyticsPayload {
  totals: {
    testAttempts: number;
    dailyExamAttempts: number;
    writingSubmissions: number;
    speakingSubmissions: number;
    trackedAnswers: number;
  };
  topTests: Array<{
    testId: string;
    testSlug: string;
    testTitle: string;
    skill: IeltsSkill;
    attemptCount: number;
    avgAccuracyPercent: number;
    avgBand: number | null;
  }>;
  hardestQuestions: Array<{
    testId: string;
    testSlug: string;
    testTitle: string;
    skill: IeltsSkill;
    questionNumber: number;
    questionType: string;
    promptSnippet: string;
    totalAnswers: number;
    wrongAnswers: number;
    wrongRatePercent: number;
  }>;
  questionTypeOverview: Array<{
    type: string;
    labelVi: string;
    totalAnswers: number;
    wrongAnswers: number;
    wrongRatePercent: number;
  }>;
  answerTableReady: boolean;
}
