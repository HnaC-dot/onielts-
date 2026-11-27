import "server-only";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { readStore, updateStore } from "./store";
import {
  DEFAULT_BAND_CONVERSIONS,
  DEFAULT_BLOG_POSTS,
  DEFAULT_CONVERSATION_TOPICS,
  DEFAULT_COURSES,
  DEFAULT_DICTATION_LESSONS,
  DEFAULT_FEATURE_REQUESTS,
  DEFAULT_IPA_SOUNDS,
  DEFAULT_LEARN_VIDEOS,
  DEFAULT_PRICING_PLANS,
  DEFAULT_PROMO_BANNER,
  DEFAULT_PROMO_CODES,
  DEFAULT_TESTIMONIALS,
  DEFAULT_WRITING_EXERCISES,
} from "./seed-data";
import { FULL_SEED_TESTS } from "./seed-tests";
import { computeExtendedPremiumExpiry } from "./payments/payos";
import { computeNextSm2 } from "./srs";
import { isBlogPostPubliclyVisible } from "./blog-shared";
import { computeNextStreak } from "./progress-shared";
import { getVietnamDateString } from "./utils";
import type { QuestionGradeDetail } from "./test-grader";
import {
  conversationTopicToDbRow,
  mapConversationRow,
  mapCourseRow,
  mapDictationRow,
  mapPronunciationRow,
  mapVideoRow,
  mapWritingExerciseRow,
  writingExerciseToDbRow,
} from "./learning-mappers";
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
  SeoMeta,
  SpeakingEvaluation,
  SpeakingSubmission,
  TestAttempt,
  TestimonialItem,
  UserProfile,
  WritingEvaluation,
  WritingExercise,
  WritingSubmission,
} from "./types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

/**
 * Returns the best available server Supabase client for public/system data access.
 * Prefers admin client for system catalog seeding and webhook operations,
 * falls back to cookie-scoped server client for RLS-enforced queries.
 */
async function getReadSupabase() {
  const admin = createSupabaseAdminClient();
  if (admin) return admin;
  return createSupabaseServerClient();
}

// =============================================================================
// ONE-TIME CONTENT AUTO-SEED FOR SUPABASE (Runs once per server instance)
// Never seeds fake users or fake leaderboard entries into Postgres!
// =============================================================================
let seedPromise: Promise<void> | null = null;

export async function ensureSupabaseCatalogSeeded(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        // 1. Band conversion tables
        const { count: bandCount } = await admin
          .from("band_conversion_tables")
          .select("id", { count: "exact", head: true });
        if (!bandCount || bandCount === 0) {
          await admin.from("band_conversion_tables").insert(
            DEFAULT_BAND_CONVERSIONS.map((r) => ({
              skill: r.skill,
              min_raw: r.min_raw,
              max_raw: r.max_raw,
              band_score: r.band_score,
            }))
          );
        }

        // 2. Pricing plans
        const { count: planCount } = await admin
          .from("pricing_plans")
          .select("id", { count: "exact", head: true });
        if (!planCount || planCount === 0) {
          await admin.from("pricing_plans").upsert(
            DEFAULT_PRICING_PLANS.map((p) => ({
              slug: p.slug,
              name_vi: p.name_vi,
              name_en: p.name_en,
              duration_months: p.duration_months,
              price_vnd: p.price_vnd,
              original_price_vnd: p.original_price_vnd,
              is_popular: p.is_popular,
              features_vi: p.features_vi,
              features_en: p.features_en,
              is_active: p.is_active,
              sort_order: p.sort_order,
            })),
            { onConflict: "slug", ignoreDuplicates: true }
          );
        }

        // 3. Promo banner & codes
        const { count: bannerCount } = await admin
          .from("promo_banners")
          .select("id", { count: "exact", head: true });
        if (!bannerCount || bannerCount === 0) {
          await admin.from("promo_banners").upsert(
            [
              {
                key: DEFAULT_PROMO_BANNER.key,
                title_vi: DEFAULT_PROMO_BANNER.title_vi,
                title_en: DEFAULT_PROMO_BANNER.title_en,
                badge_vi: DEFAULT_PROMO_BANNER.badge_vi,
                badge_en: DEFAULT_PROMO_BANNER.badge_en,
                ends_at: DEFAULT_PROMO_BANNER.ends_at,
                cta_vi: DEFAULT_PROMO_BANNER.cta_vi,
                cta_en: DEFAULT_PROMO_BANNER.cta_en,
                is_active: DEFAULT_PROMO_BANNER.is_active,
              },
            ],
            { onConflict: "key", ignoreDuplicates: true }
          );
        }

        const { count: codeCount } = await admin
          .from("promo_codes")
          .select("id", { count: "exact", head: true });
        if (!codeCount || codeCount === 0) {
          await admin.from("promo_codes").upsert(
            DEFAULT_PROMO_CODES.map((c) => ({
              code: c.code,
              discount_percent: c.discount_percent,
              max_discount_vnd: c.max_discount_vnd ?? null,
              max_uses: c.max_uses ?? null,
              current_uses: 0,
              expires_at: c.expires_at ?? null,
              is_active: c.is_active,
            })),
            { onConflict: "code", ignoreDuplicates: true }
          );
        }

        // 4. IELTS Tests — upsert missing slugs AND upgrade old <40-question seeded Reading/Listening rows
        const { data: existingTests } = await admin
          .from("ielts_tests")
          .select("id, slug, skill, test_data");
        const existingBySlug = new Map(
          (existingTests ?? []).map((r) => [String(r.slug), r])
        );

        for (const t of FULL_SEED_TESTS) {
          const testDataPayload = {
            questionCount: t.questionCount,
            sections: t.sections,
            writingPrompt: t.writingPrompt ?? null,
            speakingPrompts: t.speakingPrompts ?? null,
          };
          const existing = existingBySlug.get(t.slug);
          if (!existing) {
            await admin.from("ielts_tests").insert({
              slug: t.slug,
              skill: t.skill,
              module: t.module,
              title_vi: t.title_vi,
              title_en: t.title_en,
              description_vi: t.description_vi,
              description_en: t.description_en,
              duration_minutes: t.duration_minutes,
              difficulty: t.difficulty,
              audio_url: t.sections[0]?.audioUrl ?? null,
              test_data: testDataPayload,
              is_published: t.is_published,
              is_daily_eligible: Boolean(t.is_daily_eligible),
            });
          } else if (
            (t.skill === "reading" || t.skill === "listening") &&
            Number((existing.test_data as { questionCount?: number } | null)?.questionCount ?? 0) <
              t.questionCount
          ) {
            await admin
              .from("ielts_tests")
              .update({
                title_vi: t.title_vi,
                title_en: t.title_en,
                description_vi: t.description_vi,
                description_en: t.description_en,
                audio_url: t.sections[0]?.audioUrl ?? null,
                test_data: testDataPayload,
              })
              .eq("id", existing.id);
          }
        }

        // Auto-hide legacy incomplete demo test "custom-reading-demo-04" from public listing
        await admin
          .from("ielts_tests")
          .update({ is_published: false })
          .eq("slug", "custom-reading-demo-04")
          .eq("is_published", true);

        // 5. Courses
        const { count: courseCount } = await admin
          .from("courses")
          .select("id", { count: "exact", head: true });
        if (!courseCount || courseCount === 0) {
          await admin.from("courses").upsert(
            DEFAULT_COURSES.map((c, idx) => ({
              slug: c.slug,
              title_vi: c.title_vi,
              title_en: c.title_en,
              description_vi: c.description_vi,
              description_en: c.description_en,
              level: c.level,
              target_band: c.target_band,
              lessons: c.lessons,
              is_published: c.is_published,
              sort_order: idx + 1,
            })),
            { onConflict: "slug", ignoreDuplicates: true }
          );
        }

        // 6. Blog posts
        const { count: blogCount } = await admin
          .from("blog_posts")
          .select("id", { count: "exact", head: true });
        if (!blogCount || blogCount === 0) {
          await admin.from("blog_posts").upsert(
            DEFAULT_BLOG_POSTS.map((p) => ({
              slug: p.slug,
              title_vi: p.title_vi,
              title_en: p.title_en,
              excerpt_vi: p.excerpt_vi,
              excerpt_en: p.excerpt_en,
              content_vi: p.content_vi,
              content_en: p.content_en,
              category: p.category,
              author_name: p.author_name,
              read_minutes: p.read_minutes,
              is_published: p.is_published,
              published_at: p.published_at,
            })),
            { onConflict: "slug", ignoreDuplicates: true }
          );
        }

        // 7. Dictation, Pronunciation, Videos
        const { count: dictCount } = await admin
          .from("dictation_lessons")
          .select("id", { count: "exact", head: true });
        if (!dictCount || dictCount === 0) {
          await admin.from("dictation_lessons").upsert(
            DEFAULT_DICTATION_LESSONS.map((d) => ({
              slug: d.slug,
              title_vi: d.title_vi,
              title_en: d.title_en,
              category: d.category,
              difficulty: d.difficulty,
              accent: d.accent,
              sentences: d.sentences,
              is_published: true,
            })),
            { onConflict: "slug", ignoreDuplicates: true }
          );
        }

        const { count: ipaCount } = await admin
          .from("pronunciation_sounds")
          .select("id", { count: "exact", head: true });
        if (!ipaCount || ipaCount === 0) {
          await admin.from("pronunciation_sounds").upsert(
            DEFAULT_IPA_SOUNDS.map((s, idx) => ({
              slug: s.slug,
              symbol: s.symbol,
              category: s.category,
              title_vi: s.title_vi,
              title_en: s.title_en,
              tip_vi: s.vietnameseTip_vi,
              tip_en: s.tip_en,
              examples: {
                mouthPosition_vi: s.mouthPosition_vi,
                practiceSentence: s.practiceSentence,
                words: s.examples,
              },
              sort_order: idx + 1,
            })),
            { onConflict: "slug", ignoreDuplicates: true }
          );
        }

        const { count: vidCount } = await admin
          .from("learn_videos")
          .select("id", { count: "exact", head: true });
        if (!vidCount || vidCount === 0) {
          await admin.from("learn_videos").upsert(
            DEFAULT_LEARN_VIDEOS.map((v) => ({
              slug: v.slug,
              youtube_id: v.youtube_id,
              title_vi: v.title_vi,
              title_en: v.title_en,
              description_vi: v.description_vi,
              description_en: v.description_en,
              level: v.level,
              duration_label: v.duration_label,
              transcript: v.transcript,
              is_published: true,
            })),
            { onConflict: "slug", ignoreDuplicates: true }
          );
        }

        // 8. Conversation Topics & Writing Exercises (CMS GĐ4 tables)
        const { count: convCount, error: convCountErr } = await admin
          .from("conversation_topics")
          .select("id", { count: "exact", head: true });
        if (!convCountErr && (!convCount || convCount === 0)) {
          await admin.from("conversation_topics").upsert(
            DEFAULT_CONVERSATION_TOPICS.map((c, idx) =>
              conversationTopicToDbRow(c, idx + 1)
            ),
            { onConflict: "slug", ignoreDuplicates: true }
          );
        }

        const { count: weCount, error: weCountErr } = await admin
          .from("writing_exercises")
          .select("id", { count: "exact", head: true });
        if (!weCountErr && (!weCount || weCount === 0)) {
          await admin.from("writing_exercises").upsert(
            DEFAULT_WRITING_EXERCISES.map((w, idx) =>
              writingExerciseToDbRow(w, idx + 1)
            ),
            { onConflict: "slug", ignoreDuplicates: true }
          );
        }
      } catch (err) {
        console.error("[ensureSupabaseCatalogSeeded] error:", err);
        seedPromise = null;
      }
    })();
  }
  await seedPromise;
}

