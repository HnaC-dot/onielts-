import "server-only";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { recordAuditLog } from "./admin-auth";
import {
  adminUpdateUser,
  getPricingPlans,
  getPromoBanner,
  getPromoCodes,
  isValidUuid,
  listAllProfiles,
  listOrders,
} from "./db";
import { readStore, updateStore } from "./store";
import { sanitizeRichHtml } from "./sanitize";
import {
  ensureSystemContentSeeded,
  getReferralConfig,
  getSiteGeneralSettings,
  mapFaqRow,
  mapStaticPageRow,
} from "./site-content";
import {
  adminUserPatchSchema,
  contactMessageUpdateSchema,
  faqUpsertSchema,
  featureRequestUpdateSchema,
  pricingPlanUpsertSchema,
  promoBannerUpdateSchema,
  promoCodeCreateSchema,
  referralConfigSchema,
  siteGeneralSettingsSchema,
  staticPageUpsertSchema,
} from "./system-cms-shared";
import type {
  ContactMessageItem,
  FaqItem,
  FeatureRequestItem,
  OrderRecord,
  PricingPlan,
  PromoBanner,
  PromoCode,
  ReferralConfigSettings,
  ReferralRecord,
  SessionUser,
  SiteGeneralSettings,
  StaticPageItem,
  UserProfile,
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
// 1. USERS & PREMIUM MANAGEMENT (ADMIN ONLY)
// =============================================================================
export interface AdminUserSummary extends UserProfile {
  isPremiumActive: boolean;
  paidOrderCount: number;
  totalSpentVnd: number;
}

export async function listAdminUsers(options?: {
  q?: string;
  role?: "" | "learner" | "editor" | "admin";
  premium?: "" | "active" | "free";
  locked?: "" | "true" | "false";
  page?: number;
  pageSize?: number;
}): Promise<{
  items: AdminUserSummary[];
  orders: OrderRecord[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    totalUsers: number;
    premiumUsers: number;
    staffUsers: number;
    lockedUsers: number;
    paidOrders: number;
    totalRevenueVnd: number;
  };
}> {
  const [profiles, orders] = await Promise.all([
    listAllProfiles(),
    listOrders(),
  ]);

  const now = Date.now();
  const orderStatsByUser = new Map<string, { paidCount: number; totalVnd: number }>();
  let paidOrders = 0;
  let totalRevenueVnd = 0;

  for (const o of orders) {
    if (o.status === "paid") {
      paidOrders += 1;
      totalRevenueVnd += o.amount_vnd;
      const prev = orderStatsByUser.get(o.user_id) ?? { paidCount: 0, totalVnd: 0 };
      prev.paidCount += 1;
      prev.totalVnd += o.amount_vnd;
      orderStatsByUser.set(o.user_id, prev);
    }
  }

  const enriched: AdminUserSummary[] = profiles.map((p) => {
    const isPremiumActive =
      p.role === "admin" ||
      Boolean(p.premium_expires_at && new Date(p.premium_expires_at).getTime() > now);
    const oStat = orderStatsByUser.get(p.id);
    return {
      ...p,
      isPremiumActive,
      paidOrderCount: oStat?.paidCount ?? 0,
      totalSpentVnd: oStat?.totalVnd ?? 0,
    };
  });

  const stats = {
    totalUsers: enriched.length,
    premiumUsers: enriched.filter((u) => u.isPremiumActive).length,
    staffUsers: enriched.filter((u) => u.role === "admin" || u.role === "editor").length,
    lockedUsers: enriched.filter((u) => Boolean(u.is_locked)).length,
    paidOrders,
    totalRevenueVnd,
  };

  const q = (options?.q ?? "").trim().toLowerCase();
  const role = options?.role ?? "";
  const premium = options?.premium ?? "";
  const locked = options?.locked ?? "";
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, options?.pageSize ?? 25));

  const filtered = enriched.filter((u) => {
    if (role && u.role !== role) return false;
    if (premium === "active" && !u.isPremiumActive) return false;
    if (premium === "free" && u.isPremiumActive) return false;
    if (locked === "true" && !u.is_locked) return false;
    if (locked === "false" && u.is_locked) return false;
    if (q) {
      const hay = `${u.email} ${u.full_name} ${u.referral_code} ${u.role}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    orders: orders.slice(0, 100),
    total: filtered.length,
    page,
    pageSize,
    stats,
  };
}

export async function updateAdminUserSafe(
  userId: string,
  rawInput: unknown,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const parsed = adminUserPatchSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Dữ liệu cập nhật người dùng không hợp lệ.",
    };
  }
  const d = parsed.data;

  // Guard: prevent self-lockout or self-demotion
  if (userId === actor.id) {
    if (d.is_locked === true) {
      return {
        ok: false,
        status: 400,
        error: "Không thể tự khóa tài khoản Admin đang đăng nhập.",
      };
    }
    if (d.role && d.role !== "admin") {
      return {
        ok: false,
        status: 400,
        error: "Không thể tự hạ quyền Admin của chính mình.",
      };
    }
  }

  await adminUpdateUser({
    userId,
    role: d.role,
    isLocked: d.is_locked,
    grantMonths: d.grant_months,
    revokePremium: d.revoke_premium,
  });

  const summaryParts: string[] = [];
  if (d.role) summaryParts.push(`đổi role → ${d.role}`);
  if (typeof d.is_locked === "boolean") {
    summaryParts.push(d.is_locked ? "khóa tài khoản" : "mở khóa tài khoản");
  }
  if (d.grant_months && d.grant_months > 0) {
    summaryParts.push(`cấp +${d.grant_months} tháng Premium`);
  }
  if (d.revoke_premium) {
    summaryParts.push("thu hồi Premium");
  }

  await recordAuditLog({
    actor,
    action: "profile.admin_update",
    entityType: "profile",
    entityId: userId,
    entityLabel: userId,
    summary: `Cập nhật tài khoản: ${summaryParts.join(", ") || "thay đổi thuộc tính"}`,
    metadata: d as Record<string, unknown>,
  });

  return { ok: true };
}

// =============================================================================
// 2. PRICING PLANS, PROMO BANNER, PROMO CODES & REFERRALS (ADMIN ONLY)
// =============================================================================
export async function getAdminPricingBundle(): Promise<{
  plans: PricingPlan[];
  banner: PromoBanner;
  promoCodes: PromoCode[];
  referrals: ReferralRecord[];
  referralConfig: ReferralConfigSettings;
}> {
  const [plans, banner, promoCodes, referralConfig] = await Promise.all([
    getPricingPlans(true),
    getPromoBanner(),
    getPromoCodes(),
    getReferralConfig(),
  ]);

  let referrals: ReferralRecord[] = [];
  if (!isSupabaseConfigured()) {
    referrals = readStore().referrals;
  } else {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data } = await admin
        .from("referrals")
        .select("*, referred:profiles!referrals_referred_user_id_fkey(email)")
        .order("created_at", { ascending: false })
        .limit(100);
      referrals = (data ?? []).map((r) => {
        const refProfile = r.referred as { email?: string } | null;
        return {
          id: String(r.id),
          referrer_id: String(r.referrer_id),
          referred_user_id: String(r.referred_user_id),
          referred_email: String(refProfile?.email ?? "learner@onielts.vn"),
          referral_code: String(r.referral_code),
          status: r.status as ReferralRecord["status"],
          created_at: String(r.created_at),
          converted_at: r.converted_at ? String(r.converted_at) : null,
        };
      });
    }
  }

  return { plans, banner, promoCodes, referrals, referralConfig };
}

export async function upsertPricingPlanCms(
  rawInput: unknown,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const parsed = pricingPlanUpsertSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Thông tin gói giá không hợp lệ.",
    };
  }
  const d = parsed.data;
  const normalizedOriginal = Math.max(d.price_vnd, d.original_price_vnd);

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const existing = d.id
        ? store.pricing_plans.find((p) => p.id === d.id)
        : store.pricing_plans.find((p) => p.slug === d.slug);
      if (existing) {
        existing.slug = d.slug;
        existing.name_vi = d.name_vi;
        existing.name_en = d.name_en || d.name_vi;
        existing.duration_months = d.duration_months;
        existing.price_vnd = d.price_vnd;
        existing.original_price_vnd = normalizedOriginal;
        existing.is_popular = d.is_popular;
        existing.is_active = d.is_active;
        existing.sort_order = d.sort_order;
        existing.features_vi = d.features_vi;
        existing.features_en = d.features_en.length ? d.features_en : d.features_vi;
      } else {
        store.pricing_plans.push({
          id: `plan-${Date.now()}`,
          slug: d.slug,
          name_vi: d.name_vi,
          name_en: d.name_en || d.name_vi,
          duration_months: d.duration_months,
          price_vnd: d.price_vnd,
          original_price_vnd: normalizedOriginal,
          is_popular: d.is_popular,
          is_active: d.is_active,
          sort_order: d.sort_order,
          features_vi: d.features_vi,
          features_en: d.features_en.length ? d.features_en : d.features_vi,
        });
      }
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const row = {
      slug: d.slug,
      name_vi: d.name_vi,
      name_en: d.name_en || d.name_vi,
      duration_months: d.duration_months,
      price_vnd: d.price_vnd,
      original_price_vnd: normalizedOriginal,
      is_popular: d.is_popular,
      is_active: d.is_active,
      sort_order: d.sort_order,
      features_vi: d.features_vi,
      features_en: d.features_en.length ? d.features_en : d.features_vi,
      updated_at: new Date().toISOString(),
    };
    const { error } = d.id && isValidUuid(d.id)
      ? await admin.from("pricing_plans").update(row).eq("id", d.id)
      : await admin.from("pricing_plans").upsert(row, { onConflict: "slug" });
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "pricing_plan.upsert",
    entityType: "pricing_plan",
    entityId: d.id ?? d.slug,
    entityLabel: d.name_vi,
    summary: `Lưu gói ${d.name_vi} (${d.price_vnd.toLocaleString("vi-VN")}đ / ${d.duration_months} tháng)`,
  });
  safeRevalidate(["/pricing", "/"]);
  return { ok: true };
}

export async function updatePromoBannerCms(
  rawInput: unknown,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const parsed = promoBannerUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Thông tin banner không hợp lệ.",
    };
  }
  const d = parsed.data;
  const normalizedEndsAt = new Date(d.ends_at).toISOString();
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.promo_banner = {
        ...store.promo_banner,
        title_vi: d.title_vi,
        title_en: d.title_en || d.title_vi,
        badge_vi: d.badge_vi,
        badge_en: d.badge_en,
        cta_vi: d.cta_vi,
        cta_en: d.cta_en,
        ends_at: normalizedEndsAt,
        is_active: d.is_active,
      };
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const { error } = await admin.from("promo_banners").upsert(
      {
        key: "main_pricing_promo",
        title_vi: d.title_vi,
        title_en: d.title_en || d.title_vi,
        badge_vi: d.badge_vi,
        badge_en: d.badge_en,
        cta_vi: d.cta_vi,
        cta_en: d.cta_en,
        ends_at: normalizedEndsAt,
        is_active: d.is_active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "promo_banner.update",
    entityType: "promo_banner",
    entityLabel: d.title_vi.slice(0, 80),
    summary: `Cập nhật banner khuyến mãi (active=${d.is_active}, hết hạn=${normalizedEndsAt})`,
  });
  safeRevalidate(["/pricing", "/admin/pricing"]);
  return { ok: true };
}

export async function createPromoCodeCms(
  rawInput: unknown,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const parsed = promoCodeCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Mã giảm giá không hợp lệ.",
    };
  }
  const d = parsed.data;
  const upperCode = d.code.toUpperCase();

  if (!isSupabaseConfigured()) {
    const dup = readStore().promo_codes.some((c) => c.code.toUpperCase() === upperCode);
    if (dup) return { ok: false, status: 409, error: `Mã "${upperCode}" đã tồn tại.` };
    updateStore((store) => {
      store.promo_codes.unshift({
        id: `code-${Date.now()}`,
        code: upperCode,
        discount_percent: d.discount_percent,
        max_discount_vnd: d.max_discount_vnd ?? null,
        max_uses: d.max_uses ?? 500,
        current_uses: 0,
        expires_at: d.expires_at || "2027-12-31T16:59:59.000Z",
        is_active: true,
      });
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const { data: dup } = await admin
      .from("promo_codes")
      .select("id")
      .eq("code", upperCode)
      .maybeSingle();
    if (dup) return { ok: false, status: 409, error: `Mã "${upperCode}" đã tồn tại.` };
    const { error } = await admin.from("promo_codes").insert({
      code: upperCode,
      discount_percent: d.discount_percent,
      max_discount_vnd: d.max_discount_vnd ?? null,
      max_uses: d.max_uses ?? 500,
      current_uses: 0,
      expires_at: d.expires_at || "2027-12-31T16:59:59.000Z",
      is_active: true,
    });
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "promo_code.create",
    entityType: "promo_code",
    entityLabel: upperCode,
    summary: `Tạo mã giảm giá ${upperCode} (-${d.discount_percent}%)`,
  });
  return { ok: true };
}

export async function togglePromoCodeCms(
  id: string,
  is_active: boolean,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const target = store.promo_codes.find((c) => c.id === id);
      if (target) target.is_active = is_active;
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const { error } = await admin.from("promo_codes").update({ is_active }).eq("id", id);
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "promo_code.toggle",
    entityType: "promo_code",
    entityId: id,
    entityLabel: id,
    summary: `${is_active ? "Kích hoạt" : "Tạm tắt"} mã giảm giá`,
  });
  return { ok: true };
}

export async function deletePromoCodeCms(
  id: string,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.promo_codes = store.promo_codes.filter((c) => c.id !== id);
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const { error } = await admin.from("promo_codes").delete().eq("id", id);
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "promo_code.delete",
    entityType: "promo_code",
    entityId: id,
    entityLabel: id,
    summary: `Xóa mã giảm giá`,
  });
  return { ok: true };
}

export async function saveReferralConfigCms(
  rawInput: unknown,
  actor: Actor
): Promise<{ ok: true; config: ReferralConfigSettings } | { ok: false; status: number; error: string }> {
  const parsed = referralConfigSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Cấu hình Referral không hợp lệ.",
    };
  }
  const config: ReferralConfigSettings = {
    isEnabled: parsed.data.isEnabled,
    referrerBonusDays: parsed.data.referrerBonusDays,
    referredBonusDays: parsed.data.referredBonusDays,
    headlineVi: parsed.data.headlineVi,
    headlineEn: parsed.data.headlineEn || parsed.data.headlineVi,
  };

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.site_settings.referral = config;
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const { error } = await admin.from("site_settings").upsert(
      {
        key: "referral",
        value: config,
        updated_by: isValidUuid(actor.id) ? actor.id : null,
      },
      { onConflict: "key" }
    );
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "site_settings.referral",
    entityType: "site_settings",
    entityId: "referral",
    entityLabel: "Cấu hình Referral",
    summary: `Cập nhật Referral (+${config.referrerBonusDays}d người mời / +${config.referredBonusDays}d người được mời)`,
  });
  safeRevalidate(["/referral"]);
  return { ok: true, config };
}

// =============================================================================
// 3. INBOX: CONTACT MESSAGES & FEATURE REQUESTS (STAFF)
// =============================================================================
export async function listInboxBundle(): Promise<{
  contacts: ContactMessageItem[];
  featureRequests: FeatureRequestItem[];
}> {
  if (!isSupabaseConfigured()) {
    const store = readStore();
    return {
      contacts: store.contact_messages,
      featureRequests: store.feature_requests,
    };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return { contacts: [], featureRequests: [] };

  const [contactsRes, frRes] = await Promise.all([
    admin
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("feature_requests")
      .select("*")
      .order("votes", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const contacts: ContactMessageItem[] = (contactsRes.data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    email: String(r.email),
    subject: String(r.subject),
    message: String(r.message),
    status: (r.status === "replied" ? "replied" : "new") as ContactMessageItem["status"],
    is_read: Boolean(r.is_read),
    admin_note: r.admin_note ? String(r.admin_note) : "",
    created_at: String(r.created_at),
  }));

  const featureRequests: FeatureRequestItem[] = (frRes.data ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    description: String(r.description),
    votes: Number(r.votes ?? 0),
    status: (r.status === "planned" || r.status === "shipped" ? r.status : "open") as FeatureRequestItem["status"],
    email: r.email ? String(r.email) : null,
    admin_note: r.admin_note ? String(r.admin_note) : "",
    created_at: String(r.created_at),
  }));

  return { contacts, featureRequests };
}

export async function updateContactMessageCms(
  rawInput: unknown,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const parsed = contactMessageUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Dữ liệu cập nhật tin nhắn không hợp lệ." };
  }
  const d = parsed.data;
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const m = store.contact_messages.find((item) => item.id === d.id);
      if (!m) return;
      if (d.status) m.status = d.status;
      if (typeof d.is_read === "boolean") m.is_read = d.is_read;
      if (typeof d.admin_note === "string") m.admin_note = d.admin_note;
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const patch: Record<string, unknown> = {};
    if (d.status) patch.status = d.status;
    if (typeof d.is_read === "boolean") patch.is_read = d.is_read;
    if (typeof d.admin_note === "string") patch.admin_note = d.admin_note;
    const { error } = await admin.from("contact_messages").update(patch).eq("id", d.id);
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "contact_message.update",
    entityType: "contact_message",
    entityId: d.id,
    entityLabel: `Liên hệ #${d.id.slice(0, 8)}`,
    summary: `Cập nhật tin liên hệ (status=${d.status ?? "-"}, read=${d.is_read ?? "-"})`,
  });
  return { ok: true };
}

