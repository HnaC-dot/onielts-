import { z } from "zod";
import { seoMetaSchema, slugifyVi } from "./seo";
import type { IeltsTest, QuestionType, TestQuestion, TestSection } from "./types";

export const QUESTION_TYPE_CATALOG: ReadonlyArray<{
  value: QuestionType;
  labelVi: string;
  needsOptions: boolean;
  defaultOptions?: string[];
  answerHint: string;
}> = [
  {
    value: "tfng",
    labelVi: "True / False / Not Given",
    needsOptions: true,
    defaultOptions: ["TRUE", "FALSE", "NOT GIVEN"],
    answerHint: "VD: TRUE",
  },
  {
    value: "ynng",
    labelVi: "Yes / No / Not Given",
    needsOptions: true,
    defaultOptions: ["YES", "NO", "NOT GIVEN"],
    answerHint: "VD: YES",
  },
  {
    value: "mcq",
    labelVi: "Multiple Choice (1 đáp án)",
    needsOptions: true,
    defaultOptions: ["A. ", "B. ", "C. ", "D. "],
    answerHint: "VD: B",
  },
  {
    value: "mcq_multi",
    labelVi: "Multiple Choice (nhiều đáp án)",
    needsOptions: true,
    defaultOptions: ["A. ", "B. ", "C. ", "D. ", "E. "],
    answerHint: "VD: A, C",
  },
  {
    value: "matching_headings",
    labelVi: "Matching Headings",
    needsOptions: true,
    defaultOptions: ["i", "ii", "iii", "iv", "v", "vi"],
    answerHint: "VD: iii",
  },
  {
    value: "matching_info",
    labelVi: "Matching Information",
    needsOptions: true,
    defaultOptions: ["A", "B", "C", "D", "E", "F"],
    answerHint: "VD: B",
  },
  {
    value: "matching_features",
    labelVi: "Matching Features (Nhân vật / Quan điểm)",
    needsOptions: true,
    defaultOptions: ["A", "B", "C", "D"],
    answerHint: "VD: B",
  },
  {
    value: "matching_sentence_endings",
    labelVi: "Matching Sentence Endings",
    needsOptions: true,
    defaultOptions: ["A", "B", "C", "D", "E", "F"],
    answerHint: "VD: C",
  },
  {
    value: "summary_completion",
    labelVi: "Summary Completion",
    needsOptions: false,
    answerHint: "VD: colour/color",
  },
  {
    value: "sentence_completion",
    labelVi: "Sentence Completion",
    needsOptions: false,
    answerHint: "VD: solar panels/solar panel",
  },
  {
    value: "note_completion",
    labelVi: "Note Completion",
    needsOptions: false,
    answerHint: "VD: 15/fifteen",
  },
  {
    value: "table_completion",
    labelVi: "Table Completion",
    needsOptions: false,
    answerHint: "VD: harbour/harbor",
  },
  {
    value: "flowchart_completion",
    labelVi: "Flow-chart Completion",
    needsOptions: false,
    answerHint: "VD: filtration",
  },
  {
    value: "short_answer",
    labelVi: "Short Answer",
    needsOptions: false,
    answerHint: "VD: timber/wood",
  },
  {
    value: "map_labelling",
    labelVi: "Map / Diagram Labelling",
    needsOptions: true,
    defaultOptions: ["A", "B", "C", "D", "E", "F", "G", "H"],
    answerHint: "VD: C",
  },
];

export const OPTION_TYPES_SET = new Set<QuestionType>(
  QUESTION_TYPE_CATALOG.filter((item) => item.needsOptions).map((item) => item.value)
);

/**
 * Splits multi-accepted answer string such as "colour/color" or "15 | fifteen"
 * into normalized unique array ["colour", "color"].
 */
