import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { updateStore } from "@/lib/store";

const progressSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  completed: z.boolean(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const userId = user?.id ?? "demo-free-001";

  try {
    const body = await req.json();
    const parsed = progressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updated = updateStore((store) => {
      const course = store.courses.find((c) => c.id === parsed.data.courseId);
      if (!course) return null;

      let prog = store.course_progress.find(
        (p) => p.user_id === userId && p.course_id === course.id
      );
      if (!prog) {
        prog = {
          user_id: userId,
          course_id: course.id,
          completed_lesson_ids: [],
          progress_percent: 0,
          updated_at: new Date().toISOString(),
        };
        store.course_progress.push(prog);
      }

      const set = new Set(prog.completed_lesson_ids);
      if (parsed.data.completed) {
        set.add(parsed.data.lessonId);
      } else {
        set.delete(parsed.data.lessonId);
      }
      prog.completed_lesson_ids = [...set];
      prog.progress_percent = Math.round(
        (prog.completed_lesson_ids.length / Math.max(1, course.lessons.length)) * 100
      );
      prog.updated_at = new Date().toISOString();
      return prog;
    });

    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy khóa học." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, progress: updated });
  } catch {
    return NextResponse.json({ error: "Lỗi lưu tiến độ khóa học." }, { status: 500 });
  }
}