export async function deleteContactMessageCms(
  id: string,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.contact_messages = store.contact_messages.filter((m) => m.id !== id);
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const { error } = await admin.from("contact_messages").delete().eq("id", id);
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "contact_message.delete",
    entityType: "contact_message",
    entityId: id,
    entityLabel: `Liên hệ #${id.slice(0, 8)}`,
    summary: "Xóa tin nhắn liên hệ",
  });
  return { ok: true };
}

export async function updateFeatureRequestCms(
  rawInput: unknown,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const parsed = featureRequestUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Dữ liệu cập nhật đề xuất không hợp lệ." };
  }
  const d = parsed.data;
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const f = store.feature_requests.find((item) => item.id === d.id);
      if (!f) return;
      if (d.status) f.status = d.status;
      if (typeof d.admin_note === "string") f.admin_note = d.admin_note;
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const patch: Record<string, unknown> = {};
    if (d.status) patch.status = d.status;
    if (typeof d.admin_note === "string") patch.admin_note = d.admin_note;
    const { error } = await admin.from("feature_requests").update(patch).eq("id", d.id);
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "feature_request.update",
    entityType: "feature_request",
    entityId: d.id,
    entityLabel: `Đề xuất #${d.id.slice(0, 8)}`,
    summary: `Chuyển trạng thái đề xuất tính năng → ${d.status ?? "ghi chú"}`,
  });
  safeRevalidate(["/feature-requests"]);
  return { ok: true };
}

