"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  ExternalLink,
  PenTool,
  RefreshCw,
  Shield,
  Target,
} from "lucide-react";
import {
  getQuestionTypeLabel,
  type AdminAnonymousAnalyticsPayload,
} from "@/lib/progress-shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AnalyticsCmsClient({
  initialData,
}: {
  initialData: AdminAnonymousAnalyticsPayload;
}) {
  const [data, setData] = useState<AdminAnonymousAnalyticsPayload>(initialData);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/analytics", { cache: "no-store" });
      if (res.ok) {
        setData((await res.json()) as AdminAnonymousAnalyticsPayload);
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Thống kê học tập (Tổng hợp ẩn danh)
            </h1>
            <Badge variant="secondary">
              <span className="inline-flex items-center gap-1">
                <Shield className="h-3 w-3" /> Không lộ PII học viên
              </span>
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Theo dõi đề thi nào được làm nhiều nhất và câu hỏi nào có tỷ lệ sai bất thường để kiểm tra đáp án hoặc cải thiện lời giải.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={refreshing}
          onClick={() => void handleRefresh()}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Làm mới số liệu
        </Button>
      </div>

      {/* Migration 0006 notice if table not yet created */}
      {!data.answerTableReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-bold">
              Chưa phát hiện bảng <code>public.test_attempt_answers</code> trên Supabase
            </p>
            <p>
              Hãy chạy file{" "}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono dark:bg-amber-900/60">
                supabase/migrations/0006_progress_analytics.sql
              </code>{" "}
              trong Supabase SQL Editor để kích hoạt thống kê chi tiết từng câu hỏi có tỷ lệ sai cao nhất.
            </p>
          </div>
        </div>
      )}

      {/* Totals Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tổng lượt làm Đề thi</span>
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {data.totals.testAttempts}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Lượt Đề thi mỗi ngày</span>
            <CalendarDays className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {data.totals.dailyExamAttempts}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Bài Writing & Speaking AI</span>
            <PenTool className="h-4 w-4 text-violet-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {data.totals.writingSubmissions + data.totals.speakingSubmissions}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Writing: {data.totals.writingSubmissions} · Speaking: {data.totals.speakingSubmissions}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Lượt trả lời từng câu đã ghi</span>
            <BarChart3 className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {data.totals.trackedAnswers}
          </p>
        </Card>
      </div>

      {/* Top Most Attempted Tests + Question Type Wrong Rate */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-7 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Đề thi được làm nhiều nhất
          </h2>
          {data.topTests.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có lượt làm đề nào được ghi nhận.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    <th className="pb-2.5 pr-3 font-semibold">Đề thi</th>
                    <th className="pb-2.5 px-2 font-semibold">Kỹ năng</th>
                    <th className="pb-2.5 px-2 font-semibold text-right">Lượt làm</th>
                    <th className="pb-2.5 px-2 font-semibold text-right">Đúng TB</th>
                    <th className="pb-2.5 px-2 font-semibold text-right">Band TB</th>
                    <th className="pb-2.5 pl-2 font-semibold text-right">Sửa đề</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.topTests.map((t) => (
                    <tr key={t.testId}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-white">
                        {t.testTitle}
                      </td>
                      <td className="py-2.5 px-2">
                        <Badge variant="secondary" className="uppercase">
                          {t.skill}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold">
                        {t.attemptCount}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {t.avgAccuracyPercent}%
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                        {t.avgBand !== null ? t.avgBand.toFixed(1) : "—"}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <Link
                          href={`/admin/tests/${t.testId}`}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Sửa
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6 lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Tỷ lệ sai theo dạng câu hỏi (Toàn hệ thống)
            </h2>
          </div>
          {data.questionTypeOverview.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có dữ liệu trả lời theo dạng câu hỏi.</p>
          ) : (
            <div className="space-y-3">
              {data.questionTypeOverview.map((row) => (
                <div key={row.type} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{row.labelVi}</span>
                    <span
                      className={
                        row.wrongRatePercent >= 50
                          ? "text-red-600"
                          : row.wrongRatePercent >= 30
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }
                    >
                      Sai {row.wrongRatePercent}% ({row.wrongAnswers}/{row.totalAnswers})
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        row.wrongRatePercent >= 50
                          ? "bg-red-500"
                          : row.wrongRatePercent >= 30
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${row.wrongRatePercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Hardest Questions (Highest Error Rate -> inspect & fix test keys/explanations) */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Top câu hỏi có tỷ lệ sai cao nhất (Cần kiểm tra đề / đáp án)
          </h2>
          <p className="text-xs text-slate-500">
            Câu có tỷ lệ sai cao bất thường (VD &gt; 70%) có thể bị lệch đáp án mẫu hoặc câu hỏi khó hiểu — bấm &quot;Kiểm tra đề&quot; để rà soát ngay.
          </p>
        </div>

        {data.hardestQuestions.length === 0 ? (
          <p className="text-xs text-slate-500">
            Chưa có dữ liệu chi tiết từng câu hỏi. Sau khi người dùng nộp bài mới, thống kê từng câu sẽ tự động xuất hiện tại đây.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <th className="pb-2.5 pr-3 font-semibold">Đề thi</th>
                  <th className="pb-2.5 px-2 font-semibold">Câu</th>
                  <th className="pb-2.5 px-2 font-semibold">Dạng câu</th>
                  <th className="pb-2.5 px-2 font-semibold">Nội dung câu hỏi</th>
                  <th className="pb-2.5 px-2 font-semibold text-right">Sai / Tổng</th>
                  <th className="pb-2.5 px-2 font-semibold text-right">Tỷ lệ sai</th>
                  <th className="pb-2.5 pl-2 font-semibold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.hardestQuestions.map((q) => (
                  <tr key={`${q.testId}-${q.questionNumber}`}>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-white">
                      {q.testTitle}
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold">
                      #{q.questionNumber}
                    </td>
                    <td className="py-2.5 px-2">
                      <Badge variant="secondary">
                        {getQuestionTypeLabel(q.questionType, false)}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 max-w-xs truncate text-slate-600 dark:text-slate-400">
                      {q.promptSnippet || "—"}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {q.wrongAnswers}/{q.totalAnswers}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span
                        className={`rounded-md px-2 py-0.5 font-bold ${
                          q.wrongRatePercent >= 70
                            ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}
                      >
                        {q.wrongRatePercent}%
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <Link
                        href={`/admin/tests/${q.testId}`}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Kiểm tra đề
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
