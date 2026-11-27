import "server-only";
import { NextResponse } from "next/server";
import { getAuthState } from "./auth";
import {
  createSupabaseAdminClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "./supabase/server";
import {
  getBlogPosts,
  getCourses,
  getDailyExamState,
  getDictationLessons,
  getFeatureRequests,
  getIeltsTestSummaries,
  getLearnVideos,
  getPronunciationSounds,
  listAiUsageLogs,
  listAllProfiles,
  listOrders,
} from "./db";
import { getVietnamDateString } from "./utils";
import type { AdminAuditLog, SessionUser, UserRole } from "./types";

const localDevAuditLogs: AdminAuditLog[] = [];

export function isStaffRole(
  role: string | null | undefined
): role is "admin" | "editor" {
  return role === "admin" || role === "editor";
}

export function maskEmailAddress(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return "***";
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * CSRF protection for mutating API requests (POST / PATCH / DELETE).
 * - Rejects explicit cross-site browser requests (Sec-Fetch-Site: cross-site).
 * - Rejects cookie-bearing requests with stripped Origin and Referer unless
 *   Sec-Fetch-Site explicitly certifies same-origin.
 * - Validates Origin (or Referer fallback) host against request Host and configured site URLs.
 */
export function verifySameOrigin(req: Request): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (secFetchSite === "cross-site") {
    return false;
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const hasCookie = Boolean(req.headers.get("cookie")?.trim());

  if (!origin && !referer) {
    if (hasCookie && secFetchSite !== "same-origin") {
      return false;
    }
    // Non-cookie server-to-server calls without Origin/Referer
    return true;
  }

  const allowedHosts = new Set<string>();
  if (host) allowedHosts.add(host.toLowerCase());
  for (const envUrl of [
    process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
  ]) {
    if (!envUrl) continue;
    try {
      allowedHosts.add(new URL(envUrl).host.toLowerCase());
    } catch {
      // ignore invalid URL
    }
  }

  const candidate = origin || referer || "";
  try {
    const parsedHost = new URL(candidate).host.toLowerCase();
    return allowedHosts.size === 0 || allowedHosts.has(parsedHost);
  } catch {
    return false;
  }
}

export async function requireStaff(
  minRole: "editor" | "admin" = "editor"
): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const authState = await getAuthState();

  if (authState.status === "profile_error") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Đã xác thực nhưng không thể tải hồ sơ quản trị từ cơ sở dữ liệu." },
        { status: 503 }
      ),
    };
  }

  if (!authState.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Vui lòng đăng nhập bằng tài khoản Admin hoặc Editor." },
        { status: 401 }
      ),
    };
  }

  if (authState.user.is_locked) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Tài khoản quản trị này đang bị khóa." },
        { status: 403 }
      ),
    };
  }

  if (!isStaffRole(authState.user.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Chỉ Admin hoặc Editor mới có quyền truy cập khu vực quản trị." },
        { status: 403 }
      ),
    };
  }

  if (minRole === "admin" && authState.user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Tài khoản Editor không có quyền thực hiện thao tác quản trị hệ thống hoặc quản lý người dùng. Yêu cầu quyền Admin.",
        },
        { status: 403 }
      ),
    };
  }

  if (isSupabaseConfigured() && !isServiceRoleConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Máy chủ thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY cho thao tác quản trị.",
        },
        { status: 503 }
      ),
    };
  }

  return { ok: true, user: authState.user };
}

