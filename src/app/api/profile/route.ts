import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { updateOwnProfile } from "@/lib/db";

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  target_band: z.number().min(4).max(9),
  current_band: z.number().min(0).max(9).nullable().optional(),
});

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
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
