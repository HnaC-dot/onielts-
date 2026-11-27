import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { maskEmailAddress, verifySameOrigin } from "@/lib/admin-auth";
import {
  isTurnstileFullyConfigured,
  verifyBotProtection,
} from "@/lib/bot-protection";
import {
  createFlashcardItem,
  getDailyExamState,
  getFlashcardsForUser,
  reviewFlashcardItem,
  toggleCourseLessonProgress,
} from "@/lib/db";
import { resetInMemoryRateLimitForTests } from "@/lib/rate-limit";
import { readStore, updateStore } from "@/lib/store";
import type { AuthState } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

// Mock auth state for runtime HTTP handler RBAC tests
const mockGetAuthState = vi.fn<() => Promise<AuthState>>();

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getAuthState: () => mockGetAuthState(),
    getCurrentUser: async () => (await mockGetAuthState()).user,
  };
});

function makeUser(role: "learner" | "editor" | "admin", id = `user-${role}`): SessionUser {
  return {
    id,
    email: `${role}@onielts.vn`,
    full_name: `Test ${role}`,
    avatar_url: null,
    role,
    is_locked: false,
    target_band: 7.5,
    current_band: 6.5,
    streak_count: 3,
    last_active_date: "2026-11-27",
    premium_expires_at: role === "admin" ? "2099-01-01T00:00:00.000Z" : null,
    referral_code: "TEST1234",
    referred_by: null,
    email_verified: true,
    locale: "vi",
    created_at: "2026-01-01T00:00:00.000Z",
    isPremium: role === "admin",
    authMode: "demo",
  };
}

function setRole(role: "anon" | "learner" | "editor" | "admin") {
  if (role === "anon") {
    mockGetAuthState.mockResolvedValue({
      status: "unauthenticated",
      user: null,
      authUserId: null,
      errorCode: null,
      errorMessage: null,
    });
    return;
  }
  const user = makeUser(role);
  mockGetAuthState.mockResolvedValue({
    status: "authenticated",
    user,
    authUserId: user.id,
    errorCode: null,
    errorMessage: null,
  });
}

