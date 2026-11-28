import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ArrowRight, BookOpen, Clock, Headphones, Mic, PenTool } from "lucide-react";
import { getIeltsTestSummaries } from "@/lib/db";
import { computeTestCounts } from "@/lib/platform-stats";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata() {
  const published = await getIeltsTestSummaries(false);
  const c = computeTestCounts(published);
  return buildPublicPageMetadata({
    title: `Kho ${c.publishedTestCount} đề luyện thi IELTS chuẩn máy tính (4 kỹ năng)`,
    description: `${c.publishedTestCount} bộ đề thi IELTS nguyên bản (${c.readingTestCount} Reading, ${c.listeningTestCount} Listening, ${c.writingTestCount} Writing, ${c.speakingTestCount} Speaking — tổng ${c.totalObjectiveQuestions} câu hỏi tự chấm) với giao diện chuẩn máy tính và giải thích song ngữ VI + EN.`,
    pathname: "/tests",
    type: "website",
  });
}

const SKILL_CONFIG = {
  reading: { label: "Reading", icon: BookOpen },
  listening: { label: "Listening", icon: Headphones },
  writing: { label: "Writing", icon: PenTool },
  speaking: { label: "Speaking", icon: Mic },
} as const;

export default async function TestsCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const [locale, params, published] = await Promise.all([
    getLocale(),
    searchParams,
    getIeltsTestSummaries(false),
  ]);
  const isEn = locale === "en";
  const selectedSkill = params.skill ?? "all";
  const filtered =
    selectedSkill === "all"
      ? published
      : published.filter((t) => t.skill === selectedSkill);

  const tabs = [
    { id: "all", label: isEn ? `All Skills (${published.length})` : `Tất cả (${published.length})` },
    { id: "reading", label: `Reading (${published.filter((t) => t.skill === "reading").length})` },
    { id: "listening", label: `Listening (${published.filter((t) => t.skill === "listening").length})` },
    { id: "writing", label: `Writing (${published.filter((t) => t.skill === "writing").length})` },
    { id: "speaking", label: `Speaking (${published.filter((t) => t.skill === "speaking").length})` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="ht-tests-h1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isEn ? "IELTS Practice Tests (Computer-Delivered)" : "Kho đề luyện thi IELTS chuẩn máy tính"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {isEn
              ? "100% original IELTS practice tests across Reading, Listening, Writing, and Speaking with instant grading and question-type analytics."
              : "100% đề luyện tập biên soạn nguyên bản đầy đủ 4 kỹ năng, chấm tự động theo bảng quy đổi Band và giải thích song ngữ."}
          </p>
        </div>
        <Link
          href="/daily-exam"
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
        >
          {isEn ? "Take Today's Daily Exam" : "Thi Đề mỗi ngày hôm nay"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "all" ? "/tests" : `/tests?skill=${tab.id}`}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              selectedSkill === tab.id
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tests grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((test) => {
          const cfg = SKILL_CONFIG[test.skill];
          const Icon = cfg.icon;
          return (
            <Card key={test.id} className="flex flex-col justify-between p-6 transition hover:border-emerald-300 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Badge className="inline-flex items-center gap-1">
                    <Icon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    {test.duration_minutes} {isEn ? "min" : "phút"}
                  </span>
                </div>
                <h2 className="mt-3.5 text-base font-bold text-slate-900 dark:text-white">
                  {isEn ? test.title_en : test.title_vi}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {isEn ? test.description_en : test.description_vi}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{test.module === "academic" ? "Academic" : "General"}</span>
                  <span>·</span>
                  <span>
                    {test.questionCount} {test.skill === "reading" || test.skill === "listening" ? (isEn ? "questions" : "câu") : (isEn ? "tasks" : "phần")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {(test.skill === "reading" || test.skill === "listening") && (
                    <Link
                      href={`/tests/${test.slug}?mode=part`}
                      className="text-xs font-semibold text-slate-600 hover:text-emerald-700 hover:underline dark:text-slate-400 dark:hover:text-emerald-400"
                    >
                      {isEn ? "By Part" : "Luyện từng phần"}
                    </Link>
                  )}
                  <Link
                    href={`/tests/${test.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {isEn ? "Start Test" : "Vào phòng thi"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
