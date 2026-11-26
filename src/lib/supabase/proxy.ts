import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Official @supabase/ssr session refresh helper for Next.js 16 Proxy (`src/proxy.ts`).
 * Binds createServerClient to incoming request cookies and outgoing response cookies,
 * then calls `supabase.auth.getUser()` so expired access tokens are refreshed before
 * Server Components read them.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Do not place unrelated logic between createServerClient and getUser().
  // Calling getUser() refreshes expired tokens and triggers setAll() on the response.
  const { error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    console.error("[proxy.updateSession] supabase.auth.getUser failed", {
      pathname: request.nextUrl.pathname,
      errorName: error.name,
      status: error.status ?? null,
      code: error.code ?? null,
      message: error.message,
    });
  }

  return supabaseResponse;
}
