import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  deleteLearningItem,
  duplicateLearningItem,
  getLearningItemById,
  updateLearningItem,
} from "@/lib/cms-learning";
import { isLearningModuleKey } from "@/lib/learning-cms-shared";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ module: string; id: string }> }
) {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { module: mod, id } = await context.params;
  if (!isLearningModuleKey(mod)) {
    return NextResponse.json({ error: "Module không hợp lệ." }, { status: 400 });
  }

  const item = await getLearningItemById(mod, id);
  if (!item) {
    return NextResponse.json({ error: "Không tìm thấy mục dữ liệu." }, { status: 404 });
  }
  return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ module: string; id: string }> }
) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Yêu cầu khác nguồn không hợp lệ." }, { status: 403 });
  }

  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { module: mod, id } = await context.params;
  if (!isLearningModuleKey(mod)) {
    return NextResponse.json({ error: "Module không hợp lệ." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON không hợp lệ." }, { status: 400 });
  }

  const res = await updateLearningItem(mod, id, body, guard.user);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({
    ok: true,
    item: res.item,
    redirectCreated: Boolean(res.redirectCreated),
  });
}

// POST on [id] duplicates item as draft
export async function POST(
  req: Request,
  context: { params: Promise<{ module: string; id: string }> }
) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Yêu cầu khác nguồn không hợp lệ." }, { status: 403 });
  }

  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { module: mod, id } = await context.params;
  if (!isLearningModuleKey(mod)) {
    return NextResponse.json({ error: "Module không hợp lệ." }, { status: 400 });
  }

  const res = await duplicateLearningItem(mod, id, guard.user);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, item: res.item }, { status: 201 });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ module: string; id: string }> }
) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Yêu cầu khác nguồn không hợp lệ." }, { status: 403 });
  }

  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const { module: mod, id } = await context.params;
  if (!isLearningModuleKey(mod)) {
    return NextResponse.json({ error: "Module không hợp lệ." }, { status: 400 });
  }

  const res = await deleteLearningItem(mod, id, guard.user);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
