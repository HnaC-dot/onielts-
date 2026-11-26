import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isAnswerCorrect,
  sanitizeTestForClient,
} from "@/lib/test-grader";
import {
  parseAcceptedAnswersInput,
  renumberTestSections,
  validateTestForPublish,
} from "@/lib/test-cms-shared";
import { detectAttemptAnomaly } from "@/lib/cms-daily-exam";
import type { IeltsTest, TestSection } from "@/lib/types";

function make40Sections(): TestSection[] {
  const qs = Array.from({ length: 40 }, (_, i) => ({
    id: `q-${i + 1}`,
    number: i + 1,
    type: "tfng" as const,
    prompt: `Statement number ${i + 1} about the reading passage.`,
    options: ["TRUE", "FALSE", "NOT GIVEN"],
    correctAnswers: ["TRUE"],
    explanation_vi: "Giải thích chi tiết bằng tiếng Việt.",
    explanation_en: "Detailed English explanation.",
    sectionRef: "Paragraph A",
  }));
  return [
    {
      id: "s1",
      title: "Passage 1",
      passage: "A long original academic passage ".repeat(15),
      questions: qs.slice(0, 13),
    },
    {
      id: "s2",
      title: "Passage 2",
      passage: "Another original academic passage ".repeat(15),
      questions: qs.slice(13, 26),
    },
    {
      id: "s3",
      title: "Passage 3",
      passage: "Final original academic passage ".repeat(15),
      questions: qs.slice(26, 40),
    },
  ];
}

describe("Admin CMS GĐ3 — 40Q Pre-Publish Validator, Answer Key Stripping, Multi-Answer & Daily Exam Moderation", () => {
  it("strips correctAnswers, explanations, and sectionRef before sending tests to client components", () => {
    const rawTest: IeltsTest = {
      id: "t1",
      slug: "reading-security-check",
      skill: "reading",
      module: "academic",
      title_vi: "Đề Reading kiểm tra bảo mật đáp án",
      title_en: "Reading Security Check",
      description_vi: "Mô tả",
      description_en: "Desc",
      duration_minutes: 60,
      difficulty: "band_6_7",
      questionCount: 40,
      is_published: true,
      sections: make40Sections(),
      created_at: new Date().toISOString(),
    };

    const clientSafe = sanitizeTestForClient(rawTest);
    const serialized = JSON.stringify(clientSafe);

    expect(clientSafe.sections[0].questions[0].correctAnswers).toEqual([]);
    expect(clientSafe.sections[0].questions[0].explanation_vi).toBe("");
    expect(clientSafe.sections[0].questions[0].explanation_en).toBe("");
    expect(clientSafe.sections[0].questions[0].sectionRef).toBeUndefined();
    expect(serialized).not.toContain("Giải thích chi tiết bằng tiếng Việt");
    expect(serialized).not.toContain("Paragraph A");

    // Ensure original object was not mutated
    expect(rawTest.sections[0].questions[0].correctAnswers).toEqual(["TRUE"]);
  });

  it("enforces sanitizeTestForClient on /tests/[slug], /daily-exam, and /api/daily-exam", () => {
    for (const rel of [
      "src/app/tests/[slug]/page.tsx",
      "src/app/daily-exam/page.tsx",
      "src/app/api/daily-exam/route.ts",
    ]) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), "utf-8");
      expect(src, `${rel} must call sanitizeTestForClient`).toContain(
        "sanitizeTestForClient"
      );
    }
  });

  it("supports multi-accepted answers (colour/color) and order-insensitive mcq_multi grading", () => {
    expect(parseAcceptedAnswersInput("colour / color | colours")).toEqual([
      "colour",
      "color",
      "colours",
    ]);
    expect(isAnswerCorrect("color", ["colour", "color"], "short_answer")).toBe(true);
    expect(isAnswerCorrect("COLOUR.", ["colour", "color"], "short_answer")).toBe(true);

    // mcq_multi: user selects C and A in any order, key is "A, C"
    expect(
      isAnswerCorrect("C. Solar roof, A. Electric bus", ["A, C"], "mcq_multi")
    ).toBe(true);
    expect(isAnswerCorrect("A, B", ["A, C"], "mcq_multi")).toBe(false);
  });

  it("passes 40Q automatic pre-publish validation on complete tests and blocks incomplete/duplicate/unanswered tests", () => {
    const validSections = make40Sections();
    const ok = validateTestForPublish({
      skill: "reading",
      sections: validSections,
    });
    expect(ok.canPublish).toBe(true);
    expect(ok.errors).toEqual([]);
    expect(ok.questionCount).toBe(40);

    // Incomplete (<40 questions)
    const shortSections = make40Sections();
    shortSections[2].questions.pop();
    const shortRes = validateTestForPublish({
      skill: "reading",
      sections: shortSections,
    });
    expect(shortRes.canPublish).toBe(false);
    expect(shortRes.questionCount).toBe(39);

    // Duplicate number & missing answer
    const brokenSections = make40Sections();
    brokenSections[0].questions[1].number = 1; // duplicate 1, missing 2
    brokenSections[0].questions[2].correctAnswers = [];
    const brokenRes = validateTestForPublish({
      skill: "reading",
      sections: brokenSections,
    });
    expect(brokenRes.canPublish).toBe(false);
    expect(brokenRes.duplicateNumbers).toContain(1);
    expect(brokenRes.missingNumbers).toContain(2);
    expect(brokenRes.missingAnswerNumbers).toContain(3);

    // One-click renumbering repairs duplicate/missing numbering
    const repaired = renumberTestSections(brokenSections);
    repaired[0].questions[2].correctAnswers = ["TRUE"];
    const fixedRes = validateTestForPublish({
      skill: "reading",
      sections: repaired,
    });
    expect(fixedRes.canPublish).toBe(true);
  });

  it("flags anomalous high-score/ultra-fast daily exam attempts for moderation", () => {
    expect(
      detectAttemptAnomaly({ raw_score: 10, duration_seconds: 12 }).isAnomalous
    ).toBe(true);
    expect(
      detectAttemptAnomaly({ raw_score: 9, duration_seconds: 30 }).isAnomalous
    ).toBe(true);
    expect(
      detectAttemptAnomaly({ raw_score: 9, duration_seconds: 420 }).isAnomalous
    ).toBe(false);
  });

  it("enforces requireStaff and verifySameOrigin CSRF checks on all GĐ3 Admin APIs", () => {
    for (const rel of [
      "src/app/api/admin/tests/route.ts",
      "src/app/api/admin/tests/[id]/route.ts",
      "src/app/api/admin/daily-exam/route.ts",
      "src/app/api/admin/daily-exam/attempts/[id]/route.ts",
      "src/app/api/admin/band-tables/route.ts",
    ]) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), "utf-8");
      expect(src, `${rel} missing requireStaff`).toContain("requireStaff");
      expect(src, `${rel} missing verifySameOrigin`).toContain("verifySameOrigin");
    }

    // Verify band-tables API requires admin role specifically (not editor)
    const bandRoute = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/admin/band-tables/route.ts"),
      "utf-8"
    );
    expect(bandRoute).toContain('requireStaff("admin")');
  });
});
