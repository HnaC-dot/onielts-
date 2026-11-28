"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Crown,
  ExternalLink,
  Eye,
  FileAudio,
  FileJson,
  Image as ImageIcon,
  Layers,
  List,
  ListOrdered,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  IeltsSkill,
  IeltsTest,
  QuestionGroup,
  QuestionType,
  SeoMeta,
  TestQuestion,
  TestSection,
} from "@/lib/types";
import {
  cmsTestFormSchema,
  createQuestionGroupSkeleton,
  formatAcceptedAnswersInput,
  OPTION_TYPES_SET,
  parseAcceptedAnswersInput,
  QUESTION_TYPE_CATALOG,
  renumberTestSections,
  syncSectionGroupsWithQuestions,
  validateTestForPublish,
} from "@/lib/test-cms-shared";
import { slugifyVi } from "@/lib/seo";
import { escapeHtml } from "@/lib/sanitize";
import { splitPassageParagraphs } from "@/lib/test-groups";
import { auditHeadingStructure } from "@/lib/heading-typography";
import { SeoPanel } from "./seo-panel";
import { MediaPickerModal } from "./media-picker-modal";
import { ConfirmDialog } from "./confirm-dialog";
import { QuestionGroupEditor } from "./question-group-editor";
import { RichTextEditor } from "./rich-text-editor";
import { TestLivePreviewModal } from "./test-live-preview-modal";
import { useAdminToast } from "./toast-provider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PASSAGE_HTML_RE = /<(?:p|div|h[1-6]|blockquote|li|br|ul|ol|strong|em|b|i)\b/i;

