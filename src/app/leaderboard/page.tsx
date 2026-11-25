import React from "react";
import { getLocale } from "next-intl/server";
import { readStore } from "@/lib/store";
import { getVietnamDateString } from "@/lib/utils";
import { LeaderboardClient, type StreakLeaderRow } from "@/components/leaderboard-client";

export const metadata = {
  title: "Bảng xếp hạng Đề thi mỗi ngày & Chuỗi Streak",
  description:
    "Xếp hạng học viên Ôn IELTS theo điểm số, tốc độ hoàn thành đề mỗi ngày và chuỗi ngày học liên tục theo Tuần, Tháng, Năm.",
};

export default async function LeaderboardPage() {
  const [locale, store] = await Promise.all([getLocale(), Promise.resolve(readStore())]);
  const isEn = locale === "en";
  const vnToday = getVietnamDateString();

  const dailyRows = store.daily_exam_attempts
    .filter((a) => a.is_completed)
    .sort((a, b) => b.raw_score - a.raw_score || a.duration_seconds - b.duration_seconds);

  const profileLeaders: StreakLeaderRow[] = store.profiles.map((p) => ({
    id: p.id,
    name: p.full_name,
    streakDays: p.streak_count,
    avgBand: p.current_band ?? 6.5,
    examsDone: Math.max(3, Math.round(p.streak_count * 0.8)),
    points: p.streak_count * 35 + Math.round((p.current_band ?? 6.5) * 40),
  }));

  const communityBase: StreakLeaderRow[] = [
    ...profileLeaders,
    { id: "c-vy", name: "Lê Thảo Vy", streakDays: 28, avgBand: 7.5, examsDone: 26, points: 1280 },
    { id: "c-khoi", name: "Phạm Đức Khôi", streakDays: 21, avgBand: 8.0, examsDone: 22, points: 1055 },
    { id: "c-han", name: "Vũ Ngọc Hân", streakDays: 14, avgBand: 7.0, examsDone: 15, points: 770 },
  ].sort((a, b) => b.points - a.points);

  const streakBoards = {
    weekly: communityBase.map((r) => ({
      ...r,
      streakDays: Math.min(7, r.streakDays),
      examsDone: Math.min(7, r.examsDone),
      points: Math.min(7, r.streakDays) * 50 + Math.round(r.avgBand * 25),
    })).sort((a, b) => b.points - a.points),
    monthly: communityBase.map((r) => ({
      ...r,
      streakDays: Math.min(30, r.streakDays),
      points: Math.min(30, r.streakDays) * 40 + Math.round(r.avgBand * 35),
    })).sort((a, b) => b.points - a.points),
    yearly: communityBase.map((r) => ({
      ...r,
      points: r.streakDays * 45 + r.examsDone * 20,
    })).sort((a, b) => b.points - a.points),
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
      />
    </div>
  );
}
