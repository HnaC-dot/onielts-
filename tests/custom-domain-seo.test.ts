import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  computeCanonicalDomainRedirect,
  getCanonicalSiteHost,
  getConfiguredSiteUrl,
  getEffectiveSiteBaseUrl,
  isNoindexRoutePath,
} from "@/lib/domain-redirect";
import {
  DEFAULT_SITE_SEO_SETTINGS,
  PROTECTED_ROBOTS_DISALLOW,
  buildRobotsConfig,
} from "@/lib/seo-cms-shared";
import { buildNextMetadata } from "@/lib/seo";

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, acc);
    } else if (/\.(ts|tsx|js|jsx|mjs|json|css)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("Custom Domain Readiness & Technical SEO", () => {
  const root = process.cwd();

  it("1. has ZERO hardcoded default Vercel subdomain occurrences anywhere in src/ and tests/", () => {
    const forbidden = ["onielts", "vercel", "app"].join(".");
    const files = [
      ...walkFiles(path.join(root, "src")),
      ...walkFiles(path.join(root, "tests")),
    ];
    const matches: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      if (content.toLowerCase().includes(forbidden)) {
        matches.push(path.relative(root, file));
      }
    }
    expect(matches).toEqual([]);
  });

  it("1b. resolves canonical URL from NEXT_PUBLIC_SITE_URL first, then NEXT_PUBLIC_APP_URL", () => {
    expect(
      getEffectiveSiteBaseUrl({
        NEXT_PUBLIC_SITE_URL: "https://onielts.com/",
        NEXT_PUBLIC_APP_URL: "https://old.example.com",
      })
    ).toBe("https://onielts.com");

    expect(
      getEffectiveSiteBaseUrl({
        NEXT_PUBLIC_APP_URL: "https://onielts.vn/",
      })
    ).toBe("https://onielts.vn");

    expect(getConfiguredSiteUrl({})).toBeNull();
    expect(
      getCanonicalSiteHost({ NEXT_PUBLIC_SITE_URL: "https://onielts.com" })
    ).toBe("onielts.com");

    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    try {
      process.env.NEXT_PUBLIC_SITE_URL = "https://onielts.com";
      const meta = buildNextMetadata({
        title: "Đề thi IELTS",
        description: "Kho đề thi IELTS chuẩn máy tính.",
        pathname: "/tests",
      });
      expect(meta.alternates?.canonical).toBe("https://onielts.com/tests");
      expect(meta.openGraph?.url).toBe("https://onielts.com/tests");
    } finally {
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    }
  });

  it("2. redirects 301 from *.vercel.app and www/non-www to primary custom domain preserving path & query", () => {
    const vercelHost = `demo-site.${"vercel.app"}`;

    // Production Vercel alias -> apex custom domain
    expect(
      computeCanonicalDomainRedirect({
        requestHost: vercelHost,
        pathname: "/tests/cambridge-reading-01",
        search: "?utm_source=google&ref=abc",
        siteUrl: "https://onielts.vn",
        vercelEnv: "production",
      })
    ).toBe("https://onielts.vn/tests/cambridge-reading-01?utm_source=google&ref=abc");

    // www -> non-www when primary is non-www
    expect(
      computeCanonicalDomainRedirect({
        requestHost: "www.onielts.vn",
        pathname: "/blog/meo-thi-reading",
        search: "",
        siteUrl: "https://onielts.vn",
        vercelEnv: "production",
      })
    ).toBe("https://onielts.vn/blog/meo-thi-reading");

    // non-www -> www when primary is www
    expect(
      computeCanonicalDomainRedirect({
        requestHost: "onielts.com",
        pathname: "/pricing",
        search: "?plan=yearly",
        siteUrl: "https://www.onielts.com",
        vercelEnv: "production",
      })
    ).toBe("https://www.onielts.com/pricing?plan=yearly");

    // Already on canonical host -> no redirect (prevents infinite loop)
    expect(
      computeCanonicalDomainRedirect({
        requestHost: "onielts.vn",
        pathname: "/",
        search: "",
        siteUrl: "https://onielts.vn",
        vercelEnv: "production",
      })
    ).toBeNull();

    // Safe no-op when NEXT_PUBLIC_SITE_URL is unset or still points to vercel.app / localhost
    expect(
      computeCanonicalDomainRedirect({
        requestHost: vercelHost,
        pathname: "/tests",
        search: "",
        siteUrl: null,
        vercelEnv: "production",
      })
    ).toBeNull();
    expect(
      computeCanonicalDomainRedirect({
        requestHost: vercelHost,
        pathname: "/tests",
        search: "",
        siteUrl: `https://${vercelHost}`,
        vercelEnv: "production",
      })
    ).toBeNull();

    // Skip PR preview deployments, localhost, and /api/*
    expect(
      computeCanonicalDomainRedirect({
        requestHost: vercelHost,
        pathname: "/tests",
        search: "",
        siteUrl: "https://onielts.vn",
        vercelEnv: "preview",
      })
    ).toBeNull();
    expect(
      computeCanonicalDomainRedirect({
        requestHost: "www.onielts.vn",
        pathname: "/api/webhooks/payos",
        search: "",
        siteUrl: "https://onielts.vn",
        vercelEnv: "production",
      })
    ).toBeNull();
    expect(
      computeCanonicalDomainRedirect({
        requestHost: "localhost:3000",
        pathname: "/",
        search: "",
        siteUrl: "https://onielts.vn",
        vercelEnv: "development",
      })
    ).toBeNull();
  });

  it("3. configures sitemap.xml with all public published entities and robots.txt blocking admin, api & personal pages", () => {
    const robots = buildRobotsConfig(DEFAULT_SITE_SEO_SETTINGS, "https://onielts.vn");
    expect(robots.sitemap).toBe("https://onielts.vn/sitemap.xml");

    const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    const disallow = Array.isArray(rules.disallow) ? rules.disallow : [];
    for (const protectedPath of [
      "/admin",
      "/api/",
      "/auth",
      "/profile",
      "/progress",
      "/referral",
      "/flashcards",
    ]) {
      expect(PROTECTED_ROBOTS_DISALLOW).toContain(protectedPath);
      expect(disallow).toContain(protectedPath);
    }

    const sitemapSrc = fs.readFileSync(
      path.join(root, "src/app/sitemap.ts"),
      "utf8"
    );
    expect(sitemapSrc).toContain("getIeltsTestSummaries(false)");
    expect(sitemapSrc).toContain("getCourses(false)");
    expect(sitemapSrc).toContain("?lesson=");
    expect(sitemapSrc).toContain("getDictationLessons(false)");
    expect(sitemapSrc).toContain("getPronunciationSounds(false)");
    expect(sitemapSrc).toContain("getLearnVideos(false)");
    expect(sitemapSrc).toContain("getBlogPosts(false)");
    expect(sitemapSrc).toContain("listPublicStaticPages()");
    expect(sitemapSrc).toContain("lastModified");
    expect(sitemapSrc).not.toContain('"/flashcards"');
    expect(sitemapSrc).not.toContain('"/referral"');
  });

  it("4. reads Google Search Console & GA4 strictly from Admin SEO settings with zero hardcoded IDs", () => {
    const layoutSrc = fs.readFileSync(
      path.join(root, "src/app/layout.tsx"),
      "utf8"
    );
    expect(layoutSrc).toContain("seo.googleSiteVerification");
    expect(layoutSrc).toContain("seoSettings.googleAnalyticsId");
    expect(layoutSrc).toContain("GSC_TOKEN_REGEX");
    expect(layoutSrc).toContain("GA4_ID_REGEX");
    // No hardcoded G-XXXXXXXXXX tracking ID in layout
    expect(layoutSrc).not.toMatch(/G-[A-Z0-9]{6,}/);
  });

  it("5. enforces noindex on /admin and all personal/auth pages (metadata + X-Robots-Tag proxy header)", () => {
    for (const p of [
      "/admin",
      "/admin/seo",
      "/auth",
      "/profile",
      "/progress",
      "/referral",
      "/flashcards",
      "/api/profile",
    ]) {
      expect(isNoindexRoutePath(p)).toBe(true);
    }
    for (const pub of ["/", "/tests", "/blog", "/courses", "/pricing", "/dictation"]) {
      expect(isNoindexRoutePath(pub)).toBe(false);
    }

    const adminLayout = fs.readFileSync(
      path.join(root, "src/app/admin/layout.tsx"),
      "utf8"
    );
    expect(adminLayout).toContain("robots: { index: false, follow: false }");

    for (const relPath of [
      "src/app/auth/layout.tsx",
      "src/app/profile/page.tsx",
      "src/app/progress/page.tsx",
      "src/app/referral/page.tsx",
      "src/app/flashcards/page.tsx",
    ]) {
      const content = fs.readFileSync(path.join(root, relPath), "utf8");
      expect(content).toContain("noindex: true");
    }

    const proxySrc = fs.readFileSync(path.join(root, "src/proxy.ts"), "utf8");
    expect(proxySrc).toContain("computeCanonicalDomainRedirect");
    expect(proxySrc).toContain('response.headers.set("X-Robots-Tag", "noindex, nofollow")');
  });
});
