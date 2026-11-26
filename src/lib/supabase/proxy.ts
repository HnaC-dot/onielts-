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
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    console.error("[proxy.updateSession] supabase.auth.getUser failed", {
      pathname: request.nextUrl.pathname,
      errorName: error.name,
      status: error.status ?? null,
      code: error.code ?? null,
      message: error.message,
    });
  }

  const pathname = request.nextUrl.pathname;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi =
    pathname === "/api/admin" || pathname.startsWith("/api/admin/");

  if (isAdminApi) {
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập bằng tài khoản Admin hoặc Editor." },
        { status: 401 }
      );
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profile &&
      ((profile.role !== "admin" && profile.role !== "editor") ||
        profile.is_locked === true)
    ) {
      return NextResponse.json(
        { error: "Tài khoản không có quyền truy cập API quản trị." },
        { status: 403 }
      );
    }
  } else if (isAdminPage) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/auth";
      loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
      const redirectResponse = NextResponse.redirect(loginUrl);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }

    // For nested /admin/* sub-routes, block non-staff/locked users at proxy level
    // (Allow /admin itself to render the detailed diagnostic denial card & SQL guide.)
    if (pathname !== "/admin") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (
        profile &&
        ((profile.role !== "admin" && profile.role !== "editor") ||
          profile.is_locked === true)
      ) {
        const deniedUrl = request.nextUrl.clone();
        deniedUrl.pathname = "/admin";
        deniedUrl.search = "?denied=forbidden";
        const redirectResponse = NextResponse.redirect(deniedUrl);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie);
        });
        return redirectResponse;
      }
    }
  }

  return supabaseResponse;
}
