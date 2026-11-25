import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  AiUsageLog,
  BandConversionRow,
  BlogPost,
  ContactMessageItem,
  CourseItem,
  CourseProgress,
  DailyExamAttempt,
  DictationLesson,
  FeatureRequestItem,
  FlashcardItem,
  FlashcardSet,
  IeltsTest,
  LearnVideo,
  OrderRecord,
  PricingPlan,
  PromoBanner,
  PromoCode,
  PronunciationSound,
  ReferralRecord,
  SpeakingSubmission,
  TestAttempt,
  TestimonialItem,
  UserProfile,
  WritingExercise,
  WritingSubmission,
} from "./types";
import {
  DEFAULT_BAND_CONVERSIONS,
  DEFAULT_BLOG_POSTS,
  DEFAULT_COURSES,
  DEFAULT_DEMO_USERS,
  DEFAULT_DICTATION_LESSONS,
  DEFAULT_FEATURE_REQUESTS,
  DEFAULT_FLASHCARDS,
  DEFAULT_FLASHCARD_SETS,
  DEFAULT_IPA_SOUNDS,
  DEFAULT_LEARN_VIDEOS,
  DEFAULT_PRICING_PLANS,
  DEFAULT_PROMO_BANNER,
  DEFAULT_PROMO_CODES,
  DEFAULT_TESTIMONIALS,
  DEFAULT_WRITING_EXERCISES,
} from "./seed-data";
import { FULL_SEED_TESTS } from "./seed-tests";

export interface LocalStoreData {
  version: number;
  profiles: UserProfile[];
  band_conversion_tables: BandConversionRow[];
  pricing_plans: PricingPlan[];
  promo_banner: PromoBanner;
  promo_codes: PromoCode[];
  orders: OrderRecord[];
  ai_usage_logs: AiUsageLog[];
  ielts_tests: IeltsTest[];
  test_attempts: TestAttempt[];
  daily_exam_attempts: DailyExamAttempt[];
  writing_submissions: WritingSubmission[];
  speaking_submissions: SpeakingSubmission[];
  flashcard_sets: FlashcardSet[];
  flashcards: FlashcardItem[];
  courses: CourseItem[];
  course_progress: CourseProgress[];
  dictation_lessons: DictationLesson[];
  pronunciation_sounds: PronunciationSound[];
  learn_videos: LearnVideo[];
  blog_posts: BlogPost[];
  testimonials: TestimonialItem[];
  writing_exercises: WritingExercise[];
  referrals: ReferralRecord[];
  feature_requests: FeatureRequestItem[];
  contact_messages: ContactMessageItem[];
}

const STORE_DIR = path.join(process.cwd(), ".local-data");
const STORE_PATH = path.join(STORE_DIR, "store.json");
const CURRENT_STORE_VERSION = 2;

function buildInitialStore(): LocalStoreData {
  return {
    version: CURRENT_STORE_VERSION,
    profiles: structuredClone(DEFAULT_DEMO_USERS),
    band_conversion_tables: structuredClone(DEFAULT_BAND_CONVERSIONS),
    pricing_plans: structuredClone(DEFAULT_PRICING_PLANS),
    promo_banner: structuredClone(DEFAULT_PROMO_BANNER),
    promo_codes: structuredClone(DEFAULT_PROMO_CODES),
    orders: [],
    ai_usage_logs: [],
    ielts_tests: structuredClone(FULL_SEED_TESTS),
    test_attempts: [],
    daily_exam_attempts: [
      {
        id: "seed-daily-1",
        exam_date: "2026-11-25",
        test_slug: "academic-reading-01-urban-microclimates",
        user_id: "demo-premium-002",
        display_name: "Trần Hoàng Nam",
        started_at: "2026-11-25T01:00:00.000Z",
        submitted_at: "2026-11-25T01:09:42.000Z",
        answers: {},
        raw_score: 10,
        max_score: 10,
        band_score: 9.0,
        duration_seconds: 582,
        is_completed: true,
      },
      {
        id: "seed-daily-2",
        exam_date: "2026-11-25",
        test_slug: "academic-reading-01-urban-microclimates",
        user_id: "seed-user-vy",
        display_name: "Lê Thảo Vy",
        started_at: "2026-11-25T01:20:00.000Z",
        submitted_at: "2026-11-25T01:30:18.000Z",
        answers: {},
        raw_score: 9,
        max_score: 10,
        band_score: 8.0,
        duration_seconds: 618,
        is_completed: true,
      },
      {
        id: "seed-daily-3",
        exam_date: "2026-11-25",
        test_slug: "academic-reading-01-urban-microclimates",
        user_id: "seed-user-khoi",
        display_name: "Phạm Đức Khôi",
        started_at: "2026-11-25T02:00:00.000Z",
        submitted_at: "2026-11-25T02:11:05.000Z",
        answers: {},
        raw_score: 8,
        max_score: 10,
        band_score: 7.0,
        duration_seconds: 665,
        is_completed: true,
      },
    ],
    writing_submissions: [],
    speaking_submissions: [],
    flashcard_sets: structuredClone(DEFAULT_FLASHCARD_SETS),
    flashcards: structuredClone(DEFAULT_FLASHCARDS),
    courses: structuredClone(DEFAULT_COURSES),
    course_progress: [
      {
        user_id: "demo-free-001",
        course_id: "course-1",
        completed_lesson_ids: ["c1-l1"],
        progress_percent: 33,
        updated_at: "2026-11-20T08:00:00.000Z",
      },
    ],
    dictation_lessons: structuredClone(DEFAULT_DICTATION_LESSONS),
    pronunciation_sounds: structuredClone(DEFAULT_IPA_SOUNDS),
    learn_videos: structuredClone(DEFAULT_LEARN_VIDEOS),
    blog_posts: structuredClone(DEFAULT_BLOG_POSTS),
    testimonials: structuredClone(DEFAULT_TESTIMONIALS),
    writing_exercises: structuredClone(DEFAULT_WRITING_EXERCISES),
    referrals: [
      {
        id: "ref-seed-1",
        referrer_id: "demo-free-001",
        referred_user_id: "demo-premium-002",
        referred_email: "hoang.nam@onielts.vn",
        referral_code: "MINHANH26",
        status: "converted_premium",
        created_at: "2026-10-12T08:00:00.000Z",
        converted_at: "2026-10-15T10:30:00.000Z",
      },
    ],
    feature_requests: structuredClone(DEFAULT_FEATURE_REQUESTS),
    contact_messages: [],
  };
}

let cachedStore: LocalStoreData | null = null;

function ensureStoreFile(): LocalStoreData {
  if (cachedStore) return cachedStore;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as LocalStoreData;
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.profiles)) {
        if ((parsed.version ?? 1) < CURRENT_STORE_VERSION) {
          parsed.ielts_tests = structuredClone(FULL_SEED_TESTS);
          parsed.version = CURRENT_STORE_VERSION;
          writeStoreFile(parsed);
        }
        cachedStore = parsed;
        return cachedStore;
      }
    }
  } catch {
    // Re-seed if corrupted
  }
  const initial = buildInitialStore();
  writeStoreFile(initial);
  return initial;
}

function writeStoreFile(data: LocalStoreData): void {
  cachedStore = data;
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // On read-only serverless filesystems, keep in-memory cache
  }
}

export function readStore(): LocalStoreData {
  return ensureStoreFile();
}

export function updateStore<T>(updater: (draft: LocalStoreData) => T): T {
  const store = ensureStoreFile();
  const result = updater(store);
  writeStoreFile(store);
  return result;
}
