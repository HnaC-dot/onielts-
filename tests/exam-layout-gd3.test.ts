import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import type { AuthState } from "@/lib/auth";
import type { IeltsTest, QuestionGroup, SessionUser, TestSection } from "@/lib/types";
import type { GradedTestResult } from "@/lib/test-grader";
import {
  buildDraftStorageKey,
  buildModeKey,
  clampSplitRatio,
  computeSubsetGradingSummary,
  DEFAULT_SPLIT_RATIO,
  inferRelevantPassageForGroup,
  MAX_SPLIT_RATIO,
  mergeDraftSnapshots,
  MIN_SPLIT_RATIO,
  parsePracticeModeQuery,
  type ExamDraftPayload,
} from "@/lib/exam-session";
import { resetInMemoryRateLimitForTests } from "@/lib/rate-limit";
import { updateStore } from "@/lib/store";
import { FULL_SEED_TESTS } from "@/lib/seed-tests";

const mockGetAuthState = vi.fn<() => Promise<AuthState>>();

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getAuthState: () => mockGetAuthState(),
    getCurrentUser: async () => (await mockGetAuthState()).user,
  };
});

import { DELETE, GET, PUT } from "@/app/api/tests/draft/route";

function makeLearner(id: string): SessionUser {
  return {
    id,
    email: `${id}@onielts.vn`,
    full_name: `Learner ${id}`,
    avatar_url: null,
    role: "learner",
    is_locked: false,
    target_band: 7.5,
    current_band: 6.5,
    streak_count: 1,
    last_active_date: "2026-11-27",
    premium_expires_at: null,
    referral_code: "GD3TEST",
    referred_by: null,
    email_verified: true,
    locale: "vi",
    created_at: "2026-01-01T00:00:00.000Z",
    isPremium: false,
    authMode: "demo",
  };
}

function setAuthUser(user: SessionUser | null) {
  if (!user) {
    mockGetAuthState.mockResolvedValue({
      status: "unauthenticated",
      user: null,
      authUserId: null,
      errorCode: null,
      errorMessage: null,
    });
    return;
  }
  mockGetAuthState.mockResolvedValue({
    status: "authenticated",
    user,
    authUserId: user.id,
    errorCode: null,
    errorMessage: null,
  });
}

