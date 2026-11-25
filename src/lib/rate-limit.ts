import "server-only";

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Sliding-window in-memory rate limiter for AI and mutation routes.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 20,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.timestamps.length),
    retryAfterSec: 0,
  };
}

export function getRequestClientKey(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  return `ip:${ip}`;
}
