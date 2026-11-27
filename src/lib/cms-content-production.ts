import "server-only";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { recordAuditLog } from "./admin-auth";
import { GENERAL_AI_TOOLS } from "./ai-tools-config";
import { createCmsTest } from "./cms-tests";
import {
  blogQualityConfigSchema,
  contentCalendarItemSchema,
  DEFAULT_BLOG_QUALITY_CONFIG,
  newsletterSubscribeSchema,
  type BlogQualityConfig,
  type ContentCalendarItem,
  type InternalLinkCandidate,
  type NewsletterSubscriber,
} from "./content-production-shared";
import { getCourses, getIeltsTestSummaries } from "./db";
import { readStore, updateStore } from "./store";
import type { CmsTestFormInput } from "./test-cms-shared";
import type { IeltsTest, SessionUser } from "./types";

const CALENDAR_FALLBACK_SETTINGS_KEY = "content_calendar_items";
const SUBSCRIBERS_FALLBACK_SETTINGS_KEY = "newsletter_subscribers";
const BLOG_QUALITY_SETTINGS_KEY = "blog_quality";

function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist|Could not find the table|relation .* does not exist/i.test(msg)
  );
}

async function readSiteSettingValue<T>(key: string, fallback: T): Promise<T> {
  const admin = createSupabaseAdminClient();
  if (!admin) return fallback;
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (!data || data.value === null || data.value === undefined) return fallback;
  return data.value as T;
}

