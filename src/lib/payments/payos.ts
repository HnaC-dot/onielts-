import crypto from "node:crypto";
import type {
  CreateCheckoutInput,
  CreateCheckoutOutput,
  PaymentProvider,
  VerifiedWebhookPayload,
} from "./types";

const SANDBOX_FALLBACK_CHECKSUM_KEY = "onielts_sandbox_dev_checksum_key";

export function getPayosChecksumKey(): string {
  return process.env.PAYOS_CHECKSUM_KEY?.trim() || SANDBOX_FALLBACK_CHECKSUM_KEY;
}

export function isPayosConfigured(): boolean {
  return Boolean(
    process.env.PAYOS_CLIENT_ID?.trim() &&
      process.env.PAYOS_API_KEY?.trim() &&
      process.env.PAYOS_CHECKSUM_KEY?.trim()
  );
}

/**
 * PayOS canonical signature string: sort top-level data keys alphabetically
 * and join as `key=value&...`, then compute HMAC-SHA256 hex digest.
 */
export function buildPayosCanonicalString(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((key) => {
      const val = data[key];
      const normalized =
        val === null || val === undefined
          ? ""
          : typeof val === "object"
          ? JSON.stringify(val)
          : String(val);
      return `${key}=${normalized}`;
    })
    .join("&");
}

export function signPayosData(
  data: Record<string, unknown>,
  checksumKey: string = getPayosChecksumKey()
): string {
  const canonical = buildPayosCanonicalString(data);
  return crypto.createHmac("sha256", checksumKey).update(canonical).digest("hex");
}

export function verifyPayosSignature(
  data: Record<string, unknown>,
  providedSignature: string,
  checksumKey: string = getPayosChecksumKey()
): boolean {
  if (!providedSignature || typeof providedSignature !== "string") return false;
  const expected = signPayosData(data, checksumKey);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(providedSignature.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Compute new Premium expiry date cleanly:
 * - If existing expiry is in the future, extend from that date.
 * - Otherwise start from `now`.
 */
export function computeExtendedPremiumExpiry(
  currentExpiryIso: string | null | undefined,
  durationMonths: number,
  now: Date = new Date()
): string {
  const currentMs = currentExpiryIso ? new Date(currentExpiryIso).getTime() : 0;
  const baseDate = currentMs > now.getTime() ? new Date(currentMs) : new Date(now.getTime());
  baseDate.setUTCMonth(baseDate.getUTCMonth() + durationMonths);
  return baseDate.toISOString();
}

export const payosProvider: PaymentProvider = {
  id: "payos",

  isConfigured: isPayosConfigured,

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutOutput> {
    if (isPayosConfigured()) {
      const payloadData = {
        amount: input.amountVnd,
        cancelUrl: input.cancelUrl,
        description: input.description.slice(0, 25),
        orderCode: input.orderCode,
        returnUrl: input.returnUrl,
      };
      const signature = signPayosData(payloadData);
      const res = await fetch("https://api-merchant.payos.vn/v2/payment-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": process.env.PAYOS_CLIENT_ID!,
          "x-api-key": process.env.PAYOS_API_KEY!,
        },
        body: JSON.stringify({
          ...payloadData,
          buyerName: input.buyerName,
          buyerEmail: input.buyerEmail,
          signature,
        }),
      });
      const json = (await res.json()) as {
        code?: string;
        data?: { checkoutUrl?: string; qrCode?: string };
      };
      if (res.ok && json.code === "00" && json.data?.checkoutUrl) {
        return {
          provider: "payos",
          orderCode: input.orderCode,
          checkoutUrl: json.data.checkoutUrl,
          qrCode: json.data.qrCode || `VIETQR|ONIELTS|${input.orderCode}|${input.amountVnd}`,
          sandboxMocked: false,
        };
      }
    }

    // Sandbox / Mocked VietQR checkout when PayOS keys are not yet configured
    return {
      provider: "mock",
      orderCode: input.orderCode,
      checkoutUrl: `${input.returnUrl}?orderCode=${input.orderCode}&sandbox=1`,
      qrCode: `00020101021238570010A000000727012700069704220113ONIELTS${input.orderCode}53037045406${input.amountVnd}5802VN62180814ONIELTS${input.orderCode}`,
      sandboxMocked: true,
    };
  },

  verifyWebhook(
    body: Record<string, unknown>,
    signature: string
  ): VerifiedWebhookPayload | null {
    const data = body.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== "object") return null;

    const valid = verifyPayosSignature(data, signature);
    if (!valid) return null;

    const orderCode = Number(data.orderCode);
    const amountVnd = Number(data.amount ?? 0);
    const code = String(data.code ?? body.code ?? "");
    const eventId = String(data.reference || `payos-${orderCode}-${code}`);

    if (!Number.isFinite(orderCode) || orderCode <= 0) return null;

    return {
      orderCode,
      amountVnd,
      eventId,
      paid: code === "00",
    };
  },
};
