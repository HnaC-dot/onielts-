import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface Bucket {
  timestamps: number[];
}

const MAX_MEMORY_BUCKETS = 5_000;
const buckets = new Map<string, Bucket>();
const upstashLimiters = new Map<string, Ratelimit>();
let cachedRedis: Redis | null = null;
let cachedRedisSignature = "";
let warnedProdMemoryFallback = false;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  backend: "upstash" | "memory";
}

function getUpstashCredentials(): { url: string; token: string } | null {
  const url = (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ""
  ).trim();
  const token = (
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    ""
  ).trim();
  if (!url || !token) return null;
  return { url, token };
}

export function isUpstashRateLimitConfigured(): boolean {
  return Boolean(getUpstashCredentials());
}

function getUpstashLimiter(maxRequests: number, windowMs: number): Ratelimit | null {
  const creds = getUpstashCredentials();
  if (!creds) return null;
  const { url, token } = creds;

  const sig = `${url.length}:${token.length}`;
  if (!cachedRedis || cachedRedisSignature !== sig) {
    cachedRedis = new Redis({ url, token });
    cachedRedisSignature = sig;
    upstashLimiters.clear();
  }

  const windowSec = Math.max(1, Math.round(windowMs / 1000));
  const limiterKey = `${maxRequests}:${windowSec}`;
  const existing = upstashLimiters.get(limiterKey);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: cachedRedis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
    prefix: "onielts:rl",
    analytics: false,
  });
  upstashLimiters.set(limiterKey, limiter);
  return limiter;
}

function checkInMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Bounded eviction to prevent unbounded memory growth during long dev sessions
  if (buckets.size >= MAX_MEMORY_BUCKETS && !buckets.has(key)) {
    for (const [k, b] of buckets.entries()) {
      const active = b.timestamps.filter((ts) => ts > cutoff);
      if (active.length === 0) {
        buckets.delete(k);
      }
      if (buckets.size < MAX_MEMORY_BUCKETS * 0.8) break;
    }
  }

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000)
    );
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
      backend: "memory",
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.timestamps.length),
    retryAfterSec: 0,
    backend: "memory",
  };
}

/**
 * Distributed Upstash Redis sliding-window rate limiter (when
 * UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN are set), with a safe
 * bounded in-memory sliding-window fallback for local dev or transient outages.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number = 20,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  if (isUpstashRateLimitConfigured()) {
    const limiter = getUpstashLimiter(maxRequests, windowMs);
    if (limiter) {
      try {
        const res = await limiter.limit(key);
        const retryAfterSec = res.success
          ? 0
          : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
        return {
          allowed: res.success,
          remaining: Math.max(0, res.remaining),
          retryAfterSec,
          backend: "upstash",
        };
      } catch (err) {
        console.error(
          "[rate-limit] Upstash Redis request failed; falling back to in-memory limiter",
          {
            message: err instanceof Error ? err.message : "unknown_error",
          }
        );
      }
    }
  } else if (
    process.env.NODE_ENV === "production" &&
    !warnedProdMemoryFallback
  ) {
    warnedProdMemoryFallback = true;
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set in production; using per-instance in-memory fallback."
    );
  }

  return checkInMemoryRateLimit(key, maxRequests, windowMs);
}

export function resetInMemoryRateLimitForTests(): void {
  buckets.clear();
  upstashLimiters.clear();
  cachedRedis = null;
  cachedRedisSignature = "";
  warnedProdMemoryFallback = false;
}

export function getRequestIp(req: Request): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

export function getRequestClientKey(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  return `ip:${getRequestIp(req)}`;
}
