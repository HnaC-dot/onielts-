import { NextResponse } from "next/server";
import { processVerifiedPayosWebhook } from "@/lib/payments/process-webhook";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const signature =
      String(body.signature ?? req.headers.get("x-payos-signature") ?? "");

    const result = processVerifiedPayosWebhook(body, signature);
    return NextResponse.json(result, { status: result.status });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Payload webhook không hợp lệ." },
      { status: 400 }
    );
  }
}
