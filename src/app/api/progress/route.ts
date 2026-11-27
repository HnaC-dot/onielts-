import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { verifySameOrigin } from "@/lib/admin-auth";
import { updateOwnProfile } from "@/lib/db";
import {
  clearUserLearningHistory,
  getUserProgressSummary,
} from "@/lib/progress-analytics";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const targetBandSchema = z.object({
  target_band: z
    .number()
    .min(4.0, "Mục tiêu tối thiểu là Band 4.0.")
    .max(9.0, "Mục tiêu tối đa là Band 9.0.")
    .refine((v) => Math.round(v * 2) === v * 2, "Mục tiêu phải theo bước 0.5 (VD 6.5, 7.0)."),
});

const clearHistorySchema = z.object({
  scope: z.enum(["all", "tests", "writing", "speaking", "daily"]).default("all"),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Vui lòng đăng nhập để xem tiến độ học tập." },
      { status: 401 }
    );
  }

  const rate = await checkRateLimit(
    `progress-get:${getRequestClientKey(req, user.id)}`,
    30,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Vui lòng thử lại sau ${rate.retryAfterSec} giây.` },
      { status: 429 }
    );
  }

  const summary = await getUserProgressSummary(user);
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const rate = await checkRateLimit(
    `progress-patch:${getRequestClientKey(req, user.id)}`,
    15,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = targetBandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Mục tiêu Band không hợp lệ." },
      { status: 400 }
    );
  }

  const updated = await updateOwnProfile(user.id, {
    full_name: user.full_name || "Học viên",
    target_band: parsed.data.target_band,
    current_band: user.current_band,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Không thể cập nhật mục tiêu Band." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, targetBand: updated.target_band },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  }

  const rate = await checkRateLimit(
    `progress-del:${getRequestClientKey(req, user.id)}`,
    5,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Vui lòng thử lại sau ${rate.retryAfterSec} giây.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = clearHistorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Phạm vi xóa lịch sử không hợp lệ." },
      { status: 400 }
    );
  }

  const res = await clearUserLearningHistory(user.id, parsed.data.scope);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
