export type UserRole = "learner" | "editor" | "admin";
export type AppLocale = "vi" | "en";
export type IeltsSkill = "reading" | "listening" | "writing" | "speaking";
export type BandConversionSkill = "listening" | "reading_academic" | "reading_general";
export type ContentPublishStatus = "draft" | "published" | "scheduled";

export interface SeoMeta {
  metaTitle?: string;
  metaDescription?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  canonicalUrl?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogImageAlt?: string;
  coverImageAlt?: string;
}

export interface MediaUsageRef {
  entityType: string;
  entityId: string;
  label: string;
  href: string;
}

export interface MediaAsset {
  id: string;
  bucket: string;
  storage_path: string;
  public_url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string;
  folder: string;
  uploaded_by: string | null;
  created_at: string;
  usages?: MediaUsageRef[];
}

export interface AdminAuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string;
  actor_role: UserRole | string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  entity_label: string;
  summary: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  role: UserRole;
  is_locked?: boolean;
  target_band: number;
  current_band?: number | null;
  locale: AppLocale;
  premium_expires_at?: string | null;
  referral_code: string;
  referred_by?: string | null;
  email_verified: boolean;
  streak_count: number;
  last_active_date?: string | null;
  created_at: string;
}

export interface SessionUser extends UserProfile {
  isPremium: boolean;
  authMode: "supabase" | "demo";
}

export type AuthResolutionStatus =
  | "authenticated"
  | "unauthenticated"
  | "profile_error";

export interface BandConversionRow {
  id: string;
  skill: BandConversionSkill;
  min_raw: number;
  max_raw: number;
  band_score: number;
}

export interface PricingPlan {
  id: string;
  slug: string;
  name_vi: string;
  name_en: string;
  duration_months: number;
  price_vnd: number;
  original_price_vnd: number;
  is_popular: boolean;
  features_vi: string[];
  features_en: string[];
  is_active: boolean;
  sort_order: number;
}

export interface PromoBanner {
  id: string;
  key: string;
  title_vi: string;
  title_en: string;
  badge_vi: string;
  badge_en: string;
  ends_at: string;
  cta_vi: string;
  cta_en: string;
  is_active: boolean;
}

export interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  max_discount_vnd?: number | null;
  max_uses?: number | null;
  current_uses: number;
  expires_at?: string | null;
  is_active: boolean;
}

export interface OrderRecord {
  id: string;
  user_id: string;
  plan_id: string;
  plan_slug: string;
  duration_months: number;
  order_code: number;
  provider: "payos" | "vnpay" | "momo" | "stripe" | "mock";
  amount_vnd: number;
  discount_vnd: number;
  promo_code?: string | null;
  status: "pending" | "paid" | "cancelled" | "expired" | "refunded";
  checkout_url?: string | null;
  qr_code?: string | null;
  webhook_event_id?: string | null;
  paid_at?: string | null;
  created_at: string;
}

export interface AiUsageLog {
  id: string;
  user_id: string;
  feature: string;
  skill?: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  cached: boolean;
  latency_ms: number;
  created_at: string;
}

export type QuestionType =
  | "mcq"
  | "mcq_multi"
  | "tfng"
  | "ynng"
  | "matching_headings"
  | "matching_info"
  | "sentence_completion"
  | "summary_completion"
  | "table_completion"
  | "note_completion"
  | "flowchart_completion"
  | "map_labelling"
  | "short_answer";

export interface TestQuestion {
  id: string;
  number: number;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswers: string[];
  explanation_vi: string;
  explanation_en: string;
  sectionRef?: string;
}

export interface TestSection {
  id: string;
  title: string;
  instruction?: string;
  passage?: string;
  audioUrl?: string;
  audioScript?: string;
  diagramLabel?: string;
  diagramSvgType?: "campus_map" | "water_cycle" | "museum_floor";
  diagramImageUrl?: string;
  headingBank?: { id: string; text: string }[];
  questions: TestQuestion[];
}

export interface IeltsTest {
  id: string;
  slug: string;
  skill: IeltsSkill;
  module: "academic" | "general";
  title_vi: string;
  title_en: string;
  description_vi: string;
  description_en: string;
  duration_minutes: number;
  difficulty: "band_5_6" | "band_6_7" | "band_7_plus";
  questionCount: number;
  is_published: boolean;
  is_daily_eligible?: boolean;
  is_premium?: boolean;
  seo_meta?: SeoMeta;
  sections: TestSection[];
  writingPrompt?: {
    taskType: "academic_t1" | "general_t1" | "task_2";
    prompt: string;
    minWords: number;
    chartSummary?: string;
  };
  speakingPrompts?: {
    part1: string[];
    part2: { topic: string; bullets: string[] };
    part3: string[];
  };
  created_at: string;
}

export interface TestAttempt {
  id: string;
  user_id: string;
  test_id: string;
  test_slug: string;
  test_title: string;
  skill: IeltsSkill;
  answers: Record<string, string>;
  raw_score: number;
  max_score: number;
  band_score: number;
  breakdown_by_type: Record<string, { correct: number; total: number }>;
  duration_seconds: number;
  completed_at: string;
}

export interface DailyExamAttempt {
  id: string;
  exam_date: string;
  test_slug: string;
  user_id: string;
  display_name: string;
  started_at: string;
  submitted_at?: string | null;
  answers: Record<string, string>;
  raw_score: number;
  max_score: number;
  band_score: number;
  duration_seconds: number;
  is_completed: boolean;
}

