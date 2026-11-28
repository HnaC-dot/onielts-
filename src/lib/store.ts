import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  AiUsageLog,
  BandConversionRow,
  BlogPost,
  ContactMessageItem,
  ConversationTopic,
  CourseItem,
  CourseProgress,
  DailyExamAttempt,
  DictationLesson,
  FaqItem,
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
  ReferralConfigSettings,
  ReferralRecord,
  SeoRedirectItem,
  SiteGeneralSettings,
  SiteSeoSettings,
  SpeakingSubmission,
  StaticPageItem,
  TestAttempt,
  TestAttemptAnswerRecord,
  TestimonialItem,
  UserProfile,
  WritingExercise,
  WritingSubmission,
} from "./types";
import {
  DEFAULT_BAND_CONVERSIONS,
  DEFAULT_BLOG_POSTS,
  DEFAULT_CONVERSATION_TOPICS,
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
import {
  DEFAULT_FAQS,
  DEFAULT_REFERRAL_CONFIG,
  DEFAULT_SITE_GENERAL_SETTINGS,
  DEFAULT_STATIC_PAGES,
} from "./system-cms-shared";
import { DEFAULT_SITE_SEO_SETTINGS } from "./seo-cms-shared";
import {
  DEFAULT_APPEARANCE_CONFIG,
  type AppearanceVersionEntry,
  type SiteAppearanceConfig,
} from "./appearance-shared";
import {
  DEFAULT_BLOG_QUALITY_CONFIG,
  type BlogQualityConfig,
  type ContentCalendarItem,
  type NewsletterSubscriber,
} from "./content-production-shared";
import { FULL_SEED_TESTS } from "./seed-tests";
import type { StoredTestSessionDraft } from "./exam-session";

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
  test_attempt_answers: TestAttemptAnswerRecord[];
  test_session_drafts?: StoredTestSessionDraft[];
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
  conversation_topics: ConversationTopic[];
  referrals: ReferralRecord[];
  feature_requests: FeatureRequestItem[];
  contact_messages: ContactMessageItem[];
  static_pages: StaticPageItem[];
  faqs: FaqItem[];
  seo_redirects: SeoRedirectItem[];
  content_calendar_items: ContentCalendarItem[];
  newsletter_subscribers: NewsletterSubscriber[];
  site_settings: {
    general: SiteGeneralSettings;
    referral: ReferralConfigSettings;
    seo: SiteSeoSettings;
    blog_quality?: BlogQualityConfig;
    appearance_published?: SiteAppearanceConfig;
    appearance_draft?: SiteAppearanceConfig;
    appearance_history?: AppearanceVersionEntry[];
    /** Slugs of built-in sample tests an admin deleted (prevents auto re-seeding). */
    deleted_seed_test_slugs?: string[];
  };
}

