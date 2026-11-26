import "server-only";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { readStore } from "./store";
import {
  DEFAULT_FAQS,
  DEFAULT_REFERRAL_CONFIG,
  DEFAULT_SITE_GENERAL_SETTINGS,
  DEFAULT_STATIC_PAGES,
} from "./system-cms-shared";
import { DEFAULT_SITE_SEO_SETTINGS } from "./seo-cms-shared";
import type {
  ContentPublishStatus,
  FaqItem,
  ReferralConfigSettings,
  SeoMeta,
  SeoRedirectItem,
  SiteGeneralSettings,
  SiteSeoSettings,
  StaticPageItem,
} from "./types";

let systemSeedPromise: Promise<void> | null = null;

export async function ensureSystemContentSeeded(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  if (!systemSeedPromise) {
    systemSeedPromise = (async () => {
      try {
        const { count: pagesCount, error: pagesErr } = await admin
          .from("static_pages")
          .select("id", { count: "exact", head: true });
        if (!pagesErr && (!pagesCount || pagesCount === 0)) {
          await admin.from("static_pages").upsert(
            DEFAULT_STATIC_PAGES.map((p) => ({
              slug: p.slug,
              title_vi: p.title_vi,
              title_en: p.title_en,
              body_vi: p.body_vi,
              body_en: p.body_en,
              status: p.status,
              seo_meta: p.seo_meta ?? {},
            })),
            { onConflict: "slug", ignoreDuplicates: true }
          );
        }

        const { count: faqsCount, error: faqsErr } = await admin
          .from("faqs")
          .select("id", { count: "exact", head: true });
        if (!faqsErr && (!faqsCount || faqsCount === 0)) {
          await admin.from("faqs").insert(
            DEFAULT_FAQS.map((f) => ({
              question_vi: f.question_vi,
              question_en: f.question_en,
              answer_vi: f.answer_vi,
              answer_en: f.answer_en,
              category: f.category,
              sort_order: f.sort_order,
              is_published: f.is_published,
            }))
          );
        }
      } catch {
        systemSeedPromise = null;
      }
    })();
  }

  await systemSeedPromise;
}

async function getReadSb() {
  const admin = createSupabaseAdminClient();
  if (admin) return admin;
  return createSupabaseServerClient();
}

