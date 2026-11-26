import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  getAdminSeoSettings,
  getSeoHealthAudit,
  listAdminSeoRedirects,
  saveAdminSeoSettings,
} from "@/lib/cms-seo";
import { getAppBaseUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const [settings, redirects, health] = await Promise.all([
    getAdminSeoSettings(),
    listAdminSeoRedirects(),
    getSeoHealthAudit(),
  ]);

  return NextResponse.json(
    {
      settings,
      redirects,
      health,
      baseUrl: getAppBaseUrl(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const result = await saveAdminSeoSettings(body, guard.user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ settings: result.settings });
}
