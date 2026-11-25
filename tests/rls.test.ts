import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  "supabase/migrations/0001_initial_schema.sql"
);

describe("Supabase SQL Migration — Row Level Security (RLS) Policy Verification", () => {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");

  const tableMatches = [...sql.matchAll(/CREATE TABLE public\.([a-z0-9_]+)\s*\(/gi)];
  const tables = tableMatches.map((m) => m[1]);

  it("defines all expected core tables", () => {
    expect(tables.length).toBeGreaterThanOrEqual(25);
    expect(tables).toContain("profiles");
    expect(tables).toContain("band_conversion_tables");
    expect(tables).toContain("pricing_plans");
    expect(tables).toContain("orders");
    expect(tables).toContain("ai_usage_logs");
    expect(tables).toContain("ielts_tests");
    expect(tables).toContain("daily_exams");
    expect(tables).toContain("daily_exam_attempts");
    expect(tables).toContain("writing_submissions");
    expect(tables).toContain("speaking_submissions");
    expect(tables).toContain("flashcards");
    expect(tables).toContain("referrals");
  });

  it("enables ROW LEVEL SECURITY on EVERY single public table", () => {
    const missingRls: string[] = [];
    for (const table of tables) {
      const pattern = new RegExp(
        `ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY;`,
        "i"
      );
      if (!pattern.test(sql)) {
        missingRls.push(table);
      }
    }
    expect(missingRls).toEqual([]);
  });

  it("defines at least one explicit RLS policy for EVERY public table", () => {
    const missingPolicies: string[] = [];
    for (const table of tables) {
      const pattern = new RegExp(
        `CREATE POLICY\\s+"[^"]+"\\s+ON public\\.${table}\\b`,
        "i"
      );
      if (!pattern.test(sql)) {
        missingPolicies.push(table);
      }
    }
    expect(missingPolicies).toEqual([]);
  });

  it("enforces PRIVATE BY DEFAULT on writing_submissions and speaking_submissions", () => {
    const writingBlock = sql.match(
      /CREATE TABLE public\.writing_submissions[\s\S]*?;/i
    )?.[0];
    const speakingBlock = sql.match(
      /CREATE TABLE public\.speaking_submissions[\s\S]*?;/i
    )?.[0];

    expect(writingBlock).toMatch(/is_public\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+FALSE/i);
    expect(speakingBlock).toMatch(/is_public\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+FALSE/i);

    // SELECT policy must check auth.uid() = user_id OR is_public = TRUE
    expect(sql).toMatch(
      /CREATE POLICY "writing_select_private_default" ON public\.writing_submissions[\s\S]*?auth\.uid\(\) = user_id OR is_public = TRUE/i
    );
  });

  it("prevents users from self-escalating role or premium_expires_at in profiles RLS", () => {
    expect(sql).toMatch(
      /CREATE POLICY "profiles_insert_own" ON public\.profiles[\s\S]*?role = 'learner'[\s\S]*?premium_expires_at IS NULL/i
    );
    expect(sql).toMatch(
      /CREATE POLICY "profiles_update_own_safe" ON public\.profiles[\s\S]*?premium_expires_at IS NOT DISTINCT FROM/i
    );
  });

  it("enforces idempotency constraints on orders and daily_exam_attempts", () => {
    expect(sql).toMatch(/order_code\s+BIGINT\s+UNIQUE\s+NOT NULL/i);
    expect(sql).toMatch(/webhook_event_id\s+TEXT\s+UNIQUE/i);
    expect(sql).toMatch(/UNIQUE\(daily_exam_id,\s*user_id\)/i);
  });

  it("protects Supabase Storage buckets with folder-scoped ownership RLS policies", () => {
    expect(sql).toMatch(/CREATE POLICY "storage_speaking_audio_own" ON storage\.objects/i);
    expect(sql).toMatch(/CREATE POLICY "storage_writing_charts_own" ON storage\.objects/i);
  });
});
