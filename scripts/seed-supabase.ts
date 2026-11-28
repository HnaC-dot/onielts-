#!/usr/bin/env tsx
/**
 * Idempotent Supabase catalog seeder for Ôn IELTS (`npm run seed`).
 *
 * - Loads `.env.local` / `.env` without overriding explicit shell env vars.
 * - Validates every test in FULL_SEED_TESTS with strict Zod schemas before writing.
 * - Upserts public catalog data idempotently (preserves existing UUIDs, never touches
 *   `profiles`, `orders`, `test_attempts`, or user submissions).
 *
 * Usage:
 *   npm run seed              # seed live Supabase (requires NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY)
 *   npm run seed -- --dry-run # validate catalog + MP3 files & print summary without DB writes
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { FULL_SEED_TESTS } from "../src/lib/seed-tests";
import { validateTestCatalog } from "../src/lib/test-schema";
import {
  DEFAULT_BAND_CONVERSIONS,
  DEFAULT_BLOG_POSTS,
  DEFAULT_CONVERSATION_TOPICS,
  DEFAULT_COURSES,
  DEFAULT_DICTATION_LESSONS,
  DEFAULT_IPA_SOUNDS,
  DEFAULT_LEARN_VIDEOS,
  DEFAULT_PRICING_PLANS,
  DEFAULT_PROMO_BANNER,
  DEFAULT_PROMO_CODES,
  DEFAULT_WRITING_EXERCISES,
} from "../src/lib/seed-data";
import {
  conversationTopicToDbRow,
  writingExerciseToDbRow,
} from "../src/lib/learning-mappers";

function loadEnvFile(filename: string): void {
  const full = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(full)) return;
  const lines = fs.readFileSync(full, "utf-8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  loadEnvFile(".env.local");
  loadEnvFile(".env");

  // 1. Validate entire test catalog via strict Zod schema BEFORE touching DB
  const validation = validateTestCatalog(FULL_SEED_TESTS);
  if (!validation.valid) {
    console.error("[seed] Catalog validation failed:");
    for (const err of validation.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  // 2. Verify all Listening MP3 audio files exist on disk
  const missingAudio: string[] = [];
  for (const test of FULL_SEED_TESTS) {
    if (test.skill !== "listening") continue;
    for (const sec of test.sections) {
      if (!sec.audioUrl) {
        missingAudio.push(`${test.slug}:${sec.id} (missing audioUrl)`);
        continue;
      }
      const absPath = path.join(process.cwd(), "public", sec.audioUrl);
      if (!fs.existsSync(absPath) || fs.statSync(absPath).size < 50_000) {
        missingAudio.push(sec.audioUrl);
      }
    }
  }
  if (missingAudio.length > 0) {
    console.error(
      "[seed] Missing or incomplete Listening MP3 audio files. Run `python3 scripts/generate-listening-audio.py` first:"
    );
    for (const item of missingAudio) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }

  const skillCounts = { reading: 0, listening: 0, writing: 0, speaking: 0 };
  for (const t of FULL_SEED_TESTS) {
    skillCounts[t.skill] += 1;
  }

  console.log("[seed] Catalog Zod validation passed:", {
    totalTests: FULL_SEED_TESTS.length,
    ...skillCounts,
    courses: DEFAULT_COURSES.length,
    blogPosts: DEFAULT_BLOG_POSTS.length,
    dictationLessons: DEFAULT_DICTATION_LESSONS.length,
    pronunciationSounds: DEFAULT_IPA_SOUNDS.length,
    learnVideos: DEFAULT_LEARN_VIDEOS.length,
  });

  if (dryRun) {
    console.log("[seed] --dry-run complete (no database writes performed).");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "[seed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local or your shell environment."
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Band conversion tables (seed only if table is empty to preserve admin customizations)
  const { count: bandCount, error: bandCountErr } = await admin
    .from("band_conversion_tables")
    .select("id", { count: "exact", head: true });
  if (bandCountErr) throw new Error(`band_conversion_tables count failed: ${bandCountErr.message}`);
  if (!bandCount || bandCount === 0) {
    const { error } = await admin.from("band_conversion_tables").insert(
      DEFAULT_BAND_CONVERSIONS.map((r) => ({
        skill: r.skill,
        min_raw: r.min_raw,
        max_raw: r.max_raw,
        band_score: r.band_score,
      }))
    );
    if (error) throw new Error(`band_conversion_tables insert failed: ${error.message}`);
    console.log(`[seed] Inserted ${DEFAULT_BAND_CONVERSIONS.length} band conversion rows.`);
  }

  // Pricing plans (idempotent by slug, preserves admin price edits)
  const { error: planErr } = await admin.from("pricing_plans").upsert(
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
  if (planErr) throw new Error(`pricing_plans upsert failed: ${planErr.message}`);

  // Promo banner (idempotent by key)
  const { error: bannerErr } = await admin.from("promo_banners").upsert(
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
    { onConflict: "key", ignoreDuplicates: true }
  );
  if (bannerErr) throw new Error(`promo_banners upsert failed: ${bannerErr.message}`);

  // Promo codes (idempotent by code)
  const { error: promoErr } = await admin.from("promo_codes").upsert(
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
  if (promoErr) throw new Error(`promo_codes upsert failed: ${promoErr.message}`);

  // IELTS Tests (insert-only by slug via ignoreDuplicates: true; NEVER overwrites tests edited in Admin CMS)
  const testRows = FULL_SEED_TESTS.map((t) => ({
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
    test_data: {
      questionCount: t.questionCount,
      sections: t.sections,
      writingPrompt: t.writingPrompt ?? null,
      speakingPrompts: t.speakingPrompts ?? null,
    },
    is_published: t.is_published,
    is_daily_eligible: Boolean(t.is_daily_eligible),
  }));

  const { error: testsErr } = await admin
    .from("ielts_tests")
    .upsert(testRows, { onConflict: "slug", ignoreDuplicates: true });
  if (testsErr) throw new Error(`ielts_tests upsert failed: ${testsErr.message}`);
  console.log(
    `[seed] Seeded missing IELTS tests by slug (${testRows.length} catalog entries checked; existing admin-edited rows preserved).`
  );

  // Courses, Blog posts, Dictation, IPA Pronunciation, Learn Videos (idempotent by slug)
  const { error: coursesErr } = await admin.from("courses").upsert(
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
  if (coursesErr) throw new Error(`courses upsert failed: ${coursesErr.message}`);

  const { error: blogErr } = await admin.from("blog_posts").upsert(
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
  if (blogErr) throw new Error(`blog_posts upsert failed: ${blogErr.message}`);

  const { error: dictErr } = await admin.from("dictation_lessons").upsert(
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
  if (dictErr) throw new Error(`dictation_lessons upsert failed: ${dictErr.message}`);

  const { error: ipaErr } = await admin.from("pronunciation_sounds").upsert(
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
  if (ipaErr) throw new Error(`pronunciation_sounds upsert failed: ${ipaErr.message}`);

  const { error: vidErr } = await admin.from("learn_videos").upsert(
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
  if (vidErr) throw new Error(`learn_videos upsert failed: ${vidErr.message}`);

  // Conversation topics & Writing improvement exercises (migrated to DB in GĐ4)
  const { error: convErr } = await admin.from("conversation_topics").upsert(
    DEFAULT_CONVERSATION_TOPICS.map((c, idx) => conversationTopicToDbRow(c, idx + 1)),
    { onConflict: "slug", ignoreDuplicates: true }
  );
  if (convErr) {
    console.warn("[seed] conversation_topics skipped (ensure 0005 migration is applied):", convErr.message);
  }

  const { error: weErr } = await admin.from("writing_exercises").upsert(
    DEFAULT_WRITING_EXERCISES.map((w, idx) => writingExerciseToDbRow(w, idx + 1)),
    { onConflict: "slug", ignoreDuplicates: true }
  );
  if (weErr) {
    console.warn("[seed] writing_exercises skipped (ensure 0005 migration is applied):", weErr.message);
  }

  console.log("[seed] Supabase catalog seeding completed successfully!");
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
