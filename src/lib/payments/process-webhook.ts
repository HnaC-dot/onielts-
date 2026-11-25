import "server-only";
import { updateStore } from "@/lib/store";
import { computeExtendedPremiumExpiry, payosProvider } from "./payos";

export interface WebhookProcessResult {
  ok: boolean;
  status: number;
  message: string;
  idempotent?: boolean;
  premiumExpiresAt?: string;
}

/**
 * Verifies PayOS HMAC-SHA256 signature and applies an idempotent Premium upgrade.
 */
export function processVerifiedPayosWebhook(
  body: Record<string, unknown>,
  signature: string
): WebhookProcessResult {
  const verified = payosProvider.verifyWebhook(body, signature);
  if (!verified) {
    return { ok: false, status: 401, message: "Chữ ký webhook PayOS không hợp lệ." };
  }

  if (!verified.paid) {
    return { ok: true, status: 200, message: "Bỏ qua trạng thái chưa thanh toán." };
  }

  return updateStore((store) => {
    // Idempotency check 1: duplicate webhook event ID
    const alreadyEvent = store.orders.find(
      (o) => o.webhook_event_id && o.webhook_event_id === verified.eventId
    );
    if (alreadyEvent) {
      return {
        ok: true,
        status: 200,
        idempotent: true,
        message: "Webhook đã được xử lý trước đó (idempotent).",
      };
    }

    const order = store.orders.find((o) => o.order_code === verified.orderCode);
    if (!order) {
      return { ok: false, status: 404, message: "Không tìm thấy đơn hàng." };
    }

    // Idempotency check 2: order already marked paid
    if (order.status === "paid") {
      return {
        ok: true,
        status: 200,
        idempotent: true,
        message: "Đơn hàng đã thanh toán trước đó (idempotent).",
      };
    }

    order.status = "paid";
    order.webhook_event_id = verified.eventId;
    order.paid_at = new Date().toISOString();

    // Increment promo code usage count if applied
    if (order.promo_code) {
      const codeObj = store.promo_codes.find(
        (c) => c.code.toUpperCase() === order.promo_code!.toUpperCase()
      );
      if (codeObj) codeObj.current_uses += 1;
    }

    // Extend user Premium expiry
    const profile = store.profiles.find((p) => p.id === order.user_id);
    let newExpiry: string | undefined;
    if (profile) {
      newExpiry = computeExtendedPremiumExpiry(
        profile.premium_expires_at,
        order.duration_months
      );
      profile.premium_expires_at = newExpiry;
    }

    // Track referral conversion (tracking only, no auto payouts)
    const ref = store.referrals.find(
      (r) => r.referred_user_id === order.user_id && r.status === "signed_up"
    );
    if (ref) {
      ref.status = "converted_premium";
      ref.converted_at = new Date().toISOString();
    }

    return {
      ok: true,
      status: 200,
      idempotent: false,
      premiumExpiresAt: newExpiry,
      message: "Đã xác nhận thanh toán và kích hoạt Premium thành công.",
    };
  });
}
