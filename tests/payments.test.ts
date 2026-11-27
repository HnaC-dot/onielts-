import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  computeExtendedPremiumExpiry,
  generateSafeOrderCode,
  payosProvider,
  signPayosData,
  verifyPayosSignature,
} from "@/lib/payments/payos";
import { processVerifiedPayosWebhook } from "@/lib/payments/process-webhook";
import {
  cancelPendingOrder,
  createCheckoutOrderAtomic,
  fulfillPaidOrderIdempotent,
} from "@/lib/db";
import { readStore, updateStore } from "@/lib/store";

describe("PayOS Payment Adapter — Signature Verification & Premium Expiry", () => {
  const secret = "test_payos_checksum_key_2026";
  const sampleData = {
    orderCode: 20261125001,
    amount: 679150,
    code: "00",
    desc: "success",
    reference: "FT263290001",
  };

  afterEach(() => {
    delete process.env.PAYOS_CHECKSUM_KEY;
  });

  it("produces and verifies valid PayOS HMAC-SHA256 signatures", () => {
    const sig = signPayosData(sampleData, secret);
    expect(verifyPayosSignature(sampleData, sig, secret)).toBe(true);
  });

  it("rejects tampered webhook amounts or invalid signatures", () => {
    const sig = signPayosData(sampleData, secret);
    const tampered = { ...sampleData, amount: 1000 };
    expect(verifyPayosSignature(tampered, sig, secret)).toBe(false);
    expect(verifyPayosSignature(sampleData, "deadbeef", secret)).toBe(false);
  });

  it("fails closed (rejects all webhooks) when PAYOS_CHECKSUM_KEY is not configured", () => {
    delete process.env.PAYOS_CHECKSUM_KEY;
    const forgedSig = signPayosData(sampleData, "some_random_guess");
    expect(verifyPayosSignature(sampleData, forgedSig)).toBe(false);
    expect(payosProvider.verifyWebhook({ code: "00", data: sampleData }, forgedSig)).toBeNull();
  });

  it("verifies full PayOS webhook envelope when PAYOS_CHECKSUM_KEY is configured", () => {
    process.env.PAYOS_CHECKSUM_KEY = secret;
    const sig = signPayosData(sampleData);
    const verified = payosProvider.verifyWebhook({ code: "00", data: sampleData }, sig);
    expect(verified).not.toBeNull();
    expect(verified?.orderCode).toBe(20261125001);
    expect(verified?.paid).toBe(true);
    expect(verified?.eventId).toBe("FT263290001");
  });

  it("rejects paid PayOS webhooks with zero or missing amount", () => {
    process.env.PAYOS_CHECKSUM_KEY = secret;
    const zeroAmountData = { ...sampleData, amount: 0 };
    const zeroSig = signPayosData(zeroAmountData);
    expect(payosProvider.verifyWebhook({ code: "00", data: zeroAmountData }, zeroSig)).toBeNull();

    const missingAmountData = {
      orderCode: sampleData.orderCode,
      code: "00",
      desc: "success",
      reference: "FT263290002",
    };
    const missingSig = signPayosData(missingAmountData);
    expect(
      payosProvider.verifyWebhook({ code: "00", data: missingAmountData }, missingSig)
    ).toBeNull();
  });

  it("extends Premium expiry correctly for new, active, and expired users", () => {
    const now = new Date("2026-11-25T00:00:00.000Z");

    const fresh = computeExtendedPremiumExpiry(null, 6, now);
    expect(fresh.startsWith("2027-05-25")).toBe(true);

    const stacked = computeExtendedPremiumExpiry("2027-01-10T00:00:00.000Z", 3, now);
    expect(stacked.startsWith("2027-04-10")).toBe(true);

    const renewed = computeExtendedPremiumExpiry("2026-08-01T00:00:00.000Z", 1, now);
    expect(renewed.startsWith("2026-12-25")).toBe(true);
  });

  it("generates collision-free positive PayOS-safe order codes under rapid burst", () => {
    const codes = new Set<number>();
    for (let i = 0; i < 120; i++) {
      const code = generateSafeOrderCode(codes);
      expect(Number.isSafeInteger(code)).toBe(true);
      expect(code).toBeGreaterThan(0);
      expect(codes.has(code)).toBe(false);
      codes.add(code);
    }
    expect(codes.size).toBe(120);
  });
});