export async function deleteFeatureRequestCms(
  id: string,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.feature_requests = store.feature_requests.filter((f) => f.id !== id);
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const { error } = await admin.from("feature_requests").delete().eq("id", id);
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "feature_request.delete",
    entityType: "feature_request",
    entityId: id,
    entityLabel: `Đề xuất #${id.slice(0, 8)}`,
    summary: "Xóa đề xuất tính năng",
  });
  safeRevalidate(["/feature-requests"]);
  return { ok: true };
}

// =============================================================================
// 4. STATIC PAGES & FAQS (STAFF)
// =============================================================================
export async function listPagesAndFaqsBundle(): Promise<{
  pages: StaticPageItem[];
  faqs: FaqItem[];
}> {
  if (!isSupabaseConfigured()) {
    const store = readStore();
    return {
      pages: store.static_pages,
      faqs: [...store.faqs].sort((a, b) => a.sort_order - b.sort_order),
    };
  }
  await ensureSystemContentSeeded();
  const admin = createSupabaseAdminClient();
  if (!admin) return { pages: [], faqs: [] };

  const [pagesRes, faqsRes] = await Promise.all([
    admin.from("static_pages").select("*").order("slug", { ascending: true }),
    admin
      .from("faqs")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  return {
    pages: (pagesRes.data ?? []).map((r) => mapStaticPageRow(r as Record<string, unknown>)),
    faqs: (faqsRes.data ?? []).map((r) => mapFaqRow(r as Record<string, unknown>)),
  };
}

export async function upsertStaticPageCms(
  rawInput: unknown,
  actor: Actor
): Promise<{ ok: true; page: StaticPageItem } | { ok: false; status: number; error: string }> {
  const parsed = staticPageUpsertSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Dữ liệu trang tĩnh không hợp lệ.",
    };
  }
  const d = parsed.data;
  const cleanSlug = d.slug.replace(/^\/+|\/+$/g, "");
  const safeBodyVi = sanitizeRichHtml(d.body_vi);
  const safeBodyEn = sanitizeRichHtml(d.body_en || d.body_vi);
  const nowIso = new Date().toISOString();

  let saved: StaticPageItem;
  if (!isSupabaseConfigured()) {
    saved = updateStore((store) => {
      const idx = store.static_pages.findIndex(
        (p) => (d.id && p.id === d.id) || p.slug === cleanSlug
      );
      const next: StaticPageItem = {
        id: idx >= 0 ? store.static_pages[idx].id : `page-${Date.now()}`,
        slug: cleanSlug,
        title_vi: d.title_vi,
        title_en: d.title_en || d.title_vi,
        body_vi: safeBodyVi,
        body_en: safeBodyEn,
        status: d.status,
        seo_meta: d.seo_meta ?? {},
        updated_at: nowIso,
      };
      if (idx >= 0) store.static_pages[idx] = next;
      else store.static_pages.push(next);
      return next;
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const row = {
      slug: cleanSlug,
      title_vi: d.title_vi,
      title_en: d.title_en || d.title_vi,
      body_vi: safeBodyVi,
      body_en: safeBodyEn,
      status: d.status,
      seo_meta: d.seo_meta ?? {},
      updated_by: isValidUuid(actor.id) ? actor.id : null,
    };
    const { data, error } = await admin
      .from("static_pages")
      .upsert(row, { onConflict: "slug" })
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, status: 500, error: error?.message || "Lưu trang tĩnh thất bại." };
    }
    saved = mapStaticPageRow(data as Record<string, unknown>);
  }

  await recordAuditLog({
    actor,
    action: "static_page.upsert",
    entityType: "static_page",
    entityId: saved.id,
    entityLabel: `/${cleanSlug}`,
    summary: `Cập nhật trang tĩnh /${cleanSlug} (${d.title_vi})`,
  });
  safeRevalidate([`/${cleanSlug}`, "/about", "/legal/privacy", "/legal/terms", "/legal/disclaimers", "/legal/refund-policy", "/legal/faqs"]);
  return { ok: true, page: saved };
}

