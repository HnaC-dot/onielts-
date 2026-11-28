import type {
  BandConversionRow,
  IeltsTest,
  QuestionGroup,
  QuestionType,
  QuestionWordLimit,
  TestQuestion,
} from "./types";
import { convertRawToBand } from "./band-calculator";
import { normalizeSectionToGroups } from "./test-groups";

export interface QuestionGradeDetail {
  questionId: string;
  number: number;
  type: QuestionType;
  userAnswer: string;
  acceptedAnswers: string[];
  isCorrect: boolean;
  /** True when a completion / short-answer response exceeded the IELTS word/number limit. */
  wordLimitExceeded?: boolean;
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

export interface AnswerCheckOptions {
  wordLimit?: QuestionWordLimit;
  allowNumberWordEquivalence?: boolean;
  hasAnswerBank?: boolean;
}

const COMPLETION_WORD_LIMIT_TYPES = new Set<QuestionType>([
  "sentence_completion",
  "summary_completion",
  "table_completion",
  "note_completion",
  "flowchart_completion",
  "short_answer",
]);

const NUMERIC_TOKEN_REGEX = /^[$£€¥+-]?\d[\d,./:%-]*(?:st|nd|rd|th)?$/i;

const UNITS_MAP: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS_MAP: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const ORDINAL_MAP: Record<string, string> = {
  first: "1st",
  second: "2nd",
  third: "3rd",
  fourth: "4th",
  fifth: "5th",
  sixth: "6th",
  seventh: "7th",
  eighth: "8th",
  ninth: "9th",
  tenth: "10th",
  eleventh: "11th",
  twelfth: "12th",
};

const NUMBER_WORD_SET = new Set<string>([
  ...Object.keys(UNITS_MAP),
  ...Object.keys(TENS_MAP),
  ...Object.keys(ORDINAL_MAP),
  "hundred",
  "thousand",
  "million",
  "and",
]);

/**
 * Normalizes an answer string for comparison:
 * - Case-insensitive, trimmed, extra whitespace collapsed
 * - Hyphens and dashes treated as spaces so "well-known" matches "well known"
 * - Strips standard punctuation
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Expands slash-separated acceptable answer variants such as `"colour / color"`,
 * `"well-known/well known"`, or `"10 / ten"`, while preserving dates & fractions
 * like `"12/05"` or `"24/7"`.
 */
export function expandAcceptedAnswerVariants(acceptedAnswers: string[]): string[] {
  const expanded: string[] = [];
  for (const raw of acceptedAnswers) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (trimmed.includes("/")) {
      const parts = trimmed
        .split(/\s*\/\s*/)
        .map((p) => p.trim())
        .filter(Boolean);

      // Preserve date/fraction/ratio tokens like "12/05" or "24/7" (pure digits without spaces around '/')
      const looksLikeNumericSlash =
        !/\s\/\s/.test(trimmed) &&
        parts.length >= 2 &&
        parts.every((p) => /^\d+$/.test(p));

      if (!looksLikeNumericSlash && parts.length >= 2) {
        expanded.push(...parts);
        continue;
      }
    }

    expanded.push(trimmed);
  }
  return expanded;
}

/**
 * Converts English written numbers inside a normalized string into canonical digits
 * (e.g. `"ten"` -> `"10"`, `"twenty five"` -> `"25"`, `"one hundred"` -> `"100"`,
 * `"first"` -> `"1st"`). Used only when `allowNumberWordEquivalence` is enabled.
 */
