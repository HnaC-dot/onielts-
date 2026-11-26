import { NextResponse } from "next/server";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import { APPEARANCE_PREVIEW_COOKIE } from "@/lib/cms-appearance";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ (CSRF origin mismatch)." },
      { status: 403 }
    );
  }
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => null)) as { enabled?: boolean } | null;
  const enabled = Boolean(body?.enabled);

  const res = NextResponse.json({ previewEnabled: enabled });
  if (enabled) {
    res.cookies.set(APPEARANCE_PREVIEW_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60, // 1 hour preview session
    });
  } else {
    res.cookies.delete(APPEARANCE_PREVIEW_COOKIE);
  }
  return res;
}
