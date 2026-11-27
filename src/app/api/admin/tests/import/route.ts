import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, verifySameOrigin } from "@/lib/admin-auth";
import { bulkImportTestsAsDraft } from "@/lib/cms-content-production";
import {
  parseBulkTestCsv,
  parseBulkTestJson,
  type BulkImportIssue,
} from "@/lib/content-production-shared";
import { getIeltsTests } from "@/lib/db";

export const dynamic = "force-dynamic";

const importRequestSchema = z.object({
  mode: z.enum(["validate", "import"]).default("validate"),
  format: z.enum(["csv", "json"]),
  content: z
    .string()
    .min(2, "Vui lòng tải lên hoặc dán nội dung file CSV/JSON.")
    .max(2_000_000, "File nhập vượt quá giới hạn 2 MB."),
});

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const rawBody = await req.json().catch(() => null);
  const parsedBody = importRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message || "Yêu cầu nhập không hợp lệ." },
      { status: 400 }
    );
  }

  const { mode, format, content } = parsedBody.data;
  const result =
    format === "csv" ? parseBulkTestCsv(content) : parseBulkTestJson(content);

  const existingTests = await getIeltsTests(true);
  const existingSlugs = new Set(existingTests.map((t) => t.slug.toLowerCase()));

  const errors: BulkImportIssue[] = [...result.errors];
  const validImportable = [];

  for (let i = 0; i < result.tests.length; i++) {
    const t = result.tests[i];
    if (existingSlugs.has(t.slug.toLowerCase())) {
      errors.push({
        row: i + 1,
        slug: t.slug,
        field: "slug",
        severity: "error",
        message: `Slug "${t.slug}" đã tồn tại trong hệ thống. Vui lòng đổi slug khác trước khi nhập.`,
      });
      continue;
    }
    validImportable.push(t);
  }

  const previews = validImportable.map((t) => ({
    slug: t.slug,
    title_vi: t.title_vi,
    skill: t.skill,
    module: t.module,
    duration_minutes: t.duration_minutes,
    sectionCount: t.sections.length,
    questionCount: t.sections.reduce((acc, s) => acc + s.questions.length, 0),
  }));

  if (mode === "validate") {
    return NextResponse.json({
      format,
      totalRows: result.totalRows,
      validCount: validImportable.length,
      previews,
      errors,
      warnings: result.warnings,
      canImport: errors.length === 0 && validImportable.length > 0,
    });
  }

  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: `Phát hiện ${errors.length} lỗi dữ liệu. Vui lòng sửa toàn bộ lỗi trước khi nhập hàng loạt.`,
        errors,
        warnings: result.warnings,
      },
      { status: 400 }
    );
  }

  if (validImportable.length === 0) {
    return NextResponse.json(
      { error: "Không có đề thi hợp lệ nào để nhập." },
      { status: 400 }
    );
  }

  if (validImportable.length > 50) {
    return NextResponse.json(
      { error: "Mỗi lần nhập tối đa 50 đề thi để đảm bảo hiệu năng." },
      { status: 400 }
    );
  }

  const imported = await bulkImportTestsAsDraft(validImportable, guard.user);

  return NextResponse.json(
    {
      ok: true,
      createdCount: imported.created.length,
      failedCount: imported.failed.length,
      created: imported.created.map((t) => ({
        id: t.id,
        slug: t.slug,
        title_vi: t.title_vi,
        skill: t.skill,
        questionCount: t.questionCount,
        is_published: t.is_published,
      })),
      failed: imported.failed,
      warnings: result.warnings,
    },
    { status: 201 }
  );
}
