import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { toggleCourseLessonProgress } from "@/lib/db";

const progressSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  completed: z.boolean(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();

  try {
    const body = await req.json();
    const parsed = progressSchema.safeParse(body);
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
