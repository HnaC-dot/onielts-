import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import { createCmsTest, listAdminTests } from "@/lib/cms-tests";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const rawSkill = searchParams.get("skill") ?? "";
  const skill = (
    ["reading", "listening", "writing", "speaking"].includes(rawSkill)
      ? rawSkill
      : ""
  ) as "" | "reading" | "listening" | "writing" | "speaking";
  const rawModule = searchParams.get("module") ?? "";
  const mod = (
    ["academic", "general"].includes(rawModule) ? rawModule : ""
  ) as "" | "academic" | "general";
  const published = (searchParams.get("published") ?? "") as "" | "true" | "false";
  const premium = (searchParams.get("premium") ?? "") as "" | "true" | "false";
  const rawSource = searchParams.get("source") ?? "";
  const source = (
    rawSource === "sample" || rawSource === "own" ? rawSource : ""
  ) as "" | "sample" | "own";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "15") || 15;

  const result = await listAdminTests({
    q,
    skill,
    module: mod,
    published,
    premium,
    source,
    page,
    pageSize,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  const result = await createCmsTest(body, guard.user);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, validationErrors: result.validationErrors ?? [] },
      { status: result.status }
    );
  }

  return NextResponse.json(
    { ok: true, test: result.test },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