export function canonicalizeNumberWords(normText: string): string {
  const tokens = normText.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  const out: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];

    if (ORDINAL_MAP[tok]) {
      out.push(ORDINAL_MAP[tok]);
      i += 1;
      continue;
    }

    if (tok in UNITS_MAP || tok in TENS_MAP) {
      let total = 0;
      let current = 0;
      let j = i;
      let consumed = false;

      while (j < tokens.length) {
        const w = tokens[j];
        if (w === "and" && consumed && j + 1 < tokens.length) {
          j += 1;
          continue;
        }
        if (w in UNITS_MAP) {
          current += UNITS_MAP[w];
          consumed = true;
          j += 1;
        } else if (w in TENS_MAP) {
          current += TENS_MAP[w];
          consumed = true;
          j += 1;
        } else if (w === "hundred" && consumed) {
          current = (current || 1) * 100;
          j += 1;
        } else if (w === "thousand" && consumed) {
          total += (current || 1) * 1000;
          current = 0;
          j += 1;
        } else {
          break;
        }
      }

      out.push(String(total + current));
      i = j;
      continue;
    }

    out.push(tok);
    i += 1;
  }

  return out.join(" ");
}

function isWrittenNumberToken(rawToken: string): boolean {
  const parts = rawToken
    .toLowerCase()
    .replace(/[.,!?]+$/, "")
    .split(/[-–—]/)
    .filter(Boolean);
  return parts.length > 0 && parts.every((p) => NUMBER_WORD_SET.has(p));
}

/**
 * Enforces official IELTS word/number limits on free-text completion / short-answer responses.
 * Hyphenated compounds (e.g. `"well-known"`) count as 1 word per official IELTS rules.
 */
export function doesAnswerExceedWordLimit(
  rawAnswer: string,
  wordLimit: QuestionWordLimit | undefined,
  opts?: { allowNumberWordEquivalence?: boolean }
): boolean {
  if (!wordLimit) return false;
  const trimmed = rawAnswer.trim();
  if (!trimmed) return false;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const totalWords = tokens.length;

  const isNumericOrAllowedWord = (tok: string): boolean => {
    const clean = tok.replace(/[.,!?]+$/, "");
    if (NUMERIC_TOKEN_REGEX.test(clean)) return true;
    if (opts?.allowNumberWordEquivalence && isWrittenNumberToken(clean)) {
      return true;
    }
    return false;
  };

  if (wordLimit.numberMode === "number_only" || wordLimit.maxWords === 0) {
    return !tokens.every((t) => isNumericOrAllowedWord(t));
  }

  const maxWords = wordLimit.maxWords ?? 1;
  if (wordLimit.allowNumber) {
    let numericCount = 0;
    let nonNumericCount = 0;
    for (const tok of tokens) {
      const clean = tok.replace(/[.,!?]+$/, "");
      if (NUMERIC_TOKEN_REGEX.test(clean)) {
        numericCount += 1;
      } else {
        nonNumericCount += 1;
      }
    }
    if (nonNumericCount > maxWords) {
      // Allow pure written-number equivalence (e.g. "twenty five" when allowNumberWordEquivalence=true)
      if (
        opts?.allowNumberWordEquivalence &&
        tokens.every((t) => isNumericOrAllowedWord(t))
      ) {
        return false;
      }
      return true;
    }
    return numericCount > 2 || totalWords > maxWords + 2;
  }

  return totalWords > maxWords;
}

function extractCanonicalChoiceToken(raw: string): string {
  const norm = normalizeAnswer(raw);
  if (!norm) return "";
  // Extract leading single letter (e.g. "b electric buses" -> "b") or roman numeral (e.g. "iii overview" -> "iii")
  const letterMatch = norm.match(/^([a-z])(?:\s+|$)/);
  if (letterMatch) return letterMatch[1];
  const romanMatch = norm.match(/^([ivxlcdm]{1,5})(?:\s+|$)/);
  if (romanMatch) return romanMatch[1];
  return norm;
}

function normalizeMultiTokens(raw: string): string[] {
  const unique = new Set<string>();
  const parts = raw.split(/[,|&/]+|\band\b/i);
  for (const part of parts) {
    const token = extractCanonicalChoiceToken(part);
    if (token) unique.add(token);
  }
  return [...unique].sort();
}

