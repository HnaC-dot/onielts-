import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  createSupabaseRouteClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { ensureProfileForAuthUser } from "@/lib/auth";

function getSafeRedirectBase(request: Request, fallbackOrigin: string): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const isLocalEnv = process.env.NODE_ENV === "development";
  if (
    !isLocalEnv &&
    forwardedHost &&
    /^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost)
  ) {
    return `https://${forwardedHost}`;
  }
  return fallbackOrigin;
}

function redirectWithNoStore(url: string): NextResponse {
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirectBase = getSafeRedirectBase(request, origin);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const providerError = searchParams.get("error");
  const providerErrorCode = searchParams.get("error_code");
  const providerErrorDesc = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (providerError) {
    console.error("[auth.callback] provider returned error", {
      error: providerError,
      errorCode: providerErrorCode,
      description: providerErrorDesc,
    });
    const mapped =
      providerError === "access_denied" ? "access_denied" : "provider_error";
    return redirectWithNoStore(`${redirectBase}/auth?error=${mapped}`);
  }

  if (!isSupabaseConfigured()) {
    console.error("[auth.callback] supabase is not configured");
    return redirectWithNoStore(`${redirectBase}/auth?error=supabase_unconfigured`);
  }

  const routeClient = await createSupabaseRouteClient();
  if (!routeClient) {
    console.error("[auth.callback] failed to create route Supabase client");
    return redirectWithNoStore(`${redirectBase}/auth?error=supabase_unconfigured`);
  }

  const { supabase, applyCookies } = routeClient;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth.callback] exchangeCodeForSession failed", {
        errorName: error.name,
        status: error.status ?? null,
        code: error.code ?? null,
        message: error.message,
      });
      return redirectWithNoStore(`${redirectBase}/auth?error=exchange_failed`);
    }

    if (data.user) {
      await ensureProfileForAuthUser(supabase, data.user);
    }

    const response = redirectWithNoStore(`${redirectBase}${safeNext}`);
    return applyCookies(response);
  }

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      console.error("[auth.callback] verifyOtp failed", {
        errorName: error.name,
        status: error.status ?? null,
        code: error.code ?? null,
        message: error.message,
      });
      return redirectWithNoStore(`${redirectBase}/auth?error=otp_failed`);
    }

    if (data.user) {
      await ensureProfileForAuthUser(supabase, data.user);
    }

    const response = redirectWithNoStore(`${redirectBase}${safeNext}`);
    return applyCookies(response);
  }

  console.error("[auth.callback] missing code or token_hash in callback URL");
  return redirectWithNoStore(`${redirectBase}/auth?error=missing_code`);
}