// =============================================================================
// ROW MAPPERS
// =============================================================================
function mapTestRow(row: Record<string, unknown>): IeltsTest {
  const td = (row.test_data as Record<string, unknown> | null) ?? {};
  const sections = Array.isArray(td.sections) ? (td.sections as IeltsTest["sections"]) : [];
  const counted = sections.reduce((sum, s) => sum + (s.questions?.length ?? 0), 0);
  return {
    id: String(row.id),
    slug: String(row.slug),
    skill: row.skill as IeltsTest["skill"],
    module: (row.module as IeltsTest["module"]) ?? "academic",
    title_vi: String(row.title_vi ?? ""),
    title_en: String(row.title_en ?? row.title_vi ?? ""),
    description_vi: String(row.description_vi ?? ""),
    description_en: String(row.description_en ?? ""),
    duration_minutes: Number(row.duration_minutes ?? 60),
    difficulty: (row.difficulty as IeltsTest["difficulty"]) ?? "band_6_7",
    questionCount: counted > 0 ? counted : Number(td.questionCount ?? 0),
    is_published: Boolean(row.is_published),
    is_daily_eligible: Boolean(row.is_daily_eligible),
    is_premium: Boolean(row.is_premium),
    seo_meta:
      row.seo_meta && typeof row.seo_meta === "object"
        ? (row.seo_meta as SeoMeta)
        : {},
    sections,
    writingPrompt: (td.writingPrompt as IeltsTest["writingPrompt"]) ?? undefined,
    speakingPrompts: (td.speakingPrompts as IeltsTest["speakingPrompts"]) ?? undefined,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

// =============================================================================
// 1. BAND CONVERSION TABLES
// =============================================================================
export async function getBandConversionTables(): Promise<BandConversionRow[]> {
  if (!isSupabaseConfigured()) {
    return readStore().band_conversion_tables;
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_BAND_CONVERSIONS;

  const { data, error } = await sb
    .from("band_conversion_tables")
    .select("id, skill, min_raw, max_raw, band_score")
    .order("skill")
    .order("band_score", { ascending: false });

  if (error || !data || data.length === 0) return DEFAULT_BAND_CONVERSIONS;
  return data.map((r) => ({
    id: String(r.id),
    skill: r.skill as BandConversionRow["skill"],
    min_raw: Number(r.min_raw),
    max_raw: Number(r.max_raw),
    band_score: Number(r.band_score),
  }));
}

export async function adminUpdateBandRow(
  id: string,
  patch: { min_raw: number; max_raw: number; band_score: number }
): Promise<void> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const row = store.band_conversion_tables.find((r) => r.id === id);
      if (row) {
        row.min_raw = patch.min_raw;
        row.max_raw = Math.max(patch.min_raw, patch.max_raw);
        row.band_score = patch.band_score;
      }
    });
    return;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("band_conversion_tables")
    .update({
      min_raw: patch.min_raw,
      max_raw: Math.max(patch.min_raw, patch.max_raw),
      band_score: patch.band_score,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

// =============================================================================
// 2. PRICING PLANS, PROMO BANNER, PROMO CODES
// =============================================================================
export async function getPricingPlans(includeInactive = false): Promise<PricingPlan[]> {
  if (!isSupabaseConfigured()) {
    const list = readStore().pricing_plans;
    return (includeInactive ? list : list.filter((p) => p.is_active)).sort(
      (a, b) => a.sort_order - b.sort_order
    );
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_PRICING_PLANS;

  let query = sb.from("pricing_plans").select("*").order("sort_order", { ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error || !data || data.length === 0) return DEFAULT_PRICING_PLANS;

  return data.map((p) => ({
    id: String(p.id),
    slug: String(p.slug),
    name_vi: String(p.name_vi),
    name_en: String(p.name_en),
    duration_months: Number(p.duration_months),
    price_vnd: Number(p.price_vnd),
    original_price_vnd: Number(p.original_price_vnd),
    is_popular: Boolean(p.is_popular),
    features_vi: Array.isArray(p.features_vi) ? (p.features_vi as string[]) : [],
    features_en: Array.isArray(p.features_en) ? (p.features_en as string[]) : [],
    is_active: Boolean(p.is_active),
    sort_order: Number(p.sort_order ?? 0),
  }));
}

export async function adminUpdatePricingPlan(
  id: string,
  patch: { price_vnd: number; original_price_vnd: number; is_popular: boolean; is_active: boolean }
): Promise<void> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const plan = store.pricing_plans.find((p) => p.id === id);
      if (plan) {
        plan.price_vnd = patch.price_vnd;
        plan.original_price_vnd = Math.max(patch.price_vnd, patch.original_price_vnd);
        plan.is_popular = patch.is_popular;
        plan.is_active = patch.is_active;
      }
    });
    return;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("pricing_plans")
    .update({
      price_vnd: patch.price_vnd,
      original_price_vnd: Math.max(patch.price_vnd, patch.original_price_vnd),
      is_popular: patch.is_popular,
      is_active: patch.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function getPromoBanner(): Promise<PromoBanner> {
  if (!isSupabaseConfigured()) {
    return readStore().promo_banner;
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_PROMO_BANNER;

  const { data } = await sb
    .from("promo_banners")
    .select("*")
    .eq("key", "main_pricing_promo")
    .maybeSingle();

  if (!data) return DEFAULT_PROMO_BANNER;
  return {
    id: String(data.id),
    key: String(data.key),
    title_vi: String(data.title_vi),
    title_en: String(data.title_en),
    badge_vi: String(data.badge_vi),
    badge_en: String(data.badge_en),
    ends_at: String(data.ends_at),
    cta_vi: String(data.cta_vi),
    cta_en: String(data.cta_en),
    is_active: Boolean(data.is_active),
  };
}

export async function adminUpdatePromoBanner(patch: {
  title_vi: string;
  title_en: string;
  ends_at: string;
  is_active: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.promo_banner.title_vi = patch.title_vi;
      store.promo_banner.title_en = patch.title_en;
      store.promo_banner.ends_at = patch.ends_at;
      store.promo_banner.is_active = patch.is_active;
    });
    return;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("promo_banners")
    .update({
      title_vi: patch.title_vi,
      title_en: patch.title_en,
      ends_at: patch.ends_at,
      is_active: patch.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("key", "main_pricing_promo");
}

export async function getPromoCodes(): Promise<PromoCode[]> {
  if (!isSupabaseConfigured()) {
    return readStore().promo_codes;
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_PROMO_CODES;

  const { data } = await sb
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (!data) return [];
  return data.map((c) => ({
    id: String(c.id),
    code: String(c.code),
    discount_percent: Number(c.discount_percent),
    max_discount_vnd: c.max_discount_vnd != null ? Number(c.max_discount_vnd) : null,
    max_uses: c.max_uses != null ? Number(c.max_uses) : null,
    current_uses: Number(c.current_uses ?? 0),
    expires_at: c.expires_at ? String(c.expires_at) : null,
    is_active: Boolean(c.is_active),
  }));
}

export async function findActivePromoCode(code: string): Promise<PromoCode | null> {
  const upper = code.trim().toUpperCase();
  if (!isSupabaseConfigured()) {
    return (
      readStore().promo_codes.find((c) => c.code.toUpperCase() === upper && c.is_active) ?? null
    );
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return null;

  const { data } = await sb
    .from("promo_codes")
    .select("*")
    .eq("code", upper)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  return {
    id: String(data.id),
    code: String(data.code),
    discount_percent: Number(data.discount_percent),
    max_discount_vnd: data.max_discount_vnd != null ? Number(data.max_discount_vnd) : null,
    max_uses: data.max_uses != null ? Number(data.max_uses) : null,
    current_uses: Number(data.current_uses ?? 0),
    expires_at: data.expires_at ? String(data.expires_at) : null,
    is_active: Boolean(data.is_active),
  };
}

export async function adminCreatePromoCode(input: {
  code: string;
  discount_percent: number;
  max_discount_vnd?: number | null;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.promo_codes.unshift({
        id: `code-${Date.now()}`,
        code: input.code.toUpperCase(),
        discount_percent: input.discount_percent,
        max_discount_vnd: input.max_discount_vnd ?? null,
        max_uses: 500,
        current_uses: 0,
        expires_at: "2027-12-31T16:59:59.000Z",
        is_active: true,
      });
    });
    return;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("promo_codes").insert({
    code: input.code.toUpperCase(),
    discount_percent: input.discount_percent,
    max_discount_vnd: input.max_discount_vnd ?? null,
    max_uses: 500,
    current_uses: 0,
    expires_at: "2027-12-31T16:59:59.000Z",
    is_active: true,
  });
}

export async function adminTogglePromoCode(id: string, is_active: boolean): Promise<void> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const c = store.promo_codes.find((item) => item.id === id);
      if (c) c.is_active = is_active;
    });
    return;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("promo_codes").update({ is_active }).eq("id", id);
}

// =============================================================================
// 3. IELTS TESTS & TEST ATTEMPTS
// =============================================================================
const HIDDEN_LEGACY_DEMO_SLUGS = new Set(["custom-reading-demo-04"]);

function isHiddenIncompleteDemoTest(test: IeltsTest): boolean {
  if (!HIDDEN_LEGACY_DEMO_SLUGS.has(test.slug)) return false;
  if (test.skill === "reading" || test.skill === "listening") {
    const actualQ = test.sections.reduce((s, sec) => s + sec.questions.length, 0);
    return actualQ < 40;
  }
  return false;
}

export async function getIeltsTests(includeUnpublished = false): Promise<IeltsTest[]> {
  if (!isSupabaseConfigured()) {
    const list = readStore().ielts_tests;
    return includeUnpublished
      ? list
      : list.filter((t) => t.is_published && !isHiddenIncompleteDemoTest(t));
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return FULL_SEED_TESTS;

  let query = sb.from("ielts_tests").select("*").order("created_at", { ascending: true });
  if (!includeUnpublished) {
    query = query.eq("is_published", true);
  }
  const { data, error } = await query;
  if (error || !data || data.length === 0) return FULL_SEED_TESTS;
  const mapped = data.map((row) => mapTestRow(row as Record<string, unknown>));
  return includeUnpublished
    ? mapped
    : mapped.filter((t) => !isHiddenIncompleteDemoTest(t));
}

export async function getIeltsTestBySlug(
  slug: string,
  includeUnpublished = false
): Promise<IeltsTest | null> {
  if (!isSupabaseConfigured()) {
    const found = readStore().ielts_tests.find((t) => t.slug === slug) ?? null;
    if (!found) return null;
    if (!includeUnpublished && (!found.is_published || isHiddenIncompleteDemoTest(found))) {
      return null;
    }
    return found;
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return FULL_SEED_TESTS.find((t) => t.slug === slug) ?? null;

  const { data } = await sb
    .from("ielts_tests")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) {
    return FULL_SEED_TESTS.find((t) => t.slug === slug) ?? null;
  }
  const mapped = mapTestRow(data as Record<string, unknown>);
  if (!includeUnpublished && (!mapped.is_published || isHiddenIncompleteDemoTest(mapped))) {
    return null;
  }
  return mapped;
}

export async function adminToggleTestPublish(id: string, is_published: boolean): Promise<void> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const t = store.ielts_tests.find((item) => item.id === id);
      if (t) t.is_published = is_published;
    });
    return;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("ielts_tests").update({ is_published }).eq("id", id);
}

export async function adminCreateTest(
  parsedTest: Partial<IeltsTest>,
  createdBy?: string
): Promise<{ is_published: boolean; questionCount: number }> {
  const sections = parsedTest.sections ?? [];
  const qCount =
    sections.flatMap((s) => s.questions).length || parsedTest.questionCount || 1;
  const isObjective =
    parsedTest.skill === "reading" || parsedTest.skill === "listening";
  // Never auto-publish Reading/Listening tests with fewer than 40 questions
  const shouldPublish = isObjective ? qCount >= 40 && parsedTest.is_published !== false : parsedTest.is_published !== false;

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.ielts_tests.unshift({
        id: `test-custom-${Date.now()}`,
        slug: parsedTest.slug!,
        skill: parsedTest.skill!,
        module: parsedTest.module ?? "academic",
        title_vi: parsedTest.title_vi!,
        title_en: parsedTest.title_en ?? parsedTest.title_vi!,
        description_vi: parsedTest.description_vi ?? "Đề luyện tập tạo từ bảng quản trị.",
        description_en: parsedTest.description_en ?? "Custom practice test created in admin.",
        duration_minutes: parsedTest.duration_minutes ?? 60,
        difficulty: parsedTest.difficulty ?? "band_6_7",
        questionCount: qCount,
        is_published: shouldPublish,
        is_daily_eligible: Boolean(parsedTest.is_daily_eligible),
        sections,
        created_at: new Date().toISOString(),
      });
    });
    return { is_published: shouldPublish, questionCount: qCount };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return { is_published: shouldPublish, questionCount: qCount };
  await admin.from("ielts_tests").insert({
    slug: parsedTest.slug!,
    skill: parsedTest.skill!,
    module: parsedTest.module ?? "academic",
    title_vi: parsedTest.title_vi!,
    title_en: parsedTest.title_en ?? parsedTest.title_vi!,
    description_vi: parsedTest.description_vi ?? "Đề luyện tập tạo từ bảng quản trị.",
    description_en: parsedTest.description_en ?? "Custom practice test created in admin.",
    duration_minutes: parsedTest.duration_minutes ?? 60,
    difficulty: parsedTest.difficulty ?? "band_6_7",
    audio_url: sections[0]?.audioUrl ?? null,
    test_data: {
      questionCount: qCount,
      sections,
      writingPrompt: parsedTest.writingPrompt ?? null,
      speakingPrompts: parsedTest.speakingPrompts ?? null,
    },
    is_published: shouldPublish,
    is_daily_eligible: Boolean(parsedTest.is_daily_eligible),
    created_by: isValidUuid(createdBy) ? createdBy : null,
  });
  return { is_published: shouldPublish, questionCount: qCount };
}

export async function saveTestAttempt(input: {
  userId: string | null;
  test: IeltsTest;
  answers: Record<string, string>;
  rawScore: number;
  maxScore: number;
  bandScore: number;
  breakdownByType: Record<string, { correct: number; total: number }>;
  details?: QuestionGradeDetail[];
  durationSeconds: number;
  vnToday: string;
}): Promise<TestAttempt | null> {
  if (!isSupabaseConfigured()) {
    const uid = input.userId ?? "demo-free-001";
    const nowIso = new Date().toISOString();
    return updateStore((draft) => {
      const record: TestAttempt = {
        id: `att-${Date.now()}`,
        user_id: uid,
        test_id: input.test.id,
        test_slug: input.test.slug,
        test_title: input.test.title_vi,
        skill: input.test.skill,
        answers: input.answers,
        raw_score: input.rawScore,
        max_score: input.maxScore,
        band_score: input.bandScore,
        breakdown_by_type: input.breakdownByType,
        duration_seconds: input.durationSeconds,
        completed_at: nowIso,
      };
      draft.test_attempts.unshift(record);
      if (Array.isArray(input.details) && input.details.length > 0) {
        if (!Array.isArray(draft.test_attempt_answers)) {
          draft.test_attempt_answers = [];
        }
        for (const d of input.details) {
          draft.test_attempt_answers.push({
            id: `ans-${record.id}-${d.number}`,
            attempt_id: record.id,
            user_id: uid,
            test_id: input.test.id,
            skill: input.test.skill,
            question_id: d.questionId,
            question_number: d.number,
            question_type: d.type,
            user_answer: d.userAnswer,
            is_correct: d.isCorrect,
            created_at: nowIso,
          });
        }
      }
      const profile = draft.profiles.find((p) => p.id === uid);
      if (profile) {
        const next = computeNextStreak(
          profile.last_active_date,
          profile.streak_count,
          input.vnToday
        );
        if (next.changed) {
          profile.streak_count = next.streakCount;
          profile.last_active_date = input.vnToday;
        }
      }
      return record;
    });
  }

  if (!isValidUuid(input.userId)) return null;
  await ensureSupabaseCatalogSeeded();
  const admin = createSupabaseAdminClient();
  const sb = admin ?? (await createSupabaseServerClient());
  if (!sb) return null;

  let testUuid = isValidUuid(input.test.id) ? input.test.id : null;
  if (!testUuid) {
    const { data: testRow } = await sb
      .from("ielts_tests")
      .select("id")
      .eq("slug", input.test.slug)
      .maybeSingle();
    testUuid = testRow?.id ? String(testRow.id) : null;
  }
  if (!testUuid) return null;

  const { data, error } = await sb
    .from("test_attempts")
    .insert({
      user_id: input.userId,
      test_id: testUuid,
      skill: input.test.skill,
      answers: input.answers,
      raw_score: input.rawScore,
      max_score: input.maxScore,
      band_score: input.bandScore,
      breakdown_by_type: input.breakdownByType,
      duration_seconds: input.durationSeconds,
    })
    .select("*")
    .single();

  if (error || !data) return null;

  // Persist normalized per-question answers with question_type (best-effort if migration 0006 not applied yet)
  if (Array.isArray(input.details) && input.details.length > 0) {
    try {
      const answerRows = input.details.map((d) => ({
        attempt_id: String(data.id),
        user_id: input.userId,
        test_id: testUuid,
        skill: input.test.skill,
        question_id: d.questionId,
        question_number: d.number,
        question_type: d.type,
        user_answer: (d.userAnswer ?? "").slice(0, 500),
        is_correct: Boolean(d.isCorrect),
      }));
      await sb.from("test_attempt_answers").insert(answerRows);
    } catch {
      // ignore if table 0006 not yet migrated
    }
  }

  await bumpUserStreak(input.userId, input.vnToday);

  return {
    id: String(data.id),
    user_id: String(data.user_id),
    test_id: String(data.test_id),
    test_slug: input.test.slug,
    test_title: input.test.title_vi,
    skill: data.skill as TestAttempt["skill"],
    answers: (data.answers as Record<string, string>) ?? {},
    raw_score: Number(data.raw_score),
    max_score: Number(data.max_score),
    band_score: Number(data.band_score),
    breakdown_by_type:
      (data.breakdown_by_type as Record<string, { correct: number; total: number }>) ?? {},
    duration_seconds: Number(data.duration_seconds),
    completed_at: String(data.completed_at),
  };
}

export async function getUserTestAttempts(userId: string | null): Promise<TestAttempt[]> {
  if (!isSupabaseConfigured()) {
    const uid = userId ?? "demo-free-001";
    return readStore().test_attempts.filter((a) => a.user_id === uid);
  }
  if (!isValidUuid(userId)) return [];
  const sb = await createSupabaseServerClient();
  if (!sb) return [];

  const { data } = await sb
    .from("test_attempts")
    .select("*, ielts_tests(slug, title_vi)")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(100);

  if (!data) return [];
  return data.map((row) => {
    const joined = row.ielts_tests as { slug?: string; title_vi?: string } | null;
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      test_id: String(row.test_id),
      test_slug: String(joined?.slug ?? ""),
      test_title: String(joined?.title_vi ?? "IELTS Test"),
      skill: row.skill as TestAttempt["skill"],
      answers: (row.answers as Record<string, string>) ?? {},
      raw_score: Number(row.raw_score),
      max_score: Number(row.max_score),
      band_score: Number(row.band_score),
      breakdown_by_type:
        (row.breakdown_by_type as Record<string, { correct: number; total: number }>) ?? {},
      duration_seconds: Number(row.duration_seconds),
      completed_at: String(row.completed_at),
    };
  });
}

