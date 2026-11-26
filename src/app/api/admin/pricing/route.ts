import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  createPromoCodeCms,
  deletePromoCodeCms,
  getAdminPricingBundle,
  saveReferralConfigCms,
  togglePromoCodeCms,
  updatePromoBannerCms,
  upsertPricingPlanCms,
} from "@/lib/cms-system";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const data = await getAdminPricingBundle();
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Yêu cầu khác nguồn không hợp lệ." }, { status: 403 });
  }
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload JSON không hợp lệ." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  if (action === "upsert_plan") {
    const res = await upsertPricingPlanCms(body.plan, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  }
  if (action === "update_banner") {
    const res = await updatePromoBannerCms(body.banner, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  }
  if (action === "create_promo_code") {
    const res = await createPromoCodeCms(body.promoCode, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  if (action === "toggle_promo_code") {
    const res = await togglePromoCodeCms(
      String(body.id ?? ""),
      Boolean(body.is_active),
      guard.user
    );
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  }
  if (action === "save_referral_config") {
    const res = await saveReferralConfigCms(body.config, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true, config: res.config });
  }

  return NextResponse.json({ error: "Hành động không hợp lệ." }, { status: 400 });
}

export async function DELETE(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Yêu cầu khác nguồn không hợp lệ." }, { status: 403 });
  }
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "";
  const id = searchParams.get("id") ?? "";
  if (type === "promo_code" && id) {
    const res = await deletePromoCodeCms(id, guard.user);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Tham số xóa không hợp lệ." }, { status: 400 });
}
