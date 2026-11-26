import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("Engineering Security & Isolation Guardrails", () => {
  const srcFiles = walkTsFiles(path.resolve(process.cwd(), "src"));

  it("never references server-only secrets in any 'use client' file", () => {
    const violations: string[] = [];
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (/^["']use client["'];?/m.test(content)) {
        if (
          content.includes("SUPABASE_SERVICE_ROLE_KEY") ||
          content.includes("GEMINI_API_KEY") ||
          content.includes("PAYOS_CHECKSUM_KEY") ||
          content.includes("PAYOS_API_KEY")
        ) {
          violations.push(path.relative(process.cwd(), file));
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("centralizes @google/genai strictly inside src/lib/ai.ts", () => {
    const geminiImporters: string[] = [];
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("@google/genai")) {
        geminiImporters.push(path.relative(process.cwd(), file));
      }
    }
    expect(geminiImporters).toEqual(["src/lib/ai.ts"]);
  });

  it("includes prompt-injection delimiter neutralization in src/lib/ai.ts", () => {
    const aiSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/ai.ts"),
      "utf-8"
    );
    expect(aiSource).toContain("<user_submission_data>");
    expect(aiSource).toContain("UNTRUSTED LEARNER SUBMISSION DATA ONLY");
    expect(aiSource).toContain("[redacted_tag]");
  });

  it("contains zero hardcoded PayOS fallback checksum secrets", () => {
    const payosSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/payments/payos.ts"),
      "utf-8"
    );
    expect(payosSource).not.toContain("onielts_sandbox_dev_checksum_key");
    expect(payosSource).not.toContain("SANDBOX_FALLBACK_CHECKSUM_KEY");
  });

  it("blocks demo_switch and demo OTP in production and when Supabase is configured", () => {
    const authSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/auth.ts"),
      "utf-8"
    );
    const sessionRouteSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/auth/session/route.ts"),
      "utf-8"
    );
    expect(authSource).toContain('if (process.env.NODE_ENV === "production") return false;');
    expect(authSource).toContain("if (isSupabaseConfigured()) return false;");
    expect(sessionRouteSource).toContain("if (!demoAllowed)");
  });

  it("never exposes unverified fake marketing numbers on the homepage", () => {
    const homeSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/page.tsx"),
      "utf-8"
    );
    expect(homeSource).not.toContain("48.500+");
    expect(homeSource).not.toContain("2.400+");
    expect(homeSource).not.toContain("165.000+");
    expect(homeSource).not.toContain("+1.2 Band");
  });
});