describe("GD1 — Atomic Checkout, Promo Concurrency & Webhook Fulfillment", () => {
  const testPrefix = `gd1-pay-${Date.now()}`;
  const buyerId = `${testPrefix}-buyer`;
  const referrerId = `${testPrefix}-referrer`;
  const limitedPromoCode = `ONEUSE_${Date.now().toString().slice(-5)}`;
  const expiredPromoCode = `EXPIRED_${Date.now().toString().slice(-5)}`;
  const createdOrderIds: string[] = [];

  function seedTestUsersAndPromos() {
    updateStore((draft) => {
      draft.profiles.push(
        {
          id: buyerId,
          email: `${buyerId}@example.com`,
          full_name: "GD1 Buyer",
          avatar_url: null,
          role: "learner",
          locale: "vi",
          email_verified: true,
          target_band: 7.0,
          current_band: 6.0,
          premium_expires_at: null,
          streak_count: 0,
          last_active_date: null,
          referral_code: `REF${Date.now().toString().slice(-5)}B`,
          referred_by: referrerId,
          created_at: new Date().toISOString(),
        },
        {
          id: referrerId,
          email: `${referrerId}@example.com`,
          full_name: "GD1 Referrer",
          avatar_url: null,
          role: "learner",
          locale: "vi",
          email_verified: true,
          target_band: 7.5,
          current_band: 6.5,
          premium_expires_at: null,
          streak_count: 0,
          last_active_date: null,
          referral_code: `REF${Date.now().toString().slice(-5)}R`,
          referred_by: null,
          created_at: new Date().toISOString(),
        }
      );

      draft.promo_codes.push(
        {
          id: `promo-${limitedPromoCode}`,
          code: limitedPromoCode,
          discount_percent: 20,
          max_discount_vnd: 200_000,
          max_uses: 1,
          current_uses: 0,
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          is_active: true,
        },
        {
          id: `promo-${expiredPromoCode}`,
          code: expiredPromoCode,
          discount_percent: 50,
          max_discount_vnd: null,
          max_uses: 10,
          current_uses: 0,
          expires_at: new Date(Date.now() - 86_400_000).toISOString(),
          is_active: true,
        }
      );

      draft.referrals.push({
        id: `ref-${testPrefix}`,
        referrer_id: referrerId,
        referred_user_id: buyerId,
        referred_email: `${buyerId}@example.com`,
        referral_code: "TESTREF",
        status: "signed_up",
        created_at: new Date().toISOString(),
        converted_at: null,
      });
    });
  }

  afterEach(() => {
    delete process.env.PAYOS_CHECKSUM_KEY;
    updateStore((draft) => {
      draft.profiles = draft.profiles.filter(
        (p) => p.id !== buyerId && p.id !== referrerId
      );
      draft.promo_codes = draft.promo_codes.filter(
        (c) => c.code !== limitedPromoCode && c.code !== expiredPromoCode
      );
      draft.referrals = draft.referrals.filter((r) => r.id !== `ref-${testPrefix}`);
      draft.orders = draft.orders.filter(
        (o) => o.user_id !== buyerId && !createdOrderIds.includes(o.id)
      );
    });
    createdOrderIds.length = 0;
  });

  it("rejects invalid and expired promo codes with HTTP 400 instead of silently charging full price", async () => {
    seedTestUsersAndPromos();

    const invalidRes = await createCheckoutOrderAtomic({
      userId: buyerId,
      planSlug: "premium-1m",
      provider: "payos",
      promoCode: "NONEXISTENT_999",
    });
    expect(invalidRes.ok).toBe(false);
    expect(invalidRes.status).toBe(400);

    const expiredRes = await createCheckoutOrderAtomic({
      userId: buyerId,
      planSlug: "premium-1m",
      provider: "payos",
      promoCode: expiredPromoCode,
    });
    expect(expiredRes.ok).toBe(false);
    expect(expiredRes.status).toBe(400);
  });

  it("prevents concurrent promo over-redemption when max_uses = 1 and releases slot on cancel", async () => {
    seedTestUsersAndPromos();

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        createCheckoutOrderAtomic({
          userId: buyerId,
          planSlug: "premium-3m",
          provider: "payos",
          promoCode: limitedPromoCode,
        })
      )
    );

    const successes = attempts.filter((a) => a.ok && a.order);
    const rejected = attempts.filter((a) => !a.ok);
    expect(successes).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    expect(rejected.every((r) => r.status === 400)).toBe(true);

    const firstOrder = successes[0]!.order!;
    createdOrderIds.push(firstOrder.id);

    // Cancelling the pending order immediately frees the promo slot
    await cancelPendingOrder(firstOrder.id);

    const retry = await createCheckoutOrderAtomic({
      userId: buyerId,
      planSlug: "premium-3m",
      provider: "payos",
      promoCode: limitedPromoCode,
    });
    expect(retry.ok).toBe(true);
    expect(retry.order?.promo_code).toBe(limitedPromoCode);
    if (retry.order) createdOrderIds.push(retry.order.id);
  });

  it("fulfills paid webhook atomically with idempotency, promo increment, referral bonus days, and rejects underpayment or cancelled orders", async () => {
    seedTestUsersAndPromos();
    process.env.PAYOS_CHECKSUM_KEY = "gd1_secret_key_2026";

    const created = await createCheckoutOrderAtomic({
      userId: buyerId,
      planSlug: "premium-1m",
      provider: "payos",
      promoCode: limitedPromoCode,
    });
    expect(created.ok).toBe(true);
    const order = created.order!;
    createdOrderIds.push(order.id);

    // 1. Underpayment rejected (400) — order remains pending & buyer stays Free
    const underpay = await fulfillPaidOrderIdempotent({
      orderCode: order.order_code,
      amountVnd: order.amount_vnd - 1000,
      eventId: `EVT-UNDER-${order.order_code}`,
    });
    expect(underpay.ok).toBe(false);
    expect(underpay.status).toBe(400);

    // 2. Zero amount rejected (400)
    const zeroPay = await fulfillPaidOrderIdempotent({
      orderCode: order.order_code,
      amountVnd: 0,
      eventId: `EVT-ZERO-${order.order_code}`,
    });
    expect(zeroPay.ok).toBe(false);
    expect(zeroPay.status).toBe(400);

    // 3. Valid signed webhook fulfills order + extends Premium + increments promo + credits referral bonus
    const webhookData = {
      orderCode: order.order_code,
      amount: order.amount_vnd,
      code: "00",
      desc: "success",
      reference: `FT-${order.order_code}`,
    };
    const sig = signPayosData(webhookData);
    const first = await processVerifiedPayosWebhook(
      { code: "00", data: webhookData },
      sig
    );
    expect(first.ok).toBe(true);
    expect(first.status).toBe(200);
    expect(first.idempotent).toBe(false);
    expect(first.premiumExpiresAt).toBeTruthy();

    const storeAfterFirst = readStore();
    const promoAfter = storeAfterFirst.promo_codes.find(
      (c) => c.code === limitedPromoCode
    );
    expect(promoAfter?.current_uses).toBe(1);

    const buyerAfter = storeAfterFirst.profiles.find((p) => p.id === buyerId);
    const referrerAfter = storeAfterFirst.profiles.find((p) => p.id === referrerId);
    const refAfter = storeAfterFirst.referrals.find(
      (r) => r.id === `ref-${testPrefix}`
    );
    expect(buyerAfter?.premium_expires_at).toBe(first.premiumExpiresAt);
    expect(refAfter?.status).toBe("converted_premium");
    // Referrer also received bonus days
    expect(referrerAfter?.premium_expires_at).toBeTruthy();

    // 4. Duplicate webhook replay returns 200 idempotent without double-extending or double-counting
    const replay = await processVerifiedPayosWebhook(
      { code: "00", data: webhookData },
      sig
    );
    expect(replay.ok).toBe(true);
    expect(replay.status).toBe(200);
    expect(replay.idempotent).toBe(true);
    expect(
      readStore().promo_codes.find((c) => c.code === limitedPromoCode)?.current_uses
    ).toBe(1);
    expect(readStore().profiles.find((p) => p.id === buyerId)?.premium_expires_at).toBe(
      first.premiumExpiresAt
    );

    // 5. Cancelled order cannot be fulfilled (returns 409, never 200 idempotent)
    const cancelledCreated = await createCheckoutOrderAtomic({
      userId: buyerId,
      planSlug: "premium-1m",
      provider: "payos",
    });
    expect(cancelledCreated.ok).toBe(true);
    const cancelledOrder = cancelledCreated.order!;
    createdOrderIds.push(cancelledOrder.id);
    await cancelPendingOrder(cancelledOrder.id);

    const payCancelled = await fulfillPaidOrderIdempotent({
      orderCode: cancelledOrder.order_code,
      amountVnd: cancelledOrder.amount_vnd,
      eventId: `EVT-CANCEL-${cancelledOrder.order_code}`,
    });
    expect(payCancelled.ok).toBe(false);
    expect(payCancelled.status).toBe(409);
  });

  it("ships Migration 0008 with atomic SECURITY DEFINER RPCs restricted to service_role", () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/0008_payments_ai_safety.sql"),
      "utf-8"
    );
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.create_checkout_order_atomic");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.fulfill_paid_order_atomic");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.reserve_ai_quota_atomic");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fulfill_paid_order_atomic");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.fulfill_paid_order_atomic");
  });
});