async function writeSiteSettingValue(
  key: string,
  value: unknown,
  actorId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Thiếu kết nối Supabase Admin." };
  const { error } = await admin.from("site_settings").upsert(
    {
      key,
      value,
      updated_by: actorId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function mapCalendarRow(row: Record<string, unknown>): ContentCalendarItem {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    content_type:
      row.content_type === "test" || row.content_type === "video"
        ? row.content_type
        : "blog",
    workflow_status:
      row.workflow_status === "writing" ||
      row.workflow_status === "review" ||
      row.workflow_status === "scheduled" ||
      row.workflow_status === "published"
        ? row.workflow_status
        : "idea",
    assignee_name: String(row.assignee_name ?? ""),
    planned_date: String(row.planned_date ?? "").slice(0, 10),
    linked_href: row.linked_href ? String(row.linked_href) : null,
    notes: String(row.notes ?? ""),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

export async function listContentCalendarItems(options?: {
  month?: string;
  contentType?: string;
  status?: string;
}): Promise<{ items: ContentCalendarItem[]; tableReady: boolean }> {
  let items: ContentCalendarItem[] = [];
  let tableReady = true;

  if (!isSupabaseConfigured()) {
    items = [...(readStore().content_calendar_items ?? [])];
  } else {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data, error } = await admin
        .from("content_calendar_items")
        .select("*")
        .order("planned_date", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(500);

      if (error && isMissingTableError(error)) {
        tableReady = false;
        const stored = await readSiteSettingValue<ContentCalendarItem[]>(
          CALENDAR_FALLBACK_SETTINGS_KEY,
          []
        );
        items = Array.isArray(stored) ? stored : [];
      } else if (!error && data) {
        items = data.map((r) => mapCalendarRow(r as Record<string, unknown>));
      }
    }
  }

  const monthFilter = (options?.month ?? "").trim();
  const typeFilter = (options?.contentType ?? "").trim();
  const statusFilter = (options?.status ?? "").trim();

  const filtered = items
    .filter((item) => {
      if (monthFilter && !item.planned_date.startsWith(monthFilter)) return false;
      if (typeFilter && item.content_type !== typeFilter) return false;
      if (statusFilter && item.workflow_status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date));

  return { items: filtered, tableReady };
}

export async function upsertContentCalendarItem(
  rawInput: unknown,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<
  | { ok: true; item: ContentCalendarItem; tableReady: boolean }
  | { ok: false; status: number; error: string }
> {
  const parsed = contentCalendarItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Dữ liệu lịch nội dung không hợp lệ.",
    };
  }

  const input = parsed.data;
  const nowIso = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    let saved: ContentCalendarItem | null = null;
    updateStore((store) => {
      if (!Array.isArray(store.content_calendar_items)) {
        store.content_calendar_items = [];
      }
      const existingIdx = input.id
        ? store.content_calendar_items.findIndex((i) => i.id === input.id)
        : -1;
      if (existingIdx >= 0) {
        saved = {
          ...store.content_calendar_items[existingIdx],
          title: input.title,
          content_type: input.content_type,
          workflow_status: input.workflow_status,
          assignee_name: input.assignee_name,
          planned_date: input.planned_date,
          linked_href: input.linked_href || null,
          notes: input.notes ?? "",
          updated_at: nowIso,
        };
        store.content_calendar_items[existingIdx] = saved;
      } else {
        saved = {
          id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: input.title,
          content_type: input.content_type,
          workflow_status: input.workflow_status,
          assignee_name: input.assignee_name,
          planned_date: input.planned_date,
          linked_href: input.linked_href || null,
          notes: input.notes ?? "",
          created_by: actor.id,
          created_at: nowIso,
          updated_at: nowIso,
        };
        store.content_calendar_items.push(saved);
      }
    });

    await recordAuditLog({
      actor,
      action: input.id ? "update_content_calendar" : "create_content_calendar",
      entityType: "content_calendar",
      entityId: saved!.id,
      entityLabel: saved!.title,
      summary: `${input.id ? "Cập nhật" : "Thêm"} lịch nội dung "${saved!.title}" (${saved!.content_type} · ${saved!.workflow_status} · ${saved!.planned_date})`,
    });

    return { ok: true, item: saved!, tableReady: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  const payload = {
    title: input.title,
    content_type: input.content_type,
    workflow_status: input.workflow_status,
    assignee_name: input.assignee_name,
    planned_date: input.planned_date,
    linked_href: input.linked_href || null,
    notes: input.notes ?? "",
    updated_at: nowIso,
  };

  const query = input.id
    ? admin
        .from("content_calendar_items")
        .update(payload)
        .eq("id", input.id)
        .select("*")
        .single()
    : admin
        .from("content_calendar_items")
        .insert({ ...payload, created_by: actor.id })
        .select("*")
        .single();

  const { data, error } = await query;

  if (error && isMissingTableError(error)) {
    const existingList = await readSiteSettingValue<ContentCalendarItem[]>(
      CALENDAR_FALLBACK_SETTINGS_KEY,
      []
    );
    const list = Array.isArray(existingList) ? [...existingList] : [];
    const idx = input.id ? list.findIndex((x) => x.id === input.id) : -1;
    let saved: ContentCalendarItem;
    if (idx >= 0) {
      saved = { ...list[idx], ...payload, updated_at: nowIso };
      list[idx] = saved;
    } else {
      saved = {
        id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...payload,
        created_by: actor.id,
        created_at: nowIso,
        updated_at: nowIso,
      };
      list.push(saved);
    }
    const writeRes = await writeSiteSettingValue(
      CALENDAR_FALLBACK_SETTINGS_KEY,
      list,
      actor.id
    );
    if (!writeRes.ok) {
      return { ok: false, status: 500, error: writeRes.error ?? "Không thể lưu lịch nội dung." };
    }
    await recordAuditLog({
      actor,
      action: input.id ? "update_content_calendar" : "create_content_calendar",
      entityType: "content_calendar",
      entityId: saved.id,
      entityLabel: saved.title,
      summary: `${input.id ? "Cập nhật" : "Thêm"} lịch nội dung "${saved.title}" (${saved.workflow_status} · ${saved.planned_date})`,
    });
    return { ok: true, item: saved, tableReady: false };
  }

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Không thể lưu mục lịch nội dung.",
    };
  }

  const item = mapCalendarRow(data as Record<string, unknown>);
  await recordAuditLog({
    actor,
    action: input.id ? "update_content_calendar" : "create_content_calendar",
    entityType: "content_calendar",
    entityId: item.id,
    entityLabel: item.title,
    summary: `${input.id ? "Cập nhật" : "Thêm"} lịch nội dung "${item.title}" (${item.content_type} · ${item.workflow_status} · ${item.planned_date})`,
  });
  return { ok: true, item, tableReady: true };
}

export async function deleteContentCalendarItem(
  id: string,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!id.trim()) {
    return { ok: false, status: 400, error: "Thiếu ID mục lịch cần xóa." };
  }

  if (!isSupabaseConfigured()) {
    let removedTitle = id;
    updateStore((store) => {
      const target = (store.content_calendar_items ?? []).find((x) => x.id === id);
      if (target) removedTitle = target.title;
      store.content_calendar_items = (store.content_calendar_items ?? []).filter(
        (x) => x.id !== id
      );
    });
    await recordAuditLog({
      actor,
      action: "delete_content_calendar",
      entityType: "content_calendar",
      entityId: id,
      entityLabel: removedTitle,
      summary: `Xóa mục lịch nội dung "${removedTitle}"`,
    });
    return { ok: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  const { error } = await admin
    .from("content_calendar_items")
    .delete()
    .eq("id", id);

  if (error && isMissingTableError(error)) {
    const list = await readSiteSettingValue<ContentCalendarItem[]>(
      CALENDAR_FALLBACK_SETTINGS_KEY,
      []
    );
    const next = (Array.isArray(list) ? list : []).filter((x) => x.id !== id);
    const writeRes = await writeSiteSettingValue(
      CALENDAR_FALLBACK_SETTINGS_KEY,
      next,
      actor.id
    );
    if (!writeRes.ok) {
      return { ok: false, status: 500, error: writeRes.error ?? "Không thể xóa." };
    }
    await recordAuditLog({
      actor,
      action: "delete_content_calendar",
      entityType: "content_calendar",
      entityId: id,
      entityLabel: id,
      summary: `Xóa mục lịch nội dung #${id}`,
    });
    return { ok: true };
  }

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "delete_content_calendar",
    entityType: "content_calendar",
    entityId: id,
    entityLabel: id,
    summary: `Xóa mục lịch nội dung #${id}`,
  });
  return { ok: true };
}

export async function getBlogQualityConfig(): Promise<BlogQualityConfig> {
  if (!isSupabaseConfigured()) {
    const saved = readStore().site_settings?.blog_quality;
    const parsed = blogQualityConfigSchema.safeParse(saved ?? {});
    return parsed.success ? parsed.data : DEFAULT_BLOG_QUALITY_CONFIG;
  }

  const stored = await readSiteSettingValue<Partial<BlogQualityConfig> | null>(
    BLOG_QUALITY_SETTINGS_KEY,
    null
  );
  const parsed = blogQualityConfigSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : DEFAULT_BLOG_QUALITY_CONFIG;
}

export async function saveBlogQualityConfig(
  rawInput: unknown,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<
  | { ok: true; config: BlogQualityConfig }
  | { ok: false; status: number; error: string }
> {
  const parsed = blogQualityConfigSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Cấu hình kiểm tra chất lượng không hợp lệ.",
    };
  }

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.site_settings.blog_quality = parsed.data;
    });
  } else {
    const res = await writeSiteSettingValue(
      BLOG_QUALITY_SETTINGS_KEY,
      parsed.data,
      actor.id
    );
    if (!res.ok) {
      return { ok: false, status: 500, error: res.error ?? "Không thể lưu cấu hình." };
    }
  }

  await recordAuditLog({
    actor,
    action: "update_blog_quality_config",
    entityType: "site_settings",
    entityId: BLOG_QUALITY_SETTINGS_KEY,
    entityLabel: "Cấu hình chất lượng Blog",
    summary: `Cập nhật tiêu chuẩn xuất bản Blog: tối thiểu ${parsed.data.minWordCount} từ, tối thiểu ${parsed.data.minInternalLinks} link nội bộ`,
  });

  return { ok: true, config: parsed.data };
}