export function evaluateAnswer(
  userAnswer: string,
  acceptedAnswers: string[],
  questionType?: QuestionType,
  options?: AnswerCheckOptions
): { isCorrect: boolean; wordLimitExceeded: boolean } {
  const normUser = normalizeAnswer(userAnswer);
  if (!normUser) {
    return { isCorrect: false, wordLimitExceeded: false };
  }

  // Enforce IELTS word limit on free-text completion & short-answer questions
  const shouldEnforceWordLimit =
    Boolean(options?.wordLimit) &&
    !options?.hasAnswerBank &&
    (!questionType || COMPLETION_WORD_LIMIT_TYPES.has(questionType));

  if (
    shouldEnforceWordLimit &&
    doesAnswerExceedWordLimit(userAnswer, options?.wordLimit, {
      allowNumberWordEquivalence: options?.allowNumberWordEquivalence,
    })
  ) {
    return { isCorrect: false, wordLimitExceeded: true };
  }

  if (questionType === "mcq_multi") {
    const userTokens = normalizeMultiTokens(userAnswer);
    if (userTokens.length === 0) {
      return { isCorrect: false, wordLimitExceeded: false };
    }
    const userSig = userTokens.join(",");
    const matched = acceptedAnswers.some((acc) => {
      const accTokens = normalizeMultiTokens(acc);
      return accTokens.length > 0 && accTokens.join(",") === userSig;
    });
    return { isCorrect: matched, wordLimitExceeded: false };
  }

  const variants = expandAcceptedAnswerVariants(acceptedAnswers);
  const userNumCanonical = options?.allowNumberWordEquivalence
    ? canonicalizeNumberWords(normUser)
    : null;

  const matched = variants.some((acc) => {
    const normAcc = normalizeAnswer(acc);
    if (!normAcc) return false;
    if (normUser === normAcc) return true;

    // Configurable number-word equivalence ("10" <-> "ten", "first" <-> "1st")
    if (
      userNumCanonical !== null &&
      userNumCanonical === canonicalizeNumberWords(normAcc)
    ) {
      return true;
    }

    // Bidirectional letter / roman-numeral prefix matching for MCQ, Matching & Word Bank
    // e.g. user selects "B. Fish sensory lines" and key is "B", OR user submits "B" and key is "B. Fish sensory lines"
    if (normAcc.length === 1 && normUser.startsWith(`${normAcc} `)) return true;
    if (normUser.length === 1 && normAcc.startsWith(`${normUser} `)) return true;
    if (/^[ivxlcdm]{1,5}$/.test(normAcc) && normUser.startsWith(`${normAcc} `)) {
      return true;
    }
    if (/^[ivxlcdm]{1,5}$/.test(normUser) && normAcc.startsWith(`${normUser} `)) {
      return true;
    }

    return false;
  });

  return { isCorrect: matched, wordLimitExceeded: false };
}

