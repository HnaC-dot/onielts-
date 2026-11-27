import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_ADMIN_SIDEBAR_MENU,
  DEFAULT_APPEARANCE_CONFIG,
  DEFAULT_THEME_CONFIG,
  PROTECTED_ADMIN_MENU_ITEM_ID,
  applyUiTextOverrides,
  buildThemeCssVariables,
  enforceSystemMenuIntegrity,
  getGoogleFontHref,
  isSafeNavHref,
  isWithinScheduleWindow,
  mergeAppearanceWithDefaults,
  resolveAdminRouteBreadcrumb,
  restoreDefaultAdminGroupItems,
  restoreDefaultFooterColumnLinks,
  restoreDefaultHeaderSubItems,
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

  it("rejects invalid hex colors, arbitrary scripts in GA4/GSC, and dangerous URLs (javascript:, data:, http:, //evil)", () => {
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

    // Valid safe navigation hrefs
    expect(isSafeNavHref("/tests")).toBe(true);
    expect(isSafeNavHref("/admin/blog?status=draft")).toBe(true);
    expect(isSafeNavHref("https://onielts.vn")).toBe(true);
    expect(isSafeNavHref("mailto:support@onielts.vn")).toBe(true);

    // Dangerous / malformed hrefs rejected
    expect(isSafeNavHref("javascript:alert(1)")).toBe(false);
    expect(isSafeNavHref("JAVASCRIPT:alert(1)")).toBe(false);
    expect(isSafeNavHref("data:text/html,<h1>x</h1>")).toBe(false);
    expect(isSafeNavHref("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeNavHref("http://insecure.example/page")).toBe(false);
    expect(isSafeNavHref("//evil.example/phish")).toBe(false);
    expect(isSafeNavHref("/\\evil.example")).toBe(false);
    expect(isSafeNavHref("https://")).toBe(false);

    // Schema rejects dangerous URLs on system items across Admin, Header & Footer
    const badHeaderHref = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    badHeaderHref.menus.publicHeader[0].href = "javascript:alert(1)";
    expect(siteAppearanceSchema.safeParse(badHeaderHref).success).toBe(false);

    const badAdminHref = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    badAdminHref.menus.adminSidebar[1].items[0].href = "data:text/html,<script>1</script>";
    expect(siteAppearanceSchema.safeParse(badAdminHref).success).toBe(false);

    const badFooterHref = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    badFooterHref.menus.publicFooter[0].links[0].href = "javascript:void(0)";
    expect(siteAppearanceSchema.safeParse(badFooterHref).success).toBe(false);
  });
});

