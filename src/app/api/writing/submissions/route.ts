import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  getUserWritingSubmissions,
  toggleWritingSubmissionPrivacy,
} from "@/lib/db";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";

const togglePrivacySchema = z.object({
  id: z.string().min(1),
  is_public: z.boolean(),
});

export async function GET() {
  const user = await getCurrentUser();
  // Always scope personal endpoint to caller's own submissions (never dump other users' private essays)
  const submissions = await getUserWritingSubmissions(user?.id ?? null, false);
  return NextResponse.json({ submissions });
}

export async function PATCH(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();
  if (isSupabaseConfigured() && !user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const rate = await checkRateLimit(
    `writing-privacy:${getRequestClientKey(req, user?.id)}`,
    30,
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
