import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import { deleteMediaAsset, updateMediaAssetMeta } from "@/lib/cms-media";

export const dynamic = "force-dynamic";

const patchMediaSchema = z.object({
  alt_text: z.string().max(200).optional(),
  folder: z.string().max(40).optional(),
});

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

  const parsed = patchMediaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu cập nhật không hợp lệ.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await updateMediaAssetMeta({
    id,
    alt_text: parsed.data.alt_text,
    folder: parsed.data.folder,
    actor: guard.user,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ok: true, asset: result.asset },
    { headers: { "Cache-Control": "no-store" } }
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
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true" || searchParams.get("force") === "1";

  const result = await deleteMediaAsset({
    id,
    force,
    actor: guard.user,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, usages: result.usages ?? [] },
      { status: result.status }
    );
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