export function parseAcceptedAnswersInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[/|\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

export function formatAcceptedAnswersInput(answers: string[]): string {
  return (answers ?? []).join(" / ");
}

export function renumberTestSections(sections: TestSection[]): TestSection[] {
  let cursor = 1;
  return sections.map((sec) => {
    const numMap = new Map<string, number>();
    const questions = sec.questions.map((q) => {
      const next = { ...q, number: cursor };
      numMap.set(q.id, cursor);
      cursor += 1;
      return next;
    });
    const groups = sec.groups?.map((g) => {
      const nums = g.questionIds
        .map((id) => numMap.get(id))
        .filter((n): n is number => typeof n === "number");
      if (nums.length === 0) return g;
      return {
        ...g,
        questionRange: {
          start: Math.min(...nums),
          end: Math.max(...nums),
        },
      };
    });
    return {
      ...sec,
      ...(groups ? { groups } : {}),
      questions,
    };
  });
}

const cmsQuestionTypeEnum = z.enum([
  "mcq",
  "mcq_multi",
  "tfng",
  "ynng",
  "matching_headings",
  "matching_info",
  "matching_features",
  "matching_sentence_endings",
  "sentence_completion",
  "summary_completion",
  "table_completion",
  "note_completion",
  "flowchart_completion",
  "map_labelling",
  "short_answer",
]);

export const cmsQuestionGroupSchema = z.object({
  id: z.string().trim().min(1),
  questionRange: z.object({
    start: z.coerce.number().int().min(1).max(60),
    end: z.coerce.number().int().min(1).max(60),
  }),
  type: cmsQuestionTypeEnum,
  title: z.string().trim().max(300).optional(),
  instruction: z.string().trim().max(1500).optional(),
  sharedPrompt: z.string().trim().max(2000).optional(),
  sharedContent: z
    .object({
      kind: z.enum(["summary", "notes", "table", "flowchart", "list", "plain"]),
      text: z.string().max(20000).optional(),
      table: z
        .object({
          title: z.string().max(300).optional(),
          headers: z.array(z.string().max(500)),
          rows: z.array(z.array(z.string().max(2000))),
        })
        .optional(),
      flowchart: z
        .object({
          title: z.string().max(300).optional(),
          steps: z.array(z.string().max(2000)),
        })
        .optional(),
      notes: z
        .object({
          title: z.string().max(300).optional(),
          sections: z.array(
            z.object({
              heading: z.string().max(300).optional(),
              bullets: z.array(z.string().max(2000)),
            })
          ),
        })
        .optional(),
      listTitle: z.string().max(300).optional(),
    })
    .optional(),
  answerBank: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(20),
        text: z.string().trim().min(1).max(1000),
      })
    )
    .optional(),
  allowReuse: z.boolean().optional(),
  wordLimit: z
    .object({
      maxWords: z.coerce.number().int().min(0).max(10).optional(),
      allowNumber: z.boolean().optional(),
      numberMode: z.enum(["word_or_number", "word_only", "number_only"]).optional(),
    })
    .optional(),
  maxSelections: z.coerce.number().int().min(1).max(10).optional(),
  passageRange: z
    .object({
      startParagraph: z.coerce.number().int().min(0).optional(),
      endParagraph: z.coerce.number().int().min(0).optional(),
      paragraphLabels: z.array(z.string().trim().min(1).max(10)).optional(),
    })
    .optional(),
  allowNumberWordEquivalence: z.boolean().optional(),
  questionIds: z.array(z.string().trim().min(1)).default([]),
  isAutoGenerated: z.boolean().optional(),
});

export const cmsQuestionSchema = z.object({
  id: z.string().trim().min(1),
  number: z.coerce.number().int().min(1).max(60),
  type: cmsQuestionTypeEnum,
  prompt: z.string().trim().max(2000).default(""),
  options: z.array(z.string().trim()).optional(),
  correctAnswers: z.array(z.string().trim()).default([]),
  explanation_vi: z.string().trim().max(2000).default(""),
  explanation_en: z.string().trim().max(2000).default(""),
  sectionRef: z.string().trim().max(300).optional(),
  groupId: z.string().trim().max(120).optional(),
});

export const cmsSectionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1, "Tiêu đề Section/Part không được để trống.").max(200),
  instruction: z.string().trim().max(1000).optional(),
  passage: z.string().max(40000).optional(),
  audioUrl: z.string().trim().max(1000).optional(),
  audioScript: z.string().max(40000).optional(),
  diagramLabel: z.string().trim().max(200).optional(),
  diagramSvgType: z
    .enum(["campus_map", "water_cycle", "museum_floor"])
    .optional(),
  diagramImageUrl: z.string().trim().max(1000).optional(),
  headingBank: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        text: z.string().trim().min(1),
      })
    )
    .optional(),
  groups: z.array(cmsQuestionGroupSchema).optional(),
  questions: z.array(cmsQuestionSchema).default([]),
});

