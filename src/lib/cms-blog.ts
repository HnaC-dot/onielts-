import "server-only";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { recordAuditLog } from "./admin-auth";
import {
  blogPostFormSchema,
  resolveBlogStatus,
  type BlogPostFormInput,
} from "./blog-shared";
import { extractPlainText, renderBlogContentToSafeHtml } from "./sanitize";
import { slugifyVi } from "./seo";
import { invalidateSeoRedirectCache } from "./seo-redirects-edge";
import { readStore, updateStore } from "./store";
import type { BlogPost, SeoMeta, SessionUser } from "./types";

function mapBlogRow(p: Record<string, unknown>): BlogPost {
  const status =
    p.status === "draft" || p.status === "published" || p.status === "scheduled"
      ? p.status
      : p.is_published
      ? "published"
      : "draft";
  return {
    id: String(p.id),
    slug: String(p.slug),
    title_vi: String(p.title_vi),
    title_en: String(p.title_en ?? p.title_vi),
    excerpt_vi: String(p.excerpt_vi ?? ""),
    excerpt_en: String(p.excerpt_en ?? p.excerpt_vi ?? ""),
    content_vi: String(p.content_vi ?? ""),
    content_en: String(p.content_en ?? p.content_vi ?? ""),
    category: String(p.category ?? "Tips"),
    author_name: String(p.author_name ?? "Đội ngũ học thuật Ôn IELTS"),
    read_minutes: Number(p.read_minutes ?? 5),
    published_at: String(p.published_at ?? p.created_at ?? new Date().toISOString()),
    is_published: Boolean(p.is_published),
    status,
    scheduled_at: p.scheduled_at ? String(p.scheduled_at) : null,
    is_featured: Boolean(p.is_featured),
    is_premium: Boolean(p.is_premium),
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    cover_image_url: p.cover_image_url ? String(p.cover_image_url) : null,
    seo_meta:
      p.seo_meta && typeof p.seo_meta === "object"
        ? (p.seo_meta as SeoMeta)
        : {},
  };
}

