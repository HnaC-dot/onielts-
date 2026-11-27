import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/admin-auth";
import { readJsonBody } from "@/lib/request-json";
import { getCurrentUser } from "@/lib/auth";
import {
  attachOrderCheckoutDetails,
  cancelPendingOrder,
  createCheckoutOrderAtomic,
  getPricingPlans,
} from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import { isPayosSandboxAllowed } from "@/lib/payments/payos";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";

const checkoutSchema = z.object({
  planSlug: z.string().min(1).max(60),
  promoCode: z.string().trim().max(40).optional(),
  provider: z.enum(["payos", "vnpay", "momo", "stripe"]).optional().default("payos"),
});

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Vui lòng đăng nhập trước khi thanh toán gói Premium." },
      { status: 401 }
    );
  }

  const rate = await checkRateLimit(
    `checkout:${getRequestClientKey(req, user.id)}`,
    10,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Bạn tạo quá nhiều yêu cầu thanh toán. Vui lòng thử lại sau ${rate.retryAfterSec} giây.`,
      },
      { status: 429 }
    );
  }

  try {
    const jsonResult = await readJsonBody(req);
    if (!jsonResult.ok) return jsonResult.response;
    const parsed = checkoutSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "Thông tin gói không hợp lệ." }, { status: 400 });
    }

    const plans = await getPricingPlans(false);
    const plan = plans.find((p) => p.slug === parsed.data.planSlug && p.is_active);
    if (!plan) {
      return NextResponse.json({ error: "Không tìm thấy gói cước." }, { status: 404 });
    }

    const provider = getPaymentProvider(parsed.data.provider);
    if (!provider.isConfigured() && !isPayosSandboxAllowed()) {
      return NextResponse.json(
        {
          error:
            "Cổng thanh toán PayOS chưa được kích hoạt trên hệ thống. Vui lòng liên hệ quản trị viên.",
        },
        { status: 503 }
      );
    }

    // Step 1: Atomically lock promo code (if any), reserve slot, allocate collision-free order_code,
    // and insert pending order BEFORE calling external payment provider.
    const created = await createCheckoutOrderAtomic({
      userId: user.id,
      planSlug: plan.slug,
      provider: provider.isConfigured() ? provider.id : "mock",
      promoCode: parsed.data.promoCode ?? null,
    });

    if (!created.ok || !created.order) {
      return NextResponse.json(
        { error: created.error || "Không thể khởi tạo đơn hàng." },
        { status: created.status }
      );
    }

    const order = created.order;
    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      new URL(req.url).origin
    ).replace(/\/+$/, "");

    // Step 2: Create PayOS payment link using the already-reserved unique order_code.
    let checkout;
    try {
      checkout = await provider.createCheckout({
        orderCode: order.order_code,
        amountVnd: order.amount_vnd,
        description: `OnIELTS ${order.duration_months}M`,
        returnUrl: `${baseUrl}/pricing`,
        cancelUrl: `${baseUrl}/pricing?cancelled=1`,
        buyerEmail: user.email,
        buyerName: user.full_name,
      });
    } catch (err) {
      // Immediately cancel pending order so reserved promo slot is released
      await cancelPendingOrder(order.id).catch(() => {});
      if (err instanceof Error && err.message === "PAYOS_NOT_CONFIGURED") {
        return NextResponse.json(
          {
            error:
              "Cổng thanh toán PayOS chưa được kích hoạt trên hệ thống. Vui lòng liên hệ quản trị viên.",
          },
          { status: 503 }
        );
      }
      console.error("[payments.checkout] provider.createCheckout failed", {
        orderCode: order.order_code,
        message: err instanceof Error ? err.message : "unknown_error",
      });
      return NextResponse.json(
        { error: "Cổng thanh toán tạm thời không phản hồi. Vui lòng thử lại sau ít phút." },
        { status: 502 }
      );
    }

    const updatedOrder =
      (await attachOrderCheckoutDetails({
        orderId: order.id,
        provider: checkout.provider,
        checkoutUrl: checkout.checkoutUrl,
        qrCode: checkout.qrCode,
      })) ?? {
        ...order,
        provider: checkout.provider,
        checkout_url: checkout.checkoutUrl,
        qr_code: checkout.qrCode,
      };

    return NextResponse.json({
      ok: true,
      order: updatedOrder,
      checkout,
      planName: plan.name_vi,
    });
  } catch (err) {
    console.error("[payments.checkout] unexpected error", {
      message: err instanceof Error ? err.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "Không thể khởi tạo thanh toán." },
      { status: 500 }
    );
  }
}
