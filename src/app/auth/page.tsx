"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Crown, Loader2, Mail, Shield, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { TurnstileWidget } from "@/components/turnstile-widget";
import {
  createSupabaseBrowserClient,
  isSupabaseClientConfigured,
} from "@/lib/supabase/client";

function getReadableAuthError(code: string, isEn: boolean): string {
  switch (code) {
    case "access_denied":
      return isEn
        ? "Google sign-in was cancelled or denied. You can try again below."
        : "Bạn đã hủy hoặc từ chối đăng nhập Google. Vui lòng thử lại bên dưới.";
    case "provider_error":
      return isEn
        ? "The sign-in provider returned an error. Please try again or use Email OTP."
        : "Nhà cung cấp đăng nhập trả về lỗi. Vui lòng thử lại hoặc dùng Email OTP.";
    case "exchange_failed":
      return isEn
        ? "Could not finish creating your session after Google sign-in. Please try signing in again."
        : "Không thể hoàn tất phiên đăng nhập sau khi xác thực Google. Vui lòng thử đăng nhập lại.";
    case "otp_failed":
      return isEn
        ? "The email sign-in link or code is invalid or expired. Please request a new one."
        : "Liên kết hoặc mã đăng nhập qua Email đã hết hạn hoặc không hợp lệ. Vui lòng gửi lại.";
    case "missing_code":
      return isEn
        ? "The sign-in callback was missing a verification code. Please start sign-in again."
        : "Đường dẫn xác thực thiếu mã đăng nhập. Vui lòng bắt đầu đăng nhập lại từ trang này.";
    case "supabase_unconfigured":
      return isEn
        ? "Authentication service is not configured on the server yet."
        : "Dịch vụ xác thực (Supabase Auth) chưa được cấu hình trên máy chủ.";
    default:
      return isEn
        ? "Sign-in did not complete. Please try again or use Email OTP."
        : "Đăng nhập Google chưa hoàn tất. Vui lòng thử lại hoặc dùng Email OTP.";
  }
}

function sanitizeNextPath(raw: string | null): string {
  if (!raw) return "/";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export default function AuthPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const isEn = locale === "en";
  const router = useRouter();
  const supabaseReady = isSupabaseClientConfigured();

  const [demoEnabled, setDemoEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && /^[a-z0-9_-]{3,32}$/i.test(ref)) {
      document.cookie = `onielts_ref=${encodeURIComponent(ref.toUpperCase())}; path=/; max-age=2592000; samesite=lax`;
    }
    const authError = params.get("error");

    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        if (authError) {
          setErrorMsg(getReadableAuthError(authError, isEn));
        }
        if (d && typeof d.demoEnabled === "boolean") {
          setDemoEnabled(d.demoEnabled);
        }
      })
      .catch(() => {
        if (!active) return;
        if (authError) {
          setErrorMsg(getReadableAuthError(authError, isEn));
        }
      });

    return () => {
      active = false;
    };
  }, [isEn]);

  const getNextPath = () => {
    if (typeof window === "undefined") return "/";
    const params = new URLSearchParams(window.location.search);
    return sanitizeNextPath(params.get("next"));
  };

  const buildCallbackUrl = () => {
    const nextPath = getNextPath();
    return nextPath === "/"
      ? `${window.location.origin}/auth/callback?next=/`
      : `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    if (supabaseReady) {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        const redirectTo = buildCallbackUrl();
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (error) {
          setErrorMsg(
            error.message ||
              (isEn
                ? "Could not connect to Google Sign-In."
                : "Không thể kết nối Google Sign-In.")
          );
        }
        return;
      }
    }
    if (demoEnabled) {
      await handleDemoSwitch("demo-free-001");
      return;
    }
    setErrorMsg(
      isEn
        ? "Google Sign-In is not enabled on this server."
        : "Đăng nhập Google chưa được kích hoạt trên hệ thống."
    );
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot.trim().length > 0) return;
    setLoading(true);
    setErrorMsg("");
    setStatusMsg("");
    try {
      if (supabaseReady) {
        const supabase = createSupabaseBrowserClient();
        if (supabase) {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: true,
              emailRedirectTo: buildCallbackUrl(),
              ...(turnstileToken ? { captchaToken: turnstileToken } : {}),
            },
          });
          if (error) {
            setErrorMsg(
              error.message ||
                (isEn
                  ? "Could not send sign-in email."
                  : "Không thể gửi email đăng nhập.")
            );
            setTurnstileReset((n) => n + 1);
            return;
          }
          setOtpSent(true);
          setTurnstileReset((n) => n + 1);
          setStatusMsg(
            isEn
              ? "Sign-in email sent! Open your inbox and click the sign-in link (or enter the 6-digit OTP code if shown)."
              : "Đã gửi email đăng nhập! Hãy mở Gmail và bấm nút 'Sign in' trong thư (hoặc nhập mã 6 số nếu có)."
          );
          return;
        }
      }

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_otp",
          email,
          honeypot,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "Không thể gửi mã OTP");
        setTurnstileReset((n) => n + 1);
        return;
      }
      setOtpSent(true);
      setTurnstileReset((n) => n + 1);
      setStatusMsg(data.message || "Đã gửi email đăng nhập.");
    } catch {
      setErrorMsg(isEn ? "Server connection error." : "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_otp", email, code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "Mã OTP không hợp lệ");
        return;
      }
      router.push(getNextPath());
      router.refresh();
    } catch {
      setErrorMsg(isEn ? "Server connection error." : "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSwitch = async (userId: string) => {
    if (!demoEnabled) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "demo_switch", userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "Chế độ dùng thử không khả dụng.");
        return;
      }
      router.push(getNextPath());
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <div className="mb-6 flex justify-center">
        <BrandLogo />
      </div>
      <Card className="p-6 sm:p-8">
        <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-white">
          {t("title")}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          {t("subtitle")}
        </p>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-6 w-full"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
            />
            <path
              fill="#34A853"
              d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
            />
          </svg>
          {t("googleButton")}
        </Button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          <span className="text-xs font-medium text-slate-500">{t("orEmail")}</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>

        {!otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-3">
            <input
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t("emailLabel")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
            <TurnstileWidget
              onToken={setTurnstileToken}
              resetSignal={turnstileReset}
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("sendOtp")}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            {statusMsg && (
              <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {statusMsg}
              </p>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t("otpLabel")}
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-lg font-bold tracking-widest text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("verifyOtp")}
            </Button>
          </form>
        )}

        {errorMsg && (
          <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400">
            {errorMsg}
          </p>
        )}

        {demoEnabled && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              {t("demoTitle")}
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {t("demoSubtitle")}
            </p>
            <div className="mt-3 grid gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                id="demo-login-free"
                onClick={() => handleDemoSwitch("demo-free-001")}
                className="justify-start"
              >
                <User className="h-4 w-4 text-slate-500" />
                {t("demoFree")} (minh.anh@onielts.vn)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                id="demo-login-premium"
                onClick={() => handleDemoSwitch("demo-premium-002")}
                className="justify-start"
              >
                <Crown className="h-4 w-4 text-amber-500" />
                {t("demoPremium")} (hoang.nam@onielts.vn)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                id="demo-login-admin"
                onClick={() => handleDemoSwitch("demo-admin-003")}
                className="justify-start"
              >
                <Shield className="h-4 w-4 text-emerald-600" />
                {t("demoAdmin")} (admin@onielts.vn)
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
