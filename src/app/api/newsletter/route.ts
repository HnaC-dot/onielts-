import { NextResponse } from "next/server";
import { verifySameOrigin } from "@/lib/admin-auth";
import { verifyBotProtection } from "@/lib/bot-protection";
import { subscribeNewsletterEmail } from "@/lib/cms-content-production";
import {
  checkRateLimit,
  getRequestClientKey,
  getRequestIp,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }

  const clientKey = `newsletter:${getRequestClientKey(req)}`;
  const rl = await checkRateLimit(clientKey, 8, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${rl.retryAfterSec} giây.`,
      },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dữ liệu đăng ký không hợp lệ." }, { status: 400 });
  }

  const rawBody = body as Record<string, unknown>;
  const botCheck = await verifyBotProtection({
    turnstileToken:
      typeof rawBody.turnstileToken === "string" ? rawBody.turnstileToken : undefined,
    honeypot: typeof rawBody.honeypot === "string" ? rawBody.honeypot : undefined,
    remoteIp: getRequestIp(req),
  });
  if (!botCheck.passed) {
    return NextResponse.json(
      { error: botCheck.reason || "Xác minh chống bot không thành công." },
      { status: 400 }
    );
  }

  const res = await subscribeNewsletterEmail(body);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json(
    {
      ok: true,
      alreadySubscribed: res.alreadySubscribed,
      message: res.alreadySubscribed
        ? "Email này đã đăng ký nhận bài viết mới từ Ôn IELTS."
        : "Đăng ký thành công! Bạn sẽ nhận được mẹo thi & bài viết IELTS mới nhất.",
    },
    { status: res.alreadySubscribed ? 200 : 201 }
  );
}