// =============================================================================
// 4. DAILY EXAMS & LEADERBOARDS
// =============================================================================
export function pickDailySprintTest(tests: IeltsTest[], vnDate: string): IeltsTest {
  const eligible = tests.filter(
    (t) =>
      t.is_published &&
      t.is_daily_eligible &&
      (t.skill === "reading" || t.skill === "listening") &&
      t.sections.length > 0
  );
  const pool =
    eligible.length > 0
      ? eligible
      : tests.filter((t) => t.sections.length > 0);
  const dayNum = Number(vnDate.replace(/-/g, "")) || 1;
  const chosen = pool[dayNum % pool.length];
  // Daily Exam is a focused 15-minute sprint: use Section 1 (10–14 questions)
  const firstSection = chosen.sections[0];
  return {
    ...chosen,
    duration_minutes: 15,
    questionCount: firstSection.questions.length,
    sections: [firstSection],
  };
}

async function ensureDailyExamRow(vnDate: string, test: IeltsTest): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data: existing } = await admin
    .from("daily_exams")
    .select("id")
    .eq("exam_date", vnDate)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  let testUuid = isValidUuid(test.id) ? test.id : null;
  if (!testUuid) {
    const { data: tRow } = await admin
      .from("ielts_tests")
      .select("id")
      .eq("slug", test.slug)
      .maybeSingle();
    testUuid = tRow?.id ? String(tRow.id) : null;
  }
  if (!testUuid) return null;

  const { data: inserted } = await admin
    .from("daily_exams")
    .upsert(
      {
        exam_date: vnDate,
        test_id: testUuid,
        title_vi: test.title_vi,
        title_en: test.title_en,
        duration_seconds: 900,
      },
      { onConflict: "exam_date" }
    )
    .select("id")
    .single();

  return inserted?.id ? String(inserted.id) : null;
}

