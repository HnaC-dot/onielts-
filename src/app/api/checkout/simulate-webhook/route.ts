import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { isPayosConfigured, signPayosData } from "@/lib/payments/payos";
import { processVerifiedPayosWebhook } from "@/lib/payments/process-webhook";

const schema = z.object({
  orderCode: z.number().int().positive(),
});

/**
 * Sandbox-only helper to test the full HMAC-signed PayOS webhook flow when
 * live production PayOS keys are absent or PAYOS_SANDBOX !== "false".
 */
export async function POST(req: Request) {
  if (isPayosConfigured() && process.env.PAYOS_SANDBOX === "false") {
    return NextResponse.json(
      { error: "Chế độ mô phỏng bị tắt ở môi trường Production." },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Mã đơn hàng không hợp lệ." }, { status: 400 });
    }

    const store = readStore();
    const order = store.orders.find(
      (o) => o.order_code === parsed.data.orderCode && o.user_id === user.id
    );
    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    const webhookData = {
      orderCode: order.order_code,
      amount: order.amount_vnd,
      code: "00",
      desc: "Sandbox VietQR transfer completed",
      reference: `SANDBOX-${order.order_code}`,
    };
    const signature = signPayosData(webhookData);
    const result = processVerifiedPayosWebhook(
      { code: "00", data: webhookData, signature },
      signature
    );

    return NextResponse.json(result, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Lỗi mô phỏng webhook." }, { status: 500 });
  }
}