describe("GD2 Security Hardening — CSRF, Turnstile, IDOR, Rate Limit & Admin RBAC", () => {
  const origTurnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const origTurnstileSite = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  beforeEach(() => {
    resetInMemoryRateLimitForTests();
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    setRole("anon");
  });

  afterEach(() => {
    if (origTurnstileSecret === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = origTurnstileSecret;
    }
    if (origTurnstileSite === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = origTurnstileSite;
    }
    vi.restoreAllMocks();
  });

  describe("1. verifySameOrigin CSRF hardening", () => {
    it("rejects Sec-Fetch-Site: cross-site even when Origin/Referer are absent", () => {
      const req = new Request("https://onielts.vn/api/profile", {
        method: "PATCH",
        headers: {
          host: "onielts.vn",
          "sec-fetch-site": "cross-site",
        },
      });
      expect(verifySameOrigin(req)).toBe(false);
    });

    it("rejects cookie-bearing requests with stripped Origin and Referer unless Sec-Fetch-Site is same-origin", () => {
      const strippedCookieReq = new Request("https://onielts.vn/api/admin", {
        method: "POST",
        headers: {
          host: "onielts.vn",
          cookie: "sb-access-token=abc123",
        },
      });
      expect(verifySameOrigin(strippedCookieReq)).toBe(false);

      const sameOriginFetchReq = new Request("https://onielts.vn/api/admin", {
        method: "POST",
        headers: {
          host: "onielts.vn",
          cookie: "sb-access-token=abc123",
          "sec-fetch-site": "same-origin",
        },
      });
      expect(verifySameOrigin(sameOriginFetchReq)).toBe(true);
    });

    it("still allows non-cookie server-to-server requests without Origin/Referer", () => {
      const serverReq = new Request("https://onielts.vn/api/admin", {
        method: "POST",
        headers: { host: "onielts.vn" },
      });
      expect(verifySameOrigin(serverReq)).toBe(true);
    });
  });

  describe("2. Bot protection & graceful Cloudflare Turnstile fallback", () => {
    it("blocks honeypot submissions immediately", async () => {
      const res = await verifyBotProtection({ honeypot: "http://spam.bot" });
      expect(res.passed).toBe(false);
      expect(res.mode).toBe("honeypot");
    });

    it("falls back to honeypot mode without bricking forms if TURNSTILE_SECRET_KEY is set without NEXT_PUBLIC_TURNSTILE_SITE_KEY", async () => {
      process.env.TURNSTILE_SECRET_KEY = "test-secret";
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      expect(isTurnstileFullyConfigured()).toBe(false);

      const res = await verifyBotProtection({ honeypot: "" });
      expect(res.passed).toBe(true);
      expect(res.mode).toBe("honeypot");
    });

    it("requires a valid Turnstile token when BOTH server secret and client site key are configured", async () => {
      process.env.TURNSTILE_SECRET_KEY = "test-secret";
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0x4AAAAAAA_test";
      expect(isTurnstileFullyConfigured()).toBe(true);

      const missing = await verifyBotProtection({ honeypot: "" });
      expect(missing.passed).toBe(false);
      expect(missing.mode).toBe("turnstile");

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
      const valid = await verifyBotProtection({
        turnstileToken: "cf-valid-token",
        remoteIp: "203.0.113.5",
      });
      expect(valid.passed).toBe(true);
      expect(valid.mode).toBe("turnstile");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Flashcards IDOR, Course Progress bounds & Daily Exam leaderboard sanitization", () => {
    it("prevents creating a flashcard inside another user's private set and blocks reviewing another user's card", async () => {
      const victimSetId = "set-victim-idor-test";
      const victimCardId = "card-victim-idor-test";
      updateStore((store) => {
        store.flashcard_sets.push({
          id: victimSetId,
          user_id: "victim-user-1",
          title: "Victim Private Deck",
          description: "Private",
          is_public: false,
          created_at: new Date().toISOString(),
        });
        store.flashcards.push({
          id: victimCardId,
          set_id: victimSetId,
          user_id: "victim-user-1",
          term: "ubiquitous",
          phonetic: "",
          part_of_speech: "adj",
          definition_vi: "phổ biến khắp nơi",
          definition_en: "present everywhere",
          example_sentence: "",
          ease_factor: 2.5,
          interval_days: 1,
          repetitions: 0,
          next_review_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      });

      try {
        // Attacker tries to inject card into victim's set_id -> rejected (null)
        const injected = await createFlashcardItem("attacker-user-2", {
          term: "malicious",
          phonetic: "",
          part_of_speech: "adj",
          definition_vi: "độc hại",
          definition_en: "",
          example_sentence: "",
          set_id: victimSetId,
        });
        expect(injected).toBeNull();

        // Attacker tries to review victim's card -> rejected (null)
        const reviewed = await reviewFlashcardItem("attacker-user-2", victimCardId, 5);
        expect(reviewed).toBeNull();

        // Attacker listing flashcards does NOT see victim's private set or card
        const attackerData = await getFlashcardsForUser("attacker-user-2");
        expect(attackerData.sets.some((s) => s.id === victimSetId)).toBe(false);
        expect(attackerData.cards.some((c) => c.id === victimCardId)).toBe(false);
      } finally {
        updateStore((store) => {
          store.flashcard_sets = store.flashcard_sets.filter((s) => s.id !== victimSetId);
          store.flashcards = store.flashcards.filter((c) => c.id !== victimCardId);
        });
      }
    });

    it("rejects fabricated lessonId and keeps course progress_percent within 0..100", async () => {
      const firstCourse = readStore().courses[0];
      expect(firstCourse).toBeTruthy();

      const fakeRes = await toggleCourseLessonProgress({
        userId: "demo-free-001",
        courseId: firstCourse.id,
        lessonId: "non-existent-lesson-999",
        completed: true,
      });
      expect(fakeRes).toBeNull();

      const validLessonId = firstCourse.lessons[0].id;
      const okRes = await toggleCourseLessonProgress({
        userId: "demo-free-001",
        courseId: firstCourse.id,
        lessonId: validLessonId,
        completed: true,
      });
      expect(okRes).not.toBeNull();
      expect(okRes!.progress_percent).toBeGreaterThanOrEqual(0);
      expect(okRes!.progress_percent).toBeLessThanOrEqual(100);
    });

    it("strips contestant answers from public Daily Exam leaderboard rows", async () => {
      const testDate = "2026-11-27";
      updateStore((store) => {
        store.daily_exam_attempts.push({
          id: "lb-secret-attempt-1",
          exam_date: testDate,
          test_slug: "sample-test",
          user_id: "11111111-1111-4111-8111-111111111111",
          display_name: "Top Scorer",
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          answers: { q1: "TRUE", q2: "B" },
          raw_score: 10,
          max_score: 10,
          band_score: 9,
          duration_seconds: 120,
          is_completed: true,
        });
      });

      try {
        const state = await getDailyExamState(testDate, null);
        const row = state.leaderboard.find((r) => r.id === "lb-secret-attempt-1");
        expect(row).toBeDefined();
        expect(row!.answers).toEqual({});
        expect(row!.user_id).toBe("");
      } finally {
        updateStore((store) => {
          store.daily_exam_attempts = store.daily_exam_attempts.filter(
            (a) => a.id !== "lb-secret-attempt-1"
          );
        });
      }
    });
  });

  describe("4. Runtime HTTP Admin RBAC enforcement (401/403/200)", () => {
    it("masks subscriber emails for editors, blocks editor CSV export & DELETE, and allows admin", async () => {
      expect(maskEmailAddress("minh.anh@gmail.com")).toBe("mi***@gmail.com");

      const subRoute = await import("@/app/api/admin/subscribers/route");

      // Unauthenticated -> 401
      setRole("anon");
      const anonRes = await subRoute.GET(
        new Request("https://onielts.vn/api/admin/subscribers")
      );
      expect(anonRes.status).toBe(401);

      // Learner -> 403
      setRole("learner");
      const learnerRes = await subRoute.GET(
        new Request("https://onielts.vn/api/admin/subscribers")
      );
      expect(learnerRes.status).toBe(403);

      // Seed one subscriber to verify masking
      updateStore((store) => {
        store.newsletter_subscribers = [
          {
            id: "sub-rbac-test",
            email: "secret.learner@gmail.com",
            source_slug: "ielts-tips",
            locale: "vi",
            status: "active",
            subscribed_at: new Date().toISOString(),
          },
        ];
      });

      // Editor: JSON GET allowed with masked email; CSV export -> 403; DELETE -> 403
      setRole("editor");
      const editorJson = await subRoute.GET(
        new Request("https://onielts.vn/api/admin/subscribers")
      );
      expect(editorJson.status).toBe(200);
      const editorPayload = (await editorJson.json()) as {
        items: Array<{ email: string }>;
        emailsMasked: boolean;
      };
      expect(editorPayload.emailsMasked).toBe(true);
      expect(editorPayload.items[0]?.email).toBe("se***@gmail.com");

      const editorCsv = await subRoute.GET(
        new Request("https://onielts.vn/api/admin/subscribers?format=csv")
      );
      expect(editorCsv.status).toBe(403);

      const editorDel = await subRoute.DELETE(
        new Request("https://onielts.vn/api/admin/subscribers?id=sub-rbac-test", {
          method: "DELETE",
          headers: { origin: "https://onielts.vn", host: "onielts.vn" },
        })
      );
      expect(editorDel.status).toBe(403);

      // Admin: CSV export -> 200 & JSON shows full email
      setRole("admin");
      const adminCsv = await subRoute.GET(
        new Request("https://onielts.vn/api/admin/subscribers?format=csv")
      );
      expect(adminCsv.status).toBe(200);
      const csvText = await adminCsv.text();
      expect(csvText).toContain("secret.learner@gmail.com");
    });

    it("locks /api/admin/audit-logs to admin only (editor -> 403, admin -> 200)", async () => {
      const auditRoute = await import("@/app/api/admin/audit-logs/route");

      setRole("anon");
      expect(
        (await auditRoute.GET(new Request("https://onielts.vn/api/admin/audit-logs"))).status
      ).toBe(401);

      setRole("editor");
      expect(
        (await auditRoute.GET(new Request("https://onielts.vn/api/admin/audit-logs"))).status
      ).toBe(403);

      setRole("admin");
      expect(
        (await auditRoute.GET(new Request("https://onielts.vn/api/admin/audit-logs"))).status
      ).toBe(200);
    });

    it("locks legal/* edits and DELETE on /api/admin/pages, plus DELETE on /api/admin/inbox and /api/admin/tests/[id] to admin", async () => {
      const pagesRoute = await import("@/app/api/admin/pages/route");
      const inboxRoute = await import("@/app/api/admin/inbox/route");
      const testItemRoute = await import("@/app/api/admin/tests/[id]/route");

      setRole("editor");

      const legalEditRes = await pagesRoute.POST(
        new Request("https://onielts.vn/api/admin/pages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            origin: "https://onielts.vn",
            host: "onielts.vn",
          },
          body: JSON.stringify({
            kind: "page",
            page: { slug: "legal/terms", title_vi: "Hacked Terms" },
          }),
        })
      );
      expect(legalEditRes.status).toBe(403);

      const pageDelRes = await pagesRoute.DELETE(
        new Request("https://onielts.vn/api/admin/pages?kind=faq&id=faq-1", {
          method: "DELETE",
          headers: { origin: "https://onielts.vn", host: "onielts.vn" },
        })
      );
      expect(pageDelRes.status).toBe(403);

      const inboxDelRes = await inboxRoute.DELETE(
        new Request("https://onielts.vn/api/admin/inbox?kind=contact&id=c-1", {
          method: "DELETE",
          headers: { origin: "https://onielts.vn", host: "onielts.vn" },
        })
      );
      expect(inboxDelRes.status).toBe(403);

      const testDelRes = await testItemRoute.DELETE(
        new Request("https://onielts.vn/api/admin/tests/test-1", {
          method: "DELETE",
          headers: { origin: "https://onielts.vn", host: "onielts.vn" },
        }),
        { params: Promise.resolve({ id: "test-1" }) }
      );
      expect(testDelRes.status).toBe(403);
    });

    it("hides ai_usage_logs, pricing_plans, and promo_banner from editors on GET /api/admin and rejects anon before Zod on POST", async () => {
      const adminRoute = await import("@/app/api/admin/route");

      // Unauthenticated with invalid payload MUST get 401 (not 400 Zod error)
      setRole("anon");
      const anonPost = await adminRoute.POST(
        new Request("https://onielts.vn/api/admin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            origin: "https://onielts.vn",
            host: "onielts.vn",
          },
          body: JSON.stringify({ action: "invalid_action" }),
        })
      );
      expect(anonPost.status).toBe(401);

      // Editor GET must not receive ai_usage_logs, pricing_plans, or promo_banner
      setRole("editor");
      const editorGet = await adminRoute.GET();
      expect(editorGet.status).toBe(200);
      const data = (await editorGet.json()) as {
        ai_usage_logs: unknown[];
        pricing_plans: unknown[];
        promo_banner: unknown;
      };
      expect(data.ai_usage_logs).toEqual([]);
      expect(data.pricing_plans).toEqual([]);
      expect(data.promo_banner).toBeNull();
    });
  });

  describe("5. Public API rate limiting, vote deduplication & Migration 0009 completeness", () => {
    it("deduplicates duplicate votes on the same feature request within 24h", async () => {
      const frRoute = await import("@/app/api/feature-requests/route");
      const existingId = readStore().feature_requests[0]?.id;
      expect(existingId).toBeTruthy();

      const makeVoteReq = () =>
        new Request("https://onielts.vn/api/feature-requests", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            origin: "https://onielts.vn",
            host: "onielts.vn",
            "x-real-ip": "198.51.100.42",
          },
          body: JSON.stringify({ id: existingId }),
        });

      const first = await frRoute.PATCH(makeVoteReq());
      expect(first.status).toBe(200);

      const second = await frRoute.PATCH(makeVoteReq());
      expect(second.status).toBe(429);
    });

    it("rate-limits /api/promo/validate after 10 attempts per minute", async () => {
      const promoRoute = await import("@/app/api/promo/validate/route");
      const makePromoReq = (code: string) =>
        new Request("https://onielts.vn/api/promo/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            origin: "https://onielts.vn",
            host: "onielts.vn",
            "x-real-ip": "198.51.100.77",
          },
          body: JSON.stringify({ code }),
        });

      for (let i = 0; i < 10; i++) {
        const res = await promoRoute.POST(makePromoReq(`GUESS${i}`));
        expect(res.status).not.toBe(429);
      }
      const blocked = await promoRoute.POST(makePromoReq("GUESS_OVER"));
      expect(blocked.status).toBe(429);
    });

    it("verifies Migration 0009 SQL contains all 10 required hardening protections", () => {
      const sql = fs.readFileSync(
        path.resolve(process.cwd(), "supabase/migrations/0009_security_rls_hardening.sql"),
        "utf-8"
      );
      expect(sql).toContain("REVOKE SELECT ON public.ielts_tests FROM anon, authenticated;");
      expect(sql).toContain("daily_attempts_insert_own_unscored");
      expect(sql).toContain("daily_exam_leaderboard_public");
      expect(sql).toContain("streak_count IS NOT DISTINCT FROM");
      expect(sql).toContain("key IN ('general', 'seo', 'referral', 'appearance_published')");
      expect(sql).toContain("REVOKE SELECT, INSERT ON public.feature_requests FROM anon, authenticated;");
      expect(sql).toContain("REVOKE INSERT ON public.contact_messages FROM anon, authenticated;");
      expect(sql).toContain("REVOKE INSERT ON public.newsletter_subscribers FROM anon, authenticated;");
      expect(sql).toContain('DROP POLICY IF EXISTS "promo_codes_auth_select_active" ON public.promo_codes;');
      expect(sql).toContain("FROM public.flashcard_sets s");
      expect(sql).toContain("audit_logs_admin_select");
      expect(sql).toContain("storage_cms_media_admin_write");
    });
  });
});
