/**
 * SM-2 Spaced Repetition Scheduling Algorithm for Flashcards
 * + Word-level Diff Checker for IELTS Dictation
 */

export interface SrsCardState {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

export interface SrsNextState extends SrsCardState {
  next_review_at: string;
}

/**
 * quality: 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)
 */
export function computeNextSm2(
  state: SrsCardState,
  quality: 1 | 3 | 4 | 5,
  now: Date = new Date()
): SrsNextState {
  let ease = state.ease_factor || 2.5;
  let reps = state.repetitions || 0;
  let interval = state.interval_days || 0;

  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (reps === 0) {
      interval = quality === 5 ? 3 : 1;
    } else if (reps === 1) {
      interval = quality === 5 ? 8 : 6;
    } else {
      interval = Math.max(1, Math.round(interval * ease));
    }
    reps += 1;
  }

  ease = Math.max(
    1.3,
    Number((ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))).toFixed(2))
  );

  const nextDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  return {
    ease_factor: ease,
    interval_days: interval,
    repetitions: reps,
    next_review_at: nextDate.toISOString(),
  };
}

export interface DiffWordToken {
  word: string;
  status: "correct" | "missing" | "wrong";
  expected?: string;
}

export interface DictationDiffResult {
  accuracyPercent: number;
  correctCount: number;
  totalExpected: number;
  tokens: DiffWordToken[];
}

function cleanWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9'-]/g, "");
}

/**
 * Word-level alignment diff for sentence dictation checking.
 */
export function diffDictationSentence(
  expectedSentence: string,
  userInput: string
): DictationDiffResult {
  const expectedWords = expectedSentence.trim().split(/\s+/).filter(Boolean);
  const typedWords = userInput.trim().split(/\s+/).filter(Boolean);

  const tokens: DiffWordToken[] = [];
  let correctCount = 0;
  let j = 0;

  for (let i = 0; i < expectedWords.length; i++) {
    const exp = expectedWords[i];
    const expClean = cleanWord(exp);
    const typed = typedWords[j];

    if (typed && cleanWord(typed) === expClean) {
      tokens.push({ word: exp, status: "correct" });
      correctCount += 1;
      j += 1;
    } else if (typed && typedWords[j + 1] && cleanWord(typedWords[j + 1]) === expClean) {
      // User inserted an extra/wrong word before the expected word
      tokens.push({ word: typed, status: "wrong" });
      tokens.push({ word: exp, status: "correct" });
      correctCount += 1;
      j += 2;
    } else if (
      typed &&
      expectedWords[i + 1] &&
      cleanWord(typed) === cleanWord(expectedWords[i + 1])
    ) {
      // User missed the current expected word
      tokens.push({ word: exp, status: "missing" });
    } else if (typed) {
      tokens.push({ word: typed, status: "wrong", expected: exp });
      j += 1;
    } else {
      tokens.push({ word: exp, status: "missing" });
    }
  }

  while (j < typedWords.length) {
    tokens.push({ word: typedWords[j], status: "wrong" });
    j += 1;
  }

  const totalExpected = Math.max(1, expectedWords.length);
  const accuracyPercent = Math.round((correctCount / totalExpected) * 100);

  return {
    accuracyPercent,
    correctCount,
    totalExpected,
    tokens,
  };
}