export async function getDailyExamState(vnDate: string, userId: string | null) {
  const tests = await getIeltsTests(false);
  let dailyTest = pickDailySprintTest(tests, vnDate);
  let durationSeconds = 900;
  let isExplicitlyScheduled = false;

  if (!isSupabaseConfigured()) {
    const store = readStore();
    const existingAttempt = userId
      ? store.daily_exam_attempts.find(
          (a) => a.exam_date === vnDate && a.user_id === userId
        ) ?? null
      : null;
    const leaderboard = store.daily_exam_attempts
      .filter((a) => a.exam_date === vnDate && a.is_completed)
      .sort((a, b) => b.raw_score - a.raw_score || a.duration_seconds - b.duration_seconds);
    return {
      dailyTest,
      durationSeconds,
      isExplicitlyScheduled,
      existingAttempt,
      leaderboard,
    };
  }

  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  let dailyExamId: string | null = null;

  if (sb) {
    const { data: scheduledRow } = await sb
      .from("daily_exams")
      .select("id, test_id, title_vi, title_en, duration_seconds")
      .eq("exam_date", vnDate)
      .maybeSingle();

    if (scheduledRow?.id) {
      dailyExamId = String(scheduledRow.id);
      isExplicitlyScheduled = true;
      durationSeconds = Number(scheduledRow.duration_seconds ?? 900) || 900;
      const scheduledTest = tests.find((t) => t.id === String(scheduledRow.test_id));
      if (scheduledTest && scheduledTest.sections.length > 0) {
        const firstSection = scheduledTest.sections[0];
        dailyTest = {
          ...scheduledTest,
          title_vi: String(scheduledRow.title_vi || scheduledTest.title_vi),
          title_en: String(scheduledRow.title_en || scheduledTest.title_en),
          duration_minutes: Math.max(5, Math.round(durationSeconds / 60)),
          questionCount: firstSection.questions.length,
          sections: [firstSection],
        };
      }
    }
  }

  if (!dailyExamId) {
    dailyExamId = await ensureDailyExamRow(vnDate, dailyTest);
  }

  const maxScore = dailyTest.sections.flatMap((s) => s.questions).length;

  if (!dailyExamId || !sb) {
    return {
      dailyTest,
      durationSeconds,
      isExplicitlyScheduled,
      existingAttempt: null,
      leaderboard: [] as DailyExamAttempt[],
    };
  }

  const { data: lbRows } = await sb
    .from("daily_exam_attempts")
    .select("*")
    .eq("daily_exam_id", dailyExamId)
    .eq("is_completed", true)
    .order("raw_score", { ascending: false })
    .order("duration_seconds", { ascending: true })
    .limit(50);

  const mapRow = (r: Record<string, unknown>): DailyExamAttempt => ({
    id: String(r.id),
    exam_date: vnDate,
    test_slug: dailyTest.slug,
    user_id: String(r.user_id),
    display_name: String(r.display_name ?? "Học viên"),
    started_at: String(r.started_at),
    submitted_at: r.submitted_at ? String(r.submitted_at) : null,
    answers: (r.answers as Record<string, string>) ?? {},
    raw_score: Number(r.raw_score ?? 0),
    max_score: maxScore,
    band_score: Number(r.band_score ?? 0),
    duration_seconds: Number(r.duration_seconds ?? 0),
    is_completed: Boolean(r.is_completed),
  });

  const leaderboard = (lbRows ?? []).map((r) => mapRow(r as Record<string, unknown>));

  let existingAttempt: DailyExamAttempt | null = null;
  if (isValidUuid(userId)) {
    const { data: ownRow } = await sb
      .from("daily_exam_attempts")
      .select("*")
      .eq("daily_exam_id", dailyExamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (ownRow) {
      existingAttempt = mapRow(ownRow as Record<string, unknown>);
    }
  }

  return {
    dailyTest,
    durationSeconds,
    isExplicitlyScheduled,
    existingAttempt,
    leaderboard,
  };
}

export async function startDailyExamAttempt(params: {
  vnDate: string;
  dailyTest: IeltsTest;
  userId: string;
  displayName: string;
  durationSeconds: number;
}): Promise<
  | { conflict: true }
  | { conflict: false; attempt: DailyExamAttempt; remainingSeconds: number }
> {
  const maxScore = params.dailyTest.sections.flatMap((s) => s.questions).length;

  if (!isSupabaseConfigured()) {
    const store = readStore();
    const existing = store.daily_exam_attempts.find(
      (a) => a.exam_date === params.vnDate && a.user_id === params.userId
    );
    if (existing) {
      if (existing.is_completed) return { conflict: true };
      const elapsed = Math.floor(
        (Date.now() - new Date(existing.started_at).getTime()) / 1000
      );
      return {
        conflict: false,
        attempt: existing,
        remainingSeconds: Math.max(0, params.durationSeconds - elapsed),
      };
    }

    const created = updateStore((draft) => {
      const record: DailyExamAttempt = {
        id: `daily-${params.vnDate}-${params.userId}`,
        exam_date: params.vnDate,
        test_slug: params.dailyTest.slug,
        user_id: params.userId,
        display_name: params.displayName,
        started_at: new Date().toISOString(),
        submitted_at: null,
        answers: {},
        raw_score: 0,
        max_score: maxScore,
        band_score: 0,
        duration_seconds: 0,
        is_completed: false,
      };
      draft.daily_exam_attempts.unshift(record);
      return record;
    });
    return { conflict: false, attempt: created, remainingSeconds: params.durationSeconds };
  }

  await ensureSupabaseCatalogSeeded();
  const dailyExamId = await ensureDailyExamRow(params.vnDate, params.dailyTest);
  const admin = createSupabaseAdminClient();
  if (!dailyExamId || !admin) {
    throw new Error("Daily exam storage unavailable");
  }

  const { data: existing } = await admin
    .from("daily_exam_attempts")
    .select("*")
    .eq("daily_exam_id", dailyExamId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (existing) {
    if (existing.is_completed) return { conflict: true };
    const elapsed = Math.floor(
      (Date.now() - new Date(String(existing.started_at)).getTime()) / 1000
    );
    return {
      conflict: false,
      attempt: {
        id: String(existing.id),
        exam_date: params.vnDate,
        test_slug: params.dailyTest.slug,
        user_id: String(existing.user_id),
        display_name: String(existing.display_name),
        started_at: String(existing.started_at),
        submitted_at: null,
        answers: (existing.answers as Record<string, string>) ?? {},
        raw_score: Number(existing.raw_score ?? 0),
        max_score: maxScore,
        band_score: Number(existing.band_score ?? 0),
        duration_seconds: Number(existing.duration_seconds ?? 0),
        is_completed: false,
      },
      remainingSeconds: Math.max(0, params.durationSeconds - elapsed),
    };
  }

  const { data: inserted, error } = await admin
    .from("daily_exam_attempts")
    .insert({
      daily_exam_id: dailyExamId,
      user_id: params.userId,
      display_name: params.displayName,
      started_at: new Date().toISOString(),
      answers: {},
      raw_score: 0,
      band_score: 0,
      duration_seconds: 0,
      is_completed: false,
    })
    .select("*")
    .single();

  if (error || !inserted) throw new Error(error?.message || "Cannot start daily exam");

  return {
    conflict: false,
    attempt: {
      id: String(inserted.id),
      exam_date: params.vnDate,
      test_slug: params.dailyTest.slug,
      user_id: String(inserted.user_id),
      display_name: String(inserted.display_name),
      started_at: String(inserted.started_at),
      submitted_at: null,
      answers: {},
      raw_score: 0,
      max_score: maxScore,
      band_score: 0,
      duration_seconds: 0,
      is_completed: false,
    },
    remainingSeconds: params.durationSeconds,
  };
}

export async function completeDailyExamAttempt(params: {
  vnDate: string;
  dailyTest: IeltsTest;
  userId: string;
  displayName: string;
  answers: Record<string, string>;
  rawScore: number;
  maxScore: number;
  bandScore: number;
  breakdownByType?: Record<string, { correct: number; total: number }>;
  durationSecondsLimit: number;
}): Promise<{ conflict: true } | { conflict: false; attempt: DailyExamAttempt }> {
  const now = new Date();

  if (!isSupabaseConfigured()) {
    return updateStore((draft) => {
      let attempt = draft.daily_exam_attempts.find(
        (a) => a.exam_date === params.vnDate && a.user_id === params.userId
      );
      if (attempt?.is_completed) return { conflict: true as const };

      if (!attempt) {
        attempt = {
          id: `daily-${params.vnDate}-${params.userId}`,
          exam_date: params.vnDate,
          test_slug: params.dailyTest.slug,
          user_id: params.userId,
          display_name: params.displayName,
          started_at: new Date(now.getTime() - 60_000).toISOString(),
          submitted_at: null,
          answers: {},
          raw_score: 0,
          max_score: params.maxScore,
          band_score: 0,
          breakdown_by_type: params.breakdownByType ?? {},
          duration_seconds: 60,
          is_completed: false,
        };
        draft.daily_exam_attempts.unshift(attempt);
      }

      const elapsedSec = Math.max(
        1,
        Math.min(
          params.durationSecondsLimit,
          Math.round((now.getTime() - new Date(attempt.started_at).getTime()) / 1000)
        )
      );

      attempt.answers = params.answers;
      attempt.raw_score = params.rawScore;
      attempt.max_score = params.maxScore;
      attempt.band_score = params.bandScore;
      attempt.breakdown_by_type = params.breakdownByType ?? {};
      attempt.duration_seconds = elapsedSec;
      attempt.submitted_at = now.toISOString();
      attempt.is_completed = true;

      const profile = draft.profiles.find((p) => p.id === params.userId);
      if (profile) {
        const next = computeNextStreak(
          profile.last_active_date,
          profile.streak_count,
          params.vnDate
        );
        if (next.changed) {
          profile.streak_count = next.streakCount;
          profile.last_active_date = params.vnDate;
        }
      }

      return { conflict: false as const, attempt };
    });
  }

  await ensureSupabaseCatalogSeeded();
  const dailyExamId = await ensureDailyExamRow(params.vnDate, params.dailyTest);
  const admin = createSupabaseAdminClient();
  if (!dailyExamId || !admin) throw new Error("Daily exam storage unavailable");

  const { data: existing } = await admin
    .from("daily_exam_attempts")
    .select("*")
    .eq("daily_exam_id", dailyExamId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (existing?.is_completed) {
    return { conflict: true };
  }

  const startedAtIso = existing?.started_at
    ? String(existing.started_at)
    : new Date(now.getTime() - 60_000).toISOString();

  const elapsedSec = Math.max(
    1,
    Math.min(
      params.durationSecondsLimit,
      Math.round((now.getTime() - new Date(startedAtIso).getTime()) / 1000)
    )
  );

  let savedRow: Record<string, unknown> | null = null;
  if (existing?.id) {
    const { data, error } = await admin
      .from("daily_exam_attempts")
      .update({
        answers: params.answers,
        raw_score: params.rawScore,
        band_score: params.bandScore,
        duration_seconds: elapsedSec,
        submitted_at: now.toISOString(),
        is_completed: true,
      })
      .eq("id", existing.id)
      .eq("is_completed", false)
      .select("*")
      .maybeSingle();
    if (error || !data) return { conflict: true };
    savedRow = data as Record<string, unknown>;
  } else {
    const { data, error } = await admin
      .from("daily_exam_attempts")
      .insert({
        daily_exam_id: dailyExamId,
        user_id: params.userId,
        display_name: params.displayName,
        started_at: startedAtIso,
        submitted_at: now.toISOString(),
        answers: params.answers,
        raw_score: params.rawScore,
        band_score: params.bandScore,
        duration_seconds: elapsedSec,
        is_completed: true,
      })
      .select("*")
      .single();
    if (error || !data) return { conflict: true };
    savedRow = data as Record<string, unknown>;
  }

  // Best-effort update of migration 0006 columns (max_score, breakdown_by_type)
  if (savedRow?.id) {
    try {
      await admin
        .from("daily_exam_attempts")
        .update({
          max_score: params.maxScore,
          breakdown_by_type: params.breakdownByType ?? {},
        })
        .eq("id", String(savedRow.id));
    } catch {
      // ignore if migration 0006 not applied yet
    }
  }

  await bumpUserStreak(params.userId, params.vnDate);

  return {
    conflict: false,
    attempt: {
      id: String(savedRow.id),
      exam_date: params.vnDate,
      test_slug: params.dailyTest.slug,
      user_id: String(savedRow.user_id),
      display_name: String(savedRow.display_name),
      started_at: String(savedRow.started_at),
      submitted_at: String(savedRow.submitted_at),
      answers: params.answers,
      raw_score: Number(savedRow.raw_score),
      max_score: params.maxScore,
      band_score: Number(savedRow.band_score),
      breakdown_by_type: params.breakdownByType ?? {},
      duration_seconds: Number(savedRow.duration_seconds),
      is_completed: true,
    },
  };
}

// =============================================================================
// 5. PROFILES & STREAKS
// =============================================================================
export async function bumpUserStreak(userId: string, vnToday: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const p = store.profiles.find((u) => u.id === userId);
      if (p) {
        const next = computeNextStreak(p.last_active_date, p.streak_count, vnToday);
        if (next.changed) {
          p.streak_count = next.streakCount;
          p.last_active_date = vnToday;
        }
      }
    });
    return;
  }
  if (!isValidUuid(userId)) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: profile } = await admin
    .from("profiles")
    .select("streak_count, last_active_date")
    .eq("id", userId)
    .maybeSingle();
  if (profile) {
    const next = computeNextStreak(
      profile.last_active_date ? String(profile.last_active_date) : null,
      Number(profile.streak_count ?? 0),
      vnToday
    );
    if (next.changed) {
      await admin
        .from("profiles")
        .update({
          streak_count: next.streakCount,
          last_active_date: vnToday,
        })
        .eq("id", userId);
    }
  }
}

export async function listAllProfiles(): Promise<UserProfile[]> {
  if (!isSupabaseConfigured()) {
    return readStore().profiles;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (!data) return [];
  return data.map((p) => ({
    id: String(p.id),
    email: String(p.email),
    full_name: String(p.full_name || "Học viên Ôn IELTS"),
    avatar_url: p.avatar_url ? String(p.avatar_url) : null,
    role: (p.role as UserProfile["role"]) ?? "learner",
    is_locked: Boolean(p.is_locked),
    target_band: Number(p.target_band ?? 6.5),
    current_band: p.current_band != null ? Number(p.current_band) : null,
    locale: (p.locale as UserProfile["locale"]) ?? "vi",
    premium_expires_at: p.premium_expires_at ? String(p.premium_expires_at) : null,
    referral_code: String(p.referral_code),
    referred_by: p.referred_by ? String(p.referred_by) : null,
    email_verified: Boolean(p.email_verified),
    streak_count: Number(p.streak_count ?? 0),
    last_active_date: p.last_active_date ? String(p.last_active_date) : null,
    created_at: String(p.created_at),
  }));
}

export async function updateOwnProfile(
  userId: string,
  patch: { full_name: string; target_band: number; current_band?: number | null }
): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) {
    return updateStore((store) => {
      const profile = store.profiles.find((p) => p.id === userId);
      if (!profile) return null;
      profile.full_name = patch.full_name;
      profile.target_band = patch.target_band;
      if (patch.current_band !== undefined) {
        profile.current_band = patch.current_band;
      }
      return profile;
    });
  }
  if (!isValidUuid(userId)) return null;
  const sb = await createSupabaseServerClient();
  if (!sb) return null;
  const updatePayload: Record<string, unknown> = {
    full_name: patch.full_name,
    target_band: patch.target_band,
  };
  if (patch.current_band !== undefined) {
    updatePayload.current_band = patch.current_band;
  }
  const { data } = await sb
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select("*")
    .single();
  return data ? (data as UserProfile) : null;
}

export async function adminUpdateUser(input: {
  userId: string;
  role?: "learner" | "editor" | "admin";
  isLocked?: boolean;
  grantMonths?: number;
  revokePremium?: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const u = store.profiles.find((p) => p.id === input.userId);
      if (!u) return;
      if (input.role) u.role = input.role;
      if (typeof input.isLocked === "boolean") u.is_locked = input.isLocked;
      if (input.revokePremium) {
        u.premium_expires_at = null;
      } else if (input.grantMonths && input.grantMonths > 0) {
        u.premium_expires_at = computeExtendedPremiumExpiry(
          u.premium_expires_at,
          input.grantMonths
        );
      }
    });
    return;
  }
  const admin = createSupabaseAdminClient();
  if (!admin || !isValidUuid(input.userId)) return;

  const { data: current } = await admin
    .from("profiles")
    .select("premium_expires_at")
    .eq("id", input.userId)
    .maybeSingle();

  const patch: Record<string, unknown> = {};
  if (input.role) patch.role = input.role;
  if (typeof input.isLocked === "boolean") patch.is_locked = input.isLocked;
  if (input.revokePremium) {
    patch.premium_expires_at = null;
  } else if (input.grantMonths && input.grantMonths > 0) {
    patch.premium_expires_at = computeExtendedPremiumExpiry(
      current?.premium_expires_at ? String(current.premium_expires_at) : null,
      input.grantMonths
    );
  }
  if (Object.keys(patch).length > 0) {
    await admin.from("profiles").update(patch).eq("id", input.userId);
  }
}

