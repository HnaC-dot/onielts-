import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  deleteContactMessageCms,
  deleteFeatureRequestCms,
  listInboxBundle,
  updateContactMessageCms,
  updateFeatureRequestCms,
} from "@/lib/cms-system";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const data = await listInboxBundle();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Yêu cầu khác nguồn không hợp lệ." }, { status: 403 });
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload JSON không hợp lệ." }, { status: 400 });
  }

  const kind = String(body.kind ?? "");
  if (kind === "contact") {
    const res = await updateContactMessageCms(body, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  }
  if (kind === "feature_request") {
    const res = await updateFeatureRequestCms(body, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Loại mục không hợp lệ." }, { status: 400 });
}

export async function DELETE(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Yêu cầu khác nguồn không hợp lệ." }, { status: 403 });
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "";
  const id = searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json({ error: "Thiếu ID cần xóa." }, { status: 400 });
  }

  if (kind === "contact") {
    const res = await deleteContactMessageCms(id, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  }
  if (kind === "feature_request") {
    const res = await deleteFeatureRequestCms(id, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Loại mục cần xóa không hợp lệ." }, { status: 400 });
}
