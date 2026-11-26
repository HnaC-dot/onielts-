import { NextResponse } from "next/server";
import { getAuthState } from "@/lib/auth";
import {
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Auth & environment health probe.
 * Returns ONLY booleans and non-sensitive role — never secrets, tokens, emails, or UUIDs.
 */
export async function GET() {
  const authState = await getAuthState();
  const authenticated =
    authState.status === "authenticated" || authState.status === "profile_error";
  const profileRowFound =
    authState.status === "authenticated" && Boolean(authState.user);

  return NextResponse.json(
    {
      supabaseConfigured: isSupabaseConfigured(),
      serviceRoleKeyPresent: isServiceRoleConfigured(),
      appUrlSet: Boolean(
        process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
          process.env.NEXT_PUBLIC_APP_URL?.trim()
      ),
      authenticated,
      profileRowFound,
      role: authState.user?.role ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
