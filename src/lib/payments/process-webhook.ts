import "server-only";
import { fulfillPaidOrderIdempotent } from "@/lib/db";
import { payosProvider } from "./payos";

export interface WebhookProcessResult {
  ok: boolean;
  status: number;
  message: string;
  idempotent?: boolean;
  premiumExpiresAt?: string;
}

/**
 * Verifies PayOS HMAC-SHA256 signature (fail-closed if PAYOS_CHECKSUM_KEY is unset)
 * and applies an idempotent Premium upgrade in Supabase Postgres (or local dev store).
 */
export async function processVerifiedPayosWebhook(
  body: Record<string, unknown>,
  signature: string
): Promise<WebhookProcessResult> {
  const verified = payosProvider.verifyWebhook(body, signature);
  if (!verified) {
    return {
      ok: false,
      status: 401,
      message: "Chữ ký webhook PayOS không hợp lệ hoặc chưa cấu hình khóa bảo mật.",
    };
  }

  if (!verified.paid) {
    return { ok: true, status: 200, message: "Bỏ qua trạng thái chưa thanh toán." };
  }

  return fulfillPaidOrderIdempotent({
    orderCode: verified.orderCode,
    amountVnd: verified.amountVnd,
    eventId: verified.eventId,
  });
}
