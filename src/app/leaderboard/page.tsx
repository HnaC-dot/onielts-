import React from "react";
import { getLocale } from "next-intl/server";
import { getDailyExamState, listAllProfiles } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getVietnamDateString } from "@/lib/utils";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { LeaderboardClient, type StreakLeaderRow } from "@/components/leaderboard-client";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Bảng xếp hạng Đề thi mỗi ngày & Chuỗi Streak",
    description:
      "Xếp hạng học viên Ôn IELTS theo độ chính xác, tốc độ hoàn thành đề mỗi ngày và chuỗi ngày học liên tục theo Tuần, Tháng, Năm.",
    pathname: "/leaderboard",
    type: "website",
  });
}

function isDemoSeedUserId(userId: string): boolean {
  return userId.startsWith("demo-");
}

export default async function LeaderboardPage() {
  const vnToday = getVietnamDateString();
  const supabaseActive = isSupabaseConfigured();
  const [locale, dailyState, profiles] = await Promise.all([
    getLocale(),
    getDailyExamState(vnToday, null),
    listAllProfiles(),
  ]);
  const isEn = locale === "en";

  const realDailyRows = dailyState.leaderboard.filter(
    (r) => !isDemoSeedUserId(r.user_id)
  );
  const dailyRows = supabaseActive
    ? realDailyRows
    : realDailyRows.length > 0
    ? realDailyRows
    : dailyState.leaderboard;
  const dailyIsDemo =
    !supabaseActive && realDailyRows.length === 0 && dailyRows.length > 0;

  const activeProfiles = profiles.filter((p) => p.streak_count > 0);
  const realProfiles = activeProfiles.filter((p) => !isDemoSeedUserId(p.id));
  const selectedProfiles = supabaseActive
    ? realProfiles
    : realProfiles.length > 0
    ? realProfiles
    : activeProfiles;
  const streakIsDemo =
    !supabaseActive && realProfiles.length === 0 && selectedProfiles.length > 0;

  const leaders: StreakLeaderRow[] = selectedProfiles
    .map((p) => ({
      id: p.id,
      name: p.full_name || "Học viên Ôn IELTS",
      streakDays: p.streak_count,
      avgBand: p.current_band ?? 0,
      examsDone: Math.max(1, p.streak_count),
      points: p.streak_count * 35 + Math.round((p.current_band ?? 5.0) * 20),
      isDemo: isDemoSeedUserId(p.id),
    }))
    .sort((a, b) => b.points - a.points);

  const streakBoards = {
    weekly: leaders
      .map((r) => ({
        ...r,
        streakDays: Math.min(7, r.streakDays),
        examsDone: Math.min(7, r.examsDone),
        points: Math.min(7, r.streakDays) * 50 + Math.round((r.avgBand || 5.0) * 20),
      }))
      .sort((a, b) => b.points - a.points),
    monthly: leaders
      .map((r) => ({
        ...r,
        streakDays: Math.min(30, r.streakDays),
        points: Math.min(30, r.streakDays) * 40 + Math.round((r.avgBand || 5.0) * 25),
      }))
      .sort((a, b) => b.points - a.points),
    yearly: leaders
      .map((r) => ({
        ...r,
        points: r.streakDays * 45 + r.examsDone * 20,
      }))
      .sort((a, b) => b.points - a.points),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "Daily Exam & Streak Leaderboards" : "Bảng xếp hạng Ôn IELTS"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Compete fairly on accuracy, speed, and consistent daily study streaks."
            : "Thi đua minh bạch theo độ chính xác, thời gian hoàn thành và sự bền bỉ mỗi ngày."}
        </p>
      </div>

      <LeaderboardClient
        examDate={vnToday}
        dailyRows={dailyRows}
        streakBoards={streakBoards}
        showingDemoData={dailyIsDemo || streakIsDemo}
      />
    </div>
  );
}
