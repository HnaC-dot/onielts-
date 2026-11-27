import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import {
  getBandConversionTables,
  getIeltsTestBySlug,
  saveTestAttempt,
} from "@/lib/db";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { gradeObjectiveTest } from "@/lib/test-grader";
import { getVietnamDateString } from "@/lib/utils";

const submitSchema = z.object({
  testSlug: z.string().min(1),
  answers: z.record(z.string(), z.string()),
  durationSeconds: z.number().min(0).max(7200),
});

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 }
    );
  }

  try {
    const user = await getCurrentUser();
    const rate = await checkRateLimit(
      `test-submit:${getRequestClientKey(req, user?.id)}`,
      20,
      60_000
    );
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Bạn nộp bài quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu nộp bài không hợp lệ" },
        { status: 400 }
      );
    }

    const isStaff = Boolean(
      user && (user.role === "admin" || user.role === "editor") && !user.is_locked
    );
    const [test, conversionTable] = await Promise.all([
      getIeltsTestBySlug(parsed.data.testSlug, isStaff),
      getBandConversionTables(),
    ]);

    if (!test) {
      return NextResponse.json({ error: "Không tìm thấy đề thi." }, { status: 404 });
    }

    const graded = gradeObjectiveTest(test, parsed.data.answers, conversionTable);
    const vnToday = getVietnamDateString();

    const attempt = await saveTestAttempt({
      userId: user?.id ?? null,
      test,
      answers: parsed.data.answers,
      rawScore: graded.rawScore,
      maxScore: graded.maxScore,
      bandScore: graded.bandScore ?? 0,
      breakdownByType: graded.breakdownByType,
      details: graded.details,
      durationSeconds: parsed.data.durationSeconds,
      vnToday,
    });

    return NextResponse.json({
      ok: true,
      attempt,
      graded,
      savedToAccount: Boolean(attempt),
    });
  } catch {
    return NextResponse.json({ error: "Lỗi chấm bài thi." }, { status: 500 });
  }
}