describe("GĐ2 Unlocked Menu Management, Self-Lockout Guard & Restore", () => {
  it("allows deleting system items/groups in Admin, Header & Footer without re-attaching them on normalize or merge", () => {
    const mutated = structuredClone(DEFAULT_APPEARANCE_CONFIG);

    // 1. Delete an entire system group (grp-learning) and a system item (adm-tests) from Sidebar Admin
    mutated.menus.adminSidebar = mutated.menus.adminSidebar.filter(
      (g) => g.id !== "grp-learning"
    );
    const contentGroup = mutated.menus.adminSidebar.find((g) => g.id === "grp-content")!;
    contentGroup.items = contentGroup.items.filter((i) => i.id !== "adm-tests");

    // 2. Delete a system main item & a system sub-item from Header Public
    mutated.menus.publicHeader = mutated.menus.publicHeader.filter(
      (m) => m.id !== "hdr-courses"
    );
    const ieltsMenu = mutated.menus.publicHeader.find((m) => m.id === "hdr-ielts")!;
    ieltsMenu.children = (ieltsMenu.children ?? []).filter((c) => c.id !== "hdr-ielts-lb");

    // 3. Delete a system column and a system link from Footer Public
    mutated.menus.publicFooter = mutated.menus.publicFooter.filter(
      (c) => c.id !== "fcol-legal"
    );
    const resCol = mutated.menus.publicFooter.find((c) => c.id === "fcol-resources")!;
    resCol.links = resCol.links.filter((l) => l.id !== "fl-daily");

    expect(siteAppearanceSchema.safeParse(mutated).success).toBe(true);

    const normalized = enforceSystemMenuIntegrity(mutated);
    const merged = mergeAppearanceWithDefaults(normalized);

    for (const result of [normalized, merged]) {
      // Deleted admin group & item MUST stay deleted (never re-attached!)
      expect(result.menus.adminSidebar.some((g) => g.id === "grp-learning")).toBe(false);
      expect(
        result.menus.adminSidebar.some((g) =>
          g.items.some((i) => i.id === "adm-tests")
        )
      ).toBe(false);

      // Deleted header main & sub-item MUST stay deleted
      expect(result.menus.publicHeader.some((m) => m.id === "hdr-courses")).toBe(false);
      const nextIelts = result.menus.publicHeader.find((m) => m.id === "hdr-ielts")!;
      expect(
        (nextIelts.children ?? []).some((c) => c.id === "hdr-ielts-lb")
      ).toBe(false);

      // Deleted footer column & link MUST stay deleted
      expect(result.menus.publicFooter.some((c) => c.id === "fcol-legal")).toBe(false);
      const nextRes = result.menus.publicFooter.find((c) => c.id === "fcol-resources")!;
      expect(nextRes.links.some((l) => l.id === "fl-daily")).toBe(false);
    }

    // Even emptying all Header items & Footer columns is valid and preserved
    const emptyPublic = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    emptyPublic.menus.publicHeader = [];
    emptyPublic.menus.publicFooter = [];
    expect(siteAppearanceSchema.safeParse(emptyPublic).success).toBe(true);
    const mergedEmpty = mergeAppearanceWithDefaults(emptyPublic);
    expect(mergedEmpty.menus.publicHeader).toEqual([]);
    expect(mergedEmpty.menus.publicFooter).toEqual([]);
  });

  it("allows editing URL & icon of system items while keeping adminOnly locked on sensitive Admin items", () => {
    const mutated = structuredClone(DEFAULT_APPEARANCE_CONFIG);

    // Edit URL & icon of system items across Admin, Header & Footer
    const contentGroup = mutated.menus.adminSidebar.find((g) => g.id === "grp-content")!;
    const blogItem = contentGroup.items.find((i) => i.id === "adm-blog")!;
    blogItem.labelVi = "Tạp chí IELTS";
    blogItem.labelEn = "IELTS Magazine";
    blogItem.href = "/admin/blog?status=published";
    blogItem.icon = "Sparkles";

    // Attempt to strip adminOnly from adm-users and adm-seo
    const sysGroup = mutated.menus.adminSidebar.find((g) => g.id === "grp-system")!;
    const usersItem = sysGroup.items.find((i) => i.id === "adm-users")!;
    usersItem.adminOnly = false;
    const seoItem = sysGroup.items.find((i) => i.id === "adm-seo")!;
    seoItem.adminOnly = false;

    // Edit Header & Footer system URLs to valid internal or https URLs
    mutated.menus.publicHeader[0].href = "/tests?module=academic";
    mutated.menus.publicHeader[0].icon = "Trophy";
    mutated.menus.publicFooter[0].links[0].href = "https://onielts.vn/tests";

    const parsed = siteAppearanceSchema.safeParse(mutated);
    expect(parsed.success).toBe(true);

    const enforced = enforceSystemMenuIntegrity(mutated);

    const nextBlog = enforced.menus.adminSidebar
      .find((g) => g.id === "grp-content")!
      .items.find((i) => i.id === "adm-blog")!;
    expect(nextBlog.labelVi).toBe("Tạp chí IELTS");
    expect(nextBlog.href).toBe("/admin/blog?status=published");
    expect(nextBlog.icon).toBe("Sparkles");

    // Header & Footer URL/icon edits persisted
    expect(enforced.menus.publicHeader[0].href).toBe("/tests?module=academic");
    expect(enforced.menus.publicHeader[0].icon).toBe("Trophy");
    expect(enforced.menus.publicFooter[0].links[0].href).toBe("https://onielts.vn/tests");

    // adminOnly MUST remain locked true on sensitive admin items
    const nextSys = enforced.menus.adminSidebar.find((g) => g.id === "grp-system")!;
    expect(nextSys.items.find((i) => i.id === "adm-users")!.adminOnly).toBe(true);
    expect(nextSys.items.find((i) => i.id === "adm-seo")!.adminOnly).toBe(true);
  });

  it("NEVER allows deleting or hiding adm-appearance (or its group), even if stripped from payload", () => {
    // Case A: payload attempts to hide adm-appearance and its group
    const hiddenAttempt = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    const sysGroup = hiddenAttempt.menus.adminSidebar.find((g) => g.id === "grp-system")!;
    sysGroup.visible = false;
    const appItem = sysGroup.items.find((i) => i.id === PROTECTED_ADMIN_MENU_ITEM_ID)!;
    appItem.visible = false;
    appItem.adminOnly = false;
    appItem.href = "/blog";

    const afterHidden = enforceSystemMenuIntegrity(hiddenAttempt);
    const nextSys = afterHidden.menus.adminSidebar.find((g) => g.id === "grp-system")!;
    const nextApp = nextSys.items.find((i) => i.id === PROTECTED_ADMIN_MENU_ITEM_ID)!;
    expect(nextSys.visible).toBe(true);
    expect(nextApp.visible).toBe(true);
    expect(nextApp.adminOnly).toBe(true);
    expect(nextApp.href).toBe("/admin/appearance");

    // Case B: payload deletes the entire grp-system group (containing adm-appearance & adm-users)
    const deletedAttempt = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    deletedAttempt.menus.adminSidebar = deletedAttempt.menus.adminSidebar.filter(
      (g) => g.id !== "grp-system"
    );

    const afterDeleted = enforceSystemMenuIntegrity(deletedAttempt);
    const restoredGroup = afterDeleted.menus.adminSidebar.find(
      (g) => g.items.some((i) => i.id === PROTECTED_ADMIN_MENU_ITEM_ID)
    )!;
    expect(restoredGroup).toBeDefined();
    expect(restoredGroup.visible).toBe(true);
    // ONLY adm-appearance is restored — other deleted items in grp-system (like adm-users) are NOT re-attached!
    expect(restoredGroup.items.map((i) => i.id)).toEqual([PROTECTED_ADMIN_MENU_ITEM_ID]);
    expect(restoredGroup.items[0].visible).toBe(true);
    expect(restoredGroup.items[0].adminOnly).toBe(true);
  });

  it("supports per-group default item restoration without deleting custom items or creating duplicates", () => {
    const custom = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    // Delete adm-tests and adm-blog from grp-content, add a custom item
    const grp = custom.menus.adminSidebar.find((g) => g.id === "grp-content")!;
    grp.items = [
      {
        id: "adm-custom-1",
        labelVi: "Liên kết riêng",
        labelEn: "Custom Link",
        href: "/admin/tests",
        icon: "Link2",
        visible: true,
        isSystem: false,
      },
    ];

    const restoredAdmin = restoreDefaultAdminGroupItems(
      custom.menus.adminSidebar,
      "grp-content"
    );
    const restoredGrp = restoredAdmin.find((g) => g.id === "grp-content")!;
    expect(restoredGrp.items.some((i) => i.id === "adm-custom-1")).toBe(true);
    expect(restoredGrp.items.some((i) => i.id === "adm-tests")).toBe(true);
    expect(restoredGrp.items.some((i) => i.id === "adm-blog")).toBe(true);

    // Header sub-items per-group restore
    const hdr = structuredClone(custom.menus.publicHeader);
    const ielts = hdr.find((m) => m.id === "hdr-ielts")!;
    ielts.children = [];
    const restoredHdr = restoreDefaultHeaderSubItems(hdr, "hdr-ielts");
    expect(
      restoredHdr.find((m) => m.id === "hdr-ielts")!.children!.length
    ).toBeGreaterThanOrEqual(5);

    // Footer column per-group restore
    const ft = structuredClone(custom.menus.publicFooter);
    ft[0].links = [];
    const restoredFt = restoreDefaultFooterColumnLinks(ft, ft[0].id);
    expect(restoredFt[0].links.length).toBeGreaterThanOrEqual(4);
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
