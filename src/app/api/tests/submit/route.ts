import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  getBandConversionTables,
  getIeltsTestBySlug,
  saveTestAttempt,
} from "@/lib/db";
import { gradeObjectiveTest } from "@/lib/test-grader";
import { getVietnamDateString } from "@/lib/utils";

const submitSchema = z.object({
  testSlug: z.string().min(1),
  answers: z.record(z.string(), z.string()),
  durationSeconds: z.number().min(0).max(7200),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu nộp bài không hợp lệ" },
        { status: 400 }
      );
    }

    const [user, test, conversionTable] = await Promise.all([
      getCurrentUser(),
      getIeltsTestBySlug(parsed.data.testSlug),
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
