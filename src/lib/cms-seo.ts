import "server-only";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { recordAuditLog } from "./admin-auth";
import {
  getBlogPosts,
  getCourses,
  getIeltsTests,
  getLearnVideos,
  getPronunciationSounds,
  isValidUuid,
} from "./db";
import { readStore, updateStore } from "./store";
import {
  getSiteSeoSettings,
  listPublicStaticPages,
  mapSeoRedirectRow,
} from "./site-content";
import {
  normalizeRedirectDestination,
  normalizeRedirectPath,
  seoRedirectToggleSchema,
  seoRedirectUpsertSchema,
  siteSeoSettingsSchema,
} from "./seo-cms-shared";
import { invalidateSeoRedirectCache } from "./seo-redirects-edge";
import type {
  SeoHealthIssue,
  SeoHealthSummary,
  SeoRedirectItem,
  SessionUser,
  SiteSeoSettings,
} from "./types";

type Actor = Pick<SessionUser, "id" | "email" | "role">;

function safeRevalidate(paths: string[]) {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // ignore outside Next request context
    }
  }
}

// =============================================================================
// 1. GLOBAL SITE SEO SETTINGS (ADMIN ONLY)
// =============================================================================
export async function getAdminSeoSettings(): Promise<SiteSeoSettings> {
  return getSiteSeoSettings();
}

export async function saveAdminSeoSettings(
  rawInput: unknown,
  actor: Actor
): Promise<
  | { ok: true; settings: SiteSeoSettings }
  | { ok: false; status: number; error: string }
> {
  const parsed = siteSeoSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Cấu hình SEO không hợp lệ.",
    };
  }

  const normalized: SiteSeoSettings = {
    ...parsed.data,
    twitterHandle: parsed.data.twitterHandle
      ? parsed.data.twitterHandle.startsWith("@")
        ? parsed.data.twitterHandle
        : `@${parsed.data.twitterHandle}`
      : "",
    defaultKeywords: Array.from(
      new Set(parsed.data.defaultKeywords.map((k) => k.trim()).filter(Boolean))
    ),
    robotsDisallowPaths: Array.from(
      new Set(parsed.data.robotsDisallowPaths.map((p) => p.trim()).filter(Boolean))
    ),
  };

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.site_settings.seo = normalized;
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
    }
    const { error } = await admin.from("site_settings").upsert(
      {
        key: "seo",
        value: normalized,
        updated_by: isValidUuid(actor.id) ? actor.id : null,
      },
      { onConflict: "key" }
    );
    if (error) {
      return {
        ok: false,
        status: 500,
        error: `Lưu cấu hình SEO thất bại: ${error.message}`,
      };
    }
  }

  await recordAuditLog({
    actor,
    action: "update_seo_settings",
    entityType: "site_settings",
    entityId: "seo",
    entityLabel: "Cấu hình SEO toàn trang",
    summary: `Cập nhật SEO toàn trang (GA4: ${normalized.googleAnalyticsId || "chưa gắn"}, Sitemap & Robots)`,
  });

  safeRevalidate([
    "/",
    "/sitemap.xml",
    "/robots.txt",
    "/blog",
    "/tests",
    "/courses",
    "/pronunciation",
    "/videos",
    "/about",
    "/pricing",
  ]);
  return { ok: true, settings: normalized };
}

