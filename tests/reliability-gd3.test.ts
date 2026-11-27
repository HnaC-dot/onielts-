import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { serializeJsonLd } from "@/lib/seo";
import { resetInMemoryRateLimitForTests } from "@/lib/rate-limit";

function collectTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(full));
    } else if (entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

describe("GD3 Production Reliability, Security Headers, JSON-LD XSS & Health Probe", () => {
  beforeEach(() => {
    resetInMemoryRateLimitForTests();
  });

  describe("1. XSS-safe JSON-LD serialization", () => {
    it("escapes </script>, HTML tags, ampersands, and Unicode line separators while remaining valid JSON", () => {
      const hostile = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: 'Test </script><script>alert("xss")</script> & <!-- comment -->',
        note: "line\u2028break\u2029here",
      };
      const serialized = serializeJsonLd(hostile);

      expect(serialized).not.toContain("<");
      expect(serialized).not.toContain(">");
      expect(serialized).not.toContain("&");
      expect(serialized).not.toContain("</script>");
      expect(serialized).not.toContain("\u2028");
      expect(serialized).not.toContain("\u2029");
      expect(serialized).toContain("\\u003c/script\\u003e");
      expect(JSON.parse(serialized)).toEqual(hostile);
    });

    it("has ZERO unescaped JSON.stringify inside ld+json dangerouslySetInnerHTML across src/app", () => {
      const appDir = path.resolve(process.cwd(), "src/app");
      const files = collectTsxFiles(appDir);
      const offenders: string[] = [];

      for (const file of files) {
        const src = fs.readFileSync(file, "utf-8");
        if (/dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify\(/.test(src)) {
          offenders.push(path.relative(process.cwd(), file));
        }
      }
      expect(offenders).toEqual([]);
    });
  });

  describe("2. HTTP Security Headers & Static Audio Cache in next.config.ts", () => {
    it("configures HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy (with microphone=(self)), disables X-Powered-By, and caches /audio/*", () => {
      const cfg = fs.readFileSync(
        path.resolve(process.cwd(), "next.config.ts"),
        "utf-8"
      );
      expect(cfg).toContain("poweredByHeader: false");
      expect(cfg).toContain("Strict-Transport-Security");
      expect(cfg).toContain("X-Content-Type-Options");
      expect(cfg).toContain("nosniff");
      expect(cfg).toContain("X-Frame-Options");
      expect(cfg).toContain("SAMEORIGIN");
      expect(cfg).toContain("Referrer-Policy");
      expect(cfg).toContain("strict-origin-when-cross-origin");
      expect(cfg).toContain("Permissions-Policy");
      expect(cfg).toContain("microphone=(self)");
      expect(cfg).toContain('source: "/audio/:path*"');
      expect(cfg).toContain("immutable");
    });
  });

  describe("3. Public Readiness Endpoint GET /api/health", () => {
    it("returns 200 ok with status checks, no-store cache header, and zero leaked secrets", async () => {
      const healthRoute = await import("@/app/api/health/route");
      const res = await healthRoute.GET();
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");

      const body = (await res.json()) as {
        ok: boolean;
        status: string;
        timestamp: string;
        checks: Record<string, unknown>;
      };
      expect(body.ok).toBe(true);
      expect(body.status).toBe("ok");
      expect(typeof body.timestamp).toBe("string");
      expect(body.checks).toHaveProperty("database");
      expect(body.checks).toHaveProperty("upstashRateLimit");
      expect(body.checks).toHaveProperty("geminiConfigured");
      expect(body.checks).toHaveProperty("payosConfigured");
      expect(body.checks).toHaveProperty("turnstileConfigured");

      const raw = JSON.stringify(body);
      expect(raw).not.toMatch(/sk_|service_role|eyJ|AIza/i);
    });
  });

  describe("4. Root global-error boundary & Learner UI crash/resilience guards", () => {
    it("provides a self-contained root src/app/global-error.tsx boundary", () => {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/global-error.tsx"),
        "utf-8"
      );
      expect(src).toContain('"use client"');
      expect(src).toContain("<html");
      expect(src).toContain("<body");
      expect(src).toContain("reset()");
      expect(src).not.toContain("error.stack");
    });

    it("guards guest progress state in CoursePlayerClient and renders alert feedback on submit errors in TestEngineClient", () => {
      const coursePlayer = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/course-player-client.tsx"),
        "utf-8"
      );
      expect(coursePlayer).not.toContain("data.progress.completed_lesson_ids ?? []");
      expect(coursePlayer).toContain("Array.isArray(data.progress.completed_lesson_ids)");

      const testEngine = fs.readFileSync(
        path.resolve(process.cwd(), "src/components/test-engine-client.tsx"),
        "utf-8"
      );
      expect(testEngine).toContain('role="alert"');
      expect(testEngine).toContain("submitError");
    });

    it("hardens sitemap.ts with fallback catches and uses updated_at for blog posts", () => {
      const sitemap = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/sitemap.ts"),
        "utf-8"
      );
      expect(sitemap).toContain("post.updated_at || post.published_at");
      expect(sitemap).toContain(".catch(() => [])");
    });
  });

  describe("5. CSRF enforcement on /api/locale and /api/checkout/simulate-webhook", () => {
    it("rejects cross-origin POST /api/locale and accepts same-origin", async () => {
      const localeRoute = await import("@/app/api/locale/route");

      const cross = await localeRoute.POST(
        new Request("https://onielts.vn/api/locale", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            host: "onielts.vn",
            origin: "https://evil.example",
          },
          body: JSON.stringify({ locale: "en" }),
        })
      );
      expect(cross.status).toBe(403);

      const same = await localeRoute.POST(
        new Request("https://onielts.vn/api/locale", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            host: "onielts.vn",
            origin: "https://onielts.vn",
          },
          body: JSON.stringify({ locale: "en" }),
        })
      );
      expect(same.status).toBe(200);
    });

    it("rejects cross-origin POST /api/checkout/simulate-webhook", async () => {
      const simRoute = await import("@/app/api/checkout/simulate-webhook/route");
      const cross = await simRoute.POST(
        new Request("https://onielts.vn/api/checkout/simulate-webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            host: "onielts.vn",
            origin: "https://evil.example",
          },
          body: JSON.stringify({ orderCode: 12345 }),
        })
      );
      expect(cross.status).toBe(403);
    });
  });
});
