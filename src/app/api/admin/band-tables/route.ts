import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  recordAuditLog,
  requireStaff,
  verifySameOrigin,
} from "@/lib/admin-auth";
import { adminUpdateBandRow, getBandConversionTables } from "@/lib/db";

export const dynamic = "force-dynamic";

const bandUpdateSchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.string().min(1),
        min_raw: z.coerce.number().int().min(0).max(40),
        max_raw: z.coerce.number().int().min(0).max(40),
        band_score: z.coerce.number().min(0).max(9),
      })
    )
    .min(1)
    .max(60),
});

export async function GET() {
  const guard = await requireStaff("admin");
  if (!guard.ok) return guard.response;

  const rows = await getBandConversionTables();
  return NextResponse.json(
    { rows },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(req: Request) {
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

  const parsed = bandUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu bảng quy đổi Band không hợp lệ.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  for (const row of parsed.data.rows) {
    if (row.max_raw < row.min_raw) {
      return NextResponse.json(
        { error: `Mức Band ${row.band_score}: số câu tối đa (${row.max_raw}) phải >= tối thiểu (${row.min_raw}).` },
        { status: 400 }
      );
    }
  }

  for (const row of parsed.data.rows) {
    await adminUpdateBandRow(row.id, {
      min_raw: row.min_raw,
      max_raw: row.max_raw,
      band_score: row.band_score,
    });
  }

  await recordAuditLog({
    actor: guard.user,
    action: "update_band_table",
    entityType: "band_conversion",
    entityLabel: `${parsed.data.rows.length} mức quy đổi`,
    summary: `Cập nhật ${parsed.data.rows.length} dòng trong Bảng quy đổi điểm Band IELTS`,
  });

  try {
    revalidatePath("/band-calculator");
    revalidatePath("/tests");
    revalidatePath("/admin/band-tables");
  } catch {
    // ignore outside Next request context
  }

  const updated = await getBandConversionTables();
  return NextResponse.json(
    { ok: true, rows: updated },
    { headers: { "Cache-Control": "no-store" } }
  );
}
