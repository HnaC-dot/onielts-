import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  completeDailyExamAttempt,
  getBandConversionTables,
  getDailyExamState,
  startDailyExamAttempt,
} from "@/lib/db";
import { gradeObjectiveTest } from "@/lib/test-grader";
import { getVietnamDateString } from "@/lib/utils";

const DAILY_DURATION_SECONDS = 900; // 15 minutes server-enforced

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
  const { dailyTest, existingAttempt, leaderboard } = await getDailyExamState(
    vnToday,
    user?.id ?? null
  );

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
      {
        error:
          "Vui lòng đăng nhập để tham gia Đề thi mỗi ngày và ghi nhận bảng xếp hạng.",
      },
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
    const { dailyTest } = await getDailyExamState(vnToday, user.id);

    if (parsed.data.action === "start") {
      const started = await startDailyExamAttempt({
        vnDate: vnToday,
        dailyTest,
        userId: user.id,
        displayName: user.full_name,
        durationSeconds: DAILY_DURATION_SECONDS,
      });

      if (started.conflict) {
        return NextResponse.json(
          {
            error:
              "Bạn đã hoàn thành Đề thi hôm nay rồi (mỗi ngày chỉ 1 lượt thi).",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        ok: true,
        attempt: started.attempt,
        remainingSeconds: started.remainingSeconds,
      });
    }

    // SUBMIT — server-side timing & 1 attempt per day enforcement
    const conversionTable = await getBandConversionTables();
    const graded = gradeObjectiveTest(
      dailyTest,
      parsed.data.answers,
      conversionTable
    );

    const result = await completeDailyExamAttempt({
      vnDate: vnToday,
      dailyTest,
      userId: user.id,
      displayName: user.full_name,
      answers: parsed.data.answers,
      rawScore: graded.rawScore,
      maxScore: graded.maxScore,
      bandScore: graded.bandScore ?? 0,
      durationSecondsLimit: DAILY_DURATION_SECONDS,
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
      graded,
    });
  } catch {
    return NextResponse.json(
      { error: "Lỗi xử lý Đề thi mỗi ngày." },
      { status: 500 }
    );
  }
}
