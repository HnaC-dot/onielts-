import "server-only";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { recordAuditLog } from "./admin-auth";
import {
  cmsTestFormSchema,
  validateTestForPublish,
  type CmsTestFormInput,
} from "./test-cms-shared";
import { slugifyVi } from "./seo";
import { sanitizeRichHtml } from "./sanitize";
import { invalidateSeoRedirectCache } from "./seo-redirects-edge";
import { readStore, updateStore } from "./store";
import type { IeltsTest, SeoMeta, SessionUser, TestSection } from "./types";

function mapAdminTestRow(row: Record<string, unknown>): IeltsTest {
  const td = (row.test_data as Record<string, unknown> | null) ?? {};
  const sections = Array.isArray(td.sections) ? (td.sections as TestSection[]) : [];
  const counted = sections.reduce((sum, s) => sum + (s.questions?.length ?? 0), 0);
  return {
    id: String(row.id),
    slug: String(row.slug),
    skill: row.skill as IeltsTest["skill"],
    module: (row.module as IeltsTest["module"]) ?? "academic",
    title_vi: String(row.title_vi ?? ""),
    title_en: String(row.title_en ?? row.title_vi ?? ""),
    description_vi: String(row.description_vi ?? ""),
    description_en: String(row.description_en ?? ""),
    duration_minutes: Number(row.duration_minutes ?? 60),
    difficulty: (row.difficulty as IeltsTest["difficulty"]) ?? "band_6_7",
    questionCount: counted > 0 ? counted : Number(td.questionCount ?? 0),
    is_published: Boolean(row.is_published),
    is_daily_eligible: Boolean(row.is_daily_eligible),
    is_premium: Boolean(row.is_premium),
    seo_meta:
      row.seo_meta && typeof row.seo_meta === "object"
        ? (row.seo_meta as SeoMeta)
        : {},
    sections,
    writingPrompt: (td.writingPrompt as IeltsTest["writingPrompt"]) ?? undefined,
    speakingPrompts: (td.speakingPrompts as IeltsTest["speakingPrompts"]) ?? undefined,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function revalidateTestRoutes(slugs: string[]) {
  try {
    revalidatePath("/");
    revalidatePath("/tests");
    revalidatePath("/daily-exam");
    revalidatePath("/sitemap.xml");
    for (const s of slugs) {
      if (s) revalidatePath(`/tests/${s}`);
    }
  } catch {
    // ignore outside Next request context
  }
}

export async function listAdminTests(options?: {
  q?: string;
  skill?: "" | "reading" | "listening" | "writing" | "speaking";
  module?: "" | "academic" | "general";
  published?: "" | "true" | "false";
  premium?: "" | "true" | "false";
  page?: number;
  pageSize?: number;
}): Promise<{
  items: IeltsTest[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, options?.pageSize ?? 15));
  const q = (options?.q ?? "").trim().toLowerCase();
  const skill = options?.skill ?? "";
  const mod = options?.module ?? "";
  const published = options?.published ?? "";
  const premium = options?.premium ?? "";

  let all: IeltsTest[] = [];
  if (!isSupabaseConfigured()) {
    all = readStore().ielts_tests;
  } else {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data } = await admin
        .from("ielts_tests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      all = (data ?? []).map((r) => mapAdminTestRow(r as Record<string, unknown>));
    }
  }

  const filtered = all.filter((t) => {
    if (skill && t.skill !== skill) return false;
    if (mod && t.module !== mod) return false;
    if (published === "true" && !t.is_published) return false;
    if (published === "false" && t.is_published) return false;
    if (premium === "true" && !t.is_premium) return false;
    if (premium === "false" && t.is_premium) return false;
    if (q) {
      const hay = `${t.title_vi} ${t.title_en} ${t.slug} ${t.skill} ${t.module} ${t.description_vi}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

export async function getAdminTestById(id: string): Promise<IeltsTest | null> {
  if (!isSupabaseConfigured()) {
    return readStore().ielts_tests.find((t) => t.id === id) ?? null;
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("ielts_tests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapAdminTestRow(data as Record<string, unknown>) : null;
}

function sanitizePassageIfHtml(passage?: string): string | undefined {
  if (!passage) return undefined;
  if (/<(?:p|div|h[1-6]|blockquote|li|br|ul|ol|strong|em|b|i|script|style|iframe)\b/i.test(passage)) {
    return sanitizeRichHtml(passage);
  }
  return passage;
}

function normalizeTestPayload(data: CmsTestFormInput) {
  const sections: TestSection[] = data.sections.map((s) => ({
    id: s.id,
    title: s.title,
    instruction: s.instruction || undefined,
    passage: sanitizePassageIfHtml(s.passage),
    audioUrl: s.audioUrl || undefined,
    audioScript: s.audioScript || undefined,
    diagramLabel: s.diagramLabel || undefined,
    diagramSvgType: s.diagramSvgType || undefined,
    diagramImageUrl: s.diagramImageUrl || undefined,
    headingBank:
      s.headingBank && s.headingBank.length > 0 ? s.headingBank : undefined,
    groups: (() => {
      const explicit = (s.groups ?? [])
        .filter((g) => !g.isAutoGenerated)
        .map((g) => {
          const { isAutoGenerated: _omit, ...persisted } = g;
          void _omit;
          return persisted;
        });
      return explicit.length > 0 ? explicit : undefined;
    })(),
    questions: s.questions.map((q) => ({
      id: q.id,
      number: q.number,
      type: q.type,
      prompt: q.prompt,
      options: q.options && q.options.length > 0 ? q.options : undefined,
      correctAnswers: q.correctAnswers.map((a) => a.trim()).filter(Boolean),
      explanation_vi: q.explanation_vi || "",
      explanation_en: q.explanation_en || q.explanation_vi || "",
      sectionRef: q.sectionRef || undefined,
      groupId: q.groupId || undefined,
    })),
  }));

  const questionCount =
    data.skill === "reading" || data.skill === "listening"
      ? sections.reduce((sum, s) => sum + s.questions.length, 0)
      : data.skill === "writing"
      ? 1
      : (data.speakingPrompts?.part1.length ?? 0) +
        1 +
        (data.speakingPrompts?.part3.length ?? 0);

  const firstAudio = sections.find((s) => s.audioUrl)?.audioUrl ?? null;

  return {
    slug: slugifyVi(data.slug),
    skill: data.skill,
    module: data.module,
    title_vi: data.title_vi,
    title_en: data.title_en || data.title_vi,
    description_vi: data.description_vi || "",
    description_en: data.description_en || data.description_vi || "",
    duration_minutes: data.duration_minutes,
    difficulty: data.difficulty,
    audio_url: firstAudio,
    is_published: data.is_published,
    is_daily_eligible: data.is_daily_eligible,
    is_premium: data.is_premium,
    seo_meta: data.seo_meta ?? {},
    test_data: {
      questionCount,
      sections,
      writingPrompt: data.skill === "writing" ? data.writingPrompt : undefined,
      speakingPrompts:
        data.skill === "speaking" ? data.speakingPrompts : undefined,
    },
    questionCount,
    sections,
  };
}

export async function createCmsTest(
  rawInput: unknown,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<
  { ok: true; test: IeltsTest } | { ok: false; status: number; error: string; validationErrors?: string[] }
> {
  const parsed = cmsTestFormSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Dữ liệu đề thi không hợp lệ.",
    };
  }

  const normalized = normalizeTestPayload(parsed.data);

  if (normalized.is_published) {
    const check = validateTestForPublish({
      skill: normalized.skill,
      sections: normalized.sections,
      writingPrompt: normalized.test_data.writingPrompt,
      speakingPrompts: normalized.test_data.speakingPrompts,
    });
    if (!check.canPublish) {
      return {
        ok: false,
        status: 400,
        error: `Không thể xuất bản vì chưa đạt điều kiện kiểm tra tự động: ${check.errors[0]}`,
        validationErrors: check.errors,
      };
    }
  }

  if (!isSupabaseConfigured()) {
    const dup = readStore().ielts_tests.find((t) => t.slug === normalized.slug);
    if (dup) {
      return { ok: false, status: 409, error: `Slug "${normalized.slug}" đã tồn tại.` };
    }
    const created: IeltsTest = {
      id: `test-${Date.now()}`,
      slug: normalized.slug,
      skill: normalized.skill,
      module: normalized.module,
      title_vi: normalized.title_vi,
      title_en: normalized.title_en,
      description_vi: normalized.description_vi,
      description_en: normalized.description_en,
      duration_minutes: normalized.duration_minutes,
      difficulty: normalized.difficulty,
      questionCount: normalized.questionCount,
      is_published: normalized.is_published,
      is_daily_eligible: normalized.is_daily_eligible,
      is_premium: normalized.is_premium,
      seo_meta: normalized.seo_meta,
      sections: normalized.sections,
      writingPrompt: normalized.test_data.writingPrompt,
      speakingPrompts: normalized.test_data.speakingPrompts,
      created_at: new Date().toISOString(),
    };
    updateStore((store) => {
      store.ielts_tests.unshift(created);
    });
    await recordAuditLog({
      actor,
      action: "create_test",
      entityType: "ielts_test",
      entityId: created.id,
      entityLabel: created.title_vi,
      summary: `Tạo đề ${created.skill.toUpperCase()} "${created.title_vi}" (${created.questionCount} câu, ${created.is_published ? "Đã đăng" : "Nháp"})`,
    });
    revalidateTestRoutes([created.slug]);
    return { ok: true, test: created };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  const { data: dup } = await admin
    .from("ielts_tests")
    .select("id")
    .eq("slug", normalized.slug)
    .maybeSingle();
  if (dup) {
    return {
      ok: false,
      status: 409,
      error: `Slug "${normalized.slug}" đã được sử dụng bởi đề thi khác.`,
    };
  }

  const { data, error } = await admin
    .from("ielts_tests")
    .insert({
      slug: normalized.slug,
      skill: normalized.skill,
      module: normalized.module,
      title_vi: normalized.title_vi,
      title_en: normalized.title_en,
      description_vi: normalized.description_vi,
      description_en: normalized.description_en,
      duration_minutes: normalized.duration_minutes,
      difficulty: normalized.difficulty,
      audio_url: normalized.audio_url,
      test_data: normalized.test_data,
      is_published: normalized.is_published,
      is_daily_eligible: normalized.is_daily_eligible,
      is_premium: normalized.is_premium,
      seo_meta: normalized.seo_meta,
      created_by: actor.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Không thể lưu đề thi mới.",
    };
  }

  const test = mapAdminTestRow(data as Record<string, unknown>);
  await recordAuditLog({
    actor,
    action: "create_test",
    entityType: "ielts_test",
    entityId: test.id,
    entityLabel: test.title_vi,
    summary: `Tạo đề ${test.skill.toUpperCase()} "${test.title_vi}" (${test.questionCount} câu, ${test.is_published ? "Đã đăng" : "Nháp"})`,
  });
  revalidateTestRoutes([test.slug]);
  return { ok: true, test };
}

export async function updateCmsTest(
  id: string,
  rawInput: unknown,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<
  | { ok: true; test: IeltsTest; redirectCreated?: { from: string; to: string } }
  | { ok: false; status: number; error: string; validationErrors?: string[] }
> {
  const parsed = cmsTestFormSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Dữ liệu đề thi không hợp lệ.",
    };
  }

  const existing = await getAdminTestById(id);
  if (!existing) {
    return { ok: false, status: 404, error: "Không tìm thấy đề thi." };
  }

  const normalized = normalizeTestPayload(parsed.data);

  if (normalized.is_published) {
    const check = validateTestForPublish({
      skill: normalized.skill,
      sections: normalized.sections,
      writingPrompt: normalized.test_data.writingPrompt,
      speakingPrompts: normalized.test_data.speakingPrompts,
    });
    if (!check.canPublish) {
      return {
        ok: false,
        status: 400,
        error: `Không thể xuất bản vì chưa đạt điều kiện kiểm tra tự động: ${check.errors[0]}`,
        validationErrors: check.errors,
      };
    }
  }

  let redirectCreated: { from: string; to: string } | undefined;

  if (!isSupabaseConfigured()) {
    const clash = readStore().ielts_tests.find(
      (t) => t.slug === normalized.slug && t.id !== id
    );
    if (clash) {
      return { ok: false, status: 409, error: `Slug "${normalized.slug}" đã tồn tại.` };
    }
    const updated: IeltsTest = {
      ...existing,
      slug: normalized.slug,
      skill: normalized.skill,
      module: normalized.module,
      title_vi: normalized.title_vi,
      title_en: normalized.title_en,
      description_vi: normalized.description_vi,
      description_en: normalized.description_en,
      duration_minutes: normalized.duration_minutes,
      difficulty: normalized.difficulty,
      questionCount: normalized.questionCount,
      is_published: normalized.is_published,
      is_daily_eligible: normalized.is_daily_eligible,
      is_premium: normalized.is_premium,
      seo_meta: normalized.seo_meta,
      sections: normalized.sections,
      writingPrompt: normalized.test_data.writingPrompt,
      speakingPrompts: normalized.test_data.speakingPrompts,
    };
    updateStore((store) => {
      const idx = store.ielts_tests.findIndex((t) => t.id === id);
      if (idx !== -1) store.ielts_tests[idx] = updated;
    });
    if (existing.slug !== updated.slug) {
      redirectCreated = { from: `/tests/${existing.slug}`, to: `/tests/${updated.slug}` };
    }
    await recordAuditLog({
      actor,
      action: "update_test",
      entityType: "ielts_test",
      entityId: updated.id,
      entityLabel: updated.title_vi,
      summary: `Cập nhật đề "${updated.title_vi}" (${updated.questionCount} câu, ${updated.is_published ? "Đã đăng" : "Nháp"})`,
    });
    revalidateTestRoutes([existing.slug, updated.slug]);
    return { ok: true, test: updated, redirectCreated };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  if (existing.slug !== normalized.slug) {
    const { data: dup } = await admin
      .from("ielts_tests")
      .select("id")
      .eq("slug", normalized.slug)
      .neq("id", id)
      .maybeSingle();
    if (dup) {
      return {
        ok: false,
        status: 409,
        error: `Slug "${normalized.slug}" đã tồn tại.`,
      };
    }
  }

  const { data, error } = await admin
    .from("ielts_tests")
    .update({
      slug: normalized.slug,
      skill: normalized.skill,
      module: normalized.module,
      title_vi: normalized.title_vi,
      title_en: normalized.title_en,
      description_vi: normalized.description_vi,
      description_en: normalized.description_en,
      duration_minutes: normalized.duration_minutes,
      difficulty: normalized.difficulty,
      audio_url: normalized.audio_url,
      test_data: normalized.test_data,
      is_published: normalized.is_published,
      is_daily_eligible: normalized.is_daily_eligible,
      is_premium: normalized.is_premium,
      seo_meta: normalized.seo_meta,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Không thể cập nhật đề thi.",
    };
  }

  if (existing.slug !== normalized.slug) {
    const sourcePath = `/tests/${existing.slug}`;
    const destPath = `/tests/${normalized.slug}`;
    await admin
      .from("seo_redirects")
      .upsert(
        {
          source_path: sourcePath,
          destination_path: destPath,
          status_code: 301,
          is_active: true,
          created_by: actor.id,
        },
        { onConflict: "source_path" }
      )
      .then(({ error: redErr }) => {
        if (!redErr) {
          redirectCreated = { from: sourcePath, to: destPath };
          invalidateSeoRedirectCache();
        }
      });
  }

  const test = mapAdminTestRow(data as Record<string, unknown>);
  await recordAuditLog({
    actor,
    action: "update_test",
    entityType: "ielts_test",
    entityId: test.id,
    entityLabel: test.title_vi,
    summary: `Cập nhật đề "${test.title_vi}" (${test.questionCount} câu, ${test.is_published ? "Đã đăng" : "Nháp"})${
      redirectCreated ? ` + Redirect 301 ${redirectCreated.from} → ${redirectCreated.to}` : ""
    }`,
  });
  revalidateTestRoutes([existing.slug, test.slug]);
  return { ok: true, test, redirectCreated };
}

export async function duplicateCmsTest(
  id: string,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<
  { ok: true; test: IeltsTest } | { ok: false; status: number; error: string }
> {
  const existing = await getAdminTestById(id);
  if (!existing) {
    return { ok: false, status: 404, error: "Không tìm thấy đề thi để nhân bản." };
  }

  const suffix = Date.now().toString().slice(-4);
  const nextSlug = `${slugifyVi(existing.slug).slice(0, 75)}-ban-sao-${suffix}`;
  const clonedSections = existing.sections.map((s, sIdx) => ({
    ...s,
    id: `${nextSlug}-s${sIdx + 1}`,
    questions: s.questions.map((q) => ({
      ...q,
      id: `${nextSlug}-q${q.number}`,
    })),
  }));

  return createCmsTest(
    {
      slug: nextSlug,
      skill: existing.skill,
      module: existing.module,
      title_vi: `${existing.title_vi} (Bản sao)`,
      title_en: `${existing.title_en} (Copy)`,
      description_vi: existing.description_vi,
      description_en: existing.description_en,
      duration_minutes: existing.duration_minutes,
      difficulty: existing.difficulty,
      is_published: false,
      is_daily_eligible: false,
      is_premium: Boolean(existing.is_premium),
      seo_meta: existing.seo_meta ?? {},
      sections: clonedSections,
      writingPrompt: existing.writingPrompt,
      speakingPrompts: existing.speakingPrompts,
    },
    actor
  );
}

export async function deleteCmsTest(
  id: string,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await getAdminTestById(id);
  if (!existing) {
    return { ok: false, status: 404, error: "Không tìm thấy đề thi." };
  }

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.ielts_tests = store.ielts_tests.filter((t) => t.id !== id);
    });
    await recordAuditLog({
      actor,
      action: "delete_test",
      entityType: "ielts_test",
      entityId: existing.id,
      entityLabel: existing.title_vi,
      summary: `Xóa đề thi "${existing.title_vi}" (/tests/${existing.slug})`,
    });
    revalidateTestRoutes([existing.slug]);
    return { ok: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  const { error } = await admin.from("ielts_tests").delete().eq("id", id);
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "delete_test",
    entityType: "ielts_test",
    entityId: existing.id,
    entityLabel: existing.title_vi,
    summary: `Xóa đề thi "${existing.title_vi}" (/tests/${existing.slug})`,
  });
  revalidateTestRoutes([existing.slug]);
  return { ok: true };
}
