import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { readStore, updateStore } from "@/lib/store";
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
      return NextResponse.json({ error: "Dữ liệu nộp bài không hợp lệ" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const store = readStore();
    const test = store.ielts_tests.find((t) => t.slug === parsed.data.testSlug);
    if (!test) {
      return NextResponse.json({ error: "Không tìm thấy đề thi." }, { status: 404 });
    }

    const graded = gradeObjectiveTest(
      test,
      parsed.data.answers,
      store.band_conversion_tables
    );

    const userId = user?.id ?? "demo-free-001";
    const vnToday = getVietnamDateString();

    const attempt = updateStore((draft) => {
      const record = {
        id: `att-${Date.now()}`,
        user_id: userId,
        test_id: test.id,
        test_slug: test.slug,
        test_title: test.title_vi,
        skill: test.skill,
        answers: parsed.data.answers,
        raw_score: graded.rawScore,
        max_score: graded.maxScore,
        band_score: graded.bandScore,
        breakdown_by_type: graded.breakdownByType,
        duration_seconds: parsed.data.durationSeconds,
        completed_at: new Date().toISOString(),
      };
      draft.test_attempts.unshift(record);

      const profile = draft.profiles.find((p) => p.id === userId);
      if (profile && profile.last_active_date !== vnToday) {
        profile.streak_count += 1;
        profile.last_active_date = vnToday;
      }
      return record;
    });

    return NextResponse.json({
      ok: true,
      attempt,
      graded,
    });
  } catch {
    return NextResponse.json({ error: "Lỗi chấm bài thi." }, { status: 500 });
  }
}
