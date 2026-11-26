import { NextResponse } from "next/server";
import {
  getBlogPosts,
  getCourses,
  getDictationLessons,
  getIeltsTests,
  getLearnVideos,
  getPronunciationSounds,
} from "@/lib/db";
import { DEFAULT_CONVERSATION_TOPICS } from "@/lib/seed-data";

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  if (!q) {
    return NextResponse.json({ results: STATIC_TOOLS.slice(0, 6) });
  }

  const [tests, courses, sounds, dictations, videos, posts] = await Promise.all([
    getIeltsTests(false),
    getCourses(),
    getPronunciationSounds(),
    getDictationLessons(),
    getLearnVideos(),
    getBlogPosts(false),
  ]);

  const results: { title: string; href: string; category: string; subtitle?: string }[] = [];

  for (const item of STATIC_TOOLS) {
    if (item.title.toLowerCase().includes(q) || item.slug.includes(q)) {
      results.push({ title: item.title, href: item.href, category: item.category });
    }
  }

  for (const t of tests) {
    if (
      t.title_vi.toLowerCase().includes(q) ||
      t.title_en.toLowerCase().includes(q) ||
      t.skill.includes(q)
    ) {
      results.push({
        title: t.title_vi,
        href: `/tests/${t.slug}`,
        category: `Đề thi ${t.skill.toUpperCase()}`,
      });
    }
  }

  for (const c of courses) {
    if (c.title_vi.toLowerCase().includes(q) || c.title_en.toLowerCase().includes(q)) {
      results.push({ title: c.title_vi, href: `/courses/${c.slug}`, category: "Khóa học" });
    }
  }

  for (const p of sounds) {
    if (
      p.symbol.toLowerCase().includes(q) ||
      p.title_vi.toLowerCase().includes(q) ||
      p.slug.includes(q)
    ) {
      results.push({
        title: `${p.symbol} — ${p.title_vi}`,
        href: `/pronunciation/${p.slug}`,
        category: "Phát âm IPA",
      });
    }
  }

  for (const topic of DEFAULT_CONVERSATION_TOPICS) {
    if (topic.title_vi.toLowerCase().includes(q) || topic.title_en.toLowerCase().includes(q)) {
      results.push({
        title: topic.title_vi,
        href: `/conversations?topic=${topic.slug}`,
        category: "Hội thoại AI",
      });
    }
  }

  for (const d of dictations) {
    if (d.title_vi.toLowerCase().includes(q) || d.title_en.toLowerCase().includes(q)) {
      results.push({
        title: d.title_vi,
        href: `/dictation?lesson=${d.slug}`,
        category: "Chép chính tả",
      });
    }
  }

  for (const v of videos) {
    if (v.title_vi.toLowerCase().includes(q) || v.title_en.toLowerCase().includes(q)) {
      results.push({
        title: v.title_vi,
        href: `/videos/${v.slug}`,
        category: "Video học IELTS",
      });
    }
  }

  for (const post of posts) {
    if (post.title_vi.toLowerCase().includes(q) || post.title_en.toLowerCase().includes(q)) {
      results.push({
        title: post.title_vi,
        href: `/blog/${post.slug}`,
        category: "Blog IELTS",
      });
    }
  }

  return NextResponse.json({ results: results.slice(0, 12) });
}
