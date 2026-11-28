/**
 * Deterministic catalog ordering for IELTS tests (pure, client-safe).
 *
 * Rule:
 *   1. Cambridge tests first, by book number DESCENDING (Cambridge 21 → 20 → … → 10 → …),
 *      then Test 1 → 4, then skill (Listening → Reading → Writing → Speaking),
 *      then Passage/Part/Section 1 → 4, then natural title order.
 *   2. Every non-Cambridge test keeps its incoming relative order (stable sort), so the
 *      existing catalog/admin order of original & sample tests does not change.
 *
 * Recognised name formats (title_vi, title_en or slug — case-insensitive):
 *   "Cambridge IELTS 21 Academic Test 1", "Cambridge 20 - Test 2 - Passage 3",
 *   "Cam 19 Test 4", "CAM18 T1", "C17T2", "cambridge-ielts-16-test-3", "cam-15-test-1".
 */

export interface CambridgeOrderKey {
  /** Cambridge book / volume number, e.g. 21. */
  book: number;
  /** Test number inside the book (1–4); `Infinity` when not stated. */
  test: number;
  /** Passage / Part / Section number; `Infinity` when not stated. */
  part: number;
}

type OrderableTest = {
  slug: string;
  title_vi?: string | null;
  title_en?: string | null;
  skill?: string | null;
};

const SKILL_RANK: Record<string, number> = {
  listening: 0,
  reading: 1,
  writing: 2,
  speaking: 3,
};

/** Normalise separators so "cambridge-ielts-21_test-1" behaves like a title. */
function normalise(raw: string): string {
  return raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/[_\-–—/|:.,()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BOOK_PATTERNS: RegExp[] = [
  // "cambridge ielts 21", "cambridge english ielts 18", "cambridge reading 20", "cambridge quyển 19"
  /\bcambridge\s+(?:(?:english|ielts|practice\s+tests?(?:\s+for)?|academic|general|training|reading|listening|writing|speaking|book|vol(?:ume)?|quyển|cuốn|tập)\s+)*(\d{1,2})\b/,
  // "cam 19", "cam19", "cam ielts 18", "cam reading 17"
  /\bcam\s*(?:(?:ielts|academic|general|reading|listening|writing|speaking|book|quyển|cuốn|tập)\s+)*(\d{1,2})\b/,
  // compact "c18t1" / "c18 t1" / "c18 test 1"
  /\bc(\d{1,2})\s*t(?:est)?\s*\d\b/,
];

const TEST_PATTERNS: RegExp[] = [
  /\btest\s*(\d{1,2})\b/,
  /\bc\d{1,2}\s*t(\d)\b/,
  /\bcam\s*\d{1,2}\s*t(\d)\b/,
  /(?:^|\s)đề\s*(?:số\s*|thi\s*)?(\d{1,2})\b/,
];

const PART_PATTERNS: RegExp[] = [
  /\b(?:passage|part|section|recording|task)\s*(\d)\b/,
  /(?:^|\s)bài\s*(?:đọc\s*|nghe\s*|thi\s*)?(\d{1,2})\b/,
  /\bp(\d)\b/,
];

function firstMatch(source: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = source.match(re);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/**
 * Extract the Cambridge ordering key from a test, or `null` when the test is not a
 * Cambridge test. Titles win over slug (slug is the fallback for slug-only naming).
 */
export function parseCambridgeOrderKey(test: OrderableTest): CambridgeOrderKey | null {
  const sources = [test.title_vi, test.title_en, test.slug]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map(normalise);

  for (const src of sources) {
    const book = firstMatch(src, BOOK_PATTERNS);
    if (book === null || book < 1 || book > 99) continue;
    const test = firstMatch(src, TEST_PATTERNS);
    const part = firstMatch(src, PART_PATTERNS);
    return {
      book,
      test: test ?? Number.POSITIVE_INFINITY,
      part: part ?? Number.POSITIVE_INFINITY,
    };
  }
  return null;
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" });
}

function compareNumbers(a: number, b: number): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Comparator: Cambridge (book desc → test asc → skill → part asc → title) before
 * everything else; two non-Cambridge tests compare equal (keeps incoming order).
 */
export function compareIeltsTestsForCatalog(a: OrderableTest, b: OrderableTest): number {
  const ka = parseCambridgeOrderKey(a);
  const kb = parseCambridgeOrderKey(b);
  if (!ka && !kb) return 0;
  if (ka && !kb) return -1;
  if (!ka && kb) return 1;
  const x = ka as CambridgeOrderKey;
  const y = kb as CambridgeOrderKey;
  return (
    compareNumbers(y.book, x.book) ||
    compareNumbers(x.test, y.test) ||
    compareNumbers(SKILL_RANK[a.skill ?? ""] ?? 9, SKILL_RANK[b.skill ?? ""] ?? 9) ||
    compareNumbers(x.part, y.part) ||
    naturalCompare(a.title_vi || a.slug, b.title_vi || b.slug)
  );
}

/** Returns a NEW array sorted for catalog display (input is not mutated; stable). */
export function sortIeltsTestsForCatalog<T extends OrderableTest>(tests: readonly T[]): T[] {
  return tests
    .map((t, idx) => ({ t, idx }))
    .sort((a, b) => compareIeltsTestsForCatalog(a.t, b.t) || a.idx - b.idx)
    .map((entry) => entry.t);
}
