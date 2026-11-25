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
});