export async function getInternalLinkCatalog(): Promise<InternalLinkCandidate[]> {
  const [tests, courses] = await Promise.all([
    getIeltsTestSummaries(false),
    getCourses(false),
  ]);

  const candidates: InternalLinkCandidate[] = [];

  for (const t of tests.slice(0, 60)) {
    candidates.push({
      id: `test-${t.id}`,
      kind: "test",
      title: t.title_vi,
      href: `/tests/${t.slug}`,
      subtitle: `Đề thi ${t.skill.toUpperCase()} · ${t.questionCount} câu`,
      keywords: [
        t.skill,
        t.module,
        t.title_vi,
        t.title_en,
        t.slug.replace(/-/g, " "),
        t.skill === "reading"
          ? "doc hieu true false not given matching headings"
          : t.skill === "listening"
          ? "nghe ielts audio gap fill"
          : t.skill === "writing"
          ? "viet essay task 1 task 2"
          : "noi speaking part 1 part 2 part 3",
      ],
    });
  }

  for (const c of courses.slice(0, 30)) {
    candidates.push({
      id: `course-${c.id}`,
      kind: "course",
      title: c.title_vi,
      href: `/courses/${c.slug}`,
      subtitle: `Khóa học · Target ${c.target_band} · ${c.lessons.length} bài`,
      keywords: [
        "khoa hoc",
        "lo trinh",
        c.level,
        c.target_band,
        c.title_vi,
        c.title_en,
        c.description_vi,
      ],
    });
  }

  const coreTools: InternalLinkCandidate[] = [
    {
      id: "tool-writing-ai",
      kind: "tool",
      title: "Chấm bài IELTS Writing AI (4 tiêu chí)",
      href: "/writing",
      subtitle: "Công cụ AI · Chấm Task 1 & Task 2 chi tiết",
      keywords: ["writing", "viet", "task 1", "task 2", "cham bai", "essay", "loi thuong gap"],
    },
    {
      id: "tool-speaking-ai",
      kind: "tool",
      title: "Luyện & Chấm IELTS Speaking AI",
      href: "/speaking",
      subtitle: "Công cụ AI · Ghi âm Parts 1–3 & chấm tham khảo",
      keywords: ["speaking", "noi", "phat am", "part 1", "part 2", "part 3"],
    },
    {
      id: "tool-band-calc",
      kind: "tool",
      title: "Tính điểm Band IELTS chuẩn",
      href: "/band-calculator",
      subtitle: "Công cụ · Quy đổi điểm số câu đúng & làm tròn Overall",
      keywords: ["band", "tinh diem", "lo trinh", "reading", "listening", "muc tieu"],
    },
    {
      id: "tool-daily-exam",
      kind: "tool",
      title: "Đề thi IELTS mỗi ngày (15 phút)",
      href: "/daily-exam",
      subtitle: "Luyện tập · Đua BXH & giữ chuỗi streak hàng ngày",
      keywords: ["daily", "moi ngay", "luyen de", "reading", "listening", "toc do"],
    },
    {
      id: "tool-flashcards",
      kind: "tool",
      title: "Flashcards Từ vựng IELTS (SRS)",
      href: "/flashcards",
      subtitle: "Công cụ · Ôn tập lặp lại ngắt quãng",
      keywords: ["tu vung", "vocabulary", "collocations", "flashcard", "tu moi"],
    },
    {
      id: "tool-ipa",
      kind: "tool",
      title: "Luyện phát âm chuẩn bảng IPA",
      href: "/pronunciation",
      subtitle: "Công cụ · Khẩu hình & mẹo sửa lỗi người Việt",
      keywords: ["phat am", "ipa", "speaking", "listening", "loi thuong gap"],
    },
    {
      id: "tool-dictation",
      kind: "tool",
      title: "Chép chính tả & Shadowing IELTS",
      href: "/dictation",
      subtitle: "Công cụ · Luyện nghe chép từng câu & nói đuổi",
      keywords: ["listening", "nghe", "chep chinh ta", "dictation", "shadowing"],
    },
    {
      id: "tool-writing-ex",
      kind: "tool",
      title: "Bài tập nâng cấp câu viết Band 5.5 → 8.0",
      href: "/writing/exercises",
      subtitle: "Luyện viết · Thực hành viết lại câu học thuật",
      keywords: ["writing", "viet", "ngu phap", "tu vung", "nang cap cau"],
    },
    {
      id: "tool-mentor",
      kind: "tool",
      title: "Mentor Ôn IELTS AI",
      href: "/mentor",
      subtitle: "Công cụ AI · Hỏi đáp chiến thuật & lộ trình học",
      keywords: ["mentor", "lo trinh", "tu hoc", "tips", "chien thuat"],
    },
  ];

  candidates.push(...coreTools);

  for (const t of GENERAL_AI_TOOLS) {
    candidates.push({
      id: `ai-tool-${t.slug}`,
      kind: "tool",
      title: t.titleVi,
      href: `/tools/${t.slug}`,
      subtitle: `Công cụ AI · ${t.descriptionVi.slice(0, 70)}`,
      keywords: [
        t.slug.replace(/-/g, " "),
        t.titleVi,
        t.titleEn,
        t.descriptionVi,
        "cong cu ai",
        "writing",
        "reading",
        "ngu phap",
        "tu vung",
      ],
    });
  }

  return candidates;
}

