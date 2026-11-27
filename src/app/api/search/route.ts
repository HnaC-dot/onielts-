import { NextResponse } from "next/server";
import {
  getBlogPosts,
  getConversationTopics,
  getCourses,
  getDictationLessons,
  getIeltsTests,
  getLearnVideos,
  getPronunciationSounds,
} from "@/lib/db";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";

const STATIC_TOOLS = [
  { slug: "paraphraser", title: "Paraphraser — Diễn đạt lại học thuật", href: "/tools/paraphraser", category: "Công cụ AI" },
  { slug: "summarizer", title: "Summarizer — Tóm tắt đoạn văn IELTS", href: "/tools/summarizer", category: "Công cụ AI" },
  { slug: "translator", title: "Translator — Dịch Anh ⇄ Việt học thuật", href: "/tools/translator", category: "Công cụ AI" },
  { slug: "grammar-checker", title: "Grammar Checker — Kiểm tra lỗi ngữ pháp", href: "/tools/grammar-checker", category: "Công cụ AI" },
  { slug: "grammar-corrector", title: "Grammar Corrector — Sửa ngữ pháp tức thì", href: "/tools/grammar-corrector", category: "Công cụ AI" },
  { slug: "text-improver", title: "Text Improver — Nâng cấp bài viết lên Band 8+", href: "/tools/text-improver", category: "Công cụ AI" },
  { slug: "complex-sentence-explainer", title: "Complex Sentence Explainer — Giải thích câu phức", href: "/tools/complex-sentence-explainer", category: "Công cụ AI" },
  { slug: "text-to-speech", title: "Text-to-Speech — Đọc văn bản giọng bản xứ", href: "/tools/text-to-speech", category: "Công cụ AI" },
  { slug: "band-calculator", title: "IELTS Band Calculator — Tính điểm Band chuẩn", href: "/band-calculator", category: "Công cụ" },
];

interface SearchCatalogEntry {
  title: string;
  href: string;
  category: string;
  haystack: string;
}

const CATALOG_TTL_MS = 60_000;
let cachedCatalog: { expiresAt: number; entries: SearchCatalogEntry[] } | null = null;

async function getSearchCatalog(): Promise<SearchCatalogEntry[]> {
  const now = Date.now();
  if (cachedCatalog && cachedCatalog.expiresAt > now) {
    return cachedCatalog.entries;
  }

  const [tests, courses, sounds, conversations, dictations, videos, posts] =
    await Promise.all([
      getIeltsTests(false),
      getCourses(),
      getPronunciationSounds(),
      getConversationTopics(false),
      getDictationLessons(),
      getLearnVideos(),
      getBlogPosts(false),
    ]);

  const entries: SearchCatalogEntry[] = [];

  for (const item of STATIC_TOOLS) {
    entries.push({
      title: item.title,
      href: item.href,
      category: item.category,
      haystack: `${item.title} ${item.slug}`.toLowerCase(),
    });
  }

  for (const t of tests) {
    entries.push({
      title: t.title_vi,
      href: `/tests/${t.slug}`,
      category: `Đề thi ${t.skill.toUpperCase()}`,
      haystack: `${t.title_vi} ${t.title_en} ${t.skill} ${t.slug}`.toLowerCase(),
    });
  }

  for (const c of courses) {
    entries.push({
      title: c.title_vi,
      href: `/courses/${c.slug}`,
      category: "Khóa học",
      haystack: `${c.title_vi} ${c.title_en} ${c.slug}`.toLowerCase(),
    });
  }

  for (const p of sounds) {
    entries.push({
      title: `${p.symbol} — ${p.title_vi}`,
      href: `/pronunciation/${p.slug}`,
      category: "Phát âm IPA",
      haystack: `${p.symbol} ${p.title_vi} ${p.slug}`.toLowerCase(),
    });
  }

  for (const topic of conversations) {
    entries.push({
      title: topic.title_vi,
      href: `/conversations?topic=${topic.slug}`,
      category: "Hội thoại AI",
      haystack: `${topic.title_vi} ${topic.title_en} ${topic.slug}`.toLowerCase(),
    });
  }

  for (const d of dictations) {
    entries.push({
      title: d.title_vi,
      href: `/dictation?lesson=${d.slug}`,
      category: "Chép chính tả",
      haystack: `${d.title_vi} ${d.title_en} ${d.slug}`.toLowerCase(),
    });
  }

  for (const v of videos) {
    entries.push({
      title: v.title_vi,
      href: `/videos/${v.slug}`,
      category: "Video học IELTS",
      haystack: `${v.title_vi} ${v.title_en} ${v.slug}`.toLowerCase(),
    });
  }

  for (const post of posts) {
    entries.push({
      title: post.title_vi,
      href: `/blog/${post.slug}`,
      category: "Blog IELTS",
      haystack: `${post.title_vi} ${post.title_en} ${post.slug}`.toLowerCase(),
    });
  }

  cachedCatalog = { expiresAt: now + CATALOG_TTL_MS, entries };
  return entries;
}

export async function GET(req: Request) {
  const rate = await checkRateLimit(
    `search:${getRequestClientKey(req)}`,
    45,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Bạn tìm kiếm quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.` },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  if (!q) {
    return NextResponse.json({ results: STATIC_TOOLS.slice(0, 6) });
  }

  const catalog = await getSearchCatalog();
  const results: { title: string; href: string; category: string }[] = [];
  for (const entry of catalog) {
    if (entry.haystack.includes(q)) {
      results.push({
        title: entry.title,
        href: entry.href,
        category: entry.category,
      });
      if (results.length >= 12) break;
    }
  }

  return NextResponse.json({ results });
}
