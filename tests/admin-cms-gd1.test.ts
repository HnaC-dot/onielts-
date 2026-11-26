import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isStaffRole, verifySameOrigin } from "@/lib/admin-auth";

describe("Admin CMS GĐ1 — RBAC, CSRF, Proxy Guard & Migration 0005", () => {
  it("recognizes admin and editor as staff roles and rejects learner/null", () => {
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("editor")).toBe(true);
    expect(isStaffRole("learner")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
    expect(isStaffRole("superadmin")).toBe(false);
  });

  it("enforces same-origin CSRF checks on mutating admin API requests", () => {
    const sameOriginReq = new Request("https://onielts.vn/api/admin", {
      method: "POST",
      headers: {
        host: "onielts.vn",
        origin: "https://onielts.vn",
      },
    });
    expect(verifySameOrigin(sameOriginReq)).toBe(true);

    const crossOriginReq = new Request("https://onielts.vn/api/admin", {
      method: "POST",
      headers: {
        host: "onielts.vn",
        origin: "https://evil-phishing.example",
      },
    });
    expect(verifySameOrigin(crossOriginReq)).toBe(false);

    const crossRefererReq = new Request("https://onielts.vn/api/admin", {
      method: "POST",
      headers: {
        host: "onielts.vn",
        referer: "https://attacker.example/csrf.html",
      },
    });
    expect(verifySameOrigin(crossRefererReq)).toBe(false);

    const serverToServerReq = new Request("https://onielts.vn/api/admin", {
      method: "POST",
      headers: {
        host: "onielts.vn",
      },
    });
    expect(verifySameOrigin(serverToServerReq)).toBe(true);
  });

  it("protects /admin/* and /api/admin/* at the Next.js 16 proxy layer", () => {
    const proxySrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/supabase/proxy.ts"),
      "utf-8"
    );
    expect(proxySrc).toContain('pathname === "/admin" || pathname.startsWith("/admin/")');
    expect(proxySrc).toContain('pathname === "/api/admin" || pathname.startsWith("/api/admin/")');
    expect(proxySrc).toContain('profile.role !== "admin" && profile.role !== "editor"');
    expect(proxySrc).toContain("profile.is_locked === true");
  });

  it("enforces admin-only actions and audit logging in /api/admin", () => {
    const apiSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/admin/route.ts"),
      "utf-8"
    );
    expect(apiSrc).toContain("verifySameOrigin");
    expect(apiSrc).toContain("requireStaff");
    expect(apiSrc).toContain("recordAuditLog");
    expect(apiSrc).toContain("ADMIN_ONLY_ACTIONS");
    expect(apiSrc).toContain("update_user_admin");
  });

  it("applies login rate limiting in /api/auth/session", () => {
    const sessionRoute = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/auth/session/route.ts"),
      "utf-8"
    );
    expect(sessionRoute).toContain("checkRateLimit");
    expect(sessionRoute).toContain("status: 429");
  });

  it("seeds initial admin strictly from ADMIN_SEED_EMAIL env without hardcoded credentials", () => {
    const seedSrc = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/seed-admin.ts"),
      "utf-8"
    );
    expect(seedSrc).toContain("ADMIN_SEED_EMAIL");
    expect(seedSrc).not.toContain("@gmail.com");
    expect(seedSrc).not.toMatch(/password\s*[:=]/i);
  });

  it("enables RLS, policies, and grants on every new table in 0005_admin_cms_schema.sql", () => {
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/0005_admin_cms_schema.sql"),
      "utf-8"
    );
    const newTables = [
      "admin_audit_logs",
      "media_assets",
      "conversation_topics",
      "writing_exercises",
      "static_pages",
      "faqs",
      "site_settings",
      "seo_redirects",
    ];
    for (const table of newTables) {
      expect(sql, `missing table ${table}`).toContain(`public.${table}`);
      expect(sql, `missing RLS on ${table}`).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`
      );
    }
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.is_staff()");
    expect(sql).toContain("AND COALESCE(is_locked, FALSE) = FALSE");
    expect(sql).toContain("'cms-media'");
  });
});
