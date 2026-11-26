import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_ADMIN_SIDEBAR_MENU,
  DEFAULT_APPEARANCE_CONFIG,
  DEFAULT_THEME_CONFIG,
  applyUiTextOverrides,
  buildThemeCssVariables,
  enforceSystemMenuIntegrity,
  getGoogleFontHref,
  isSafeNavHref,
  isWithinScheduleWindow,
  mergeAppearanceWithDefaults,
  resolveAdminRouteBreadcrumb,
  restoreDefaultMenuNames,
  sanitizePlainText,
  siteAppearanceSchema,
} from "@/lib/appearance-shared";

describe("GĐ2 Module Giao diện & Trang chủ — Validation & Sanitization", () => {
  it("validates DEFAULT_APPEARANCE_CONFIG cleanly", () => {
    const res = siteAppearanceSchema.safeParse(DEFAULT_APPEARANCE_CONFIG);
    expect(res.success).toBe(true);
  });

  it("enforces menu label rules (non-empty, max 40 chars) and strips HTML tags", () => {
    expect(sanitizePlainText("<b>Blog & Mẹo thi</b><script>x</script>", 40)).toBe(
      "Blog & Mẹo thix"
    );

    // Empty menu label must fail
    const emptyLabel = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    emptyLabel.menus.adminSidebar[0].labelVi = "   ";
    expect(siteAppearanceSchema.safeParse(emptyLabel).success).toBe(false);

    // > 40 chars menu label must fail
    const tooLongLabel = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    tooLongLabel.menus.adminSidebar[1].items[0].labelVi = "A".repeat(41);
    expect(siteAppearanceSchema.safeParse(tooLongLabel).success).toBe(false);

    // Exactly 40 chars must pass
    const exact40 = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    exact40.menus.adminSidebar[1].items[0].labelVi = "Đ".repeat(40);
    expect(siteAppearanceSchema.safeParse(exact40).success).toBe(true);

    // HTML tags stripped on transform
    const withHtml = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    withHtml.menus.adminSidebar[1].labelVi = "<b>Nội dung IELTS</b>";
    const parsed = siteAppearanceSchema.safeParse(withHtml);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.menus.adminSidebar[1].labelVi).toBe("Nội dung IELTS");
    }
  });

  it("rejects invalid hex colors, arbitrary scripts in GA4/GSC, and unsafe URLs", () => {
    const badColor = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    badColor.theme.primaryColor = "red;background:url(x)";
    expect(siteAppearanceSchema.safeParse(badColor).success).toBe(false);

    const badGa4 = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    badGa4.analytics.googleAnalyticsId = "<script>alert(1)</script>";
    expect(siteAppearanceSchema.safeParse(badGa4).success).toBe(false);

    const badGsc = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    badGsc.analytics.googleSiteVerification =
      '<meta name="google-site-verification" content="abc" />';
    expect(siteAppearanceSchema.safeParse(badGsc).success).toBe(false);

    const validAnalytics = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    validAnalytics.analytics.googleAnalyticsId = "G-AB12CD34EF";
    validAnalytics.analytics.googleSiteVerification = "verify_token-123.ABC";
    expect(siteAppearanceSchema.safeParse(validAnalytics).success).toBe(true);

    expect(isSafeNavHref("/tests")).toBe(true);
    expect(isSafeNavHref("https://onielts.vn")).toBe(true);
    expect(isSafeNavHref("mailto:support@onielts.vn")).toBe(true);
    expect(isSafeNavHref("javascript:alert(1)")).toBe(false);
    expect(isSafeNavHref("//evil.example/phish")).toBe(false);
    expect(isSafeNavHref("data:text/html,<h1>x</h1>")).toBe(false);

    const badHref = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    badHref.menus.publicHeader[0].href = "javascript:alert(1)";
    expect(siteAppearanceSchema.safeParse(badHref).success).toBe(false);
  });
});

