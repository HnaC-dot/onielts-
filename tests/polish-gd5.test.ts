import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readJsonBody } from "../src/lib/request-json";
import nextConfig from "../next.config";

const root = process.cwd();

describe("GD5 — Admin/CMS DB Egress Optimization, Private Cache Headers & Safe JSON Body Parsing", () => {
  describe("1. readJsonBody helper", () => {
    it("parses valid JSON object", async () => {
      const req = new Request("https://onielts.vn/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_band: 7.5 }),
      });
      const result = await readJsonBody<{ target_band: number }>(req);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.target_band).toBe(7.5);
      }
    });

    it("returns 400 Bad Request on malformed or empty JSON instead of throwing 500", async () => {
      for (const badBody of ["", "{invalid json", "undefined"]) {
        const req = new Request("https://onielts.vn/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: badBody,
        });
        const result = await readJsonBody(req);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.response.status).toBe(400);
          const payload = await result.response.json();
          expect(payload.error).toBeTruthy();
        }
      }
    });

    it("is wired into core public/learner/payment/auth API routes", () => {
      const routes = [
        "src/app/api/auth/session/route.ts",
        "src/app/api/checkout/route.ts",
        "src/app/api/promo/validate/route.ts",
        "src/app/api/profile/route.ts",
        "src/app/api/tests/submit/route.ts",
        "src/app/api/daily-exam/route.ts",
        "src/app/api/flashcards/route.ts",
        "src/app/api/courses/progress/route.ts",
        "src/app/api/contact/route.ts",
      ];
      for (const rel of routes) {
        const src = fs.readFileSync(path.join(root, rel), "utf8");
        expect(src, `${rel} should use readJsonBody`).toContain("readJsonBody(");
        expect(src, `${rel} should not call raw req.json()`).not.toContain("await req.json()");
      }
    });
  });

  describe("2. Admin & CMS lightweight getIeltsTestSummaries usage", () => {
    it("avoids pulling full test_data JSONB across admin dashboard, search, SEO audit, and internal link catalog", () => {
      const files = [
        "src/lib/admin-auth.ts",
        "src/lib/cms-seo.ts",
        "src/lib/cms-content-production.ts",
        "src/app/api/admin/search/route.ts",
        "src/app/api/admin/route.ts",
        "src/app/admin/legacy/page.tsx",
      ];
      for (const rel of files) {
        const src = fs.readFileSync(path.join(root, rel), "utf8");
        expect(src, `${rel} should use getIeltsTestSummaries`).toContain(
          "getIeltsTestSummaries("
        );
        expect(src, `${rel} should not call full getIeltsTests(`).not.toContain(
          "getIeltsTests("
        );
      }
    });
  });

  describe("3. Private no-store Cache-Control headers on sensitive API routes", () => {
    it("configures private, no-store, max-age=0 for auth, checkout, profile, progress, flashcards, and admin APIs", async () => {
      const headersFn = nextConfig.headers;
      expect(typeof headersFn).toBe("function");
      const rules = await headersFn!();
      const privateRule = rules.find((r) =>
        r.source.includes("(auth|checkout|profile|progress|flashcards|admin)")
      );
      expect(privateRule).toBeDefined();
      expect(
        privateRule?.headers.find((h) => h.key === "Cache-Control")?.value
      ).toBe("private, no-store, max-age=0");

      const profileRule = rules.find((r) => r.source === "/api/profile");
      expect(profileRule).toBeDefined();
      expect(
        profileRule?.headers.find((h) => h.key === "Cache-Control")?.value
      ).toBe("private, no-store, max-age=0");
    });
  });
});