// =============================================================================
// 6. ORDERS & PAYMENT FULFILLMENT
// =============================================================================
export async function createOrderRecord(input: {
  userId: string;
  plan: PricingPlan;
  orderCode: number;
  provider: OrderRecord["provider"];
  amountVnd: number;
  discountVnd: number;
  promoCode: string | null;
  checkoutUrl: string;
  qrCode: string;
}): Promise<OrderRecord> {
  if (!isSupabaseConfigured()) {
    return updateStore((draft) => {
      const record: OrderRecord = {
        id: `ord-${Date.now()}`,
        user_id: input.userId,
        plan_id: input.plan.id,
        plan_slug: input.plan.slug,
        duration_months: input.plan.duration_months,
        order_code: input.orderCode,
        provider: input.provider,
        amount_vnd: input.amountVnd,
        discount_vnd: input.discountVnd,
        promo_code: input.promoCode,
        status: "pending",
        checkout_url: input.checkoutUrl,
        qr_code: input.qrCode,
        webhook_event_id: null,
        paid_at: null,
        created_at: new Date().toISOString(),
      };
      draft.orders.unshift(record);
      return record;
    });
  }

  const admin = createSupabaseAdminClient();
  const sb = admin ?? (await createSupabaseServerClient());
  if (!sb) throw new Error("Database unavailable");

  let planUuid = isValidUuid(input.plan.id) ? input.plan.id : null;
  if (!planUuid) {
    const { data: planRow } = await sb
      .from("pricing_plans")
      .select("id")
      .eq("slug", input.plan.slug)
      .maybeSingle();
    planUuid = planRow?.id ? String(planRow.id) : null;
  }

  const { data, error } = await sb
    .from("orders")
    .insert({
      user_id: input.userId,
      plan_id: planUuid,
      order_code: input.orderCode,
      provider: input.provider,
      amount_vnd: input.amountVnd,
      discount_vnd: input.discountVnd,
      promo_code: input.promoCode,
      status: "pending",
      checkout_url: input.checkoutUrl,
      qr_code: input.qrCode,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Cannot create order");
  }

  return {
    id: String(data.id),
    user_id: String(data.user_id),
    plan_id: String(data.plan_id ?? ""),
    plan_slug: input.plan.slug,
    duration_months: input.plan.duration_months,
    order_code: Number(data.order_code),
    provider: data.provider as OrderRecord["provider"],
    amount_vnd: Number(data.amount_vnd),
    discount_vnd: Number(data.discount_vnd ?? 0),
    promo_code: data.promo_code ? String(data.promo_code) : null,
    status: data.status as OrderRecord["status"],
    checkout_url: data.checkout_url ? String(data.checkout_url) : null,
    qr_code: data.qr_code ? String(data.qr_code) : null,
    webhook_event_id: data.webhook_event_id ? String(data.webhook_event_id) : null,
    paid_at: data.paid_at ? String(data.paid_at) : null,
    created_at: String(data.created_at),
  };
}

export async function listOrders(): Promise<OrderRecord[]> {
  if (!isSupabaseConfigured()) {
    return readStore().orders;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("orders")
    .select("*, pricing_plans(slug, duration_months)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!data) return [];
  return data.map((o) => {
    const plan = o.pricing_plans as { slug?: string; duration_months?: number } | null;
    return {
      id: String(o.id),
      user_id: String(o.user_id),
      plan_id: String(o.plan_id ?? ""),
      plan_slug: String(plan?.slug ?? ""),
      duration_months: Number(plan?.duration_months ?? 1),
      order_code: Number(o.order_code),
      provider: o.provider as OrderRecord["provider"],
      amount_vnd: Number(o.amount_vnd),
      discount_vnd: Number(o.discount_vnd ?? 0),
      promo_code: o.promo_code ? String(o.promo_code) : null,
      status: o.status as OrderRecord["status"],
      checkout_url: o.checkout_url ? String(o.checkout_url) : null,
      qr_code: o.qr_code ? String(o.qr_code) : null,
      webhook_event_id: o.webhook_event_id ? String(o.webhook_event_id) : null,
      paid_at: o.paid_at ? String(o.paid_at) : null,
      created_at: String(o.created_at),
    };
  });
}

export async function findOrderByCodeForUser(
  orderCode: number,
  userId: string
): Promise<OrderRecord | null> {
  if (!isSupabaseConfigured()) {
    return (
      readStore().orders.find((o) => o.order_code === orderCode && o.user_id === userId) ??
      null
    );
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("orders")
    .select("*, pricing_plans(slug, duration_months)")
    .eq("order_code", orderCode)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const plan = data.pricing_plans as { slug?: string; duration_months?: number } | null;
  return {
    id: String(data.id),
    user_id: String(data.user_id),
    plan_id: String(data.plan_id ?? ""),
    plan_slug: String(plan?.slug ?? ""),
    duration_months: Number(plan?.duration_months ?? 1),
    order_code: Number(data.order_code),
    provider: data.provider as OrderRecord["provider"],
    amount_vnd: Number(data.amount_vnd),
    discount_vnd: Number(data.discount_vnd ?? 0),
    promo_code: data.promo_code ? String(data.promo_code) : null,
    status: data.status as OrderRecord["status"],
    checkout_url: data.checkout_url ? String(data.checkout_url) : null,
    qr_code: data.qr_code ? String(data.qr_code) : null,
    webhook_event_id: data.webhook_event_id ? String(data.webhook_event_id) : null,
    paid_at: data.paid_at ? String(data.paid_at) : null,
    created_at: String(data.created_at),
  };
}

export async function fulfillPaidOrderIdempotent(params: {
  orderCode: number;
  amountVnd: number;
  eventId: string;
}): Promise<{
  ok: boolean;
  status: number;
  idempotent?: boolean;
  premiumExpiresAt?: string;
  message: string;
}> {
  if (!isSupabaseConfigured()) {
    return updateStore((store) => {
      const alreadyEvent = store.orders.find(
        (o) => o.webhook_event_id && o.webhook_event_id === params.eventId
      );
      if (alreadyEvent) {
        return {
          ok: true,
          status: 200,
          idempotent: true,
          message: "Webhook đã được xử lý trước đó (idempotent).",
        };
      }

      const order = store.orders.find((o) => o.order_code === params.orderCode);
      if (!order) {
        return { ok: false, status: 404, message: "Không tìm thấy đơn hàng." };
      }

      if (order.status === "paid") {
        return {
          ok: true,
          status: 200,
          idempotent: true,
          message: "Đơn hàng đã thanh toán trước đó (idempotent).",
        };
      }

      if (params.amountVnd > 0 && params.amountVnd < order.amount_vnd) {
        return { ok: false, status: 400, message: "Số tiền thanh toán không khớp đơn hàng." };
      }

      order.status = "paid";
      order.webhook_event_id = params.eventId;
      order.paid_at = new Date().toISOString();

      if (order.promo_code) {
        const codeObj = store.promo_codes.find(
          (c) => c.code.toUpperCase() === order.promo_code!.toUpperCase()
        );
        if (codeObj) codeObj.current_uses += 1;
      }

      const profile = store.profiles.find((p) => p.id === order.user_id);
      let newExpiry: string | undefined;
      if (profile) {
        newExpiry = computeExtendedPremiumExpiry(
          profile.premium_expires_at,
          order.duration_months
        );
        profile.premium_expires_at = newExpiry;
      }

      const ref = store.referrals.find(
        (r) => r.referred_user_id === order.user_id && r.status === "signed_up"
      );
      if (ref) {
        ref.status = "converted_premium";
        ref.converted_at = new Date().toISOString();
      }

      return {
        ok: true,
        status: 200,
        idempotent: false,
        premiumExpiresAt: newExpiry,
        message: "Đã xác nhận thanh toán và kích hoạt Premium thành công.",
      };
    });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 500, message: "Thiếu kết nối Supabase Service Role." };
  }

  // Idempotency check 1: duplicate webhook_event_id
  const { data: existingEvent } = await admin
    .from("orders")
    .select("id")
    .eq("webhook_event_id", params.eventId)
    .maybeSingle();
  if (existingEvent) {
    return {
      ok: true,
      status: 200,
      idempotent: true,
      message: "Webhook đã được xử lý trước đó (idempotent).",
    };
  }

  // Fetch order + duration
  const { data: order } = await admin
    .from("orders")
    .select("*, pricing_plans(duration_months)")
    .eq("order_code", params.orderCode)
    .maybeSingle();
  if (!order) {
    return { ok: false, status: 404, message: "Không tìm thấy đơn hàng." };
  }
  if (order.status === "paid") {
    return {
      ok: true,
      status: 200,
      idempotent: true,
      message: "Đơn hàng đã thanh toán trước đó (idempotent).",
    };
  }

  if (params.amountVnd > 0 && params.amountVnd < Number(order.amount_vnd)) {
    return { ok: false, status: 400, message: "Số tiền thanh toán không khớp đơn hàng." };
  }

  // Atomic conditional update to guard against concurrent duplicate webhooks
  const { data: updatedOrder, error: updErr } = await admin
    .from("orders")
    .update({
      status: "paid",
      webhook_event_id: params.eventId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updErr || !updatedOrder) {
    return {
      ok: true,
      status: 200,
      idempotent: true,
      message: "Đơn hàng đã được xử lý trước đó (idempotent).",
    };
  }

  if (order.promo_code) {
    const { data: codeRow } = await admin
      .from("promo_codes")
      .select("id, current_uses")
      .eq("code", String(order.promo_code).toUpperCase())
      .maybeSingle();
    if (codeRow) {
      await admin
        .from("promo_codes")
        .update({ current_uses: Number(codeRow.current_uses ?? 0) + 1 })
        .eq("id", codeRow.id);
    }
  }

  const durationMonths = Number(
    (order.pricing_plans as { duration_months?: number } | null)?.duration_months ?? 1
  );
  const { data: profile } = await admin
    .from("profiles")
    .select("premium_expires_at")
    .eq("id", order.user_id)
    .maybeSingle();

  const newExpiry = computeExtendedPremiumExpiry(
    profile?.premium_expires_at ? String(profile.premium_expires_at) : null,
    durationMonths
  );

  await admin
    .from("profiles")
    .update({ premium_expires_at: newExpiry })
    .eq("id", order.user_id);

  await admin
    .from("referrals")
    .update({
      status: "converted_premium",
      converted_at: new Date().toISOString(),
    })
    .eq("referred_user_id", order.user_id)
    .eq("status", "signed_up");

  return {
    ok: true,
    status: 200,
    idempotent: false,
    premiumExpiresAt: newExpiry,
    message: "Đã xác nhận thanh toán và kích hoạt Premium thành công.",
  };
}

// =============================================================================
// 7. AI USAGE LOGS
// =============================================================================
const guestMemoryLogs: AiUsageLog[] = [];

export async function insertAiUsageLog(entry: Omit<AiUsageLog, "id" | "created_at">): Promise<void> {
  const nowIso = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.ai_usage_logs.unshift({
        ...entry,
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: nowIso,
      });
      if (store.ai_usage_logs.length > 2000) {
        store.ai_usage_logs = store.ai_usage_logs.slice(0, 2000);
      }
    });
    return;
  }

  if (!isValidUuid(entry.user_id)) {
    // Track unauthenticated guests in memory for metering without violating UUID FK
    guestMemoryLogs.unshift({
      ...entry,
      id: `ai-guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: nowIso,
    });
    if (guestMemoryLogs.length > 1000) guestMemoryLogs.length = 1000;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("ai_usage_logs").insert({
    user_id: isValidUuid(entry.user_id) ? entry.user_id : null,
    feature: entry.feature,
    skill: entry.skill ?? null,
    model: entry.model,
    prompt_tokens: entry.prompt_tokens,
    completion_tokens: entry.completion_tokens,
    total_tokens: entry.total_tokens,
    estimated_cost_usd: entry.estimated_cost_usd,
    cached: entry.cached,
    latency_ms: entry.latency_ms,
  });
}

export async function listAiUsageLogs(limit = 100): Promise<AiUsageLog[]> {
  if (!isSupabaseConfigured()) {
    return readStore().ai_usage_logs.slice(0, limit);
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("ai_usage_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data) return [];
  return data.map((r) => ({
    id: String(r.id),
    user_id: r.user_id ? String(r.user_id) : "guest",
    feature: String(r.feature),
    skill: r.skill ? String(r.skill) : null,
    model: String(r.model),
    prompt_tokens: Number(r.prompt_tokens ?? 0),
    completion_tokens: Number(r.completion_tokens ?? 0),
    total_tokens: Number(r.total_tokens ?? 0),
    estimated_cost_usd: Number(r.estimated_cost_usd ?? 0),
    cached: Boolean(r.cached),
    latency_ms: Number(r.latency_ms ?? 0),
    created_at: String(r.created_at),
  }));
}

export async function getUserAiUsageLogsSince(
  actorId: string,
  sinceIso: string
): Promise<Pick<AiUsageLog, "feature" | "created_at">[]> {
  if (!isSupabaseConfigured()) {
    return readStore()
      .ai_usage_logs.filter((l) => l.user_id === actorId && l.created_at >= sinceIso)
      .map((l) => ({ feature: l.feature, created_at: l.created_at }));
  }

  if (!isValidUuid(actorId)) {
    return guestMemoryLogs
      .filter((l) => l.user_id === actorId && l.created_at >= sinceIso)
      .map((l) => ({ feature: l.feature, created_at: l.created_at }));
  }

  const admin = createSupabaseAdminClient();
  const sb = admin ?? (await createSupabaseServerClient());
  if (!sb) return [];

  const { data } = await sb
    .from("ai_usage_logs")
    .select("feature, created_at")
    .eq("user_id", actorId)
    .gte("created_at", sinceIso);

  return (data ?? []).map((r) => ({
    feature: String(r.feature),
    created_at: String(r.created_at),
  }));
}

// =============================================================================
// 8. WRITING & SPEAKING SUBMISSIONS (PRIVATE BY DEFAULT)
// =============================================================================
export async function saveWritingSubmission(input: {
  userId: string | null;
  taskType: "academic_t1" | "general_t1" | "task_2";
  promptText: string;
  chartImageName?: string | null;
  essayText: string;
  wordCount: number;
  evaluation: WritingEvaluation;
}): Promise<WritingSubmission> {
  const nowIso = new Date().toISOString();
  const baseRecord: WritingSubmission = {
    id: `ws-${Date.now()}`,
    user_id: input.userId ?? "guest",
    task_type: input.taskType,
    prompt_text: input.promptText,
    chart_image_name: input.chartImageName ?? null,
    essay_text: input.essayText,
    word_count: input.wordCount,
    overall_band: input.evaluation.overallBand,
    evaluation: input.evaluation,
    is_public: false,
    created_at: nowIso,
  };

  if (!isSupabaseConfigured()) {
    return updateStore((store) => {
      const rec = { ...baseRecord, user_id: input.userId ?? "demo-free-001" };
      store.writing_submissions.unshift(rec);
      return rec;
    });
  }

  if (!isValidUuid(input.userId)) {
    return baseRecord;
  }

  const sb = (await createSupabaseServerClient()) ?? createSupabaseAdminClient();
  if (!sb) return baseRecord;

  const { data, error } = await sb
    .from("writing_submissions")
    .insert({
      user_id: input.userId,
      task_type: input.taskType,
      prompt_text: input.promptText,
      chart_image_url: input.chartImageName ?? null,
      essay_text: input.essayText,
      word_count: input.wordCount,
      overall_band: input.evaluation.overallBand,
      criteria_scores: input.evaluation.criteria,
      evaluation_json: input.evaluation,
      is_public: false,
    })
    .select("*")
    .single();

  if (error || !data) return baseRecord;
  await bumpUserStreak(input.userId, getVietnamDateString());
  return {
    id: String(data.id),
    user_id: String(data.user_id),
    task_type: data.task_type as WritingSubmission["task_type"],
    prompt_text: String(data.prompt_text),
    chart_image_name: data.chart_image_url ? String(data.chart_image_url) : null,
    essay_text: String(data.essay_text),
    word_count: Number(data.word_count),
    overall_band: Number(data.overall_band),
    evaluation: data.evaluation_json as WritingEvaluation,
    is_public: Boolean(data.is_public),
    created_at: String(data.created_at),
  };
}

export async function getUserWritingSubmissions(
  userId: string | null,
  isAdmin = false
): Promise<WritingSubmission[]> {
  if (!isSupabaseConfigured()) {
    const uid = userId ?? "demo-free-001";
    return readStore().writing_submissions.filter(
      (s) => s.user_id === uid || isAdmin
    );
  }
  if (!isValidUuid(userId)) return [];
  const sb = await createSupabaseServerClient();
  if (!sb) return [];

  let query = sb
    .from("writing_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!isAdmin) {
    query = query.eq("user_id", userId);
  }
  const { data } = await query;
  if (!data) return [];

  return data.map((d) => ({
    id: String(d.id),
    user_id: String(d.user_id),
    task_type: d.task_type as WritingSubmission["task_type"],
    prompt_text: String(d.prompt_text),
    chart_image_name: d.chart_image_url ? String(d.chart_image_url) : null,
    essay_text: String(d.essay_text),
    word_count: Number(d.word_count),
    overall_band: Number(d.overall_band),
    evaluation: d.evaluation_json as WritingEvaluation,
    is_public: Boolean(d.is_public),
    created_at: String(d.created_at),
  }));
}

export async function toggleWritingSubmissionPrivacy(
  id: string,
  userId: string | null,
  isAdmin: boolean,
  isPublic: boolean
): Promise<WritingSubmission | null> {
  if (!isSupabaseConfigured()) {
    const uid = userId ?? "demo-free-001";
    return updateStore((store) => {
      const target = store.writing_submissions.find(
        (s) => s.id === id && (s.user_id === uid || isAdmin)
      );
      if (!target) return null;
      target.is_public = isPublic;
      return target;
    });
  }
  if (!isValidUuid(userId) || !isValidUuid(id)) return null;
  const sb = await createSupabaseServerClient();
  if (!sb) return null;

  let query = sb
    .from("writing_submissions")
    .update({ is_public: isPublic })
    .eq("id", id);
  if (!isAdmin) {
    query = query.eq("user_id", userId);
  }
  const { data } = await query.select("*").maybeSingle();
  if (!data) return null;
  return {
    id: String(data.id),
    user_id: String(data.user_id),
    task_type: data.task_type as WritingSubmission["task_type"],
    prompt_text: String(data.prompt_text),
    chart_image_name: data.chart_image_url ? String(data.chart_image_url) : null,
    essay_text: String(data.essay_text),
    word_count: Number(data.word_count),
    overall_band: Number(data.overall_band),
    evaluation: data.evaluation_json as WritingEvaluation,
    is_public: Boolean(data.is_public),
    created_at: String(data.created_at),
  };
}

export async function saveSpeakingSubmission(input: {
  userId: string | null;
  part: "part_1" | "part_2" | "part_3";
  promptText: string;
  durationSec: number;
  evaluation: SpeakingEvaluation;
}): Promise<SpeakingSubmission> {
  const nowIso = new Date().toISOString();
  const baseRecord: SpeakingSubmission = {
    id: `ss-${Date.now()}`,
    user_id: input.userId ?? "guest",
    part: input.part,
    prompt_text: input.promptText,
    audio_duration_sec: input.durationSec,
    transcript: input.evaluation.transcript,
    overall_band: input.evaluation.overallBand,
    evaluation: input.evaluation,
    is_public: false,
    created_at: nowIso,
  };

  if (!isSupabaseConfigured()) {
    return updateStore((store) => {
      const rec = { ...baseRecord, user_id: input.userId ?? "demo-free-001" };
      store.speaking_submissions.unshift(rec);
      return rec;
    });
  }

  if (!isValidUuid(input.userId)) return baseRecord;
  const sb = (await createSupabaseServerClient()) ?? createSupabaseAdminClient();
  if (!sb) return baseRecord;

  const { data, error } = await sb
    .from("speaking_submissions")
    .insert({
      user_id: input.userId,
      part: input.part,
      prompt_text: input.promptText,
      audio_duration_sec: Math.min(180, Math.round(input.durationSec)),
      transcript: input.evaluation.transcript,
      overall_band: input.evaluation.overallBand,
      criteria_scores: input.evaluation.criteria,
      evaluation_json: input.evaluation,
      is_public: false,
    })
    .select("*")
    .single();

  if (error || !data) return baseRecord;
  await bumpUserStreak(input.userId, getVietnamDateString());
  return {
    id: String(data.id),
    user_id: String(data.user_id),
    part: data.part as SpeakingSubmission["part"],
    prompt_text: String(data.prompt_text),
    audio_duration_sec: Number(data.audio_duration_sec),
    transcript: String(data.transcript),
    overall_band: Number(data.overall_band),
    evaluation: data.evaluation_json as SpeakingEvaluation,
    is_public: Boolean(data.is_public),
    created_at: String(data.created_at),
  };
}

export async function getUserSpeakingSubmissions(
  userId: string | null
): Promise<SpeakingSubmission[]> {
  if (!isSupabaseConfigured()) {
    const uid = userId ?? "demo-free-001";
    return readStore().speaking_submissions.filter((s) => s.user_id === uid);
  }
  if (!isValidUuid(userId)) return [];
  const sb = await createSupabaseServerClient();
  if (!sb) return [];

  const { data } = await sb
    .from("speaking_submissions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data) return [];
  return data.map((d) => ({
    id: String(d.id),
    user_id: String(d.user_id),
    part: d.part as SpeakingSubmission["part"],
    prompt_text: String(d.prompt_text),
    audio_duration_sec: Number(d.audio_duration_sec),
    transcript: String(d.transcript),
    overall_band: Number(d.overall_band),
    evaluation: d.evaluation_json as SpeakingEvaluation,
    is_public: Boolean(d.is_public),
    created_at: String(d.created_at),
  }));
}

// =============================================================================
// 9. FLASHCARDS (SM-2)
// =============================================================================
export async function getFlashcardsForUser(userId: string | null): Promise<{
  sets: FlashcardSet[];
  cards: FlashcardItem[];
}> {
  if (!isSupabaseConfigured()) {
    const store = readStore();
    const uid = userId ?? "demo-free-001";
    const sets = store.flashcard_sets.filter((s) => s.user_id === uid || s.is_public);
    const allowedSetIds = new Set(sets.map((s) => s.id));
    const cards = store.flashcards.filter(
      (c) => c.user_id === uid || allowedSetIds.has(c.set_id)
    );
    return { sets, cards };
  }

  const sb = await createSupabaseServerClient();
  if (!sb) return { sets: [], cards: [] };

  const { data: setRows } = await sb
    .from("flashcard_sets")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: cardRows } = await sb
    .from("flashcards")
    .select("*")
    .order("created_at", { ascending: false });

  const sets: FlashcardSet[] = (setRows ?? []).map((s) => ({
    id: String(s.id),
    user_id: String(s.user_id),
    title: String(s.title),
    description: String(s.description ?? ""),
    is_public: Boolean(s.is_public),
    created_at: String(s.created_at),
  }));

  const cards: FlashcardItem[] = (cardRows ?? []).map((c) => ({
    id: String(c.id),
    set_id: String(c.set_id),
    user_id: String(c.user_id),
    term: String(c.term),
    phonetic: String(c.phonetic ?? ""),
    part_of_speech: String(c.part_of_speech ?? ""),
    definition_vi: String(c.definition_vi),
    definition_en: String(c.definition_en ?? ""),
    example_sentence: String(c.example_sentence ?? ""),
    ease_factor: Number(c.ease_factor ?? 2.5),
    interval_days: Number(c.interval_days ?? 0),
    repetitions: Number(c.repetitions ?? 0),
    next_review_at: String(c.next_review_at),
    created_at: String(c.created_at),
  }));

  return { sets, cards };
}

export async function createFlashcardItem(
  userId: string | null,
  data: {
    term: string;
    phonetic: string;
    part_of_speech: string;
    definition_vi: string;
    definition_en: string;
    example_sentence: string;
    set_id?: string;
    new_set_title?: string;
  }
): Promise<{ card: FlashcardItem; setId: string } | null> {
  if (!isSupabaseConfigured()) {
    const uid = userId ?? "demo-free-001";
    return updateStore((store) => {
      let targetSetId = data.set_id;
      if (data.new_set_title && data.new_set_title.length > 0) {
        const newSet: FlashcardSet = {
          id: `set-${Date.now()}`,
          user_id: uid,
          title: data.new_set_title,
          description: "Bộ thẻ tự tạo từ công cụ lưu nhanh Ôn IELTS",
          is_public: false,
          created_at: new Date().toISOString(),
        };
        store.flashcard_sets.unshift(newSet);
        targetSetId = newSet.id;
      } else if (!targetSetId || !store.flashcard_sets.some((s) => s.id === targetSetId)) {
        const firstOwned = store.flashcard_sets.find((s) => s.user_id === uid);
        if (firstOwned) {
          targetSetId = firstOwned.id;
        } else {
          const fallbackSet: FlashcardSet = {
            id: `set-${Date.now()}`,
            user_id: uid,
            title: "Từ vựng IELTS của tôi",
            description: "Các từ mới lưu trong quá trình ôn luyện",
            is_public: false,
            created_at: new Date().toISOString(),
          };
          store.flashcard_sets.unshift(fallbackSet);
          targetSetId = fallbackSet.id;
        }
      }

      const card: FlashcardItem = {
        id: `fc-${Date.now()}`,
        set_id: targetSetId!,
        user_id: uid,
        term: data.term,
        phonetic: data.phonetic,
        part_of_speech: data.part_of_speech,
        definition_vi: data.definition_vi,
        definition_en: data.definition_en,
        example_sentence: data.example_sentence,
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      store.flashcards.unshift(card);
      return { card, setId: targetSetId! };
    });
  }

  if (!isValidUuid(userId)) return null;
  const sb = await createSupabaseServerClient();
  if (!sb) return null;

  let targetSetId = isValidUuid(data.set_id) ? data.set_id : null;

  if (data.new_set_title && data.new_set_title.length > 0) {
    const { data: createdSet } = await sb
      .from("flashcard_sets")
      .insert({
        user_id: userId,
        title: data.new_set_title,
        description: "Bộ thẻ tự tạo từ Ôn IELTS",
        is_public: false,
      })
      .select("id")
      .single();
    targetSetId = createdSet?.id ? String(createdSet.id) : null;
  }

  if (!targetSetId) {
    const { data: ownSet } = await sb
      .from("flashcard_sets")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ownSet?.id) {
      targetSetId = String(ownSet.id);
    } else {
      const { data: createdSet } = await sb
        .from("flashcard_sets")
        .insert({
          user_id: userId,
          title: "Từ vựng IELTS của tôi",
          description: "Các từ mới lưu trong quá trình ôn luyện",
          is_public: false,
        })
        .select("id")
        .single();
      targetSetId = createdSet?.id ? String(createdSet.id) : null;
    }
  }

  if (!targetSetId) return null;

  const { data: inserted, error } = await sb
    .from("flashcards")
    .insert({
      set_id: targetSetId,
      user_id: userId,
      term: data.term,
      phonetic: data.phonetic,
      part_of_speech: data.part_of_speech,
      definition_vi: data.definition_vi,
      definition_en: data.definition_en,
      example_sentence: data.example_sentence,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      next_review_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !inserted) return null;

  return {
    setId: targetSetId,
    card: {
      id: String(inserted.id),
      set_id: String(inserted.set_id),
      user_id: String(inserted.user_id),
      term: String(inserted.term),
      phonetic: String(inserted.phonetic ?? ""),
      part_of_speech: String(inserted.part_of_speech ?? ""),
      definition_vi: String(inserted.definition_vi),
      definition_en: String(inserted.definition_en ?? ""),
      example_sentence: String(inserted.example_sentence ?? ""),
      ease_factor: Number(inserted.ease_factor),
      interval_days: Number(inserted.interval_days),
      repetitions: Number(inserted.repetitions),
      next_review_at: String(inserted.next_review_at),
      created_at: String(inserted.created_at),
    },
  };
}

export async function reviewFlashcardItem(
  userId: string | null,
  cardId: string,
  quality: 1 | 3 | 4 | 5
): Promise<FlashcardItem | null> {
  if (!isSupabaseConfigured()) {
    const uid = userId ?? "demo-free-001";
    return updateStore((store) => {
      const card = store.flashcards.find(
        (c) =>
          c.id === cardId &&
          (c.user_id === uid ||
            store.flashcard_sets.some((s) => s.id === c.set_id && s.is_public))
      );
      if (!card) return null;
      const next = computeNextSm2(card, quality);
      card.ease_factor = next.ease_factor;
      card.interval_days = next.interval_days;
      card.repetitions = next.repetitions;
      card.next_review_at = next.next_review_at;
      return card;
    });
  }

  if (!isValidUuid(userId) || !isValidUuid(cardId)) return null;
  const sb = await createSupabaseServerClient();
  if (!sb) return null;

  const { data: current } = await sb
    .from("flashcards")
    .select("*")
    .eq("id", cardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!current) return null;

  const next = computeNextSm2(
    {
      ease_factor: Number(current.ease_factor ?? 2.5),
      interval_days: Number(current.interval_days ?? 0),
      repetitions: Number(current.repetitions ?? 0),
    },
    quality
  );

  const { data: updated } = await sb
    .from("flashcards")
    .update({
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      next_review_at: next.next_review_at,
    })
    .eq("id", cardId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (!updated) return null;
  await bumpUserStreak(userId, getVietnamDateString());
  return {
    id: String(updated.id),
    set_id: String(updated.set_id),
    user_id: String(updated.user_id),
    term: String(updated.term),
    phonetic: String(updated.phonetic ?? ""),
    part_of_speech: String(updated.part_of_speech ?? ""),
    definition_vi: String(updated.definition_vi),
    definition_en: String(updated.definition_en ?? ""),
    example_sentence: String(updated.example_sentence ?? ""),
    ease_factor: Number(updated.ease_factor),
    interval_days: Number(updated.interval_days),
    repetitions: Number(updated.repetitions),
    next_review_at: String(updated.next_review_at),
    created_at: String(updated.created_at),
  };
}

export async function deleteFlashcardItem(
  userId: string | null,
  isAdmin: boolean,
  cardId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const uid = userId ?? "demo-free-001";
    return updateStore((store) => {
      const before = store.flashcards.length;
      store.flashcards = store.flashcards.filter(
        (c) => !(c.id === cardId && (c.user_id === uid || isAdmin))
      );
      return store.flashcards.length < before;
    });
  }
  if (!isValidUuid(userId) || !isValidUuid(cardId)) return false;
  const sb = await createSupabaseServerClient();
  if (!sb) return false;
  let q = sb.from("flashcards").delete().eq("id", cardId);
  if (!isAdmin) q = q.eq("user_id", userId);
  const { error } = await q;
  return !error;
}

// =============================================================================
// 10. COURSES & PROGRESS
// =============================================================================
export async function getCourses(includeUnpublished = false): Promise<CourseItem[]> {
  if (!isSupabaseConfigured()) {
    const list = readStore().courses;
    return includeUnpublished ? list : list.filter((c) => c.is_published);
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_COURSES;

  let query = sb
    .from("courses")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!includeUnpublished) {
    query = query.eq("is_published", true);
  }
  const { data } = await query;
  if (!data || data.length === 0) return includeUnpublished ? [] : DEFAULT_COURSES;
  return data.map((r) => mapCourseRow(r as Record<string, unknown>));
}

export async function getCourseBySlug(
  slug: string,
  includeUnpublished = false
): Promise<CourseItem | null> {
  if (!isSupabaseConfigured()) {
    const found = readStore().courses.find((c) => c.slug === slug) ?? null;
    if (!found) return null;
    if (!includeUnpublished && !found.is_published) return null;
    return found;
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_COURSES.find((c) => c.slug === slug) ?? null;

  const { data } = await sb.from("courses").select("*").eq("slug", slug).maybeSingle();
  if (!data) {
    return includeUnpublished
      ? null
      : DEFAULT_COURSES.find((c) => c.slug === slug) ?? null;
  }
  const mapped = mapCourseRow(data as Record<string, unknown>);
  if (!includeUnpublished && !mapped.is_published) return null;
  return mapped;
}

export async function getUserCourseProgress(userId: string | null): Promise<CourseProgress[]> {
  if (!isSupabaseConfigured()) {
    const uid = userId ?? "demo-free-001";
    return readStore().course_progress.filter((p) => p.user_id === uid);
  }
  if (!isValidUuid(userId)) return [];
  const sb = await createSupabaseServerClient();
  if (!sb) return [];
  const { data } = await sb
    .from("course_progress")
    .select("*")
    .eq("user_id", userId);
  if (!data) return [];
  return data.map((p) => ({
    user_id: String(p.user_id),
    course_id: String(p.course_id),
    completed_lesson_ids: Array.isArray(p.completed_lesson_ids)
      ? (p.completed_lesson_ids as string[])
      : [],
    progress_percent: Number(p.progress_percent ?? 0),
    updated_at: String(p.updated_at),
  }));
}

export async function toggleCourseLessonProgress(params: {
  userId: string | null;
  courseId: string;
  lessonId: string;
  completed: boolean;
}): Promise<CourseProgress | null> {
  if (!isSupabaseConfigured()) {
    const uid = params.userId ?? "demo-free-001";
    return updateStore((store) => {
      const course = store.courses.find((c) => c.id === params.courseId);
      if (!course) return null;
      let prog = store.course_progress.find(
        (p) => p.user_id === uid && p.course_id === course.id
      );
      if (!prog) {
        prog = {
          user_id: uid,
          course_id: course.id,
          completed_lesson_ids: [],
          progress_percent: 0,
          updated_at: new Date().toISOString(),
        };
        store.course_progress.push(prog);
      }
      const set = new Set(prog.completed_lesson_ids);
      if (params.completed) set.add(params.lessonId);
      else set.delete(params.lessonId);
      prog.completed_lesson_ids = [...set];
      prog.progress_percent = Math.round(
        (prog.completed_lesson_ids.length / Math.max(1, course.lessons.length)) * 100
      );
      prog.updated_at = new Date().toISOString();
      return prog;
    });
  }

  if (!isValidUuid(params.userId) || !isValidUuid(params.courseId)) return null;
  const sb = await createSupabaseServerClient();
  if (!sb) return null;

  const { data: courseRow } = await sb
    .from("courses")
    .select("id, lessons")
    .eq("id", params.courseId)
    .maybeSingle();
  if (!courseRow) return null;
  const totalLessons = Array.isArray(courseRow.lessons) ? courseRow.lessons.length : 1;

  const { data: existing } = await sb
    .from("course_progress")
    .select("*")
    .eq("user_id", params.userId)
    .eq("course_id", params.courseId)
    .maybeSingle();

  const set = new Set<string>(
    Array.isArray(existing?.completed_lesson_ids)
      ? (existing.completed_lesson_ids as string[])
      : []
  );
  if (params.completed) set.add(params.lessonId);
  else set.delete(params.lessonId);
  const completedIds = [...set];
  const progressPercent = Math.round((completedIds.length / Math.max(1, totalLessons)) * 100);

  const { data: saved } = await sb
    .from("course_progress")
    .upsert(
      {
        user_id: params.userId,
        course_id: params.courseId,
        completed_lesson_ids: completedIds,
        progress_percent: progressPercent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_id" }
    )
    .select("*")
    .single();

  if (!saved) return null;
  return {
    user_id: String(saved.user_id),
    course_id: String(saved.course_id),
    completed_lesson_ids: completedIds,
    progress_percent: progressPercent,
    updated_at: String(saved.updated_at),
  };
}

// =============================================================================
// 11. LEARNING CONTENT (BLOG, DICTATION, IPA, VIDEOS, EXERCISES, TESTIMONIALS)
// =============================================================================
function mapDbBlogPost(p: Record<string, unknown>): BlogPost {
  const status =
    p.status === "draft" || p.status === "published" || p.status === "scheduled"
      ? p.status
      : p.is_published
      ? "published"
      : "draft";
  return {
    id: String(p.id),
    slug: String(p.slug),
    title_vi: String(p.title_vi),
    title_en: String(p.title_en ?? p.title_vi),
    excerpt_vi: String(p.excerpt_vi ?? ""),
    excerpt_en: String(p.excerpt_en ?? p.excerpt_vi ?? ""),
    content_vi: String(p.content_vi ?? ""),
    content_en: String(p.content_en ?? p.content_vi ?? ""),
    category: String(p.category ?? "Tips"),
    author_name: String(p.author_name ?? "Đội ngũ học thuật Ôn IELTS"),
    read_minutes: Number(p.read_minutes ?? 5),
    published_at: String(p.published_at ?? p.created_at ?? new Date().toISOString()),
    updated_at: p.updated_at
      ? String(p.updated_at)
      : String(p.published_at ?? p.created_at ?? new Date().toISOString()),
    is_published: Boolean(p.is_published),
    status,
    scheduled_at: p.scheduled_at ? String(p.scheduled_at) : null,
    is_featured: Boolean(p.is_featured),
    is_premium: Boolean(p.is_premium),
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    cover_image_url: p.cover_image_url ? String(p.cover_image_url) : null,
    seo_meta:
      p.seo_meta && typeof p.seo_meta === "object"
        ? (p.seo_meta as SeoMeta)
        : {},
  };
}

export async function getBlogPosts(includeUnpublished = false): Promise<BlogPost[]> {
  if (!isSupabaseConfigured()) {
    const list = readStore().blog_posts;
    return includeUnpublished ? list : list.filter((p) => isBlogPostPubliclyVisible(p));
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_BLOG_POSTS;

  const { data } = await sb
    .from("blog_posts")
    .select("*")
    .order("published_at", { ascending: false });
  if (!data || data.length === 0) return DEFAULT_BLOG_POSTS;

  const mapped = data.map((p) => mapDbBlogPost(p as Record<string, unknown>));
  return includeUnpublished
    ? mapped
    : mapped.filter((p) => isBlogPostPubliclyVisible(p));
}

export async function getBlogPostBySlug(
  slug: string,
  includeUnpublished = false
): Promise<BlogPost | null> {
  if (!isSupabaseConfigured()) {
    const found = readStore().blog_posts.find((p) => p.slug === slug);
    if (!found) return null;
    if (!includeUnpublished && !isBlogPostPubliclyVisible(found)) return null;
    return found;
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) {
    return DEFAULT_BLOG_POSTS.find((p) => p.slug === slug) ?? null;
  }
  const { data } = await sb
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const post = mapDbBlogPost(data as Record<string, unknown>);
  if (!includeUnpublished && !isBlogPostPubliclyVisible(post)) return null;
  return post;
}

export async function adminCreateBlogPost(input: {
  title_vi: string;
  excerpt_vi: string;
  content_vi: string;
  category: string;
  author_name: string;
}): Promise<void> {
  const slugBase = input.title_vi
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${slugBase || "bai-viet"}-${Date.now().toString().slice(-4)}`;
  const readMinutes = Math.max(2, Math.round(input.content_vi.split(/\s+/).length / 180));

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.blog_posts.unshift({
        id: `blog-${Date.now()}`,
        slug,
        title_vi: input.title_vi,
        title_en: input.title_vi,
        excerpt_vi: input.excerpt_vi,
        excerpt_en: input.excerpt_vi,
        content_vi: input.content_vi,
        content_en: input.content_vi,
        category: input.category,
        author_name: input.author_name,
        read_minutes: readMinutes,
        published_at: new Date().toISOString(),
        is_published: true,
      });
    });
    return;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("blog_posts").insert({
    slug,
    title_vi: input.title_vi,
    title_en: input.title_vi,
    excerpt_vi: input.excerpt_vi,
    excerpt_en: input.excerpt_vi,
    content_vi: input.content_vi,
    content_en: input.content_vi,
    category: input.category,
    author_name: input.author_name,
    read_minutes: readMinutes,
    is_published: true,
    published_at: new Date().toISOString(),
  });
}

export async function getDictationLessons(
  includeUnpublished = false
): Promise<DictationLesson[]> {
  if (!isSupabaseConfigured()) {
    const list = readStore().dictation_lessons;
    return includeUnpublished ? list : list.filter((d) => d.is_published !== false);
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_DICTATION_LESSONS;
  let query = sb
    .from("dictation_lessons")
    .select("*")
    .order("created_at", { ascending: true });
  if (!includeUnpublished) {
    query = query.eq("is_published", true);
  }
  const { data } = await query;
  if (!data || data.length === 0) return includeUnpublished ? [] : DEFAULT_DICTATION_LESSONS;
  return data.map((d) => mapDictationRow(d as Record<string, unknown>));
}

export async function getPronunciationSounds(
  includeUnpublished = false
): Promise<PronunciationSound[]> {
  if (!isSupabaseConfigured()) {
    const list = readStore().pronunciation_sounds;
    return includeUnpublished ? list : list.filter((s) => s.is_published !== false);
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_IPA_SOUNDS;

  let query = sb
    .from("pronunciation_sounds")
    .select("*")
    .order("sort_order", { ascending: true });
  if (!includeUnpublished) {
    query = query.eq("is_published", true);
  }
  const { data } = await query;
  if (!data || data.length === 0) return includeUnpublished ? [] : DEFAULT_IPA_SOUNDS;
  return data.map((row) => mapPronunciationRow(row as Record<string, unknown>));
}

export async function getPronunciationSoundBySlug(
  slug: string,
  includeUnpublished = false
): Promise<PronunciationSound | null> {
  if (!isSupabaseConfigured()) {
    const found = readStore().pronunciation_sounds.find((s) => s.slug === slug) ?? null;
    if (!found) return null;
    if (!includeUnpublished && found.is_published === false) return null;
    return found;
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_IPA_SOUNDS.find((s) => s.slug === slug) ?? null;

  const { data } = await sb
    .from("pronunciation_sounds")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) {
    return includeUnpublished
      ? null
      : DEFAULT_IPA_SOUNDS.find((s) => s.slug === slug) ?? null;
  }
  const mapped = mapPronunciationRow(data as Record<string, unknown>);
  if (!includeUnpublished && mapped.is_published === false) return null;
  return mapped;
}

export async function getLearnVideos(includeUnpublished = false): Promise<LearnVideo[]> {
  if (!isSupabaseConfigured()) {
    const list = readStore().learn_videos;
    return includeUnpublished ? list : list.filter((v) => v.is_published !== false);
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_LEARN_VIDEOS;
  let query = sb
    .from("learn_videos")
    .select("*")
    .order("created_at", { ascending: false });
  if (!includeUnpublished) {
    query = query.eq("is_published", true);
  }
  const { data } = await query;
  if (!data || data.length === 0) return includeUnpublished ? [] : DEFAULT_LEARN_VIDEOS;
  return data.map((v) => mapVideoRow(v as Record<string, unknown>));
}

export async function getLearnVideoBySlug(
  slug: string,
  includeUnpublished = false
): Promise<LearnVideo | null> {
  if (!isSupabaseConfigured()) {
    const found = readStore().learn_videos.find((v) => v.slug === slug) ?? null;
    if (!found) return null;
    if (!includeUnpublished && found.is_published === false) return null;
    return found;
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_LEARN_VIDEOS.find((v) => v.slug === slug) ?? null;

  const { data } = await sb
    .from("learn_videos")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) {
    return includeUnpublished
      ? null
      : DEFAULT_LEARN_VIDEOS.find((v) => v.slug === slug) ?? null;
  }
  const mapped = mapVideoRow(data as Record<string, unknown>);
  if (!includeUnpublished && mapped.is_published === false) return null;
  return mapped;
}

export async function getWritingExercises(
  includeUnpublished = false
): Promise<WritingExercise[]> {
  if (!isSupabaseConfigured()) {
    const list = readStore().writing_exercises;
    return includeUnpublished ? list : list.filter((w) => w.status !== "draft");
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_WRITING_EXERCISES;

  let query = sb
    .from("writing_exercises")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!includeUnpublished) {
    query = query.eq("status", "published");
  }
  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return includeUnpublished ? [] : DEFAULT_WRITING_EXERCISES;
  }
  return data.map((row) => mapWritingExerciseRow(row as Record<string, unknown>));
}

export async function getConversationTopics(
  includeUnpublished = false
): Promise<ConversationTopic[]> {
  if (!isSupabaseConfigured()) {
    const list = readStore().conversation_topics;
    return includeUnpublished ? list : list.filter((c) => c.status !== "draft");
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_CONVERSATION_TOPICS;

  let query = sb
    .from("conversation_topics")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!includeUnpublished) {
    query = query.eq("status", "published");
  }
  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return includeUnpublished ? [] : DEFAULT_CONVERSATION_TOPICS;
  }
  return data.map((row) => mapConversationRow(row as Record<string, unknown>));
}

export async function getConversationTopicBySlug(
  slug: string,
  includeUnpublished = false
): Promise<ConversationTopic | null> {
  if (!slug) return null;
  if (!isSupabaseConfigured()) {
    const found = readStore().conversation_topics.find((c) => c.slug === slug) ?? null;
    if (!found) return null;
    if (!includeUnpublished && found.status === "draft") return null;
    return found;
  }
  await ensureSupabaseCatalogSeeded();
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_CONVERSATION_TOPICS.find((c) => c.slug === slug) ?? null;

  const { data, error } = await sb
    .from("conversation_topics")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) {
    return includeUnpublished
      ? null
      : DEFAULT_CONVERSATION_TOPICS.find((c) => c.slug === slug) ?? null;
  }
  const mapped = mapConversationRow(data as Record<string, unknown>);
  if (!includeUnpublished && mapped.status === "draft") return null;
  return mapped;
}

export async function getSampleTestimonials(): Promise<TestimonialItem[]> {
  if (!isSupabaseConfigured()) {
    return readStore().testimonials.filter((t) => t.is_published);
  }
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_TESTIMONIALS;
  const { data } = await sb
    .from("testimonials")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (!data || data.length === 0) return DEFAULT_TESTIMONIALS;
  return data.map((t) => ({
    id: String(t.id),
    learner_name: String(t.learner_name),
    target_achieved: String(t.target_achieved),
    previous_band: Number(t.previous_band),
    new_band: Number(t.new_band),
    quote_vi: String(t.quote_vi),
    quote_en: String(t.quote_en),
    role_vi: String(t.role_vi),
    role_en: String(t.role_en),
    is_published: Boolean(t.is_published),
  }));
}

// =============================================================================
// 12. REFERRALS, FEATURE REQUESTS & CONTACT MESSAGES
// =============================================================================
export async function getUserReferrals(referrerId: string | null): Promise<ReferralRecord[]> {
  if (!isSupabaseConfigured()) {
    const uid = referrerId ?? "demo-free-001";
    return readStore().referrals.filter((r) => r.referrer_id === uid);
  }
  if (!isValidUuid(referrerId)) return [];
  const admin = createSupabaseAdminClient();
  const sb = admin ?? (await createSupabaseServerClient());
  if (!sb) return [];

  const { data } = await sb
    .from("referrals")
    .select("*, referred:profiles!referrals_referred_user_id_fkey(email)")
    .eq("referrer_id", referrerId)
    .order("created_at", { ascending: false });

  if (!data) return [];
  return data.map((r) => {
    const refProfile = r.referred as { email?: string } | null;
    return {
      id: String(r.id),
      referrer_id: String(r.referrer_id),
      referred_user_id: String(r.referred_user_id),
      referred_email: String(refProfile?.email ?? "learner@onielts.vn"),
      referral_code: String(r.referral_code),
      status: r.status as ReferralRecord["status"],
      created_at: String(r.created_at),
      converted_at: r.converted_at ? String(r.converted_at) : null,
    };
  });
}

export async function getFeatureRequests(): Promise<FeatureRequestItem[]> {
  if (!isSupabaseConfigured()) return readStore().feature_requests;
  const sb = await getReadSupabase();
  if (!sb) return DEFAULT_FEATURE_REQUESTS;
  const { data } = await sb
    .from("feature_requests")
    .select("*")
    .order("votes", { ascending: false })
    .order("created_at", { ascending: false });
  if (!data) return [];
  return data.map((i) => ({
    id: String(i.id),
    title: String(i.title),
    description: String(i.description),
    votes: Number(i.votes ?? 1),
    status: i.status as FeatureRequestItem["status"],
    created_at: String(i.created_at),
  }));
}

export async function createFeatureRequest(input: {
  userId?: string | null;
  email?: string | null;
  title: string;
  description: string;
}): Promise<FeatureRequestItem> {
  if (!isSupabaseConfigured()) {
    return updateStore((store) => {
      const created: FeatureRequestItem = {
        id: `fr-${Date.now()}`,
        title: input.title,
        description: input.description,
        votes: 1,
        status: "open",
        created_at: new Date().toISOString(),
      };
      store.feature_requests.unshift(created);
      return created;
    });
  }
  const sb = (await createSupabaseServerClient()) ?? createSupabaseAdminClient();
  if (!sb) throw new Error("Database unavailable");
  const { data, error } = await sb
    .from("feature_requests")
    .insert({
      user_id: isValidUuid(input.userId) ? input.userId : null,
      email: input.email ?? null,
      title: input.title,
      description: input.description,
      votes: 1,
      status: "open",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Cannot create feature request");
  return {
    id: String(data.id),
    title: String(data.title),
    description: String(data.description),
    votes: Number(data.votes),
    status: data.status as FeatureRequestItem["status"],
    created_at: String(data.created_at),
  };
}

export async function voteFeatureRequest(id: string): Promise<FeatureRequestItem | null> {
  if (!isSupabaseConfigured()) {
    return updateStore((store) => {
      const found = store.feature_requests.find((i) => i.id === id);
      if (!found) return null;
      found.votes += 1;
      return found;
    });
  }
  if (!isValidUuid(id)) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data: curr } = await admin
    .from("feature_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!curr) return null;
  const { data: updated } = await admin
    .from("feature_requests")
    .update({ votes: Number(curr.votes ?? 0) + 1 })
    .eq("id", id)
    .select("*")
    .single();
  if (!updated) return null;
  return {
    id: String(updated.id),
    title: String(updated.title),
    description: String(updated.description),
    votes: Number(updated.votes),
    status: updated.status as FeatureRequestItem["status"],
    created_at: String(updated.created_at),
  };
}

export async function createContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<ContactMessageItem> {
  if (!isSupabaseConfigured()) {
    return updateStore((store) => {
      const msg: ContactMessageItem = {
        id: `msg-${Date.now()}`,
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        status: "new",
        created_at: new Date().toISOString(),
      };
      store.contact_messages.unshift(msg);
      return msg;
    });
  }
  const sb = (await createSupabaseServerClient()) ?? createSupabaseAdminClient();
  if (!sb) throw new Error("Database unavailable");
  const { data, error } = await sb
    .from("contact_messages")
    .insert({
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      status: "new",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Cannot save contact message");
  return {
    id: String(data.id),
    name: String(data.name),
    email: String(data.email),
    subject: String(data.subject),
    message: String(data.message),
    status: data.status as ContactMessageItem["status"],
    created_at: String(data.created_at),
  };
}
