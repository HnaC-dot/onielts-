import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createOrderRecord, findActivePromoCode, getPricingPlans } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";

const checkoutSchema = z.object({
  planSlug: z.string().min(1).max(60),
  promoCode: z.string().trim().max(40).optional(),
  provider: z.enum(["payos", "vnpay", "momo", "stripe"]).optional().default("payos"),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Vui lòng đăng nhập trước khi thanh toán gói Premium." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Thông tin gói không hợp lệ." }, { status: 400 });
    }

    const plans = await getPricingPlans(false);
    const plan = plans.find((p) => p.slug === parsed.data.planSlug && p.is_active);
    if (!plan) {
      return NextResponse.json({ error: "Không tìm thấy gói cước." }, { status: 404 });
    }

    let discountVnd = 0;
    let appliedPromo: string | null = null;
    if (parsed.data.promoCode) {
      const promo = await findActivePromoCode(parsed.data.promoCode);
      if (
        promo &&
        (!promo.expires_at || new Date(promo.expires_at).getTime() > Date.now()) &&
        (!promo.max_uses || promo.current_uses < promo.max_uses)
      ) {
        const rawDiscount = Math.round((plan.price_vnd * promo.discount_percent) / 100);
        discountVnd = promo.max_discount_vnd
          ? Math.min(rawDiscount, promo.max_discount_vnd)
          : rawDiscount;
        appliedPromo = promo.code;
      }
    }

    const finalAmount = Math.max(1000, plan.price_vnd - discountVnd);
    const orderCode = Number(
      `${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 89)}`
    );
    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      new URL(req.url).origin
    ).replace(/\/+$/, "");

    const provider = getPaymentProvider(parsed.data.provider);
    let checkout;
    try {
      checkout = await provider.createCheckout({
        orderCode,
        amountVnd: finalAmount,
        description: `OnIELTS ${plan.duration_months}M`,
        returnUrl: `${baseUrl}/pricing`,
        cancelUrl: `${baseUrl}/pricing?cancelled=1`,
        buyerEmail: user.email,
        buyerName: user.full_name,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "PAYOS_NOT_CONFIGURED") {
        return NextResponse.json(
          {
            error:
              "Cổng thanh toán PayOS chưa được kích hoạt trên hệ thống. Vui lòng liên hệ quản trị viên.",
          },
          { status: 503 }
        );
      }
      throw err;
    }

    const order = await createOrderRecord({
      userId: user.id,
      plan,
      orderCode,
      provider: checkout.provider,
      amountVnd: finalAmount,
      discountVnd,
      promoCode: appliedPromo,
      checkoutUrl: checkout.checkoutUrl,
      qrCode: checkout.qrCode,
    });

    return NextResponse.json({
      ok: true,
      order,
      checkout,
      planName: plan.name_vi,
    });
  } catch {
    return NextResponse.json(
      { error: "Không thể khởi tạo thanh toán." },
      { status: 500 }
    );
  }
}
