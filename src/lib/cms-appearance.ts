import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { recordAuditLog } from "./admin-auth";
import { isValidUuid } from "./db";
import { readStore, updateStore } from "./store";
import { getSiteGeneralSettings, getSiteSeoSettings } from "./site-content";
import {
  DEFAULT_ADMIN_SIDEBAR_MENU,
  DEFAULT_APPEARANCE_CONFIG,
  DEFAULT_HEADING_TYPOGRAPHY,
  DEFAULT_HOME_SECTIONS,
  DEFAULT_PUBLIC_FOOTER_COLUMNS,
  DEFAULT_PUBLIC_HEADER_MENU,
  DEFAULT_THEME_CONFIG,
  enforceSystemMenuIntegrity,
  mergeAppearanceWithDefaults,
  restoreDefaultMenuNames,
  siteAppearanceSchema,
  type AppearanceVersionEntry,
  type SiteAppearanceConfig,
} from "./appearance-shared";
import type { SessionUser } from "./types";

export const APPEARANCE_PREVIEW_COOKIE = "onielts_appearance_preview";

const KEY_PUBLISHED = "appearance_published";
const KEY_DRAFT = "appearance_draft";
const KEY_HISTORY = "appearance_history";
const MAX_HISTORY_ENTRIES = 20;

type Actor = Pick<SessionUser, "id" | "email" | "role">;

async function getReadSb() {
  const admin = createSupabaseAdminClient();
  if (admin) return admin;
  return createSupabaseServerClient();
}

function safeRevalidateAll() {
  try {
    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
  } catch {
    // ignore outside Next request context
  }
}

async function readSettingValue<T>(key: string): Promise<T | null> {
  if (!isSupabaseConfigured()) {
    const ss = readStore().site_settings;
    if (key === KEY_PUBLISHED) return (ss.appearance_published ?? null) as T | null;
    if (key === KEY_DRAFT) return (ss.appearance_draft ?? null) as T | null;
    if (key === KEY_HISTORY) return (ss.appearance_history ?? null) as T | null;
    return null;
  }

  try {
    const sb = await getReadSb();
    if (!sb) return null;
    const { data, error } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data?.value) return null;
    return data.value as T;
  } catch {
    return null;
  }
}

async function writeSettingValue(
  key: string,
  value: unknown,
  actorId?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      if (key === KEY_PUBLISHED) {
        store.site_settings.appearance_published = value as SiteAppearanceConfig;
      } else if (key === KEY_DRAFT) {
        store.site_settings.appearance_draft = value as SiteAppearanceConfig;
      } else if (key === KEY_HISTORY) {
        store.site_settings.appearance_history = value as AppearanceVersionEntry[];
      }
    });
    return { ok: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Thiếu kết nối Supabase Admin." };
  }
  const { error } = await admin.from("site_settings").upsert(
    {
      key,
      value,
      updated_by: isValidUuid(actorId) ? actorId : null,
    },
    { onConflict: "key" }
  );
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Hydrates appearance defaults with existing `general` and `seo` settings so
 * previously configured values from /admin/settings and /admin/seo are preserved seamlessly.
 */
async function buildHydratedFallback(): Promise<SiteAppearanceConfig> {
  const [general, seo] = await Promise.all([
    getSiteGeneralSettings(),
    getSiteSeoSettings(),
  ]);

  const base = structuredClone(DEFAULT_APPEARANCE_CONFIG);
  base.branding.siteName = general.siteName || base.branding.siteName;
  base.branding.taglineVi = general.taglineVi || base.branding.taglineVi;
  base.branding.taglineEn = general.taglineEn || base.branding.taglineEn;
  if (general.logoUrl) {
    base.branding.logoLightUrl = general.logoUrl;
  }
  base.footer.descriptionVi = general.taglineVi || base.footer.descriptionVi;
  base.footer.descriptionEn = general.taglineEn || base.footer.descriptionEn;
  base.footer.email = general.supportEmail || base.footer.email;
  base.footer.phone = general.hotline || "";
  base.footer.address = general.address || base.footer.address;
  base.footer.socialYoutube = general.socialYoutube || "";
  base.footer.socialFacebook = general.socialFacebook || "";
  base.footer.socialTiktok = general.socialTiktok || "";
  base.footer.socialZalo = general.socialZalo || "";
  base.footer.copyrightVi = general.footerCopyrightVi || base.footer.copyrightVi;
  base.footer.disclaimerVi = general.disclaimerVi || base.footer.disclaimerVi;
  base.footer.disclaimerEn = general.disclaimerEn || base.footer.disclaimerEn;

  base.widgets.topBanner.enabled = Boolean(general.announcementEnabled);
  base.widgets.topBanner.textVi = general.announcementTextVi || base.widgets.topBanner.textVi;
  base.widgets.topBanner.textEn = general.announcementTextEn || base.widgets.topBanner.textEn;
  base.widgets.topBanner.href = general.announcementHref || base.widgets.topBanner.href;

  base.analytics.googleAnalyticsId = seo.googleAnalyticsId || "";
  base.analytics.googleSiteVerification = seo.googleSiteVerification || "";

  return base;
}

