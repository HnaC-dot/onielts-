import { z } from "zod";
import { seoMetaSchema } from "./seo";

export const LEARNING_MODULES = [
  "courses",
  "conversations",
  "writing-exercises",
  "pronunciation",
  "dictation",
  "videos",
] as const;

export type LearningModuleKey = (typeof LEARNING_MODULES)[number];

export function isLearningModuleKey(val: string): val is LearningModuleKey {
  return (LEARNING_MODULES as readonly string[]).includes(val);
}

const optionalUrlSchema = z
  .string()
  .max(1000)
  .optional()
  .nullable()
  .transform((v) => (v && v.trim() ? v.trim() : null));

// =============================================================================
// 1. COURSES & LESSONS
// =============================================================================
export const courseLessonQuizSchema = z.object({
  question: z.string().trim().min(3, "Nhập câu hỏi kiểm tra").max(500),
  options: z
    .array(z.string().trim().min(1, "Lựa chọn không được trống").max(250))
    .min(2, "Quiz cần ít nhất 2 lựa chọn")
    .max(6),
  correctIndex: z.number().int().min(0).max(5),
  explanation_vi: z.string().trim().max(600).default(""),
});

export const courseLessonSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title_vi: z.string().trim().min(2, "Tên bài học quá ngắn").max(200),
  title_en: z.string().trim().max(200).optional().default(""),
  duration_min: z.number().int().min(1).max(300).default(20),
  content_vi: z.string().min(5, "Nội dung bài học quá ngắn").max(60_000),
  content_en: z.string().max(60_000).optional().default(""),
  videoUrl: z.string().trim().max(1000).optional().default(""),
  audioUrl: z.string().trim().max(1000).optional().default(""),
  keyTakeaways: z.array(z.string().trim().min(1).max(300)).max(15).default([]),
  quiz: courseLessonQuizSchema.optional().nullable(),
});

export const courseCmsSchema = z.object({
  slug: z.string().trim().min(2, "Slug phải có ít nhất 2 ký tự").max(120),
  title_vi: z.string().trim().min(3, "Tiêu đề khóa học quá ngắn").max(200),
  title_en: z.string().trim().max(200).optional().default(""),
  description_vi: z.string().trim().min(5, "Mô tả khóa học quá ngắn").max(1000),
  description_en: z.string().trim().max(1000).optional().default(""),
  level: z.string().trim().min(2).max(80).default("Cơ bản – Trung cấp"),
  target_band: z.string().trim().min(1).max(30).default("6.5+"),
  cover_image_url: optionalUrlSchema,
  is_published: z.boolean().default(true),
  is_premium: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(9999).default(0),
  seo_meta: seoMetaSchema,
  lessons: z.array(courseLessonSchema).min(1, "Khóa học cần ít nhất 1 bài học").max(60),
});

export type CourseCmsInput = z.infer<typeof courseCmsSchema>;

// =============================================================================
// 2. AI CONVERSATION TOPICS
// =============================================================================
export const CONVERSATION_PARTS = ["Part 1", "Part 2", "Part 3", "Daily Life"] as const;

export const conversationCmsSchema = z.object({
  slug: z.string().trim().min(2, "Slug quá ngắn").max(120),
  title_vi: z.string().trim().min(2, "Tên chủ đề quá ngắn").max(180),
  title_en: z.string().trim().min(2, "Tên tiếng Anh quá ngắn").max(180),
  part: z.enum(CONVERSATION_PARTS).default("Part 1"),
  level: z.string().trim().min(2).max(60).default("Band 6.0–7.5"),
  opener: z.string().trim().min(5, "Câu mở đầu AI quá ngắn").max(600),
  description_vi: z.string().trim().min(5, "Mô tả quá ngắn").max(600),
  description_en: z.string().trim().max(600).optional().default(""),
  suggestedVocab: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  sampleQuestions: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  systemPrompt: z.string().trim().max(4000).optional().default(""),
  status: z.enum(["draft", "published", "scheduled"]).default("published"),
  is_premium: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(9999).default(0),
  seo_meta: seoMetaSchema,
});

export type ConversationCmsInput = z.infer<typeof conversationCmsSchema>;

// =============================================================================
// 3. WRITING IMPROVEMENT EXERCISES
// =============================================================================
export const WRITING_CRITERIA_OPTIONS = [
  "Lexical Resource",
  "Grammatical Range",
  "Task Achievement",
  "Coherence & Cohesion",
] as const;

export const writingExerciseSentenceSchema = z.object({
  id: z.string().trim().min(1).max(80),
  weakSentence: z.string().trim().min(5, "Câu gốc Band 5.5 quá ngắn").max(1000),
  issue_vi: z.string().trim().min(3, "Nhập phân tích điểm yếu").max(600),
  hint_vi: z.string().trim().min(3, "Nhập gợi ý nâng cấp").max(600),
  band8Model: z.string().trim().min(5, "Nhập câu mẫu Band 8.0+").max(1200),
  keyUpgrades: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
});

