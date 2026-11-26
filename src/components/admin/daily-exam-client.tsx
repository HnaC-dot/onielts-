"use client";

import React, { useCallback, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Save,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import type {
  AdminDailyAttemptRow,
  DailyExamScheduleEntry,
} from "@/lib/cms-daily-exam";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EligibleTestOption {
  id: string;
  slug: string;
  skill: string;
  module: string;
  title_vi: string;
  title_en: string;
  is_published: boolean;
  firstSectionCount: number;
}

interface CalendarPayload {
  year: number;
  month: number;
  vnToday: string;
  dates: string[];
  scheduleByDate: Record<string, DailyExamScheduleEntry>;
  missingInMonthCount: number;
  upcomingMissingDates: string[];
  eligibleTests: EligibleTestOption[];
}

interface DailyExamAdminClientProps {
  initialCalendar: CalendarPayload;
  initialSelectedDate: string;
  initialAttempts: AdminDailyAttemptRow[];
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function DailyExamAdminClient({
  initialCalendar,
  initialSelectedDate,
  initialAttempts,
}: DailyExamAdminClientProps) {
  const toast = useAdminToast();
  const [calendar, setCalendar] = useState<CalendarPayload>(initialCalendar);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [attempts, setAttempts] = useState<AdminDailyAttemptRow[]>(initialAttempts);
  const [loading, setLoading] = useState(false);

  const activeSchedule = calendar.scheduleByDate[selectedDate] ?? null;
  const [chosenTestId, setChosenTestId] = useState(
    activeSchedule?.test_id ?? calendar.eligibleTests[0]?.id ?? ""
  );
  const [customTitleVi, setCustomTitleVi] = useState(
    activeSchedule?.title_vi ?? ""
  );
  const [durationMinutes, setDurationMinutes] = useState(
    Math.round((activeSchedule?.duration_seconds ?? 900) / 60)
  );
  const [saving, setSaving] = useState(false);
  const [deleteAttemptTarget, setDeleteAttemptTarget] =
    useState<AdminDailyAttemptRow | null>(null);
  const [removeScheduleDate, setRemoveScheduleDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMonthAndDate = useCallback(
    async (year: number, month: number, dateToSelect: string) => {
      setLoading(true);
      try {
        const monthStr = `${year}-${String(month).padStart(2, "0")}`;
        const res = await fetch(
          `/api/admin/daily-exam?month=${monthStr}&date=${dateToSelect}`
        );
        if (res.ok) {
          const data = await res.json();
          const nextCal = data.calendar as CalendarPayload;
          setCalendar(nextCal);
          setSelectedDate(dateToSelect);
          setAttempts(data.attempts ?? []);
          const sched = nextCal.scheduleByDate[dateToSelect];
          setChosenTestId(sched?.test_id ?? nextCal.eligibleTests[0]?.id ?? "");
          setCustomTitleVi(sched?.title_vi ?? "");
          setDurationMinutes(Math.round((sched?.duration_seconds ?? 900) / 60));
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const switchMonth = (delta: number) => {
    let nextM = calendar.month + delta;
    let nextY = calendar.year;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    } else if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const targetDay = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
    void loadMonthAndDate(nextY, nextM, targetDay);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosenTestId) {
      toast.error("Vui lòng chọn một đề thi.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/daily-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          exam_date: selectedDate,
          test_id: chosenTestId,
          title_vi: customTitleVi.trim() || undefined,
          duration_seconds: Math.max(300, Math.min(3600, durationMinutes * 60)),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Lưu lịch thất bại.");
        return;
      }
      toast.success(`Đã gán Đề thi mỗi ngày cho ${selectedDate} (UTC+7).`);
      await loadMonthAndDate(calendar.year, calendar.month, selectedDate);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFill = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/daily-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_fill", days: 7 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Tự động gán thất bại.");
        return;
      }
      toast.success(
        data.filledCount > 0
          ? `Đã tự động gán đề cho ${data.filledCount} ngày trống trong 7 ngày tới!`
          : "Tất cả 7 ngày tới đều đã có đề sẵn."
      );
      await loadMonthAndDate(calendar.year, calendar.month, selectedDate);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSchedule = async () => {
    if (!removeScheduleDate) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/daily-exam?date=${encodeURIComponent(removeScheduleDate)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể gỡ lịch.");
        return;
      }
      toast.success(`Đã gỡ lịch đề cho ngày ${removeScheduleDate}`);
      setRemoveScheduleDate(null);
      await loadMonthAndDate(calendar.year, calendar.month, selectedDate);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAttempt = async (attempt: AdminDailyAttemptRow) => {
    const nextVisible = !attempt.is_completed;
    const res = await fetch(`/api/admin/daily-exam/attempts/${attempt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible: nextVisible }),
    });
    if (!res.ok) {
      toast.error("Không thể cập nhật trạng thái hiển thị.");
      return;
    }
    toast.success(
      nextVisible
        ? `Đã hiện lại kết quả của ${attempt.display_name}`
        : `Đã ẩn kết quả của ${attempt.display_name} khỏi Bảng xếp hạng`
    );
    await loadMonthAndDate(calendar.year, calendar.month, selectedDate);
  };

  const handleDeleteAttempt = async () => {
    if (!deleteAttemptTarget) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/daily-exam/attempts/${deleteAttemptTarget.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Không thể xóa kết quả.");
        return;
      }
      toast.success(
        `Đã xóa kết quả của ${deleteAttemptTarget.display_name}`
      );
      setDeleteAttemptTarget(null);
      await loadMonthAndDate(calendar.year, calendar.month, selectedDate);
    } finally {
      setBusy(false);
    }
  };

  // Leading empty cells for the calendar grid
  const firstDayOfWeek = new Date(
    Date.UTC(calendar.year, calendar.month - 1, 1)
  ).getUTCDay();

  return (
    <div className="space-y-5">
      {/* Upcoming Missing Days Warning Banner */}
      {calendar.upcomingMissingDates.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">
                Cảnh báo: Còn {calendar.upcomingMissingDates.length} ngày chưa gán đề trong 7 ngày tới (UTC+7)
              </p>
              <p className="mt-0.5">
                Các ngày trống:{" "}
                <strong className="font-mono">
                  {calendar.upcomingMissingDates.join(", ")}
                </strong>
              </p>
            </div>
          </div>
          <Button type="button" size="sm" disabled={busy} onClick={handleAutoFill}>
            <Sparkles className="h-3.5 w-3.5" />
            Tự động gán 7 ngày trống
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Tuyệt vời! Toàn bộ 7 ngày sắp tới (UTC+7) đều đã được gán Đề thi mỗi ngày.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Monthly Calendar Grid */}
        <Card className="p-5 lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Tháng {calendar.month}/{calendar.year} (Giờ Việt Nam UTC+7)
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => switchMonth(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  const [y, m] = calendar.vnToday.split("-").map(Number);
                  void loadMonthAndDate(y, m, calendar.vnToday);
                }}
              >
                Hôm nay
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => switchMonth(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-slate-500">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`pad-${i}`} className="h-20 rounded-xl bg-slate-50/40 dark:bg-slate-900/20" />
            ))}
            {calendar.dates.map((dateStr) => {
              const sched = calendar.scheduleByDate[dateStr];
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === calendar.vnToday;
              const isFutureOrToday = dateStr >= calendar.vnToday;
              const dayNum = Number(dateStr.slice(-2));

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() =>
                    void loadMonthAndDate(calendar.year, calendar.month, dateStr)
                  }
                  className={`flex h-20 flex-col justify-between rounded-xl border p-2 text-left transition cursor-pointer ${
                    isSelected
                      ? "border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30"
                      : sched
                      ? "border-emerald-200 bg-white hover:border-emerald-400 dark:border-emerald-900/60 dark:bg-slate-950"
                      : isFutureOrToday
                      ? "border-amber-200 bg-amber-50/40 hover:border-amber-400 dark:border-amber-900/50 dark:bg-amber-950/20"
                      : "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? "rounded-md bg-emerald-600 px-1.5 py-0.5 text-white"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {dayNum}
                    </span>
                    {sched ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : isFutureOrToday ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    {sched ? (
                      <>
                        <p className="truncate text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                          {sched.title_vi}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {sched.attempt_count} lượt
                          {sched.anomalous_count > 0 ? (
                            <span className="ml-1 font-bold text-red-500">
                              · {sched.anomalous_count}!
                            </span>
                          ) : null}
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        {isFutureOrToday ? "Chưa có đề" : "—"}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Right Side: Day Scheduler + Leaderboard Moderation */}
        <div className="lg:col-span-5 space-y-5">
          {/* Assign Test Form */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Cấu hình ngày <span className="font-mono text-emerald-700 dark:text-emerald-400">{selectedDate}</span>
              </h2>
              {activeSchedule && (
                <Badge variant="default">Đã gán đề</Badge>
              )}
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Chọn đề thi nguồn (lấy Section/Part 1 làm đề 15 phút)
                </label>
                <select
                  value={chosenTestId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setChosenTestId(nextId);
                    const found = calendar.eligibleTests.find((t) => t.id === nextId);
                    if (found && !customTitleVi) {
                      setCustomTitleVi(found.title_vi);
                    }
                  }}
                  aria-label="Chọn đề thi cho ngày"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  {calendar.eligibleTests.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.skill.toUpperCase()}] {t.title_vi} ({t.firstSectionCount} câu)
                      {!t.is_published ? " [NHÁP]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Tiêu đề hiển thị (tùy chọn)
                </label>
                <input
                  type="text"
                  value={customTitleVi}
                  onChange={(e) => setCustomTitleVi(e.target.value)}
                  placeholder="Để trống sẽ tự lấy tiêu đề của đề thi"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Thời gian làm bài (phút)
                </label>
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(Math.max(5, Math.min(60, Number(e.target.value) || 15)))
                  }
                  className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button type="submit" size="sm" disabled={saving}>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Đang lưu..." : "Lưu lịch ngày này"}
                </Button>
                {activeSchedule && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRemoveScheduleDate(selectedDate)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Gỡ lịch
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* Leaderboard Moderation */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                <Trophy className="h-4 w-4 text-amber-500" />
                Bảng xếp hạng ngày {selectedDate} ({attempts.length})
              </h2>
            </div>

            {attempts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500 dark:border-slate-800">
                Chưa có lượt nộp bài nào cho ngày {selectedDate}.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
                {attempts.map((a, idx) => (
                  <div
                    key={a.id}
                    className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${
                      !a.is_completed ? "opacity-50" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        <span className="truncate font-bold text-slate-900 dark:text-white">
                          {a.display_name}
                        </span>
                        {!a.is_completed && (
                          <Badge variant="secondary">Đã ẩn</Badge>
                        )}
                        {a.is_anomalous && (
                          <span
                            title={a.anomaly_reason ?? "Bất thường"}
                            className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" /> Bất thường
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Điểm: <strong>{a.raw_score}</strong> · Thời gian:{" "}
                        <strong>{a.duration_seconds}s</strong>
                        {a.anomaly_reason ? ` · ${a.anomaly_reason}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleToggleAttempt(a)}
                        title={a.is_completed ? "Ẩn khỏi BXH" : "Hiện lại trên BXH"}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        {a.is_completed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteAttemptTarget(a)}
                        title="Xóa kết quả"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteAttemptTarget)}
        title="Xóa kết quả trên Bảng xếp hạng"
        description={`Xóa vĩnh viễn kết quả của "${deleteAttemptTarget?.display_name ?? ""}" (${deleteAttemptTarget?.raw_score ?? 0} điểm / ${deleteAttemptTarget?.duration_seconds ?? 0}s)?`}
        confirmLabel="Xóa kết quả"
        destructive
        loading={busy}
        onCancel={() => setDeleteAttemptTarget(null)}
        onConfirm={handleDeleteAttempt}
      />

      <ConfirmDialog
        open={Boolean(removeScheduleDate)}
        title="Gỡ lịch Đề thi mỗi ngày"
        description={`Gỡ lịch đã gán cho ngày ${removeScheduleDate ?? ""}? (Nếu ngày đó đã có lượt làm bài, các lượt nộp gắn với lịch này cũng sẽ bị gỡ theo).`}
        confirmLabel="Gỡ lịch"
        destructive
        loading={busy}
        onCancel={() => setRemoveScheduleDate(null)}
        onConfirm={handleRemoveSchedule}
      />
    </div>
  );
}
