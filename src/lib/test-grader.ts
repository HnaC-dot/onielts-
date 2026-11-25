import type { BandConversionRow, IeltsTest, QuestionType } from "./types";
import { convertRawToBand } from "./band-calculator";

export interface QuestionGradeDetail {
  questionId: string;
  number: number;
  type: QuestionType;
  userAnswer: string;
  acceptedAnswers: string[];
  isCorrect: boolean;
  explanation_vi: string;
  explanation_en: string;
}

export interface GradedTestResult {
  rawScore: number;
  maxScore: number;
  bandScore: number;
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

export function isAnswerCorrect(userAnswer: string, acceptedAnswers: string[]): boolean {
  const normUser = normalizeAnswer(userAnswer);
  if (!normUser) return false;
  return acceptedAnswers.some((acc) => {
    const normAcc = normalizeAnswer(acc);
    if (normUser === normAcc) return true;
    // Allow matching letter prefix for MCQ e.g. user selects "B. Fish sensory lines" and key is "B"
    if (normAcc.length === 1 && normUser.startsWith(`${normAcc} `)) return true;
    return false;
  });
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
    const correct = isAnswerCorrect(userAns, q.correctAnswers);
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
    });
  }

  const maxScore = allQuestions.length;
  const conversionSkill =
    test.skill === "listening"
      ? "listening"
      : test.module === "general"
      ? "reading_general"
      : "reading_academic";

  const bandScore =
    maxScore > 0
      ? convertRawToBand(rawScore, conversionSkill, conversionTable, maxScore)
      : 0;

  return {
    rawScore,
    maxScore,
    bandScore,
    breakdownByType,
    details,
  };
}
