import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { BookOpen, Flame, Layers, PenTool, Target } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  getCourses,
  getFlashcardsForUser,
  getUserCourseProgress,
  getUserSpeakingSubmissions,
  getUserTestAttempts,
  getUserWritingSubmissions,
} from "@/lib/db";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Bảng điều khiển Tiến độ & Phân tích lỗi sai IELTS",
    description:
      "Theo dõi biểu đồ tiến độ luyện đề, phân tích dạng câu hay sai, chuỗi streak, số thẻ Flashcard và lịch sử chấm bài AI cá nhân.",
    pathname: "/progress",
    type: "website",
    noindex: true,
  });
}

export default async function ProgressPage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const isEn = locale === "en";

  if (!user && isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Card className="p-8 space-y-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isEn
              ? "Sign in to track your IELTS progress"
              : "Đăng nhập để lưu và theo dõi tiến độ học tập"}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isEn
              ? "Your completed tests, mistake analytics, flashcards, and streaks sync automatically across devices."
              : "Kết quả bài thi, phân tích dạng câu hay sai, thẻ Flashcard và chuỗi ngày học được đồng bộ trực tiếp vào tài khoản của bạn."}
          </p>
          <Link href="/auth">
            <Button>{isEn ? "Sign in" : "Đăng nhập ngay"}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const userId = user?.id ?? null;
  const [testAttempts, writingSubs, speakingSubs, fcData, courseProgs, courses] =
    await Promise.all([
      getUserTestAttempts(userId),
      getUserWritingSubmissions(userId),
      getUserSpeakingSubmissions(userId),
      getFlashcardsForUser(userId),
      getUserCourseProgress(userId),
      getCourses(),
    ]);

  const flashcards = userId
    ? fcData.cards.filter((c) => c.user_id === userId)
    : fcData.cards;

  // Aggregate mistake analytics across all test attempts by question type
  const typeTotals: Record<string, { correct: number; total: number }> = {};
  for (const att of testAttempts) {
    for (const [type, stat] of Object.entries(att.breakdown_by_type)) {
      if (!typeTotals[type]) typeTotals[type] = { correct: 0, total: 0 };
      typeTotals[type].correct += stat.correct;
      typeTotals[type].total += stat.total;
    }
  }

  const avgSkill = (scores: number[]) =>
    scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : "—";

  // Only average official full 40-question Reading/Listening band scores
  const readingAvg = avgSkill(
    testAttempts
      .filter((a) => a.skill === "reading" && a.max_score >= 40)
      .map((a) => a.band_score)
  );
  const listeningAvg = avgSkill(
    testAttempts
      .filter((a) => a.skill === "listening" && a.max_score >= 40)
      .map((a) => a.band_score)
  );
  const writingAvg = avgSkill(writingSubs.map((s) => s.overall_band));
  const speakingAvg = avgSkill(speakingSubs.map((s) => s.overall_band));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isEn
              ? "Learning Progress & Mistake Analytics"
              : "Tiến độ học tập & Phân tích lỗi sai"}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {user?.full_name ?? "Học viên"} · Mục tiêu Band{" "}
            <strong>{(user?.target_band ?? 7.0).toFixed(1)}</strong>
          </p>
        </div>
        <Link href="/tests">
          <Button>{isEn ? "Take Another Test" : "Làm thêm đề luyện tập"}</Button>
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isEn ? "Study Streak" : "Chuỗi ngày học"}</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {user?.streak_count ?? 1} {isEn ? "days" : "ngày"}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isEn ? "Tests Completed" : "Đề đã hoàn thành"}</span>
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {testAttempts.length}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isEn ? "AI Evaluations" : "Bài đã chấm AI"}</span>
            <PenTool className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {writingSubs.length + speakingSubs.length}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Flashcards</span>
            <Layers className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {flashcards.length} {isEn ? "cards" : "thẻ"}
          </p>
        </Card>
      </div>

      {/* 4 Skill Averages */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Reading Avg (40Q)", val: readingAvg, href: "/tests?skill=reading" },
          { label: "Listening Avg (40Q)", val: listeningAvg, href: "/tests?skill=listening" },
          { label: "Writing AI Avg", val: writingAvg, href: "/writing" },
          { label: "Speaking AI Avg", val: speakingAvg, href: "/speaking" },
        ].map((sk) => (
          <Link key={sk.label} href={sk.href}>
            <Card className="p-5 text-center transition hover:border-emerald-400">
              <p className="text-xs font-semibold text-slate-500">{sk.label}</p>
              <p className="mt-1 text-4xl font-bold text-emerald-700 dark:text-emerald-400">
                {sk.val}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Mistake Analytics by Question Type + Courses Progress */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isEn
                ? "Mistake Analytics by Question Type"
                : "Phân tích độ chính xác theo từng dạng câu hỏi"}
            </h2>
          </div>

          {Object.keys(typeTotals).length === 0 ? (
            <p className="text-sm text-slate-500">
              {isEn
                ? "Complete at least one Reading or Listening test to unlock question-type analytics."
                : "Hãy hoàn thành ít nhất 1 đề Reading hoặc Listening để xem thống kê dạng câu hỏi hay sai nhất."}
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(typeTotals)
                .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
                .map(([type, stat]) => {
                  const pct = Math.round((stat.correct / Math.max(1, stat.total)) * 100);
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="uppercase">{type.replace(/_/g, " ")}</span>
                        <span className={pct >= 70 ? "text-emerald-600" : "text-amber-600"}>
                          {stat.correct}/{stat.total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-600" : "bg-amber-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>

        <Card className="p-6 lg:col-span-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {isEn ? "Course Progress" : "Tiến độ Khóa học"}
          </h2>
          <div className="space-y-3">
            {courses.map((course) => {
              const prog = courseProgs.find((p) => p.course_id === course.id);
              const pct = prog?.progress_percent ?? 0;
              return (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  className="block rounded-xl border border-slate-200 p-3.5 hover:border-emerald-400 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="truncate pr-2">
                      {isEn ? course.title_en : course.title_vi}
                    </span>
                    <Badge>{pct}%</Badge>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
