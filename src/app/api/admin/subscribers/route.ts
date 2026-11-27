import { NextResponse } from "next/server";
import {
  maskEmailAddress,
  recordAuditLog,
  requireStaff,
  verifySameOrigin,
} from "@/lib/admin-auth";
import {
  deleteNewsletterSubscriber,
  listNewsletterSubscribers,
} from "@/lib/cms-content-production";
import { buildSubscribersCsv } from "@/lib/content-production-shared";
import { getVietnamDateString } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const format = searchParams.get("format") ?? "json";

  if (format === "csv") {
    const adminGuard = await requireStaff("admin");
    if (!adminGuard.ok) return adminGuard.response;

    const result = await listNewsletterSubscribers({ q });
    const csv = buildSubscribersCsv(result.items);
    const dateStamp = getVietnamDateString();

    await recordAuditLog({
      actor: adminGuard.user,
      action: "newsletter_subscriber.export_csv",
      entityType: "newsletter_subscribers",
      entityLabel: `CSV (${result.items.length} emails)`,
      summary: `Xuất danh sách ${result.items.length} email đăng ký nhận bài (CSV${q ? `, lọc="${q}"` : ""})`,
      metadata: { count: result.items.length, filterQuery: q || null },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="on-ielts-subscribers-${dateStamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const isAdmin = guard.user.role === "admin";
  const result = await listNewsletterSubscribers({ q });
  const items = isAdmin
    ? result.items
    : result.items.map((item) => ({
        ...item,
        email: maskEmailAddress(item.email),
      }));

  return NextResponse.json(
    {
      items,
      total: items.length,
      tableReady: result.tableReady,
      isAdmin,
      emailsMasked: !isAdmin,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  let id = searchParams.get("id") ?? "";
  if (!id) {
    const body = await req.json().catch(() => null);
    if (body && typeof body === "object" && typeof (body as { id?: unknown }).id === "string") {
      id = (body as { id: string }).id;
    }
  }

  const res = await deleteNewsletterSubscriber(id, guard.user);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
