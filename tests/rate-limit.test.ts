import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockLimit = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    constructor(public config: { url: string; token: string }) {}
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow = vi.fn(() => "sliding-window");
    limit = mockLimit;
  },
}));

import {
  checkRateLimit,
  isUpstashRateLimitConfigured,
  resetInMemoryRateLimitForTests,
} from "@/lib/rate-limit";

afterEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  mockLimit.mockReset();
  resetInMemoryRateLimitForTests();
  vi.restoreAllMocks();
});

describe("Phase 2 — Rate Limiter (Upstash Redis + In-Memory Fallback)", () => {
  it("uses in-memory sliding window when Upstash env vars are not set", async () => {
    expect(isUpstashRateLimitConfigured()).toBe(false);

    const r1 = await checkRateLimit("test-mem-key", 2, 60_000);
    const r2 = await checkRateLimit("test-mem-key", 2, 60_000);
    const r3 = await checkRateLimit("test-mem-key", 2, 60_000);

    expect(r1).toMatchObject({ allowed: true, remaining: 1, backend: "memory" });
    expect(r2).toMatchObject({ allowed: true, remaining: 0, backend: "memory" });
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(r3.backend).toBe("memory");
  });

  it("uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";
    expect(isUpstashRateLimitConfigured()).toBe(true);

    mockLimit.mockResolvedValueOnce({
      success: true,
      remaining: 19,
      reset: Date.now() + 60_000,
    });
    const ok = await checkRateLimit("u:abc", 20, 60_000);
    expect(ok).toEqual({
      allowed: true,
      remaining: 19,
      retryAfterSec: 0,
      backend: "upstash",
    });

    mockLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: Date.now() + 12_000,
    });
    const blocked = await checkRateLimit("u:abc", 20, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(blocked.backend).toBe("upstash");
  });

  it("also accepts Vercel Upstash Marketplace KV_REST_API_URL and KV_REST_API_TOKEN", async () => {
    process.env.KV_REST_API_URL = "https://kv-example.upstash.io";
    process.env.KV_REST_API_TOKEN = "mock-kv-token";
    expect(isUpstashRateLimitConfigured()).toBe(true);

    mockLimit.mockResolvedValueOnce({
      success: true,
      remaining: 9,
      reset: Date.now() + 60_000,
    });
    const ok = await checkRateLimit("ip:1.2.3.4", 10, 60_000);
    expect(ok).toEqual({
      allowed: true,
      remaining: 9,
      retryAfterSec: 0,
      backend: "upstash",
    });
  });

  it("falls back safely to in-memory limiter if Upstash throws a network error", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockLimit.mockRejectedValueOnce(new Error("ECONNRESET"));

    const res = await checkRateLimit("u:fallback", 5, 60_000);
    expect(res.allowed).toBe(true);
    expect(res.backend).toBe("memory");
    expect(errSpy).toHaveBeenCalled();
  });
});
