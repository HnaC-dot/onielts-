"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Clock, Flame, Medal, Trophy } from "lucide-react";
import type { DailyExamAttempt } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export interface StreakLeaderRow {
  id: string;
  name: string;
  streakDays: number;
  avgBand: number;
  examsDone: number;
  points: number;
}

export function LeaderboardClient({
  examDate,
  dailyRows,
  streakBoards,
}: {
  examDate: string;
  dailyRows: DailyExamAttempt[];
  streakBoards: {
    weekly: StreakLeaderRow[];
    monthly: StreakLeaderRow[];
    yearly: StreakLeaderRow[];
  };
}) {
  const locale = useLocale();
  const isEn = locale === "en";
  const [tab, setTab] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");

  const tabs = [
    { id: "daily", label: isEn ? "Today (Score + Speed)" : "Hôm nay (Điểm + Tốc độ)" },
    { id: "weekly", label: isEn ? "Weekly Streaks" : "Tuần này (Streak)" },
    { id: "monthly", label: isEn ? "Monthly Streaks" : "Tháng này (Streak)" },
    { id: "yearly", label: isEn ? "Yearly Hall of Fame" : "Cả năm (Bền bỉ)" },
  ] as const;

  const activeStreakRows =
    tab === "weekly"
      ? streakBoards.weekly
      : tab === "monthly"
      ? streakBoards.monthly
      : streakBoards.yearly;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                tab === item.id
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Link href="/daily-exam">
          <Button size="sm">
            <Flame className="h-4 w-4" />
            {isEn ? "Join Today's Exam" : "Thi Đề hôm nay"}
          </Button>
        </Link>
      </div>

      {tab === "daily" ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Trophy className="h-4 w-4 text-amber-500" />
                {isEn ? `Daily Exam Standings (${examDate} UTC+7)` : `Xếp hạng Đề thi ngày ${examDate} (UTC+7)`}
              </p>
              <span className="text-xs text-slate-500">
                {isEn ? "Ranked by score, then completion time" : "Ưu tiên điểm cao hơn, sau đó thời gian nhanh hơn"}
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dailyRows.map((row, idx) => (
              <div key={row.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
                      idx === 0
                        ? "bg-amber-100 text-amber-800"
                        : idx === 1
                        ? "bg-slate-200 text-slate-800"
                        : idx === 2
                        ? "bg-orange-100 text-orange-800"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {row.display_name}
                    </p>
                    <p className="text-xs text-slate-500">Band {row.band_score.toFixed(1)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <Badge>
                    {row.raw_score} / {row.max_score}
                  </Badge>
                  <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-600 dark:text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(row.duration_seconds)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Medal className="h-4 w-4 text-emerald-600" />
              {isEn
                ? "Consistency & Streak Rewards Board"
                : "Bảng vinh danh chuỗi ngày học bền bỉ (Streak Bonus)"}
            </p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeStreakRows.map((row, idx) => (
              <div key={row.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
                      idx === 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.examsDone} {isEn ? "exams completed" : "đề hoàn thành"} · Avg Band {row.avgBand.toFixed(1)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    <Flame className="h-3.5 w-3.5" />
                    {row.streakDays} {isEn ? "day streak" : "ngày liên tiếp"}
                  </span>
                  <Badge>{row.points} pts</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
