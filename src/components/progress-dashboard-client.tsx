"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Eye,
  Flame,
  Headphones,
  Layers,
  Loader2,
  Lock,
  Mic,
  PenTool,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import {
  calculateBandGap,
  formatStudyTime,
  getQuestionTypeLabel,
  type HistorySkillFilter,
  type ProgressAttemptReviewPayload,
  type ProgressHistoryPage,
  type ProgressSummaryPayload,
  type SkillBandPoint,
} from "@/lib/progress-shared";
import type { IeltsSkill } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ProgressDashboardClientProps {
  userName: string;
  locale: string;
  initialSummary: ProgressSummaryPayload;
  initialHistory: ProgressHistoryPage;
}

const TARGET_BAND_OPTIONS = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0];

const SAMPLE_BLUR_CHART: SkillBandPoint[] = [
  { date: "2026-10-01", label: "01/10", band: 5.5, title: "Test 1" },
  { date: "2026-10-12", label: "12/10", band: 6.0, title: "Test 2" },
  { date: "2026-10-24", label: "24/10", band: 6.0, title: "Test 3" },
  { date: "2026-11-05", label: "05/11", band: 6.5, title: "Test 4" },
  { date: "2026-11-18", label: "18/11", band: 7.0, title: "Test 5" },
];

const SAMPLE_BLUR_TYPES = [
  { type: "tfng", label: "True / False / Not Given", pct: 48, wrong: 11, total: 21 },
  { type: "matching_headings", label: "Nối tiêu đề (Matching Headings)", pct: 55, wrong: 9, total: 20 },
  { type: "mcq", label: "Trắc nghiệm (MCQ)", pct: 72, wrong: 5, total: 18 },
];

