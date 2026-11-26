import type { MetadataRoute } from "next";
import {
  getBlogPosts,
  getCourses,
  getIeltsTests,
  getLearnVideos,
  getPronunciationSounds,
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
  const [seo, tests, courses, sounds, videos, posts, staticPages] =
    await Promise.all([
      getSiteSeoSettings(),
      getIeltsTests(false),
      getCourses(false),
      getPronunciationSounds(false),
      getLearnVideos(false),
      getBlogPosts(false),
      listPublicStaticPages(),
    ]);

  const staticPageMap = new Map(staticPages.map((p) => [`/${p.slug}`, p]));

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
    "/flashcards",
    "/videos",
    "/blog",
    "/mentor",
    "/pricing",
    "/contact",
    "/feature-requests",
    "/referral",
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

  if (seo.sitemapIncludeCourses) {
    for (const c of courses) {
      if (c.seo_meta?.robotsIndex === false) continue;
      entries.push({
        url: `${baseUrl}/courses/${c.slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

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
