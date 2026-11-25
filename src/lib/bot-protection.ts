import "server-only";

export interface BotCheckResult {
  passed: boolean;
  mode: "turnstile" | "honeypot";
  reason?: string;
}

/**
 * Verifies Cloudflare Turnstile CAPTCHA when TURNSTILE_SECRET_KEY is configured,
 * and falls back to honeypot check when running locally without Turnstile keys.
 */
export async function verifyBotProtection(params: {
  turnstileToken?: string;
  honeypot?: string;
}): Promise<BotCheckResult> {
  if (params.honeypot && params.honeypot.trim().length > 0) {
    return { passed: false, mode: "honeypot", reason: "Bot honeypot triggered." };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { passed: true, mode: "honeypot" };
  }

  if (!params.turnstileToken) {
    return { passed: false, mode: "turnstile", reason: "Thiếu mã xác minh CAPTCHA." };
  }

  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", params.turnstileToken);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form }
    );
    const data = (await res.json()) as { success?: boolean };
    return {
      passed: Boolean(data.success),
      mode: "turnstile",
      reason: data.success ? undefined : "Xác minh chống bot thất bại.",
    };
  } catch {
    return { passed: false, mode: "turnstile", reason: "Lỗi kết nối máy chủ CAPTCHA." };
  }
}