const STORE_DIR = path.join(process.cwd(), ".local-data");
const STORE_PATH = path.join(STORE_DIR, "store.json");
const CURRENT_STORE_VERSION = 10;

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
    test_attempt_answers: [],
    test_session_drafts: [],
    daily_exam_attempts: [],
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
    pronunciation_sounds: structuredClone(DEFAULT_IPA_SOUNDS).map((s, idx) => ({
      ...s,
      id: s.id ?? `ipa-${idx + 1}`,
      is_published: true,
      sort_order: idx + 1,
    })),
    learn_videos: structuredClone(DEFAULT_LEARN_VIDEOS),
    blog_posts: structuredClone(DEFAULT_BLOG_POSTS),
    testimonials: structuredClone(DEFAULT_TESTIMONIALS),
    writing_exercises: structuredClone(DEFAULT_WRITING_EXERCISES).map((w, idx) => ({
      ...w,
      status: "published" as const,
      sort_order: idx + 1,
    })),
    conversation_topics: structuredClone(DEFAULT_CONVERSATION_TOPICS).map((c, idx) => ({
      ...c,
      id: c.id ?? `conv-${idx + 1}`,
      status: "published" as const,
      sort_order: idx + 1,
    })),
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
    static_pages: structuredClone(DEFAULT_STATIC_PAGES),
    faqs: structuredClone(DEFAULT_FAQS),
    seo_redirects: [],
    content_calendar_items: [],
    newsletter_subscribers: [],
    site_settings: {
      general: structuredClone(DEFAULT_SITE_GENERAL_SETTINGS),
      referral: structuredClone(DEFAULT_REFERRAL_CONFIG),
      seo: structuredClone(DEFAULT_SITE_SEO_SETTINGS),
      blog_quality: structuredClone(DEFAULT_BLOG_QUALITY_CONFIG),
      appearance_published: structuredClone(DEFAULT_APPEARANCE_CONFIG),
      appearance_draft: structuredClone(DEFAULT_APPEARANCE_CONFIG),
      appearance_history: [],
    },
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
        let dirty = false;
        if ((parsed.version ?? 1) < CURRENT_STORE_VERSION) {
          if ((parsed.version ?? 1) < 3) {
            parsed.ielts_tests = structuredClone(FULL_SEED_TESTS);
          }
          if (!Array.isArray(parsed.conversation_topics)) {
            parsed.conversation_topics = structuredClone(DEFAULT_CONVERSATION_TOPICS).map(
              (c, idx) => ({
                ...c,
                id: c.id ?? `conv-${idx + 1}`,
                status: "published" as const,
                sort_order: idx + 1,
              })
            );
          }
          parsed.pronunciation_sounds = (parsed.pronunciation_sounds ?? DEFAULT_IPA_SOUNDS).map(
            (s, idx) => ({
              ...s,
              id: s.id ?? `ipa-${idx + 1}`,
              is_published: s.is_published ?? true,
              sort_order: s.sort_order ?? idx + 1,
            })
          );
          if (!Array.isArray(parsed.static_pages)) {
            parsed.static_pages = structuredClone(DEFAULT_STATIC_PAGES);
          }
          if (!Array.isArray(parsed.faqs)) {
            parsed.faqs = structuredClone(DEFAULT_FAQS);
          }
          if (!Array.isArray(parsed.seo_redirects)) {
            parsed.seo_redirects = [];
          }
          if (!Array.isArray(parsed.test_attempt_answers)) {
            parsed.test_attempt_answers = [];
          }
          if (!Array.isArray(parsed.test_session_drafts)) {
            parsed.test_session_drafts = [];
          }
          if (!Array.isArray(parsed.content_calendar_items)) {
            parsed.content_calendar_items = [];
          }
          if (!Array.isArray(parsed.newsletter_subscribers)) {
            parsed.newsletter_subscribers = [];
          }
          if (!parsed.site_settings) {
            parsed.site_settings = {
              general: structuredClone(DEFAULT_SITE_GENERAL_SETTINGS),
              referral: structuredClone(DEFAULT_REFERRAL_CONFIG),
              seo: structuredClone(DEFAULT_SITE_SEO_SETTINGS),
              blog_quality: structuredClone(DEFAULT_BLOG_QUALITY_CONFIG),
              appearance_published: structuredClone(DEFAULT_APPEARANCE_CONFIG),
              appearance_draft: structuredClone(DEFAULT_APPEARANCE_CONFIG),
              appearance_history: [],
            };
          } else {
            if (!parsed.site_settings.seo) {
              parsed.site_settings.seo = structuredClone(DEFAULT_SITE_SEO_SETTINGS);
            }
            if (!parsed.site_settings.blog_quality) {
              parsed.site_settings.blog_quality = structuredClone(DEFAULT_BLOG_QUALITY_CONFIG);
            }
            if (!parsed.site_settings.appearance_published) {
              parsed.site_settings.appearance_published = structuredClone(DEFAULT_APPEARANCE_CONFIG);
            }
            if (!parsed.site_settings.appearance_draft) {
              parsed.site_settings.appearance_draft = structuredClone(DEFAULT_APPEARANCE_CONFIG);
            }
            if (!Array.isArray(parsed.site_settings.appearance_history)) {
              parsed.site_settings.appearance_history = [];
            }
          }
          parsed.version = CURRENT_STORE_VERSION;
          dirty = true;
        }
        if (dirty) writeStoreFile(parsed);
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
