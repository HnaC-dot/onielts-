import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { CheckCircle2, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { getStaticPageBySlug } from "@/lib/site-content";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { renderBlogContentToSafeHtml } from "@/lib/sanitize";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  const page = await getStaticPageBySlug("about", false);
  return buildPublicPageMetadata({
    title: page?.title_vi || "Giới thiệu về Ôn IELTS",
    description:
      page?.seo_meta?.metaDescription ||
      "Ôn IELTS — Nền tảng tự học và luyện thi IELTS toàn diện tích hợp AI cho người học Việt Nam.",
    pathname: "/about",
    seoMeta: page?.seo_meta,
    type: "website",
  });
}

export default async function AboutPage() {
  const [locale, cmsPage] = await Promise.all([
    getLocale(),
    getStaticPageBySlug("about", false),
  ]);
  const isEn = locale === "en";

  const title = cmsPage
    ? isEn
      ? cmsPage.title_en || cmsPage.title_vi
      : cmsPage.title_vi
    : isEn
    ? "About Ôn IELTS"
    : "Giới thiệu về Ôn IELTS";

  const rawBody = cmsPage
    ? isEn
      ? cmsPage.body_en || cmsPage.body_vi
      : cmsPage.body_vi
    : "";
  const safeHtml = rawBody ? renderBlogContentToSafeHtml(rawBody) : "";

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", pathname: "/" },
    { name: title, pathname: "/about" },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {title}
        </h1>
        {safeHtml ? (
          <div
            className="prose prose-slate max-w-none text-base leading-relaxed text-slate-600 dark:prose-invert dark:text-slate-300"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {isEn
              ? "Ôn IELTS was created to make high-quality, structured IELTS preparation accessible to every Vietnamese learner — combining 100% original exam-style practice with instant, practical AI coaching."
              : "Ôn IELTS ra đời với sứ mệnh giúp mọi học sinh, sinh viên và người đi làm Việt Nam tiếp cận lộ trình ôn thi IELTS bài bản, chi phí hợp lý và nhận phản hồi AI chi tiết ngay lập tức."}
          </p>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="p-6 space-y-3">
          <Sparkles className="h-7 w-7 text-emerald-600" />
          <h2 className="text-lg font-bold">
            {isEn ? "100% Original Content" : "100% Nội dung nguyên bản"}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isEn
              ? "Every passage, audio script, cue card, and course lesson is authored cleanly from scratch without copying copyrighted exam papers."
              : "Toàn bộ đề thi, kịch bản nghe, bài tập viết và khóa học được biên soạn nguyên bản, phù hợp đặc thù lỗi sai của người học Việt Nam."}
          </p>
        </Card>
        <Card className="p-6 space-y-3">
          <ShieldCheck className="h-7 w-7 text-emerald-600" />
          <h2 className="text-lg font-bold">
            {isEn ? "Private & Transparent" : "Riêng tư & Minh bạch"}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isEn
              ? "Your essays stay private by default, AI pronunciation scores are clearly labeled as reference estimates, and pricing has zero hidden auto-renewals."
              : "Bài viết của bạn luôn riêng tư mặc định, điểm AI minh bạch là điểm tham khảo, gói Premium trả 1 lần qua VietQR không tự động gia hạn."}
          </p>
        </Card>
        <Card className="p-6 space-y-3">
          <HeartHandshake className="h-7 w-7 text-emerald-600" />
          <h2 className="text-lg font-bold">
            {isEn ? "Built for Daily Consistency" : "Thiết kế cho sự bền bỉ mỗi ngày"}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isEn
              ? "Daily Exams, Streak Leaderboards, and highlight-to-save Flashcards turn small daily habits into real band score gains."
              : "Đề thi mỗi ngày, bảng xếp hạng chuỗi ngày học (streak) và lưu Flashcard tức thì giúp duy trì thói quen 20–30 phút mỗi ngày."}
          </p>
        </Card>
      </div>

      <Card className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {isEn ? "Ready to check your current band?" : "Sẵn sàng kiểm tra trình độ hiện tại?"}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isEn
              ? "Start with a free computer-delivered practice test or compute your target score."
              : "Bắt đầu ngay với đề thi thử miễn phí chuẩn máy tính hoặc công cụ tính điểm Band."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/tests"><Button>{isEn ? "Practice Tests" : "Làm đề thi"}</Button></Link>
          <Link href="/pricing"><Button variant="outline">{isEn ? "View Pricing" : "Xem bảng giá"}</Button></Link>
        </div>
      </Card>
    </div>
  );
}
