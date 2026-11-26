import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import { createCmsBlogPost, listAdminBlogPosts } from "@/lib/cms-blog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const rawStatus = searchParams.get("status") ?? "";
  const status = (
    ["draft", "published", "scheduled"].includes(rawStatus) ? rawStatus : ""
  ) as "" | "draft" | "published" | "scheduled";
  const featured = (searchParams.get("featured") ?? "") as "" | "true" | "false";
  const premium = (searchParams.get("premium") ?? "") as "" | "true" | "false";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "15") || 15;

  const result = await listAdminBlogPosts({
    q,
    category,
    status,
    featured,
    premium,
    page,
    pageSize,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }

  const result = await createCmsBlogPost(body, guard.user);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ok: true, post: result.post },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
