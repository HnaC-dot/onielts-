import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  deleteFaqCms,
  listPagesAndFaqsBundle,
  upsertFaqCms,
  upsertStaticPageCms,
} from "@/lib/cms-system";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const data = await listPagesAndFaqsBundle();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
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
  if (kind === "page") {
    const rawSlug =
      body.page && typeof body.page === "object"
        ? String((body.page as { slug?: unknown }).slug ?? "")
        : "";
    const normalizedSlug = rawSlug.trim().toLowerCase().replace(/^\/+/, "");
    if (normalizedSlug.startsWith("legal/")) {
      const adminGuard = await requireStaff("admin");
      if (!adminGuard.ok) return adminGuard.response;
    }
    const res = await upsertStaticPageCms(body.page, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, page: res.page });
  }
  if (kind === "faq") {
    const res = await upsertFaqCms(body.faq, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, faq: res.faq });
  }

  return NextResponse.json({ error: "Loại dữ liệu không hợp lệ." }, { status: 400 });
}

export async function DELETE(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Yêu cầu khác nguồn không hợp lệ." }, { status: 403 });
  }
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "";
  const id = searchParams.get("id") ?? "";
  if (kind === "faq" && id) {
    const res = await deleteFaqCms(id, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Tham số xóa không hợp lệ." }, { status: 400 });
}
