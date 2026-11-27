import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { verifyBotProtection } from "@/lib/bot-protection";
import {
  createFeatureRequest,
  getFeatureRequests,
  voteFeatureRequest,
} from "@/lib/db";
import {
  checkRateLimit,
  getRequestClientKey,
  getRequestIp,
} from "@/lib/rate-limit";

const createSchema = z.object({
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().min(8).max(1000),
  turnstileToken: z.string().optional(),
  honeypot: z.string().optional(),
});

const voteSchema = z.object({
  id: z.string().min(1).max(120),
});

export async function GET() {
  const items = await getFeatureRequests();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();
  const rate = await checkRateLimit(
    `fr-post:${getRequestClientKey(req, user?.id)}`,
    5,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Bạn gửi quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Tiêu đề hoặc mô tả quá ngắn." },
        { status: 400 }
      );
    }

    const botCheck = await verifyBotProtection({
      turnstileToken: parsed.data.turnstileToken,
      honeypot: parsed.data.honeypot,
      remoteIp: getRequestIp(req),
    });
    if (!botCheck.passed) {
      return NextResponse.json(
        { error: botCheck.reason || "Xác minh chống bot không thành công." },
        { status: 400 }
      );
    }

    const item = await createFeatureRequest({
      userId: user?.id ?? null,
      email: user?.email ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
    });
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = await checkRateLimit(`fr-vote-burst:${clientKey}`, 15, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
    }

    // Deduplicate votes per client + feature request item for 24 hours
    const dedup = await checkRateLimit(
      `fr-vote:${clientKey}:${parsed.data.id}`,
      1,
      24 * 60 * 60_000
    );
    if (!dedup.allowed) {
      return NextResponse.json(
        { error: "Bạn đã bình chọn cho đề xuất này rồi." },
        { status: 429 }
      );
    }

    const updated = await voteFeatureRequest(parsed.data.id);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, item: updated });
  } catch {
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
