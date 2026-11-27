import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { findOrderByCodeForUser, fulfillPaidOrderIdempotent } from "@/lib/db";
import { isPayosSandboxAllowed } from "@/lib/payments/payos";

const schema = z.object({
  orderCode: z.number().int().positive(),
});

/**
 * Local-development ONLY sandbox webhook simulator.
 * Strictly blocked (403) in production and whenever live PayOS keys exist.
 */
export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }

  if (!isPayosSandboxAllowed()) {
    return NextResponse.json(
      { error: "Chế độ mô phỏng thanh toán bị khóa ở môi trường Production." },
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

    const order = await findOrderByCodeForUser(parsed.data.orderCode, user.id);
    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    }

    const result = await fulfillPaidOrderIdempotent({
      orderCode: order.order_code,
      amountVnd: order.amount_vnd,
      eventId: `SANDBOX-${order.order_code}`,
    });

    return NextResponse.json(result, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Lỗi mô phỏng webhook." }, { status: 500 });
  }
}
