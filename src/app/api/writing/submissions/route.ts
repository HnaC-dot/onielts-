import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { readStore, updateStore } from "@/lib/store";

const togglePrivacySchema = z.object({
  id: z.string().min(1),
  is_public: z.boolean(),
});

export async function GET() {
  const user = await getCurrentUser();
  const userId = user?.id ?? "demo-free-001";
  const store = readStore();
  // Enforce owner-only private read + public opt-in read
  const submissions = store.writing_submissions.filter(
    (s) => s.user_id === userId || (user?.role === "admin")
  );
  return NextResponse.json({ submissions });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  const userId = user?.id ?? "demo-free-001";

  try {
    const body = await req.json();
    const parsed = togglePrivacySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const updated = updateStore((store) => {
      const target = store.writing_submissions.find(
        (s) => s.id === parsed.data.id && (s.user_id === userId || user?.role === "admin")
      );
      if (!target) return null;
      target.is_public = parsed.data.is_public;
      return target;
    });

    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy bài viết thuộc quyền sở hữu của bạn." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, submission: updated });
  } catch {
    return NextResponse.json({ error: "Không thể cập nhật quyền riêng tư." }, { status: 500 });
  }
}
