import "server-only";
import {
  getUserAiUsageLogsSince,
  inferQuotaBucketFromFeature,
  normalizeAiActorKey,
  reserveAiQuotaRecord,
} from "./db";
import { getVietnamDateString } from "./utils";
import type { SessionUser } from "./types";

export type MeteredFeature =
  | "writing_eval"
  | "speaking_eval"
  | "general_tool"
  | "generator"
  | "conversation"
  | "mentor"
  | "pronunciation"
  | "writing_exercise"
  | "flashcard_autofill";

export interface UsageCheckResult {
  allowed: boolean;
  used: number;
  limit: number | null; // null = unlimited (Admin)
  remaining: number | null;
  period: "monthly" | "daily";
  isPremium: boolean;
}

export interface UsageReservationResult {
  allowed: boolean;
  usage: UsageCheckResult;
  reservationId: string | null;
  httpStatus: 200 | 402 | 429 | 503;
  limitReached: boolean;
  premiumCapReached: boolean;
  error?: string;
}

export const DEFAULT_PREMIUM_DAILY_AI_LIMIT = 20;

export const FREE_LIMITS: Record<
  MeteredFeature,
  { limit: number; period: "monthly" | "daily" }
> = {
  writing_eval: { limit: 2, period: "monthly" },
  speaking_eval: { limit: 2, period: "monthly" },
  general_tool: { limit: 15, period: "daily" },
  generator: { limit: 3, period: "daily" },
  conversation: { limit: 5, period: "daily" },
  mentor: { limit: 5, period: "daily" },
  pronunciation: { limit: 10, period: "daily" },
  writing_exercise: { limit: 10, period: "daily" },
  flashcard_autofill: { limit: 15, period: "daily" },
};

const FREE_LIMIT_LABELS_VI: Record<MeteredFeature, string> = {
  writing_eval: "chấm Writing AI miễn phí trong tháng này",
  speaking_eval: "chấm Speaking AI miễn phí trong tháng này",
  general_tool: "dùng công cụ AI miễn phí hôm nay",
  generator: "tạo bài mẫu AI miễn phí hôm nay",
  conversation: "hội thoại AI miễn phí hôm nay",
  mentor: "hỏi Mentor AI miễn phí hôm nay",
  pronunciation: "kiểm tra phát âm AI miễn phí hôm nay",
  writing_exercise: "chấm câu nâng cấp Writing AI miễn phí hôm nay",
  flashcard_autofill: "tự điền từ vựng Flashcard AI miễn phí hôm nay",
};

/**
 * Daily fair-use AI cap for paid Premium accounts (default 20 calls/day per feature bucket,
 * Vietnam timezone UTC+7). Override via AI_PREMIUM_DAILY_LIMIT (1–500).
 */
export function getPremiumDailyAiLimit(): number {
  const raw = process.env.AI_PREMIUM_DAILY_LIMIT?.trim();
  if (!raw) return DEFAULT_PREMIUM_DAILY_AI_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PREMIUM_DAILY_AI_LIMIT;
  return Math.min(500, parsed);
}

export function getQuotaWindowStartIso(
  period: "monthly" | "daily",
  now: Date = new Date()
): string {
  if (period === "monthly") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
  const vnDate = getVietnamDateString(now);
  return new Date(`${vnDate}T00:00:00+07:00`).toISOString();
}

function resolveQuotaPolicy(
  user: SessionUser | null,
  feature: MeteredFeature
): {
  isAdmin: boolean;
  isPremium: boolean;
  limit: number | null;
  period: "monthly" | "daily";
} {
  const isAdmin = user?.role === "admin";
  const isPremium = Boolean(user?.isPremium);
  if (isAdmin) {
    return {
      isAdmin: true,
      isPremium: true,
      limit: null,
      period: "daily",
    };
  }
  if (isPremium) {
    return {
      isAdmin: false,
      isPremium: true,
      limit: getPremiumDailyAiLimit(),
      period: "daily",
    };
  }
  const cfg = FREE_LIMITS[feature];
  return {
    isAdmin: false,
    isPremium: false,
    limit: cfg.limit,
    period: cfg.period,
  };
}

