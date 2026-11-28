import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cmsTestFormSchema,
  convertSectionFlatToExplicitGroups,
  createQuestionGroupSkeleton,
  QUESTION_TYPE_CATALOG,
  renumberTestSections,
  syncSectionGroupsWithQuestions,
  validateTestForPublish,
} from "@/lib/test-cms-shared";
import {
  extractGroupBlankNumbers,
  getPassageParagraphsForGroup,
  normalizeSectionToGroups,
  splitPassageParagraphs,
} from "@/lib/test-groups";
import {
  gradeObjectiveTest,
  sanitizeTestForClient,
} from "@/lib/test-grader";
import { locateEvidenceParagraph } from "@/lib/exam-evidence";
import { DEFAULT_BAND_CONVERSIONS } from "@/lib/seed-data";
import type { IeltsTest, QuestionGroup, TestQuestion, TestSection } from "@/lib/types";

function makeUidFactory() {
  let seq = 0;
  return (prefix: string) => {
    seq += 1;
    return `${prefix}-${seq}`;
  };
}

function buildFull40GroupTest(): IeltsTest {
  const makeId = makeUidFactory();
  let cursor = 1;

  const addSpec = (
    type: Parameters<typeof createQuestionGroupSkeleton>[0],
    count: number,
    answerFn: (num: number, idx: number) => string[],
    promptFn?: (num: number) => string
  ) => {
    const { group, questions } = createQuestionGroupSkeleton(
      type,
      cursor,
      count,
      makeId
    );
    cursor += count;
    const filledQs: TestQuestion[] = questions.map((q, idx) => ({
      ...q,
      prompt: promptFn ? promptFn(q.number) : q.prompt,
      correctAnswers: answerFn(q.number, idx),
      explanation_vi: `Giải thích chi tiết cho câu ${q.number}.`,
      explanation_en: `Detailed explanation for Q${q.number}.`,
      sectionRef: "Paragraph B",
    }));
    return { group, questions: filledQs };
  };

  // Passage 1: 13Q (summary 4 + table 3 + flowchart 3 + note 3) — ALL relying on sharedContent {{n}} with empty q.prompt
  const p1Summary = addSpec(
    "summary_completion",
    4,
    (n) => [`word${n}`],
    () => ""
  );
  const p1Table = addSpec(
    "table_completion",
    3,
    (n) => [`cell${n}`],
    () => ""
  );
  const p1Flow = addSpec(
    "flowchart_completion",
    3,
    (n) => [`step${n}`],
    () => ""
  );
  const p1Notes = addSpec(
    "note_completion",
    3,
    (n) => [`note${n}`],
    () => ""
  );

  // Passage 2: 13Q (matching_headings 5 + mcq_multi 2 + matching_features 6) — relying on group answerBank & sharedPrompt
  const p2Headings = addSpec(
    "matching_headings",
    5,
    (_, i) => [["i", "ii", "iii", "iv", "v"][i]],
    (n) => `Paragraph ${String.fromCharCode(65 + (n % 5))}`
  );
  const p2Multi = addSpec(
    "mcq_multi",
    2,
    (_, i) => [i === 0 ? "B" : "D"],
    () => ""
  );
  const p2Features = addSpec(
    "matching_features",
    6,
    (_, i) => [["A", "B", "C", "D"][i % 4]],
    (n) => `Statement about researcher finding ${n}`
  );

  // Passage 3: 14Q (tfng 5 + ynng 5 + mcq 4)
  const p3Tfng = addSpec(
    "tfng",
    5,
    () => ["TRUE"],
    (n) => `Factual claim ${n} from the passage.`
  );
  const p3Ynng = addSpec(
    "ynng",
    5,
    () => ["YES"],
    (n) => `Author opinion statement ${n}.`
  );
  const p3Mcq = addSpec(
    "mcq",
    4,
    () => ["B"],
    (n) => `What is the main reason discussed in question ${n}?`
  );
  p3Mcq.questions = p3Mcq.questions.map((q) => ({
    ...q,
    options: ["A. Cost reduction", "B. Energy efficiency", "C. Local policy", "D. Public demand"],
  }));

  const makeSec = (
    id: string,
    title: string,
    parts: Array<{ group: QuestionGroup; questions: TestQuestion[] }>
  ): TestSection => ({
    id,
    title,
    passage:
      "Paragraph A\nFirst academic paragraph with detailed research background.\n\nParagraph B\nSecond paragraph explaining the exact evidence and key term word1 and cell5.\n\nParagraph C\nThird paragraph summarizing conclusions.",
    groups: parts.map((p) => p.group),
    questions: parts.flatMap((p) => p.questions),
  });

  const sections = [
    makeSec("sec-1", "Passage 1", [p1Summary, p1Table, p1Flow, p1Notes]),
    makeSec("sec-2", "Passage 2", [p2Headings, p2Multi, p2Features]),
    makeSec("sec-3", "Passage 3", [p3Tfng, p3Ynng, p3Mcq]),
  ];

  return {
    id: "gd6-group-test",
    slug: "gd6-cbt-group-test",
    skill: "reading",
    module: "academic",
    title_vi: "Đề Reading CBT theo Nhóm (GĐ6)",
    title_en: "Reading CBT Group Test (GĐ6)",
    description_vi: "Kiểm thử tích hợp toàn diện GĐ6.",
    description_en: "Full GĐ6 integration test.",
    duration_minutes: 60,
    difficulty: "band_6_7",
    questionCount: 40,
    is_published: false,
    sections,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("GĐ6 — Admin Group Builder, Live Preview & Strengthened Pre-Publish Validator", () => {
  it("creates valid QuestionGroup skeletons for all 15 IELTS question types", () => {
    const makeId = makeUidFactory();
    expect(QUESTION_TYPE_CATALOG).toHaveLength(15);

    for (const meta of QUESTION_TYPE_CATALOG) {
      const count = meta.value === "mcq_multi" ? 2 : 3;
      const { group, questions } = createQuestionGroupSkeleton(
        meta.value,
        1,
        count,
        makeId
      );

      expect(group.type).toBe(meta.value);
      expect(group.questionRange).toEqual({ start: 1, end: count });
      expect(group.questionIds).toHaveLength(count);
      expect(group.instruction?.trim().length).toBeGreaterThan(5);
      expect(questions).toHaveLength(count);
      expect(questions.every((q) => q.groupId === group.id)).toBe(true);

      if (
        meta.value === "summary_completion" ||
        meta.value === "table_completion" ||
        meta.value === "flowchart_completion" ||
        meta.value === "note_completion"
      ) {
        expect(group.sharedContent).toBeDefined();
        expect(extractGroupBlankNumbers(group)).toEqual([1, 2, 3]);
        expect(group.wordLimit).toBeDefined();
      }

      if (
        meta.value === "matching_headings" ||
        meta.value === "matching_info" ||
        meta.value === "matching_features" ||
        meta.value === "matching_sentence_endings" ||
        meta.value === "map_labelling" ||
        meta.value === "mcq_multi"
      ) {
        expect((group.answerBank ?? []).length).toBeGreaterThanOrEqual(4);
      }

      if (meta.value === "mcq_multi") {
        expect(group.maxSelections).toBe(2);
        expect(group.sharedPrompt?.trim().length).toBeGreaterThan(5);
      }
    }
  });

  it("converts legacy flat sections into explicit editable QuestionGroups cleanly without mutating the source", () => {
    const legacySection: TestSection = {
      id: "legacy-sec",
      title: "Passage 1",
      instruction: "Questions 1–4",
      passage: "Paragraph A\nBiogas text.\n\nParagraph B\nMore biogas text.",
      questions: [
        {
          id: "lq1",
          number: 1,
          type: "summary_completion",
          prompt:
            "Complete the summary (ONE WORD ONLY): Multilingualism — Children switch [Q1: ___] quickly while adults rely on [Q2: ___].",
          correctAnswers: ["codes"],
          explanation_vi: "Giải thích 1",
          explanation_en: "Exp 1",
        },
        {
          id: "lq2",
          number: 2,
          type: "summary_completion",
          prompt:
            "Complete the summary (ONE WORD ONLY): Multilingualism — Children switch [Q1: ___] quickly while adults rely on [Q2: ___].",
          correctAnswers: ["context"],
          explanation_vi: "Giải thích 2",
          explanation_en: "Exp 2",
        },
        {
          id: "lq3",
          number: 3,
          type: "flowchart_completion",
          prompt:
            "Flow-chart (ONE WORD ONLY): Biogas Process — Farm waste enters tank ↓ Methane collects in [Q3: ___] ↓ Gas flows to [Q4: ___].",
          correctAnswers: ["dome"],
          explanation_vi: "Giải thích 3",
          explanation_en: "Exp 3",
        },
        {
          id: "lq4",
          number: 4,
          type: "flowchart_completion",
          prompt:
            "Flow-chart (ONE WORD ONLY): Biogas Process — Farm waste enters tank ↓ Methane collects in [Q3: ___] ↓ Gas flows to [Q4: ___].",
          correctAnswers: ["stove"],
          explanation_vi: "Giải thích 4",
          explanation_en: "Exp 4",
        },
      ],
    };

    const converted = convertSectionFlatToExplicitGroups(legacySection);

    // Source legacy section remains untouched
    expect(legacySection.groups).toBeUndefined();
    expect(legacySection.questions[0].groupId).toBeUndefined();

    // Converted section has 2 clean explicit groups with deduplicated sharedContent
    expect(converted.groups).toHaveLength(2);
    const [sumGrp, flowGrp] = converted.groups!;
    expect(sumGrp.isAutoGenerated).toBeUndefined();
    expect(sumGrp.sharedContent?.kind).toBe("summary");
    expect(sumGrp.sharedContent?.text).toContain("{{1}}");
    expect(sumGrp.sharedContent?.text).toContain("{{2}}");
    expect(sumGrp.sharedContent?.text).not.toContain("[Q1:");
    expect(extractGroupBlankNumbers(sumGrp)).toEqual([1, 2]);

    expect(flowGrp.sharedContent?.kind).toBe("flowchart");
    expect(flowGrp.sharedContent?.flowchart?.steps).toHaveLength(3);
    expect(extractGroupBlankNumbers(flowGrp)).toEqual([3, 4]);

    // Sync drops removed question IDs cleanly
    const afterRemove = syncSectionGroupsWithQuestions({
      ...converted,
      questions: converted.questions.filter((q) => q.id !== "lq2"),
    });
    expect(afterRemove.groups?.[0].questionIds).toEqual(["lq1"]);
    expect(afterRemove.groups?.[0].questionRange).toEqual({ start: 1, end: 1 });
  });

  it("remaps {{n}} placeholders inside summary, table, flowchart, and notes when renumbering sections", () => {
    const makeId = makeUidFactory();
    const s1 = createQuestionGroupSkeleton("tfng", 1, 3, makeId);
    const s2Sum = createQuestionGroupSkeleton("summary_completion", 10, 2, makeId);
    const s2Tbl = createQuestionGroupSkeleton("table_completion", 12, 2, makeId);
    const s2Flow = createQuestionGroupSkeleton("flowchart_completion", 14, 2, makeId);
    const s2Notes = createQuestionGroupSkeleton("note_completion", 16, 2, makeId);

    const sections: TestSection[] = [
      {
        id: "sec-1",
        title: "Passage 1",
        groups: [s1.group],
        questions: s1.questions,
      },
      {
        id: "sec-2",
        title: "Passage 2",
        groups: [s2Sum.group, s2Tbl.group, s2Flow.group, s2Notes.group],
        questions: [
          ...s2Sum.questions,
          ...s2Tbl.questions,
          ...s2Flow.questions,
          ...s2Notes.questions,
        ],
      },
    ];

    const renumbered = renumberTestSections(sections);
    const sec2Groups = renumbered[1].groups!;

    // Numbers shifted from 10..17 -> 4..11
    expect(renumbered[1].questions.map((q) => q.number)).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(sec2Groups[0].questionRange).toEqual({ start: 4, end: 5 });
    expect(extractGroupBlankNumbers(sec2Groups[0])).toEqual([4, 5]);
    expect(extractGroupBlankNumbers(sec2Groups[1])).toEqual([6, 7]);
    expect(extractGroupBlankNumbers(sec2Groups[2])).toEqual([8, 9]);
    expect(extractGroupBlankNumbers(sec2Groups[3])).toEqual([10, 11]);
  });

  it("passes publish validation on a full 40Q group-based test and blocks unmatched/unanswered {{n}} placeholders", () => {
    const validTest = buildFull40GroupTest();
    const ok = validateTestForPublish(validTest);
    expect(ok.canPublish).toBe(true);
    expect(ok.errors).toEqual([]);
    expect(ok.unmatchedBlankNumbers).toEqual([]);
    expect(ok.questionCount).toBe(40);

    // 1. Orphan {{99}} in summary sharedContent -> blocked
    const withOrphan = structuredClone(validTest);
    withOrphan.sections[0].groups![0].sharedContent!.text += " Extra {{99}}.";
    const orphanRes = validateTestForPublish(withOrphan);
    expect(orphanRes.canPublish).toBe(false);
    expect(orphanRes.unmatchedBlankNumbers).toContain(99);
    expect(orphanRes.errors.some((e) => e.includes("{{99}}"))).toBe(true);

    // 2. {{2}} exists in sharedContent but Q2 has no answer -> blocked
    const withUnansweredBlank = structuredClone(validTest);
    withUnansweredBlank.sections[0].questions[1].correctAnswers = [];
    const unansweredRes = validateTestForPublish(withUnansweredBlank);
    expect(unansweredRes.canPublish).toBe(false);
    expect(unansweredRes.unmatchedBlankNumbers).toContain(2);
    expect(unansweredRes.missingAnswerNumbers).toContain(2);

    // 3. Member Q1 deleted from summary sharedContent (missing {{1}}) -> blocked
    const withMissingBlank = structuredClone(validTest);
    withMissingBlank.sections[0].groups![0].sharedContent!.text =
      "Only {{2}}, {{3}}, and {{4}} remain.";
    const missingBlankRes = validateTestForPublish(withMissingBlank);
    expect(missingBlankRes.canPublish).toBe(false);
    expect(missingBlankRes.unmatchedBlankNumbers).toContain(1);

    // 4. Empty answerBank text does not falsely satisfy matching_headings options
    const withEmptyBank = structuredClone(validTest);
    withEmptyBank.sections[1].groups![0].answerBank = [
      { id: "i", text: "" },
      { id: "ii", text: "" },
    ];
    const emptyBankRes = validateTestForPublish(withEmptyBank);
    expect(emptyBankRes.canPublish).toBe(false);

    // 5. Draft Zod schema accepts partial answerBank text so Admins can save drafts in progress
    const draftParse = cmsTestFormSchema.safeParse({
      slug: withEmptyBank.slug,
      skill: withEmptyBank.skill,
      module: withEmptyBank.module,
      title_vi: withEmptyBank.title_vi,
      title_en: withEmptyBank.title_en,
      description_vi: withEmptyBank.description_vi,
      description_en: withEmptyBank.description_en,
      duration_minutes: withEmptyBank.duration_minutes,
      difficulty: withEmptyBank.difficulty,
      is_published: false,
      is_daily_eligible: false,
      is_premium: false,
      seo_meta: {},
      sections: withEmptyBank.sections,
    });
    expect(draftParse.success).toBe(true);
  });

  it("supports full in-memory Live Preview workflow: sanitize -> grade (word limit, number-word, unordered mcq_multi) -> locate evidence", () => {
    const draft = buildFull40GroupTest();
    // Configure Q1 for number-word equivalence + maxWords: 1
    draft.sections[0].groups![0].allowNumberWordEquivalence = true;
    draft.sections[0].groups![0].wordLimit = {
      maxWords: 1,
      allowNumber: true,
      numberMode: "word_or_number",
    };
    draft.sections[0].groups![0].passageRange = { paragraphLabels: ["B"] };
    draft.sections[0].questions[0].correctAnswers = ["10"];
    draft.sections[0].questions[1].correctAnswers = ["solar"];

    // 1. Live Preview strips all answer keys before handing to TestEngineClient
    const sanitized = sanitizeTestForClient(draft);
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("Giải thích chi tiết cho câu 1");
    expect(sanitized.sections[0].questions[0].correctAnswers).toEqual([]);
    expect(sanitized.sections[0].questions[0].sectionRef).toBeUndefined();

    // 2. PassageRange filters cleanly in Group Practice mode
    const filtered = getPassageParagraphsForGroup(
      sanitized.sections[0].passage,
      sanitized.sections[0].groups![0].passageRange
    );
    expect(filtered.isFiltered).toBe(true);
    expect(filtered.paragraphs).toHaveLength(1);
    expect(filtered.paragraphs[0].label).toBe("B");

    // 3. In-memory grading grades number-word equivalence, word-limit enforcement & unordered mcq_multi
    const q1 = draft.sections[0].questions[0];
    const q2 = draft.sections[0].questions[1];
    const multiQs = draft.sections[1].questions.filter((q) => q.type === "mcq_multi");
    const graded = gradeObjectiveTest(
      draft,
      {
        [q1.id]: "ten", // matches "10" via allowNumberWordEquivalence
        [q2.id]: "solar power", // exceeds ONE WORD limit!
        [multiQs[0].id]: "D", // reversed order against keys ["B", "D"]
        [multiQs[1].id]: "B",
      },
      DEFAULT_BAND_CONVERSIONS
    );

    const d1 = graded.details.find((d) => d.questionId === q1.id)!;
    const d2 = graded.details.find((d) => d.questionId === q2.id)!;
    const dMulti1 = graded.details.find((d) => d.questionId === multiQs[0].id)!;
    const dMulti2 = graded.details.find((d) => d.questionId === multiQs[1].id)!;

    expect(d1.isCorrect).toBe(true);
    expect(d2.isCorrect).toBe(false);
    expect(d2.wordLimitExceeded).toBe(true);
    expect(dMulti1.isCorrect).toBe(true);
    expect(dMulti2.isCorrect).toBe(true);

    // 4. Post-submit "Xem đoạn chứa đáp án" resolves exact Paragraph B
    const paras = splitPassageParagraphs(draft.sections[0].passage);
    const evidence = locateEvidenceParagraph(paras, d1.sectionRef, d1.acceptedAnswers);
    expect(evidence?.paragraphIndex).toBe(1);
    expect(evidence?.label).toBe("Paragraph B");
  });

  it("wires Group Editor, Live Preview modal, and preview isolation cleanly across Admin & Exam Engine", () => {
    const builderSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/admin/test-builder-client.tsx"),
      "utf-8"
    );
    const previewSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/admin/test-live-preview-modal.tsx"),
      "utf-8"
    );
    const engineSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/test-engine-client.tsx"),
      "utf-8"
    );
    const groupEditorSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/admin/question-group-editor.tsx"),
      "utf-8"
    );

    expect(builderSrc).toContain("QuestionGroupEditor");
    expect(builderSrc).toContain("TestLivePreviewModal");
    expect(builderSrc).toContain("Soạn theo Nhóm (CBT)");
    expect(builderSrc).toContain("Danh sách từng câu (Cổ điển)");
    expect(builderSrc).toContain("Xem trước trực tiếp");

    expect(previewSrc).toContain("sanitizeTestForClient");
    expect(previewSrc).toContain("gradeObjectiveTest");
    expect(previewSrc).toContain("onPreviewSubmit");
    expect(previewSrc).not.toContain("/api/tests/submit");
    expect(previewSrc).not.toContain("/api/tests/draft");

    expect(engineSrc).toContain("onPreviewSubmit");
    expect(engineSrc).toContain("const isPreview = Boolean(onPreviewSubmit)");

    expect(groupEditorSrc).toContain("convertSectionFlatToExplicitGroups");
    expect(groupEditorSrc).toContain("createQuestionGroupSkeleton");
    expect(groupEditorSrc).toContain("allowNumberWordEquivalence");
    expect(groupEditorSrc).toContain("passageRange");
  });

  it("supports fill-in-the-blank Map/Diagram Labelling (0 options, word limit) in publish validation, auto-grouping, grading & UI", () => {
    const diagramQuestions = [
      {
        id: "dm-q9",
        number: 9,
        type: "map_labelling" as const,
        prompt:
          "Label the diagram (NO MORE THAN TWO WORDS) — Raising the hull of the Mary Rose: Stage 1 bolts attached to ___",
        correctAnswers: ["frame", "lifting frame"],
        explanation_vi: "Khung nâng gắn bằng bu-lông.",
        explanation_en: "Lifting frame attached via bolts.",
      },
      {
        id: "dm-q10",
        number: 10,
        type: "map_labelling" as const,
        prompt:
          "Label the diagram (NO MORE THAN TWO WORDS) — Raising the hull of the Mary Rose: Stage 1 lifted by ___",
        correctAnswers: ["hydraulic jacks"],
        explanation_vi: "Kích thủy lực nâng khung.",
        explanation_en: "Hydraulic jacks raise the frame.",
      },
      {
        id: "dm-q11",
        number: 11,
        type: "map_labelling" as const,
        prompt:
          "Label the diagram (NO MORE THAN TWO WORDS) — Raising the hull of the Mary Rose: Stage 2 guided by ___",
        correctAnswers: ["stabbing guides"],
        explanation_vi: "Thanh dẫn hướng định vị.",
        explanation_en: "Stabbing guides align the hull.",
      },
      {
        id: "dm-q12",
        number: 12,
        type: "map_labelling" as const,
        prompt:
          "Label the diagram (NO MORE THAN TWO WORDS) — Raising the hull of the Mary Rose: Stage 2 lowered into ___",
        correctAnswers: ["cradle", "lifting cradle"],
        explanation_vi: "Hạ xuống giá đỡ.",
        explanation_en: "Lowered into the cradle.",
      },
      {
        id: "dm-q13",
        number: 13,
        type: "map_labelling" as const,
        prompt:
          "Label the diagram (NO MORE THAN TWO WORDS) — Raising the hull of the Mary Rose: Stage 3 cushioned by ___",
        correctAnswers: ["air bags"],
        explanation_vi: "Đệm túi khí bảo vệ thân tàu.",
        explanation_en: "Air bags cushion the hull.",
      },
    ];

    const fillerQuestions = Array.from({ length: 35 }, (_, idx) => {
      const n = idx < 8 ? idx + 1 : idx + 6;
      return {
        id: `dm-q${n}`,
        number: n,
        type: "tfng" as const,
        prompt: `Statement ${n} about the Mary Rose excavation.`,
        options: ["TRUE", "FALSE", "NOT GIVEN"],
        correctAnswers: ["TRUE"],
        explanation_vi: "Giải thích chuẩn.",
        explanation_en: "Explanation.",
      };
    });

    const all40 = [...fillerQuestions.slice(0, 8), ...diagramQuestions, ...fillerQuestions.slice(8)];
    const section: TestSection = {
      id: "sec-mary-rose",
      title: "Passage 1: Raising the Mary Rose",
      passage: "A The Mary Rose was raised using a lifting frame, hydraulic jacks, stabbing guides, a cradle, and air bags. ".repeat(4),
      questions: all40,
    };

    // 1. Publish validator MUST allow 0-option completion Diagram Labelling
    const report = validateTestForPublish({
      skill: "reading",
      sections: [section],
    });
    expect(report.canPublish).toBe(true);
    expect(report.errors).toEqual([]);

    // 2. Broken single-option map_labelling MUST still be rejected
    const brokenSingleOpt = structuredClone(section);
    brokenSingleOpt.questions[8].options = ["A"];
    const brokenReport = validateTestForPublish({
      skill: "reading",
      sections: [brokenSingleOpt],
    });
    expect(brokenReport.canPublish).toBe(false);

    // 3. Auto-grouping detects NO MORE THAN TWO WORDS & builds completion instruction
    const groups = normalizeSectionToGroups(section);
    const diagGroup = groups.find((g) => g.type === "map_labelling")!;
    expect(diagGroup).toBeDefined();
    expect(diagGroup.wordLimit).toEqual({
      maxWords: 2,
      allowNumber: false,
      numberMode: "word_only",
    });
    expect(diagGroup.instruction).toContain("TWO WORDS");

    // 4. Server grader accepts both variants & enforces NO MORE THAN TWO WORDS
    const testObj: IeltsTest = {
      id: "mary-rose-test",
      slug: "mary-rose-test",
      skill: "reading",
      module: "academic",
      title_vi: "Raising the Mary Rose",
      title_en: "Raising the Mary Rose",
      description_vi: "Reading diagram labelling test",
      description_en: "Reading diagram labelling test",
      duration_minutes: 60,
      difficulty: "band_6_7",
      questionCount: 40,
      is_published: true,
      created_at: "2026-01-01T00:00:00.000Z",
      sections: [section],
    };

    const graded = gradeObjectiveTest(
      testObj,
      {
        "dm-q9": "lifting frame",
        "dm-q10": "hydraulic jacks",
        "dm-q11": "steel stabbing guides", // 3 words -> exceeds NO MORE THAN TWO WORDS
        "dm-q12": "cradle",
        "dm-q13": "air bags",
      },
      DEFAULT_BAND_CONVERSIONS
    );

    expect(graded.details.find((d) => d.questionId === "dm-q9")?.isCorrect).toBe(true);
    expect(graded.details.find((d) => d.questionId === "dm-q10")?.isCorrect).toBe(true);
    expect(graded.details.find((d) => d.questionId === "dm-q11")?.isCorrect).toBe(false);
    expect(graded.details.find((d) => d.questionId === "dm-q11")?.wordLimitExceeded).toBe(true);
    expect(graded.details.find((d) => d.questionId === "dm-q12")?.isCorrect).toBe(true);
    expect(graded.details.find((d) => d.questionId === "dm-q13")?.isCorrect).toBe(true);

    // 5. QuestionGroupRenderer gates radio choices on isChoiceMapLabelling
    const rendererSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/exam/question-group-renderer.tsx"),
      "utf-8"
    );
    expect(rendererSrc).toContain("isChoiceMapLabelling");
  });
});