export const getPublishedAppearance = cache(
  async (): Promise<SiteAppearanceConfig> => {
    const raw = await readSettingValue<Partial<SiteAppearanceConfig>>(KEY_PUBLISHED);
    if (!raw) {
      return buildHydratedFallback();
    }
    return mergeAppearanceWithDefaults(raw);
  }
);

const getEffectiveAppearanceCached = cache(
  async (
    isAdmin: boolean
  ): Promise<{
    config: SiteAppearanceConfig;
    isPreviewingDraft: boolean;
  }> => {
    if (isAdmin) {
      try {
        const cookieStore = await cookies();
        if (cookieStore.get(APPEARANCE_PREVIEW_COOKIE)?.value === "1") {
          const draftRaw =
            await readSettingValue<Partial<SiteAppearanceConfig>>(KEY_DRAFT);
          if (draftRaw) {
            return {
              config: mergeAppearanceWithDefaults(draftRaw),
              isPreviewingDraft: true,
            };
          }
        }
      } catch {
        // outside request scope (e.g. build/tests)
      }
    }
    const published = await getPublishedAppearance();
    return { config: published, isPreviewingDraft: false };
  }
);

/**
 * Returns the draft config ONLY when an authenticated Admin has enabled preview mode
 * (via HttpOnly cookie `onielts_appearance_preview=1`). Everyone else gets published.
 */
export async function getEffectiveAppearance(isAdmin: boolean): Promise<{
  config: SiteAppearanceConfig;
  isPreviewingDraft: boolean;
}> {
  return getEffectiveAppearanceCached(Boolean(isAdmin));
}

export async function getAdminAppearanceBundle(): Promise<{
  published: SiteAppearanceConfig;
  draft: SiteAppearanceConfig;
  history: AppearanceVersionEntry[];
  hasUnpublishedChanges: boolean;
}> {
  const [published, rawDraft, rawHistory] = await Promise.all([
    getPublishedAppearance(),
    readSettingValue<Partial<SiteAppearanceConfig>>(KEY_DRAFT),
    readSettingValue<AppearanceVersionEntry[]>(KEY_HISTORY),
  ]);

  const draft = rawDraft ? mergeAppearanceWithDefaults(rawDraft) : structuredClone(published);
  const history = Array.isArray(rawHistory) ? rawHistory.slice(0, MAX_HISTORY_ENTRIES) : [];
  const hasUnpublishedChanges = JSON.stringify(draft) !== JSON.stringify(published);

  return { published, draft, history, hasUnpublishedChanges };
}

async function appendHistorySnapshot(
  entry: AppearanceVersionEntry,
  actorId?: string
): Promise<AppearanceVersionEntry[]> {
  const existing = (await readSettingValue<AppearanceVersionEntry[]>(KEY_HISTORY)) ?? [];
  const next = [entry, ...(Array.isArray(existing) ? existing : [])].slice(
    0,
    MAX_HISTORY_ENTRIES
  );
  await writeSettingValue(KEY_HISTORY, next, actorId);
  return next;
}

/**
 * Keeps `general` and `seo` keys in `site_settings` in sync on publish so
 * /admin/settings, /admin/seo, and /admin/appearance always share one source of truth.
 */