/**
 * Read-only usage snapshot for UI quota badges and post-request refresh.
 * Only counts real billable AI calls (excludes cache hits and released/failed calls).
 */
export async function checkUsageLimit(
  user: SessionUser | null,
  feature: MeteredFeature,
  fallbackActorId: string = "guest"
): Promise<UsageCheckResult> {
  const policy = resolveQuotaPolicy(user, feature);
  if (policy.isAdmin) {
    return {
      allowed: true,
      used: 0,
      limit: null,
      remaining: null,
      period: policy.period,
      isPremium: true,
    };
  }

  const actorId = user?.id ?? fallbackActorId;
  const windowStartIso = getQuotaWindowStartIso(policy.period);
  const logs = await getUserAiUsageLogsSince(actorId, windowStartIso);

  const used = logs.filter((log) => {
    const bucket = log.quota_bucket ?? inferQuotaBucketFromFeature(log.feature);
    return bucket === feature && log.created_at >= windowStartIso;
  }).length;

  const limit = policy.limit!;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    period: policy.period,
    isPremium: policy.isPremium,
  };
}

/**
 * Atomically reserves 1 AI quota slot BEFORE calling Gemini to eliminate concurrent
 * request (TOCTOU) quota bypass. Caller MUST finalize on success or release on error/cache/mock.
 */
export async function reserveUsageLimit(params: {
  user: SessionUser | null;
  feature: MeteredFeature;
  rawFeatureName: string;
  skill?: string | null;
  model: string;
  fallbackActorId: string;
}): Promise<UsageReservationResult> {
  const policy = resolveQuotaPolicy(params.user, params.feature);
  const actorKey = normalizeAiActorKey(
    params.user?.id ? `u:${params.user.id}` : params.fallbackActorId
  );
  const windowStartIso = getQuotaWindowStartIso(policy.period);

  const res = await reserveAiQuotaRecord({
    actorKey,
    userId: params.user?.id ?? null,
    quotaBucket: params.feature,
    feature: params.rawFeatureName,
    skill: params.skill ?? null,
    model: params.model,
    limit: policy.limit,
    windowStartIso,
  });

  if (res.error) {
    return {
      allowed: false,
      reservationId: null,
      httpStatus: 503,
      limitReached: false,
      premiumCapReached: false,
      error: res.error,
      usage: {
        allowed: false,
        used: res.used,
        limit: policy.limit,
        remaining: res.remaining,
        period: policy.period,
        isPremium: policy.isPremium,
      },
    };
  }

  const usage: UsageCheckResult = {
    allowed: res.allowed,
    used: res.used,
    limit: policy.limit,
    remaining: res.remaining,
    period: policy.period,
    isPremium: policy.isPremium,
  };

  if (!res.allowed) {
    if (policy.isPremium) {
      return {
        allowed: false,
        usage,
        reservationId: null,
        httpStatus: 429,
        limitReached: false,
        premiumCapReached: true,
        error: `Bạn đã dùng hết hạn mức ${policy.limit} lượt AI trong ngày hôm nay cho gói Premium. Hạn mức sẽ tự động làm mới vào 00:00 ngày mai (giờ Việt Nam).`,
      };
    }

    return {
      allowed: false,
      usage,
      reservationId: null,
      httpStatus: 402,
      limitReached: true,
      premiumCapReached: false,
      error: `Bạn đã dùng hết ${policy.limit} lượt ${FREE_LIMIT_LABELS_VI[params.feature]}. Nâng cấp Premium để tăng lên ${getPremiumDailyAiLimit()} lượt/ngày.`,
    };
  }

  return {
    allowed: true,
    usage,
    reservationId: res.reservationId,
    httpStatus: 200,
    limitReached: false,
    premiumCapReached: false,
  };
}
