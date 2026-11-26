import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          await getCurrentUser();
          return NextResponse.redirect(`${origin}${safeNext}`);
        }
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (!error) {
          await getCurrentUser();
          return NextResponse.redirect(`${origin}${safeNext}`);
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=oauth_failed`);
}
