import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import { listMediaAssets, uploadMediaAsset } from "@/lib/cms-media";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const rawKind = searchParams.get("kind") ?? "all";
  const kind = (
    ["all", "image", "svg", "audio", "pdf"].includes(rawKind) ? rawKind : "all"
  ) as "all" | "image" | "svg" | "audio" | "pdf";
  const folder = searchParams.get("folder") ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "24") || 24;
  const includeUsage = searchParams.get("includeUsage") !== "0";

  const result = await listMediaAssets({
    q,
    kind,
    folder,
    page,
    pageSize,
    includeUsage,
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

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Thiếu tệp tải lên (field 'file')." },
        { status: 400 }
      );
    }

    const folder = String(formData.get("folder") ?? "general");
    const altText = String(formData.get("altText") ?? "");
    const rawW = formData.get("width");
    const rawH = formData.get("height");
    const width = rawW && /^\d+$/.test(String(rawW)) ? Number(rawW) : null;
    const height = rawH && /^\d+$/.test(String(rawH)) ? Number(rawH) : null;

    const result = await uploadMediaAsset({
      file,
      folder,
      altText,
      width,
      height,
      actor: guard.user,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(
      { ok: true, asset: result.asset },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Lỗi không xác định khi tải tệp lên.",
      },
      { status: 500 }
    );
  }
}
