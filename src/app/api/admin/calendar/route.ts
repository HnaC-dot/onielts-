import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  deleteContentCalendarItem,
  listContentCalendarItems,
  upsertContentCalendarItem,
} from "@/lib/cms-content-production";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? "";
  const contentType = searchParams.get("contentType") ?? "";
  const status = searchParams.get("status") ?? "";

  const result = await listContentCalendarItems({ month, contentType, status });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const res = await upsertContentCalendarItem(body, guard.user);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json(
    { item: res.item, tableReady: res.tableReady },
    { status: (body as { id?: string }).id ? 200 : 201 }
  );
}

export async function DELETE(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  let id = searchParams.get("id") ?? "";
  if (!id) {
    const body = await req.json().catch(() => null);
    if (body && typeof body === "object" && typeof (body as { id?: unknown }).id === "string") {
      id = (body as { id: string }).id;
    }
  }

  const res = await deleteContentCalendarItem(id, guard.user);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
