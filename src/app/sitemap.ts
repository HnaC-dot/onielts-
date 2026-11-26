import type { MetadataRoute } from "next";
import {
  getBlogPosts,
  getConversationTopics,
  getCourses,
  getDictationLessons,
  getIeltsTests,
  getLearnVideos,
  getPronunciationSounds,
  getWritingExercises,
} from "@/lib/db";
import {
  getSiteSeoSettings,
  listPublicStaticPages,
} from "@/lib/site-content";
import { getAppBaseUrl } from "@/lib/seo";
import { GENERAL_AI_TOOLS } from "@/lib/ai-tools-config";

export const dynamic = "force-dynamic";

function safeDate(raw?: string | null, fallback = new Date()): Date {
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppBaseUrl();
  const now = new Date();
  const [
    seo,
    tests,
    courses,
    sounds,
    dictations,
    videos,
    posts,
    conversations,
    writingExercises,
    staticPages,
  ] = await Promise.all([
    getSiteSeoSettings(),
    getIeltsTests(false),
    getCourses(false),
    getPronunciationSounds(false),
    getDictationLessons(false),
    getLearnVideos(false),
    getBlogPosts(false),
    getConversationTopics(false),
    getWritingExercises(false),
    listPublicStaticPages(),
  ]);

  const staticPageMap = new Map(staticPages.map((p) => [`/${p.slug}`, p]));

  // Public indexable core pages ONLY (personal pages /profile, /progress, /referral, /flashcards, /auth, /admin excluded)
  const coreRoutes = [
    "",
    "/tests",
    "/daily-exam",
    "/leaderboard",
    "/band-calculator",
    "/writing",
    "/writing/generator",
    "/writing/exercises",
    "/speaking",
    "/speaking/generator",
    "/conversations",
    "/tools",
    "/tools/text-to-speech",
    "/courses",
    "/pronunciation",
    "/dictation",
    "/videos",
    "/blog",
    "/mentor",
    "/pricing",
    "/contact",
    "/feature-requests",
    "/sitemap-html",
  ];

  const entries: MetadataRoute.Sitemap = coreRoutes.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/daily-exam" ? "daily" : "weekly",
    priority: path === "" ? 1.0 : 0.8,
  }));

  if (seo.sitemapIncludeStaticPages) {
    const defaultStaticSlugs = [
      "/about",
      "/legal/privacy",
      "/legal/terms",
      "/legal/disclaimers",
      "/legal/refund-policy",
      "/legal/faqs",
    ];
    const seen = new Set<string>();

    for (const page of staticPages) {
      const path = `/${page.slug}`;
      seen.add(path);
      if (page.seo_meta?.robotsIndex === false) continue;
      entries.push({
        url: `${baseUrl}${path}`,
        lastModified: safeDate(page.updated_at, now),
        changeFrequency: "monthly",
        priority: path === "/about" ? 0.75 : 0.6,
      });
    }

    for (const fallbackPath of defaultStaticSlugs) {
      if (seen.has(fallbackPath) || staticPageMap.has(fallbackPath)) continue;
      entries.push({
        url: `${baseUrl}${fallbackPath}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: fallbackPath === "/about" ? 0.75 : 0.6,
      });
    }
  }

  for (const t of GENERAL_AI_TOOLS) {
    entries.push({
      url: `${baseUrl}/tools/${t.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Published IELTS tests
  if (seo.sitemapIncludeTests) {
    for (const test of tests) {
      if (test.seo_meta?.robotsIndex === false) continue;
      entries.push({
        url: `${baseUrl}/tests/${test.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.85,
      });
    }
  }

  // Published courses & their individual lessons
  if (seo.sitemapIncludeCourses) {
    for (const c of courses) {
      if (c.seo_meta?.robotsIndex === false) continue;
      entries.push({
        url: `${baseUrl}/courses/${c.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
      for (const lesson of c.lessons ?? []) {
        if (!lesson.id) continue;
        entries.push({
          url: `${baseUrl}/courses/${c.slug}?lesson=${encodeURIComponent(lesson.id)}`,
          lastModified: now,
          changeFrequency: "monthly",
          priority: 0.7,
        });
      }
    }
  }

  // Published IPA pronunciation pages
  if (seo.sitemapIncludePronunciation) {
    for (const p of sounds) {
      if (p.seo_meta?.robotsIndex === false) continue;
      entries.push({
        url: `${baseUrl}/pronunciation/${p.slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.75,
      });
    }
  }

  // Published Dictation & Shadowing lessons
  for (const d of dictations) {
    entries.push({
      url: `${baseUrl}/dictation?lesson=${encodeURIComponent(d.slug)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // Published AI Conversation topics & Writing Improvement exercises
  for (const conv of conversations) {
    entries.push({
      url: `${baseUrl}/conversations?topic=${encodeURIComponent(conv.slug)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.65,
    });
  }
  for (const ex of writingExercises) {
    entries.push({
      url: `${baseUrl}/writing/exercises?slug=${encodeURIComponent(ex.slug)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.65,
    });
  }

  // Published interactive videos
  if (seo.sitemapIncludeVideos) {
    for (const v of videos) {
      if (v.seo_meta?.robotsIndex === false) continue;
      entries.push({
        url: `${baseUrl}/videos/${v.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.75,
      });
    }
  }

  // Published blog posts
  if (seo.sitemapIncludeBlog) {
    for (const post of posts) {
      if (post.seo_meta?.robotsIndex === false) continue;
      entries.push({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: safeDate(post.published_at, now),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  return entries;
}