function plainPassageToHtml(raw: string): string {
  if (!raw.trim()) return "";
  if (PASSAGE_HTML_RE.test(raw)) return raw;
  return raw
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

interface TestBuilderClientProps {
  initialTest?: IeltsTest | null;
}

let clientUidSeq = 0;
function nextClientId(prefix: string): string {
  clientUidSeq += 1;
  return `${prefix}-${clientUidSeq}`;
}

function makeEmptyQuestion(num: number, type: QuestionType = "tfng"): TestQuestion {
  const meta = QUESTION_TYPE_CATALOG.find((t) => t.value === type);
  return {
    id: nextClientId(`q${num}`),
    number: num,
    type,
    prompt: "",
    options: meta?.defaultOptions ? [...meta.defaultOptions] : undefined,
    correctAnswers: [],
    explanation_vi: "",
    explanation_en: "",
    sectionRef: "",
  };
}

function makeDefaultSections(skill: IeltsSkill): TestSection[] {
  if (skill === "listening") {
    return [
      {
        id: nextClientId("sec-l1"),
        title: "Part 1: Everyday Conversation",
        instruction: "Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.",
        audioUrl: "",
        audioScript: "",
        questions: [],
      },
    ];
  }
  if (skill === "reading") {
    return [
      {
        id: nextClientId("sec-r1"),
        title: "Passage 1",
        instruction: "Read the passage and answer the questions below.",
        passage: "",
        questions: [],
      },
    ];
  }
  return [];
}

function buildStandard40Skeleton(skill: "reading" | "listening"): TestSection[] {
  const plan: Array<{ title: string; specs: Array<{ type: QuestionType; count: number }> }> =
    skill === "reading"
      ? [
          {
            title: "Passage 1",
            specs: [
              { type: "tfng", count: 5 },
              { type: "summary_completion", count: 4 },
              { type: "mcq", count: 4 },
            ],
          },
          {
            title: "Passage 2",
            specs: [
              { type: "matching_headings", count: 5 },
              { type: "note_completion", count: 4 },
              { type: "tfng", count: 4 },
            ],
          },
          {
            title: "Passage 3",
            specs: [
              { type: "ynng", count: 5 },
              { type: "matching_features", count: 5 },
              { type: "summary_completion", count: 4 },
            ],
          },
        ]
      : [
          {
            title: "Part 1",
            specs: [{ type: "note_completion", count: 10 }],
          },
          {
            title: "Part 2",
            specs: [
              { type: "mcq", count: 5 },
              { type: "map_labelling", count: 5 },
            ],
          },
          {
            title: "Part 3",
            specs: [
              { type: "mcq", count: 6 },
              { type: "mcq_multi", count: 2 },
              { type: "mcq_multi", count: 2 },
            ],
          },
          {
            title: "Part 4",
            specs: [{ type: "note_completion", count: 10 }],
          },
        ];

  let qNum = 1;
  return plan.map((part, sIdx) => {
    const startNum = qNum;
    const groups: QuestionGroup[] = [];
    const questions: TestQuestion[] = [];

    for (const spec of part.specs) {
      const created = createQuestionGroupSkeleton(
        spec.type,
        qNum,
        spec.count,
        nextClientId
      );
      groups.push(created.group);
      questions.push(...created.questions);
      qNum += spec.count;
    }

    return {
      id: nextClientId(`skel-${skill}-s${sIdx + 1}`),
      title: part.title,
      instruction:
        skill === "reading"
          ? `Questions ${startNum}–${qNum - 1}`
          : `Listen carefully and answer Questions ${startNum}–${qNum - 1}.`,
      passage: skill === "reading" ? "" : undefined,
      audioUrl: skill === "listening" ? "" : undefined,
      audioScript: skill === "listening" ? "" : undefined,
      groups,
      questions,
    };
  });
}

export function TestBuilderClient({ initialTest }: TestBuilderClientProps) {
  const router = useRouter();
  const toast = useAdminToast();
  const isEdit = Boolean(initialTest);
  const draftKey = `onielts_cms_test_draft_${initialTest?.id ?? "new"}`;

  const [skill, setSkill] = useState<IeltsSkill>(initialTest?.skill ?? "reading");
  const [mod, setMod] = useState<"academic" | "general">(
    initialTest?.module ?? "academic"
  );
  const [titleVi, setTitleVi] = useState(initialTest?.title_vi ?? "");
  const [titleEn, setTitleEn] = useState(initialTest?.title_en ?? "");
  const [slug, setSlug] = useState(initialTest?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialTest));
  const [descriptionVi, setDescriptionVi] = useState(
    initialTest?.description_vi ?? ""
  );
  const [descriptionEn, setDescriptionEn] = useState(
    initialTest?.description_en ?? ""
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initialTest?.duration_minutes ?? 60
  );
  const [difficulty, setDifficulty] = useState<
    "band_5_6" | "band_6_7" | "band_7_plus"
  >(initialTest?.difficulty ?? "band_6_7");
  const [isDailyEligible, setIsDailyEligible] = useState(
    Boolean(initialTest?.is_daily_eligible)
  );
  const [isPremium, setIsPremium] = useState(Boolean(initialTest?.is_premium));
  const [isPublished, setIsPublished] = useState(
    Boolean(initialTest?.is_published)
  );
  const [seoMeta, setSeoMeta] = useState<SeoMeta>(initialTest?.seo_meta ?? {});

  const [sections, setSections] = useState<TestSection[]>(
    initialTest?.sections ?? makeDefaultSections("reading")
  );
  const [activeSecIdx, setActiveSecIdx] = useState(0);
  const [expandedQIds, setExpandedQIds] = useState<Record<string, boolean>>({});
  const [newQType, setNewQType] = useState<QuestionType>("tfng");

  // Writing prompt state
  const [writingTaskType, setWritingTaskType] = useState<
    "academic_t1" | "general_t1" | "task_2"
  >(initialTest?.writingPrompt?.taskType ?? "task_2");
  const [writingPromptText, setWritingPromptText] = useState(
    initialTest?.writingPrompt?.prompt ?? ""
  );
  const [writingMinWords, setWritingMinWords] = useState(
    initialTest?.writingPrompt?.minWords ?? 250
  );
  const [writingChartSummary, setWritingChartSummary] = useState(
    initialTest?.writingPrompt?.chartSummary ?? ""
  );

  // Speaking prompts state
  const [speakingP1Text, setSpeakingP1Text] = useState(
    (initialTest?.speakingPrompts?.part1 ?? []).join("\n")
  );
  const [speakingP2Topic, setSpeakingP2Topic] = useState(
    initialTest?.speakingPrompts?.part2?.topic ?? ""
  );
  const [speakingP2BulletsText, setSpeakingP2BulletsText] = useState(
    (initialTest?.speakingPrompts?.part2?.bullets ?? []).join("\n")
  );
  const [speakingP3Text, setSpeakingP3Text] = useState(
    (initialTest?.speakingPrompts?.part3 ?? []).join("\n")
  );

  // Modals & UI helpers
  const [questionEditorMode, setQuestionEditorMode] = useState<"group" | "flat">(() => {
    if (!initialTest) return "group";
    const hasExplicitGroups = initialTest.sections?.some(
      (s) => Array.isArray(s.groups) && s.groups.length > 0
    );
    return hasExplicitGroups ? "group" : "flat";
  });
  const [livePreviewOpen, setLivePreviewOpen] = useState(false);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [diagramPickerOpen, setDiagramPickerOpen] = useState(false);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [passageModeBySecId, setPassageModeBySecId] = useState<
    Record<string, "plain" | "rich">
  >({});
  const [publishHeadingWarnings, setPublishHeadingWarnings] = useState<string[] | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  const [restorableDraft, setRestorableDraft] = useState<Record<
    string,
    unknown
  > | null>(null);

  const isObjective = skill === "reading" || skill === "listening";
  const safeSecIdx = Math.min(activeSecIdx, Math.max(0, sections.length - 1));
  const currentSec = sections[safeSecIdx] ?? null;

  const nextQuestionNumber = useMemo(() => {
    let maxNum = 0;
    for (const sec of sections) {
      for (const q of sec.questions) {
        if (q.number > maxNum) maxNum = q.number;
      }
    }
    return maxNum + 1;
  }, [sections]);

  const livePreviewDraftTest = useMemo<IeltsTest>(
    () => ({
      id: initialTest?.id ?? "admin-live-preview",
      slug: slug || slugifyVi(titleVi) || "admin-live-preview",
      skill,
      module: mod,
      title_vi: titleVi || "Bản xem trước Đề thi IELTS",
      title_en: titleEn || titleVi || "IELTS Test Live Preview",
      description_vi: descriptionVi,
      description_en: descriptionEn || descriptionVi,
      duration_minutes: durationMinutes,
      difficulty,
      questionCount: sections.reduce((sum, s) => sum + s.questions.length, 0),
      is_published: isPublished,
      is_daily_eligible: isDailyEligible,
      is_premium: isPremium,
      seo_meta: seoMeta,
      sections,
      created_at: initialTest?.created_at ?? "2026-01-01T00:00:00.000Z",
    }),
    [
      initialTest?.id,
      initialTest?.created_at,
      slug,
      titleVi,
      titleEn,
      skill,
      mod,
      descriptionVi,
      descriptionEn,
      durationMinutes,
      difficulty,
      sections,
      isPublished,
      isDailyEligible,
      isPremium,
      seoMeta,
    ]
  );

  // Live pre-publish audit report
  const validationReport = useMemo(
    () =>
      validateTestForPublish({
        skill,
        sections,
        writingPrompt:
          skill === "writing"
            ? {
                taskType: writingTaskType,
                prompt: writingPromptText,
                minWords: writingMinWords,
                chartSummary: writingChartSummary || undefined,
              }
            : undefined,
        speakingPrompts:
          skill === "speaking"
            ? {
                part1: speakingP1Text
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                part2: {
                  topic: speakingP2Topic,
                  bullets: speakingP2BulletsText
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
                part3: speakingP3Text
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : undefined,
      }),
    [
      skill,
      sections,
      writingTaskType,
      writingPromptText,
      writingMinWords,
      writingChartSummary,
      speakingP1Text,
      speakingP2Topic,
      speakingP2BulletsText,
      speakingP3Text,
    ]
  );

  // Restore localStorage draft check on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.savedAt) {
          queueMicrotask(() => setRestorableDraft(parsed));
        }
      }
    } catch {
      // ignore
    }
  }, [draftKey]);

  // Warn before closing tab with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [isDirty]);

  // Debounced auto-save draft to localStorage
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({
            skill,
            mod,
            titleVi,
            titleEn,
            slug,
            descriptionVi,
            descriptionEn,
            durationMinutes,
            difficulty,
            isDailyEligible,
            isPremium,
            seoMeta,
            sections,
            writingTaskType,
            writingPromptText,
            writingMinWords,
            writingChartSummary,
            speakingP1Text,
            speakingP2Topic,
            speakingP2BulletsText,
            speakingP3Text,
            savedAt: new Date().toISOString(),
          })
        );
        setAutoSavedAt(
          new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch {
        // ignore quota errors
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, [
    draftKey,
    skill,
    mod,
    titleVi,
    titleEn,
    slug,
    descriptionVi,
    descriptionEn,
    durationMinutes,
    difficulty,
    isDailyEligible,
    isPremium,
    seoMeta,
    sections,
    writingTaskType,
    writingPromptText,
    writingMinWords,
    writingChartSummary,
    speakingP1Text,
    speakingP2Topic,
    speakingP2BulletsText,
    speakingP3Text,
  ]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const restoreDraft = () => {
    if (!restorableDraft) return;
    setSkill((restorableDraft.skill as IeltsSkill) ?? "reading");
    setMod((restorableDraft.mod as "academic" | "general") ?? "academic");
    setTitleVi(String(restorableDraft.titleVi ?? ""));
    setTitleEn(String(restorableDraft.titleEn ?? ""));
    setSlug(String(restorableDraft.slug ?? ""));
    setDescriptionVi(String(restorableDraft.descriptionVi ?? ""));
    setDescriptionEn(String(restorableDraft.descriptionEn ?? ""));
    setDurationMinutes(Number(restorableDraft.durationMinutes ?? 60));
    setDifficulty(
      (restorableDraft.difficulty as "band_5_6" | "band_6_7" | "band_7_plus") ??
        "band_6_7"
    );
    setIsDailyEligible(Boolean(restorableDraft.isDailyEligible));
    setIsPremium(Boolean(restorableDraft.isPremium));
    setSeoMeta((restorableDraft.seoMeta as SeoMeta) ?? {});
    if (Array.isArray(restorableDraft.sections)) {
      setSections(restorableDraft.sections as TestSection[]);
    }
    setWritingTaskType(
      (restorableDraft.writingTaskType as "academic_t1" | "general_t1" | "task_2") ??
        "task_2"
    );
    setWritingPromptText(String(restorableDraft.writingPromptText ?? ""));
    setWritingMinWords(Number(restorableDraft.writingMinWords ?? 250));
    setWritingChartSummary(String(restorableDraft.writingChartSummary ?? ""));
    setSpeakingP1Text(String(restorableDraft.speakingP1Text ?? ""));
    setSpeakingP2Topic(String(restorableDraft.speakingP2Topic ?? ""));
    setSpeakingP2BulletsText(String(restorableDraft.speakingP2BulletsText ?? ""));
    setSpeakingP3Text(String(restorableDraft.speakingP3Text ?? ""));
    setRestorableDraft(null);
    setIsDirty(true);
    toast.info("Đã khôi phục bản nháp đề thi tự lưu.");
  };

  const updateCurrentSection = (patch: Partial<TestSection>) => {
    setSections((prev) =>
      prev.map((sec, idx) => (idx === safeSecIdx ? { ...sec, ...patch } : sec))
    );
    markDirty();
  };

  const addSection = () => {
    const nextNum = sections.length + 1;
    const newSec: TestSection = {
      id: nextClientId(`sec-${nextNum}`),
      title: skill === "listening" ? `Part ${nextNum}` : `Passage ${nextNum}`,
      instruction: "",
      passage: skill === "reading" ? "" : undefined,
      audioUrl: skill === "listening" ? "" : undefined,
      audioScript: skill === "listening" ? "" : undefined,
      questions: [],
    };
    setSections((prev) => [...prev, newSec]);
    setActiveSecIdx(sections.length);
    markDirty();
  };

  const removeCurrentSection = () => {
    if (sections.length <= 1) {
      toast.error("Đề thi cần ít nhất 1 Section/Part.");
      return;
    }
    setSections((prev) => prev.filter((_, idx) => idx !== safeSecIdx));
    setActiveSecIdx(Math.max(0, safeSecIdx - 1));
    markDirty();
  };

  const addQuestionsToCurrent = (count: number) => {
    if (!currentSec) return;
    const totalExisting = sections.reduce((sum, s) => sum + s.questions.length, 0);
    const added: TestQuestion[] = [];
    for (let i = 0; i < count; i++) {
      added.push(makeEmptyQuestion(totalExisting + i + 1, newQType));
    }
    updateCurrentSection({ questions: [...currentSec.questions, ...added] });
    const expandPatch: Record<string, boolean> = {};
    for (const q of added) expandPatch[q.id] = true;
    setExpandedQIds((prev) => ({ ...prev, ...expandPatch }));
  };

  const updateQuestion = (qId: string, patch: Partial<TestQuestion>) => {
    if (!currentSec) return;
    updateCurrentSection({
      questions: currentSec.questions.map((q) =>
        q.id === qId ? { ...q, ...patch } : q
      ),
    });
  };

  const moveQuestion = (idx: number, delta: -1 | 1) => {
    if (!currentSec) return;
    const target = idx + delta;
    if (target < 0 || target >= currentSec.questions.length) return;
    const arr = [...currentSec.questions];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    updateCurrentSection({ questions: arr });
  };

  const duplicateQuestion = (q: TestQuestion) => {
    if (!currentSec) return;
    const totalExisting = sections.reduce((sum, s) => sum + s.questions.length, 0);
    const copy: TestQuestion = {
      ...q,
      id: nextClientId(`q-copy-${totalExisting + 1}`),
      number: totalExisting + 1,
      groupId: undefined,
      options: q.options ? [...q.options] : undefined,
      correctAnswers: [...q.correctAnswers],
    };
    updateCurrentSection({ questions: [...currentSec.questions, copy] });
    setExpandedQIds((prev) => ({ ...prev, [copy.id]: true }));
  };

  const removeQuestion = (qId: string) => {
    if (!currentSec) return;
    const remaining = currentSec.questions.filter((q) => q.id !== qId);
    const synced = syncSectionGroupsWithQuestions({
      ...currentSec,
      questions: remaining,
    });
    updateCurrentSection({
      questions: synced.questions,
      ...(currentSec.groups ? { groups: synced.groups } : {}),
    });
  };

  const handleRenumberAll = () => {
    setSections((prev) => renumberTestSections(prev));
    markDirty();
    toast.info("Đã tự đánh số lại câu hỏi 1 → N và đồng bộ ô trống {{n}}!");
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (parsed.skill) setSkill(parsed.skill);
      if (parsed.module) setMod(parsed.module);
      if (parsed.title_vi) setTitleVi(parsed.title_vi);
      if (parsed.title_en) setTitleEn(parsed.title_en);
      if (parsed.slug) {
        setSlug(slugifyVi(parsed.slug));
        setSlugTouched(true);
      }
      if (parsed.description_vi) setDescriptionVi(parsed.description_vi);
      if (parsed.duration_minutes) setDurationMinutes(Number(parsed.duration_minutes));
      if (Array.isArray(parsed.sections)) {
        setSections(parsed.sections);
        setActiveSecIdx(0);
      }
      if (parsed.writingPrompt) {
        setWritingTaskType(parsed.writingPrompt.taskType ?? "task_2");
        setWritingPromptText(parsed.writingPrompt.prompt ?? "");
        setWritingMinWords(parsed.writingPrompt.minWords ?? 250);
        setWritingChartSummary(parsed.writingPrompt.chartSummary ?? "");
      }
      if (parsed.speakingPrompts) {
        setSpeakingP1Text((parsed.speakingPrompts.part1 ?? []).join("\n"));
        setSpeakingP2Topic(parsed.speakingPrompts.part2?.topic ?? "");
        setSpeakingP2BulletsText(
          (parsed.speakingPrompts.part2?.bullets ?? []).join("\n")
        );
        setSpeakingP3Text((parsed.speakingPrompts.part3 ?? []).join("\n"));
      }
      setJsonModalOpen(false);
      setJsonInput("");
      markDirty();
      toast.success("Đã nạp dữ liệu đề thi từ JSON vào trình soạn thảo!");
    } catch {
      toast.error("JSON không hợp lệ. Vui lòng kiểm tra lại cú pháp.");
    }
  };

  const handleSave = async (
    publishTarget: boolean,
    bypassHeadingWarning = false
  ) => {
    setErrorMsg("");

    if (publishTarget && !validationReport.canPublish) {
      const under40Msg =
        isObjective && validationReport.questionCount < 40
          ? `Cảnh báo: Đề ${skill === "reading" ? "Reading" : "Listening"} mới có ${validationReport.questionCount}/40 câu. Chưa thể xuất bản khi dưới 40 câu — hãy bổ sung đủ 40 câu hoặc bấm "Lưu Nháp".`
          : `Cảnh báo — Chưa thể xuất bản: ${validationReport.errors[0]}`;
      setErrorMsg(under40Msg);
      toast.error(under40Msg);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    if (publishTarget && skill === "reading" && !bypassHeadingWarning) {
      const headingWarnings: string[] = [];
      sections.forEach((sec, idx) => {
        const audit = auditHeadingStructure(sec.passage ?? "", {
          allowPassageStartAtH3: true,
        });
        for (const w of audit.warnings) {
          headingWarnings.push(`Passage ${idx + 1} (${sec.title}): ${w}`);
        }
      });
      if (headingWarnings.length > 0) {
        setPublishHeadingWarnings(headingWarnings);
        return;
      }
    }

    setPublishHeadingWarnings(null);

    const payload = {
      slug: slug || slugifyVi(titleVi),
      skill,
      module: mod,
      title_vi: titleVi,
      title_en: titleEn || titleVi,
      description_vi: descriptionVi,
      description_en: descriptionEn || descriptionVi,
      duration_minutes: durationMinutes,
      difficulty,
      is_published: publishTarget,
      is_daily_eligible: isDailyEligible,
      is_premium: isPremium,
      seo_meta: seoMeta,
      sections: isObjective ? sections : [],
      writingPrompt:
        skill === "writing"
          ? {
              taskType: writingTaskType,
              prompt: writingPromptText,
              minWords: writingMinWords,
              chartSummary: writingChartSummary || undefined,
            }
          : undefined,
      speakingPrompts:
        skill === "speaking"
          ? {
              part1: speakingP1Text
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
              part2: {
                topic: speakingP2Topic,
                bullets: speakingP2BulletsText
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              },
              part3: speakingP3Text
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : undefined,
    };

    const parsed = cmsTestFormSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Vui lòng kiểm tra lại thông tin đề thi.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/admin/tests/${initialTest!.id}`
        : "/api/admin/tests";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Lưu đề thi thất bại.");
        toast.error(data.error || "Lưu đề thi thất bại.");
        return;
      }

      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      setIsDirty(false);
      setIsPublished(publishTarget);

      if (data.redirectCreated) {
        toast.success(
          `Đã lưu đề & tự động tạo Redirect 301 (${data.redirectCreated.from} → ${data.redirectCreated.to}).`
        );
      } else {
        toast.success(
          publishTarget
            ? "Đã kiểm tra đạt chuẩn & Xuất bản đề thi thành công!"
            : "Đã lưu bản nháp đề thi!"
        );
      }

      if (!isEdit && data.test?.id) {
        router.push(`/admin/tests/${data.test.id}`);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialTest) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/tests/${initialTest.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Không thể xóa đề thi.");
        return;
      }
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      setIsDirty(false);
      toast.success("Đã xóa đề thi.");
      router.push("/admin/tests");
      router.refresh();
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const slugChanged = Boolean(isEdit && initialTest && slug && slug !== initialTest.slug);
  const combinedPassages = sections.map((s) => `${s.title}\n${s.passage ?? ""}`).join("\n");

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/tests"
            onClick={(e) => {
              if (isDirty && !window.confirm("Bạn có thay đổi chưa lưu. Vẫn rời khỏi trang?")) {
                e.preventDefault();
              }
            }}
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Danh sách Đề thi IELTS
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isEdit ? "Chỉnh sửa Đề thi IELTS" : "Tạo Đề thi IELTS mới (Trực quan)"}
            </h1>
            <Badge variant={isPublished ? "default" : "secondary"}>
              {isPublished ? "Đã đăng" : "Nháp"}
            </Badge>
            {autoSavedAt && (
              <span className="text-[11px] text-slate-400">
                Tự lưu nháp lúc {autoSavedAt}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setJsonModalOpen((v) => !v)}
          >
            <FileJson className="h-3.5 w-3.5" /> Nhập JSON
          </Button>
          {isObjective && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLivePreviewOpen(true)}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
            >
              <Eye className="h-3.5 w-3.5" /> Xem trước trực tiếp
            </Button>
          )}
          {isEdit && initialTest && (
            <a
              href={
                isPublished
                  ? `/tests/${slug || initialTest.slug}`
                  : `/tests/${slug || initialTest.slug}?preview=1`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button type="button" size="sm" variant="outline">
                <ExternalLink className="h-3.5 w-3.5" /> Mở tab đề
              </Button>
            </a>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => void handleSave(false)}
          >
            Lưu Nháp
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void handleSave(true)}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Đang lưu..." : "Kiểm tra & Xuất bản"}
          </Button>
        </div>
      </div>

      {/* Restore Auto-Saved Draft */}
      {restorableDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          <span className="inline-flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Tìm thấy bản nháp tự lưu lúc{" "}
            <strong>{new Date(String(restorableDraft.savedAt)).toLocaleString("vi-VN")}</strong>.
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={restoreDraft}>
              Khôi phục
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                window.localStorage.removeItem(draftKey);
                setRestorableDraft(null);
              }}
            >
              Bỏ qua
            </Button>
          </div>
        </div>
      )}

      {/* Optional JSON Import Box */}
      {jsonModalOpen && (
        <Card className="p-4 border-sky-200 bg-sky-50/40 space-y-3 dark:border-sky-900 dark:bg-sky-950/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Nhập nhanh từ JSON (tùy chọn — nạp xong vẫn sửa trực quan bên dưới)
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setJsonModalOpen(false)}
            >
              Đóng
            </Button>
          </div>
          <textarea
            rows={6}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='Dán JSON đề thi vào đây (VD: {"skill":"reading","title_vi":"...","sections":[...]})'
            className="w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
          />
          <Button type="button" size="sm" onClick={handleImportJson}>
            Nạp JSON vào form
          </Button>
        </Card>
      )}

      {/* Pre-Publish Automatic 40-Question Validator Banner */}
      <Card
        className={`p-4 border ${
          validationReport.canPublish
            ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
            : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 text-xs">
            <p className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
              {validationReport.canPublish ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Đạt chuẩn kiểm tra tự động trước khi xuất bản
                  {isObjective ? ` (${validationReport.questionCount}/40 câu, không trùng/thiếu, khớp {{n}}, đủ đáp án)` : ""}
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Chưa đủ điều kiện xuất bản (vẫn có thể Lưu Nháp) —{" "}
                  {isObjective ? `${validationReport.questionCount}/40 câu` : `${validationReport.errors.length} lỗi`}
                </>
              )}
            </p>
            {validationReport.errors.length > 0 && (
              <ul className="list-disc pl-5 text-red-700 dark:text-red-300 space-y-0.5">
                {validationReport.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
            {validationReport.warnings.length > 0 && (
              <ul className="list-disc pl-5 text-amber-800 dark:text-amber-300 space-y-0.5">
                {validationReport.warnings.slice(0, 4).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>

          {isObjective && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRenumberAll}
              >
                <ListOrdered className="h-3.5 w-3.5" /> Tự đánh số 1 → N
              </Button>
              {validationReport.questionCount === 0 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const skel = buildStandard40Skeleton(skill as "reading" | "listening");
                    setSections(skel);
                    setActiveSecIdx(0);
                    setQuestionEditorMode("group");
                    markDirty();
                    toast.success(
                      skill === "reading"
                        ? "Đã tạo khung 3 Passage chuẩn 40 câu theo Nhóm CBT (13 + 13 + 14)!"
                        : "Đã tạo khung 4 Part chuẩn 40 câu theo Nhóm CBT (10 + 10 + 10 + 10)!"
                    );
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Tạo khung 40 câu chuẩn
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* General Metadata Card */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          1. Thông tin chung của Đề thi
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Kỹ năng *
            </label>
            <select
              value={skill}
              onChange={(e) => {
                const next = e.target.value as IeltsSkill;
                setSkill(next);
                if ((next === "reading" || next === "listening") && sections.length === 0) {
                  setSections(makeDefaultSections(next));
                }
                if (next === "listening") setDurationMinutes(35);
                else if (next === "reading" || next === "writing") setDurationMinutes(60);
                else if (next === "speaking") setDurationMinutes(15);
                markDirty();
              }}
              aria-label="Kỹ năng đề thi"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
              <option value="writing">Writing</option>
              <option value="speaking">Speaking</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Hình thức
            </label>
            <select
              value={mod}
              onChange={(e) => {
                setMod(e.target.value as "academic" | "general");
                markDirty();
              }}
              aria-label="Hình thức Academic/General"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="academic">Academic</option>
              <option value="general">General Training</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Thời gian (phút)
            </label>
            <input
              type="number"
              min={5}
              max={180}
              value={durationMinutes}
              onChange={(e) => {
                setDurationMinutes(Math.max(5, Number(e.target.value) || 60));
                markDirty();
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Mức độ Band
            </label>
            <select
              value={difficulty}
              onChange={(e) => {
                setDifficulty(
                  e.target.value as "band_5_6" | "band_6_7" | "band_7_plus"
                );
                markDirty();
              }}
              aria-label="Mức độ Band"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="band_5_6">Band 5.0 – 6.0 (Cơ bản)</option>
              <option value="band_6_7">Band 6.0 – 7.0 (Trung bình - Khá)</option>
              <option value="band_7_plus">Band 7.0+ (Nâng cao)</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Tiêu đề tiếng Việt *
            </label>
            <input
              type="text"
              value={titleVi}
              onChange={(e) => {
                const v = e.target.value;
                setTitleVi(v);
                if (!slugTouched) setSlug(slugifyVi(v));
                markDirty();
              }}
              placeholder="VD: Reading Academic 11: Năng lượng địa nhiệt & Đô thị thông minh"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Tiêu đề tiếng Anh (tùy chọn)
            </label>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => {
                setTitleEn(e.target.value);
                markDirty();
              }}
              placeholder="Để trống sẽ tự dùng tiêu đề tiếng Việt"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Slug URL *
            </label>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
              <span className="text-slate-400">/tests/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(slugifyVi(e.target.value));
                  setSlugTouched(true);
                  markDirty();
                }}
                className="w-full bg-transparent py-2 pl-1 font-mono text-xs focus:outline-none"
              />
            </div>
            {slugChanged && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Đổi slug sẽ tự tạo Redirect 301 từ <code>/tests/{initialTest!.slug}</code> sang <code>/tests/{slug}</code>.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Mô tả ngắn (hiển thị trên kho đề &amp; SEO)
            </label>
            <input
              type="text"
              value={descriptionVi}
              onChange={(e) => {
                setDescriptionVi(e.target.value);
                markDirty();
              }}
              placeholder="Mô tả ngắn nội dung các bài đọc / phần nghe trong đề..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 pt-1 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDailyEligible}
              onChange={(e) => {
                setIsDailyEligible(e.target.checked);
                markDirty();
              }}
            />
            <span className="font-semibold">Cho phép chọn vào Đề thi mỗi ngày</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(e) => {
                setIsPremium(e.target.checked);
                markDirty();
              }}
            />
            <span className="inline-flex items-center gap-1 font-semibold">
              <Crown className="h-3.5 w-3.5 text-amber-500" /> Đề dành riêng cho Premium
            </span>
          </label>
        </div>
      </Card>

      {/* READING / LISTENING SECTIONS & VISUAL QUESTION BUILDER */}
      {isObjective && (
        <div className="space-y-4">
          {/* Section Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {sections.map((sec, idx) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSecIdx(idx)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    idx === safeSecIdx
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  <span>{sec.title || `Phần ${idx + 1}`}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      idx === safeSecIdx
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    }`}
                  >
                    {sec.questions.length} câu
                  </span>
                </button>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addSection}>
                <Plus className="h-3.5 w-3.5" /> Thêm {skill === "listening" ? "Part" : "Passage"}
              </Button>
            </div>

            {sections.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={removeCurrentSection}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Xóa phần này
              </Button>
            )}
          </div>

          {currentSec && (
            <Card className="p-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Tiêu đề Section / Part *
                  </label>
                  <input
                    type="text"
                    value={currentSec.title}
                    onChange={(e) => updateCurrentSection({ title: e.target.value })}
                    placeholder="VD: Passage 1: Urban Microclimates"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Hướng dẫn làm phần này
                  </label>
                  <input
                    type="text"
                    value={currentSec.instruction ?? ""}
                    onChange={(e) =>
                      updateCurrentSection({ instruction: e.target.value })
                    }
                    placeholder="VD: Write NO MORE THAN TWO WORDS AND/OR A NUMBER"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* Reading Passage */}
              {skill === "reading" && (() => {
                const rawPassage = currentSec.passage ?? "";
                const detectedMode: "plain" | "rich" = PASSAGE_HTML_RE.test(rawPassage)
                  ? "rich"
                  : "plain";
                const passageMode = passageModeBySecId[currentSec.id] ?? detectedMode;

                return (
                  <div className="space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Đoạn văn bài đọc{" "}
                        {passageMode === "plain"
                          ? "(phân tách các đoạn bằng 1 dòng trống — VD đặt nhãn A, B, C ở đầu đoạn)"
                          : "(hỗ trợ gắn kiểu 'Tiêu đề bài đọc' & tiêu đề phụ H2/H3 đồng bộ ngoài web)"}
                      </label>
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            if (passageMode === "rich" && PASSAGE_HTML_RE.test(rawPassage)) {
                              const plain = splitPassageParagraphs(rawPassage)
                                .map((p) => p.text)
                                .join("\n\n");
                              updateCurrentSection({ passage: plain });
                            }
                            setPassageModeBySecId((prev) => ({
                              ...prev,
                              [currentSec.id]: "plain",
                            }));
                          }}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                            passageMode === "plain"
                              ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                          }`}
                        >
                          Văn bản thuần
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (passageMode === "plain" && rawPassage.trim()) {
                              updateCurrentSection({
                                passage: plainPassageToHtml(rawPassage),
                              });
                            }
                            setPassageModeBySecId((prev) => ({
                              ...prev,
                              [currentSec.id]: "rich",
                            }));
                          }}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                            passageMode === "rich"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                          }`}
                        >
                          Trình soạn bài đọc (Tiêu đề bài đọc)
                        </button>
                      </div>
                    </div>

                    {passageMode === "rich" ? (
                      <RichTextEditor
                        key={`${currentSec.id}-reading-passage`}
                        preset="reading-passage"
                        value={rawPassage}
                        onChange={(html) => updateCurrentSection({ passage: html })}
                        placeholder="Nhập tiêu đề bài đọc rồi bấm nút 'Tiêu đề bài đọc', sau đó nhập các đoạn văn A, B, C..."
                      />
                    ) : (
                      <textarea
                        rows={10}
                        value={rawPassage}
                        onChange={(e) => updateCurrentSection({ passage: e.target.value })}
                        placeholder="Paragraph A&#10;Nội dung đoạn A...&#10;&#10;Paragraph B&#10;Nội dung đoạn B..."
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 leading-6 dark:border-slate-700 dark:bg-slate-950"
                      />
                    )}
                  </div>
                );
              })()}

              {/* Listening MP3 & Transcript */}
              {skill === "listening" && (
                <div className="space-y-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 text-xs dark:border-emerald-900 dark:bg-emerald-950/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                      <FileAudio className="h-4 w-4 text-emerald-600" />
                      File âm thanh MP3 cho {currentSec.title}
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAudioPickerOpen(true)}
                    >
                      <FileAudio className="h-3.5 w-3.5" /> Chọn / Tải MP3 từ Media
                    </Button>
                  </div>
                  <input
                    type="text"
                    value={currentSec.audioUrl ?? ""}
                    onChange={(e) => updateCurrentSection({ audioUrl: e.target.value })}
                    placeholder="URL file MP3 (từ Supabase Media Library hoặc /audio/listening/...)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  {currentSec.audioUrl && (
                    <audio controls src={currentSec.audioUrl} className="w-full h-9" />
                  )}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Bản ghi (Transcript) — hiện cho học viên sau khi nộp bài
                    </label>
                    <textarea
                      rows={5}
                      value={currentSec.audioScript ?? ""}
                      onChange={(e) =>
                        updateCurrentSection({ audioScript: e.target.value })
                      }
                      placeholder="Nhập transcript hội thoại / bài giảng Listening..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 leading-6 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                </div>
              )}

              {/* Optional Map / Diagram Labelling + Heading Bank */}
              <div className="grid gap-4 md:grid-cols-2 text-xs">
                <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Sơ đồ / Bản đồ (Map / Diagram Labelling)
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDiagramPickerOpen(true)}
                    >
                      <ImageIcon className="h-3.5 w-3.5" /> Chọn ảnh / SVG
                    </Button>
                  </div>
                  <input
                    type="text"
                    value={currentSec.diagramLabel ?? ""}
                    onChange={(e) =>
                      updateCurrentSection({ diagramLabel: e.target.value })
                    }
                    placeholder="Tiêu đề sơ đồ (VD: Floor Plan of City Museum)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={currentSec.diagramImageUrl ?? ""}
                      onChange={(e) =>
                        updateCurrentSection({ diagramImageUrl: e.target.value })
                      }
                      placeholder="URL ảnh/SVG tải lên..."
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-950"
                    />
                    <select
                      value={currentSec.diagramSvgType ?? ""}
                      onChange={(e) =>
                        updateCurrentSection({
                          diagramSvgType:
                            (e.target.value as TestSection["diagramSvgType"]) ||
                            undefined,
                        })
                      }
                      aria-label="Mẫu SVG có sẵn"
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="">Hoặc chọn SVG mẫu...</option>
                      <option value="campus_map">SVG: Campus Map</option>
                      <option value="water_cycle">SVG: Water Cycle</option>
                      <option value="museum_floor">SVG: Museum Floor</option>
                    </select>
                  </div>
                  {currentSec.diagramImageUrl && (
                    <img
                      src={currentSec.diagramImageUrl}
                      alt={currentSec.diagramLabel || "Diagram preview"}
                      className="max-h-36 rounded-lg border border-slate-200 object-contain"
                    />
                  )}
                </div>

                {/* Heading Bank for Matching Headings */}
                <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Danh sách Headings (cho Matching Headings)
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const romans = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
                        const cur = currentSec.headingBank ?? [];
                        const nextId = romans[cur.length] ?? String(cur.length + 1);
                        updateCurrentSection({
                          headingBank: [...cur, { id: nextId, text: "" }],
                        });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Thêm Heading
                    </Button>
                  </div>
                  {(currentSec.headingBank ?? []).length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      Bỏ trống nếu phần này không có dạng câu hỏi Matching Headings.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {(currentSec.headingBank ?? []).map((h, hIdx) => (
                        <div key={hIdx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={h.id}
                            onChange={(e) => {
                              const next = [...(currentSec.headingBank ?? [])];
                              next[hIdx] = { ...h, id: e.target.value };
                              updateCurrentSection({ headingBank: next });
                            }}
                            className="w-12 rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            type="text"
                            value={h.text}
                            onChange={(e) => {
                              const next = [...(currentSec.headingBank ?? [])];
                              next[hIdx] = { ...h, text: e.target.value };
                              updateCurrentSection({ headingBank: next });
                            }}
                            placeholder="Nội dung tiêu đề..."
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = (currentSec.headingBank ?? []).filter(
                                (_, i) => i !== hIdx
                              );
                              updateCurrentSection({ headingBank: next });
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Questions Toolbar & Editor Mode Switcher (GĐ6) */}
              <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Câu hỏi trong {currentSec.title} ({currentSec.questions.length} câu
                      {currentSec.groups && currentSec.groups.length > 0
                        ? ` · ${currentSec.groups.length} nhóm`
                        : ""}
                      )
                    </h3>

                    <div
                      role="tablist"
                      aria-label="Chế độ soạn thảo câu hỏi"
                      className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-900"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={questionEditorMode === "group"}
                        onClick={() => setQuestionEditorMode("group")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                          questionEditorMode === "group"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        }`}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Soạn theo Nhóm (CBT)
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={questionEditorMode === "flat"}
                        onClick={() => setQuestionEditorMode("flat")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition cursor-pointer ${
                          questionEditorMode === "flat"
                            ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        }`}
                      >
                        <List className="h-3.5 w-3.5" />
                        Danh sách từng câu (Cổ điển)
                      </button>
                    </div>
                  </div>

                  {questionEditorMode === "flat" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allExpanded = currentSec.questions.every(
                            (q) => expandedQIds[q.id]
                          );
                          const next: Record<string, boolean> = { ...expandedQIds };
                          for (const q of currentSec.questions) {
                            next[q.id] = !allExpanded;
                          }
                          setExpandedQIds(next);
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                      >
                        Mở rộng / Thu gọn tất cả
                      </button>
                      <select
                        value={newQType}
                        onChange={(e) => setNewQType(e.target.value as QuestionType)}
                        aria-label="Loại câu hỏi muốn thêm"
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                      >
                        {QUESTION_TYPE_CATALOG.map((qt) => (
                          <option key={qt.value} value={qt.value}>
                            {qt.labelVi}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => addQuestionsToCurrent(1)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Thêm 1 câu
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addQuestionsToCurrent(5)}
                      >
                        +5 câu
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Group-Based CBT Editor (GĐ6) vs Classic Flat Question Cards */}
              {questionEditorMode === "group" ? (
                <QuestionGroupEditor
                  section={currentSec}
                  skill={skill as "reading" | "listening"}
                  nextQuestionNumber={nextQuestionNumber}
                  onUpdateSection={updateCurrentSection}
                  onRenumberAll={handleRenumberAll}
                  makeId={nextClientId}
                />
              ) : currentSec.questions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 dark:border-slate-800">
                  Chưa có câu hỏi nào trong phần này. Chọn dạng câu hỏi và bấm <strong>&quot;Thêm 1 câu&quot;</strong> hoặc <strong>&quot;+5 câu&quot;</strong> ở góc phải!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {currentSec.questions.map((q, qIdx) => {
                    const expanded = Boolean(expandedQIds[q.id]);
                    const typeMeta = QUESTION_TYPE_CATALOG.find(
                      (t) => t.value === q.type
                    );
                    const needsOpts = OPTION_TYPES_SET.has(q.type);
                    const hasAnswer = q.correctAnswers.some((a) => a.trim().length > 0);

                    return (
                      <div
                        key={q.id}
                        className={`rounded-xl border transition ${
                          !hasAnswer || !q.prompt.trim()
                            ? "border-amber-300 bg-amber-50/20 dark:border-amber-900/60"
                            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                        }`}
                      >
                        {/* Collapsed Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedQIds((prev) => ({
                                ...prev,
                                [q.id]: !prev[q.id],
                              }))
                            }
                            className="flex flex-1 items-center gap-2.5 text-left min-w-0 cursor-pointer"
                          >
                            <span className="flex h-6 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-[11px] font-bold text-white">
                              {q.number}
                            </span>
                            <Badge variant="secondary">
                              {typeMeta?.labelVi ?? q.type}
                            </Badge>
                            <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                              {q.prompt || "(Chưa nhập nội dung câu hỏi)"}
                            </span>
                            {hasAnswer ? (
                              <span className="hidden sm:inline rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {formatAcceptedAnswersInput(q.correctAnswers)}
                              </span>
                            ) : (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                Thiếu đáp án
                              </span>
                            )}
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveQuestion(qIdx, -1)}
                              disabled={qIdx === 0}
                              title="Lên"
                              className="p-1 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveQuestion(qIdx, 1)}
                              disabled={qIdx === currentSec.questions.length - 1}
                              title="Xuống"
                              className="p-1 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateQuestion(q)}
                              title="Nhân bản câu hỏi"
                              className="p-1 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeQuestion(q.id)}
                              title="Xóa câu hỏi"
                              className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedQIds((prev) => ({
                                  ...prev,
                                  [q.id]: !prev[q.id],
                                }))
                              }
                              className="p-1 text-slate-500 cursor-pointer"
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Question Form */}
                        {expanded && (
                          <div className="border-t border-slate-100 p-4 space-y-3 text-xs dark:border-slate-800">
                            <div className="grid gap-3 sm:grid-cols-12">
                              <div className="sm:col-span-2 space-y-1">
                                <label className="font-semibold text-slate-600 dark:text-slate-400">
                                  Câu số
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={60}
                                  value={q.number}
                                  onChange={(e) =>
                                    updateQuestion(q.id, {
                                      number: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-bold dark:border-slate-700 dark:bg-slate-900"
                                />
                              </div>

                              <div className="sm:col-span-5 space-y-1">
                                <label className="font-semibold text-slate-600 dark:text-slate-400">
                                  Dạng câu hỏi
                                </label>
                                <select
                                  value={q.type}
                                  onChange={(e) => {
                                    const nextType = e.target.value as QuestionType;
                                    const nextMeta = QUESTION_TYPE_CATALOG.find(
                                      (item) => item.value === nextType
                                    );
                                    updateQuestion(q.id, {
                                      type: nextType,
                                      options: nextMeta?.needsOptions
                                        ? nextMeta.defaultOptions
                                          ? [...nextMeta.defaultOptions]
                                          : q.options ?? ["A", "B", "C", "D"]
                                        : undefined,
                                    });
                                  }}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                                >
                                  {QUESTION_TYPE_CATALOG.map((qt) => (
                                    <option key={qt.value} value={qt.value}>
                                      {qt.labelVi}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-5 space-y-1">
                                <label className="font-semibold text-slate-600 dark:text-slate-400">
                                  Đáp án đúng (dùng <code>/</code> cho nhiều đáp án) *
                                </label>
                                <input
                                  type="text"
                                  value={formatAcceptedAnswersInput(q.correctAnswers)}
                                  onChange={(e) =>
                                    updateQuestion(q.id, {
                                      correctAnswers: parseAcceptedAnswersInput(
                                        e.target.value
                                      ),
                                    })
                                  }
                                  placeholder={typeMeta?.answerHint ?? "VD: colour / color"}
                                  className="w-full rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 font-mono font-bold text-emerald-800 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="font-semibold text-slate-600 dark:text-slate-400">
                                Nội dung câu hỏi (Prompt) *
                              </label>
                              <textarea
                                rows={2}
                                value={q.prompt}
                                onChange={(e) =>
                                  updateQuestion(q.id, { prompt: e.target.value })
                                }
                                placeholder="Nhập nội dung câu hỏi hiển thị cho học viên..."
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                              />
                            </div>

                            {/* Options Editor for choice/matching types */}
                            {needsOpts && (
                              <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    {q.type === "map_labelling"
                                      ? "Các lựa chọn (Options — để trống nếu là dạng điền từ vào sơ đồ)"
                                      : "Các lựa chọn hiển thị (Options)"}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {q.type === "map_labelling" &&
                                      (q.options?.length ?? 0) > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateQuestion(q.id, { options: undefined })
                                          }
                                          className="text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:underline cursor-pointer"
                                        >
                                          Xóa hết (dạng điền từ)
                                        </button>
                                      )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQuestion(q.id, {
                                          options: [...(q.options ?? []), ""],
                                        })
                                      }
                                      className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                                    >
                                      + Thêm lựa chọn
                                    </button>
                                  </div>
                                </div>
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                  {(q.options ?? []).map((opt, optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) => {
                                          const next = [...(q.options ?? [])];
                                          next[optIdx] = e.target.value;
                                          updateQuestion(q.id, { options: next });
                                        }}
                                        placeholder={`Lựa chọn ${optIdx + 1}`}
                                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-950"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateQuestion(q.id, {
                                            options: (q.options ?? []).filter(
                                              (_, i) => i !== optIdx
                                            ),
                                          })
                                        }
                                        className="p-1 text-red-500 cursor-pointer"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <label className="font-semibold text-slate-600 dark:text-slate-400">
                                  Giải thích bằng tiếng Việt
                                </label>
                                <textarea
                                  rows={2}
                                  value={q.explanation_vi}
                                  onChange={(e) =>
                                    updateQuestion(q.id, {
                                      explanation_vi: e.target.value,
                                    })
                                  }
                                  placeholder="Giải thích chi tiết vì sao đáp án này đúng..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="font-semibold text-slate-600 dark:text-slate-400">
                                  Đoạn văn chứa đáp án (Evidence / Paragraph Ref)
                                </label>
                                <textarea
                                  rows={2}
                                  value={q.sectionRef ?? ""}
                                  onChange={(e) =>
                                    updateQuestion(q.id, { sectionRef: e.target.value })
                                  }
                                  placeholder='VD: Paragraph B — "probes allow orchards to halve freshwater pumping"'
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* WRITING PROMPT EDITOR */}
      {skill === "writing" && (
        <Card className="p-5 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            2. Đề bài IELTS Writing
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="font-semibold">Loại Task</label>
              <select
                value={writingTaskType}
                onChange={(e) => {
                  const next = e.target.value as "academic_t1" | "general_t1" | "task_2";
                  setWritingTaskType(next);
                  setWritingMinWords(next === "task_2" ? 250 : 150);
                  markDirty();
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="task_2">Task 2 (Essay — 250+ từ)</option>
                <option value="academic_t1">Academic Task 1 (Biểu đồ — 150+ từ)</option>
                <option value="general_t1">General Task 1 (Thư — 150+ từ)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Số từ tối thiểu</label>
              <input
                type="number"
                min={100}
                max={400}
                value={writingMinWords}
                onChange={(e) => {
                  setWritingMinWords(Number(e.target.value) || 250);
                  markDirty();
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="font-semibold">Nội dung đề bài (Prompt) *</label>
            <textarea
              rows={5}
              value={writingPromptText}
              onChange={(e) => {
                setWritingPromptText(e.target.value);
                markDirty();
              }}
              placeholder="Some people believe that governments should invest more in public transport..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 leading-6 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="space-y-1">
            <label className="font-semibold">Mô tả dữ liệu biểu đồ (dành cho Academic Task 1)</label>
            <textarea
              rows={3}
              value={writingChartSummary}
              onChange={(e) => {
                setWritingChartSummary(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </Card>
      )}

      {/* SPEAKING PROMPTS EDITOR */}
      {skill === "speaking" && (
        <Card className="p-5 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            2. Bộ câu hỏi IELTS Speaking (Part 1, 2, 3)
          </h2>
          <div className="space-y-1">
            <label className="font-semibold">Part 1 — Mỗi câu hỏi 1 dòng *</label>
            <textarea
              rows={4}
              value={speakingP1Text}
              onChange={(e) => {
                setSpeakingP1Text(e.target.value);
                markDirty();
              }}
              placeholder="Do you live in a house or an apartment?&#10;What is your favourite room in your home?"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="font-semibold">Part 2 — Chủ đề Cue Card *</label>
              <input
                type="text"
                value={speakingP2Topic}
                onChange={(e) => {
                  setSpeakingP2Topic(e.target.value);
                  markDirty();
                }}
                placeholder="Describe a useful skill you learned as a teenager."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Part 2 — Các ý gợi ý (mỗi ý 1 dòng) *</label>
              <textarea
                rows={4}
                value={speakingP2BulletsText}
                onChange={(e) => {
                  setSpeakingP2BulletsText(e.target.value);
                  markDirty();
                }}
                placeholder="What the skill was&#10;How you learned it&#10;Why it is still useful today"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="font-semibold">Part 3 — Câu hỏi thảo luận sâu (mỗi câu 1 dòng) *</label>
            <textarea
              rows={4}
              value={speakingP3Text}
              onChange={(e) => {
                setSpeakingP3Text(e.target.value);
                markDirty();
              }}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </Card>
      )}

      {/* SEO Panel */}
      <SeoPanel
        seoMeta={seoMeta}
        onChange={(next) => {
          setSeoMeta(next);
          markDirty();
        }}
        fallbackTitle={titleVi}
        fallbackDescription={descriptionVi}
        slug={slug}
        basePath="/tests"
        contentHtml={combinedPassages || writingPromptText || speakingP2Topic}
      />

      {/* Delete Zone */}
      {isEdit && initialTest && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" /> Xóa đề thi này
          </Button>
        </div>
      )}

      {/* Media Pickers */}
      <MediaPickerModal
        open={audioPickerOpen}
        onClose={() => setAudioPickerOpen(false)}
        acceptKind="audio"
        defaultFolder="listening"
        title="Chọn hoặc tải lên file MP3 cho Listening Part"
        onSelect={(asset) => {
          updateCurrentSection({ audioUrl: asset.public_url });
          toast.success(`Đã gắn file nghe ${asset.filename}`);
        }}
      />

      <MediaPickerModal
        open={diagramPickerOpen}
        onClose={() => setDiagramPickerOpen(false)}
        acceptKind="all"
        defaultFolder="tests"
        title="Chọn ảnh hoặc sơ đồ SVG cho Map/Diagram Labelling"
        onSelect={(asset) => {
          updateCurrentSection({
            diagramImageUrl: asset.public_url,
            diagramLabel: currentSec?.diagramLabel || asset.alt_text || "",
          });
          toast.success(`Đã gắn sơ đồ ${asset.filename}`);
        }}
      />

      <ConfirmDialog
        open={Boolean(publishHeadingWarnings && publishHeadingWarnings.length > 0)}
        title="Cảnh báo cấu trúc tiêu đề bài đọc (SEO & Accessibility)"
        description={
          publishHeadingWarnings
            ? `Phát hiện cảnh báo phân cấp tiêu đề trước khi xuất bản đề Reading: ${publishHeadingWarnings.join(" • ")}`
            : ""
        }
        confirmLabel="Vẫn xuất bản"
        cancelLabel="Quay lại sửa"
        destructive={false}
        loading={saving}
        onCancel={() => setPublishHeadingWarnings(null)}
        onConfirm={() => void handleSave(true, true)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Xác nhận xóa đề thi IELTS"
        description={`Xóa vĩnh viễn đề "${titleVi}"?`}
        confirmLabel="Xóa đề thi"
        destructive
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      {isObjective && (
        <TestLivePreviewModal
          open={livePreviewOpen}
          onClose={() => setLivePreviewOpen(false)}
          draftTest={livePreviewDraftTest}
          initialSectionIdx={safeSecIdx}
        />
      )}
    </div>
  );
}
