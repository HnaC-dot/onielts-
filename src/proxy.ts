import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { findMatchingActiveRedirect } from "@/lib/seo-redirects-edge";
import {
  computeCanonicalDomainRedirect,
  isNoindexRoutePath,
} from "@/lib/domain-redirect";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (request.method === "GET" || request.method === "HEAD") {
    // 1. Permanent 301 canonical domain redirect (*.vercel.app & www/non-www -> NEXT_PUBLIC_SITE_URL)
    const requestHost =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      request.nextUrl.host;
    const domainRedirectTarget = computeCanonicalDomainRedirect({
      requestHost,
      pathname,
      search: request.nextUrl.search,
    });
    if (domainRedirectTarget) {
      return NextResponse.redirect(domainRedirectTarget, { status: 301 });
    }

    // 2. Active CMS 301/302 path redirects on public GET/HEAD navigation paths
    const matched = await findMatchingActiveRedirect(pathname);
    if (matched) {
      const targetUrl = new URL(matched.destination_path, request.nextUrl.origin);
      // Preserve incoming query params (e.g. UTM tags) if destination has none
      if (!targetUrl.search && request.nextUrl.search) {
        targetUrl.search = request.nextUrl.search;
      }
      return NextResponse.redirect(targetUrl, { status: matched.status_code });
    }
  }

  const response = await updateSession(request);

  // 3. Enforce X-Robots-Tag: noindex, nofollow on /admin, /auth, /api, and personal pages
  if (isNoindexRoutePath(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - /api/webhooks/* (external webhook endpoints, e.g. PayOS)
     * - static image/audio/font assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/webhooks(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif|mp3|wav|woff2?)$).*)",
  ],
};