async function syncGeneralAndSeoFromAppearance(
  config: SiteAppearanceConfig,
  actorId?: string
): Promise<void> {
  const [curGeneral, curSeo] = await Promise.all([
    getSiteGeneralSettings(),
    getSiteSeoSettings(),
  ]);

  const nextGeneral = {
    ...curGeneral,
    siteName: config.branding.siteName,
    taglineVi: config.branding.taglineVi,
    taglineEn: config.branding.taglineEn,
    logoUrl: config.branding.logoLightUrl || curGeneral.logoUrl,
    supportEmail: config.footer.email,
    hotline: config.footer.phone,
    address: config.footer.address,
    socialYoutube: config.footer.socialYoutube,
    socialFacebook: config.footer.socialFacebook,
    socialTiktok: config.footer.socialTiktok,
    socialZalo: config.footer.socialZalo,
    disclaimerVi: config.footer.disclaimerVi,
    disclaimerEn: config.footer.disclaimerEn,
    footerCopyrightVi: config.footer.copyrightVi,
    announcementEnabled: config.widgets.topBanner.enabled,
    announcementTextVi: config.widgets.topBanner.textVi,
    announcementTextEn: config.widgets.topBanner.textEn,
    announcementHref: config.widgets.topBanner.href,
  };

  const nextSeo = {
    ...curSeo,
    googleAnalyticsId: config.analytics.googleAnalyticsId,
    googleSiteVerification: config.analytics.googleSiteVerification,
  };

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.site_settings.general = nextGeneral;
      store.site_settings.seo = nextSeo;
    });
    return;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const uid = isValidUuid(actorId) ? actorId : null;
  await Promise.all([
    admin
      .from("site_settings")
      .upsert({ key: "general", value: nextGeneral, updated_by: uid }, { onConflict: "key" }),
    admin
      .from("site_settings")
      .upsert({ key: "seo", value: nextSeo, updated_by: uid }, { onConflict: "key" }),
  ]);
}

function validateAndSanitizeAppearance(
  rawInput: unknown
):
  | { ok: true; config: SiteAppearanceConfig }
  | { ok: false; status: number; error: string } {
  const parsed = siteAppearanceSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const pathLabel = first?.path?.length ? ` (${first.path.join(".")})` : "";
    return {
      ok: false,
      status: 400,
      error: `${first?.message || "Cấu hình giao diện không hợp lệ."}${pathLabel}`,
    };
  }
  const safeConfig = enforceSystemMenuIntegrity(parsed.data as SiteAppearanceConfig);
  return { ok: true, config: safeConfig };
}

export async function saveAppearanceDraft(
  rawInput: unknown,
  actor: Actor,
  note = "Lưu bản nháp Giao diện & Trang chủ"
): Promise<
  | { ok: true; draft: SiteAppearanceConfig; history: AppearanceVersionEntry[] }
  | { ok: false; status: number; error: string }
> {
  const validated = validateAndSanitizeAppearance(rawInput);
  if (!validated.ok) return validated;

  const saved = await writeSettingValue(KEY_DRAFT, validated.config, actor.id);
  if (!saved.ok) {
    return { ok: false, status: 500, error: `Lưu nháp thất bại: ${saved.error}` };
  }

  const entry: AppearanceVersionEntry = {
    versionId: `ver-${Date.now()}`,
    savedAt: new Date().toISOString(),
    actorEmail: actor.email,
    action: "draft",
    note: note.slice(0, 140),
    config: validated.config,
  };
  const history = await appendHistorySnapshot(entry, actor.id);

  await recordAuditLog({
    actor,
    action: "appearance.save_draft",
    entityType: "appearance",
    entityId: entry.versionId,
    entityLabel: "Giao diện & Trang chủ (Nháp)",
    summary: note.slice(0, 140),
  });

  return { ok: true, draft: validated.config, history };
}

export async function publishAppearance(
  rawInput: unknown,
  actor: Actor,
  note = "Xuất bản Giao diện & Trang chủ"
): Promise<
  | {
      ok: true;
      published: SiteAppearanceConfig;
      draft: SiteAppearanceConfig;
      history: AppearanceVersionEntry[];
    }
  | { ok: false; status: number; error: string }