describe("GĐ2 System Menu Integrity & Name Restoration", () => {
  it("locks system URLs & adminOnly flags on rename, prevents deleting system items, and keeps /admin/appearance visible", () => {
    const mutated = structuredClone(DEFAULT_APPEARANCE_CONFIG);

    // Rename "Đề thi & Nội dung" -> "Kho học liệu" and "Blog & Mẹo thi" -> "Tạp chí IELTS"
    // AND attempt to tamper with href and adminOnly
    const contentGroup = mutated.menus.adminSidebar.find((g) => g.id === "grp-content")!;
    contentGroup.labelVi = "Kho học liệu";
    contentGroup.labelEn = "Study Vault";
    const blogItem = contentGroup.items.find((i) => i.id === "adm-blog")!;
    blogItem.labelVi = "Tạp chí IELTS";
    blogItem.labelEn = "IELTS Magazine";
    blogItem.href = "/hacked-url";

    // Attempt to delete adm-tests and hide adm-appearance
    contentGroup.items = contentGroup.items.filter((i) => i.id !== "adm-tests");
    const sysGroup = mutated.menus.adminSidebar.find((g) => g.id === "grp-system")!;
    sysGroup.visible = false;
    const appearanceItem = sysGroup.items.find((i) => i.id === "adm-appearance")!;
    appearanceItem.visible = false;
    appearanceItem.adminOnly = false;

    const enforced = enforceSystemMenuIntegrity(mutated);

    // 1. Renamed labels preserved, URL locked back to /admin/blog
    const nextContentGroup = enforced.menus.adminSidebar.find(
      (g) => g.id === "grp-content"
    )!;
    expect(nextContentGroup.labelVi).toBe("Kho học liệu");
    const nextBlog = nextContentGroup.items.find((i) => i.id === "adm-blog")!;
    expect(nextBlog.labelVi).toBe("Tạp chí IELTS");
    expect(nextBlog.labelEn).toBe("IELTS Magazine");
    expect(nextBlog.href).toBe("/admin/blog");

    // 2. Deleted system item re-attached as hidden (never deleted!)
    const restoredTests = nextContentGroup.items.find((i) => i.id === "adm-tests")!;
    expect(restoredTests).toBeDefined();
    expect(restoredTests.visible).toBe(false);
    expect(restoredTests.href).toBe("/admin/tests");

    // 3. /admin/appearance always forced visible & adminOnly=true
    const nextSysGroup = enforced.menus.adminSidebar.find(
      (g) => g.id === "grp-system"
    )!;
    expect(nextSysGroup.visible).toBe(true);
    const nextAppearance = nextSysGroup.items.find(
      (i) => i.id === "adm-appearance"
    )!;
    expect(nextAppearance.visible).toBe(true);
    expect(nextAppearance.adminOnly).toBe(true);
    expect(nextAppearance.href).toBe("/admin/appearance");
  });

  it("restores default VI/EN menu names while preserving custom order, visibility, and custom groups", () => {
    const custom = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    custom.menus.adminSidebar[1].labelVi = "Nhóm Đổi Tên";
    custom.menus.adminSidebar[1].items[0].labelVi = "Mục Đổi Tên";
    custom.menus.adminSidebar[1].items[0].visible = false;
    custom.menus.adminSidebar.push({
      id: "grp-custom-1",
      labelVi: "Nhóm riêng của tôi",
      labelEn: "My Custom Group",
      visible: true,
      isSystem: false,
      items: [],
    });

    const restored = restoreDefaultMenuNames(custom);
    expect(restored.menus.adminSidebar[1].labelVi).toBe(
      DEFAULT_ADMIN_SIDEBAR_MENU[1].labelVi
    );
    expect(restored.menus.adminSidebar[1].items[0].labelVi).toBe(
      DEFAULT_ADMIN_SIDEBAR_MENU[1].items[0].labelVi
    );
    // Visibility and custom groups remain intact
    expect(restored.menus.adminSidebar[1].items[0].visible).toBe(false);
    expect(restored.menus.adminSidebar.some((g) => g.id === "grp-custom-1")).toBe(
      true
    );
  });
});