export const cmsTestFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3, "Slug cần ít nhất 3 ký tự.")
    .max(120)
    .transform((v) => slugifyVi(v))
    .refine((v) => v.length >= 3, "Slug không hợp lệ."),
  skill: z.enum(["reading", "listening", "writing", "speaking"]),
  module: z.enum(["academic", "general"]).default("academic"),
  title_vi: z.string().trim().min(5, "Tiêu đề cần ít nhất 5 ký tự.").max(200),
  title_en: z.string().trim().max(200).optional().default(""),
  description_vi: z.string().trim().max(1000).optional().default(""),
  description_en: z.string().trim().max(1000).optional().default(""),
  duration_minutes: z.coerce.number().int().min(5).max(180).default(60),
  difficulty: z.enum(["band_5_6", "band_6_7", "band_7_plus"]).default("band_6_7"),
  is_published: z.boolean().default(false),
  is_daily_eligible: z.boolean().default(false),
  is_premium: z.boolean().default(false),
  seo_meta: seoMetaSchema,
  sections: z.array(cmsSectionSchema).default([]),
  writingPrompt: z
    .object({
      taskType: z.enum(["academic_t1", "general_t1", "task_2"]),
      prompt: z.string().trim().max(5000),
      minWords: z.coerce.number().int().min(100).max(500).default(250),
      chartSummary: z.string().trim().max(2000).optional(),
    })
    .optional(),
  speakingPrompts: z
    .object({
      part1: z.array(z.string().trim()).default([]),
      part2: z.object({
        topic: z.string().trim().default(""),
        bullets: z.array(z.string().trim()).default([]),
      }),
      part3: z.array(z.string().trim()).default([]),
    })
    .optional(),
});

export type CmsTestFormInput = z.infer<typeof cmsTestFormSchema>;

export interface PublishValidationReport {
  canPublish: boolean;
  errors: string[];
  warnings: string[];
  questionCount: number;
  missingNumbers: number[];
  duplicateNumbers: number[];
  missingAnswerNumbers: number[];
}

/**
 * Automatic pre-publish validator for Admin CMS (Mục 3.1):
 * - Reading & Listening: strictly requires 40 questions, unique 1..40 numbering,
 *   non-empty prompt & at least 1 accepted answer on every question.
 * - Writing & Speaking: validates required prompt structure.
 */
