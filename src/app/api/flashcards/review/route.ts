import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { deleteFlashcardItem, reviewFlashcardItem } from "@/lib/db";

const reviewSchema = z.object({
  cardId: z.string().min(1),
  quality: z.union([z.literal(1), z.literal(3), z.literal(4), z.literal(5)]),
});

const deleteSchema = z.object({
  cardId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (isSupabaseConfigured() && !user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu ôn tập không hợp lệ." },
        { status: 400 }
      );
    }

    const updated = await reviewFlashcardItem(
      user?.id ?? null,
      parsed.data.cardId,
      parsed.data.quality
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Không tìm thấy thẻ Flashcard." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, card: updated });
  } catch {
    return NextResponse.json({ error: "Lỗi cập nhật lịch ôn tập." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (isSupabaseConfigured() && !user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid cardId" }, { status: 400 });
    }

    const removed = await deleteFlashcardItem(
      user?.id ?? null,
      user?.role === "admin",
      parsed.data.cardId
    );
    return NextResponse.json({ ok: removed });
  } catch {
    return NextResponse.json({ error: "Lỗi xóa thẻ." }, { status: 500 });
  }
}
