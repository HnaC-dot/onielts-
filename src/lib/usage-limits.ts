import "server-only";
import { readStore } from "./store";
import type { SessionUser } from "./types";

export type MeteredFeature =
  | "writing_eval"
  | "speaking_eval"
  | "general_tool"
  | "generator"
  | "conversation";

export interface UsageCheckResult {
  allowed: boolean;
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null;
  period: "monthly" | "daily";
  isPremium: boolean;
}

export const FREE_LIMITS: Record<
  MeteredFeature,
  { limit: number; period: "monthly" | "daily" }
> = {
  writing_eval: { limit: 2, period: "monthly" },
  speaking_eval: { limit: 2, period: "monthly" },
  general_tool: { limit: 15, period: "daily" },
  generator: { limit: 3, period: "daily" },
  conversation: { limit: 5, period: "daily" },
};

function isSameUtcMonth(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

function isSameVietnamDay(iso: string, now: Date): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(iso)) === fmt.format(now);
}

/**
 * Server-side usage limit enforcement.
 * Free users: 2 AI evaluations per skill per month, daily limits on tools/generators.
 * Premium & Admin users: unlimited.
 */
export function checkUsageLimit(
  user: SessionUser | null,
  feature: MeteredFeature,
  fallbackActorId: string = "guest"
): UsageCheckResult {
  const isPremium = Boolean(user?.isPremium);
  const config = FREE_LIMITS[feature];

  if (isPremium) {
    return {
      allowed: true,
      used: 0,
      limit: null,
      remaining: null,
      period: config.period,
      isPremium: true,
    };
  }

  const actorId = user?.id ?? fallbackActorId;
  const now = new Date();
  const store = readStore();

  const matchingLogs = store.ai_usage_logs.filter((log) => {
    if (log.user_id !== actorId) return false;
    const matchesFeature =
      feature === "general_tool"
        ? log.feature.startsWith("tool:")
        : feature === "writing_eval"
        ? log.feature === "writing:evaluate"
        : feature === "speaking_eval"
        ? log.feature === "speaking:evaluate"
        : feature === "generator"
        ? log.feature.endsWith(":generate")
        : log.feature === "conversation:reply";

    if (!matchesFeature) return false;
    return config.period === "monthly"
      ? isSameUtcMonth(log.created_at, now)
      : isSameVietnamDay(log.created_at, now);
  });

  const used = matchingLogs.length;
  const remaining = Math.max(0, config.limit - used);

  return {
    allowed: used < config.limit,
    used,
    limit: config.limit,
    remaining,
    period: config.period,
    isPremium: false,
  };
}
