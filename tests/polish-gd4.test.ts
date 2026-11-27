import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getSafeRedirectBase,
  sanitizeCallbackNextPath,
} from "../src/lib/domain-redirect";
import { getIeltsTests, getIeltsTestSummaries } from "../src/lib/db";
import { computeTestCounts } from "../src/lib/platform-stats";
import manifest from "../src/app/manifest";

const root = process.cwd();

function walkTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsxFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("GD4 — Final Production Polish: OAuth Hardening, SSR Perf, PWA & Learner Resilience", () => {
  describe("1. OAuth callback open-redirect & Host Header Poisoning protection", () => {
    it("blocks open-redirect payloads, backslashes, and control chars in next path", () => {
      const malicious = [
        null,
        undefined,
        "",
        "   ",
        "https://evil.com/phish",
        "http://evil.com",
        "//evil.com/login",
        "/\\evil.com",
        "/profile\\..\\evil",
        "/profile\r\nSet-Cookie: hacked=1",
        "/profile\nLocation: https://evil.com",
        "/profile\0",
        "javascript:alert(1)",
        "tests/reading-01",
      ];
      for (const bad of malicious) {
        expect(sanitizeCallbackNextPath(bad)).toBe("/");
      }
    });

    it("preserves safe same-origin relative next paths", () => {
      expect(sanitizeCallbackNextPath("/")).toBe("/");
      expect(sanitizeCallbackNextPath("/profile")).toBe("/profile");
      expect(sanitizeCallbackNextPath("  /tests/reading-01?tab=review#q5  ")).toBe(
        "/tests/reading-01?tab=review#q5"
      );
      expect(sanitizeCallbackNextPath("/pricing?plan=premium_6m")).toBe(
        "/pricing?plan=premium_6m"
      );
    });

    it("rejects untrusted X-Forwarded-Host headers and prevents Host Header Poisoning", () => {
      const poisonedHosts = [
        "evil.com",
        "evil.com:443",
        "onielts.vn.evil.com",
        "onielts.vn, evil.com",
        "evil.com/onielts.vn",
      ];
      const env = {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://onielts.vn",
        NEXT_PUBLIC_APP_URL: "https://staging.onielts.example",
      };
      for (const badHost of poisonedHosts) {
        const req = new Request("https://staging.onielts.example/auth/callback?code=abc", {
          headers: { "x-forwarded-host": badHost },
        });
        expect(getSafeRedirectBase(req, "https://staging.onielts.example", env)).toBe(
          "https://staging.onielts.example"
        );
      }
    });

    it("allows whitelisted X-Forwarded-Host in production and ignores it in development", () => {
      const prodEnv = {
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://onielts.vn",
      };
      const req = new Request("https://staging.onielts.example/auth/callback?code=abc", {
        headers: { "x-forwarded-host": "onielts.vn" },
      });
      expect(getSafeRedirectBase(req, "https://staging.onielts.example", prodEnv)).toBe(
        "https://onielts.vn"
      );

      const devEnv = {
        NODE_ENV: "development",
        NEXT_PUBLIC_SITE_URL: "https://onielts.vn",
      };
      expect(getSafeRedirectBase(req, "http://localhost:3000", devEnv)).toBe(
        "http://localhost:3000"
      );
    });

    it("keeps auth/callback/route.ts Next.js 16 route-export compliant (only GET exported) and Cache-Control: private, no-store", () => {
      const src = fs.readFileSync(
        path.join(root, "src/app/auth/callback/route.ts"),
        "utf8"
      );
      const exportMatches = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm)].map(
        (m) => m[1]
      );
      expect(exportMatches).toEqual(["GET"]);
      expect(src).toContain("getSafeRedirectBase");
      expect(src).toContain("sanitizeCallbackNextPath");
      expect(src).toContain('"Cache-Control", "private, no-store"');
    });
  });

  describe("2. SSR/DB performance deduplication & lightweight test summaries", () => {
    it("produces identical published catalog & computeTestCounts totals for lightweight summaries vs full tests", async () => {
      const [fullTests, summaryTests] = await Promise.all([
        getIeltsTests(false),
        getIeltsTestSummaries(false),
      ]);
      expect(summaryTests.length).toBe(fullTests.length);
      expect(summaryTests.map((t) => t.slug)).toEqual(fullTests.map((t) => t.slug));

      // Simulate Supabase summary projection where sections JSONB is omitted (sections: [])
      const strippedSummaries = summaryTests.map((t) => ({
        ...t,
        sections: [],
      }));
      expect(computeTestCounts(strippedSummaries)).toEqual(
        computeTestCounts(fullTests)
      );
    });

    it("uses lightweight getIeltsTestSummaries(false) across Homepage, /tests, /sitemap.xml, /api/search, and platform-stats", () => {
      const files = [
        "src/app/page.tsx",
        "src/app/tests/page.tsx",
        "src/app/sitemap.ts",
        "src/app/api/search/route.ts",
        "src/lib/platform-stats.ts",
      ];
      for (const rel of files) {
        const src = fs.readFileSync(path.join(root, rel), "utf8");
        expect(src, `${rel} should use getIeltsTestSummaries(false)`).toContain(
          "getIeltsTestSummaries(false)"
        );
        expect(src, `${rel} should not pull full getIeltsTests(false)`).not.toContain(
          "getIeltsTests(false)"
        );
      }
    });

    it("wraps per-request shared DB/CMS/settings getters in React cache()", () => {
      const dbSrc = fs.readFileSync(path.join(root, "src/lib/db.ts"), "utf8");
      const siteContentSrc = fs.readFileSync(
        path.join(root, "src/lib/site-content.ts"),
        "utf8"
      );
      const appearanceSrc = fs.readFileSync(
        path.join(root, "src/lib/cms-appearance.ts"),
        "utf8"
      );
      const statsSrc = fs.readFileSync(
        path.join(root, "src/lib/platform-stats.ts"),
        "utf8"
      );

      for (const cachedName of [
        "getIeltsTestSummariesCached",
        "getIeltsTestsCached",
        "getIeltsTestBySlugCached",
        "getCoursesCached",
        "getBlogPostsCached",
        "getDictationLessonsCached",
        "getPronunciationSoundsCached",
        "getLearnVideosCached",
        "getWritingExercisesCached",
        "getConversationTopicsCached",
      ]) {
        expect(dbSrc).toContain(`const ${cachedName} = cache(`);
      }
      expect(siteContentSrc).toContain("export const getSiteGeneralSettings = cache(");
      expect(siteContentSrc).toContain("export const getReferralConfig = cache(");
      expect(siteContentSrc).toContain("export const getSiteSeoSettings = cache(");
      expect(appearanceSrc).toContain("export const getPublishedAppearance = cache(");
      expect(statsSrc).toContain("export const getPlatformCounts = cache(");
    });
  });

  describe("3. PWA Web App Manifest", () => {
    it("exposes valid standalone manifest with existing /icon.svg asset", () => {
      const m = manifest();
      expect(m.short_name).toBe("Ôn IELTS");
      expect(m.start_url).toBe("/");
      expect(m.display).toBe("standalone");
      expect(m.theme_color).toBe("#059669");
      expect(m.lang).toBe("vi");
      expect(Array.isArray(m.icons)).toBe(true);
      expect(m.icons?.[0]?.src).toBe("/icon.svg");
      expect(fs.existsSync(path.join(root, "src/app/icon.svg"))).toBe(true);
    });
  });

  describe("4. External link noopener security & learner fetch JSON resilience", () => {
    it("ensures every external <a target=\"_blank\"> across src/ includes rel=\"noopener\"", () => {
      const tsxFiles = walkTsxFiles(path.join(root, "src"));
      const violations: string[] = [];
      for (const file of tsxFiles) {
        const src = fs.readFileSync(file, "utf8");
        for (const m of src.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
          if (!m[0].includes("noopener")) {
            violations.push(`${path.relative(root, file)}: ${m[0].slice(0, 100)}`);
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it("uses safe .json().catch(...) across hardened learner interactive clients", () => {
      const learnerFiles = [
        "src/components/writing-checker-client.tsx",
        "src/components/speaking-checker-client.tsx",
        "src/components/ai-tool-workbench.tsx",
        "src/app/writing/generator/page.tsx",
        "src/components/flashcards-client.tsx",
        "src/components/flashcard-quick-add.tsx",
        "src/components/progress-dashboard-client.tsx",
        "src/components/site-header.tsx",
        "src/app/auth/page.tsx",
        "src/app/contact/page.tsx",
        "src/components/blog-article-widgets.tsx",
        "src/app/feature-requests/page.tsx",
      ];
      for (const rel of learnerFiles) {
        const src = fs.readFileSync(path.join(root, rel), "utf8");
        expect(src, `${rel} should use safe JSON parsing`).toContain(".json().catch(");
        // Should not have bare `await res.json();` or `await d = await res.json();`
        expect(src, `${rel} should not have bare await res.json();`).not.toMatch(
          /await\s+\w+\.json\(\)\s*;/
        );
      }
    });
  });
});