describe("GĐ2 Theme CSS Variables, UI Texts, Breadcrumb & Scheduling", () => {
  it("generates CSS variables and Google Font URLs cleanly", () => {
    expect(getGoogleFontHref("Be Vietnam Pro")).toBeNull();
    expect(getGoogleFontHref("Inter")).toContain("fonts.googleapis.com/css2?family=Inter");

    const css = buildThemeCssVariables({
      ...DEFAULT_THEME_CONFIG,
      primaryColor: "#2563eb",
      secondaryColor: "#7c3aed",
      borderRadius: "none",
      fontFamily: "Plus Jakarta Sans",
    });

    expect(css).toContain("--primary: #2563eb;");
    expect(css).toContain("--secondary: #7c3aed;");
    expect(css).toContain("--cms-radius: 0px;");
    expect(css).toContain("'Plus Jakarta Sans'");
    expect(css).toContain(".bg-emerald-600");
    expect(css).toContain(".rounded-2xl");
  });

  it("deep-merges VI/EN UI text overrides safely and blocks prototype pollution", () => {
    const base = {
      nav: { login: "Đăng nhập", tryPremium: "Dùng thử Premium" },
      home: { heroTitle: "Original" },
    };
    const mergedVi = applyUiTextOverrides(
      base,
      {
        "nav.login": { vi: "Vào học ngay", en: "Join Now" },
        "home.heroTitle": { vi: "<b>Học IELTS chuẩn AI</b>", en: "AI IELTS" },
        "__proto__.polluted": { vi: "bad", en: "bad" },
        "constructor.prototype.polluted": { vi: "bad", en: "bad" },
      },
      "vi"
    );

    expect((mergedVi.nav as Record<string, string>).login).toBe("Vào học ngay");
    expect((mergedVi.home as Record<string, string>).heroTitle).toBe(
      "Học IELTS chuẩn AI"
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // Base not mutated
    expect(base.nav.login).toBe("Đăng nhập");

    const mergedEn = applyUiTextOverrides(
      base,
      { "nav.login": { vi: "Vào học ngay", en: "Join Now" } },
      "en"
    );
    expect((mergedEn.nav as Record<string, string>).login).toBe("Join Now");
  });

  it("resolves shared Admin Sidebar + Breadcrumb + Page Title names across VI/EN", () => {
    const groups = structuredClone(DEFAULT_ADMIN_SIDEBAR_MENU);
    const content = groups.find((g) => g.id === "grp-content")!;
    content.labelVi = "Kho Học Liệu";
    content.labelEn = "Study Library";
    const blog = content.items.find((i) => i.id === "adm-blog")!;
    blog.labelVi = "Cẩm nang IELTS";
    blog.labelEn = "IELTS Guides";

    const viNew = resolveAdminRouteBreadcrumb("/admin/blog/new", groups, "vi");
    expect(viNew).toEqual({
      groupLabel: "Kho Học Liệu",
      itemLabel: "Cẩm nang IELTS",
      itemHref: "/admin/blog",
      subLabel: "Tạo mới",
    });

    const enEdit = resolveAdminRouteBreadcrumb("/admin/blog/post-42", groups, "en");
    expect(enEdit).toEqual({
      groupLabel: "Study Library",
      itemLabel: "IELTS Guides",
      itemHref: "/admin/blog",
      subLabel: "Edit",
    });
  });

  it("evaluates banner/popup start–end schedule windows accurately", () => {
    const now = Date.parse("2026-11-26T10:00:00Z");
    expect(isWithinScheduleWindow("", "", now)).toBe(true);
    expect(
      isWithinScheduleWindow("2026-11-26T09:00:00Z", "2026-11-26T12:00:00Z", now)
    ).toBe(true);
    expect(
      isWithinScheduleWindow("2026-11-26T11:00:00Z", "2026-11-26T12:00:00Z", now)
    ).toBe(false);
    expect(
      isWithinScheduleWindow("2026-11-25T00:00:00Z", "2026-11-26T09:59:59Z", now)
    ).toBe(false);
  });

  it("merges partial stored appearance with defaults without dropping new fields", () => {
    const merged = mergeAppearanceWithDefaults({
      branding: {
        siteName: "IELTS Studio",
        taglineVi: "Học chất",
        taglineEn: "Learn smart",
        logoLightUrl: "",
        logoDarkUrl: "",
        faviconUrl: "",
      },
    });
    expect(merged.branding.siteName).toBe("IELTS Studio");
    expect(merged.homepage.sections.length).toBe(12);
    expect(merged.menus.adminSidebar.length).toBeGreaterThanOrEqual(4);
  });
});

describe("GĐ2 Security, RBAC, Maintenance & Live Wiring Verification", () => {
  const root = process.cwd();

  it("guards /api/admin/appearance and /api/admin/appearance/preview with Admin-only + CSRF", () => {
    const apiMain = fs.readFileSync(
      path.join(root, "src/app/api/admin/appearance/route.ts"),
      "utf8"
    );
    expect(apiMain).toContain('requireStaff("admin")');
    expect(apiMain).toContain("verifySameOrigin(req)");

    const apiPreview = fs.readFileSync(
      path.join(root, "src/app/api/admin/appearance/preview/route.ts"),
      "utf8"
    );
    expect(apiPreview).toContain('requireStaff("admin")');
    expect(apiPreview).toContain("verifySameOrigin(req)");

    const adminPage = fs.readFileSync(
      path.join(root, "src/app/admin/appearance/page.tsx"),
      "utf8"
    );
    expect(adminPage).toContain('authState.user?.role !== "admin"');
  });

  it("keeps /admin and /auth and signed-in Admins accessible during Maintenance Mode", () => {
    const widgetsSrc = fs.readFileSync(
      path.join(root, "src/components/site-widgets.tsx"),
      "utf8"
    );
    expect(widgetsSrc).toContain('pathname.startsWith("/admin/")');
    expect(widgetsSrc).toContain('pathname.startsWith("/auth/")');
    expect(widgetsSrc).toContain(
      "if (widgets.maintenance.enabled && !isAdmin && !isAdminOrAuthRoute)"
    );
  });

  it("wires dynamic homepage sections, theme CSS vars, and GA4/GSC allowlist in layout & homepage", () => {
    const layoutSrc = fs.readFileSync(
      path.join(root, "src/app/layout.tsx"),
      "utf8"
    );
    expect(layoutSrc).toContain("buildThemeCssVariables");
    expect(layoutSrc).toContain("GA4_ID_REGEX");
    expect(layoutSrc).toContain("GSC_TOKEN_REGEX");
    expect(layoutSrc).toContain("<SiteWidgets");

    const homeSrc = fs.readFileSync(
      path.join(root, "src/app/page.tsx"),
      "utf8"
    );
    expect(homeSrc).toContain("appearance.homepage.sections.filter((s) => s.enabled)");
    expect(homeSrc).toContain('case "testimonials"');
  });
});
