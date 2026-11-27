import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import {
  deleteCmsBlogPost,
  duplicateCmsBlogPost,
  getAdminBlogPostById,
  updateCmsBlogPost,
} from "@/lib/cms-blog";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const post = await getAdminBlogPostById(id);
  if (!post) {
    return NextResponse.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
  }

  return NextResponse.json(
    { post },
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

  const result = await updateCmsBlogPost(id, body, guard.user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      ok: true,
      post: result.post,
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
  const result = await duplicateCmsBlogPost(id, guard.user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ok: true, post: result.post },
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
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const result = await deleteCmsBlogPost(id, guard.user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
