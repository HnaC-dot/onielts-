import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { readStore, updateStore } from "@/lib/store";
import { gradeObjectiveTest } from "@/lib/test-grader";
import { getVietnamDateString } from "@/lib/utils";
import type { IeltsTest } from "@/lib/types";

const DAILY_DURATION_SECONDS = 900; // 15 minutes server-enforced

function getTodaysDailyTest(tests: IeltsTest[], vnDate: string): IeltsTest {
  const eligible = tests.filter(
    (t) => t.is_published && t.is_daily_eligible && (t.skill === "reading" || t.skill === "listening")
  );
  const pool = eligible.length > 0 ? eligible : tests.filter((t) => t.sections.length > 0);
  const dayNum = Number(vnDate.replace(/-/g, "")) || 1;
  return pool[dayNum % pool.length];
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({
    action: z.literal("submit"),
    answers: z.record(z.string(), z.string()),
  }),
]);

export async function GET() {
  const vnToday = getVietnamDateString();
  const user = await getCurrentUser();
  const store = readStore();
  const dailyTest = getTodaysDailyTest(store.ielts_tests, vnToday);

  const existingAttempt = user
    ? store.daily_exam_attempts.find(
        (a) => a.exam_date === vnToday && a.user_id === user.id
      ) ?? null
    : null;

  const leaderboard = store.daily_exam_attempts
    .filter((a) => a.exam_date === vnToday && a.is_completed)
    .sort((a, b) => b.raw_score - a.raw_score || a.duration_seconds - b.duration_seconds);

  return NextResponse.json({
    examDate: vnToday,
    timezone: "Asia/Ho_Chi_Minh",
    durationSeconds: DAILY_DURATION_SECONDS,
    test: dailyTest,
    attempt: existingAttempt,
    leaderboard,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Vui lòng đăng nhập để tham gia Đề thi mỗi ngày và ghi nhận bảng xếp hạng." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
    }

    const vnToday = getVietnamDateString();
    const store = readStore();
    const dailyTest = getTodaysDailyTest(store.ielts_tests, vnToday);

    if (parsed.data.action === "start") {
      const existing = store.daily_exam_attempts.find(
        (a) => a.exam_date === vnToday && a.user_id === user.id
      );
      if (existing) {
        if (existing.is_completed) {
          return NextResponse.json(
            { error: "Bạn đã hoàn thành Đề thi hôm nay rồi (mỗi ngày chỉ 1 lượt thi)." },
            { status: 409 }
          );
        }
        const elapsed = Math.floor(
          (Date.now() - new Date(existing.started_at).getTime()) / 1000
        );
        return NextResponse.json({
          ok: true,
          attempt: existing,
          remainingSeconds: Math.max(0, DAILY_DURATION_SECONDS - elapsed),
        });
      }

      const created = updateStore((draft) => {
        const record = {
          id: `daily-${vnToday}-${user.id}`,
          exam_date: vnToday,
          test_slug: dailyTest.slug,
          user_id: user.id,
          display_name: user.full_name,
          started_at: new Date().toISOString(),
          submitted_at: null,
          answers: {},
          raw_score: 0,
          max_score: dailyTest.sections.flatMap((s) => s.questions).length,
          band_score: 0,
          duration_seconds: 0,
          is_completed: false,
        };
        draft.daily_exam_attempts.unshift(record);
        return record;
      });

      return NextResponse.json({
        ok: true,
        attempt: created,
        remainingSeconds: DAILY_DURATION_SECONDS,
      });
    }

    // SUBMIT — server-side timing & 1 attempt per day enforcement
    const answers = parsed.data.answers;
    const result = updateStore((draft) => {
      let attempt = draft.daily_exam_attempts.find(
        (a) => a.exam_date === vnToday && a.user_id === user.id
      );
      if (attempt?.is_completed) {
        return { conflict: true as const };
      }

      const now = new Date();
      if (!attempt) {
        attempt = {
          id: `daily-${vnToday}-${user.id}`,
          exam_date: vnToday,
          test_slug: dailyTest.slug,
          user_id: user.id,
          display_name: user.full_name,
          started_at: new Date(now.getTime() - 60_000).toISOString(),
          submitted_at: null,
          answers: {},
          raw_score: 0,
          max_score: dailyTest.sections.flatMap((s) => s.questions).length,
          band_score: 0,
          duration_seconds: 60,
          is_completed: false,
        };
        draft.daily_exam_attempts.unshift(attempt);
      }

      // Server-side timing calculation
      const elapsedSec = Math.max(
        1,
        Math.min(
          DAILY_DURATION_SECONDS,
          Math.round((now.getTime() - new Date(attempt.started_at).getTime()) / 1000)
        )
      );

      const graded = gradeObjectiveTest(
        dailyTest,
        answers,
        draft.band_conversion_tables
      );

      attempt.answers = answers;
      attempt.raw_score = graded.rawScore;
      attempt.max_score = graded.maxScore;
      attempt.band_score = graded.bandScore;
      attempt.duration_seconds = elapsedSec;
      attempt.submitted_at = now.toISOString();
      attempt.is_completed = true;

      const profile = draft.profiles.find((p) => p.id === user.id);
      if (profile && profile.last_active_date !== vnToday) {
        profile.streak_count += 1;
        profile.last_active_date = vnToday;
      }

      return { conflict: false as const, attempt, graded };
    });

    if (result.conflict) {
      return NextResponse.json(
        { error: "Mỗi tài khoản chỉ được nộp Đề thi mỗi ngày 1 lần." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      attempt: result.attempt,
      graded: result.graded,
    });
  } catch {
    return NextResponse.json({ error: "Lỗi xử lý Đề thi mỗi ngày." }, { status: 500 });
  }
}
