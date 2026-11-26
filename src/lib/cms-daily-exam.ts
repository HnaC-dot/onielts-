import "server-only";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { recordAuditLog } from "./admin-auth";
import { getIeltsTests } from "./db";
import { getVietnamDateString } from "./utils";
import type { SessionUser } from "./types";

export interface DailyExamScheduleEntry {
  id: string;
  exam_date: string; // YYYY-MM-DD (UTC+7)
  test_id: string;
  test_slug: string;
  title_vi: string;
  title_en: string;
  duration_seconds: number;
  attempt_count: number;
  anomalous_count: number;
}

export interface AdminDailyAttemptRow {
  id: string;
  daily_exam_id: string;
  exam_date: string;
  user_id: string;
  display_name: string;
  raw_score: number;
  band_score: number;
  duration_seconds: number;
  is_completed: boolean;
  submitted_at: string | null;
  started_at: string;
  is_anomalous: boolean;
  anomaly_reason: string | null;
}

const localSchedules = new Map<string, DailyExamScheduleEntry>();

export function detectAttemptAnomaly(row: {
  raw_score: number;
  duration_seconds: number;
}): { isAnomalous: boolean; reason: string | null } {
  if (row.duration_seconds <= 15 && row.raw_score >= 3) {
    return {
      isAnomalous: true,
      reason: `Thời gian làm quá ngắn (${row.duration_seconds}s cho ${row.raw_score} câu đúng)`,
    };
  }
  if (row.duration_seconds < 45 && row.raw_score >= 8) {
    return {
      isAnomalous: true,
      reason: `Điểm cao bất thường (${row.raw_score} câu đúng trong ${row.duration_seconds}s)`,
    };
  }
  if (row.duration_seconds < 0 || row.duration_seconds > 3600) {
    return {
      isAnomalous: true,
      reason: `Thời lượng không hợp lệ (${row.duration_seconds}s)`,
    };
  }
  return { isAnomalous: false, reason: null };
}