export async function upsertFaqCms(
  rawInput: unknown,
  actor: Actor
): Promise<{ ok: true; faq: FaqItem } | { ok: false; status: number; error: string }> {
  const parsed = faqUpsertSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Dữ liệu FAQ không hợp lệ.",
    };
  }
  const d = parsed.data;
  let saved: FaqItem;

  if (!isSupabaseConfigured()) {
    saved = updateStore((store) => {
      if (d.id) {
        const existing = store.faqs.find((f) => f.id === d.id);
        if (existing) {
          existing.question_vi = d.question_vi;
          existing.question_en = d.question_en || d.question_vi;
          existing.answer_vi = d.answer_vi;
          existing.answer_en = d.answer_en || d.answer_vi;
          existing.category = d.category;
          existing.sort_order = d.sort_order;
          existing.is_published = d.is_published;
          return existing;
        }
      }
      const created: FaqItem = {
        id: `faq-${Date.now()}`,
        question_vi: d.question_vi,
        question_en: d.question_en || d.question_vi,
        answer_vi: d.answer_vi,
        answer_en: d.answer_en || d.answer_vi,
        category: d.category,
        sort_order: d.sort_order,
        is_published: d.is_published,
        created_at: new Date().toISOString(),
      };
      store.faqs.push(created);
      return created;
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const row = {
      question_vi: d.question_vi,
      question_en: d.question_en || d.question_vi,
      answer_vi: d.answer_vi,
      answer_en: d.answer_en || d.answer_vi,
      category: d.category,
      sort_order: d.sort_order,
      is_published: d.is_published,
    };
    const res =
      d.id && isValidUuid(d.id)
        ? await admin.from("faqs").update(row).eq("id", d.id).select("*").single()
        : await admin.from("faqs").insert(row).select("*").single();
    if (res.error || !res.data) {
      return { ok: false, status: 500, error: res.error?.message || "Lưu FAQ thất bại." };
    }
    saved = mapFaqRow(res.data as Record<string, unknown>);
  }

  await recordAuditLog({
    actor,
    action: d.id ? "faq.update" : "faq.create",
    entityType: "faq",
    entityId: saved.id,
    entityLabel: d.question_vi.slice(0, 80),
    summary: `${d.id ? "Cập nhật" : "Thêm"} FAQ: ${d.question_vi.slice(0, 80)}`,
  });
  safeRevalidate(["/legal/faqs", "/pricing", "/about"]);
  return { ok: true, faq: saved };
}

export async function deleteFaqCms(
  id: string,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.faqs = store.faqs.filter((f) => f.id !== id);
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const { error } = await admin.from("faqs").delete().eq("id", id);
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "faq.delete",
    entityType: "faq",
    entityId: id,
    entityLabel: `FAQ #${id.slice(0, 8)}`,
    summary: "Xóa câu hỏi thường gặp (FAQ)",
  });
  safeRevalidate(["/legal/faqs", "/pricing", "/about"]);
  return { ok: true };
}

