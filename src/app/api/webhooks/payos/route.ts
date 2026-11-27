import { NextResponse } from "next/server";
import { processVerifiedPayosWebhook } from "@/lib/payments/process-webhook";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json(
        { ok: false, message: "Payload webhook không hợp lệ." },
        { status: 400 }
      );
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Payload webhook không phải JSON hợp lệ." },
      { status: 400 }
    );
  }

  try {
    const signature = String(
      body.signature ?? req.headers.get("x-payos-signature") ?? ""
    );

    const result = await processVerifiedPayosWebhook(body, signature);
    return NextResponse.json(result, { status: result.status });
  } catch (err) {
    console.error("[webhook.payos] unexpected processing error", {
      message: err instanceof Error ? err.message : "unknown_error",
    });
    return NextResponse.json(
      { ok: false, message: "Lỗi hệ thống tạm thời khi xử lý webhook PayOS." },
      { status: 500 }
    );
  }
}
