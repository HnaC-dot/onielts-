import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  calculateBandGap,
  computeNextStreak,
  formatStudyTime,
  getPreviousDateString,
  getQuestionTypeLabel,
} from "@/lib/progress-shared";
import {
  getAdminAnonymousAnalytics,
  getUserAttemptReview,
  getUserProgressHistory,
  getUserProgressSummary,
} from "@/lib/progress-analytics";

describe("Learning Progress (/progress) & Admin Anonymous Analytics", () => {
  const root = process.cwd();

  it("1. Migration 0006 creates test_attempt_answers with question_type, composite indexes & strict RLS", () => {
    const sql = fs.readFileSync(
      path.join(root, "supabase/migrations/0006_progress_analytics.sql"),
      "utf8"
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.test_attempt_answers");
    expect(sql).toContain("question_type TEXT NOT NULL");
    expect(sql).toContain("is_correct BOOLEAN NOT NULL");
    expect(sql).toContain("ALTER TABLE public.test_attempt_answers ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("auth.uid() = user_id OR public.is_admin()");
    expect(sql).toContain("idx_attempt_answers_user_type");
    expect(sql).toContain("idx_attempt_answers_test_q");
    expect(sql).toContain("idx_test_attempts_user_skill_completed");
    expect(sql).toContain("idx_daily_attempts_user_submitted");
    expect(sql).toContain("idx_speaking_user_created");
    expect(sql).toContain("idx_flashcards_user_reps");
  });

  it("2. Streak calculation handles consecutive days, same-day repeats, and broken streaks accurately", () => {
    expect(getPreviousDateString("2026-11-26")).toBe("2026-11-25");
    expect(getPreviousDateString("2026-03-01")).toBe("2026-02-28");

    // Consecutive day -> increment
    expect(computeNextStreak("2026-11-25", 4, "2026-11-26")).toEqual({
      streakCount: 5,
      changed: true,
    });

    // Same day -> keep unchanged
    expect(computeNextStreak("2026-11-26", 5, "2026-11-26")).toEqual({
      streakCount: 5,
      changed: false,
    });

    // Missed 2+ days -> reset to 1
    expect(computeNextStreak("2026-11-20", 12, "2026-11-26")).toEqual({
      streakCount: 1,
      changed: true,
    });

    // First ever activity
    expect(computeNextStreak(null, 0, "2026-11-26")).toEqual({
      streakCount: 1,
      changed: true,
    });
  });

  it("3. Helper formatting & band gap calculations work cleanly", () => {
    expect(calculateBandGap(6.0, 7.5)).toBe(1.5);
    expect(calculateBandGap(7.5, 7.0)).toBe(-0.5);
    expect(calculateBandGap(null, 7.0)).toBeNull();
    expect(formatStudyTime(45, false)).toBe("45 giây");
    expect(formatStudyTime(900, false)).toBe("15 phút");
    expect(formatStudyTime(5400, false)).toBe("1g 30p");
    expect(formatStudyTime(5400, true)).toBe("1h 30m");
    expect(getQuestionTypeLabel("tfng", false)).toContain("True / False / Not Given");
    expect(getQuestionTypeLabel("matching_headings", false)).toContain("Matching Headings");
  });

  it("4. Free vs Premium server-side gating strips charts, question-type breakdown & recommendations for Free users", async () => {
    const freeSummary = await getUserProgressSummary({
      id: "demo-free-001",
      role: "learner",
      isPremium: false,
      target_band: 7.0,
      streak_count: 3,
    });

    expect(freeSummary.isPremium).toBe(false);
    expect(freeSummary.charts).toBeNull();
    expect(freeSummary.questionTypeStats).toBeNull();
    expect(freeSummary.recommendations).toBeNull();
    expect(typeof freeSummary.lockedMeta.trackedQuestionTypesCount).toBe("number");

    const premiumSummary = await getUserProgressSummary({
      id: "demo-premium-002",
      role: "learner",
      isPremium: true,
      target_band: 7.5,
      streak_count: 8,
    });

    expect(premiumSummary.isPremium).toBe(true);
    expect(premiumSummary.charts).not.toBeNull();
    expect(Array.isArray(premiumSummary.questionTypeStats)).toBe(true);
    expect(Array.isArray(premiumSummary.recommendations)).toBe(true);
    expect(premiumSummary.recommendations!.length).toBeGreaterThan(0);
  });

  it("5. Server-side history pagination & own-only attempt review prevent cross-user data access", async () => {
    const page1 = await getUserProgressHistory("demo-free-001", {
      skill: "all",
      page: 1,
      pageSize: 5,
    });
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(5);
    expect(page1.items.length).toBeLessThanOrEqual(5);

    // Requesting a non-existent or another user's attempt ID returns null
    const unauthorized = await getUserAttemptReview(
      "demo-free-001",
      "test",
      "non-existent-attempt-id"
    );
    expect(unauthorized).toBeNull();
  });

  it("6. Post-submit links to /progress exist on Test, Daily Exam, Writing, Speaking & User Avatar menu", () => {
    for (const rel of [
      "src/components/site-header.tsx",
      "src/components/test-engine-client.tsx",
      "src/components/daily-exam-client.tsx",
      "src/components/writing-checker-client.tsx",
      "src/components/speaking-checker-client.tsx",
    ]) {
      const src = fs.readFileSync(path.join(root, rel), "utf8");
      expect(src, `${rel} should link to /progress`).toContain('href="/progress"');
    }
  });

  it("7. Admin anonymous analytics returns aggregate stats with ZERO learner PII (no emails or user_ids)", async () => {
    const analytics = await getAdminAnonymousAnalytics();
    const serialized = JSON.stringify(analytics);
    expect(analytics.totals).toBeDefined();
    expect(Array.isArray(analytics.topTests)).toBe(true);
    expect(Array.isArray(analytics.hardestQuestions)).toBe(true);
    expect(Array.isArray(analytics.questionTypeOverview)).toBe(true);
    expect(serialized).not.toContain("@onielts.vn");
    expect(serialized).not.toContain("user_id");

    const apiRoute = fs.readFileSync(
      path.join(root, "src/app/api/admin/analytics/route.ts"),
      "utf8"
    );
    expect(apiRoute).toContain('requireStaff("editor")');

    const progressApi = fs.readFileSync(
      path.join(root, "src/app/api/progress/route.ts"),
      "utf8"
    );
    expect(progressApi).toContain("verifySameOrigin(req)");
    expect(progressApi).toContain("getCurrentUser()");
  });
});
