import type { BandConversionRow, IeltsTest, QuestionType } from "./types";
import { convertRawToBand } from "./band-calculator";
import { normalizeSectionToGroups } from "./test-groups";

export interface QuestionGradeDetail {
  questionId: string;
  number: number;
  type: QuestionType;
  userAnswer: string;
  acceptedAnswers: string[];
  isCorrect: boolean;
  explanation_vi: string;
  explanation_en: string;
  sectionRef?: string;
}

export interface GradedTestResult {
  rawScore: number;
  maxScore: number;
  accuracyPercent: number;
  isFullIeltsTest: boolean;
  /**
   * Official IELTS Band score (0.0–9.0) is ONLY assigned on full 40-question tests.
   * For shorter practice sprints (< 40 questions), bandScore is null so learners
   * are never misled by inflated Band 9.0 scores from tiny question sets.
   */
  bandScore: number | null;
  breakdownByType: Record<string, { correct: number; total: number }>;
  details: QuestionGradeDetail[];
}

export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeMultiTokens(raw: string): string[] {
  return raw
    .split(/[,|&]+|\band\b/i)
    .map((part) => {
      const norm = normalizeAnswer(part);
      // Extract leading option letter e.g. "B. Electric buses" -> "b"
      const letterMatch = norm.match(/^([a-z])(?:\s+|$)/);
      return letterMatch && norm.length > 2 ? letterMatch[1] : norm;
    })
    .filter(Boolean)
    .sort();
}

export function isAnswerCorrect(
  userAnswer: string,
  acceptedAnswers: string[],
  questionType?: QuestionType
): boolean {
  const normUser = normalizeAnswer(userAnswer);
  if (!normUser) return false;

  if (questionType === "mcq_multi") {
    const userTokens = normalizeMultiTokens(userAnswer);
    if (userTokens.length === 0) return false;
    const userSig = userTokens.join(",");
    return acceptedAnswers.some((acc) => {
      const accTokens = normalizeMultiTokens(acc);
      return accTokens.length > 0 && accTokens.join(",") === userSig;
    });
  }

  return acceptedAnswers.some((acc) => {
    const normAcc = normalizeAnswer(acc);
    if (normUser === normAcc) return true;
    // Allow matching letter prefix for MCQ e.g. user selects "B. Fish sensory lines" and key is "B"
    if (normAcc.length === 1 && normUser.startsWith(`${normAcc} `)) return true;
    return false;
  });
}

/**
 * Strips all answer keys, bilingual explanations, and passage evidence references
 * before serializing a test into a client component (prevents answer leakage via DevTools/SSR HTML).
 * Also converts legacy sections into normalized `QuestionGroup[]` at read time without mutating DB data.
 */
export function sanitizeTestForClient(test: IeltsTest): IeltsTest {
  return {
    ...test,
    sections: test.sections.map((section) => {
      const groups = normalizeSectionToGroups(section);
      return {
        ...section,
        groups,
        questions: section.questions.map((q) => ({
          id: q.id,
          number: q.number,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correctAnswers: [],
          explanation_vi: "",
          explanation_en: "",
          sectionRef: undefined,
          groupId: q.groupId,
        })),
      };
    }),
  };
}

export function gradeObjectiveTest(
  test: IeltsTest,
  answers: Record<string, string>,
  conversionTable: BandConversionRow[]
): GradedTestResult {
  const allQuestions = test.sections.flatMap((s) => s.questions);
  const details: QuestionGradeDetail[] = [];
  const breakdownByType: Record<string, { correct: number; total: number }> = {};
  let rawScore = 0;

  for (const q of allQuestions) {
    const userAns = answers[q.id] ?? "";
    const correct = isAnswerCorrect(userAns, q.correctAnswers, q.type);
    if (correct) rawScore += 1;

    if (!breakdownByType[q.type]) {
      breakdownByType[q.type] = { correct: 0, total: 0 };
    }
    breakdownByType[q.type].total += 1;
    if (correct) breakdownByType[q.type].correct += 1;

    details.push({
      questionId: q.id,
      number: q.number,
      type: q.type,
      userAnswer: userAns,
      acceptedAnswers: q.correctAnswers,
      isCorrect: correct,
      explanation_vi: q.explanation_vi,
      explanation_en: q.explanation_en,
      sectionRef: q.sectionRef,
    });
  }

  const maxScore = allQuestions.length;
  const accuracyPercent =
    maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;
  const isFullIeltsTest = maxScore >= 40;

  const conversionSkill =
    test.skill === "listening"
      ? "listening"
      : test.module === "general"
      ? "reading_general"
      : "reading_academic";

  const bandScore =
    isFullIeltsTest && maxScore > 0
      ? convertRawToBand(rawScore, conversionSkill, conversionTable, maxScore)
      : null;

  return {
    rawScore,
    maxScore,
    accuracyPercent,
    isFullIeltsTest,
    bandScore,
    breakdownByType,
    details,
  };
}
