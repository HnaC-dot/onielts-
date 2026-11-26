import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
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
