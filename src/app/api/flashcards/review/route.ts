import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { updateStore } from "@/lib/store";
import { computeNextSm2 } from "@/lib/srs";

const reviewSchema = z.object({
  cardId: z.string().min(1),
  quality: z.union([z.literal(1), z.literal(3), z.literal(4), z.literal(5)]),
});

const deleteSchema = z.object({
  cardId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const userId = user?.id ?? "demo-free-001";

  try {
    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu ôn tập không hợp lệ." }, { status: 400 });
    }

    const updated = updateStore((store) => {
      const card = store.flashcards.find(
        (c) =>
          c.id === parsed.data.cardId &&
          (c.user_id === userId ||
            store.flashcard_sets.some((s) => s.id === c.set_id && s.is_public))
      );
      if (!card) return null;
      const next = computeNextSm2(card, parsed.data.quality);
      card.ease_factor = next.ease_factor;
      card.interval_days = next.interval_days;
      card.repetitions = next.repetitions;
      card.next_review_at = next.next_review_at;
      return card;
    });

    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy thẻ Flashcard." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, card: updated });
  } catch {
    return NextResponse.json({ error: "Lỗi cập nhật lịch ôn tập." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  const userId = user?.id ?? "demo-free-001";

  try {
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid cardId" }, { status: 400 });
    }

    const removed = updateStore((store) => {
      const before = store.flashcards.length;
      store.flashcards = store.flashcards.filter(
        (c) => !(c.id === parsed.data.cardId && (c.user_id === userId || user?.role === "admin"))
      );
      return store.flashcards.length < before;
    });

    return NextResponse.json({ ok: removed });
  } catch {
    return NextResponse.json({ error: "Lỗi xóa thẻ." }, { status: 500 });
  }
}
