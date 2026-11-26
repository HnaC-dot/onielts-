import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SITE_SEO_SETTINGS,
  PROTECTED_ROBOTS_DISALLOW,
  buildRobotsConfig,
  formatRobotsPreviewText,
  isReservedRedirectSource,
  isSafeInternalRedirectTarget,
  isValidGa4Id,
  matchSeoRedirect,
  normalizeRedirectDestination,
  normalizeRedirectPath,
  seoRedirectUpsertSchema,
  siteSeoSettingsSchema,
} from "@/lib/seo-cms-shared";

describe("GĐ6 Site-wide SEO & Redirect 301 Validation", () => {
  it("validates default SEO settings and enforces strict GA4, GSC, titleTemplate & robots rules", () => {
    expect(
      siteSeoSettingsSchema.safeParse(DEFAULT_SITE_SEO_SETTINGS).success
    ).toBe(true);

    expect(
      siteSeoSettingsSchema.safeParse({
        ...DEFAULT_SITE_SEO_SETTINGS,
        googleAnalyticsId: "G-AB12CD34EF",
        googleSiteVerification: "abc123_XYZ-token.01",
        twitterHandle: "@onieltsvn",
        defaultOgImage: "https://cdn.onielts.vn/og-default.jpg",
        robotsDisallowPaths: ["/checkout", "/private-beta"],
      }).success
    ).toBe(true);

    // Reject script injection in GA4 ID
    expect(isValidGa4Id("G-12345678")).toBe(true);
    expect(isValidGa4Id("G-1234';alert(1);//")).toBe(false);
    expect(
      siteSeoSettingsSchema.safeParse({
        ...DEFAULT_SITE_SEO_SETTINGS,
        googleAnalyticsId: "<script>alert(1)</script>",
      }).success
    ).toBe(false);

    // Reject raw HTML tag pasted in Google Search Console token
    expect(
      siteSeoSettingsSchema.safeParse({
        ...DEFAULT_SITE_SEO_SETTINGS,
        googleSiteVerification: '<meta name="google-site-verification" content="abc" />',
      }).success
    ).toBe(false);

    // Reject titleTemplate missing %s
    expect(
      siteSeoSettingsSchema.safeParse({
        ...DEFAULT_SITE_SEO_SETTINGS,
        titleTemplate: "Ôn IELTS Static Only",
      }).success
    ).toBe(false);

    // Reject disallowing entire site "/"
    expect(
      siteSeoSettingsSchema.safeParse({
        ...DEFAULT_SITE_SEO_SETTINGS,
        robotsDisallowPaths: ["/"],
      }).success
    ).toBe(false);
  });

  it("blocks redirect self-loops, reserved system sources, and external open redirects", () => {
    expect(
      seoRedirectUpsertSchema.safeParse({
        source_path: "/blog/meo-thi-cu",
        destination_path: "/blog/meo-thi-moi",
        status_code: 301,
        is_active: true,
      }).success
    ).toBe(true);

    // Block self-loop (even with trailing slash or query)
    expect(
      seoRedirectUpsertSchema.safeParse({
        source_path: "/blog/same-post/",
        destination_path: "/blog/same-post",
        status_code: 301,
        is_active: true,
      }).success
    ).toBe(false);

    // Block reserved system paths
    for (const forbidden of [
      "/",
      "/admin",
      "/admin/users",
      "/api/tests",
      "/auth",
      "/auth/callback",
      "/_next/data",
      "/sitemap.xml",
      "/robots.txt",
    ]) {
      expect(isReservedRedirectSource(forbidden)).toBe(true);
      expect(
        seoRedirectUpsertSchema.safeParse({
          source_path: forbidden,
          destination_path: "/tests",
          status_code: 301,
          is_active: true,
        }).success
      ).toBe(false);
    }

    // Block external open redirects & protocol-relative URLs
    expect(isSafeInternalRedirectTarget("//evil.example/phish")).toBe(false);
    expect(isSafeInternalRedirectTarget("https://evil.example/phish")).toBe(false);
    expect(isSafeInternalRedirectTarget("javascript:alert(1)")).toBe(false);
    expect(
      seoRedirectUpsertSchema.safeParse({
        source_path: "/old-promo",
        destination_path: "https://evil.example",
        status_code: 302,
        is_active: true,
      }).success
    ).toBe(false);
    expect(
      seoRedirectUpsertSchema.safeParse({
        source_path: "/old-promo",
        destination_path: "//evil.example/steal",
        status_code: 301,
        is_active: true,
      }).success
    ).toBe(false);
  });

  it("matches active redirects accurately while normalizing trailing slashes and ignoring inactive or looping rules", () => {
    expect(normalizeRedirectPath("/blog/old-post/")).toBe("/blog/old-post");
    expect(normalizeRedirectDestination("/blog/new-post/?ref=301")).toBe(
      "/blog/new-post?ref=301"
    );

    const rules = [
      {
        id: "r1",
        source_path: "/blog/bai-cu",
        destination_path: "/blog/bai-moi",
        status_code: 301 as const,
        is_active: true,
      },
      {
        id: "r2",
        source_path: "/blog/bi-tat",
        destination_path: "/blog/dich",
        status_code: 302 as const,
        is_active: false,
      },
      {
        id: "r3",
        source_path: "/blog/tu-lap",
        destination_path: "/blog/tu-lap",
        status_code: 301 as const,
        is_active: true,
      },
      {
        id: "r4",
        source_path: "/admin/seo",
        destination_path: "/blog",
        status_code: 301 as const,
        is_active: true,
      },
    ];

    expect(matchSeoRedirect("/blog/bai-cu", rules)?.destination_path).toBe(
      "/blog/bai-moi"
    );
    expect(matchSeoRedirect("/blog/bai-cu/", rules)?.status_code).toBe(301);
    expect(matchSeoRedirect("/blog/bi-tat", rules)).toBeNull();
    expect(matchSeoRedirect("/blog/tu-lap", rules)).toBeNull();
    expect(matchSeoRedirect("/admin/seo", rules)).toBeNull();
    expect(matchSeoRedirect("/", rules)).toBeNull();
  });

  it("builds dynamic robots.txt always preserving protected routes and blocking accidental '/' disallow", () => {
    const robots = buildRobotsConfig(
      {
        ...DEFAULT_SITE_SEO_SETTINGS,
        robotsDisallowPaths: ["/checkout", "/", "private-staging"],
      },
      "https://onielts.vn/"
    );

    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    const disallow = Array.isArray(rule?.disallow) ? rule.disallow : [];

    for (const protectedPath of PROTECTED_ROBOTS_DISALLOW) {
      expect(disallow).toContain(protectedPath);
    }
    expect(disallow).toContain("/checkout");
    expect(disallow).toContain("/private-staging");
    expect(disallow).not.toContain("/");
    expect(robots.sitemap).toBe("https://onielts.vn/sitemap.xml");

    const preview = formatRobotsPreviewText(
      { ...DEFAULT_SITE_SEO_SETTINGS, robotsDisallowPaths: ["/checkout"] },
      "https://onielts.vn"
    );
    expect(preview).toContain("Disallow: /admin");
    expect(preview).toContain("Disallow: /checkout");
    expect(preview).toContain("Sitemap: https://onielts.vn/sitemap.xml");
  });

  it("enforces Admin-only RBAC, CSRF verifySameOrigin, and live wiring across GĐ6 routes", () => {
    const root = process.cwd();
    const read = (rel: string) =>
      fs.readFileSync(path.join(root, rel), "utf-8");

    const seoApi = read("src/app/api/admin/seo/route.ts");
    expect(seoApi).toContain('requireStaff("admin")');
    expect(seoApi).toContain("verifySameOrigin(req)");

    const redirectsApi = read("src/app/api/admin/seo/redirects/route.ts");
    expect(redirectsApi).toContain('requireStaff("admin")');
    expect(redirectsApi).toContain("verifySameOrigin(req)");

    const seoPage = read("src/app/admin/seo/page.tsx");
    expect(seoPage).toContain('authState.user?.role !== "admin"');

    const proxyFile = read("src/proxy.ts");
    expect(proxyFile).toContain("findMatchingActiveRedirect");
    expect(proxyFile).toContain("NextResponse.redirect");

    const sitemapFile = read("src/app/sitemap.ts");
    expect(sitemapFile).toContain('export const dynamic = "force-dynamic"');
    expect(sitemapFile).toContain("robotsIndex === false");
    expect(sitemapFile).toContain("getSiteSeoSettings");

    const robotsFile = read("src/app/robots.ts");
    expect(robotsFile).toContain('export const dynamic = "force-dynamic"');
    expect(robotsFile).toContain("buildRobotsConfig");

    const layoutFile = read("src/app/layout.tsx");
    expect(layoutFile).toContain("export async function generateMetadata");
    expect(layoutFile).toContain("googleSiteVerification");
    expect(layoutFile).toContain("GA4_ID_REGEX");

    const seoLib = read("src/lib/seo.ts");
    expect(seoLib).toContain("summary_large_image");
  });
});
