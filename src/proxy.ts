import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { findMatchingActiveRedirect } from "@/lib/seo-redirects-edge";

export async function proxy(request: NextRequest) {
  // Execute active CMS 301/302 SEO redirects on public GET/HEAD navigation paths
  if (request.method === "GET" || request.method === "HEAD") {
    const pathname = request.nextUrl.pathname;
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

  return updateSession(request);
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
