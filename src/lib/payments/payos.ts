import crypto from "node:crypto";
import type {
  CreateCheckoutInput,
  CreateCheckoutOutput,
  PaymentProvider,
  VerifiedWebhookPayload,
} from "./types";

/**
 * Returns the configured PayOS HMAC-SHA256 checksum key or null if unset.
 * Never falls back to a hardcoded secret string (fail-closed in all environments).
 */
export function getPayosChecksumKey(): string | null {
  const key = process.env.PAYOS_CHECKSUM_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function isPayosConfigured(): boolean {
  return Boolean(
    process.env.PAYOS_CLIENT_ID?.trim() &&
      process.env.PAYOS_API_KEY?.trim() &&
      getPayosChecksumKey()
  );
}

/**
 * Sandbox checkout/webhook simulation is strictly disabled in production
 * and whenever real PayOS credentials are configured.
 */
export function isPayosSandboxAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (isPayosConfigured()) return false;
  return process.env.PAYOS_SANDBOX === "true";
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
  checksumKey?: string
): string {
  const resolvedKey = (checksumKey ?? getPayosChecksumKey() ?? "").trim();
  if (!resolvedKey) {
    throw new Error("PAYOS_CHECKSUM_KEY is not configured.");
  }
  const canonical = buildPayosCanonicalString(data);
  return crypto.createHmac("sha256", resolvedKey).update(canonical).digest("hex");
}

export function verifyPayosSignature(
  data: Record<string, unknown>,
  providedSignature: string,
  checksumKey?: string
): boolean {
  if (!providedSignature || typeof providedSignature !== "string") return false;
  const resolvedKey = (checksumKey ?? getPayosChecksumKey() ?? "").trim();
  if (!resolvedKey) return false; // Fail closed when secret is absent

  const expected = signPayosData(data, resolvedKey);
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
        desc?: string;
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
      throw new Error(json.desc || "PayOS payment request failed.");
    }

    if (!isPayosSandboxAllowed()) {
      throw new Error("PAYOS_NOT_CONFIGURED");
    }

    // Explicit local-dev sandbox checkout (only when NODE_ENV !== "production" && PAYOS_SANDBOX === "true")
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
    const key = getPayosChecksumKey();
    if (!key) return null; // Fail closed whenever PAYOS_CHECKSUM_KEY is unset

    const data = body.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== "object") return null;

    const valid = verifyPayosSignature(data, signature, key);
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
