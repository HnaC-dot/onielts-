import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
    };
  },
}));

import {
  AiServiceUnavailableError,
  clearAiMemoryCacheForTests,
  estimateAiCostUsd,
  generateStructuredAi,
  isAiMockAllowed,
} from "@/lib/ai";
import {
  checkUsageLimit,
  FREE_LIMITS,
  getPremiumDailyAiLimit,
  reserveUsageLimit,
} from "@/lib/usage-limits";
import { releaseAiQuotaRecord } from "@/lib/db";
import { updateStore } from "@/lib/store";
import type { SessionUser } from "@/lib/types";

const sampleSchema = z.object({ answer: z.string().min(1) });

function makeSessionUser(overrides: Partial<SessionUser> & { id: string }): SessionUser {
  return {
    email: `${overrides.id}@example.com`,
    full_name: "Test Learner",
    avatar_url: null,
    role: "learner",
    locale: "vi",
    email_verified: true,
    target_band: 7.0,
    current_band: 6.0,
    premium_expires_at: null,
    streak_count: 0,
    last_active_date: null,
    referral_code: "TESTREF",
    referred_by: null,
    created_at: new Date().toISOString(),
    isPremium: false,
    authMode: "demo",
    ...overrides,
  };
}

describe("GD1 — AI Fail-Closed Safety, Zero-TOCTOU Quota & Premium Daily Cap", () => {
  const createdActorPrefixes: string[] = [];
  const origEnv = {
    NODE_ENV: process.env.NODE_ENV,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    ALLOW_AI_MOCK: process.env.ALLOW_AI_MOCK,
    AI_PREMIUM_DAILY_LIMIT: process.env.AI_PREMIUM_DAILY_LIMIT,
  };

  afterEach(() => {
    mockGenerateContent.mockReset();
    clearAiMemoryCacheForTests();
    vi.restoreAllMocks();

    const env = process.env as Record<string, string | undefined>;
    env.NODE_ENV = origEnv.NODE_ENV;
    if (origEnv.GEMINI_API_KEY === undefined) delete env.GEMINI_API_KEY;
    else env.GEMINI_API_KEY = origEnv.GEMINI_API_KEY;
    if (origEnv.GEMINI_MODEL === undefined) delete env.GEMINI_MODEL;
    else env.GEMINI_MODEL = origEnv.GEMINI_MODEL;
    if (origEnv.ALLOW_AI_MOCK === undefined) delete env.ALLOW_AI_MOCK;
    else env.ALLOW_AI_MOCK = origEnv.ALLOW_AI_MOCK;
    if (origEnv.AI_PREMIUM_DAILY_LIMIT === undefined) delete env.AI_PREMIUM_DAILY_LIMIT;
    else env.AI_PREMIUM_DAILY_LIMIT = origEnv.AI_PREMIUM_DAILY_LIMIT;

    if (createdActorPrefixes.length > 0) {
      updateStore((store) => {
        store.ai_usage_logs = store.ai_usage_logs.filter(
          (l) =>
            !createdActorPrefixes.some(
              (prefix) =>
                l.user_id.includes(prefix) || (l.actor_key ?? "").includes(prefix)
            )
        );
      });
      createdActorPrefixes.length = 0;
    }
  });

  it("prices different Gemini models accurately instead of hardcoding a single model rate", () => {
    const flashCost = estimateAiCostUsd("gemini-2.5-flash", 1_000_000, 1_000_000);
    const proCost = estimateAiCostUsd("gemini-2.5-pro", 1_000_000, 1_000_000);
    const flash20Cost = estimateAiCostUsd("gemini-2.0-flash", 1_000_000, 1_000_000);

    expect(flashCost).toBeCloseTo(0.75, 5);
    expect(proCost).toBeCloseTo(11.25, 5);
    expect(flash20Cost).toBeCloseTo(0.5, 5);
    expect(proCost).toBeGreaterThan(flashCost);
  });

  it("strictly disables AI mock mode in production even if ALLOW_AI_MOCK=true", () => {
    const env = process.env as Record<string, string | undefined>;
    delete env.ALLOW_AI_MOCK;
    expect(isAiMockAllowed()).toBe(false);

    env.ALLOW_AI_MOCK = "true";
    env.NODE_ENV = "production";
    expect(isAiMockAllowed()).toBe(false);

    env.NODE_ENV = "development";
    expect(isAiMockAllowed()).toBe(true);
  });

  it("throws AiServiceUnavailableError (503) and releases reserved quota when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ALLOW_AI_MOCK;

    const uid = `gd1-nokey-${Date.now()}`;
    createdActorPrefixes.push(uid);
    const freeUser = makeSessionUser({ id: uid, isPremium: false });

    const reservation = await reserveUsageLimit({
      user: freeUser,
      feature: "writing_eval",
      rawFeatureName: "writing:evaluate",
      skill: "writing",
      model: "gemini-2.5-flash",
      fallbackActorId: `u:${uid}`,
    });
    expect(reservation.allowed).toBe(true);
    expect(reservation.reservationId).toBeTruthy();

    await expect(
      generateStructuredAi({
        feature: "writing:evaluate",
        skill: "writing",
        userId: uid,
        reservationId: reservation.reservationId,
        systemPrompt: "Grade essay",
        userPrompt: "Test essay",
        schema: sampleSchema,
        jsonSchemaHint: `{ "answer": "string" }`,
        mockFallback: () => ({ answer: "fake" }),
      })
    ).rejects.toThrow(AiServiceUnavailableError);

    // Quota must be fully refunded (0 used, 2 remaining)
    const after = await checkUsageLimit(freeUser, "writing_eval", `u:${uid}`);
    expect(after.used).toBe(0);
    expect(after.remaining).toBe(FREE_LIMITS.writing_eval.limit);
  });

  it("throws AiServiceUnavailableError (503), never returns mock data, and refunds quota when Gemini fails", async () => {
    process.env.GEMINI_API_KEY = "test_real_looking_gemini_key";
    mockGenerateContent.mockRejectedValue(new Error("429 Resource Exhausted"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const uid = `gd1-fail-${Date.now()}`;
    createdActorPrefixes.push(uid);
    const freeUser = makeSessionUser({ id: uid, isPremium: false });

    const reservation = await reserveUsageLimit({
      user: freeUser,
      feature: "speaking_eval",
      rawFeatureName: "speaking:evaluate",
      skill: "speaking",
      model: "gemini-2.5-flash",
      fallbackActorId: `u:${uid}`,
    });
    expect(reservation.allowed).toBe(true);

    let caught: unknown;
    try {
      await generateStructuredAi({
        feature: "speaking:evaluate",
        skill: "speaking",
        userId: uid,
        reservationId: reservation.reservationId,
        systemPrompt: "Grade speech",
        userPrompt: "Test speech",
        schema: sampleSchema,
        jsonSchemaHint: `{ "answer": "string" }`,
        mockFallback: () => ({ answer: "should never be returned" }),
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(AiServiceUnavailableError);
    expect((caught as AiServiceUnavailableError).code).toBe("AI_PROVIDER_ERROR");
    expect((caught as AiServiceUnavailableError).status).toBe(503);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2); // 1 attempt + 1 retry
    expect(errSpy).toHaveBeenCalled();

    // Quota refunded cleanly
    const after = await checkUsageLimit(freeUser, "speaking_eval", `u:${uid}`);
    expect(after.used).toBe(0);
    expect(after.remaining).toBe(2);
  });

  it("does NOT deduct user quota on cache hits", async () => {
    process.env.GEMINI_API_KEY = "test_real_looking_gemini_key";
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ answer: "cached result" }),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    });

    const uid = `gd1-cache-${Date.now()}`;
    createdActorPrefixes.push(uid);
    const freeUser = makeSessionUser({ id: uid, isPremium: false });

    const r1 = await reserveUsageLimit({
      user: freeUser,
      feature: "general_tool",
      rawFeatureName: "tool:paraphraser",
      skill: "general_tool",
      model: "gemini-2.5-flash",
      fallbackActorId: `u:${uid}`,
    });
    const res1 = await generateStructuredAi({
      feature: "tool:paraphraser",
      skill: "general_tool",
      userId: uid,
      reservationId: r1.reservationId,
      systemPrompt: "Paraphrase",
      userPrompt: "Same prompt text",
      schema: sampleSchema,
      jsonSchemaHint: `{ "answer": "string" }`,
      cacheTtlMs: 60_000,
      mockFallback: () => ({ answer: "mock" }),
    });
    expect(res1.cached).toBe(false);

    const r2 = await reserveUsageLimit({
      user: freeUser,
      feature: "general_tool",
      rawFeatureName: "tool:paraphraser",
      skill: "general_tool",
      model: "gemini-2.5-flash",
      fallbackActorId: `u:${uid}`,
    });
    const res2 = await generateStructuredAi({
      feature: "tool:paraphraser",
      skill: "general_tool",
      userId: uid,
      reservationId: r2.reservationId,
      systemPrompt: "Paraphrase",
      userPrompt: "Same prompt text",
      schema: sampleSchema,
      jsonSchemaHint: `{ "answer": "string" }`,
      cacheTtlMs: 60_000,
      mockFallback: () => ({ answer: "mock" }),
    });
    expect(res2.cached).toBe(true);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // Only the first uncached call counts toward quota
    const after = await checkUsageLimit(freeUser, "general_tool", `u:${uid}`);
    expect(after.used).toBe(1);
    expect(after.remaining).toBe(FREE_LIMITS.general_tool.limit - 1);
  });

  it("blocks parallel TOCTOU quota bypass: 10 concurrent Free requests allow exactly 2", async () => {
    const uid = `gd1-race-${Date.now()}`;
    createdActorPrefixes.push(uid);
    const freeUser = makeSessionUser({ id: uid, isPremium: false });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        reserveUsageLimit({
          user: freeUser,
          feature: "writing_eval",
          rawFeatureName: "writing:evaluate",
          skill: "writing",
          model: "gemini-2.5-flash",
          fallbackActorId: `u:${uid}`,
        })
      )
    );

    const allowed = results.filter((r) => r.allowed);
    const denied = results.filter((r) => !r.allowed);

    expect(allowed).toHaveLength(2);
    expect(denied).toHaveLength(8);
    expect(denied.every((r) => r.httpStatus === 402 && r.limitReached === true)).toBe(true);

    // Releasing one reservation immediately restores 1 slot
    await releaseAiQuotaRecord(allowed[0]!.reservationId);
    const afterRelease = await checkUsageLimit(freeUser, "writing_eval", `u:${uid}`);
    expect(afterRelease.used).toBe(1);
    expect(afterRelease.remaining).toBe(1);
  });

  it("enforces Premium daily cap of 20 calls/day (HTTP 429, not 402 paywall) while keeping Admin exempt", async () => {
    delete process.env.AI_PREMIUM_DAILY_LIMIT;
    expect(getPremiumDailyAiLimit()).toBe(20);

    const premId = `gd1-prem-${Date.now()}`;
    const adminId = `gd1-adm-${Date.now()}`;
    createdActorPrefixes.push(premId, adminId);

    const premiumUser = makeSessionUser({
      id: premId,
      role: "learner",
      isPremium: true,
      premium_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });

    const burst = await Promise.all(
      Array.from({ length: 22 }, () =>
        reserveUsageLimit({
          user: premiumUser,
          feature: "writing_eval",
          rawFeatureName: "writing:evaluate",
          skill: "writing",
          model: "gemini-2.5-flash",
          fallbackActorId: `u:${premId}`,
        })
      )
    );

    const allowed = burst.filter((r) => r.allowed);
    const denied = burst.filter((r) => !r.allowed);
    expect(allowed).toHaveLength(20);
    expect(denied).toHaveLength(2);
    expect(
      denied.every(
        (r) =>
          r.httpStatus === 429 &&
          r.premiumCapReached === true &&
          r.limitReached === false
      )
    ).toBe(true);

    const adminUser = makeSessionUser({
      id: adminId,
      role: "admin",
      isPremium: true,
    });
    const adminCheck = await checkUsageLimit(adminUser, "writing_eval", `u:${adminId}`);
    expect(adminCheck.allowed).toBe(true);
    expect(adminCheck.limit).toBeNull();
  });

  it("verifies ALL 10 AI API routes enforce atomic reserveUsageLimit and fail-closed error handling", () => {
    const aiRoutes = [
      "src/app/api/writing/evaluate/route.ts",
      "src/app/api/speaking/evaluate/route.ts",
      "src/app/api/writing/generate/route.ts",
      "src/app/api/speaking/generate/route.ts",
      "src/app/api/conversations/reply/route.ts",
      "src/app/api/tools/[slug]/route.ts",
      "src/app/api/mentor/chat/route.ts",
      "src/app/api/pronunciation/check/route.ts",
      "src/app/api/writing/exercise-check/route.ts",
      "src/app/api/flashcards/autofill/route.ts",
    ];

    for (const rel of aiRoutes) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), "utf-8");
      expect(src, `${rel} must call reserveUsageLimit`).toContain("reserveUsageLimit(");
      expect(src, `${rel} must pass reservationId to generateStructuredAi`).toContain(
        "reservationId: reservation.reservationId"
      );
      expect(src, `${rel} must release quota on catch`).toContain("releaseAiQuotaRecord(");
      expect(src, `${rel} must return fail-closed AI error response`).toContain(
        "buildAiErrorResponse("
      );
    }

    // Writing & Speaking evaluate must never persist mocked evaluations
    const writingEvalSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/writing/evaluate/route.ts"),
      "utf-8"
    );
    const speakingEvalSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/speaking/evaluate/route.ts"),
      "utf-8"
    );
    expect(writingEvalSrc).toContain("aiRes.mocked");
    expect(speakingEvalSrc).toContain("aiRes.mocked");
  });
});