export async function bulkImportTestsAsDraft(
  tests: CmsTestFormInput[],
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<{
  created: IeltsTest[];
  failed: Array<{ slug: string; title: string; error: string }>;
}> {
  const created: IeltsTest[] = [];
  const failed: Array<{ slug: string; title: string; error: string }> = [];

  for (const item of tests) {
    const draftPayload: CmsTestFormInput = {
      ...item,
      is_published: false,
      is_daily_eligible: false,
    };
    const res = await createCmsTest(draftPayload, actor);
    if (res.ok) {
      created.push(res.test);
    } else {
      failed.push({
        slug: item.slug,
        title: item.title_vi,
        error: res.error,
      });
    }
  }

  if (created.length > 0) {
    await recordAuditLog({
      actor,
      action: "bulk_import_tests",
      entityType: "ielts_test",
      entityLabel: `Nhập hàng loạt ${created.length} đề thi (Nháp)`,
      summary: `Nhập hàng loạt ${created.length}/${tests.length} đề thi vào trạng thái Nháp (${failed.length} lỗi)`,
      metadata: {
        createdSlugs: created.map((t) => t.slug),
        failedCount: failed.length,
      },
    });
    try {
      revalidatePath("/admin/tests");
    } catch {
      // ignore outside Next request context
    }
  }

  return { created, failed };
}

function mapSubscriberRow(row: Record<string, unknown>): NewsletterSubscriber {
  return {
    id: String(row.id),
    email: String(row.email ?? "").toLowerCase(),
    source_slug: row.source_slug ? String(row.source_slug) : null,
    locale: String(row.locale ?? "vi"),
    status: row.status === "unsubscribed" ? "unsubscribed" : "active",
    subscribed_at: String(row.subscribed_at ?? new Date().toISOString()),
  };
}

export async function subscribeNewsletterEmail(
  rawInput: unknown
): Promise<
  | { ok: true; subscriber: NewsletterSubscriber; alreadySubscribed: boolean }
  | { ok: false; status: number; error: string }
> {
  const parsed = newsletterSubscribeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Địa chỉ email không hợp lệ.",
    };
  }

  const email = parsed.data.email;
  const sourceSlug = parsed.data.source_slug?.trim() || null;
  const locale = parsed.data.locale || "vi";
  const nowIso = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    let existing: NewsletterSubscriber | undefined;
    let saved: NewsletterSubscriber | null = null;
    updateStore((store) => {
      if (!Array.isArray(store.newsletter_subscribers)) {
        store.newsletter_subscribers = [];
      }
      existing = store.newsletter_subscribers.find((s) => s.email === email);
      if (existing) {
        existing.status = "active";
        saved = existing;
      } else {
        saved = {
          id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          email,
          source_slug: sourceSlug,
          locale,
          status: "active",
          subscribed_at: nowIso,
        };
        store.newsletter_subscribers.unshift(saved);
      }
    });
    return {
      ok: true,
      subscriber: saved!,
      alreadySubscribed: Boolean(existing),
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "Hệ thống đang tạm bảo trì kết nối cơ sở dữ liệu.",
    };
  }

  const { data: existingRow, error: selErr } = await admin
    .from("newsletter_subscribers")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (selErr && isMissingTableError(selErr)) {
    const list = await readSiteSettingValue<NewsletterSubscriber[]>(
      SUBSCRIBERS_FALLBACK_SETTINGS_KEY,
      []
    );
    const arr = Array.isArray(list) ? [...list] : [];
    const found = arr.find((s) => s.email === email);
    if (found) {
      return { ok: true, subscriber: found, alreadySubscribed: true };
    }
    const created: NewsletterSubscriber = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      email,
      source_slug: sourceSlug,
      locale,
      status: "active",
      subscribed_at: nowIso,
    };
    arr.unshift(created);
    const writeRes = await writeSiteSettingValue(
      SUBSCRIBERS_FALLBACK_SETTINGS_KEY,
      arr.slice(0, 5000)
    );
    if (!writeRes.ok) {
      return { ok: false, status: 500, error: "Không thể lưu đăng ký email lúc này." };
    }
    return { ok: true, subscriber: created, alreadySubscribed: false };
  }

  if (existingRow) {
    if (existingRow.status !== "active") {
      await admin
        .from("newsletter_subscribers")
        .update({ status: "active" })
        .eq("id", existingRow.id);
    }
    return {
      ok: true,
      subscriber: mapSubscriberRow(existingRow as Record<string, unknown>),
      alreadySubscribed: true,
    };
  }

  const { data: inserted, error: insErr } = await admin
    .from("newsletter_subscribers")
    .insert({
      email,
      source_slug: sourceSlug,
      locale,
      status: "active",
      subscribed_at: nowIso,
    })
    .select("*")
    .single();

  if (insErr || !inserted) {
    return {
      ok: false,
      status: 500,
      error: insErr?.message || "Không thể đăng ký nhận bài viết lúc này.",
    };
  }

  return {
    ok: true,
    subscriber: mapSubscriberRow(inserted as Record<string, unknown>),
    alreadySubscribed: false,
  };
}