function SkillBandChartSvg({
  points,
  targetBand,
  skillLabel,
  isEn,
}: {
  points: SkillBandPoint[];
  targetBand: number;
  skillLabel: string;
  isEn: boolean;
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
        <TrendingUp className="mb-2 h-5 w-5 opacity-40" />
        <p>
          {isEn
            ? `No graded ${skillLabel} Band scores yet. Complete a full test or AI evaluation to plot your trend.`
            : `Chưa có điểm Band ${skillLabel} nào. Hoàn thành 1 đề đủ 40 câu (hoặc bài chấm AI) để vẽ biểu đồ xu hướng.`}
        </p>
      </div>
    );
  }

  const width = 560;
  const height = 190;
  const padL = 36;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const minY = 3.5;
  const maxY = 9.0;

  const toX = (idx: number) =>
    points.length === 1
      ? padL + innerW / 2
      : padL + (idx / (points.length - 1)) * innerW;
  const toY = (band: number) => {
    const clamped = Math.max(minY, Math.min(maxY, band));
    return padT + ((maxY - clamped) / (maxY - minY)) * innerH;
  };

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${toX(idx).toFixed(1)} ${toY(pt.band).toFixed(1)}`)
    .join(" ");

  const targetY = toY(targetBand);
  const yTicks = [4.0, 5.5, 7.0, 8.5];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full min-w-[360px]"
        role="img"
        aria-label={`${skillLabel} band score trend`}
      >
        {/* Horizontal grid lines */}
        {yTicks.map((tick) => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeDasharray="3 3"
              />
              <text
                x={padL - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="currentColor"
                opacity={0.55}
              >
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Target band dashed line */}
        <line
          x1={padL}
          y1={targetY}
          x2={width - padR}
          y2={targetY}
          stroke="#f59e0b"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={width - padR}
          y={Math.max(12, targetY - 5)}
          textAnchor="end"
          fontSize={10}
          fontWeight={600}
          fill="#d97706"
        >
          {isEn ? `Target ${targetBand.toFixed(1)}` : `Mục tiêu ${targetBand.toFixed(1)}`}
        </text>

        {/* Trend line */}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="#059669"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {points.map((pt, idx) => {
          const cx = toX(idx);
          const cy = toY(pt.band);
          return (
            <g key={`${pt.date}-${idx}`}>
              <circle
                cx={cx}
                cy={cy}
                r={4.5}
                fill="#059669"
                stroke="#ffffff"
                strokeWidth={2}
              >
                <title>{`${pt.label} · Band ${pt.band.toFixed(1)} · ${pt.title}`}</title>
              </circle>
              <text
                x={cx}
                y={cy - 9}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill="#059669"
              >
                {pt.band.toFixed(1)}
              </text>
              <text
                x={cx}
                y={height - 8}
                textAnchor="middle"
                fontSize={9.5}
                fill="currentColor"
                opacity={0.6}
              >
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ProgressDashboardClient({
  userName,
  locale,
  initialSummary,
  initialHistory,
}: ProgressDashboardClientProps) {
  const router = useRouter();
  const isEn = locale === "en";

  const [summary, setSummary] = useState<ProgressSummaryPayload>(initialSummary);
  const [history, setHistory] = useState<ProgressHistoryPage>(initialHistory);
  const [skillFilter, setSkillFilter] = useState<HistorySkillFilter>("all");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Target band inline edit
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState<number>(initialSummary.targetBand);
  const [savingTarget, setSavingTarget] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Active chart skill tab
  const [chartSkill, setChartSkill] = useState<IeltsSkill>("reading");

  // Attempt review modal
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState<ProgressAttemptReviewPayload | null>(null);
  const [reviewError, setReviewError] = useState("");

  // Clear history modal
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearScope, setClearScope] = useState<"all" | "tests" | "writing" | "speaking" | "daily">("all");
  const [clearing, setClearing] = useState(false);

  const fetchHistoryPage = useCallback(
    async (nextSkill: HistorySkillFilter, nextPage: number) => {
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({
          skill: nextSkill,
          page: String(nextPage),
          pageSize: "10",
        });
        const res = await fetch(`/api/progress/history?${params.toString()}`);
        if (res.ok) {
          const data = (await res.json()) as ProgressHistoryPage;
          setHistory(data);
        }
      } finally {
        setHistoryLoading(false);
      }
    },
    []
  );

  const handleFilterChange = (nextSkill: HistorySkillFilter) => {
    setSkillFilter(nextSkill);
    void fetchHistoryPage(nextSkill, 1);
  };

  const handleSaveTarget = async () => {
    setSavingTarget(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_band: targetDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg(data.error || "Không thể lưu mục tiêu Band.");
        return;
      }
      setSummary((prev) => ({ ...prev, targetBand: data.targetBand }));
      setEditingTarget(false);
      setStatusMsg(
        isEn
          ? `Target updated to Band ${Number(data.targetBand).toFixed(1)}.`
          : `Đã cập nhật mục tiêu Band ${Number(data.targetBand).toFixed(1)}.`
      );
      router.refresh();
    } finally {
      setSavingTarget(false);
    }
  };

  const handleOpenReview = async (kind: "test" | "daily" | "writing" | "speaking", id: string) => {
    setReviewLoading(true);
    setReviewError("");
    setReviewData(null);
    try {
      const res = await fetch(
        `/api/progress/attempt/${encodeURIComponent(id)}?kind=${encodeURIComponent(kind)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error || "Không thể tải chi tiết bài làm.");
        return;
      }
      setReviewData(data as ProgressAttemptReviewPayload);
    } catch {
      setReviewError("Lỗi kết nối khi tải bài làm.");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleClearHistory = async () => {
    setClearing(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/progress", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: clearScope }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatusMsg(err.error || "Xóa lịch sử thất bại.");
        return;
      }
      setClearModalOpen(false);
      const [sumRes] = await Promise.all([
        fetch("/api/progress"),
        fetchHistoryPage(skillFilter, 1),
      ]);
      if (sumRes.ok) {
        setSummary((await sumRes.json()) as ProgressSummaryPayload);
      }
      setStatusMsg(
        isEn ? "Learning history cleared." : "Đã xóa lịch sử học tập đã chọn."
      );
      router.refresh();
    } finally {
      setClearing(false);
    }
  };

  const skillCards: Array<{
    key: IeltsSkill;
    label: string;
    band: number | null;
    latestText: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: "reading",
      label: "Reading",
      band: summary.estimatedBands.reading,
      latestText: summary.latestScores.reading
        ? `${summary.latestScores.reading.rawScore}/${summary.latestScores.reading.maxScore} ${
            isEn ? "correct" : "câu"
          }`
        : isEn
        ? "No attempts yet"
        : "Chưa có bài",
      href: "/tests?skill=reading",
      icon: BookOpen,
    },
    {
      key: "listening",
      label: "Listening",
      band: summary.estimatedBands.listening,
      latestText: summary.latestScores.listening
        ? `${summary.latestScores.listening.rawScore}/${summary.latestScores.listening.maxScore} ${
            isEn ? "correct" : "câu"
          }`
        : isEn
        ? "No attempts yet"
        : "Chưa có bài",
      href: "/tests?skill=listening",
      icon: Headphones,
    },
    {
      key: "writing",
      label: "Writing AI",
      band: summary.estimatedBands.writing,
      latestText: summary.latestScores.writing
        ? `${isEn ? "Latest" : "Gần nhất"}: Band ${summary.latestScores.writing.band.toFixed(1)}`
        : isEn
        ? "No essays yet"
        : "Chưa có bài",
      href: "/writing",
      icon: PenTool,
    },
    {
      key: "speaking",
      label: "Speaking AI",
      band: summary.estimatedBands.speaking,
      latestText: summary.latestScores.speaking
        ? `${isEn ? "Latest" : "Gần nhất"}: Band ${summary.latestScores.speaking.band.toFixed(1)}`
        : isEn
        ? "No recordings yet"
        : "Chưa có bài",
      href: "/speaking",
      icon: Mic,
    },
  ];

  const overallGap = calculateBandGap(
    summary.estimatedBands.overall,
    summary.targetBand
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-8">
      {/* Header + Editable Target Band */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isEn ? "Learning Progress" : "Tiến độ học tập"}
            </h1>
            <Badge variant={summary.isPremium ? "default" : "secondary"}>
              {summary.isPremium ? (
                <span className="inline-flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Premium
                </span>
              ) : (
                "Free"
              )}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>{userName}</span>
            <span>·</span>
            {!editingTarget ? (
              <span className="inline-flex items-center gap-2">
                <span>
                  {isEn ? "Target Band:" : "Mục tiêu Band:"}{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {summary.targetBand.toFixed(1)}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTargetDraft(summary.targetBand);
                    setEditingTarget(true);
                  }}
                  className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {isEn ? "Edit target" : "Đổi mục tiêu"}
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <select
                  aria-label="Target Band"
                  value={targetDraft}
                  onChange={(e) => setTargetDraft(Number(e.target.value))}
                  className="rounded-lg border border-emerald-400 bg-white px-2 py-1 text-xs font-bold text-slate-900 dark:bg-slate-900 dark:text-white"
                >
                  {TARGET_BAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      Band {b.toFixed(1)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  disabled={savingTarget}
                  onClick={handleSaveTarget}
                >
                  <Check className="h-3.5 w-3.5" />
                  {isEn ? "Save" : "Lưu"}
                </Button>
                <button
                  type="button"
                  onClick={() => setEditingTarget(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {overallGap !== null && (
              <>
                <span>·</span>
                <span className="text-xs font-semibold">
                  {overallGap <= 0
                    ? isEn
                      ? "Target reached!"
                      : "Đã đạt mục tiêu!"
                    : isEn
                    ? `Gap: -${overallGap.toFixed(1)} band`
                    : `Còn thiếu ${overallGap.toFixed(1)} band`}
                </span>
              </>
            )}
          </div>

          {statusMsg && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {statusMsg}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/tests">
            <Button>
              {isEn ? "Practice Tests" : "Làm thêm đề"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setClearModalOpen(true)}
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isEn ? "Clear History" : "Xóa lịch sử học"}
          </Button>
        </div>
      </div>

      {/* KPI Row: Streak, Weekly Study Time, Tests Done, Flashcards Learned */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isEn ? "Study Streak" : "Chuỗi ngày học"}</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {summary.streakCount} {isEn ? "days" : "ngày"}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {isEn ? "Updated daily (UTC+7)" : "Tính liên tiếp theo giờ VN (UTC+7)"}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isEn ? "Study Time (7 days)" : "Thời gian học tuần này"}</span>
            <Clock className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {formatStudyTime(summary.weeklyStudySeconds, isEn)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {isEn ? "Tests, Daily Exam, Writing & Speaking" : "Tổng đề thi, Đề mỗi ngày, Writing & Speaking"}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isEn ? "Tests Completed" : "Số đề đã làm"}</span>
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {summary.counts.testsCompleted + summary.counts.dailyExamsCompleted}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {summary.counts.testsCompleted} {isEn ? "full/practice" : "đề luyện"} ·{" "}
            {summary.counts.dailyExamsCompleted} {isEn ? "daily" : "đề mỗi ngày"} ·{" "}
            {summary.counts.writingCount + summary.counts.speakingCount} AI
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isEn ? "Flashcards Learned" : "Từ Flashcard đã học"}</span>
            <Layers className="h-4 w-4 text-violet-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {summary.counts.flashcardsLearned}
            <span className="text-base font-medium text-slate-400">
              /{summary.counts.flashcardsTotal}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {isEn ? "Reviewed at least once (SM-2)" : "Số từ đã ôn theo lịch SM-2"}
          </p>
        </Card>
      </div>

      {/* 4 Skill Cards: Estimated Band vs Target Gap */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {skillCards.map((sk) => {
          const Icon = sk.icon;
          const gap = calculateBandGap(sk.band, summary.targetBand);
          return (
            <Link key={sk.key} href={sk.href}>
              <Card className="h-full p-5 transition hover:border-emerald-400 hover:shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <Icon className="h-4 w-4 text-emerald-600" />
                    {sk.label}
                  </span>
                  {gap !== null ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        gap <= 0
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {gap <= 0
                        ? isEn
                          ? "On target"
                          : "Đạt mục tiêu"
                        : `-${gap.toFixed(1)} vs ${summary.targetBand.toFixed(1)}`}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      {isEn ? "No band yet" : "Chưa ước tính"}
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                  {sk.band !== null ? sk.band.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {sk.latestText}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* PREMIUM ANALYTICS SECTION: Charts + Question-Type Mistakes + Recs     */}
      {/* Free users see a blurred preview + Upgrade button; server strips data */}
      {/* ===================================================================== */}
      <div className="relative">
        <div
          className={
            summary.isPremium
              ? "space-y-6"
              : "space-y-6 select-none pointer-events-none blur-[5px] opacity-75"
          }
          aria-hidden={!summary.isPremium}
        >
          {/* 1. Score Trend Chart */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {isEn
                      ? "Band Score Trend Over Time"
                      : "Biểu đồ điểm Band theo thời gian"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isEn
                      ? "Tracks full 40Q tests and AI Writing/Speaking evaluations against your target."
                      : "Theo dõi tiến bộ từng lần làm đề 40 câu và chấm AI so với đường mục tiêu."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(["reading", "listening", "writing", "speaking"] as IeltsSkill[]).map(
                  (sk) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => setChartSkill(sk)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
                        chartSkill === sk
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {sk}
                    </button>
                  )
                )}
              </div>
            </div>

            <SkillBandChartSvg
              points={
                summary.isPremium && summary.charts
                  ? summary.charts[chartSkill]
                  : SAMPLE_BLUR_CHART
              }
              targetBand={summary.targetBand}
              skillLabel={chartSkill.toUpperCase()}
              isEn={isEn}
            />
          </Card>

          {/* 2. Question-Type Mistake Analytics + 3. Next Practice Recommendations */}
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="p-6 lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-600" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {isEn
                      ? "Mistake Analytics by Question Type"
                      : "Phân tích lỗi sai theo dạng câu hỏi"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isEn
                      ? "Sorted from weakest to strongest so you know exactly what to drill next."
                      : "Xếp từ dạng sai nhiều nhất đến tốt nhất, kèm nút luyện lại ngay."}
                  </p>
                </div>
              </div>

              {summary.isPremium && summary.questionTypeStats ? (
                summary.questionTypeStats.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {isEn
                      ? "Complete at least one Reading or Listening test to analyze accuracy by question type."
                      : "Hoàn thành ít nhất 1 đề Reading hoặc Listening để phân tích tỷ lệ đúng theo từng dạng câu hỏi."}
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {summary.questionTypeStats.map((st, idx) => (
                      <div key={st.type} className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                            {idx === 0 && st.wrong > 0 && (
                              <Badge variant="amber">
                                {isEn ? "Weakest" : "Hay sai nhất"}
                              </Badge>
                            )}
                            <span>{isEn ? st.labelEn : st.labelVi}</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`font-bold ${
                                st.accuracyPercent >= 75
                                  ? "text-emerald-600"
                                  : st.accuracyPercent >= 55
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              {st.correct}/{st.total} ({st.accuracyPercent}%)
                            </span>
                            <Link
                              href={st.practiceHref}
                              className="inline-flex items-center gap-0.5 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                            >
                              {isEn ? "Drill" : "Luyện lại"}
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full ${
                              st.accuracyPercent >= 75
                                ? "bg-emerald-600"
                                : st.accuracyPercent >= 55
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${st.accuracyPercent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-3.5">
                  {SAMPLE_BLUR_TYPES.map((st) => (
                    <div key={st.type} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>{st.label}</span>
                        <span>{st.pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${st.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6 lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEn ? "Recommended Next Practice" : "Gợi ý bài tiếp theo"}
                </h2>
              </div>
              <div className="space-y-3">
                {(summary.isPremium && summary.recommendations
                  ? summary.recommendations
                  : [
                      {
                        reasonVi: "Dạng True / False / Not Given đang là điểm yếu nhất",
                        reasonEn: "True / False / Not Given needs attention",
                        titleVi: "Luyện đề Reading tập trung T/F/NG",
                        titleEn: "Targeted Reading T/F/NG Test",
                        skill: "reading" as IeltsSkill,
                        href: "/tests?skill=reading",
                        badgeText: "48%",
                      },
                      {
                        reasonVi: "Nâng điểm tiêu chí Lexical Resource & Coherence",
                        reasonEn: "Improve Lexical Resource & Coherence",
                        titleVi: "Nộp 1 bài Writing Task 2 chấm AI",
                        titleEn: "Submit a Writing Task 2 essay",
                        skill: "writing" as IeltsSkill,
                        href: "/writing",
                        badgeText: "Writing",
                      },
                    ]
                ).map((rec, idx) => (
                  <Link
                    key={`${rec.href}-${idx}`}
                    href={rec.href}
                    className="block rounded-xl border border-slate-200 p-3.5 transition hover:border-emerald-400 hover:bg-emerald-50/30 dark:border-slate-800 dark:hover:bg-emerald-950/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="uppercase">
                        {rec.skill}
                      </Badge>
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        {rec.badgeText}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {isEn ? rec.titleEn : rec.titleVi}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isEn ? rec.reasonEn : rec.reasonVi}
                    </p>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Locked Premium Overlay for Free users */}
        {!summary.isPremium && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
            <Card className="max-w-md border-emerald-300 bg-white/95 p-6 text-center shadow-xl backdrop-blur-xs dark:border-emerald-800 dark:bg-slate-950/95 space-y-3.5">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isEn
                  ? "Unlock Full Progress Analytics with Premium"
                  : "Mở khóa Phân tích Chuyên sâu cùng Premium"}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {isEn
                  ? "Get score trend charts across all 4 skills, question-type mistake breakdowns (T/F/NG, Matching Headings, MCQ...), and personalized next-step recommendations."
                  : "Xem biểu đồ tiến bộ 4 kỹ năng theo thời gian, phân tích tỷ lệ đúng theo từng dạng câu hỏi (T/F/NG, Matching Headings, MCQ...) và gợi ý bài luyện cá nhân hóa."}
              </p>
              {summary.lockedMeta.trackedQuestionTypesCount > 0 && (
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {isEn
                    ? `We have already tracked ${summary.lockedMeta.trackedQuestionTypesCount} question types from your submissions.`
                    : `Hệ thống đã ghi nhận ${summary.lockedMeta.trackedQuestionTypesCount} dạng câu hỏi từ bài làm của bạn — sẵn sàng mở khóa!`}
                </p>
              )}
              <div className="pt-1">
                <Link href="/pricing">
                  <Button>
                    <Crown className="h-4 w-4" />
                    {isEn ? "Upgrade to Premium" : "Nâng cấp Premium ngay"}
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* PAGINATED & FILTERABLE ATTEMPT HISTORY (Free & Premium)               */}
      {/* ===================================================================== */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? "Attempt & Submission History" : "Lịch sử làm đề & chấm bài"}
              </h2>
              <p className="text-xs text-slate-500">
                {isEn
                  ? `Showing ${history.items.length} of ${history.total} records (paginated on server)`
                  : `Hiển thị ${history.items.length}/${history.total} lượt làm bài (phân trang trực tiếp từ server)`}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "all", label: isEn ? "All" : "Tất cả" },
                  { id: "reading", label: "Reading" },
                  { id: "listening", label: "Listening" },
                  { id: "writing", label: "Writing" },
                  { id: "speaking", label: "Speaking" },
                  { id: "daily", label: isEn ? "Daily" : "Đề mỗi ngày" },
                ] as Array<{ id: HistorySkillFilter; label: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleFilterChange(f.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    skillFilter === f.id
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12 text-xs text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" />
              {isEn ? "Loading history..." : "Đang tải lịch sử..."}
            </div>
          ) : history.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800">
              {isEn
                ? "No submissions found for this filter yet."
                : "Chưa có lượt làm bài nào trong mục này."}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.items.map((item) => (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="uppercase">
                        {item.kind === "daily" ? "Daily" : item.skill}
                      </Badge>
                      <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.subtitle} · {formatStudyTime(item.durationSeconds, isEn)} ·{" "}
                      {new Date(item.completedAt).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.bandScore !== null && item.bandScore > 0 && (
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        Band {item.bandScore.toFixed(1)}
                      </span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleOpenReview(item.kind, item.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {isEn ? "Review" : "Xem lại"}
                    </Button>
                    {item.testSlug && (
                      <Link href={`/tests/${item.testSlug}`}>
                        <Button type="button" size="sm" variant="ghost">
                          {isEn ? "Retry" : "Làm lại"}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Server pagination controls */}
          {history.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
              <span className="text-slate-500">
                {isEn
                  ? `Page ${history.page} of ${history.totalPages}`
                  : `Trang ${history.page} / ${history.totalPages}`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={history.page <= 1 || historyLoading}
                  onClick={() => void fetchHistoryPage(skillFilter, history.page - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {isEn ? "Prev" : "Trước"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={history.page >= history.totalPages || historyLoading}
                  onClick={() => void fetchHistoryPage(skillFilter, history.page + 1)}
                >
                  {isEn ? "Next" : "Sau"}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Course Progress + Privacy Note */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isEn ? "Course Progress" : "Tiến độ Khóa học"}
            </h2>
            <div className="space-y-3">
              {summary.courseProgress.map((course) => (
                <Link
                  key={course.courseId}
                  href={`/courses/${course.slug}`}
                  className="block rounded-xl border border-slate-200 p-3.5 hover:border-emerald-400 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="truncate pr-2">
                      {isEn ? course.titleEn : course.titleVi}
                    </span>
                    <Badge>{course.progressPercent}%</Badge>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full bg-emerald-600"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-5 bg-slate-50/70 dark:bg-slate-900/50 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span>{isEn ? "Privacy by Default" : "Quyền riêng tư mặc định"}</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {isEn
                ? "Only you can view your test history, essays, and recordings. All submissions are private by default and protected by server-side authorization & Row Level Security."
                : "Chỉ mình bạn xem được lịch sử làm đề, bài Writing và ghi âm Speaking. Mọi bài nộp đều ở chế độ riêng tư mặc định và được bảo vệ quyền trên server."}
            </p>
            <Link
              href="/daily-exam"
              className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {isEn ? "Take Today's Daily Exam" : "Làm Đề thi mỗi ngày hôm nay"}
            </Link>
          </Card>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ATTEMPT REVIEW MODAL (Answers, Correct Keys & Explanations)           */}
      {/* ===================================================================== */}
      {(reviewLoading || reviewData || reviewError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => {
            setReviewData(null);
            setReviewError("");
          }}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">
                  {reviewData?.title || (isEn ? "Attempt Review" : "Xem lại bài làm")}
                </h3>
                {reviewData && (
                  <p className="text-xs text-slate-500">
                    {reviewData.rawScore !== undefined && reviewData.maxScore !== undefined
                      ? `${reviewData.rawScore}/${reviewData.maxScore} câu đúng · `
                      : ""}
                    {reviewData.bandScore !== null
                      ? `Band ${reviewData.bandScore.toFixed(1)} · `
                      : ""}
                    {formatStudyTime(reviewData.durationSeconds, isEn)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setReviewData(null);
                  setReviewError("");
                }}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {reviewLoading && (
                <div className="flex items-center justify-center py-12 text-xs text-slate-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
                  {isEn ? "Loading detailed answers..." : "Đang tải đáp án & giải thích..."}
                </div>
              )}

              {reviewError && (
                <p className="rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                  {reviewError}
                </p>
              )}

              {/* Objective Test / Daily Exam Question-by-Question Review */}
              {reviewData?.questionDetails && (
                <div className="space-y-3">
                  {reviewData.questionDetails.map((q) => (
                    <div
                      key={q.questionId}
                      className={`rounded-xl border p-3.5 text-xs space-y-1.5 ${
                        q.isCorrect
                          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                          : "border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          {q.isCorrect ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          Câu {q.number} · {getQuestionTypeLabel(q.type, isEn)}
                        </span>
                        {q.sectionRef && (
                          <span className="text-[11px] text-slate-500">{q.sectionRef}</span>
                        )}
                      </div>
                      {q.prompt && (
                        <p className="text-slate-700 dark:text-slate-300">{q.prompt}</p>
                      )}
                      <div className="flex flex-wrap gap-4 pt-1">
                        <span>
                          {isEn ? "Your answer:" : "Bạn chọn:"}{" "}
                          <strong className={q.isCorrect ? "text-emerald-700" : "text-red-700"}>
                            {q.userAnswer || (isEn ? "(blank)" : "(bỏ trống)")}
                          </strong>
                        </span>
                        <span>
                          {isEn ? "Correct key:" : "Đáp án đúng:"}{" "}
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            {q.acceptedAnswers.join(" / ")}
                          </strong>
                        </span>
                      </div>
                      {(q.explanationVi || q.explanationEn) && (
                        <p className="rounded-lg bg-white/80 p-2.5 text-[11px] leading-relaxed text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
                          {isEn
                            ? q.explanationEn || q.explanationVi
                            : q.explanationVi || q.explanationEn}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Writing Review */}
              {reviewData?.writingReview && (
                <div className="space-y-4 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/70">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {isEn ? "Prompt" : "Đề bài"} ({reviewData.writingReview.wordCount} từ)
                    </p>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      {reviewData.writingReview.promptText}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "Task Response / Achievement", data: reviewData.writingReview.criteria.taskResponse },
                      { label: "Coherence & Cohesion", data: reviewData.writingReview.criteria.coherenceCohesion },
                      { label: "Lexical Resource", data: reviewData.writingReview.criteria.lexicalResource },
                      { label: "Grammatical Range", data: reviewData.writingReview.criteria.grammaticalRange },
                    ].map((c) => (
                      <div key={c.label} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                        <div className="flex justify-between font-bold">
                          <span>{c.label}</span>
                          <span className="text-emerald-600">Band {c.data.band.toFixed(1)}</span>
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-400">{c.data.feedbackVi}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {isEn ? "Your Essay" : "Bài viết của bạn"}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">
                      {reviewData.writingReview.essayText}
                    </p>
                  </div>
                </div>
              )}

              {/* Speaking Review */}
              {reviewData?.speakingReview && (
                <div className="space-y-4 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/70">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {isEn ? "Prompt" : "Câu hỏi"}
                    </p>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      {reviewData.speakingReview.promptText}
                    </p>
                  </div>
                  {reviewData.speakingReview.criteria && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { label: "Fluency & Coherence", data: reviewData.speakingReview.criteria.fluencyCoherence },
                        { label: "Lexical Resource", data: reviewData.speakingReview.criteria.lexicalResource },
                        { label: "Grammatical Range", data: reviewData.speakingReview.criteria.grammaticalRange },
                        { label: "Pronunciation (tham khảo)", data: reviewData.speakingReview.criteria.pronunciation },
                      ].map((c) => (
                        <div key={c.label} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                          <div className="flex justify-between font-bold">
                            <span>{c.label}</span>
                            <span className="text-emerald-600">Band {c.data.band.toFixed(1)}</span>
                          </div>
                          <p className="mt-1 text-slate-600 dark:text-slate-400">{c.data.feedbackVi}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                    <p className="font-bold text-slate-900 dark:text-white">Transcript</p>
                    <p className="mt-1 italic text-slate-700 dark:text-slate-300">
                      “{reviewData.speakingReview.transcript}”
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CLEAR LEARNING HISTORY CONFIRMATION MODAL                             */}
      {/* ===================================================================== */}
      {clearModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setClearModalOpen(false)}
        >
          <Card
            className="w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isEn ? "Clear Learning History" : "Xóa lịch sử học tập"}
            </h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {isEn
                ? "Select which records to permanently delete from your account. This action cannot be undone."
                : "Chọn phạm vi dữ liệu muốn xóa vĩnh viễn khỏi tài khoản của bạn. Thao tác này không thể hoàn tác."}
            </p>
            <select
              value={clearScope}
              onChange={(e) =>
                setClearScope(
                  e.target.value as "all" | "tests" | "writing" | "speaking" | "daily"
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="all">
                {isEn
                  ? "All learning history (Tests, Daily Exam, Writing, Speaking & Streak)"
                  : "Toàn bộ lịch sử học (Đề thi, Đề mỗi ngày, Writing, Speaking & Streak)"}
              </option>
              <option value="tests">
                {isEn ? "Reading & Listening test attempts only" : "Chỉ lịch sử làm đề Reading & Listening"}
              </option>
              <option value="writing">
                {isEn ? "Writing submissions only" : "Chỉ các bài Writing đã chấm"}
              </option>
              <option value="speaking">
                {isEn ? "Speaking submissions only" : "Chỉ các bài Speaking đã chấm"}
              </option>
              <option value="daily">
                {isEn ? "Daily Exam attempts only" : "Chỉ lịch sử Đề thi mỗi ngày"}
              </option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClearModalOpen(false)}
              >
                {isEn ? "Cancel" : "Hủy"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={clearing}
                onClick={() => void handleClearHistory()}
              >
                {clearing ? "..." : isEn ? "Delete Permanently" : "Xóa vĩnh viễn"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
