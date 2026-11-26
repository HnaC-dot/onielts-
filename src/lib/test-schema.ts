import { z } from "zod";
import type { IeltsTest } from "./types";

export const questionTypeSchema = z.enum([
  "mcq",
  "mcq_multi",
  "tfng",
  "ynng",
  "matching_headings",
  "matching_info",
  "sentence_completion",
  "summary_completion",
  "table_completion",
  "note_completion",
  "flowchart_completion",
  "map_labelling",
  "short_answer",
]);

const OPTION_REQUIRED_TYPES = new Set([
  "mcq",
  "mcq_multi",
  "tfng",
  "ynng",
  "matching_headings",
  "matching_info",
  "map_labelling",
]);

export const testQuestionSchema = z
  .object({
    id: z.string().trim().min(2),
    number: z.number().int().min(1).max(40),
    type: questionTypeSchema,
    prompt: z.string().trim().min(5),
    options: z.array(z.string().trim().min(1)).optional(),
    correctAnswers: z.array(z.string().trim().min(1)).min(1),
    explanation_vi: z.string().trim().min(5),
    explanation_en: z.string().trim().min(5),
    sectionRef: z.string().trim().min(1).optional(),
  })
  .superRefine((q, ctx) => {
    if (OPTION_REQUIRED_TYPES.has(q.type)) {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question #${q.number} (${q.type}) must provide at least 2 options`,
          path: ["options"],
        });
      }
    }
  });

export const testSectionSchema = z.object({
  id: z.string().trim().min(2),
  title: z.string().trim().min(3),
  instruction: z.string().trim().optional(),
  passage: z.string().trim().optional(),
  audioUrl: z.string().trim().optional(),
  audioScript: z.string().trim().optional(),
  diagramLabel: z.string().trim().optional(),
  diagramSvgType: z
    .enum(["campus_map", "water_cycle", "museum_floor"])
    .optional(),
  diagramImageUrl: z.string().trim().optional(),
  headingBank: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        text: z.string().trim().min(2),
      })
    )
    .optional(),
  questions: z.array(testQuestionSchema),
});

const baseTestFields = {
  id: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  module: z.enum(["academic", "general"]),
  title_vi: z.string().trim().min(5),
  title_en: z.string().trim().min(5),
  description_vi: z.string().trim().min(10),
  description_en: z.string().trim().min(10),
  duration_minutes: z.number().int().min(5).max(180),
  difficulty: z.enum(["band_5_6", "band_6_7", "band_7_plus"]),
  questionCount: z.number().int().min(1),
  is_published: z.boolean(),
  is_daily_eligible: z.boolean().optional(),
  created_at: z.string().trim().min(10),
};

function validate40UniqueSequentialQuestions(
  sections: z.infer<typeof testSectionSchema>[],
  declaredCount: number,
  ctx: z.RefinementCtx
) {
  const allQuestions = sections.flatMap((s) => s.questions);
  if (allQuestions.length !== 40) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expected exactly 40 questions, found ${allQuestions.length}`,
      path: ["sections"],
    });
  }
  if (declaredCount !== 40) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Expected questionCount === 40, found ${declaredCount}`,
      path: ["questionCount"],
    });
  }

  const seenIds = new Set<string>();
  const seenNumbers = new Set<number>();
  for (const q of allQuestions) {
    if (seenIds.has(q.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate question id: ${q.id}`,
        path: ["sections"],
      });
    }
    seenIds.add(q.id);

    if (seenNumbers.has(q.number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate question number: ${q.number}`,
        path: ["sections"],
      });
    }
    seenNumbers.add(q.number);
  }

  const expectedOrder = Array.from({ length: 40 }, (_, i) => i + 1);
  const actualOrder = allQuestions.map((q) => q.number);
  if (
    actualOrder.length === 40 &&
    actualOrder.some((n, idx) => n !== expectedOrder[idx])
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Question numbers must be strictly sequential from 1 to 40",
      path: ["sections"],
    });
  }
}

export const fullReadingTestSchema = z
  .object({
    ...baseTestFields,
    skill: z.literal("reading"),
    sections: z.array(testSectionSchema).length(3),
  })
  .superRefine((test, ctx) => {
    validate40UniqueSequentialQuestions(test.sections, test.questionCount, ctx);
    test.sections.forEach((sec, idx) => {
      if (!sec.passage || sec.passage.length < 120) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Reading section ${idx + 1} (${sec.id}) must include a substantial original passage`,
          path: ["sections", idx, "passage"],
        });
      }
    });
  });

export const fullListeningTestSchema = z
  .object({
    ...baseTestFields,
    skill: z.literal("listening"),
    sections: z.array(testSectionSchema).length(4),
  })
  .superRefine((test, ctx) => {
    validate40UniqueSequentialQuestions(test.sections, test.questionCount, ctx);
    test.sections.forEach((sec, idx) => {
      if (!sec.audioUrl || !/^\/audio\/listening\/[a-z0-9-]+\.mp3$/i.test(sec.audioUrl)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Listening section ${idx + 1} (${sec.id}) must have a valid /audio/listening/*.mp3 audioUrl`,
          path: ["sections", idx, "audioUrl"],
        });
      }
      if (!sec.audioScript || sec.audioScript.length < 150) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Listening section ${idx + 1} (${sec.id}) must include a full audioScript`,
          path: ["sections", idx, "audioScript"],
        });
      }
    });
  });

export const writingTestSchema = z.object({
  ...baseTestFields,
  skill: z.literal("writing"),
  sections: z.array(testSectionSchema),
  writingPrompt: z.object({
    taskType: z.enum(["academic_t1", "general_t1", "task_2"]),
    prompt: z.string().trim().min(40),
    minWords: z.number().int().min(150).max(400),
    chartSummary: z.string().trim().optional(),
  }),
});

export const speakingTestSchema = z.object({
  ...baseTestFields,
  skill: z.literal("speaking"),
  sections: z.array(testSectionSchema),
  speakingPrompts: z.object({
    part1: z.array(z.string().trim().min(10)).min(2),
    part2: z.object({
      topic: z.string().trim().min(15),
      bullets: z.array(z.string().trim().min(5)).min(3),
    }),
    part3: z.array(z.string().trim().min(10)).min(2),
  }),
});

export const ieltsTestSchema = z.union([
  fullReadingTestSchema,
  fullListeningTestSchema,
  writingTestSchema,
  speakingTestSchema,
]);

export function validateIeltsTest(test: IeltsTest) {
  switch (test.skill) {
    case "reading":
      return fullReadingTestSchema.safeParse(test);
    case "listening":
      return fullListeningTestSchema.safeParse(test);
    case "writing":
      return writingTestSchema.safeParse(test);
    case "speaking":
      return speakingTestSchema.safeParse(test);
  }
}

export function validateTestCatalog(tests: IeltsTest[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const seenAudioUrls = new Set<string>();

  for (const test of tests) {
    if (seenIds.has(test.id)) {
      errors.push(`Duplicate test id: ${test.id}`);
    }
    seenIds.add(test.id);

    if (seenSlugs.has(test.slug)) {
      errors.push(`Duplicate test slug: ${test.slug}`);
    }
    seenSlugs.add(test.slug);

    const parsed = validateIeltsTest(test);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      errors.push(`[${test.slug}] ${issues}`);
    }

    if (test.skill === "listening") {
      for (const sec of test.sections) {
        if (sec.audioUrl) {
          if (seenAudioUrls.has(sec.audioUrl)) {
            errors.push(`Duplicate audioUrl across listening sections: ${sec.audioUrl}`);
          }
          seenAudioUrls.add(sec.audioUrl);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