export async function listNewsletterSubscribers(options?: {
  q?: string;
}): Promise<{ items: NewsletterSubscriber[]; tableReady: boolean }> {
  let items: NewsletterSubscriber[] = [];
  let tableReady = true;

  if (!isSupabaseConfigured()) {
    items = [...(readStore().newsletter_subscribers ?? [])];
  } else {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data, error } = await admin
        .from("newsletter_subscribers")
        .select("*")
        .order("subscribed_at", { ascending: false })
        .limit(5000);

      if (error && isMissingTableError(error)) {
        tableReady = false;
        const fallback = await readSiteSettingValue<NewsletterSubscriber[]>(
          SUBSCRIBERS_FALLBACK_SETTINGS_KEY,
          []
        );
        items = Array.isArray(fallback) ? fallback : [];
      } else if (!error && data) {
        items = data.map((r) => mapSubscriberRow(r as Record<string, unknown>));
      }
    }
  }

  const q = (options?.q ?? "").trim().toLowerCase();
  const filtered = q
    ? items.filter(
        (s) =>
          s.email.toLowerCase().includes(q) ||
          (s.source_slug ?? "").toLowerCase().includes(q)
      )
    : items;

  return { items: filtered, tableReady };
}

export async function deleteNewsletterSubscriber(
  id: string,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!id.trim()) {
    return { ok: false, status: 400, error: "Thiếu ID người đăng ký cần xóa." };
  }

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.newsletter_subscribers = (store.newsletter_subscribers ?? []).filter(
        (s) => s.id !== id
      );
    });
    await recordAuditLog({
      actor,
      action: "delete_newsletter_subscriber",
      entityType: "newsletter_subscriber",
      entityId: id,
      entityLabel: id,
      summary: `Xóa email đăng ký nhận bài Blog #${id}`,
    });
    return { ok: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  const { error } = await admin
    .from("newsletter_subscribers")
    .delete()
    .eq("id", id);

  if (error && isMissingTableError(error)) {
    const list = await readSiteSettingValue<NewsletterSubscriber[]>(
      SUBSCRIBERS_FALLBACK_SETTINGS_KEY,
      []
    );
    const next = (Array.isArray(list) ? list : []).filter((s) => s.id !== id);
    const writeRes = await writeSiteSettingValue(
      SUBSCRIBERS_FALLBACK_SETTINGS_KEY,
      next,
      actor.id
    );
    if (!writeRes.ok) {
      return { ok: false, status: 500, error: writeRes.error ?? "Không thể xóa." };
    }
    return { ok: true };
  }

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "delete_newsletter_subscriber",
    entityType: "newsletter_subscriber",
    entityId: id,
    entityLabel: id,
    summary: `Xóa email đăng ký nhận bài Blog #${id}`,
  });

  return { ok: true };
}
