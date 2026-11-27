import "server-only";

export interface BotCheckResult {
  passed: boolean;
  mode: "turnstile" | "honeypot";
  reason?: string;
}

let warnedMissingSiteKey = false;

/**
 * Turnstile is enforced only when BOTH server secret and client site key are configured,
 * preventing public forms from bricking if only TURNSTILE_SECRET_KEY was added to env.
 */
export function isTurnstileFullyConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  );
}

/**
 * Verifies Cloudflare Turnstile CAPTCHA when both TURNSTILE_SECRET_KEY and
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY are configured, and falls back to honeypot check
 * when Turnstile is not enabled.
 */
export async function verifyBotProtection(params: {
  turnstileToken?: string;
  honeypot?: string;
  remoteIp?: string;
}): Promise<BotCheckResult> {
  if (params.honeypot && params.honeypot.trim().length > 0) {
    return {
      passed: false,
      mode: "honeypot",
      reason: "Phát hiện hành vi tự động không hợp lệ.",
    };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (!secret || !siteKey) {
    if (secret && !siteKey && !warnedMissingSiteKey) {
      warnedMissingSiteKey = true;
      console.warn(
        "[bot-protection] TURNSTILE_SECRET_KEY is set without NEXT_PUBLIC_TURNSTILE_SITE_KEY; falling back to honeypot check."
      );
    }
    return { passed: true, mode: "honeypot" };
  }

  const token = params.turnstileToken?.trim();
  if (!token) {
    return {
      passed: false,
      mode: "turnstile",
      reason: "Vui lòng hoàn tất xác minh chống bot (CAPTCHA).",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    if (params.remoteIp && params.remoteIp !== "unknown" && params.remoteIp !== "local") {
      form.append("remoteip", params.remoteIp);
    }

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
        signal: controller.signal,
      }
    );
    if (!res.ok) {
      return {
        passed: false,
        mode: "turnstile",
        reason: "Máy chủ CAPTCHA không phản hồi hợp lệ.",
      };
    }
    const data = (await res.json()) as { success?: boolean };
    return {
      passed: Boolean(data.success),
      mode: "turnstile",
      reason: data.success ? undefined : "Xác minh chống bot thất bại. Vui lòng thử lại.",
    };
  } catch {
    return {
      passed: false,
      mode: "turnstile",
      reason: "Lỗi kết nối máy chủ CAPTCHA. Vui lòng thử lại.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
