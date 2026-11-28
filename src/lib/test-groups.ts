import type {
  IeltsTest,
  QuestionGroup,
  QuestionGroupOption,
  QuestionGroupSharedContent,
  QuestionPassageRange,
  QuestionType,
  QuestionWordLimit,
  TestQuestion,
  TestSection,
} from "./types";

export const BLANK_PLACEHOLDER_REGEX = /\{\{\s*(\d+)\s*\}\}/g;

export type TemplateSegment =
  | { type: "text"; value: string }
  | { type: "blank"; number: number };

/**
 * Splits a template string containing `{{n}}` placeholders into ordered text & blank segments.
 */
export function parseTemplateSegments(text: string): TemplateSegment[] {
  if (!text) return [];
  const segments: TemplateSegment[] = [];
  const regex = new RegExp(BLANK_PLACEHOLDER_REGEX.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const num = Number.parseInt(match[1], 10);
    if (Number.isFinite(num) && num > 0) {
      segments.push({ type: "blank", number: num });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * Extracts all `{{n}}` placeholder numbers in appearance order from a string.
 */
export function extractBlankNumbers(text?: string): number[] {
  if (!text) return [];
  const out: number[] = [];
  const regex = new RegExp(BLANK_PLACEHOLDER_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const num = Number.parseInt(match[1], 10);
    if (Number.isFinite(num) && num > 0) {
      out.push(num);
    }
  }
  return out;
}

/**
 * Extracts all `{{n}}` placeholder numbers referenced inside a QuestionGroup's sharedContent.
 */
export function extractGroupBlankNumbers(group: Pick<QuestionGroup, "sharedContent">): number[] {
  const sc = group.sharedContent;
  if (!sc) return [];
  const out: number[] = [];
  if (sc.text) {
    out.push(...extractBlankNumbers(sc.text));
  }
  if (sc.table) {
    for (const row of sc.table.rows) {
      for (const cell of row) {
        out.push(...extractBlankNumbers(cell));
      }
    }
  }
  if (sc.flowchart) {
    for (const step of sc.flowchart.steps) {
      out.push(...extractBlankNumbers(step));
    }
  }
  if (sc.notes) {
    for (const sec of sc.notes.sections) {
      if (sec.heading) out.push(...extractBlankNumbers(sec.heading));
      for (const bullet of sec.bullets) {
        out.push(...extractBlankNumbers(bullet));
      }
    }
  }
  return out;
}

const WORD_NUM_MAP: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
};

/**
 * Parses standard IELTS word/number limit directives from instructions or legacy question prompts.
 * Examples:
 *  - "ONE WORD ONLY" -> { maxWords: 1, allowNumber: false, numberMode: "word_only" }
 *  - "ONE WORD AND/OR A NUMBER" -> { maxWords: 1, allowNumber: true, numberMode: "word_or_number" }
 *  - "NO MORE THAN TWO WORDS AND/OR A NUMBER" -> { maxWords: 2, allowNumber: true, numberMode: "word_or_number" }
 *  - "NO MORE THAN THREE WORDS" -> { maxWords: 3, allowNumber: false, numberMode: "word_only" }
 *  - "A NUMBER ONLY" -> { maxWords: 0, allowNumber: true, numberMode: "number_only" }
 */
export function parseWordLimitFromText(text?: string): QuestionWordLimit | undefined {
  if (!text) return undefined;
  const upper = text.toUpperCase();

  if (/\b(?:A|ONE)\s+NUMBER\s+ONLY\b/.test(upper)) {
    return { maxWords: 0, allowNumber: true, numberMode: "number_only" };
  }

  const noMoreThanMatch = upper.match(
    /\bNO\s+MORE\s+THAN\s+(ONE|TWO|THREE|FOUR|1|2|3|4)\s+WORDS?(?:\s+(AND\/OR|OR)\s+(?:A\s+)?NUMBERS?)?/
  );
  if (noMoreThanMatch) {
    const maxWords = WORD_NUM_MAP[noMoreThanMatch[1].toLowerCase()] ?? 2;
    const allowNumber = Boolean(noMoreThanMatch[2]);
    return {
      maxWords,
      allowNumber,
      numberMode: allowNumber ? "word_or_number" : "word_only",
    };
  }

  const exactWordMatch = upper.match(
    /\b(ONE|TWO|THREE|FOUR|1|2|3|4)\s+WORDS?(?:\s+(AND\/OR|OR)\s+(?:A\s+)?NUMBERS?|\s+ONLY|\b)/
  );
  if (exactWordMatch) {
    const maxWords = WORD_NUM_MAP[exactWordMatch[1].toLowerCase()] ?? 1;
    const allowNumber = Boolean(exactWordMatch[2]);
    return {
      maxWords,
      allowNumber,
      numberMode: allowNumber ? "word_or_number" : "word_only",
    };
  }

  if (/\(\s*(?:ONE\s+)?NUMBER\s*\)/.test(upper)) {
    return { maxWords: 0, allowNumber: true, numberMode: "number_only" };
  }

  return undefined;
}

/**
 * Formats a QuestionWordLimit into a clean human-readable directive.
 */
export function formatWordLimitDirective(
  wordLimit: QuestionWordLimit | undefined,
  locale: "vi" | "en" = "en"
): string {
  if (!wordLimit) return "";
  if (wordLimit.numberMode === "number_only" || wordLimit.maxWords === 0) {
    return locale === "vi" ? "Chỉ điền MỘT CON SỐ" : "Write A NUMBER ONLY";
  }
  const n = wordLimit.maxWords ?? 1;
  const wordEn = n === 1 ? "ONE WORD" : n === 2 ? "TWO WORDS" : n === 3 ? "THREE WORDS" : `${n} WORDS`;
  const wordVi = n === 1 ? "1 TỪ" : `${n} TỪ`;
  const prefixEn = n === 1 ? "Choose" : "Choose NO MORE THAN";
  const prefixVi = n === 1 ? "Chỉ điền tối đa" : "Điền không quá";

  if (wordLimit.allowNumber) {
    return locale === "vi"
      ? `${prefixVi} ${wordVi} VÀ/HOẶC 1 CON SỐ`
      : `${prefixEn} ${wordEn} AND/OR A NUMBER`;
  }
  return locale === "vi"
    ? `${prefixVi} ${wordVi}`
    : `${prefixEn} ${wordEn} ONLY`;
}

/**
 * Counts IELTS words in a learner's completion answer.
 * Hyphenated compounds (e.g. "well-known") count as 1 word per official IELTS rules.
 */
export function countAnswerWords(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Parses an option string like "A. Electric buses" or "iii. Historical overview" or "B"
 * into a structured `{ id, text }` bank entry.
 */
export function parseOptionToBankItem(raw: string, fallbackIndex: number): QuestionGroupOption {
  const trimmed = raw.trim();
  const prefixed = trimmed.match(/^([A-Za-z]{1,4}|[ivxlcdmIVXLCDM]{1,5})[.):-]\s+(.+)$/);
  if (prefixed) {
    return { id: prefixed[1].trim(), text: prefixed[2].trim() };
  }
  if (/^([A-Za-z]|[ivxlcdm]{1,5})$/i.test(trimmed)) {
    return { id: trimmed, text: trimmed };
  }
  const fallbackLetter = String.fromCharCode(65 + (fallbackIndex % 26));
  return { id: trimmed || fallbackLetter, text: trimmed || fallbackLetter };
}

export function buildDefaultGroupInstruction(
  type: QuestionType,
  opts?: {
    wordLimit?: QuestionWordLimit;
    bankLabels?: string[];
    maxSelections?: number;
    allowReuse?: boolean;
  }
): string {
  const limitText = formatWordLimitDirective(opts?.wordLimit, "en");
  const bankRange =
    opts?.bankLabels && opts.bankLabels.length >= 2
      ? `${opts.bankLabels[0]}–${opts.bankLabels[opts.bankLabels.length - 1]}`
      : "";

  switch (type) {
    case "tfng":
      return "Do the following statements agree with the information given in the passage? Choose TRUE, FALSE or NOT GIVEN.";
    case "ynng":
      return "Do the following statements agree with the claims of the writer? Choose YES, NO or NOT GIVEN.";
    case "mcq":
      return `Choose the correct letter${bankRange ? `, ${bankRange}` : ""}.`;
    case "mcq_multi": {
      const count = opts?.maxSelections ?? 2;
      const countWord = count === 2 ? "TWO" : count === 3 ? "THREE" : String(count);
      return `Choose ${countWord} letters${bankRange ? `, ${bankRange}` : ""}.`;
    }
    case "matching_headings":
      return `Choose the correct heading for each section from the list of headings${bankRange ? ` (${bankRange})` : ""}.`;
    case "matching_info":
      return `Which section contains the following information?${opts?.allowReuse ? " NB You may use any letter more than once." : ""}`;
    case "matching_features":
      return `Match each statement with the correct item${bankRange ? `, ${bankRange}` : ""}.${opts?.allowReuse ? " NB You may use any letter more than once." : ""}`;
    case "matching_sentence_endings":
      return `Complete each sentence with the correct ending${bankRange ? `, ${bankRange}` : ""}, below.`;
    case "summary_completion":
      return limitText
        ? `Complete the summary below. ${limitText} from the passage for each answer.`
        : "Complete the summary below.";
    case "note_completion":
      return limitText
        ? `Complete the notes below. ${limitText} for each answer.`
        : "Complete the notes below.";
    case "table_completion":
      return limitText
        ? `Complete the table below. ${limitText} for each answer.`
        : "Complete the table below.";
    case "flowchart_completion":
      return limitText
        ? `Complete the flow-chart below. ${limitText} for each answer.`
        : "Complete the flow-chart below.";
    case "sentence_completion":
      return limitText
        ? `Complete the sentences below. ${limitText} for each answer.`
        : "Complete the sentences below.";
    case "short_answer":
      return limitText
        ? `Answer the questions below. ${limitText} for each answer.`
        : "Answer the questions below.";
    case "map_labelling":
      return `Label the map/diagram below. Choose the correct answer${bankRange ? ` (${bankRange})` : ""}.`;
  }
}

const COMPLETION_TYPES = new Set<QuestionType>([
  "sentence_completion",
  "summary_completion",
  "table_completion",
  "note_completion",
  "flowchart_completion",
  "short_answer",
]);

function sameOptionSignature(a?: string[], b?: string[]): boolean {
  const la = a ?? [];
  const lb = b ?? [];
  if (la.length !== lb.length) return false;
  for (let i = 0; i < la.length; i += 1) {
    if (la[i].trim() !== lb[i].trim()) return false;
  }
  return true;
}

function mergeWordLimits(limits: Array<QuestionWordLimit | undefined>): QuestionWordLimit | undefined {
  const present = limits.filter((l): l is QuestionWordLimit => Boolean(l));
  if (present.length === 0) return undefined;
  let maxWords = 0;
  let allowNumber = false;
  let allNumberOnly = true;

  for (const lim of present) {
    if ((lim.maxWords ?? 0) > maxWords) maxWords = lim.maxWords ?? 0;
    if (lim.allowNumber) allowNumber = true;
    if (lim.numberMode !== "number_only") allNumberOnly = false;
  }

  return {
    maxWords,
    allowNumber,
    numberMode: allNumberOnly
      ? "number_only"
      : allowNumber
      ? "word_or_number"
      : "word_only",
  };
}

function buildAutoGroupFromRun(
  section: TestSection,
  run: TestQuestion[],
  runIndex: number
): QuestionGroup {
  const first = run[0];
  const last = run[run.length - 1];
  const type = first.type;

  const detectedLimit = COMPLETION_TYPES.has(type)
    ? mergeWordLimits([
        ...run.map((q) => parseWordLimitFromText(q.prompt)),
        parseWordLimitFromText(section.instruction),
      ])
    : undefined;

  let answerBank: QuestionGroupOption[] | undefined;
  let allowReuse: boolean | undefined;

  if (type === "matching_headings") {
    if (section.headingBank && section.headingBank.length > 0) {
      answerBank = section.headingBank.map((h) => ({ id: h.id, text: h.text }));
    } else if (first.options && first.options.length > 0) {
      answerBank = first.options.map((o, idx) => parseOptionToBankItem(o, idx));
    }
    allowReuse = false;
  } else if (type === "matching_info" || type === "matching_features") {
    if (first.options && first.options.length > 0) {
      answerBank = first.options.map((o, idx) => parseOptionToBankItem(o, idx));
    }
    allowReuse = true;
  } else if (type === "matching_sentence_endings") {
    if (first.options && first.options.length > 0) {
      answerBank = first.options.map((o, idx) => parseOptionToBankItem(o, idx));
    }
    allowReuse = false;
  } else if (type === "summary_completion" && first.options && first.options.length > 0) {
    answerBank = first.options.map((o, idx) => parseOptionToBankItem(o, idx));
    allowReuse = false;
  }

  let maxSelections: number | undefined;
  let sharedPrompt: string | undefined;
  if (type === "mcq_multi") {
    const upperPrompt = first.prompt.toUpperCase();
    if (/\bTHREE\b/.test(upperPrompt)) maxSelections = 3;
    else if (/\bTWO\b/.test(upperPrompt)) maxSelections = 2;
    else maxSelections = Math.max(2, run.length);
    if (run.length > 1) {
      sharedPrompt = first.prompt;
    }
  }

  const bankLabels = answerBank?.map((o) => o.id);
  const instruction = buildDefaultGroupInstruction(type, {
    wordLimit: detectedLimit,
    bankLabels,
    maxSelections,
    allowReuse,
  });

  return {
    id: `${section.id}-grp-${runIndex + 1}`,
    questionRange: {
      start: Math.min(...run.map((q) => q.number)),
      end: Math.max(...run.map((q) => q.number)),
    },
    type,
    instruction,
    sharedPrompt,
    answerBank,
    allowReuse,
    wordLimit: detectedLimit,
    maxSelections,
    allowNumberWordEquivalence: detectedLimit?.allowNumber ?? true,
    questionIds: run.map((q) => q.id),
    isAutoGenerated: true,
  };
}

function shouldSplitRun(prev: TestQuestion, next: TestQuestion): boolean {
  if (prev.type !== next.type) return true;
  if (prev.groupId && next.groupId && prev.groupId !== next.groupId) return true;
  // Separate matching / word-bank groups if they use different option sets
  if (
    prev.type === "matching_info" ||
    prev.type === "matching_features" ||
    prev.type === "matching_sentence_endings" ||
    prev.type === "summary_completion"
  ) {
    if (!sameOptionSignature(prev.options, next.options)) return true;
  }
  // Separate mcq_multi groups if prompts/options differ
  if (prev.type === "mcq_multi") {
    if (
      prev.prompt.trim() !== next.prompt.trim() ||
      !sameOptionSignature(prev.options, next.options)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Pure read-time converter: returns normalized `QuestionGroup[]` for any `TestSection`.
 * - If `section.groups` is already populated, validates/preserves every explicit group
 *   and defensively appends an auto-group for any unreferenced questions so zero questions are ever dropped.
 * - If `section.groups` is absent/empty (legacy flat `questions[]`), automatically groups consecutive
 *   questions by type without mutating or overwriting stored `test_data`.
 */
export function normalizeSectionToGroups(section: TestSection): QuestionGroup[] {
  const questions = section.questions ?? [];
  if (questions.length === 0) return [];

  const qById = new Map(questions.map((q) => [q.id, q]));
  const explicitGroups = section.groups ?? [];

  if (explicitGroups.length > 0) {
    const coveredIds = new Set<string>();
    const normalized: QuestionGroup[] = [];

    for (const grp of explicitGroups) {
      const validIds = (grp.questionIds ?? []).filter((id) => qById.has(id));
      const matchedQuestions = validIds
        .map((id) => qById.get(id)!)
        .sort((a, b) => a.number - b.number);

      if (matchedQuestions.length === 0) {
        // Fallback: resolve by questionRange if questionIds were empty
        const byRange = questions.filter(
          (q) =>
            !coveredIds.has(q.id) &&
            q.number >= grp.questionRange.start &&
            q.number <= grp.questionRange.end
        );
        if (byRange.length === 0) continue;
        for (const q of byRange) coveredIds.add(q.id);
        normalized.push({
          ...grp,
          questionRange: {
            start: byRange[0].number,
            end: byRange[byRange.length - 1].number,
          },
          questionIds: byRange.map((q) => q.id),
        });
        continue;
      }

      for (const q of matchedQuestions) coveredIds.add(q.id);
      normalized.push({
        ...grp,
        questionRange: {
          start: matchedQuestions[0].number,
          end: matchedQuestions[matchedQuestions.length - 1].number,
        },
        questionIds: matchedQuestions.map((q) => q.id),
      });
    }

    // Defensive safeguard: never drop orphan questions not listed in explicit groups
    const orphans = questions.filter((q) => !coveredIds.has(q.id));
    if (orphans.length > 0) {
      const fallbackGroups = autoGroupQuestions(section, orphans, normalized.length);
      normalized.push(...fallbackGroups);
    }

    return normalized;
  }

  return autoGroupQuestions(section, questions, 0);
}

function autoGroupQuestions(
  section: TestSection,
  questions: TestQuestion[],
  startIndex: number
): QuestionGroup[] {
  const runs: TestQuestion[][] = [];
  for (const q of questions) {
    const currentRun = runs[runs.length - 1];
    if (!currentRun || shouldSplitRun(currentRun[currentRun.length - 1], q)) {
      runs.push([q]);
    } else {
      currentRun.push(q);
    }
  }
  return runs.map((run, idx) => buildAutoGroupFromRun(section, run, startIndex + idx));
}

/**
 * Returns a shallow copy of `TestSection` guaranteed to have normalized `groups` at read time.
 * Never mutates the original `section` or writes to DB.
 */
export function ensureSectionGroups(section: TestSection): TestSection {
  return {
    ...section,
    groups: normalizeSectionToGroups(section),
  };
}

/**
 * Returns a shallow copy of `IeltsTest` with all sections guaranteed to have normalized `groups` at read time.
 */
export function ensureTestGroups(test: IeltsTest): IeltsTest {
  return {
    ...test,
    sections: (test.sections ?? []).map((sec) => ensureSectionGroups(sec)),
  };
}

export interface PassageParagraph {
  index: number;
  label?: string;
  text: string;
}

/**
 * Splits a Reading passage into stable indexed paragraphs (`0, 1, 2, ...`) and detects
 * optional paragraph labels (e.g. `A ...`, `Paragraph B: ...`, `Section C — ...`).
 */
export function splitPassageParagraphs(passage?: string): PassageParagraph[] {
  if (!passage) return [];
  return passage
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text, index) => {
      const labelMatch =
        text.match(/^(?:Paragraph|Section)\s+([A-Z])\b/i) ??
        text.match(/^([A-Z])(?:\s{1,2}|[.:)\-—]\s+)/);
      return {
        index,
        label: labelMatch ? labelMatch[1].toUpperCase() : undefined,
        text,
      };
    });
}

/**
 * Resolves the relevant passage paragraphs for Group Practice mode according to `passageRange`.
 * Falls back to full passage when `passageRange` is unset or matches zero paragraphs.
 */
export function getPassageParagraphsForGroup(
  passage: string | undefined,
  range?: QuestionPassageRange
): { paragraphs: PassageParagraph[]; isFiltered: boolean; totalParagraphs: number } {
  const all = splitPassageParagraphs(passage);
  if (!range || all.length === 0) {
    return { paragraphs: all, isFiltered: false, totalParagraphs: all.length };
  }

  let matched: PassageParagraph[] = [];
  if (range.paragraphLabels && range.paragraphLabels.length > 0) {
    const labelSet = new Set(range.paragraphLabels.map((l) => l.trim().toUpperCase()));
    matched = all.filter((p) => p.label && labelSet.has(p.label));
  } else if (
    typeof range.startParagraph === "number" ||
    typeof range.endParagraph === "number"
  ) {
    const start = Math.max(0, range.startParagraph ?? 0);
    const end = Math.min(all.length - 1, range.endParagraph ?? all.length - 1);
    if (start <= end) {
      matched = all.filter((p) => p.index >= start && p.index <= end);
    }
  }

  if (matched.length === 0 || matched.length === all.length) {
    return { paragraphs: all, isFiltered: false, totalParagraphs: all.length };
  }
  return { paragraphs: matched, isFiltered: true, totalParagraphs: all.length };
}

const LEGACY_PROMPT_PREFIX_REGEX =
  /^(?:Complete the summary|Summary Completion|Note Completion|Table Completion|Sentence Completion|Flow-?chart(?:\s+Completion)?|Short Answer|Form Completion|Lecture Notes|Diagram(?:\s+Stage\s*\d+)?|Map Labelling|Floor Plan Direction)\s*(?:\([^)]*\))?\s*[:\-—]\s*/i;

/**
 * Removes redundant legacy type/word-limit prefixes from a flat question prompt
 * when rendering inside a grouped IELTS QuestionGroup card (read-time only).
 */
export function stripLegacyPromptPrefix(prompt: string): string {
  const cleaned = prompt.replace(LEGACY_PROMPT_PREFIX_REGEX, "").trim();
  return cleaned || prompt.trim();
}

/**
 * Converts a legacy prompt containing `___` blanks into a `{{questionNumber}}` template
 * so the inline completion renderer can place the `<input>` directly inside the text.
 */
export function promptToBlankTemplate(prompt: string, questionNumber: number): string {
  const cleaned = stripLegacyPromptPrefix(prompt);
  if (new RegExp(`\\{\\{\\s*${questionNumber}\\s*\\}\\}`).test(cleaned)) {
    return cleaned;
  }
  if (/_{2,}/.test(cleaned)) {
    return cleaned.replace(/_{2,}/, `{{${questionNumber}}}`);
  }
  return `${cleaned} {{${questionNumber}}}`;
}

const NUMERIC_TOKEN_REGEX = /^[$£€¥+-]?\d[\d,./:%-]*(?:st|nd|rd|th)?$/i;
const NUMBER_WORD_TOKEN_REGEX =
  /^(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|and|half|quarter|percent)(?:-(?:one|two|three|four|five|six|seven|eight|nine|first|second|third|fourth|fifth))?$/i;

export interface WordLimitWarningResult {
  wordCount: number;
  exceeded: boolean;
  message?: string;
}

/**
 * Evaluates a learner's completion answer against an IELTS word/number limit
 * and returns a non-blocking soft warning if the limit appears exceeded.
 */
export function checkWordLimitSoftWarning(
  answer: string,
  wordLimit: QuestionWordLimit | undefined,
  isEn = false
): WordLimitWarningResult {
  const trimmed = answer.trim();
  if (!trimmed) return { wordCount: 0, exceeded: false };
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = tokens.length;

  if (!wordLimit) {
    return { wordCount, exceeded: false };
  }

  if (wordLimit.numberMode === "number_only" || wordLimit.maxWords === 0) {
    const allLookNumeric = tokens.every(
      (tok) =>
        NUMERIC_TOKEN_REGEX.test(tok.replace(/[.,!?]+$/, "")) ||
        NUMBER_WORD_TOKEN_REGEX.test(tok.replace(/[.,!?]+$/, ""))
    );
    if (!allLookNumeric) {
      return {
        wordCount,
        exceeded: true,
        message: isEn
          ? "Expected a number only for this blank"
          : "Ô này yêu cầu điền con số",
      };
    }
    return { wordCount, exceeded: false };
  }

  const maxWords = wordLimit.maxWords ?? 1;
  if (wordLimit.allowNumber) {
    const nonNumericCount = tokens.filter(
      (tok) => !NUMERIC_TOKEN_REGEX.test(tok.replace(/[.,!?]+$/, ""))
    ).length;
    const exceeded = nonNumericCount > maxWords || wordCount > maxWords + 2;
    if (exceeded) {
      return {
        wordCount,
        exceeded: true,
        message: isEn
          ? `Exceeds limit (max ${maxWords} ${maxWords === 1 ? "word" : "words"} + a number)`
          : `Vượt giới hạn (tối đa ${maxWords} từ và/hoặc 1 con số)`,
      };
    }
    return { wordCount, exceeded: false };
  }

  if (wordCount > maxWords) {
    return {
      wordCount,
      exceeded: true,
      message: isEn
        ? `Exceeds limit (max ${maxWords} ${maxWords === 1 ? "word" : "words"})`
        : `Vượt giới hạn tối đa ${maxWords} từ`,
    };
  }

  return { wordCount, exceeded: false };
}

/**
 * Resolves structured display content for completion groups:
 * - Uses explicit `group.sharedContent` verbatim when authored.
 * - Synthesizes clean table / flowchart / notes / summary / sentence layouts at read time
 *   from legacy flat prompts without mutating stored DB data.
 */
export function resolveGroupDisplayContent(
  group: QuestionGroup,
  questions: TestQuestion[],
  isEn = false
): QuestionGroupSharedContent | null {
  if (group.sharedContent) {
    return group.sharedContent;
  }
  if (questions.length === 0) return null;

  if (group.type === "table_completion") {
    const rawRows = questions.map((q) => {
      const tpl = promptToBlankTemplate(q.prompt, q.number);
      const cells = tpl
        .split(/\s*\|\s*/)
        .map((c) => c.trim())
        .filter(Boolean);
      return cells.length >= 2 ? cells : [`Q${q.number}`, tpl];
    });
    const colCount = Math.max(2, ...rawRows.map((r) => r.length));
    const paddedRows = rawRows.map((r) => {
      const copy = [...r];
      while (copy.length < colCount) copy.push("");
      return copy;
    });
    const headers =
      colCount === 2
        ? [isEn ? "Topic" : "Hạng mục", isEn ? "Details" : "Thông tin chi tiết"]
        : colCount === 3
        ? [
            isEn ? "Topic" : "Hạng mục",
            isEn ? "Key Information" : "Thông tin chính",
            isEn ? "Notes" : "Ghi chú",
          ]
        : Array.from({ length: colCount }, (_, i) =>
            isEn ? `Column ${i + 1}` : `Cột ${i + 1}`
          );
    return {
      kind: "table",
      table: {
        title: group.title,
        headers,
        rows: paddedRows,
      },
    };
  }

  if (group.type === "flowchart_completion") {
    const steps: string[] = [];
    for (const q of questions) {
      const tpl = promptToBlankTemplate(q.prompt, q.number);
      const parts = tpl
        .split(/\s*(?:→|->)\s*/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        steps.push(...parts);
      } else {
        steps.push(tpl);
      }
    }
    return {
      kind: "flowchart",
      flowchart: {
        title: group.title,
        steps,
      },
    };
  }

  if (group.type === "note_completion") {
    return {
      kind: "notes",
      notes: {
        title: group.title,
        sections: [
          {
            bullets: questions.map((q) => promptToBlankTemplate(q.prompt, q.number)),
          },
        ],
      },
    };
  }

  if (group.type === "summary_completion") {
    return {
      kind: "summary",
      text: questions.map((q) => promptToBlankTemplate(q.prompt, q.number)).join(" "),
    };
  }

  if (group.type === "sentence_completion") {
    return {
      kind: "plain",
      text: questions.map((q) => promptToBlankTemplate(q.prompt, q.number)).join("\n"),
    };
  }

  return null;
}

export interface OptionDisplayParts {
  letter: string;
  label: string;
  value: string;
}

/**
 * Splits a choice string (e.g. "B. Electric buses" or "TRUE") into a badge letter,
 * clean text label, and original submission value for consistent server grading.
 */
export function getOptionDisplayParts(
  raw: string,
  fallbackIndex: number
): OptionDisplayParts {
  const trimmed = raw.trim();
  const prefixed = trimmed.match(/^([A-Z])[.):-]\s+(.+)$/);
  if (prefixed) {
    return {
      letter: prefixed[1],
      label: prefixed[2].trim(),
      value: raw,
    };
  }
  const letter = String.fromCharCode(65 + (fallbackIndex % 26));
  return {
    letter,
    label: trimmed,
    value: raw,
  };
}