export async function recordAuditLog(params: {
  actor: Pick<SessionUser, "id" | "email" | "role">;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const entry: AdminAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actor_id: params.actor.id,
    actor_email: params.actor.email,
    actor_role: params.actor.role,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    entity_label: params.entityLabel,
    summary: params.summary,
    metadata: params.metadata ?? {},
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    localDevAuditLogs.unshift(entry);
    if (localDevAuditLogs.length > 500) {
      localDevAuditLogs.length = 500;
    }
    return;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return;

  try {
    const { error } = await admin.from("admin_audit_logs").insert({
      actor_id: params.actor.id,
      actor_email: params.actor.email,
      actor_role: params.actor.role,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      entity_label: params.entityLabel,
      summary: params.summary,
      metadata: params.metadata ?? {},
    });
    if (error) {
      console.warn("[admin.audit] insert skipped", {
        code: error.code ?? null,
        message: error.message,
      });
    }
  } catch (err) {
    console.warn("[admin.audit] unexpected error", {
      message: err instanceof Error ? err.message : "unknown_error",
    });
  }
}

export async function listAuditLogs(options?: {
  search?: string;
  entityType?: string;
  actorRole?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: AdminAuditLog[];
  total: number;
  page: number;
  pageSize: number;
  tableReady: boolean;
}> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, options?.pageSize ?? 20));
  const search = options?.search?.trim().toLowerCase() ?? "";
  const entityType = options?.entityType?.trim() ?? "";
  const actorRole = options?.actorRole?.trim() ?? "";

  if (!isSupabaseConfigured()) {
    const filtered = localDevAuditLogs.filter((row) => {
      if (entityType && row.entity_type !== entityType) return false;
      if (actorRole && row.actor_role !== actorRole) return false;
      if (search) {
        const hay = `${row.actor_email} ${row.action} ${row.entity_type} ${row.entity_label} ${row.summary}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      tableReady: true,
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { items: [], total: 0, page, pageSize, tableReady: false };
  }

  let query = admin
    .from("admin_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (entityType) {
    query = query.eq("entity_type", entityType);
  }
  if (actorRole) {
    query = query.eq("actor_role", actorRole);
  }
  if (search) {
    const clean = search.replace(/[%_,()]/g, "");
    if (clean) {
      query = query.or(
        `actor_email.ilike.%${clean}%,entity_label.ilike.%${clean}%,summary.ilike.%${clean}%,action.ilike.%${clean}%`
      );
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.warn("[admin.audit] select failed (migration 0005 may not be applied yet)", {
      code: error.code ?? null,
      message: error.message,
    });
    return { items: [], total: 0, page, pageSize, tableReady: false };
  }

  const items: AdminAuditLog[] = (data ?? []).map((r) => ({
    id: String(r.id),
    actor_id: r.actor_id ? String(r.actor_id) : null,
    actor_email: String(r.actor_email ?? ""),
    actor_role: String(r.actor_role ?? "admin") as UserRole,
    action: String(r.action),
    entity_type: String(r.entity_type),
    entity_id: r.entity_id ? String(r.entity_id) : null,
    entity_label: String(r.entity_label ?? ""),
    summary: String(r.summary ?? ""),
    metadata:
      r.metadata && typeof r.metadata === "object"
        ? (r.metadata as Record<string, unknown>)
        : {},
    created_at: String(r.created_at),
  }));

  return {
    items,
    total: count ?? items.length,
    page,
    pageSize,
    tableReady: true,
  };
}

export async function getAdminDashboardSummary(options?: {
  includeAdminData?: boolean;
}) {
  const includeAdminData = options?.includeAdminData !== false;
  const vnToday = getVietnamDateString();
  const [
    tests,
    courses,
    blogPosts,
    videos,
    dictations,
    ipaSounds,
    profiles,
    orders,
    aiLogs,
    featureRequests,
    dailyState,
    auditResult,
  ] = await Promise.all([
    getIeltsTestSummaries(true),
    getCourses(),
    getBlogPosts(true),
    getLearnVideos(),
    getDictationLessons(),
    getPronunciationSounds(),
    includeAdminData ? listAllProfiles() : Promise.resolve([]),
    includeAdminData ? listOrders() : Promise.resolve([]),
    includeAdminData ? listAiUsageLogs(200) : Promise.resolve([]),
    getFeatureRequests(),
    getDailyExamState(vnToday, null),
    includeAdminData
      ? listAuditLogs({ page: 1, pageSize: 8 })
      : Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 8,
          tableReady: true,
        }),
  ]);

  let unreadContacts = 0;
  let mediaCount = 0;
  if (isSupabaseConfigured()) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const [contactRes, mediaRes] = await Promise.all([
        admin
          .from("contact_messages")
          .select("id", { count: "exact", head: true }),
        admin.from("media_assets").select("id", { count: "exact", head: true }),
      ]);
      unreadContacts = contactRes.count ?? 0;
      mediaCount = mediaRes.count ?? 0;
    }
  }

  const paidOrders = orders.filter((o) => o.status === "paid");
  const totalRevenueVnd = paidOrders.reduce((sum, o) => sum + o.amount_vnd, 0);
  const now = Date.now();
  const premiumUsers = profiles.filter(
    (p) =>
      p.role === "admin" ||
      (p.premium_expires_at && new Date(p.premium_expires_at).getTime() > now)
  ).length;
  const staffCount = profiles.filter((p) => isStaffRole(p.role)).length;
  const totalAiCostUsd = aiLogs.reduce((sum, l) => sum + l.estimated_cost_usd, 0);
  const totalAiTokens = aiLogs.reduce((sum, l) => sum + l.total_tokens, 0);
  const openFeatureRequests = featureRequests.filter(
    (f) => f.status === "open" || f.status === "planned"
  ).length;

  const testsBySkill = {
    reading: tests.filter((t) => t.skill === "reading").length,
    listening: tests.filter((t) => t.skill === "listening").length,
    writing: tests.filter((t) => t.skill === "writing").length,
    speaking: tests.filter((t) => t.skill === "speaking").length,
  };

  return {
    vnToday,
    hasDailyExamToday: Boolean(dailyState.dailyTest),
    dailyExamTitle: dailyState.dailyTest?.title_vi ?? null,
    dailySubmissionsToday: dailyState.leaderboard.length,
    counts: {
      tests: tests.length,
      publishedTests: tests.filter((t) => t.is_published).length,
      testsBySkill,
      courses: courses.length,
      blogPosts: blogPosts.length,
      publishedBlogPosts: blogPosts.filter((p) => p.is_published).length,
      videos: videos.length,
      dictations: dictations.length,
      ipaSounds: ipaSounds.length,
      mediaAssets: mediaCount,
      users: profiles.length,
      premiumUsers,
      staffCount,
      paidOrders: paidOrders.length,
      totalRevenueVnd,
      aiCalls: aiLogs.length,
      totalAiTokens,
      totalAiCostUsd,
      unreadContacts,
      openFeatureRequests,
    },
    recentAuditLogs: auditResult.items,
    auditTableReady: auditResult.tableReady,
  };
}
