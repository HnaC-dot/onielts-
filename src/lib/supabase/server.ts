import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called inside Server Component where cookies are read-only
          }
        },
      },
    }
  );
}

/**
 * Route Handler Supabase client that captures all Set-Cookie operations so they
 * can be explicitly attached onto the returned NextResponse (including redirects).
 */
export async function createSupabaseRouteClient(): Promise<{
  supabase: SupabaseClient;
  applyCookies: <T extends NextResponse>(response: T) => T;
} | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const cookieStore = await cookies();
  const pendingCookies = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const key = `${name}::${options.domain ?? ""}`;
            pendingCookies.set(key, { name, value, options });
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore if cookieStore is read-only
            }
          });
        },
      },
    }
  );

  return {
    supabase,
    applyCookies<T extends NextResponse>(response: T): T {
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      return response;
    },
  };
}

/**
 * Server-only Service Role client — NEVER import in client components.
 * Used exclusively for verified webhooks (PayOS) and system tasks.
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  if (!isServiceRoleConfigured()) {
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
