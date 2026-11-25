import { describe, expect, it } from "vitest";
import {
  computeExtendedPremiumExpiry,
  payosProvider,
  signPayosData,
  verifyPayosSignature,
} from "@/lib/payments/payos";

describe("PayOS Payment Adapter — Signature Verification & Premium Expiry", () => {
  const secret = "test_payos_checksum_key_2026";
  const sampleData = {
    orderCode: 20261125001,
    amount: 679150,
    code: "00",
    desc: "success",
    reference: "FT263290001",
  };

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

  it("verifies full PayOS webhook envelope via provider adapter", () => {
    const sig = signPayosData(sampleData);
    const verified = payosProvider.verifyWebhook({ code: "00", data: sampleData }, sig);
    expect(verified).not.toBeNull();
    expect(verified?.orderCode).toBe(20261125001);
    expect(verified?.paid).toBe(true);
    expect(verified?.eventId).toBe("FT263290001");
  });

  it("extends Premium expiry correctly for new, active, and expired users", () => {
    const now = new Date("2026-11-25T00:00:00.000Z");

    // New user (null expiry) + 6 months -> 2027-05-25
    const fresh = computeExtendedPremiumExpiry(null, 6, now);
    expect(fresh.startsWith("2027-05-25")).toBe(true);

    // Already active user expiring 2027-01-10 + 3 months -> 2027-04-10
    const stacked = computeExtendedPremiumExpiry("2027-01-10T00:00:00.000Z", 3, now);
    expect(stacked.startsWith("2027-04-10")).toBe(true);

    // Expired user (2026-08-01) + 1 month -> starts from now (2026-12-25)
    const renewed = computeExtendedPremiumExpiry("2026-08-01T00:00:00.000Z", 1, now);
    expect(renewed.startsWith("2026-12-25")).toBe(true);
  });
});