export function isAnswerCorrect(
  userAnswer: string,
  acceptedAnswers: string[],
  questionType?: QuestionType,
  options?: AnswerCheckOptions
): boolean {
  return evaluateAnswer(userAnswer, acceptedAnswers, questionType, options).isCorrect;
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

/**
 * Scores a multi-number `mcq_multi` group (e.g. Questions 19–20: "Choose TWO letters")
 * as an unordered set:
 * - Correct answers in any order receive full credit (e.g. D, B == B, D -> 2/2).
 * - Duplicate submissions of the same choice only earn credit once (B, B -> 1/2).
 * - Submitting more distinct choices than `maxSelections` (tampered API) receives 0 credit.
 */
function gradeMultiNumberMcqGroup(
  group: QuestionGroup,
  groupQuestions: TestQuestion[],
  answers: Record<string, string>
): Map<string, boolean> {
  const result = new Map<string, boolean>();
  const maxSelections = Math.max(
    1,
    group.maxSelections ?? groupQuestions.length
  );

  // Build deduplicated expected choice pool across all questions in the group
  const expectedPool = new Set<string>();
  for (const q of groupQuestions) {
    for (const acc of q.correctAnswers) {
      for (const tok of normalizeMultiTokens(acc)) {
        expectedPool.add(tok);
      }
    }
  }

  // Collect all submitted tokens per slot and total distinct tokens across the group
  const slotTokens = groupQuestions.map((q) =>
    normalizeMultiTokens(answers[q.id] ?? "")
  );
  const allSubmittedUnique = new Set<string>();
  for (const list of slotTokens) {
    for (const tok of list) {
      allSubmittedUnique.add(tok);
    }
  }

  // Guard against brute-force over-submission (e.g. putting "A,B,C,D,E" into slots)
  if (allSubmittedUnique.size > maxSelections) {
    for (const q of groupQuestions) {
      result.set(q.id, false);
    }
    return result;
  }

  // Credit each matching choice at most once in unordered fashion
  const remainingExpected = new Set(expectedPool);
  groupQuestions.forEach((q, idx) => {
    const tokens = slotTokens[idx];
    if (tokens.length === 1 && remainingExpected.has(tokens[0])) {
      remainingExpected.delete(tokens[0]);
      result.set(q.id, true);
    } else if (
      tokens.length > 1 &&
      tokens.every((t) => remainingExpected.has(t))
    ) {
      // Edge case where learner packed multiple valid choices into one slot
      remainingExpected.delete(tokens[0]);
      result.set(q.id, true);
    } else {
      result.set(q.id, false);
    }
  });

  return result;
}

export function gradeObjectiveTest(
  test: IeltsTest,
  answers: Record<string, string>,
  conversionTable: BandConversionRow[]
): GradedTestResult {
  const details: QuestionGradeDetail[] = [];
  const breakdownByType: Record<string, { correct: number; total: number }> = {};
  let rawScore = 0;
  let maxScore = 0;

  for (const section of test.sections) {
    const groups = normalizeSectionToGroups(section);
    const groupByQuestionId = new Map<string, QuestionGroup>();
    const multiGroupScores = new Map<string, boolean>();
    const qById = new Map(section.questions.map((q) => [q.id, q]));

    for (const group of groups) {
      for (const qId of group.questionIds) {
        groupByQuestionId.set(qId, group);
      }
      if (group.type === "mcq_multi" && group.questionIds.length > 1) {
        const memberQuestions = group.questionIds
          .map((id) => qById.get(id))
          .filter((q): q is TestQuestion => Boolean(q));
        const groupScores = gradeMultiNumberMcqGroup(
          group,
          memberQuestions,
          answers
        );
        groupScores.forEach((val, key) => multiGroupScores.set(key, val));
      }
    }

    for (const q of section.questions) {
      maxScore += 1;
      const userAns = answers[q.id] ?? "";
      const parentGroup = groupByQuestionId.get(q.id);

      let correct = false;
      let wordLimitExceeded = false;

      if (multiGroupScores.has(q.id)) {
        correct = Boolean(multiGroupScores.get(q.id));
      } else {
        const evalRes = evaluateAnswer(userAns, q.correctAnswers, q.type, {
          wordLimit: parentGroup?.wordLimit,
          allowNumberWordEquivalence: parentGroup?.allowNumberWordEquivalence,
          hasAnswerBank: Boolean(
            parentGroup?.answerBank && parentGroup.answerBank.length > 0
          ),
        });
        correct = evalRes.isCorrect;
        wordLimitExceeded = evalRes.wordLimitExceeded;
      }

      if (correct) rawScore += 1;

      if (!breakdownByType[q.type]) {
        breakdownByType[q.type] = { correct: 0, total: 0 };
      }
      breakdownByType[q.type].total += 1;
      if (correct) breakdownByType[q.type].correct += 1;

      const detail: QuestionGradeDetail = {
        questionId: q.id,
        number: q.number,
        type: q.type,
        userAnswer: userAns,
        acceptedAnswers: q.correctAnswers,
        isCorrect: correct,
        explanation_vi: q.explanation_vi,
        explanation_en: q.explanation_en,
        sectionRef: q.sectionRef,
      };
      if (wordLimitExceeded) {
        detail.wordLimitExceeded = true;
      }
      details.push(detail);
    }
  }

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
