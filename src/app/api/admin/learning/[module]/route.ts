import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import { createLearningItem, listLearningItems } from "@/lib/cms-learning";
import { isLearningModuleKey } from "@/lib/learning-cms-shared";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ module: string }> }
) {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { module: mod } = await context.params;
  if (!isLearningModuleKey(mod)) {
    return NextResponse.json({ error: "Module không hợp lệ." }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const filter = searchParams.get("filter") ?? "";
  const published = (searchParams.get("published") ?? "") as "" | "true" | "false";
  const premium = (searchParams.get("premium") ?? "") as "" | "true" | "false";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "25") || 25;

  const data = await listLearningItems(mod, {
    q,
    filter,
    published,
    premium,
    page,
    pageSize,
  });

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ module: string }> }
) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Yêu cầu khác nguồn không hợp lệ." }, { status: 403 });
  }

  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { module: mod } = await context.params;
  if (!isLearningModuleKey(mod)) {
    return NextResponse.json({ error: "Module không hợp lệ." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON không hợp lệ." }, { status: 400 });
  }

  const res = await createLearningItem(mod, body, guard.user);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ ok: true, item: res.item }, { status: 201 });
}
