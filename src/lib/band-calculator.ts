import type { BandConversionRow, BandConversionSkill } from "./types";
import { DEFAULT_BAND_CONVERSIONS } from "./seed-data";

/**
 * Official IELTS Band Rounding:
 * - Rounds to nearest 0.5
 * - .25 rounds UP to .5  (e.g. 6.25 -> 6.5)
 * - .75 rounds UP to next whole band (e.g. 6.75 -> 7.0)
 * - .125 rounds DOWN to .0 (e.g. 6.125 -> 6.0)
 * - .625 rounds DOWN to .5 (e.g. 6.625 -> 6.5)
 */
export function roundIeltsBand(score: number): number {
  const clamped = Math.max(0, Math.min(9, score));
  // Multiply by 2, then apply standard half-up rounding (with tiny epsilon for float precision)
  const doubled = clamped * 2;
  const rounded = Math.floor(doubled + 0.5 + 1e-9) / 2;
  return Math.max(0, Math.min(9, Number(rounded.toFixed(1))));
}

/**
 * Calculate Overall IELTS Band from the 4 component scores.
 */
export function calculateOverallBand(scores: {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
}): { average: number; overall: number } {
  const sum = scores.listening + scores.reading + scores.writing + scores.speaking;
  const average = Number((sum / 4).toFixed(3));
  return {
    average,
    overall: roundIeltsBand(sum / 4),
  };
}

/**
 * Convert raw score (0..40) to IELTS Band using database-configured conversion table.
 * If test has fewer than 40 questions, scales proportionally to /40 before lookup.
 */
export function convertRawToBand(
  rawScore: number,
  skill: BandConversionSkill,
  table: BandConversionRow[] = DEFAULT_BAND_CONVERSIONS,
  maxRaw: number = 40
): number {
  const normalizedRaw =
    maxRaw === 40 || maxRaw <= 0
      ? Math.max(0, Math.min(40, Math.round(rawScore)))
      : Math.max(0, Math.min(40, Math.round((rawScore / maxRaw) * 40)));

  const rows = table.filter((r) => r.skill === skill);
  const match = rows.find(
    (r) => normalizedRaw >= r.min_raw && normalizedRaw <= r.max_raw
  );
  if (match) return Number(match.band_score);

  // Fallback linear interpolation if admin deleted a range
  const sorted = [...rows].sort((a, b) => b.min_raw - a.min_raw);
  for (const row of sorted) {
    if (normalizedRaw >= row.min_raw) return Number(row.band_score);
  }
  return 0.0;
}

/**
 * Writing Band Calculator:
 * - Official IELTS Writing weights Task 1 at 1/3 and Task 2 at 2/3.
 * - Or averages 4 equal criteria (TR/TA, CC, LR, GRA) and rounds to nearest 0.5.
 */
export function calculateWritingFromTasks(task1Band: number, task2Band: number): {
  exact: number;
  band: number;
} {
  const exact = (task1Band + task2Band * 2) / 3;
  return {
    exact: Number(exact.toFixed(3)),
    band: roundIeltsBand(exact),
  };
}

export function calculateCriterionBand(c1: number, c2: number, c3: number, c4: number): {
  exact: number;
  band: number;
} {
  const exact = (c1 + c2 + c3 + c4) / 4;
  return {
    exact: Number(exact.toFixed(3)),
    band: roundIeltsBand(exact),
  };
}
