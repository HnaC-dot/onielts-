import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { SupabaseClient, User as SupabaseAuthUser } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
  })),
}));

import { config as proxyConfig } from "@/proxy";
import { ensureProfileForAuthUser } from "@/lib/auth";
import { GET as getAuthHealth } from "@/app/api/health/auth/route";
import type { UserProfile } from "@/lib/types";

function makeAuthUser(overrides?: Partial<SupabaseAuthUser>): SupabaseAuthUser {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    email: "learner@example.com",
    app_metadata: {},
    user_metadata: { full_name: "Test Learner" },
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as SupabaseAuthUser;
}

function makeProfileRow(overrides?: Partial<UserProfile>): UserProfile {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    email: "learner@example.com",
    full_name: "Test Learner",
    avatar_url: null,
    role: "learner",
    target_band: 6.5,
    current_band: null,
    locale: "vi",
    premium_expires_at: null,
    referral_code: "LEARNE1111",
    referred_by: null,
    email_verified: true,
    streak_count: 1,
    last_active_date: "2026-11-26",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

interface QueryResult {
  data: UserProfile | null;
  error: { code?: string; details?: string | null; hint?: string | null; message: string } | null;
}

function createMockSupabase(handlers: {
  onSelect: () => QueryResult;
  onInsert?: (payload: Record<string, unknown>) => QueryResult;
}): { client: SupabaseClient; insertedPayloads: Record<string, unknown>[] } {
  const insertedPayloads: Record<string, unknown>[] = [];
  const client = {
    from: (table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => handlers.onSelect(),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          insertedPayloads.push(payload);
          return {
            select: () => ({
              maybeSingle: async () =>
                handlers.onInsert
                  ? handlers.onInsert(payload)
                  : { data: null, error: { code: "500", message: "No insert mock" } },
            }),
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, insertedPayloads };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Phase 1 — Next.js 16 Proxy Matcher", () => {
  const pattern = proxyConfig.matcher[0];
  const regex = new RegExp(`^${pattern}$`);

  it("excludes static assets, images, favicon, and /api/webhooks/*", () => {
    const excluded = [
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/logo.png",
      "/banner.webp",
      "/icon.svg",
      "/photo.jpg",
      "/audio/listening/l1-part1.mp3",
      "/api/webhooks/payos",
      "/api/webhooks",
    ];
    for (const pathname of excluded) {
      expect(regex.test(pathname), `Expected excluded: ${pathname}`).toBe(false);
    }
  });

  it("matches app pages, auth callback, and non-webhook API routes", () => {
    const included = [
      "/",
      "/profile",
      "/admin",
      "/auth",
      "/auth/callback",
      "/tests",
      "/api/health/auth",
      "/api/auth/session",
      "/api/admin",
    ];
    for (const pathname of included) {
      expect(regex.test(pathname), `Expected matched: ${pathname}`).toBe(true);
    }
  });
});

describe("Phase 1 — ensureProfileForAuthUser resilience & safety", () => {
  it("returns existing profile directly on select hit", async () => {
    const row = makeProfileRow({ role: "admin" });
    const { client } = createMockSupabase({
      onSelect: () => ({ data: row, error: null }),
    });

    const state = await ensureProfileForAuthUser(client, makeAuthUser(), {
      adminClient: null,
      refCode: null,
    });

    expect(state.status).toBe("authenticated");
    expect(state.user?.id).toBe(row.id);
    expect(state.user?.role).toBe("admin");
    expect(state.user?.isPremium).toBe(true);
  });

  it("inserts with safe defaults (role='learner', premium null) when select returns no row", async () => {
    const { client, insertedPayloads } = createMockSupabase({
      onSelect: () => ({ data: null, error: null }),
      onInsert: (payload) => ({
        data: makeProfileRow({
          role: payload.role as "learner",
          premium_expires_at: payload.premium_expires_at as null,
        }),
        error: null,
      }),
    });

    const state = await ensureProfileForAuthUser(client, makeAuthUser(), {
      adminClient: null,
      refCode: null,
    });

    expect(state.status).toBe("authenticated");
    expect(insertedPayloads).toHaveLength(1);
    expect(insertedPayloads[0].role).toBe("learner");
    expect(insertedPayloads[0].premium_expires_at).toBeNull();
  });

  it("re-selects existing profile when insert hits unique conflict (23505)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let selectCalls = 0;
    const { client } = createMockSupabase({
      onSelect: () => {
        selectCalls += 1;
        return selectCalls === 1
          ? { data: null, error: null }
          : { data: makeProfileRow(), error: null };
      },
      onInsert: () => ({
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      }),
    });

    const state = await ensureProfileForAuthUser(client, makeAuthUser(), {
      adminClient: null,
      refCode: null,
    });

    expect(state.status).toBe("authenticated");
    expect(selectCalls).toBe(2);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("falls back to service-role provisioning with safe defaults when RLS blocks insert", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client: userClient } = createMockSupabase({
      onSelect: () => ({ data: null, error: null }),
      onInsert: () => ({
        data: null,
        error: {
          code: "42501",
          message: "new row violates row-level security policy for table profiles",
        },
      }),
    });

    const { client: adminClient, insertedPayloads: adminInserts } =
      createMockSupabase({
        onSelect: () => ({ data: null, error: null }),
        onInsert: (payload) => ({
          data: makeProfileRow({
            role: payload.role as "learner",
            premium_expires_at: payload.premium_expires_at as null,
          }),
          error: null,
        }),
      });

    const state = await ensureProfileForAuthUser(userClient, makeAuthUser(), {
      adminClient,
      refCode: null,
    });

    expect(state.status).toBe("authenticated");
    expect(state.user?.role).toBe("learner");
    expect(state.user?.isPremium).toBe(false);
    expect(adminInserts).toHaveLength(1);
    expect(adminInserts[0].role).toBe("learner");
    expect(adminInserts[0].premium_expires_at).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns status='profile_error' (not unauthenticated) when RLS blocks and no service-role client exists", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client: userClient } = createMockSupabase({
      onSelect: () => ({
        data: null,
        error: { code: "42501", message: "permission denied for table profiles" },
      }),
    });

    const state = await ensureProfileForAuthUser(userClient, makeAuthUser(), {
      adminClient: null,
      refCode: null,
    });

    expect(state.status).toBe("profile_error");
    expect(state.user).toBeNull();
    expect(state.authUserId).toBe("11111111-2222-4333-8444-555555555555");
    expect(state.errorCode).toBe("42501");
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("Phase 1 — Auth routes, health contract & admin denial UX", () => {
  it("uses ${window.location.origin}/auth/callback?next=/ in /auth page", () => {
    const authPage = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/auth/page.tsx"),
      "utf-8"
    );
    expect(authPage).toContain("${window.location.origin}/auth/callback?next=/");
  });

  it("shares getAuthState across RootLayout, /profile, /admin layout & page, and /api/health/auth", () => {
    for (const rel of [
      "src/app/layout.tsx",
      "src/app/profile/page.tsx",
      "src/app/admin/layout.tsx",
      "src/app/admin/page.tsx",
      "src/app/api/health/auth/route.ts",
    ]) {
      const content = fs.readFileSync(path.resolve(process.cwd(), rel), "utf-8");
      expect(content, `${rel} should use getAuthState`).toContain("getAuthState");
    }
  });

  it("includes exact SQL grant note and all denial reasons on /admin layout", () => {
    const adminLayout = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/admin/layout.tsx"),
      "utf-8"
    );
    expect(adminLayout).toContain(
      "update public.profiles set role='admin' where id='<auth user uuid>';"
    );
    expect(adminLayout).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(adminLayout).toContain("isStaffRole(user.role)");
    expect(adminLayout).toContain("user.is_locked");
  });

  it("exposes strictly booleans + role on GET /api/health/auth with no secrets or emails", async () => {
    const res = await getAuthHealth();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual([
      "appUrlSet",
      "authenticated",
      "profileRowFound",
      "role",
      "serviceRoleKeyPresent",
      "supabaseConfigured",
    ]);
    expect(typeof body.supabaseConfigured).toBe("boolean");
    expect(typeof body.serviceRoleKeyPresent).toBe("boolean");
    expect(typeof body.appUrlSet).toBe("boolean");
    expect(typeof body.authenticated).toBe("boolean");
    expect(typeof body.profileRowFound).toBe("boolean");
    expect(
      body.role === null ||
        body.role === "learner" ||
        body.role === "editor" ||
        body.role === "admin"
    ).toBe(true);
  });
});