// =============================================================================
// 5. GENERAL SITE SETTINGS (ADMIN ONLY)
// =============================================================================
export async function getAdminGeneralSettings(): Promise<SiteGeneralSettings> {
  return getSiteGeneralSettings();
}

export async function saveSiteGeneralSettingsCms(
  rawInput: unknown,
  actor: Actor
): Promise<
  | { ok: true; settings: SiteGeneralSettings }
  | { ok: false; status: number; error: string }
> {
  const parsed = siteGeneralSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Cài đặt hệ thống không hợp lệ.",
    };
  }
  const settings: SiteGeneralSettings = parsed.data;

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      store.site_settings.general = settings;
    });
  } else {
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, status: 500, error: "Supabase Admin không khả dụng." };
    const { error } = await admin.from("site_settings").upsert(
      {
        key: "general",
        value: settings,
        updated_by: isValidUuid(actor.id) ? actor.id : null,
      },
      { onConflict: "key" }
    );
    if (error) return { ok: false, status: 500, error: error.message };
  }

  await recordAuditLog({
    actor,
    action: "site_settings.general",
    entityType: "site_settings",
    entityId: "general",
    entityLabel: settings.siteName,
    summary: `Cập nhật Cài đặt chung website (${settings.siteName}, banner=${settings.announcementEnabled})`,
  });
  safeRevalidate(["/", "/about", "/contact", "/pricing", "/legal/faqs"]);
  return { ok: true, settings };
}