export interface WritingEvaluation {
  overallBand: number;
  criteria: {
    taskResponse: { band: number; feedbackVi: string; feedbackEn: string };
    coherenceCohesion: { band: number; feedbackVi: string; feedbackEn: string };
    lexicalResource: { band: number; feedbackVi: string; feedbackEn: string };
    grammaticalRange: { band: number; feedbackVi: string; feedbackEn: string };
  };
  inlineErrors: {
    original: string;
    correction: string;
    category: "grammar" | "vocabulary" | "coherence" | "spelling";
    explanationVi: string;
  }[];
  vocabUpgrades: {
    basic: string;
    upgraded: string;
    noteVi: string;
  }[];
  band8Rewrite: string;
  summaryVi: string;
}

export interface WritingSubmission {
  id: string;
  user_id: string;
  task_type: "academic_t1" | "general_t1" | "task_2";
  prompt_text: string;
  chart_image_name?: string | null;
  essay_text: string;
  word_count: number;
  overall_band: number;
  evaluation: WritingEvaluation;
  is_public: boolean;
  created_at: string;
}

export interface SpeakingEvaluation {
  transcript: string;
  overallBand: number;
  isReferenceScore: true;
  criteria: {
    fluencyCoherence: { band: number; feedbackVi: string };
    lexicalResource: { band: number; feedbackVi: string };
    grammaticalRange: { band: number; feedbackVi: string };
    pronunciation: { band: number; feedbackVi: string; referenceNoteVi: string };
  };
  strengthsVi: string[];
  improvementsVi: string[];
  improvedAnswer: string;
}

export interface SpeakingSubmission {
  id: string;
  user_id: string;
  part: "part_1" | "part_2" | "part_3";
  prompt_text: string;
  audio_duration_sec: number;
  transcript: string;
  overall_band: number;
  evaluation: SpeakingEvaluation;
  is_public: boolean;
  created_at: string;
}

export interface FlashcardSet {
  id: string;
  user_id: string;
  title: string;
  description: string;
  is_public: boolean;
  created_at: string;
}

export interface FlashcardItem {
  id: string;
  set_id: string;
  user_id: string;
  term: string;
  phonetic: string;
  part_of_speech: string;
  definition_vi: string;
  definition_en: string;
  example_sentence: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  created_at: string;
}

export interface CourseItem {
  id: string;
  slug: string;
  title_vi: string;
  title_en: string;
  description_vi: string;
  description_en: string;
  level: string;
  target_band: string;
  duration_hours: number;
  is_published: boolean;
  lessons: {
    id: string;
    title_vi: string;
    title_en: string;
    duration_min: number;
    content_vi: string;
    content_en: string;
    keyTakeaways: string[];
    quiz?: {
      question: string;
      options: string[];
      correctIndex: number;
      explanation_vi: string;
    };
  }[];
}

export interface CourseProgress {
  user_id: string;
  course_id: string;
  completed_lesson_ids: string[];
  progress_percent: number;
  updated_at: string;
}

export interface DictationLesson {
  id: string;
  slug: string;
  title_vi: string;
  title_en: string;
  category: string;
  difficulty: string;
  accent: "en-GB" | "en-US" | "en-AU";
  sentences: {
    id: string;
    text: string;
    translation_vi: string;
    tip_vi?: string;
  }[];
}

export interface PronunciationSound {
  slug: string;
  symbol: string;
  category: "vowel" | "diphthong" | "consonant";
  title_vi: string;
  title_en: string;
  mouthPosition_vi: string;
  vietnameseTip_vi: string;
  tip_en: string;
  examples: { word: string; ipa: string; meaning_vi: string }[];
  practiceSentence: string;
}

export interface LearnVideo {
  id: string;
  slug: string;
  youtube_id: string;
  title_vi: string;
  title_en: string;
  description_vi: string;
  description_en: string;
  level: string;
  duration_label: string;
  transcript: {
    startSec: number;
    endSec: number;
    en: string;
    vi: string;
  }[];
}

export interface BlogPost {
  id: string;
  slug: string;
  title_vi: string;
  title_en: string;
  excerpt_vi: string;
  excerpt_en: string;
  content_vi: string;
  content_en: string;
  category: string;
  author_name: string;
  read_minutes: number;
  published_at: string;
  is_published: boolean;
  status?: ContentPublishStatus;
  scheduled_at?: string | null;
  is_featured?: boolean;
  is_premium?: boolean;
  tags?: string[];
  cover_image_url?: string | null;
  seo_meta?: SeoMeta;
}

export interface TestimonialItem {
  id: string;
  learner_name: string;
  target_achieved: string;
  previous_band: number;
  new_band: number;
  quote_vi: string;
  quote_en: string;
  role_vi: string;
  role_en: string;
  is_published: boolean;
}

export interface WritingExercise {
  id: string;
  slug: string;
  title_vi: string;
  title_en: string;
  topic: string;
  targetSkill: string;
  sentences: {
    id: string;
    weakSentence: string;
    issue_vi: string;
    hint_vi: string;
    band8Model: string;
    keyUpgrades: string[];
  }[];
}

export interface ConversationTopic {
  slug: string;
  title_vi: string;
  title_en: string;
  part: "Part 1" | "Part 2" | "Part 3" | "Daily Life";
  level: string;
  opener: string;
  description_vi: string;
  description_en: string;
  suggestedVocab: string[];
}

export interface ReferralRecord {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  referred_email: string;
  referral_code: string;
  status: "signed_up" | "converted_premium";
  created_at: string;
  converted_at?: string | null;
}

export interface FeatureRequestItem {
  id: string;
  title: string;
  description: string;
  votes: number;
  status: "open" | "planned" | "shipped";
  created_at: string;
}

export interface ContactMessageItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "replied";
  created_at: string;
}
