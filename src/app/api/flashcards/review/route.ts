import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { deleteFlashcardItem, reviewFlashcardItem } from "@/lib/db";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";

const reviewSchema = z.object({
  cardId: z.string().min(1),
  quality: z.union([z.literal(1), z.literal(3), z.literal(4), z.literal(5)]),
});

const deleteSchema = z.object({
  cardId: z.string().min(1),
});

export async function POST(req: Request) {
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
    `fc-review:${getRequestClientKey(req, user?.id)}`,
    60,
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
    `fc-delete:${getRequestClientKey(req, user?.id)}`,
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
