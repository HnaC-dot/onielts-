import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import { bulkManageSampleTests } from "@/lib/cms-tests";

export const dynamic = "force-dynamic";

/**
 * Bulk actions for the built-in sample tests ("đề mẫu").
 * Body: `{ "action": "unpublish" | "delete" }` — admin only.
 */
export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }
  const action = (body as { action?: unknown } | null)?.action;
  if (action !== "unpublish" && action !== "delete") {
    return NextResponse.json(
      { error: "Thao tác không hợp lệ (chỉ hỗ trợ unpublish hoặc delete)." },
      { status: 400 }
    );
  }

  const result = await bulkManageSampleTests(action, guard.user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { ok: true, affected: result.affected },
    { headers: { "Cache-Control": "no-store" } }
  );
}