function getMonthDates(year: number, month: number): string[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    out.push(`${year}-${mm}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

function revalidateDailyRoutes() {
  try {
    revalidatePath("/");
    revalidatePath("/daily-exam");
    revalidatePath("/leaderboard");
    revalidatePath("/admin");
    revalidatePath("/admin/daily-exam");
  } catch {
    // ignore outside Next request context
  }
}

export async function getDailyExamCalendarMonth(year: number, month: number) {
  const vnToday = getVietnamDateString();
  const dates = getMonthDates(year, month);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const allTests = await getIeltsTests(true);
  const eligibleTests = allTests.filter(
    (t) =>
      (t.skill === "reading" || t.skill === "listening") &&
      t.sections.length > 0 &&
      t.sections[0].questions.length > 0
  );
  const testMap = new Map(allTests.map((t) => [t.id, t]));

  const scheduleByDate: Record<string, DailyExamScheduleEntry> = {};

  if (!isSupabaseConfigured()) {
    for (const d of dates) {
      const s = localSchedules.get(d);
      if (s) scheduleByDate[d] = s;
    }
  } else {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data: rows } = await admin
        .from("daily_exams")
        .select("*")
        .gte("exam_date", startDate)
        .lte("exam_date", endDate)
        .order("exam_date", { ascending: true });

      const examIds = (rows ?? []).map((r) => String(r.id));
      const attemptStats = new Map<string, { total: number; anomalous: number }>();

      if (examIds.length > 0) {
        const { data: attempts } = await admin
          .from("daily_exam_attempts")
          .select("daily_exam_id, raw_score, duration_seconds, is_completed")
          .in("daily_exam_id", examIds);

        for (const a of attempts ?? []) {
          const eid = String(a.daily_exam_id);
          const cur = attemptStats.get(eid) ?? { total: 0, anomalous: 0 };
          cur.total += 1;
          const check = detectAttemptAnomaly({
            raw_score: Number(a.raw_score ?? 0),
            duration_seconds: Number(a.duration_seconds ?? 0),
          });
          if (check.isAnomalous) cur.anomalous += 1;
          attemptStats.set(eid, cur);
        }
      }

      for (const r of rows ?? []) {
        const examDate = String(r.exam_date).slice(0, 10);
        const testId = String(r.test_id);
        const matched = testMap.get(testId);
        const stats = attemptStats.get(String(r.id)) ?? { total: 0, anomalous: 0 };
        scheduleByDate[examDate] = {
          id: String(r.id),
          exam_date: examDate,
          test_id: testId,
          test_slug: matched?.slug ?? "",
          title_vi: String(r.title_vi ?? matched?.title_vi ?? ""),
          title_en: String(r.title_en ?? matched?.title_en ?? ""),
          duration_seconds: Number(r.duration_seconds ?? 900),
          attempt_count: stats.total,
          anomalous_count: stats.anomalous,
        };
      }
    }
  }

  // Compute upcoming 7-day warning list (starting from vnToday)
  const upcomingMissingDates: string[] = [];
  const todayDate = new Date(`${vnToday}T00:00:00Z`);
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(todayDate.getTime() + offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    if (d >= startDate && d <= endDate && !scheduleByDate[d]) {
      upcomingMissingDates.push(d);
    }
  }

  const missingInMonthCount = dates.filter(
    (d) => d >= vnToday && !scheduleByDate[d]
  ).length;

  return {
    year,
    month,
    vnToday,
    dates,
    scheduleByDate,
    missingInMonthCount,
    upcomingMissingDates,
    eligibleTests: eligibleTests.map((t) => ({
      id: t.id,
      slug: t.slug,
      skill: t.skill,
      module: t.module,
      title_vi: t.title_vi,
      title_en: t.title_en,
      is_published: t.is_published,
      firstSectionCount: t.sections[0]?.questions.length ?? 0,
    })),
  };
}

export async function listDailyAttemptsForDate(
  examDate: string
): Promise<AdminDailyAttemptRow[]> {
  if (!isSupabaseConfigured()) return [];
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data: exam } = await admin
    .from("daily_exams")
    .select("id")
    .eq("exam_date", examDate)
    .maybeSingle();

  if (!exam?.id) return [];

  const { data: rows } = await admin
    .from("daily_exam_attempts")
    .select("*")
    .eq("daily_exam_id", exam.id)
    .order("raw_score", { ascending: false })
    .order("duration_seconds", { ascending: true })
    .limit(200);

  return (rows ?? []).map((r) => {
    const rawScore = Number(r.raw_score ?? 0);
    const durationSec = Number(r.duration_seconds ?? 0);
    const check = detectAttemptAnomaly({
      raw_score: rawScore,
      duration_seconds: durationSec,
    });
    return {
      id: String(r.id),
      daily_exam_id: String(r.daily_exam_id),
      exam_date: examDate,
      user_id: String(r.user_id),
      display_name: String(r.display_name ?? "Học viên"),
      raw_score: rawScore,
      band_score: Number(r.band_score ?? 0),
      duration_seconds: durationSec,
      is_completed: Boolean(r.is_completed),
      submitted_at: r.submitted_at ? String(r.submitted_at) : null,
      started_at: String(r.started_at),
      is_anomalous: check.isAnomalous,
      anomaly_reason: check.reason,
    };
  });
}

export async function upsertDailyExamSchedule(
  params: {
    exam_date: string;
    test_id: string;
    title_vi?: string;
    title_en?: string;
    duration_seconds?: number;
  },
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.exam_date)) {
    return { ok: false, status: 400, error: "Định dạng ngày phải là YYYY-MM-DD." };
  }

  const tests = await getIeltsTests(true);
  const chosen = tests.find((t) => t.id === params.test_id);
  if (!chosen) {
    return { ok: false, status: 404, error: "Không tìm thấy đề thi đã chọn." };
  }

  const titleVi = (params.title_vi ?? "").trim() || chosen.title_vi;
  const titleEn = (params.title_en ?? "").trim() || chosen.title_en || titleVi;
  const durationSec = Math.min(3600, Math.max(300, params.duration_seconds ?? 900));

  if (!isSupabaseConfigured()) {
    localSchedules.set(params.exam_date, {
      id: `daily-${params.exam_date}`,
      exam_date: params.exam_date,
      test_id: chosen.id,
      test_slug: chosen.slug,
      title_vi: titleVi,
      title_en: titleEn,
      duration_seconds: durationSec,
      attempt_count: 0,
      anomalous_count: 0,
    });
    await recordAuditLog({
      actor,
      action: "schedule_daily_exam",
      entityType: "daily_exam",
      entityId: params.exam_date,
      entityLabel: params.exam_date,
      summary: `Gán đề "${titleVi}" cho ngày ${params.exam_date} (UTC+7)`,
    });
    revalidateDailyRoutes();
    return { ok: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  const { error } = await admin.from("daily_exams").upsert(
    {
      exam_date: params.exam_date,
      test_id: chosen.id,
      title_vi: titleVi,
      title_en: titleEn,
      duration_seconds: durationSec,
    },
    { onConflict: "exam_date" }
  );

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "schedule_daily_exam",
    entityType: "daily_exam",
    entityId: params.exam_date,
    entityLabel: `${params.exam_date} — ${titleVi}`,
    summary: `Gán đề "${titleVi}" (${Math.round(durationSec / 60)} phút) cho ngày ${params.exam_date} (UTC+7)`,
  });
  revalidateDailyRoutes();
  return { ok: true };
}

export async function autoFillDailyExamSchedule(
  days: number,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<{ ok: true; filledCount: number } | { ok: false; status: number; error: string }> {
  const vnToday = getVietnamDateString();
  const tests = (await getIeltsTests(false)).filter(
    (t) =>
      (t.skill === "reading" || t.skill === "listening") &&
      t.sections.length > 0 &&
      t.sections[0].questions.length > 0
  );
  if (tests.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Không có đề Reading/Listening nào đã xuất bản để gán tự động.",
    };
  }

  const safeDays = Math.min(31, Math.max(1, days));
  const baseDate = new Date(`${vnToday}T00:00:00Z`);
  const targetDates: string[] = [];
  for (let i = 0; i < safeDays; i++) {
    targetDates.push(
      new Date(baseDate.getTime() + i * 86_400_000).toISOString().slice(0, 10)
    );
  }

  let existingSet = new Set<string>();
  if (isSupabaseConfigured()) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
    }
    const { data } = await admin
      .from("daily_exams")
      .select("exam_date")
      .in("exam_date", targetDates);
    existingSet = new Set((data ?? []).map((r) => String(r.exam_date).slice(0, 10)));
  } else {
    existingSet = new Set(Array.from(localSchedules.keys()));
  }

  let filledCount = 0;
  for (let i = 0; i < targetDates.length; i++) {
    const d = targetDates[i];
    if (existingSet.has(d)) continue;
    const pick = tests[i % tests.length];
    const res = await upsertDailyExamSchedule(
      {
        exam_date: d,
        test_id: pick.id,
        title_vi: pick.title_vi,
        title_en: pick.title_en,
        duration_seconds: 900,
      },
      actor
    );
    if (res.ok) filledCount += 1;
  }

  return { ok: true, filledCount };
}

export async function deleteDailyExamSchedule(
  examDate: string,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isSupabaseConfigured()) {
    localSchedules.delete(examDate);
    revalidateDailyRoutes();
    return { ok: true };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };

  const { error } = await admin
    .from("daily_exams")
    .delete()
    .eq("exam_date", examDate);
  if (error) return { ok: false, status: 500, error: error.message };

  await recordAuditLog({
    actor,
    action: "delete_daily_exam_schedule",
    entityType: "daily_exam",
    entityId: examDate,
    entityLabel: examDate,
    summary: `Gỡ lịch Đề thi mỗi ngày cho ngày ${examDate}`,
  });
  revalidateDailyRoutes();
  return { ok: true };
}

export async function moderateDailyAttempt(params: {
  attemptId: string;
  action: "hide" | "show" | "delete";
  actor: Pick<SessionUser, "id" | "email" | "role">;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isSupabaseConfigured()) {
    revalidateDailyRoutes();
    return { ok: true };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };

  const { data: existing } = await admin
    .from("daily_exam_attempts")
    .select("id, display_name, raw_score, duration_seconds")
    .eq("id", params.attemptId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, status: 404, error: "Không tìm thấy kết quả trên bảng xếp hạng." };
  }

  if (params.action === "delete") {
    const { error } = await admin
      .from("daily_exam_attempts")
      .delete()
      .eq("id", params.attemptId);
    if (error) return { ok: false, status: 500, error: error.message };
  } else {
    const { error } = await admin
      .from("daily_exam_attempts")
      .update({ is_completed: params.action === "show" })
      .eq("id", params.attemptId);
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor: params.actor,
    action: `daily_attempt_${params.action}`,
    entityType: "daily_exam_attempt",
    entityId: params.attemptId,
    entityLabel: String(existing.display_name ?? "Học viên"),
    summary:
      params.action === "delete"
        ? `Xóa kết quả bất thường của ${existing.display_name} (${existing.raw_score} điểm / ${existing.duration_seconds}s)`
        : params.action === "hide"
        ? `Ẩn kết quả của ${existing.display_name} khỏi Bảng xếp hạng`
        : `Hiện lại kết quả của ${existing.display_name} trên Bảng xếp hạng`,
  });

  revalidateDailyRoutes();
  return { ok: true };
}
