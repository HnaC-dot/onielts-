import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { listAdminUsers } from "@/lib/cms-system";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const role = (searchParams.get("role") ?? "") as "" | "learner" | "editor" | "admin";
  const premium = (searchParams.get("premium") ?? "") as "" | "active" | "free";
  const locked = (searchParams.get("locked") ?? "") as "" | "true" | "false";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "25") || 25;

  const data = await listAdminUsers({ q, role, premium, locked, page, pageSize });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
