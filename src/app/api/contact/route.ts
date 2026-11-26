import { NextResponse } from "next/server";
import { z } from "zod";
import { createContactMessage } from "@/lib/db";
import { verifyBotProtection } from "@/lib/bot-protection";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(2000),
  turnstileToken: z.string().optional(),
  honeypot: z.string().optional(),
});

export async function POST(req: Request) {
  const rate = await checkRateLimit(getRequestClientKey(req), 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Vui lòng thử lại sau ít phút." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ thông tin hợp lệ." },
        { status: 400 }
      );
    }
    const botCheck = await verifyBotProtection({
      turnstileToken: parsed.data.turnstileToken,
      honeypot: parsed.data.honeypot,
    });
    if (!botCheck.passed) {
      return NextResponse.json(
        { error: botCheck.reason || "Xác minh chống bot không thành công." },
        { status: 400 }
      );
    }
    const item = await createContactMessage({
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
    });
    return NextResponse.json({ ok: true, id: item.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Không thể gửi liên hệ." }, { status: 500 });
  }
}
