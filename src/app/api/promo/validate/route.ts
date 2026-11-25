import { NextResponse } from "next/server";
import { z } from "zod";
import { readStore } from "@/lib/store";

const schema = z.object({
  code: z.string().trim().min(2).max(40),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Mã giảm giá không hợp lệ." }, { status: 400 });
    }

    const codeUpper = parsed.data.code.toUpperCase();
    const store = readStore();
    const promo = store.promo_codes.find(
      (c) => c.code.toUpperCase() === codeUpper && c.is_active
    );
    if (!promo) {
      return NextResponse.json({ error: "Mã giảm giá không tồn tại hoặc đã ngừng áp dụng." }, { status: 404 });
    }
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Mã giảm giá đã hết hạn." }, { status: 400 });
    }
    if (promo.max_uses && promo.current_uses >= promo.max_uses) {
      return NextResponse.json({ error: "Mã giảm giá đã hết lượt sử dụng." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      promo: {
        code: promo.code,
        discount_percent: promo.discount_percent,
        max_discount_vnd: promo.max_discount_vnd ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Lỗi kiểm tra mã giảm giá." }, { status: 500 });
  }
}