describe("Exam Upgrade GĐ3 — Layout, Practice Modes, Passage Filtering & Auto-Save Drafts", () => {
  const root = process.cwd();

  describe("1. Split-pane ratio & draft key helpers", () => {
    it("clamps desktop split ratio safely within [28, 72] and handles non-finite values", () => {
      expect(clampSplitRatio(10)).toBe(MIN_SPLIT_RATIO);
      expect(clampSplitRatio(95)).toBe(MAX_SPLIT_RATIO);
      expect(clampSplitRatio(48.34)).toBe(48.3);
      expect(clampSplitRatio(Number.NaN)).toBe(DEFAULT_SPLIT_RATIO);
      expect(clampSplitRatio(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SPLIT_RATIO);
    });

    it("builds isolated mode keys and localStorage keys for full, part, and group modes", () => {
      expect(buildModeKey("full")).toBe("full");
      expect(buildModeKey("part", 2)).toBe("part:2");
      expect(buildModeKey("part", -5)).toBe("part:0");
      expect(buildModeKey("group", 0, "sec1-group-2")).toBe("group:sec1-group-2");
      expect(buildDraftStorageKey("reading-test-1", "part:1")).toBe(
        "onielts_exam_draft_v1:reading-test-1:part:1"
      );
    });

    it("merges local and remote drafts preferring the latest timestamp and ignoring empty drafts", () => {
      const base: ExamDraftPayload = {
        testSlug: "reading-test-1",
        modeKey: "full",
        answers: { q1: "TRUE" },
        flagged: {},
        annotations: [],
        notesText: "",
        timerSeconds: 3000,
        activeSectionIdx: 0,
        updatedAt: "2026-11-27T10:00:00.000Z",
      };
      const newerRemote: ExamDraftPayload = {
        ...base,
        answers: { q1: "TRUE", q2: "FALSE" },
        notesText: "Remote note",
        updatedAt: "2026-11-27T10:05:00.000Z",
      };
      const emptyDraft: ExamDraftPayload = {
        ...base,
        answers: {},
        updatedAt: "2026-11-27T12:00:00.000Z",
      };

      expect(mergeDraftSnapshots(base, newerRemote)).toMatchObject({
        answers: { q1: "TRUE", q2: "FALSE" },
        notesText: "Remote note",
      });
      expect(mergeDraftSnapshots(emptyDraft, base)).toMatchObject({
        answers: { q1: "TRUE" },
      });
      expect(mergeDraftSnapshots(emptyDraft, null)).toBeNull();
    });
  });

  describe("2. Relevant passage resolution & subset practice grading", () => {
    const sampleSection: TestSection = {
      id: "sec-1",
      title: "Passage 1",
      passage: [
        "Paragraph A: Early solar observatories were established on mountain ridges.",
        "Paragraph B: Engineers discovered that mirror coatings degraded under dust storms.",
        "Paragraph C: In 1994, a new ceramic composite doubled telescope durability.",
        "Paragraph D: Modern observatories combine optical and infrared sensors.",
      ].join("\n\n"),
      questions: [
        {
          id: "q1",
          number: 1,
          type: "tfng",
          prompt: "In Paragraph B, mirror coatings were damaged by dust.",
          correctAnswers: [],
          sectionRef: "Paragraph D", // Must NEVER be used by client filter
          explanation_vi: "",
          explanation_en: "",
        },
        {
          id: "q2",
          number: 2,
          type: "tfng",
          prompt: "Paragraph C states the composite was introduced in 1994.",
          correctAnswers: [],
          sectionRef: "Paragraph A", // Must NEVER be used by client filter
          explanation_vi: "",
          explanation_en: "",
        },
      ],
    };

    it("uses explicit group.passageRange first when authored", () => {
      const group: QuestionGroup = {
        id: "g-explicit",
        type: "tfng",
        questionRange: { start: 1, end: 2 },
        questionIds: ["q1", "q2"],
        instruction: "Choose TRUE, FALSE or NOT GIVEN.",
        passageRange: { startParagraph: 0, endParagraph: 1 },
      };
      const resolved = inferRelevantPassageForGroup(
        sampleSection,
        group,
        sampleSection.questions
      );
      expect(resolved.isFiltered).toBe(true);
      expect(resolved.inferredFrom).toBe("explicit");
      expect(resolved.paragraphs.map((p) => p.index)).toEqual([0, 1]);
      expect(resolved.totalParagraphs).toBe(4);
    });

    it("infers relevant paragraphs strictly from visible prompt text and NEVER from sectionRef", () => {
      const group: QuestionGroup = {
        id: "g-prompt",
        type: "tfng",
        questionRange: { start: 1, end: 2 },
        questionIds: ["q1", "q2"],
        instruction: "Choose TRUE, FALSE or NOT GIVEN.",
      };
      const resolved = inferRelevantPassageForGroup(
        sampleSection,
        group,
        sampleSection.questions
      );
      expect(resolved.isFiltered).toBe(true);
      expect(resolved.inferredFrom).toBe("prompt");
      // Strictly B (index 1) and C (index 2) from prompts — NOT D/A from sectionRef
      expect(resolved.paragraphs.map((p) => p.index)).toEqual([1, 2]);
    });

    it("falls back to full passage when neither passageRange nor prompt paragraph mentions exist", () => {
      const neutralQuestions = sampleSection.questions.map((q) => ({
        ...q,
        prompt: "General statement without paragraph label.",
      }));
      const group: QuestionGroup = {
        id: "g-none",
        type: "tfng",
        questionRange: { start: 1, end: 2 },
        questionIds: ["q1", "q2"],
        instruction: "Choose TRUE, FALSE or NOT GIVEN.",
      };
      const resolved = inferRelevantPassageForGroup(
        sampleSection,
        group,
        neutralQuestions
      );
      expect(resolved.isFiltered).toBe(false);
      expect(resolved.inferredFrom).toBe("none");
      expect(resolved.paragraphs.length).toBe(4);
    });

    it("computes accurate subset score & breakdown for Part/Group practice", () => {
      const mockGraded: GradedTestResult = {
        rawScore: 2,
        maxScore: 40,
        bandScore: 2.0,
        isFullIeltsTest: true,
        accuracyPercent: 5,
        breakdownByType: {
          tfng: { correct: 2, total: 10 },
          mcq: { correct: 0, total: 30 },
        },
        details: [
          {
            questionId: "q1",
            number: 1,
            type: "tfng",
            userAnswer: "TRUE",
            acceptedAnswers: ["TRUE"],
            isCorrect: true,
            explanation_vi: "",
            explanation_en: "",
          },
          {
            questionId: "q2",
            number: 2,
            type: "tfng",
            userAnswer: "FALSE",
            acceptedAnswers: ["TRUE"],
            isCorrect: false,
            explanation_vi: "",
            explanation_en: "",
          },
          {
            questionId: "q3",
            number: 3,
            type: "tfng",
            userAnswer: "NOT GIVEN",
            acceptedAnswers: ["NOT GIVEN"],
            isCorrect: true,
            explanation_vi: "",
            explanation_en: "",
          },
          {
            questionId: "q4",
            number: 4,
            type: "mcq",
            userAnswer: "",
            acceptedAnswers: ["A"],
            isCorrect: false,
            explanation_vi: "",
            explanation_en: "",
          },
        ],
      };

      const subset = computeSubsetGradingSummary(mockGraded, ["q1", "q2", "q3"]);
      expect(subset.rawScore).toBe(2);
      expect(subset.maxScore).toBe(3);
      expect(subset.accuracyPercent).toBe(67);
      expect(subset.breakdownByType).toEqual({
        tfng: { correct: 2, total: 3 },
      });
    });

    it("resolves URL query params (?mode=part&part=2 / ?mode=group&group=...) safely", () => {
      const readingTest = FULL_SEED_TESTS.find(
        (t) => t.skill === "reading"
      ) as IeltsTest;
      expect(readingTest).toBeTruthy();

      expect(parsePracticeModeQuery({ mode: "part", part: "2" }, readingTest)).toEqual({
        practiceMode: "part",
        sectionIdx: 1,
        groupId: undefined,
      });

      const grp = parsePracticeModeQuery({ mode: "group" }, readingTest);
      expect(grp.practiceMode).toBe("group");
      expect(grp.sectionIdx).toBe(0);
      expect(grp.groupId).toBeTruthy();

      // Out-of-bounds part falls back safely to 0
      expect(parsePracticeModeQuery({ mode: "part", part: "99" }, readingTest)).toEqual({
        practiceMode: "part",
        sectionIdx: 0,
        groupId: undefined,
      });
    });
  });

  describe("3. /api/tests/draft HTTP Route (Auth, CSRF, Validation, Persistence, Isolation)", () => {
    const TEST_SLUG = "gd3-draft-route-test";

    beforeEach(() => {
      resetInMemoryRateLimitForTests();
      updateStore((s) => {
        s.test_session_drafts = (s.test_session_drafts ?? []).filter(
          (d) => d.testSlug !== TEST_SLUG
        );
      });
    });

    afterEach(() => {
      updateStore((s) => {
        s.test_session_drafts = (s.test_session_drafts ?? []).filter(
          (d) => d.testSlug !== TEST_SLUG
        );
      });
    });

    it("returns graceful null draft with no-store header for unauthenticated GET", async () => {
      setAuthUser(null);
      const req = new Request(
        `http://localhost:3000/api/tests/draft?testSlug=${TEST_SLUG}&modeKey=full`
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toContain("no-store");
      const json = await res.json();
      expect(json).toMatchObject({
        ok: true,
        authenticated: false,
        draft: null,
      });
    });

    it("rejects cross-origin CSRF on PUT and unauthenticated PUT", async () => {
      setAuthUser(makeLearner("gd3-learner-a"));
      const csrfReq = new Request("http://localhost:3000/api/tests/draft", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          host: "localhost:3000",
          origin: "https://evil.example.com",
        },
        body: JSON.stringify({ testSlug: TEST_SLUG, modeKey: "full" }),
      });
      const csrfRes = await PUT(csrfReq);
      expect(csrfRes.status).toBe(403);

      setAuthUser(null);
      const unauthReq = new Request("http://localhost:3000/api/tests/draft", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ testSlug: TEST_SLUG, modeKey: "full" }),
      });
      const unauthRes = await PUT(unauthReq);
      expect(unauthRes.status).toBe(401);
    });

    it("persists, retrieves, isolates across users, and deletes drafts cleanly", async () => {
      const learnerA = makeLearner("gd3-learner-a");
      const learnerB = makeLearner("gd3-learner-b");
      setAuthUser(learnerA);

      // Invalid payload rejected
      const badReq = new Request("http://localhost:3000/api/tests/draft", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          testSlug: "INVALID SLUG!!",
          timerSeconds: -50,
        }),
      });
      expect((await PUT(badReq)).status).toBe(400);

      // Valid PUT for Learner A
      const putReq = new Request("http://localhost:3000/api/tests/draft", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          testSlug: TEST_SLUG,
          modeKey: "part:1",
          answers: { q14: "TRUE", q15: "solar" },
          flagged: { q15: true },
          annotations: [
            {
              id: "ann-1",
              sectionId: "sec-2",
              paragraphIndex: 0,
              startOffset: 10,
              endOffset: 24,
              text: "solar mirrors",
              color: "amber",
            },
          ],
          notesText: "Check paragraph B",
          timerSeconds: 425,
          activeSectionIdx: 1,
        }),
      });
      const putRes = await PUT(putReq);
      expect(putRes.status).toBe(200);
      expect(await putRes.json()).toMatchObject({ ok: true, saved: true });

      // Learner A reads own draft back
      const getARes = await GET(
        new Request(
          `http://localhost:3000/api/tests/draft?testSlug=${TEST_SLUG}&modeKey=part:1`
        )
      );
      expect(getARes.status).toBe(200);
      const getAJson = await getARes.json();
      expect(getAJson.draft).toMatchObject({
        testSlug: TEST_SLUG,
        modeKey: "part:1",
        answers: { q14: "TRUE", q15: "solar" },
        flagged: { q15: true },
        notesText: "Check paragraph B",
        timerSeconds: 425,
        activeSectionIdx: 1,
      });
      expect(getAJson.draft.annotations).toHaveLength(1);

      // Learner B cannot see Learner A's draft
      setAuthUser(learnerB);
      const getBRes = await GET(
        new Request(
          `http://localhost:3000/api/tests/draft?testSlug=${TEST_SLUG}&modeKey=part:1`
        )
      );
      expect((await getBRes.json()).draft).toBeNull();

      // Learner A deletes own draft
      setAuthUser(learnerA);
      const delRes = await DELETE(
        new Request(
          `http://localhost:3000/api/tests/draft?testSlug=${TEST_SLUG}&modeKey=part:1`,
          {
            method: "DELETE",
            headers: { origin: "http://localhost:3000" },
          }
        )
      );
      expect(delRes.status).toBe(200);

      const getAfterDel = await GET(
        new Request(
          `http://localhost:3000/api/tests/draft?testSlug=${TEST_SLUG}&modeKey=part:1`
        )
      );
      expect((await getAfterDel.json()).draft).toBeNull();
    });
  });

  describe("4. Migration 0010, next.config.ts, and TestEngineClient GĐ3 UI contracts", () => {
    it("verifies additive migration 0010 RLS rules and private no-store config", () => {
      const sql = fs.readFileSync(
        path.join(root, "supabase/migrations/0010_test_drafts_annotations.sql"),
        "utf8"
      );
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.test_session_drafts/i);
      expect(sql).toMatch(/ALTER TABLE public\.test_session_drafts ENABLE ROW LEVEL SECURITY/i);
      expect(sql).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);
      expect(sql).toMatch(/REVOKE ALL ON public\.test_session_drafts FROM PUBLIC,\s*anon/i);
      expect(sql).toMatch(/GRANT SELECT,\s*INSERT,\s*UPDATE,\s*DELETE ON public\.test_session_drafts TO authenticated/i);

      const nextCfg = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
      expect(nextCfg).toContain("/api/tests/draft");
    });

    it("implements GĐ3 split-pane, mobile tabs, Focus mode, practice modes, passage filter, and auto-save in TestEngineClient", () => {
      const engineSrc = fs.readFileSync(
        path.join(root, "src/components/test-engine-client.tsx"),
        "utf8"
      );

      // Resizable split-pane separator & keyboard controls
      expect(engineSrc).toContain('role="separator"');
      expect(engineSrc).toContain('aria-orientation="vertical"');
      expect(engineSrc).toContain("SPLIT_RATIO_STORAGE_KEY");
      expect(engineSrc).toContain("ArrowLeft");
      expect(engineSrc).toContain("ArrowRight");

      // Mobile 2-tab switcher with 44px touch targets
      expect(engineSrc).toContain("min-h-[44px]");
      expect(engineSrc).toContain("setMobilePane");

      // Focus mode
      expect(engineSrc).toContain("fixed inset-0 z-50");
      expect(engineSrc).toContain("requestFullscreen");

      // 3 Practice modes + count-up pause + subset grading
      expect(engineSrc).toContain("computeSubsetGradingSummary");
      expect(engineSrc).toContain("isTimerPaused");
      expect(engineSrc).toContain("practice-group-select");

      // Relevant passage banner & toggle
      expect(engineSrc).toContain("inferRelevantPassageForGroup");
      expect(engineSrc).toContain("Hiện toàn bộ đoạn văn");
      expect(engineSrc).toContain("Show full passage");

      // Auto-save + beforeunload warning
      expect(engineSrc).toContain("/api/tests/draft");
      expect(engineSrc).toContain("beforeunload");

      // Preserved legacy assertions
      expect(engineSrc).toContain('href="/progress"');
      expect(engineSrc).toContain('role="alert"');
      expect(engineSrc).toContain("submitError");
    });
  });
});
