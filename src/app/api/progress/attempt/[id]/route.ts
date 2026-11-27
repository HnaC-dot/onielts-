import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserAttemptReview } from "@/lib/progress-analytics";

export const dynamic = "force-dynamic";

const ALLOWED_KINDS = new Set(["test", "daily", "writing", "speaking"]);

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Vui lòng đăng nhập để xem lại bài làm." },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const rawKind = searchParams.get("kind") ?? "test";
  if (!ALLOWED_KINDS.has(rawKind)) {
    return NextResponse.json({ error: "Loại bài không hợp lệ." }, { status: 400 });
  }

  const review = await getUserAttemptReview(
    user.id,
    rawKind as "test" | "daily" | "writing" | "speaking",
    id
  );
  if (!review) {
    return NextResponse.json(
      { error: "Không tìm thấy bài làm hoặc bạn không có quyền xem." },
      { status: 404 }
    );
  }

  return NextResponse.json(review, {
    headers: { "Cache-Control": "no-store" },
  });
}
