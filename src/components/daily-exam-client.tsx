"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { ArrowRight, CheckCircle2, Clock, Flame, Lock, Trophy } from "lucide-react";
import type { DailyExamAttempt, IeltsTest } from "@/lib/types";
import type { GradedTestResult } from "@/lib/test-grader";
import { formatDuration } from "@/lib/utils";
import { TestEngineClient } from "./test-engine-client";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface DailyExamClientProps {
  examDate: string;
  durationSeconds: number;
  test: IeltsTest;
  isLoggedIn: boolean;
  initialAttempt: DailyExamAttempt | null;
  topDaily: DailyExamAttempt[];
}

export function DailyExamClient({
  examDate,
  durationSeconds,
  test,
  isLoggedIn,
  initialAttempt,
  topDaily,
}: DailyExamClientProps) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [attempt, setAttempt] = useState<DailyExamAttempt | null>(initialAttempt);
  const [started, setStarted] = useState(
    Boolean(initialAttempt && !initialAttempt.is_completed)
  );
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/daily-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không thể bắt đầu đề thi hôm nay.");
        return;
      }
      setAttempt(data.attempt);
      setRemainingSeconds(data.remainingSeconds ?? durationSeconds);
      setStarted(true);
    } finally {
      setStarting(false);
    }
  };

  const handleDailySubmit = async (
    answers: Record<string, string>
  ): Promise<GradedTestResult | null> => {
    const res = await fetch("/api/daily-exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", answers }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Không thể nộp bài.");
      return null;
    }
    setAttempt(data.attempt);
    return data.graded as GradedTestResult;
  };

  if (started && attempt && !attempt.is_completed) {
    return (
      <TestEngineClient
        test={test}
        mode="daily"
        initialSecondsLeft={remainingSeconds}
        onDailySubmit={handleDailySubmit}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-8">
      <div className="rounded-3xl bg-emerald-900 p-7 text-white sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          <Flame className="h-4 w-4 text-amber-300" />
          <span>
            {isEn
              ? `Daily Exam · ${examDate} (Asia/Ho_Chi_Minh UTC+7)`
              : `Đề thi mỗi ngày · ${examDate} (Múi giờ Việt Nam UTC+7)`}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          {isEn ? test.title_en : test.title_vi}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-emerald-100/90">
          {isEn
            ? "One official server-timed attempt per user per day. Ranked by accuracy first, then fastest completion time."
            : "Mỗi tài khoản chỉ được làm 1 lượt duy nhất mỗi ngày, tính giờ trên máy chủ. Xếp hạng theo số câu đúng trước, sau đó đến tốc độ hoàn thành."}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-semibold text-emerald-100">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2">
            <Clock className="h-4 w-4 text-amber-300" />
            {Math.round(durationSeconds / 60)} {isEn ? "minutes limit" : "phút làm bài"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2">
            <Trophy className="h-4 w-4 text-amber-300" />
            {isEn ? "Rewards Daily Streak" : "Cộng chuỗi ngày học (Streak)"}
          </span>
        </div>

        <div className="mt-6">
          {attempt?.is_completed ? (
            <div className="inline-flex flex-wrap items-center gap-4 rounded-2xl bg-white/15 px-5 py-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-300" />
              <div>
                <p className="text-sm font-bold">
                  {isEn ? "You completed today's Daily Exam!" : "Bạn đã hoàn thành Đề thi hôm nay!"}
                </p>
                <p className="text-xs text-emerald-100">
                  {isEn
                    ? `Score: ${attempt.raw_score}/${attempt.max_score} (${Math.round((attempt.raw_score / Math.max(1, attempt.max_score)) * 100)}%) · Time: ${formatDuration(attempt.duration_seconds)}`
                    : `Kết quả: ${attempt.raw_score}/${attempt.max_score} câu (${Math.round((attempt.raw_score / Math.max(1, attempt.max_score)) * 100)}%) · Thời gian: ${formatDuration(attempt.duration_seconds)}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/leaderboard">
                  <Button className="bg-white text-emerald-900 hover:bg-emerald-50">
                    {isEn ? "View Leaderboard" : "Xem bảng xếp hạng"}
                  </Button>
                </Link>
                <Link href="/progress">
                  <Button
                    variant="outline"
                    className="border-white/40 bg-transparent text-white hover:bg-white/15"
                  >
                    {isEn ? "My Progress →" : "Xem Tiến độ →"}
                  </Button>
                </Link>
              </div>
            </div>
          ) : !isLoggedIn ? (
            <Link href="/auth">
              <Button size="lg" className="bg-white text-emerald-900 hover:bg-emerald-50">
                <Lock className="h-4 w-4" />
                {isEn ? "Sign in to Start Daily Exam" : "Đăng nhập để bắt đầu thi hôm nay"}
              </Button>
            </Link>
          ) : (
            <Button
              type="button"
              size="lg"
              id="start-daily-exam-btn"
              disabled={starting}
              onClick={handleStart}
              className="bg-white text-emerald-900 hover:bg-emerald-50"
            >
              {isEn ? "Start Timed Daily Exam" : "Bắt đầu làm Đề hôm nay"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {error && <p className="mt-3 text-xs font-semibold text-amber-200">{error}</p>}
      </div>

      {/* Live Daily Top 10 Preview */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEn ? "Today's Leaderboard Preview" : "Bảng xếp hạng Đề thi hôm nay"}
          </h2>
          <Link
            href="/leaderboard"
            className="text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {isEn ? "Full Leaderboards →" : "Xem đầy đủ Tuần / Tháng / Năm →"}
          </Link>
        </div>

        {topDaily.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {isEn
              ? "No submissions recorded yet today. Be the first to set today's benchmark!"
              : "Chưa có thí sinh nào nộp Đề hôm nay. Hãy là người đầu tiên lập thành tích!"}
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {topDaily.map((row, idx) => {
              const pct = Math.round((row.raw_score / Math.max(1, row.max_score)) * 100);
              return (
                <div key={row.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0
                          ? "bg-amber-100 text-amber-800"
                          : idx === 1
                          ? "bg-slate-200 text-slate-800"
                          : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {row.display_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge>
                      {row.raw_score}/{row.max_score} ({pct}%)
                    </Badge>
                    <span className="font-mono text-slate-500">
                      {formatDuration(row.duration_seconds)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
