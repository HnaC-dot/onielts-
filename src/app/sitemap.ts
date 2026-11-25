import type { MetadataRoute } from "next";
import { readStore } from "@/lib/store";
import { GENERAL_AI_TOOLS } from "@/lib/ai-tools-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://onielts.vn";
  const store = readStore();
  const now = new Date();

  const staticRoutes = [
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
    "/about",
    "/contact",
    "/feature-requests",
    "/referral",
    "/sitemap-html",
    "/legal/privacy",
    "/legal/terms",
    "/legal/disclaimers",
    "/legal/refund-policy",
    "/legal/faqs",
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/daily-exam" ? "daily" : "weekly",
    priority: path === "" ? 1.0 : 0.8,
  }));

  for (const t of GENERAL_AI_TOOLS) {
    entries.push({ url: `${baseUrl}/tools/${t.slug}`, lastModified: now, priority: 0.8 });
  }
  for (const test of store.ielts_tests.filter((i) => i.is_published)) {
    entries.push({ url: `${baseUrl}/tests/${test.slug}`, lastModified: now, priority: 0.85 });
  }
  for (const c of store.courses.filter((i) => i.is_published)) {
    entries.push({ url: `${baseUrl}/courses/${c.slug}`, lastModified: now, priority: 0.8 });
  }
  for (const p of store.pronunciation_sounds) {
    entries.push({ url: `${baseUrl}/pronunciation/${p.slug}`, lastModified: now, priority: 0.75 });
  }
  for (const v of store.learn_videos) {
    entries.push({ url: `${baseUrl}/videos/${v.slug}`, lastModified: now, priority: 0.75 });
  }
  for (const post of store.blog_posts.filter((i) => i.is_published)) {
    entries.push({ url: `${baseUrl}/blog/${post.slug}`, lastModified: now, priority: 0.8 });
  }

  return entries;
}
