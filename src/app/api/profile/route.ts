import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/admin-auth";
import { readJsonBody } from "@/lib/request-json";
import { getCurrentUser } from "@/lib/auth";
import { updateOwnProfile } from "@/lib/db";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  target_band: z.number().min(4).max(9),
  current_band: z.number().min(0).max(9).nullable().optional(),
});

export async function PATCH(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const rate = await checkRateLimit(
    `profile:${getRequestClientKey(req, user.id)}`,
    15,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Bạn cập nhật hồ sơ quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.`,
      },
      { status: 429 }
    );
  }

  try {
    const jsonResult = await readJsonBody(req);
    if (!jsonResult.ok) return jsonResult.response;
    const parsed = updateProfileSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Thông tin hồ sơ không hợp lệ." },
        { status: 400 }
      );
    }

    const updated = await updateOwnProfile(user.id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, profile: updated });
  } catch {
    return NextResponse.json({ error: "Lỗi cập nhật hồ sơ." }, { status: 500 });
  }
}
