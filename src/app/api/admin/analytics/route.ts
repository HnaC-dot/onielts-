import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { getAdminAnonymousAnalytics } from "@/lib/progress-analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const analytics = await getAdminAnonymousAnalytics();
  return NextResponse.json(analytics, {
    headers: { "Cache-Control": "no-store" },
  });
}