function estimateReadMinutes(html: string): number {
  const words = extractPlainText(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function revalidateBlogRoutes(slugs: string[]) {
  try {
    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath("/sitemap.xml");
    for (const s of slugs) {
      if (s) revalidatePath(`/blog/${s}`);
    }
  } catch {
    // Ignore revalidatePath outside Next request context (e.g. unit tests)
  }
}

export async function listAdminBlogPosts(options?: {
  q?: string;
  category?: string;
  status?: "" | "draft" | "published" | "scheduled";
  featured?: "" | "true" | "false";
  premium?: "" | "true" | "false";
  page?: number;
  pageSize?: number;
}): Promise<{
  items: BlogPost[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, options?.pageSize ?? 15));
  const q = (options?.q ?? "").trim().toLowerCase();
  const category = (options?.category ?? "").trim();
  const status = options?.status ?? "";
  const featured = options?.featured ?? "";
  const premium = options?.premium ?? "";

  let allPosts: BlogPost[] = [];

  if (!isSupabaseConfigured()) {
    allPosts = readStore().blog_posts.map((p) => ({
      ...p,
      status: resolveBlogStatus(p),
      tags: p.tags ?? [],
      seo_meta: p.seo_meta ?? {},
    }));
  } else {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data } = await admin
        .from("blog_posts")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(500);
      allPosts = (data ?? []).map((r) => mapBlogRow(r as Record<string, unknown>));
    }
  }

  const filtered = allPosts.filter((p) => {
    const st = resolveBlogStatus(p);
    if (category && p.category !== category) return false;
    if (status && st !== status) return false;
    if (featured === "true" && !p.is_featured) return false;
    if (featured === "false" && p.is_featured) return false;
    if (premium === "true" && !p.is_premium) return false;
    if (premium === "false" && p.is_premium) return false;
    if (q) {
      const hay = `${p.title_vi} ${p.title_en} ${p.slug} ${p.category} ${(p.tags ?? []).join(" ")} ${p.author_name}`.toLowerCase();
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

export async function getAdminBlogPostById(id: string): Promise<BlogPost | null> {
  if (!isSupabaseConfigured()) {
    const found = readStore().blog_posts.find((p) => p.id === id);
    return found
      ? {
          ...found,
          status: resolveBlogStatus(found),
          tags: found.tags ?? [],
          seo_meta: found.seo_meta ?? {},
        }
      : null;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return data ? mapBlogRow(data as Record<string, unknown>) : null;
}

function normalizeBlogPayload(rawInput: BlogPostFormInput) {
  const safeContentVi = renderBlogContentToSafeHtml(rawInput.content_vi);
  const safeContentEn = rawInput.content_en
    ? renderBlogContentToSafeHtml(rawInput.content_en)
    : safeContentVi;
  const readMinutes =
    rawInput.read_minutes && rawInput.read_minutes > 0
      ? rawInput.read_minutes
      : estimateReadMinutes(safeContentVi);

  const scheduledIso =
    rawInput.status === "scheduled" && rawInput.scheduled_at
      ? new Date(rawInput.scheduled_at).toISOString()
      : null;

  const isPublishedBool =
    rawInput.status === "published" ||
    (rawInput.status === "scheduled" &&
      Boolean(scheduledIso) &&
      new Date(scheduledIso!).getTime() <= Date.now());

  const publishedAt =
    rawInput.status === "scheduled" && scheduledIso
      ? scheduledIso
      : new Date().toISOString();

  return {
    slug: slugifyVi(rawInput.slug),
    title_vi: rawInput.title_vi,
    title_en: rawInput.title_en || rawInput.title_vi,
    excerpt_vi: rawInput.excerpt_vi,
    excerpt_en: rawInput.excerpt_en || rawInput.excerpt_vi,
    content_vi: safeContentVi,
    content_en: safeContentEn,
    category: rawInput.category,
    author_name: rawInput.author_name || "Đội ngũ học thuật Ôn IELTS",
    read_minutes: readMinutes,
    status: rawInput.status,
    scheduled_at: scheduledIso,
    is_published: isPublishedBool,
    published_at: publishedAt,
    is_featured: Boolean(rawInput.is_featured),
    is_premium: Boolean(rawInput.is_premium),
    tags: Array.from(
      new Set((rawInput.tags ?? []).map((t) => t.trim()).filter(Boolean))
    ),
    cover_image_url: rawInput.cover_image_url?.trim() || null,
    seo_meta: rawInput.seo_meta ?? {},
  };
}

export async function createCmsBlogPost(
  rawInput: unknown,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<
  { ok: true; post: BlogPost } | { ok: false; status: number; error: string }
> {
  const parsed = blogPostFormSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      status: 400,
      error: firstIssue?.message || "Dữ liệu bài viết không hợp lệ.",
    };
  }

  if (parsed.data.status === "scheduled" && !parsed.data.scheduled_at) {
    return {
      ok: false,
      status: 400,
      error: "Vui lòng chọn ngày giờ khi đặt trạng thái Lên lịch đăng.",
    };
  }

  const payload = normalizeBlogPayload(parsed.data);

  if (!isSupabaseConfigured()) {
    const existing = readStore().blog_posts.find((p) => p.slug === payload.slug);
    if (existing) {
      return { ok: false, status: 409, error: `Slug "${payload.slug}" đã tồn tại.` };
    }
    const created: BlogPost = {
      id: `blog-${Date.now()}`,
      ...payload,
    };
    updateStore((store) => {
      store.blog_posts.unshift(created);
    });
    await recordAuditLog({
      actor,
      action: "create_blog_post",
      entityType: "blog_post",
      entityId: created.id,
      entityLabel: created.title_vi,
      summary: `Tạo bài Blog "${created.title_vi}" (${created.status})`,
    });
    revalidateBlogRoutes([created.slug]);
    return { ok: true, post: created };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  const { data: dup } = await admin
    .from("blog_posts")
    .select("id")
    .eq("slug", payload.slug)
    .maybeSingle();
  if (dup) {
    return {
      ok: false,
      status: 409,
      error: `Slug "${payload.slug}" đã được dùng bởi bài viết khác.`,
    };
  }

  const { data, error } = await admin
    .from("blog_posts")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Không thể tạo bài viết.",
    };
  }

  const post = mapBlogRow(data as Record<string, unknown>);
  await recordAuditLog({
    actor,
    action: "create_blog_post",
    entityType: "blog_post",
    entityId: post.id,
    entityLabel: post.title_vi,
    summary: `Tạo bài Blog "${post.title_vi}" (${post.status}, /blog/${post.slug})`,
  });
  revalidateBlogRoutes([post.slug]);
  return { ok: true, post };
}

export async function updateCmsBlogPost(
  id: string,
  rawInput: unknown,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<
  | { ok: true; post: BlogPost; redirectCreated?: { from: string; to: string } }
  | { ok: false; status: number; error: string }
> {
  const parsed = blogPostFormSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      status: 400,
      error: firstIssue?.message || "Dữ liệu bài viết không hợp lệ.",
    };
  }

  if (parsed.data.status === "scheduled" && !parsed.data.scheduled_at) {
    return {
      ok: false,
      status: 400,
      error: "Vui lòng chọn ngày giờ khi đặt trạng thái Lên lịch đăng.",
    };
  }

  const existing = await getAdminBlogPostById(id);
  if (!existing) {
    return { ok: false, status: 404, error: "Không tìm thấy bài viết." };
  }

  const payload = normalizeBlogPayload(parsed.data);
  // Preserve original published_at if already published and staying published
  if (existing.is_published && payload.status === "published") {
    payload.published_at = existing.published_at;
  }

  let redirectCreated: { from: string; to: string } | undefined;

  if (!isSupabaseConfigured()) {
    const clash = readStore().blog_posts.find(
      (p) => p.slug === payload.slug && p.id !== id
    );
    if (clash) {
      return { ok: false, status: 409, error: `Slug "${payload.slug}" đã tồn tại.` };
    }
    const updated: BlogPost = { ...existing, ...payload, id };
    updateStore((store) => {
      const idx = store.blog_posts.findIndex((p) => p.id === id);
      if (idx !== -1) store.blog_posts[idx] = updated;
    });
    if (existing.slug !== payload.slug) {
      redirectCreated = { from: `/blog/${existing.slug}`, to: `/blog/${payload.slug}` };
    }
    await recordAuditLog({
      actor,
      action: "update_blog_post",
      entityType: "blog_post",
      entityId: updated.id,
      entityLabel: updated.title_vi,
      summary: `Cập nhật bài Blog "${updated.title_vi}" (${updated.status})`,
    });
    revalidateBlogRoutes([existing.slug, updated.slug]);
    return { ok: true, post: updated, redirectCreated };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  if (existing.slug !== payload.slug) {
    const { data: dup } = await admin
      .from("blog_posts")
      .select("id")
      .eq("slug", payload.slug)
      .neq("id", id)
      .maybeSingle();
    if (dup) {
      return {
        ok: false,
        status: 409,
        error: `Slug "${payload.slug}" đã được dùng bởi bài viết khác.`,
      };
    }
  }

  const { data, error } = await admin
    .from("blog_posts")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: error?.message ?? "Không thể cập nhật bài viết.",
    };
  }

  // Automatic 301 redirect when slug changes
  if (existing.slug !== payload.slug) {
    const sourcePath = `/blog/${existing.slug}`;
    const destPath = `/blog/${payload.slug}`;
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

  const post = mapBlogRow(data as Record<string, unknown>);
  await recordAuditLog({
    actor,
    action: "update_blog_post",
    entityType: "blog_post",
    entityId: post.id,
    entityLabel: post.title_vi,
    summary: `Cập nhật bài Blog "${post.title_vi}" (${post.status})${
      redirectCreated ? ` + tự tạo Redirect 301 ${redirectCreated.from} → ${redirectCreated.to}` : ""
    }`,
  });

  revalidateBlogRoutes([existing.slug, post.slug]);
  return { ok: true, post, redirectCreated };
}

export async function duplicateCmsBlogPost(
  id: string,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<
  { ok: true; post: BlogPost } | { ok: false; status: number; error: string }
> {
  const existing = await getAdminBlogPostById(id);
  if (!existing) {
    return { ok: false, status: 404, error: "Không tìm thấy bài viết để nhân bản." };
  }

  const suffix = Date.now().toString().slice(-4);
  const nextSlug = `${slugifyVi(existing.slug).slice(0, 75)}-ban-sao-${suffix}`;

  return createCmsBlogPost(
    {
      title_vi: `${existing.title_vi} (Bản sao)`,
      title_en: `${existing.title_en} (Copy)`,
      slug: nextSlug,
      excerpt_vi: existing.excerpt_vi,
      excerpt_en: existing.excerpt_en,
      content_vi: existing.content_vi,
      content_en: existing.content_en,
      category: existing.category,
      author_name: existing.author_name,
      read_minutes: existing.read_minutes,
      status: "draft",
      scheduled_at: null,
      is_featured: false,
      is_premium: Boolean(existing.is_premium),
      tags: existing.tags ?? [],
      cover_image_url: existing.cover_image_url ?? null,
      seo_meta: existing.seo_meta ?? {},
    },
    actor
  );
}

export async function deleteCmsBlogPost(
  id: string,
  actor: Pick<SessionUser, "id" | "email" | "role">
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await getAdminBlogPostById(id);
  if (!existing) {
    return { ok: false, status: 404, error: "Không tìm thấy bài viết." };
  }

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.blog_posts = store.blog_posts.filter((p) => p.id !== id);
    });
    await recordAuditLog({
      actor,
      action: "delete_blog_post",
      entityType: "blog_post",
      entityId: existing.id,
      entityLabel: existing.title_vi,
      summary: `Xóa bài Blog "${existing.title_vi}" (/blog/${existing.slug})`,
    });
    revalidateBlogRoutes([existing.slug]);
    return { ok: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "Thiếu kết nối Supabase Admin." };
  }

  const { error } = await admin.from("blog_posts").delete().eq("id", id);
  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "delete_blog_post",
    entityType: "blog_post",
    entityId: existing.id,
    entityLabel: existing.title_vi,
    summary: `Xóa bài Blog "${existing.title_vi}" (/blog/${existing.slug})`,
  });
  revalidateBlogRoutes([existing.slug]);
  return { ok: true };
}
