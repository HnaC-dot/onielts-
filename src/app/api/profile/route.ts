import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { updateStore } from "@/lib/store";

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
      return NextResponse.json({ error: "Thông tin hồ sơ không hợp lệ." }, { status: 400 });
    }

    const updated = updateStore((store) => {
      const profile = store.profiles.find((p) => p.id === user.id);
      if (!profile) return null;
      profile.full_name = parsed.data.full_name;
      profile.target_band = parsed.data.target_band;
      if (parsed.data.current_band !== undefined) {
        profile.current_band = parsed.data.current_band;
      }
      return profile;
    });

    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, profile: updated });
  } catch {
    return NextResponse.json({ error: "Lỗi cập nhật hồ sơ." }, { status: 500 });
  }
}