// =============================================================================
// 2. SEO 301 / 302 REDIRECTS MANAGEMENT (ADMIN ONLY)
// =============================================================================
export async function listAdminSeoRedirects(options?: {
  q?: string;
  active?: "" | "true" | "false";
}): Promise<SeoRedirectItem[]> {
  let rows: SeoRedirectItem[];

  if (!isSupabaseConfigured()) {
    rows = [...(readStore().seo_redirects ?? [])].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at)
    );
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return [];
    const { data, error } = await admin
      .from("seo_redirects")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error || !data) return [];
    rows = data.map((r) => mapSeoRedirectRow(r as Record<string, unknown>));
  }

  const q = (options?.q ?? "").trim().toLowerCase();
  return rows.filter((item) => {
    if (options?.active === "true" && !item.is_active) return false;
    if (options?.active === "false" && item.is_active) return false;
    if (q) {
      const hay = `${item.source_path} ${item.destination_path} ${item.status_code}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export async function upsertAdminSeoRedirect(
  rawInput: unknown,
  actor: Actor
): Promise<
  | { ok: true; item: SeoRedirectItem }
  | { ok: false; status: number; error: string }
> {
  const parsed = seoRedirectUpsertSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Thông tin Redirect không hợp lệ.",
    };
  }

  const sourcePath = normalizeRedirectPath(parsed.data.source_path);
  const destinationPath = normalizeRedirectDestination(parsed.data.destination_path);
  const destinationPathOnly = normalizeRedirectPath(destinationPath);

  // Guard against 2-step redirect loop (A -> B while active B -> A exists)
  const existingRedirects = await listAdminSeoRedirects();
  const reverseLoop = existingRedirects.find(
    (r) =>
      r.id !== parsed.data.id &&
      r.is_active &&
      normalizeRedirectPath(r.source_path) === destinationPathOnly &&
      normalizeRedirectPath(r.destination_path) === sourcePath
  );
  if (reverseLoop && parsed.data.is_active) {
    return {
      ok: false,
      status: 400,
      error: `Phát hiện vòng lặp 2 chiều: đã có redirect từ "${reverseLoop.source_path}" → "${reverseLoop.destination_path}". Hãy xóa hoặc tắt quy tắc cũ trước.`,
    };
  }

  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    let saved: SeoRedirectItem | null = null;
    updateStore((store) => {
      if (!Array.isArray(store.seo_redirects)) store.seo_redirects = [];
      const existingIdx = store.seo_redirects.findIndex(
        (r) =>
          (parsed.data.id && r.id === parsed.data.id) ||
          normalizeRedirectPath(r.source_path) === sourcePath
      );
      if (existingIdx >= 0) {
        const cur = store.seo_redirects[existingIdx];
        saved = {
          ...cur,
          source_path: sourcePath,
          destination_path: destinationPath,
          status_code: parsed.data.status_code,
          is_active: parsed.data.is_active,
          updated_at: now,
        };
        store.seo_redirects[existingIdx] = saved;
      } else {
        saved = {
          id: `redir-${Date.now()}`,
          source_path: sourcePath,
          destination_path: destinationPath,
          status_code: parsed.data.status_code,
          is_active: parsed.data.is_active,
          hit_count: 0,
          created_at: now,
          updated_at: now,
        };
        store.seo_redirects.unshift(saved);
      }
    });
    if (!saved) {
      return { ok: false, status: 500, error: "Không thể lưu Redirect." };
    }
    invalidateSeoRedirectCache();
    await recordAuditLog({
      actor,
      action: parsed.data.id ? "update_seo_redirect" : "create_seo_redirect",
      entityType: "seo_redirect",
      entityId: (saved as SeoRedirectItem).id,
      entityLabel: sourcePath,
      summary: `Redirect ${parsed.data.status_code}: ${sourcePath} → ${destinationPath}`,
    });
    return { ok: true, item: saved };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  let data: Record<string, unknown> | null = null;
  if (parsed.data.id && isValidUuid(parsed.data.id)) {
    // Check unique collision on source_path with a different row
    const { data: dup } = await admin
      .from("seo_redirects")
      .select("id")
      .eq("source_path", sourcePath)
      .neq("id", parsed.data.id)
      .maybeSingle();
    if (dup) {
      return {
        ok: false,
        status: 409,
        error: `Đường dẫn nguồn "${sourcePath}" đã tồn tại trong danh sách Redirect.`,
      };
    }

    const res = await admin
      .from("seo_redirects")
      .update({
        source_path: sourcePath,
        destination_path: destinationPath,
        status_code: parsed.data.status_code,
        is_active: parsed.data.is_active,
      })
      .eq("id", parsed.data.id)
      .select("*")
      .single();
    if (res.error || !res.data) {
      return {
        ok: false,
        status: 500,
        error: `Cập nhật Redirect thất bại: ${res.error?.message || "Unknown"}`,
      };
    }
    data = res.data as Record<string, unknown>;
  } else {
    const res = await admin
      .from("seo_redirects")
      .upsert(
        {
          source_path: sourcePath,
          destination_path: destinationPath,
          status_code: parsed.data.status_code,
          is_active: parsed.data.is_active,
          created_by: isValidUuid(actor.id) ? actor.id : null,
        },
        { onConflict: "source_path" }
      )
      .select("*")
      .single();
    if (res.error || !res.data) {
      return {
        ok: false,
        status: 500,
        error: `Tạo Redirect thất bại: ${res.error?.message || "Unknown"}`,
      };
    }
    data = res.data as Record<string, unknown>;
  }

  const item = mapSeoRedirectRow(data);
  invalidateSeoRedirectCache();
  await recordAuditLog({
    actor,
    action: parsed.data.id ? "update_seo_redirect" : "create_seo_redirect",
    entityType: "seo_redirect",
    entityId: item.id,
    entityLabel: item.source_path,
    summary: `Redirect ${item.status_code}: ${item.source_path} → ${item.destination_path} (${item.is_active ? "Bật" : "Tắt"})`,
  });

  return { ok: true, item };
}

export async function toggleAdminSeoRedirect(
  rawInput: unknown,
  actor: Actor
): Promise<
  | { ok: true; item: SeoRedirectItem }
  | { ok: false; status: number; error: string }
> {
  const parsed = seoRedirectToggleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Dữ liệu bật/tắt Redirect không hợp lệ." };
  }

  const { id, is_active } = parsed.data;

  if (!isSupabaseConfigured()) {
    let updated: SeoRedirectItem | null = null;
    updateStore((store) => {
      const target = (store.seo_redirects ?? []).find((r) => r.id === id);
      if (target) {
        target.is_active = is_active;
        target.updated_at = new Date().toISOString();
        updated = { ...target };
      }
    });
    if (!updated) {
      return { ok: false, status: 404, error: "Không tìm thấy Redirect." };
    }
    invalidateSeoRedirectCache();
    await recordAuditLog({
      actor,
      action: "toggle_seo_redirect",
      entityType: "seo_redirect",
      entityId: id,
      entityLabel: (updated as SeoRedirectItem).source_path,
      summary: `${is_active ? "Bật" : "Tắt"} Redirect ${(updated as SeoRedirectItem).source_path}`,
    });
    return { ok: true, item: updated };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }
  const { data, error } = await admin
    .from("seo_redirects")
    .update({ is_active })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, status: 404, error: "Không tìm thấy hoặc không thể cập nhật Redirect." };
  }

  const item = mapSeoRedirectRow(data as Record<string, unknown>);
  invalidateSeoRedirectCache();
  await recordAuditLog({
    actor,
    action: "toggle_seo_redirect",
    entityType: "seo_redirect",
    entityId: item.id,
    entityLabel: item.source_path,
    summary: `${item.is_active ? "Bật" : "Tắt"} Redirect ${item.source_path} → ${item.destination_path}`,
  });
  return { ok: true, item };
}

export async function deleteAdminSeoRedirect(
  id: string,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!id) {
    return { ok: false, status: 400, error: "Thiếu ID Redirect cần xóa." };
  }

  let deletedPath = id;
  if (!isSupabaseConfigured()) {
    let found = false;
    updateStore((store) => {
      const idx = (store.seo_redirects ?? []).findIndex((r) => r.id === id);
      if (idx >= 0) {
        deletedPath = store.seo_redirects[idx].source_path;
        store.seo_redirects.splice(idx, 1);
        found = true;
      }
    });
    if (!found) {
      return { ok: false, status: 404, error: "Không tìm thấy Redirect." };
    }
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
    }
    const { data: existing } = await admin
      .from("seo_redirects")
      .select("source_path")
      .eq("id", id)
      .maybeSingle();
    if (existing?.source_path) {
      deletedPath = String(existing.source_path);
    }
    const { error } = await admin.from("seo_redirects").delete().eq("id", id);
    if (error) {
      return { ok: false, status: 500, error: `Xóa Redirect thất bại: ${error.message}` };
    }
  }

  invalidateSeoRedirectCache();
  await recordAuditLog({
    actor,
    action: "delete_seo_redirect",
    entityType: "seo_redirect",
    entityId: id,
    entityLabel: deletedPath,
    summary: `Xóa Redirect "${deletedPath}"`,
  });
  return { ok: true };
}

// =============================================================================
// 3. SITE-WIDE SEO HEALTH AUDIT
// =============================================================================
export async function getSeoHealthAudit(): Promise<SeoHealthSummary> {
  const [tests, posts, courses, sounds, videos, pages, seoSettings] =
    await Promise.all([
      getIeltsTests(false),
      getBlogPosts(false),
      getCourses(false),
      getPronunciationSounds(false),
      getLearnVideos(false),
      listPublicStaticPages(),
      getSiteSeoSettings(),
    ]);

  const hasGlobalFallbackOg = Boolean(seoSettings.defaultOgImage?.trim());
  const issues: SeoHealthIssue[] = [];
  let totalPublicItems = 0;
  let healthyCount = 0;
  let missingDescCount = 0;
  let missingOgImageCount = 0;
  let noindexCount = 0;

  const inspectItem = (params: {
    id: string;
    module: SeoHealthIssue["module"];
    moduleLabel: string;
    title: string;
    publicPath: string;
    editHref: string;
    effectiveDesc: string;
    hasImage: boolean;
    robotsIndex: boolean;
  }) => {
    totalPublicItems += 1;
    const problems: string[] = [];

    if (!params.robotsIndex) {
      noindexCount += 1;
      problems.push("Đang tắt lập chỉ mục (noindex — ẩn khỏi Google & Sitemap)");
    }

    const descLen = params.effectiveDesc.trim().length;
    if (descLen < 50) {
      missingDescCount += 1;
      problems.push(
        descLen === 0
          ? "Thiếu Meta Description"
          : `Meta Description hơi ngắn (${descLen}/50+ ký tự)`
      );
    } else if (descLen > 170) {
      problems.push(`Meta Description hơi dài (${descLen}/160 ký tự)`);
    }

    if (!params.hasImage && !hasGlobalFallbackOg) {
      missingOgImageCount += 1;
      problems.push("Chưa có ảnh chia sẻ OG riêng (và chưa đặt ảnh OG mặc định)");
    }

    if (problems.length === 0) {
      healthyCount += 1;
    } else {
      issues.push({
        id: `${params.module}-${params.id}`,
        module: params.module,
        moduleLabel: params.moduleLabel,
        title: params.title,
        publicPath: params.publicPath,
        editHref: params.editHref,
        robotsIndex: params.robotsIndex,
        problems,
      });
    }
  };

  for (const post of posts) {
    inspectItem({
      id: post.id,
      module: "blog",
      moduleLabel: "Blog",
      title: post.title_vi,
      publicPath: `/blog/${post.slug}`,
      editHref: `/admin/blog/${post.id}`,
      effectiveDesc: post.seo_meta?.metaDescription || post.excerpt_vi || "",
      hasImage: Boolean(post.seo_meta?.ogImage || post.cover_image_url),
      robotsIndex: post.seo_meta?.robotsIndex !== false,
    });
  }

  for (const test of tests) {
    inspectItem({
      id: test.id,
      module: "test",
      moduleLabel: "Đề thi",
      title: test.title_vi,
      publicPath: `/tests/${test.slug}`,
      editHref: `/admin/tests/${test.id}`,
      effectiveDesc: test.seo_meta?.metaDescription || test.description_vi || "",
      hasImage: Boolean(test.seo_meta?.ogImage),
      robotsIndex: test.seo_meta?.robotsIndex !== false,
    });
  }

  for (const c of courses) {
    inspectItem({
      id: c.id,
      module: "course",
      moduleLabel: "Khóa học",
      title: c.title_vi,
      publicPath: `/courses/${c.slug}`,
      editHref: "/admin/courses",
      effectiveDesc: c.seo_meta?.metaDescription || c.description_vi || "",
      hasImage: Boolean(c.seo_meta?.ogImage || c.cover_image_url),
      robotsIndex: c.seo_meta?.robotsIndex !== false,
    });
  }

  for (const v of videos) {
    inspectItem({
      id: v.id,
      module: "video",
      moduleLabel: "Video",
      title: v.title_vi,
      publicPath: `/videos/${v.slug}`,
      editHref: "/admin/videos",
      effectiveDesc: v.seo_meta?.metaDescription || v.description_vi || "",
      hasImage: true, // YouTube thumbnail auto fallback exists
      robotsIndex: v.seo_meta?.robotsIndex !== false,
    });
  }

  for (const s of sounds) {
    inspectItem({
      id: s.id || s.slug,
      module: "pronunciation",
      moduleLabel: "Phát âm IPA",
      title: `${s.symbol} — ${s.title_vi}`,
      publicPath: `/pronunciation/${s.slug}`,
      editHref: "/admin/pronunciation",
      effectiveDesc: s.seo_meta?.metaDescription || s.vietnameseTip_vi || "",
      hasImage: Boolean(s.seo_meta?.ogImage || s.mouth_image_url),
      robotsIndex: s.seo_meta?.robotsIndex !== false,
    });
  }

  for (const p of pages) {
    inspectItem({
      id: p.id,
      module: "page",
      moduleLabel: "Trang tĩnh",
      title: p.title_vi,
      publicPath: `/${p.slug}`,
      editHref: "/admin/pages",
      effectiveDesc: p.seo_meta?.metaDescription || "",
      hasImage: Boolean(p.seo_meta?.ogImage),
      robotsIndex: p.seo_meta?.robotsIndex !== false,
    });
  }

  return {
    totalPublicItems,
    healthyCount,
    needsAttentionCount: issues.length,
    missingDescCount,
    missingOgImageCount,
    noindexCount,
    issues: issues.slice(0, 60),
  };
}
