import { NextResponse } from "next/server";
import { listAuditLogs, requireStaff } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q") ?? "";
  const entityType = searchParams.get("entityType") ?? "";
  const actorRole = searchParams.get("actorRole") ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "20") || 20;

  const result = await listAuditLogs({
    search,
    entityType,
    actorRole,
    page,
    pageSize,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
