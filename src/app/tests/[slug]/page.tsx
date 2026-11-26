import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { ArrowRight, Eye, Mic, PenTool } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin-auth";
import { getIeltsTestBySlug } from "@/lib/db";
import { sanitizeTestForClient } from "@/lib/test-grader";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { TestEngineClient } from "@/components/test-engine-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const test = await getIeltsTestBySlug(slug, false);
  if (!test) return {};
  const actualQ =
    test.skill === "reading" || test.skill === "listening"
      ? test.sections.reduce((sum, s) => sum + s.questions.length, 0) || test.questionCount
      : test.questionCount;
  return buildPublicPageMetadata({
    title: test.title_vi,
    description:
      test.description_vi ||
      `Luyện đề thi IELTS ${test.skill.toUpperCase()} (${test.module === "academic" ? "Academic" : "General"}) ${actualQ} câu, ${test.duration_minutes} phút tự chấm điểm trên Ôn IELTS.`,
    pathname: `/tests/${test.slug}`,
    seoMeta: test.seo_meta,
    type: "website",
  });
}

export default async function TestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ slug }, query, locale] = await Promise.all([
    params,
    searchParams,
    getLocale(),
  ]);
  const isEn = locale === "en";

  let allowPreview = false;
  if (query.preview === "1") {
    const authState = await getAuthState();
    if (
      authState.user &&
      isStaffRole(authState.user.role) &&
      !authState.user.is_locked
    ) {
      allowPreview = true;
    }
  }

  const test = await getIeltsTestBySlug(slug, allowPreview);
  if (!test) notFound();

  const isDraftPreview = allowPreview && !test.is_published;
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", pathname: "/" },
    { name: "Kho đề thi IELTS", pathname: "/tests" },
    { name: test.title_vi, pathname: `/tests/${test.slug}` },
  ]);

  if (test.skill === "reading" || test.skill === "listening") {
    // Strip answer keys & explanations before sending to the browser
    const safeTest = sanitizeTestForClient(test);
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        {isDraftPreview && (
          <div className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                Chế độ Xem trước đề Nháp — Học viên chưa thấy đề này.
              </span>
              <Link href={`/admin/tests/${test.id}`} className="underline">
                Quay lại trình tạo đề
              </Link>
            </div>
          </div>
        )}
        <TestEngineClient test={safeTest} />
      </>
    );
  }

  // Writing or Speaking structured test prompt view linking directly to AI Scorers
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {isDraftPreview && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            Chế độ Xem trước đề Nháp — Học viên chưa thấy đề này.
          </span>
          <Link href={`/admin/tests/${test.id}`} className="underline">
            Quay lại trình tạo đề
          </Link>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Badge>{test.skill.toUpperCase()}</Badge>
        <Badge variant="secondary">{test.module === "academic" ? "Academic" : "General"}</Badge>
      </div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
        {isEn ? test.title_en : test.title_vi}
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {isEn ? test.description_en : test.description_vi}
      </p>

      {test.writingPrompt && (
        <Card className="p-6 space-y-4">
          <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
            Official Practice Prompt ({test.writingPrompt.minWords}+ words)
          </p>
          <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            {test.writingPrompt.prompt}
          </p>
          <Link href="/writing">
            <Button size="lg">
              <PenTool className="h-4 w-4" />
              {isEn ? "Open in AI Writing Checker" : "Mở trong phòng chấm Writing AI"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      )}

      {test.speakingPrompts && (
        <div className="space-y-4">
          <Card className="p-6 space-y-2">
            <h2 className="text-base font-bold">Part 1 — Introduction &amp; Interview</h2>
            <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
              {test.speakingPrompts.part1.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </Card>
          <Card className="p-6 space-y-2 border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/30">
            <h2 className="text-base font-bold">Part 2 — Cue Card</h2>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {test.speakingPrompts.part2.topic}
            </p>
            <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
              {test.speakingPrompts.part2.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </Card>
          <Card className="p-6 space-y-2">
            <h2 className="text-base font-bold">Part 3 — Follow-up Discussion</h2>
            <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
              {test.speakingPrompts.part3.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </Card>
          <Link href="/speaking">
            <Button size="lg">
              <Mic className="h-4 w-4" />
              {isEn ? "Record & Score in AI Speaking Checker" : "Ghi âm & Chấm điểm Speaking AI"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