export function mapStaticPageRow(row: Record<string, unknown>): StaticPageItem {
  const status: ContentPublishStatus =
    row.status === "draft" || row.status === "published" || row.status === "scheduled"
      ? row.status
      : "published";
  return {
    id: String(row.id),
    slug: String(row.slug),
    title_vi: String(row.title_vi ?? ""),
    title_en: String(row.title_en ?? row.title_vi ?? ""),
    body_vi: String(row.body_vi ?? ""),
    body_en: String(row.body_en ?? row.body_vi ?? ""),
    sections_vi: Array.isArray(row.sections_vi)
      ? (row.sections_vi as StaticPageItem["sections_vi"])
      : [],
    sections_en: Array.isArray(row.sections_en)
      ? (row.sections_en as StaticPageItem["sections_en"])
      : [],
    status,
    seo_meta:
      row.seo_meta && typeof row.seo_meta === "object"
        ? (row.seo_meta as SeoMeta)
        : {},
    updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

export function mapFaqRow(row: Record<string, unknown>): FaqItem {
  return {
    id: String(row.id),
    question_vi: String(row.question_vi ?? ""),
    question_en: String(row.question_en ?? row.question_vi ?? ""),
    answer_vi: String(row.answer_vi ?? ""),
    answer_en: String(row.answer_en ?? row.answer_vi ?? ""),
    category: String(row.category ?? "general"),
    sort_order: Number(row.sort_order ?? 0),
    is_published: row.is_published !== false,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function getSiteGeneralSettings(): Promise<SiteGeneralSettings> {
  if (!isSupabaseConfigured()) {
    return {
      ...DEFAULT_SITE_GENERAL_SETTINGS,
      ...(readStore().site_settings?.general ?? {}),
    };
  }
  try {
    const sb = await getReadSb();
    if (!sb) return DEFAULT_SITE_GENERAL_SETTINGS;
    const { data, error } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "general")
      .maybeSingle();
    if (error || !data?.value || typeof data.value !== "object") {
      return DEFAULT_SITE_GENERAL_SETTINGS;
    }
    return {
      ...DEFAULT_SITE_GENERAL_SETTINGS,
      ...(data.value as Partial<SiteGeneralSettings>),
    };
  } catch {
    return DEFAULT_SITE_GENERAL_SETTINGS;
  }
}

export async function getReferralConfig(): Promise<ReferralConfigSettings> {
  if (!isSupabaseConfigured()) {
    return {
      ...DEFAULT_REFERRAL_CONFIG,
      ...(readStore().site_settings?.referral ?? {}),
    };
  }
  try {
    const sb = await getReadSb();
    if (!sb) return DEFAULT_REFERRAL_CONFIG;
    const { data, error } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "referral")
      .maybeSingle();
    if (error || !data?.value || typeof data.value !== "object") {
      return DEFAULT_REFERRAL_CONFIG;
    }
    return {
      ...DEFAULT_REFERRAL_CONFIG,
      ...(data.value as Partial<ReferralConfigSettings>),
    };
  } catch {
    return DEFAULT_REFERRAL_CONFIG;
  }
}

export async function getStaticPageBySlug(
  slug: string,
  includeUnpublished = false
): Promise<StaticPageItem | null> {
  const clean = slug.replace(/^\/+|\/+$/g, "");
  if (!isSupabaseConfigured()) {
    const found = readStore().static_pages.find((p) => p.slug === clean) ?? null;
    if (!found) return null;
    if (!includeUnpublished && found.status === "draft") return null;
    return found;
  }

  await ensureSystemContentSeeded();
  const sb = await getReadSb();
  if (!sb) {
    return DEFAULT_STATIC_PAGES.find((p) => p.slug === clean) ?? null;
  }

  const { data, error } = await sb
    .from("static_pages")
    .select("*")
    .eq("slug", clean)
    .maybeSingle();
  if (error || !data) {
    return includeUnpublished
      ? null
      : DEFAULT_STATIC_PAGES.find((p) => p.slug === clean) ?? null;
  }
  const mapped = mapStaticPageRow(data as Record<string, unknown>);
  if (!includeUnpublished && mapped.status === "draft") return null;
  return mapped;
}

export async function getPublicFaqs(category?: string): Promise<FaqItem[]> {
  if (!isSupabaseConfigured()) {
    const all = readStore()
      .faqs.filter((f) => f.is_published)
      .sort((a, b) => a.sort_order - b.sort_order);
    return category ? all.filter((f) => f.category === category) : all;
  }

  await ensureSystemContentSeeded();
  const sb = await getReadSb();
  if (!sb) {
    return category
      ? DEFAULT_FAQS.filter((f) => f.category === category)
      : DEFAULT_FAQS;
  }

  let query = sb
    .from("faqs")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (category) {
    query = query.eq("category", category);
  }
  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return category
      ? DEFAULT_FAQS.filter((f) => f.category === category)
      : DEFAULT_FAQS;
  }
  return data.map((r) => mapFaqRow(r as Record<string, unknown>));
}

export function mapSeoRedirectRow(row: Record<string, unknown>): SeoRedirectItem {
  const code = Number(row.status_code ?? 301);
  const status_code: 301 | 302 | 307 | 308 =
    code === 302 || code === 307 || code === 308 ? code : 301;
  return {
    id: String(row.id),
    source_path: String(row.source_path ?? ""),
    destination_path: String(row.destination_path ?? ""),
    status_code,
    is_active: row.is_active !== false,
    hit_count: Number(row.hit_count ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

export async function getSiteSeoSettings(): Promise<SiteSeoSettings> {
  if (!isSupabaseConfigured()) {
    return {
      ...DEFAULT_SITE_SEO_SETTINGS,
      ...(readStore().site_settings?.seo ?? {}),
    };
  }
  try {
    const sb = await getReadSb();
    if (!sb) return DEFAULT_SITE_SEO_SETTINGS;
    const { data, error } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "seo")
      .maybeSingle();
    if (error || !data?.value || typeof data.value !== "object") {
      return DEFAULT_SITE_SEO_SETTINGS;
    }
    return {
      ...DEFAULT_SITE_SEO_SETTINGS,
      ...(data.value as Partial<SiteSeoSettings>),
    };
  } catch {
    return DEFAULT_SITE_SEO_SETTINGS;
  }
}

export async function listPublicStaticPages(): Promise<StaticPageItem[]> {
  if (!isSupabaseConfigured()) {
    return readStore().static_pages.filter((p) => p.status === "published");
  }
  await ensureSystemContentSeeded();
  const sb = await getReadSb();
  if (!sb) {
    return DEFAULT_STATIC_PAGES.filter((p) => p.status === "published");
  }
  const { data, error } = await sb
    .from("static_pages")
    .select("*")
    .eq("status", "published")
    .order("slug", { ascending: true });
  if (error || !data || data.length === 0) {
    return DEFAULT_STATIC_PAGES.filter((p) => p.status === "published");
  }
  return data.map((r) => mapStaticPageRow(r as Record<string, unknown>));
}

