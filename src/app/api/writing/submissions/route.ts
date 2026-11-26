import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  getUserWritingSubmissions,
  toggleWritingSubmissionPrivacy,
} from "@/lib/db";

const togglePrivacySchema = z.object({
  id: z.string().min(1),
  is_public: z.boolean(),
});

export async function GET() {
  const user = await getCurrentUser();
  const submissions = await getUserWritingSubmissions(
    user?.id ?? null,
    user?.role === "admin"
  );
  return NextResponse.json({ submissions });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (isSupabaseConfigured() && !user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = togglePrivacySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const updated = await toggleWritingSubmissionPrivacy(
      parsed.data.id,
      user?.id ?? null,
      user?.role === "admin",
      parsed.data.is_public
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Không tìm thấy bài viết thuộc quyền sở hữu của bạn." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, submission: updated });
  } catch {
    return NextResponse.json(
      { error: "Không thể cập nhật quyền riêng tư." },
      { status: 500 }
    );
  }
}
