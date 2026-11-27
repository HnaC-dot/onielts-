import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/admin-auth";
import { readJsonBody } from "@/lib/request-json";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { toggleCourseLessonProgress } from "@/lib/db";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";

const progressSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  completed: z.boolean(),
});

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();
  const rate = await checkRateLimit(
    `course-progress:${getRequestClientKey(req, user?.id)}`,
    60,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.`,
      },
      { status: 429 }
    );
  }

  try {
    const jsonResult = await readJsonBody(req);
    if (!jsonResult.ok) return jsonResult.response;
    const parsed = progressSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (isSupabaseConfigured() && !user) {
      return NextResponse.json({ ok: true, persisted: false });
    }

    const updated = await toggleCourseLessonProgress({
      userId: user?.id ?? null,
      courseId: parsed.data.courseId,
      lessonId: parsed.data.lessonId,
      completed: parsed.data.completed,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Không tìm thấy khóa học." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, persisted: true, progress: updated });
  } catch {
    return NextResponse.json({ error: "Lỗi lưu tiến độ khóa học." }, { status: 500 });
  }
}
