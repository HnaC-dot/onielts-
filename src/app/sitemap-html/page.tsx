import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { readStore } from "@/lib/store";
import { Card } from "@/components/ui/card";

export default async function HtmlSitemapPage() {
  const locale = await getLocale();
  const isEn = locale === "en";
  const store = readStore();

  const groups = [
    {
      title: isEn ? "IELTS Practice & Exams" : "Luyện thi IELTS & Bảng xếp hạng",
      links: [
        { href: "/tests", label: isEn ? "All IELTS Practice Tests" : "Tất cả đề thi IELTS" },
        { href: "/daily-exam", label: isEn ? "Daily Exam" : "Đề thi mỗi ngày" },
        { href: "/leaderboard", label: isEn ? "Leaderboards" : "Bảng xếp hạng" },
        { href: "/band-calculator", label: isEn ? "IELTS Band Calculator" : "Tính điểm Band IELTS" },
      ],
    },
    {
      title: isEn ? "AI Writing & Speaking" : "Luyện viết & Luyện nói cùng AI",
      links: [
        { href: "/writing", label: isEn ? "AI Writing Checker" : "Chấm bài Writing AI" },
        { href: "/writing/generator", label: isEn ? "Band 9 Writing Generator" : "Tạo bài mẫu Writing Band 9" },
        { href: "/writing/exercises", label: isEn ? "Writing Improvement Exercises" : "Bài tập nâng cấp câu viết" },
        { href: "/speaking", label: isEn ? "AI Speaking Checker" : "Chấm bài Speaking AI" },
        { href: "/speaking/generator", label: isEn ? "Speaking Sample Generator" : "Tạo câu trả lời mẫu Speaking" },
        { href: "/conversations", label: isEn ? "AI Role-play Conversations" : "Hội thoại AI theo chủ đề" },
      ],
    },
    {
      title: isEn ? "AI Learning Tools" : "Bộ công cụ AI học tập",
      links: [
        { href: "/tools", label: isEn ? "All AI Tools" : "Tất cả công cụ AI" },
        { href: "/tools/paraphraser", label: "Paraphraser" },
        { href: "/tools/summarizer", label: "Summarizer" },
        { href: "/tools/translator", label: "Translator (EN ⇄ VI)" },
        { href: "/tools/grammar-checker", label: "Grammar Checker" },
        { href: "/tools/grammar-corrector", label: "Grammar Corrector" },
        { href: "/tools/text-improver", label: "Text Improver" },
        { href: "/tools/complex-sentence-explainer", label: "Complex Sentence Explainer" },
        { href: "/tools/text-to-speech", label: "Text-to-Speech" },
        { href: "/mentor", label: "Mentor Ôn IELTS AI" },
      ],
    },
    {
      title: isEn ? "Learning Hub" : "Thư viện học tập",
      links: [
        { href: "/courses", label: isEn ? "IELTS Courses" : "Khóa học IELTS" },
        { href: "/pronunciation", label: isEn ? "IPA Pronunciation" : "Phát âm bảng IPA" },
        { href: "/dictation", label: isEn ? "Dictation & Shadowing" : "Chép chính tả & Shadowing" },
        { href: "/flashcards", label: "Flashcards (Spaced Repetition)" },
        { href: "/videos", label: isEn ? "Learn Videos" : "Video học IELTS" },
        { href: "/blog", label: "Blog IELTS" },
      ],
    },
    {
      title: isEn ? "Company & Legal" : "Thông tin & Pháp lý",
      links: [
        { href: "/about", label: isEn ? "About Us" : "Giới thiệu" },
        { href: "/pricing", label: isEn ? "Pricing" : "Bảng giá Premium" },
        { href: "/referral", label: isEn ? "Referral Program" : "Mời bạn bè" },
        { href: "/feature-requests", label: isEn ? "Feature Requests" : "Đề xuất tính năng" },
        { href: "/contact", label: isEn ? "Contact" : "Liên hệ" },
        { href: "/legal/privacy", label: isEn ? "Privacy Policy" : "Chính sách bảo mật" },
        { href: "/legal/terms", label: isEn ? "Terms of Service" : "Điều khoản sử dụng" },
        { href: "/legal/disclaimers", label: isEn ? "Disclaimers" : "Miễn trừ trách nhiệm" },
        { href: "/legal/refund-policy", label: isEn ? "Refund Policy" : "Chính sách hoàn tiền" },
        { href: "/legal/faqs", label: "FAQs" },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          {isEn ? "HTML Sitemap" : "Sơ đồ trang Ôn IELTS"}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Browse every page, tool, course, and practice test on Ôn IELTS."
            : "Danh mục toàn bộ chuyên mục, công cụ AI, khóa học và đề thi trên Ôn IELTS."}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.title} className="p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{g.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {g.links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-emerald-600 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}

        <Card className="p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {isEn ? "IPA Pronunciation Pages" : "Trang từng âm IPA"}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {store.pronunciation_sounds.map((s) => (
              <Link
                key={s.slug}
                href={`/pronunciation/${s.slug}`}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700"
              >
                {s.symbol}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