export function validateTestForPublish(
  test: Pick<
    IeltsTest,
    "skill" | "sections" | "writingPrompt" | "speakingPrompts"
  >
): PublishValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (test.skill === "writing") {
    const prompt = test.writingPrompt?.prompt?.trim() ?? "";
    if (prompt.length < 20) {
      errors.push("Đề Writing cần có nội dung đề bài (tối thiểu 20 ký tự) trước khi xuất bản.");
    }
    return {
      canPublish: errors.length === 0,
      errors,
      warnings,
      questionCount: 1,
      missingNumbers: [],
      duplicateNumbers: [],
      missingAnswerNumbers: [],
    };
  }

  if (test.skill === "speaking") {
    const p1 = (test.speakingPrompts?.part1 ?? []).filter((s) => s.trim().length > 0);
    const p2Topic = test.speakingPrompts?.part2?.topic?.trim() ?? "";
    const p2Bullets = (test.speakingPrompts?.part2?.bullets ?? []).filter((s) => s.trim().length > 0);
    const p3 = (test.speakingPrompts?.part3 ?? []).filter((s) => s.trim().length > 0);

    if (p1.length < 2) errors.push("Đề Speaking cần ít nhất 2 câu hỏi Part 1.");
    if (p2Topic.length < 10 || p2Bullets.length < 2) {
      errors.push("Đề Speaking cần Cue Card Part 2 (chủ đề & ít nhất 2 ý gợi ý).");
    }
    if (p3.length < 2) errors.push("Đề Speaking cần ít nhất 2 câu hỏi Part 3.");

    return {
      canPublish: errors.length === 0,
      errors,
      warnings,
      questionCount: p1.length + 1 + p3.length,
      missingNumbers: [],
      duplicateNumbers: [],
      missingAnswerNumbers: [],
    };
  }

  // Reading & Listening full 40-question automatic audit
  const allQuestions: TestQuestion[] = test.sections.flatMap((s) => s.questions);
  const questionCount = allQuestions.length;

  if (test.sections.length === 0) {
    errors.push("Đề thi cần ít nhất 1 Section/Part.");
  }

  if (questionCount !== 40) {
    errors.push(
      `Đề ${test.skill === "reading" ? "Reading" : "Listening"} cần đủ 40 câu trước khi xuất bản (hiện có ${questionCount}/40 câu).`
    );
  }

  const freq = new Map<number, number>();
  const missingAnswerNumbers: number[] = [];
  const emptyPromptNumbers: number[] = [];
  const missingOptionNumbers: number[] = [];

  for (const q of allQuestions) {
    freq.set(q.number, (freq.get(q.number) ?? 0) + 1);
    const validAnswers = (q.correctAnswers ?? []).map((a) => a.trim()).filter(Boolean);
    if (validAnswers.length === 0) {
      missingAnswerNumbers.push(q.number);
    }
    if (!q.prompt || q.prompt.trim().length < 2) {
      emptyPromptNumbers.push(q.number);
    }
    if (OPTION_TYPES_SET.has(q.type)) {
      const validOpts = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (validOpts.length < 2) {
        missingOptionNumbers.push(q.number);
      }
    }
    if (!q.explanation_vi || q.explanation_vi.trim().length < 3) {
      if (warnings.length < 5) {
        warnings.push(`Câu ${q.number} chưa có giải thích tiếng Việt.`);
      }
    }
  }

  const duplicateNumbers = Array.from(freq.entries())
    .filter(([, count]) => count > 1)
    .map(([num]) => num)
    .sort((a, b) => a - b);

  const missingNumbers: number[] = [];
  for (let n = 1; n <= 40; n++) {
    if (!freq.has(n)) missingNumbers.push(n);
  }

  if (duplicateNumbers.length > 0) {
    errors.push(`Trùng số thứ tự câu hỏi: ${duplicateNumbers.join(", ")}.`);
  }
  if (missingNumbers.length > 0 && questionCount === 40) {
    errors.push(
      `Thiếu số thứ tự câu hỏi trong dãy 1–40: ${missingNumbers.slice(0, 10).join(", ")}${missingNumbers.length > 10 ? "..." : ""}.`
    );
  } else if (missingNumbers.length > 0 && duplicateNumbers.length === 0) {
    warnings.push(
      `Các số câu chưa có trong dãy 1–40: ${missingNumbers.slice(0, 12).join(", ")}${missingNumbers.length > 12 ? "..." : ""}.`
    );
  }

  if (missingAnswerNumbers.length > 0) {
    errors.push(
      `Chưa có đáp án đúng ở câu: ${missingAnswerNumbers.slice(0, 12).join(", ")}${missingAnswerNumbers.length > 12 ? "..." : ""}.`
    );
  }
  if (emptyPromptNumbers.length > 0) {
    errors.push(
      `Chưa nhập nội dung câu hỏi ở câu: ${emptyPromptNumbers.slice(0, 12).join(", ")}.`
    );
  }
  if (missingOptionNumbers.length > 0) {
    errors.push(
      `Câu dạng trắc nghiệm/matching cần ít nhất 2 lựa chọn ở câu: ${missingOptionNumbers.slice(0, 12).join(", ")}.`
    );
  }

  // Helpful content quality warnings
  test.sections.forEach((sec, idx) => {
    if (test.skill === "listening" && !sec.audioUrl?.trim()) {
      warnings.push(`Part ${idx + 1} (${sec.title}) chưa gắn file âm thanh MP3.`);
    }
    if (test.skill === "reading" && (!sec.passage || sec.passage.trim().length < 80)) {
      warnings.push(`Passage ${idx + 1} (${sec.title}) chưa có đoạn văn đầy đủ.`);
    }
    const hasMapQ = sec.questions.some((q) => q.type === "map_labelling");
    if (hasMapQ && !sec.diagramSvgType && !sec.diagramImageUrl?.trim()) {
      warnings.push(`Phần ${idx + 1} có câu Map/Diagram Labelling nhưng chưa gắn sơ đồ ảnh/SVG.`);
    }
  });

  return {
    canPublish: errors.length === 0,
    errors,
    warnings,
    questionCount,
    missingNumbers,
    duplicateNumbers,
    missingAnswerNumbers,
  };
}
