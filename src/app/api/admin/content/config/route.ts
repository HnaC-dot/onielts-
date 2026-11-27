import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  getBlogQualityConfig,
  getInternalLinkCatalog,
  saveBlogQualityConfig,
} from "@/lib/cms-content-production";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const [qualityConfig, linkCatalog] = await Promise.all([
    getBlogQualityConfig(),
    getInternalLinkCatalog(),
  ]);

  return NextResponse.json({
    qualityConfig,
    linkCatalog,
    canEditConfig: guard.user.role === "admin",
  });
}

export async function PATCH(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dữ liệu cấu hình không hợp lệ." }, { status: 400 });
  }

  const res = await saveBlogQualityConfig(body, guard.user);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ qualityConfig: res.config });
}