> {
  const validated = validateAndSanitizeAppearance(rawInput);
  if (!validated.ok) return validated;

  const [savePub, saveDraft] = await Promise.all([
    writeSettingValue(KEY_PUBLISHED, validated.config, actor.id),
    writeSettingValue(KEY_DRAFT, validated.config, actor.id),
  ]);
  if (!savePub.ok || !saveDraft.ok) {
    return {
      ok: false,
      status: 500,
      error: `Xuất bản thất bại: ${!savePub.ok ? savePub.error : !saveDraft.ok ? saveDraft.error : "Unknown"}`,
    };
  }

  await syncGeneralAndSeoFromAppearance(validated.config, actor.id);

  const entry: AppearanceVersionEntry = {
    versionId: `ver-${Date.now()}`,
    savedAt: new Date().toISOString(),
    actorEmail: actor.email,
    action: "publish",
    note: note.slice(0, 140),
    config: validated.config,
  };
  const history = await appendHistorySnapshot(entry, actor.id);

  await recordAuditLog({
    actor,
    action: "appearance.publish",
    entityType: "appearance",
    entityId: entry.versionId,
    entityLabel: "Giao diện & Trang chủ",
    summary: `${note.slice(0, 120)} (Font: ${validated.config.theme.fontFamily}, Bảo trì: ${validated.config.widgets.maintenance.enabled ? "Bật" : "Tắt"})`,
  });

  safeRevalidateAll();
  return {
    ok: true,
    published: validated.config,
    draft: validated.config,
    history,
  };
}

export async function restoreAppearanceVersion(
  versionId: string,
  publishNow: boolean,
  actor: Actor
): Promise<
  | {
      ok: true;
      published: SiteAppearanceConfig;
      draft: SiteAppearanceConfig;
      history: AppearanceVersionEntry[];
    }
  | { ok: false; status: number; error: string }
> {
  const bundle = await getAdminAppearanceBundle();
  const target = bundle.history.find((h) => h.versionId === versionId);
  if (!target) {
    return { ok: false, status: 404, error: "Không tìm thấy phiên bản cần khôi phục." };
  }

  const restored = enforceSystemMenuIntegrity(
    mergeAppearanceWithDefaults(target.config)
  );
  const note = `Khôi phục phiên bản ${versionId} (${publishNow ? "Xuất bản ngay" : "Về Nháp"})`;

  if (publishNow) {
    return publishAppearance(restored, actor, note);
  }
  const draftRes = await saveAppearanceDraft(restored, actor, note);
  if (!draftRes.ok) return draftRes;
  return {
    ok: true,
    published: bundle.published,
    draft: draftRes.draft,
    history: draftRes.history,
  };
}

export async function resetAppearanceScope(
  scope:
    | "all"
    | "theme"
    | "heading_typography"
    | "menus"
    | "menu_names"
    | "homepage"
    | "ui_texts",
  publishNow: boolean,
  actor: Actor
): Promise<
  | {
      ok: true;
      published: SiteAppearanceConfig;
      draft: SiteAppearanceConfig;
      history: AppearanceVersionEntry[];
    }
  | { ok: false; status: number; error: string }
> {
  const bundle = await getAdminAppearanceBundle();
  let next = structuredClone(bundle.draft);

  if (scope === "all") {
    next = structuredClone(DEFAULT_APPEARANCE_CONFIG);
  } else if (scope === "theme") {
    next.theme = structuredClone(DEFAULT_THEME_CONFIG);
  } else if (scope === "heading_typography") {
    next.headingTypography = structuredClone(DEFAULT_HEADING_TYPOGRAPHY);
  } else if (scope === "menus") {
    next.menus = {
      adminSidebar: structuredClone(DEFAULT_ADMIN_SIDEBAR_MENU),
      publicHeader: structuredClone(DEFAULT_PUBLIC_HEADER_MENU),
      publicFooter: structuredClone(DEFAULT_PUBLIC_FOOTER_COLUMNS),
    };
  } else if (scope === "menu_names") {
    next = restoreDefaultMenuNames(next);
  } else if (scope === "homepage") {
    next.homepage.sections = structuredClone(DEFAULT_HOME_SECTIONS);
  } else if (scope === "ui_texts") {
    next.uiTexts = {};
  }

  const note = `Khôi phục mặc định (${scope})`;
  if (publishNow) {
    return publishAppearance(next, actor, note);
  }
  const draftRes = await saveAppearanceDraft(next, actor, note);
  if (!draftRes.ok) return draftRes;
  return {
    ok: true,
    published: bundle.published,
    draft: draftRes.draft,
    history: draftRes.history,
  };
}
