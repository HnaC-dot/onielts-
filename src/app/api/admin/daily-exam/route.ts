import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  autoFillDailyExamSchedule,
  deleteDailyExamSchedule,
  getDailyExamCalendarMonth,
  listDailyAttemptsForDate,
  upsertDailyExamSchedule,
} from "@/lib/cms-daily-exam";
import { getVietnamDateString } from "@/lib/utils";

export const dynamic = "force-dynamic";

const scheduleActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("schedule"),
    exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    test_id: z.string().min(1),
    title_vi: z.string().max(200).optional(),
    title_en: z.string().max(200).optional(),
    duration_seconds: z.coerce.number().int().min(300).max(3600).default(900),
  }),
  z.object({
    action: z.literal("auto_fill"),
    days: z.coerce.number().int().min(1).max(31).default(7),
  }),
]);

export async function GET(req: Request) {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const vnToday = getVietnamDateString();
  const [defaultY, defaultM] = vnToday.split("-").map(Number);

  const monthParam = searchParams.get("month") ?? "";
  let year = defaultY;
  let month = defaultM;
  if (/^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    if (y >= 2024 && y <= 2035 && m >= 1 && m <= 12) {
      year = y;
      month = m;
    }
  }

  const selectedDate = searchParams.get("date") ?? vnToday;
  const [calendar, attempts] = await Promise.all([
    getDailyExamCalendarMonth(year, month),
    /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
      ? listDailyAttemptsForDate(selectedDate)
      : Promise.resolve([]),
  ]);

  return NextResponse.json(
    { calendar, selectedDate, attempts },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  const parsed = scheduleActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu lịch đề mỗi ngày không hợp lệ.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.action === "auto_fill") {
    const res = await autoFillDailyExamSchedule(parsed.data.days, guard.user);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json(
      { ok: true, filledCount: res.filledCount },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const res = await upsertDailyExamSchedule(parsed.data, guard.user);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Thiếu ngày cần gỡ lịch (YYYY-MM-DD)." }, { status: 400 });
  }

  const res = await deleteDailyExamSchedule(date, guard.user);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
