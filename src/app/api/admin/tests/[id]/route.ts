import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  deleteCmsTest,
  duplicateCmsTest,
  getAdminTestById,
  updateCmsTest,
} from "@/lib/cms-tests";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const test = await getAdminTestById(id);
  if (!test) {
    return NextResponse.json({ error: "Không tìm thấy đề thi." }, { status: 404 });
  }

  return NextResponse.json(
    { test },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  const result = await updateCmsTest(id, body, guard.user);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, validationErrors: result.validationErrors ?? [] },
      { status: result.status }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      test: result.test,
      redirectCreated: result.redirectCreated ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const result = await duplicateCmsTest(id, guard.user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ok: true, test: result.test },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const result = await deleteCmsTest(id, guard.user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