export const writingExerciseCmsSchema = z.object({
  slug: z.string().trim().min(2, "Slug quá ngắn").max(120),
  title_vi: z.string().trim().min(3, "Tiêu đề bài tập quá ngắn").max(200),
  title_en: z.string().trim().max(200).optional().default(""),
  topic: z.string().trim().min(2, "Nhập chủ đề").max(100),
  targetSkill: z.string().trim().min(2).max(140).default("Lexical Resource & Complex Clauses"),
  criteria: z
    .array(z.string().trim().min(2).max(80))
    .min(1, "Chọn ít nhất 1 tiêu chí chấm")
    .max(6)
    .default(["Lexical Resource", "Grammatical Range"]),
  explanation_vi: z.string().trim().max(2000).optional().default(""),
  explanation_en: z.string().trim().max(2000).optional().default(""),
  status: z.enum(["draft", "published", "scheduled"]).default("published"),
  is_premium: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(9999).default(0),
  seo_meta: seoMetaSchema,
  sentences: z
    .array(writingExerciseSentenceSchema)
    .min(1, "Bài tập cần ít nhất 1 câu thực hành")
    .max(25),
});

export type WritingExerciseCmsInput = z.infer<typeof writingExerciseCmsSchema>;

// =============================================================================
// 4. PRONUNCIATION IPA
// =============================================================================
export const pronunciationExampleSchema = z.object({
  word: z.string().trim().min(1, "Nhập từ tiếng Anh").max(80),
  ipa: z.string().trim().min(1, "Nhập phiên âm IPA").max(80),
  meaning_vi: z.string().trim().min(1, "Nhập nghĩa tiếng Việt").max(160),
});

export const pronunciationCmsSchema = z.object({
  slug: z.string().trim().min(1, "Slug không được trống").max(80),
  symbol: z.string().trim().min(1, "Nhập ký hiệu IPA (VD: /θ/)").max(30),
  category: z.enum(["vowel", "diphthong", "consonant"]).default("vowel"),
  title_vi: z.string().trim().min(2, "Tên âm quá ngắn").max(160),
  title_en: z.string().trim().max(160).optional().default(""),
  mouthPosition_vi: z.string().trim().min(5, "Nhập hướng dẫn khẩu hình").max(1200),
  vietnameseTip_vi: z.string().trim().min(5, "Nhập lỗi hay gặp của người Việt").max(1200),
  tip_en: z.string().trim().max(1200).optional().default(""),
  practiceSentence: z.string().trim().min(5, "Nhập câu luyện đọc").max(500),
  examples: z
    .array(pronunciationExampleSchema)
    .min(1, "Cần ít nhất 1 từ ví dụ")
    .max(20),
  mouth_image_url: optionalUrlSchema,
  audio_url: optionalUrlSchema,
  is_published: z.boolean().default(true),
  is_premium: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(9999).default(0),
  seo_meta: seoMetaSchema,
});

export type PronunciationCmsInput = z.infer<typeof pronunciationCmsSchema>;

// =============================================================================
// 5. DICTATION & SHADOWING
// =============================================================================
export const dictationSentenceSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(3, "Câu tiếng Anh quá ngắn").max(800),
  translation_vi: z.string().trim().min(2, "Nhập bản dịch tiếng Việt").max(800),
  tip_vi: z.string().trim().max(500).optional().default(""),
  audioUrl: z.string().trim().max(1000).optional().default(""),
});

export const dictationCmsSchema = z.object({
  slug: z.string().trim().min(2, "Slug quá ngắn").max(120),
  title_vi: z.string().trim().min(3, "Tiêu đề bài chép chính tả quá ngắn").max(200),
  title_en: z.string().trim().max(200).optional().default(""),
  category: z.string().trim().min(2).max(100).default("Listening Part 1"),
  difficulty: z.string().trim().min(2).max(60).default("Band 5.5–6.5"),
  accent: z.enum(["en-GB", "en-US", "en-AU"]).default("en-GB"),
  is_published: z.boolean().default(true),
  is_premium: z.boolean().default(false),
  seo_meta: seoMetaSchema,
  sentences: z
    .array(dictationSentenceSchema)
    .min(1, "Cần ít nhất 1 câu chép chính tả")
    .max(50),
});

export type DictationCmsInput = z.infer<typeof dictationCmsSchema>;

// =============================================================================
// 6. INTERACTIVE VIDEOS
// =============================================================================
export const videoTranscriptLineSchema = z.object({
  startSec: z.number().min(0).max(36_000),
  endSec: z.number().min(0).max(36_000),
  en: z.string().trim().min(1, "Dòng phụ đề tiếng Anh không được trống").max(1000),
  vi: z.string().trim().max(1000).default(""),
});

export const videoCmsSchema = z.object({
  slug: z.string().trim().min(2, "Slug quá ngắn").max(120),
  youtube_input: z
    .string()
    .trim()
    .min(5, "Nhập link YouTube hoặc YouTube ID (11 ký tự)")
    .max(500),
  title_vi: z.string().trim().min(3, "Tiêu đề video quá ngắn").max(200),
  title_en: z.string().trim().max(200).optional().default(""),
  description_vi: z.string().trim().min(5, "Mô tả video quá ngắn").max(1000),
  description_en: z.string().trim().max(1000).optional().default(""),
  level: z.string().trim().min(2).max(60).default("Band 6.0–7.5"),
  duration_label: z.string().trim().min(2).max(30).default("08:00"),
  is_published: z.boolean().default(true),
  is_premium: z.boolean().default(false),
  seo_meta: seoMetaSchema,
  transcript: z.array(videoTranscriptLineSchema).min(1, "Video cần ít nhất 1 dòng phụ đề").max(500),
});

export type VideoCmsInput = z.infer<typeof videoCmsSchema>;
