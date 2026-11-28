import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  getAdminAppearanceBundle,
  publishAppearance,
  resetAppearanceScope,
  restoreAppearanceVersion,
  saveAppearanceDraft,
} from "@/lib/cms-appearance";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const bundle = await getAdminAppearanceBundle();
  return NextResponse.json(bundle, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const note = typeof body.note === "string" ? body.note.trim() : undefined;

  if (action === "save_draft") {
    const res = await saveAppearanceDraft(body.config, guard.user, note || "Lưu bản nháp giao diện");
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({
      draft: res.draft,
      history: res.history,
      hasUnpublishedChanges: true,
    });
  }

  if (action === "publish") {
    const res = await publishAppearance(body.config, guard.user, note || "Xuất bản Giao diện & Trang chủ");
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({
      published: res.published,
      draft: res.draft,
      history: res.history,
      hasUnpublishedChanges: false,
    });
  }

  if (action === "restore_version") {
    const versionId = String(body.versionId ?? "");
    const publishNow = Boolean(body.publishNow);
    const res = await restoreAppearanceVersion(versionId, publishNow, guard.user);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({
      published: res.published,
      draft: res.draft,
      history: res.history,
      hasUnpublishedChanges: !publishNow,
    });
  }

  if (action === "reset_defaults") {
    const rawScope = String(body.scope ?? "all");
    const validScopes = [
      "all",
      "theme",
      "heading_typography",
      "menus",
      "menu_names",
      "homepage",
      "ui_texts",
    ] as const;
    if (!validScopes.includes(rawScope as (typeof validScopes)[number])) {
      return NextResponse.json({ error: "Phạm vi khôi phục không hợp lệ." }, { status: 400 });
    }
    const publishNow = Boolean(body.publishNow);
    const res = await resetAppearanceScope(
      rawScope as (typeof validScopes)[number],
      publishNow,
      guard.user
    );
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({
      published: res.published,
      draft: res.draft,
      history: res.history,
      hasUnpublishedChanges: !publishNow,
    });
  }

  return NextResponse.json({ error: "Hành động không được hỗ trợ." }, { status: 400 });
}
