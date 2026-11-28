"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  ListOrdered,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import type {
  QuestionGroup,
  QuestionGroupOption,
  QuestionGroupSharedContent,
  QuestionType,
  QuestionWordLimit,
  TestQuestion,
  TestSection,
} from "@/lib/types";
import {
  convertSectionFlatToExplicitGroups,
  createQuestionGroupSkeleton,
  formatAcceptedAnswersInput,
  parseAcceptedAnswersInput,
  QUESTION_TYPE_CATALOG,
  syncSectionGroupsWithQuestions,
} from "@/lib/test-cms-shared";
import {
  buildDefaultGroupInstruction,
  extractGroupBlankNumbers,
  formatWordLimitDirective,
  splitPassageParagraphs,
} from "@/lib/test-groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface QuestionGroupEditorProps {
  section: TestSection;
  skill: "reading" | "listening";
  nextQuestionNumber: number;
  onUpdateSection: (patch: Partial<TestSection>) => void;
  onRenumberAll: () => void;
  makeId: (prefix: string) => string;
}

const COMPLETION_SHARED_TYPES = new Set<QuestionType>([
  "summary_completion",
  "table_completion",
  "flowchart_completion",
  "note_completion",
]);

const WORD_LIMIT_TYPES = new Set<QuestionType>([
  "summary_completion",
  "table_completion",
  "flowchart_completion",
  "note_completion",
  "sentence_completion",
  "short_answer",
  "map_labelling",
]);

const SHARED_BANK_TYPES = new Set<QuestionType>([
  "mcq_multi",
  "matching_headings",
  "matching_info",
  "matching_features",
  "matching_sentence_endings",
  "map_labelling",
]);

const ROMAN_NUMERALS = [
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "xi",
  "xii",
];

function nextBankId(type: QuestionType, currentLen: number): string {
  if (type === "matching_headings") {
    return ROMAN_NUMERALS[currentLen] ?? String(currentLen + 1);
  }
  return String.fromCharCode(65 + (currentLen % 26));
}

function makeDefaultSharedContent(
  type: QuestionType,
  nums: number[]
): QuestionGroupSharedContent | undefined {
  if (type === "summary_completion") {
    return {
      kind: "summary",
      text: nums.map((n) => `Sentence for {{${n}}}.`).join(" "),
    };
  }
  if (type === "table_completion") {
    return {
      kind: "table",
      table: {
        title: "Summary Table",
        headers: ["Topic", "Details"],
        rows: nums.map((n, idx) => [`Row ${idx + 1}`, `Detail with {{${n}}}`]),
      },
    };
  }
  if (type === "flowchart_completion") {
    return {
      kind: "flowchart",
      flowchart: {
        title: "Process Flow-chart",
        steps: nums.map((n, idx) => `Step ${idx + 1}: ... {{${n}}} ...`),
      },
    };
  }
  if (type === "note_completion") {
    return {
      kind: "notes",
      notes: {
        title: "Notes",
        sections: [
          {
            heading: "Key Points",
            bullets: nums.map((n) => `Point with {{${n}}}`),
          },
        ],
      },
    };
  }
  return undefined;
}

export function QuestionGroupEditor({
  section,
  skill,
  nextQuestionNumber,
  onUpdateSection,
  onRenumberAll,
  makeId,
}: QuestionGroupEditorProps) {
  const [newGroupType, setNewGroupType] = useState<QuestionType>("summary_completion");
  const [newGroupCount, setNewGroupCount] = useState<number>(4);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [expandedDetailQIds, setExpandedDetailQIds] = useState<Record<string, boolean>>({});

  const explicitGroups = useMemo(() => section.groups ?? [], [section.groups]);
  const hasExplicitGroups = explicitGroups.length > 0;
  const isLegacyFlat = !hasExplicitGroups && section.questions.length > 0;

  const qById = useMemo(
    () => new Map(section.questions.map((q) => [q.id, q])),
    [section.questions]
  );

  const detectedParagraphs = useMemo(
    () => (skill === "reading" ? splitPassageParagraphs(section.passage) : []),
    [skill, section.passage]
  );

  const commitSection = (nextSec: TestSection) => {
    const synced = syncSectionGroupsWithQuestions(nextSec);
    onUpdateSection({
      groups: synced.groups,
      questions: synced.questions,
    });
  };

  const handleConvertLegacy = () => {
    const converted = convertSectionFlatToExplicitGroups(section);
    commitSection(converted);
  };

  const handleAddGroup = () => {
    // If legacy flat questions exist, preserve them by converting first before appending
    const baseSection = isLegacyFlat
      ? convertSectionFlatToExplicitGroups(section)
      : section;

    const { group, questions } = createQuestionGroupSkeleton(
      newGroupType,
      nextQuestionNumber,
      newGroupCount,
      makeId
    );

    commitSection({
      ...baseSection,
      groups: [...(baseSection.groups ?? []), group],
      questions: [...baseSection.questions, ...questions],
    });
    setCollapsedGroups((prev) => ({ ...prev, [group.id]: false }));
  };

  const updateGroup = (groupId: string, updater: (g: QuestionGroup) => QuestionGroup) => {
    const nextGroups = explicitGroups.map((g) => (g.id === groupId ? updater(g) : g));
    commitSection({
      ...section,
      groups: nextGroups,
    });
  };

  const moveGroup = (gIdx: number, delta: -1 | 1) => {
    const target = gIdx + delta;
    if (target < 0 || target >= explicitGroups.length) return;
    const nextGroups = [...explicitGroups];
    [nextGroups[gIdx], nextGroups[target]] = [nextGroups[target], nextGroups[gIdx]];

    // Reorder section.questions to match the new group order while preserving any ungrouped questions
    const seen = new Set<string>();
    const reorderedQuestions: TestQuestion[] = [];
    for (const grp of nextGroups) {
      for (const qId of grp.questionIds) {
        const q = qById.get(qId);
        if (q && !seen.has(q.id)) {
          reorderedQuestions.push(q);
          seen.add(q.id);
        }
      }
    }
    for (const q of section.questions) {
      if (!seen.has(q.id)) reorderedQuestions.push(q);
    }

    commitSection({
      ...section,
      groups: nextGroups,
      questions: reorderedQuestions,
    });
  };

  const deleteGroup = (groupId: string) => {
    const target = explicitGroups.find((g) => g.id === groupId);
    if (!target) return;
    const removeIds = new Set(target.questionIds);
    commitSection({
      ...section,
      groups: explicitGroups.filter((g) => g.id !== groupId),
      questions: section.questions.filter((q) => !removeIds.has(q.id)),
    });
  };

  const updateMemberQuestion = (qId: string, patch: Partial<TestQuestion>) => {
    commitSection({
      ...section,
      questions: section.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)),
    });
  };

  const addQuestionToGroup = (group: QuestionGroup) => {
    const meta = QUESTION_TYPE_CATALOG.find((t) => t.value === group.type);
    const maxMemberNum = group.questionIds.reduce((max, id) => {
      const q = qById.get(id);
      return q ? Math.max(max, q.number) : max;
    }, nextQuestionNumber - 1);
    const num = Math.max(nextQuestionNumber, maxMemberNum + 1);
    const newQ: TestQuestion = {
      id: makeId(`q${num}`),
      number: num,
      type: group.type,
      groupId: group.id,
      prompt: COMPLETION_SHARED_TYPES.has(group.type) ? `Blank {{${num}}}` : "",
      options:
        group.type === "tfng" || group.type === "ynng" || group.type === "mcq"
          ? meta?.defaultOptions
            ? [...meta.defaultOptions]
            : undefined
          : undefined,
      correctAnswers: [],
      explanation_vi: "",
      explanation_en: "",
      sectionRef: "",
    };

    // Insert right after the group's last member question
    const lastMemberId = group.questionIds[group.questionIds.length - 1];
    const insertAfterIdx = section.questions.findIndex((q) => q.id === lastMemberId);
    const nextQuestions = [...section.questions];
    if (insertAfterIdx >= 0) {
      nextQuestions.splice(insertAfterIdx + 1, 0, newQ);
    } else {
      nextQuestions.push(newQ);
    }

    const nextGroups = explicitGroups.map((g) => {
      if (g.id !== group.id) return g;
      const updatedIds = [...g.questionIds, newQ.id];
      return {
        ...g,
        questionIds: updatedIds,
        ...(g.type === "mcq_multi" ? { maxSelections: updatedIds.length } : {}),
      };
    });

    commitSection({
      ...section,
      groups: nextGroups,
      questions: nextQuestions,
    });
  };

  const removeQuestionFromGroup = (group: QuestionGroup, qId: string) => {
    const nextIds = group.questionIds.filter((id) => id !== qId);
    const nextGroups =
      nextIds.length === 0
        ? explicitGroups.filter((g) => g.id !== group.id)
        : explicitGroups.map((g) =>
            g.id === group.id ? { ...g, questionIds: nextIds } : g
          );
    commitSection({
      ...section,
      groups: nextGroups,
      questions: section.questions.filter((q) => q.id !== qId),
    });
  };

  return (
    <div className="space-y-4">
      {/* Add New Group Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
            <Layers className="h-4 w-4 text-emerald-600" />
            Thêm Nhóm câu hỏi CBT:
          </span>
          <select
            value={newGroupType}
            onChange={(e) => {
              const t = e.target.value as QuestionType;
              setNewGroupType(t);
              if (t === "mcq_multi") setNewGroupCount(2);
            }}
            aria-label="Chọn dạng nhóm câu hỏi"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
          >
            {QUESTION_TYPE_CATALOG.map((qt) => (
              <option key={qt.value} value={qt.value}>
                {qt.labelVi}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <span>Số câu:</span>
            <input
              type="number"
              min={1}
              max={15}
              value={newGroupCount}
              onChange={(e) =>
                setNewGroupCount(Math.max(1, Math.min(15, Number(e.target.value) || 1)))
              }
              aria-label="Số câu hỏi trong nhóm"
              className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-bold dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <Button type="button" size="sm" onClick={handleAddGroup}>
            <Plus className="h-3.5 w-3.5" /> Thêm Nhóm câu hỏi
          </Button>
        </div>

        <Button type="button" size="sm" variant="outline" onClick={onRenumberAll}>
          <ListOrdered className="h-3.5 w-3.5" /> Đánh số lại 1 → N &amp; cập nhật {"{{n}}"}
        </Button>
      </div>

      {/* Explicit Opt-In Banner for Legacy Flat Sections */}
      {isLegacyFlat && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs dark:border-amber-900/70 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <p className="inline-flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-200">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Phần này đang dùng cấu trúc danh sách phẳng (Legacy — {section.questions.length} câu)
              </p>
              <p className="text-amber-900/90 dark:text-amber-300/90 leading-5">
                Khi học viên làm bài, hệ thống vẫn tự gom nhóm an toàn mà không sửa dữ liệu cũ. Nếu bạn muốn chỉnh sửa trực quan <strong>Summary / Table / Flow-chart / Notes với {"{{n}}"}</strong>, giới hạn từ, Ngân hàng từ (Word Bank) hoặc phạm vi đoạn văn, hãy bấm chuyển đổi sang trình soạn Nhóm bên cạnh (chỉ lưu vào DB khi bạn bấm <strong>Lưu Nháp / Xuất bản</strong>).
              </p>
            </div>
            <Button type="button" size="sm" onClick={handleConvertLegacy}>
              <Wand2 className="h-3.5 w-3.5" /> Chuyển phần này sang trình soạn Nhóm (CBT)
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasExplicitGroups && !isLegacyFlat && (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 dark:border-slate-800">
          Chưa có nhóm câu hỏi nào trong phần này. Chọn dạng IELTS ở thanh xanh bên trên và bấm{" "}
          <strong>&quot;+ Thêm Nhóm câu hỏi&quot;</strong> để tạo Summary, Table, Flow-chart, Notes, Matching, TFNG hoặc MCQ!
        </div>
      )}

      {/* Explicit Group Cards */}
      {hasExplicitGroups && (
        <div className="space-y-3.5">
          {explicitGroups.map((group, gIdx) => {
            const memberQs = group.questionIds
              .map((id) => qById.get(id))
              .filter((q): q is TestQuestion => Boolean(q));
            const memberNums = memberQs.map((q) => q.number);
            const memberNumSet = new Set(memberNums);
            const typeMeta = QUESTION_TYPE_CATALOG.find((t) => t.value === group.type);
            const isCollapsed = Boolean(collapsedGroups[group.id]);

            const blanksInShared = extractGroupBlankNumbers(group);
            const blankSet = new Set(blanksInShared);
            const orphanBlanks = Array.from(
              new Set(blanksInShared.filter((n) => !memberNumSet.has(n)))
            );
            const hasInlineSharedEditor =
              COMPLETION_SHARED_TYPES.has(group.type) && Boolean(group.sharedContent);
            const missingBlanks = hasInlineSharedEditor
              ? memberNums.filter((n) => !blankSet.has(n))
              : [];
            const missingAnswerQs = memberQs.filter(
              (q) => !q.correctAnswers.some((a) => a.trim().length > 0)
            );
            const hasIssues =
              missingAnswerQs.length > 0 ||
              orphanBlanks.length > 0 ||
              missingBlanks.length > 0;

            const showWordBankToggle =
              group.type === "summary_completion" ||
              group.type === "map_labelling";
            const hasAnswerBank = Boolean(group.answerBank && group.answerBank.length > 0);
            const showBankEditor =
              (SHARED_BANK_TYPES.has(group.type) && group.type !== "map_labelling") ||
              (showWordBankToggle && hasAnswerBank);
            const showWordLimitConfig =
              WORD_LIMIT_TYPES.has(group.type) && !hasAnswerBank;

            const rangeLabel =
              memberNums.length === 0
                ? "Trống"
                : memberNums.length === 1
                ? `Câu ${memberNums[0]}`
                : `Câu ${Math.min(...memberNums)}–${Math.max(...memberNums)}`;

            return (
              <div
                key={group.id}
                className={`rounded-2xl border transition ${
                  hasIssues
                    ? "border-amber-300 bg-white dark:border-amber-800/80 dark:bg-slate-950"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                }`}
              >
                {/* Group Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [group.id]: !prev[group.id],
                      }))
                    }
                    className="flex flex-1 flex-wrap items-center gap-2 text-left min-w-0 cursor-pointer"
                  >
                    <span className="inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white">
                      {rangeLabel}
                    </span>
                    <Badge variant="secondary">{typeMeta?.labelVi ?? group.type}</Badge>
                    {group.title && (
                      <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                        {group.title}
                      </span>
                    )}
                    {hasIssues ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3" />
                        {missingAnswerQs.length > 0
                          ? `Thiếu ${missingAnswerQs.length} đáp án`
                          : `Kiểm tra {{n}}`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Hợp lệ
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveGroup(gIdx, -1)}
                      disabled={gIdx === 0}
                      title="Đưa nhóm lên"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveGroup(gIdx, 1)}
                      disabled={gIdx === explicitGroups.length - 1}
                      title="Đưa nhóm xuống"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGroup(group.id)}
                      title="Xóa toàn bộ nhóm và các câu hỏi trong nhóm"
                      className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedGroups((prev) => ({
                          ...prev,
                          [group.id]: !prev[group.id],
                        }))
                      }
                      aria-label={isCollapsed ? "Mở rộng nhóm" : "Thu gọn nhóm"}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Group Body */}
                {!isCollapsed && (
                  <div className="space-y-4 p-4 text-xs">
                    {/* A. Group Title & Shared IELTS Instruction */}
                    <div className="grid gap-3 md:grid-cols-12">
                      <div className="md:col-span-4 space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-slate-300">
                          Tiêu đề nhóm (tùy chọn)
                        </label>
                        <input
                          type="text"
                          value={group.title ?? ""}
                          onChange={(e) =>
                            updateGroup(group.id, (g) => ({
                              ...g,
                              title: e.target.value,
                            }))
                          }
                          placeholder="VD: Generating biogas from farm waste"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>

                      <div className="md:col-span-8 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label className="font-semibold text-slate-700 dark:text-slate-300">
                            Hướng dẫn IELTS chung cho nhóm
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              updateGroup(group.id, (g) => ({
                                ...g,
                                instruction: buildDefaultGroupInstruction(g.type, {
                                  wordLimit: g.wordLimit,
                                  bankLabels: g.answerBank?.map((b) => b.id),
                                  maxSelections: g.maxSelections,
                                  allowReuse: g.allowReuse,
                                }),
                              }))
                            }
                            className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                          >
                            Tạo hướng dẫn chuẩn IELTS
                          </button>
                        </div>
                        <input
                          type="text"
                          value={group.instruction ?? ""}
                          onChange={(e) =>
                            updateGroup(group.id, (g) => ({
                              ...g,
                              instruction: e.target.value,
                            }))
                          }
                          placeholder="VD: Complete the summary below. Choose ONE WORD ONLY from the passage for each answer."
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>
                    </div>

                    {/* B. Word Limit & Grading Settings + Summary Word Bank Toggle */}
                    {(WORD_LIMIT_TYPES.has(group.type) || skill === "reading") && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {WORD_LIMIT_TYPES.has(group.type) && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                Quy tắc chấm điểm &amp; Giới hạn từ
                              </span>
                              {showWordBankToggle && (
                                <label className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={hasAnswerBank}
                                    onChange={(e) => {
                                      const useBank = e.target.checked;
                                      updateGroup(group.id, (g) => {
                                        const nextBank: QuestionGroupOption[] | undefined =
                                          useBank
                                            ? g.answerBank && g.answerBank.length > 0
                                              ? g.answerBank
                                              : ["A", "B", "C", "D", "E", "F"].map((id) => ({
                                                  id,
                                                  text:
                                                    g.type === "map_labelling"
                                                      ? id
                                                      : `Word ${id}`,
                                                }))
                                            : undefined;
                                        const nextWl: QuestionWordLimit | undefined = useBank
                                          ? undefined
                                          : g.wordLimit ?? {
                                              maxWords: g.type === "map_labelling" ? 2 : 1,
                                              allowNumber: false,
                                              numberMode: "word_only",
                                            };
                                        return {
                                          ...g,
                                          answerBank: nextBank,
                                          wordLimit: nextWl,
                                        };
                                      });
                                    }}
                                  />
                                  {group.type === "map_labelling"
                                    ? "Dùng danh sách chọn (A–H)"
                                    : "Dùng Ngân hàng từ (Word Bank)"}
                                </label>
                              )}
                            </div>

                            {showWordLimitConfig ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-3">
                                  <label className="inline-flex items-center gap-1.5">
                                    <span className="text-slate-600 dark:text-slate-400">
                                      Số từ tối đa:
                                    </span>
                                    <select
                                      value={group.wordLimit?.maxWords ?? 1}
                                      onChange={(e) => {
                                        const maxWords = Number(e.target.value);
                                        updateGroup(group.id, (g) => {
                                          const allowNum =
                                            maxWords === 0
                                              ? true
                                              : Boolean(g.wordLimit?.allowNumber);
                                          return {
                                            ...g,
                                            wordLimit: {
                                              maxWords,
                                              allowNumber: allowNum,
                                              numberMode:
                                                maxWords === 0
                                                  ? "number_only"
                                                  : allowNum
                                                  ? "word_or_number"
                                                  : "word_only",
                                            },
                                          };
                                        });
                                      }}
                                      aria-label="Giới hạn số từ tối đa"
                                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                                    >
                                      <option value={0}>0 (Chỉ 1 con số)</option>
                                      <option value={1}>1 từ (ONE WORD)</option>
                                      <option value={2}>2 từ (TWO WORDS)</option>
                                      <option value={3}>3 từ (THREE WORDS)</option>
                                      <option value={4}>4 từ (FOUR WORDS)</option>
                                    </select>
                                  </label>

                                  {(group.wordLimit?.maxWords ?? 1) > 0 && (
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(group.wordLimit?.allowNumber)}
                                        onChange={(e) => {
                                          const allowNumber = e.target.checked;
                                          updateGroup(group.id, (g) => ({
                                            ...g,
                                            wordLimit: {
                                              maxWords: g.wordLimit?.maxWords ?? 1,
                                              allowNumber,
                                              numberMode: allowNumber
                                                ? "word_or_number"
                                                : "word_only",
                                            },
                                          }));
                                        }}
                                      />
                                      <span>Cho phép kèm số (AND/OR A NUMBER)</span>
                                    </label>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(group.allowNumberWordEquivalence)}
                                      onChange={(e) =>
                                        updateGroup(group.id, (g) => ({
                                          ...g,
                                          allowNumberWordEquivalence: e.target.checked,
                                        }))
                                      }
                                    />
                                    <span>
                                      Chấm tương đương số &amp; chữ (<code>10</code> ↔{" "}
                                      <code>ten</code>, <code>1st</code> ↔ <code>first</code>)
                                    </span>
                                  </label>
                                  {group.wordLimit && (
                                    <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-[10px] text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                      {formatWordLimitDirective(group.wordLimit, "en")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-500">
                                Đang bật chế độ chọn/kéo-thả từ trong Ngân hàng từ (A–J) bên dưới.
                              </p>
                            )}
                          </div>
                        )}

                        {/* C. Reading Passage Range for Group Practice Mode */}
                        {skill === "reading" && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900/50">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                Phạm vi đoạn văn (Luyện theo nhóm)
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {detectedParagraphs.length > 0
                                  ? `Phát hiện ${detectedParagraphs.length} đoạn${
                                      detectedParagraphs.some((p) => p.label)
                                        ? ` (${detectedParagraphs
                                            .map((p) => p.label)
                                            .filter(Boolean)
                                            .join(", ")})`
                                        : ""
                                    }`
                                  : "Chưa nhập đoạn văn"}
                              </span>
                            </div>

                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-6 space-y-0.5">
                                <label className="text-[11px] text-slate-600 dark:text-slate-400">
                                  Nhãn đoạn (VD: A, B, C)
                                </label>
                                <input
                                  type="text"
                                  value={(group.passageRange?.paragraphLabels ?? []).join(", ")}
                                  onChange={(e) => {
                                    const labels = e.target.value
                                      .split(/[,\s]+/)
                                      .map((s) => s.trim().toUpperCase())
                                      .filter(Boolean);
                                    updateGroup(group.id, (g) => {
                                      const nextRange = {
                                        ...(g.passageRange ?? {}),
                                        paragraphLabels:
                                          labels.length > 0 ? labels : undefined,
                                      };
                                      const isEmpty =
                                        !nextRange.paragraphLabels?.length &&
                                        nextRange.startParagraph === undefined &&
                                        nextRange.endParagraph === undefined;
                                      return {
                                        ...g,
                                        passageRange: isEmpty ? undefined : nextRange,
                                      };
                                    });
                                  }}
                                  placeholder="Để trống = cả bài"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                                />
                              </div>

                              <div className="col-span-3 space-y-0.5">
                                <label className="text-[11px] text-slate-600 dark:text-slate-400">
                                  Từ đoạn #
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={Math.max(1, detectedParagraphs.length)}
                                  value={
                                    typeof group.passageRange?.startParagraph === "number"
                                      ? group.passageRange.startParagraph + 1
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const raw = e.target.value.trim();
                                    const startParagraph =
                                      raw === ""
                                        ? undefined
                                        : Math.max(0, Number.parseInt(raw, 10) - 1);
                                    updateGroup(group.id, (g) => {
                                      const nextRange = {
                                        ...(g.passageRange ?? {}),
                                        startParagraph,
                                      };
                                      const isEmpty =
                                        !nextRange.paragraphLabels?.length &&
                                        nextRange.startParagraph === undefined &&
                                        nextRange.endParagraph === undefined;
                                      return {
                                        ...g,
                                        passageRange: isEmpty ? undefined : nextRange,
                                      };
                                    });
                                  }}
                                  placeholder="1"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                                />
                              </div>

                              <div className="col-span-3 space-y-0.5">
                                <label className="text-[11px] text-slate-600 dark:text-slate-400">
                                  Đến đoạn #
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={Math.max(1, detectedParagraphs.length)}
                                  value={
                                    typeof group.passageRange?.endParagraph === "number"
                                      ? group.passageRange.endParagraph + 1
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const raw = e.target.value.trim();
                                    const endParagraph =
                                      raw === ""
                                        ? undefined
                                        : Math.max(0, Number.parseInt(raw, 10) - 1);
                                    updateGroup(group.id, (g) => {
                                      const nextRange = {
                                        ...(g.passageRange ?? {}),
                                        endParagraph,
                                      };
                                      const isEmpty =
                                        !nextRange.paragraphLabels?.length &&
                                        nextRange.startParagraph === undefined &&
                                        nextRange.endParagraph === undefined;
                                      return {
                                        ...g,
                                        passageRange: isEmpty ? undefined : nextRange,
                                      };
                                    });
                                  }}
                                  placeholder={String(Math.max(1, detectedParagraphs.length))}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* D. Shared Content Visual Editor (Summary / Table / Flow-chart / Notes) */}
                    {COMPLETION_SHARED_TYPES.has(group.type) && (
                      <div className="rounded-xl border border-sky-200/80 bg-sky-50/30 p-3.5 space-y-3 dark:border-sky-900/60 dark:bg-sky-950/20">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            Nội dung chung của Nhóm (dùng cú pháp{" "}
                            <code className="rounded bg-slate-200/70 px-1 py-0.5 dark:bg-slate-800">
                              {"{{số_câu}}"}
                            </code>{" "}
                            cho ô trống)
                          </span>
                          {!group.sharedContent && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateGroup(group.id, (g) => ({
                                  ...g,
                                  sharedContent: makeDefaultSharedContent(g.type, memberNums),
                                }))
                              }
                            >
                              <Plus className="h-3.5 w-3.5" /> Khởi tạo khung nội dung chung
                            </Button>
                          )}
                        </div>

                        {/* Live {{n}} Placeholder Verification Bar */}
                        {group.sharedContent && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-500">
                              Kiểm tra ô trống:
                            </span>
                            {memberQs.map((q) => {
                              const placed = blankSet.has(q.number);
                              const answered = q.correctAnswers.some(
                                (a) => a.trim().length > 0
                              );
                              return (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => {
                                    if (
                                      !placed &&
                                      group.type === "summary_completion" &&
                                      group.sharedContent
                                    ) {
                                      updateGroup(group.id, (g) => ({
                                        ...g,
                                        sharedContent: {
                                          kind: "summary",
                                          ...(g.sharedContent ?? {}),
                                          text: `${g.sharedContent?.text ?? ""}${
                                            g.sharedContent?.text?.trim() ? " " : ""
                                          }{{${q.number}}}`,
                                        },
                                      }));
                                    }
                                  }}
                                  title={
                                    !placed
                                      ? group.type === "summary_completion"
                                        ? `Chưa đặt {{${q.number}}} — bấm để chèn vào đoạn tóm tắt`
                                        : `Hãy đặt {{${q.number}}} vào ô bảng / bước / ghi chú`
                                      : !answered
                                      ? `Đã đặt {{${q.number}}} nhưng chưa nhập đáp án bên dưới`
                                      : `Ô {{${q.number}}} khớp câu hỏi & đã có đáp án`
                                  }
                                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold transition ${
                                    !placed
                                      ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 cursor-pointer"
                                      : !answered
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  }`}
                                >
                                  {!placed
                                    ? `✕ Thiếu {{${q.number}}}`
                                    : !answered
                                    ? `⚠ {{${q.number}}} (thiếu đáp án)`
                                    : `✓ {{${q.number}}}`}
                                </button>
                              );
                            })}
                            {orphanBlanks.map((n) => (
                              <span
                                key={`orphan-${n}`}
                                className="rounded-full bg-red-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white"
                              >
                                ✕ {`{{${n}}}`} không có câu hỏi trong nhóm
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 1) Summary Completion Editor */}
                        {group.type === "summary_completion" && group.sharedContent && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] text-slate-500">Chèn nhanh:</span>
                              {memberNums.map((n) => (
                                <button
                                  key={`ins-${n}`}
                                  type="button"
                                  onClick={() =>
                                    updateGroup(group.id, (g) => ({
                                      ...g,
                                      sharedContent: {
                                        ...(g.sharedContent ?? { kind: "summary" }),
                                        kind: "summary",
                                        text: `${g.sharedContent?.text ?? ""}${
                                          g.sharedContent?.text?.endsWith(" ") ||
                                          !g.sharedContent?.text
                                            ? ""
                                            : " "
                                        }{{${n}}}`,
                                      },
                                    }))
                                  }
                                  className="rounded border border-sky-300 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300 cursor-pointer"
                                >
                                  +{`{{${n}}}`}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={5}
                              value={group.sharedContent.text ?? ""}
                              onChange={(e) =>
                                updateGroup(group.id, (g) => ({
                                  ...g,
                                  sharedContent: {
                                    ...(g.sharedContent ?? { kind: "summary" }),
                                    kind: "summary",
                                    text: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Nhập đoạn tóm tắt liên mạch có chứa {{1}}, {{2}}, {{3}}..."
                              className="w-full rounded-xl border border-slate-200 bg-white p-3 leading-6 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                        )}

                        {/* 2) Table Completion Editor */}
                        {group.type === "table_completion" && group.sharedContent?.table && (
                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <input
                                type="text"
                                value={group.sharedContent.table.title ?? ""}
                                onChange={(e) =>
                                  updateGroup(group.id, (g) => ({
                                    ...g,
                                    sharedContent: g.sharedContent?.table
                                      ? {
                                          ...g.sharedContent,
                                          table: {
                                            ...g.sharedContent.table,
                                            title: e.target.value,
                                          },
                                        }
                                      : g.sharedContent,
                                  }))
                                }
                                placeholder="Tiêu đề bảng (tùy chọn)..."
                                className="flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold dark:border-slate-700 dark:bg-slate-950"
                              />
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateGroup(group.id, (g) => {
                                      const tbl = g.sharedContent?.table;
                                      if (!tbl) return g;
                                      return {
                                        ...g,
                                        sharedContent: {
                                          ...g.sharedContent!,
                                          table: {
                                            ...tbl,
                                            headers: [
                                              ...tbl.headers,
                                              `Column ${tbl.headers.length + 1}`,
                                            ],
                                            rows: tbl.rows.map((r) => [...r, ""]),
                                          },
                                        },
                                      };
                                    })
                                  }
                                >
                                  <Plus className="h-3 w-3" /> Cột
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateGroup(group.id, (g) => {
                                      const tbl = g.sharedContent?.table;
                                      if (!tbl) return g;
                                      return {
                                        ...g,
                                        sharedContent: {
                                          ...g.sharedContent!,
                                          table: {
                                            ...tbl,
                                            rows: [
                                              ...tbl.rows,
                                              tbl.headers.map(() => ""),
                                            ],
                                          },
                                        },
                                      };
                                    })
                                  }
                                >
                                  <Plus className="h-3 w-3" /> Hàng
                                </Button>
                              </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                              <table className="w-full border-collapse text-xs">
                                <thead>
                                  <tr className="bg-slate-100/80 dark:bg-slate-900">
                                    {group.sharedContent.table.headers.map((hdr, cIdx) => (
                                      <th key={cIdx} className="border-b border-r border-slate-200 p-1.5 dark:border-slate-800">
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="text"
                                            value={hdr}
                                            onChange={(e) =>
                                              updateGroup(group.id, (g) => {
                                                const tbl = g.sharedContent?.table;
                                                if (!tbl) return g;
                                                const nextHeaders = [...tbl.headers];
                                                nextHeaders[cIdx] = e.target.value;
                                                return {
                                                  ...g,
                                                  sharedContent: {
                                                    ...g.sharedContent!,
                                                    table: { ...tbl, headers: nextHeaders },
                                                  },
                                                };
                                              })
                                            }
                                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-bold dark:border-slate-700 dark:bg-slate-950"
                                          />
                                          {group.sharedContent!.table!.headers.length > 2 && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateGroup(group.id, (g) => {
                                                  const tbl = g.sharedContent?.table;
                                                  if (!tbl || tbl.headers.length <= 2) return g;
                                                  return {
                                                    ...g,
                                                    sharedContent: {
                                                      ...g.sharedContent!,
                                                      table: {
                                                        ...tbl,
                                                        headers: tbl.headers.filter(
                                                          (_, i) => i !== cIdx
                                                        ),
                                                        rows: tbl.rows.map((r) =>
                                                          r.filter((_, i) => i !== cIdx)
                                                        ),
                                                      },
                                                    },
                                                  };
                                                })
                                              }
                                              title="Xóa cột"
                                              className="p-0.5 text-red-500 cursor-pointer"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          )}
                                        </div>
                                      </th>
                                    ))}
                                    <th className="w-9 border-b border-slate-200 dark:border-slate-800" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.sharedContent.table.rows.map((row, rIdx) => (
                                    <tr key={rIdx} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800/80">
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="border-r border-slate-200 p-1.5 dark:border-slate-800">
                                          <textarea
                                            rows={2}
                                            value={cell}
                                            onChange={(e) =>
                                              updateGroup(group.id, (g) => {
                                                const tbl = g.sharedContent?.table;
                                                if (!tbl) return g;
                                                const nextRows = tbl.rows.map((r, ri) =>
                                                  ri === rIdx
                                                    ? r.map((c, ci) =>
                                                        ci === cIdx ? e.target.value : c
                                                      )
                                                    : r
                                                );
                                                return {
                                                  ...g,
                                                  sharedContent: {
                                                    ...g.sharedContent!,
                                                    table: { ...tbl, rows: nextRows },
                                                  },
                                                };
                                              })
                                            }
                                            placeholder="Nhập nội dung ô (có thể chứa {{n}})..."
                                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                                          />
                                        </td>
                                      ))}
                                      <td className="p-1 text-center">
                                        {group.sharedContent!.table!.rows.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateGroup(group.id, (g) => {
                                                const tbl = g.sharedContent?.table;
                                                if (!tbl || tbl.rows.length <= 1) return g;
                                                return {
                                                  ...g,
                                                  sharedContent: {
                                                    ...g.sharedContent!,
                                                    table: {
                                                      ...tbl,
                                                      rows: tbl.rows.filter(
                                                        (_, i) => i !== rIdx
                                                      ),
                                                    },
                                                  },
                                                };
                                              })
                                            }
                                            title="Xóa hàng"
                                            className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* 3) Flow-chart Completion Editor */}
                        {group.type === "flowchart_completion" &&
                          group.sharedContent?.flowchart && (
                            <div className="space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <input
                                  type="text"
                                  value={group.sharedContent.flowchart.title ?? ""}
                                  onChange={(e) =>
                                    updateGroup(group.id, (g) => ({
                                      ...g,
                                      sharedContent: g.sharedContent?.flowchart
                                        ? {
                                            ...g.sharedContent,
                                            flowchart: {
                                              ...g.sharedContent.flowchart,
                                              title: e.target.value,
                                            },
                                          }
                                        : g.sharedContent,
                                    }))
                                  }
                                  placeholder="Tiêu đề quy trình Flow-chart..."
                                  className="flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold dark:border-slate-700 dark:bg-slate-950"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateGroup(group.id, (g) => {
                                      const fc = g.sharedContent?.flowchart;
                                      if (!fc) return g;
                                      return {
                                        ...g,
                                        sharedContent: {
                                          ...g.sharedContent!,
                                          flowchart: {
                                            ...fc,
                                            steps: [...fc.steps, ""],
                                          },
                                        },
                                      };
                                    })
                                  }
                                >
                                  <Plus className="h-3 w-3" /> Thêm bước
                                </Button>
                              </div>

                              <div className="space-y-1.5">
                                {group.sharedContent.flowchart.steps.map((step, sIdx) => (
                                  <div key={sIdx} className="space-y-1">
                                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
                                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                        {sIdx + 1}
                                      </span>
                                      <input
                                        type="text"
                                        value={step}
                                        onChange={(e) =>
                                          updateGroup(group.id, (g) => {
                                            const fc = g.sharedContent?.flowchart;
                                            if (!fc) return g;
                                            const nextSteps = [...fc.steps];
                                            nextSteps[sIdx] = e.target.value;
                                            return {
                                              ...g,
                                              sharedContent: {
                                                ...g.sharedContent!,
                                                flowchart: { ...fc, steps: nextSteps },
                                              },
                                            };
                                          })
                                        }
                                        placeholder={`Nội dung bước ${sIdx + 1} (dùng {{n}} cho ô trống)...`}
                                        className="flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900"
                                      />
                                      <button
                                        type="button"
                                        disabled={sIdx === 0}
                                        onClick={() =>
                                          updateGroup(group.id, (g) => {
                                            const fc = g.sharedContent?.flowchart;
                                            if (!fc || sIdx === 0) return g;
                                            const next = [...fc.steps];
                                            [next[sIdx - 1], next[sIdx]] = [
                                              next[sIdx],
                                              next[sIdx - 1],
                                            ];
                                            return {
                                              ...g,
                                              sharedContent: {
                                                ...g.sharedContent!,
                                                flowchart: { ...fc, steps: next },
                                              },
                                            };
                                          })
                                        }
                                        className="p-1 text-slate-500 disabled:opacity-30 cursor-pointer"
                                      >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          sIdx ===
                                          group.sharedContent!.flowchart!.steps.length - 1
                                        }
                                        onClick={() =>
                                          updateGroup(group.id, (g) => {
                                            const fc = g.sharedContent?.flowchart;
                                            if (!fc || sIdx >= fc.steps.length - 1) return g;
                                            const next = [...fc.steps];
                                            [next[sIdx + 1], next[sIdx]] = [
                                              next[sIdx],
                                              next[sIdx + 1],
                                            ];
                                            return {
                                              ...g,
                                              sharedContent: {
                                                ...g.sharedContent!,
                                                flowchart: { ...fc, steps: next },
                                              },
                                            };
                                          })
                                        }
                                        className="p-1 text-slate-500 disabled:opacity-30 cursor-pointer"
                                      >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                      </button>
                                      {group.sharedContent!.flowchart!.steps.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateGroup(group.id, (g) => {
                                              const fc = g.sharedContent?.flowchart;
                                              if (!fc || fc.steps.length <= 1) return g;
                                              return {
                                                ...g,
                                                sharedContent: {
                                                  ...g.sharedContent!,
                                                  flowchart: {
                                                    ...fc,
                                                    steps: fc.steps.filter(
                                                      (_, i) => i !== sIdx
                                                    ),
                                                  },
                                                },
                                              };
                                            })
                                          }
                                          className="p-1 text-red-500 cursor-pointer"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    {sIdx <
                                      group.sharedContent!.flowchart!.steps.length - 1 && (
                                      <div className="text-center text-xs font-bold text-slate-400">
                                        ↓
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* 4) Note Completion Editor */}
                        {group.type === "note_completion" && group.sharedContent?.notes && (
                          <div className="space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <input
                                type="text"
                                value={group.sharedContent.notes.title ?? ""}
                                onChange={(e) =>
                                  updateGroup(group.id, (g) => ({
                                    ...g,
                                    sharedContent: g.sharedContent?.notes
                                      ? {
                                          ...g.sharedContent,
                                          notes: {
                                            ...g.sharedContent.notes,
                                            title: e.target.value,
                                          },
                                        }
                                      : g.sharedContent,
                                  }))
                                }
                                placeholder="Tiêu đề ghi chú (VD: Cooking with biogas)..."
                                className="flex-1 min-w-[200px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold dark:border-slate-700 dark:bg-slate-950"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateGroup(group.id, (g) => {
                                    const notes = g.sharedContent?.notes;
                                    if (!notes) return g;
                                    return {
                                      ...g,
                                      sharedContent: {
                                        ...g.sharedContent!,
                                        notes: {
                                          ...notes,
                                          sections: [
                                            ...notes.sections,
                                            { heading: "Subheading", bullets: [""] },
                                          ],
                                        },
                                      },
                                    };
                                  })
                                }
                              >
                                <Plus className="h-3 w-3" /> Thêm mục ghi chú
                              </Button>
                            </div>

                            <div className="space-y-2.5">
                              {group.sharedContent.notes.sections.map((nSec, nsIdx) => (
                                <div
                                  key={nsIdx}
                                  className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 dark:border-slate-800 dark:bg-slate-950"
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={nSec.heading ?? ""}
                                      onChange={(e) =>
                                        updateGroup(group.id, (g) => {
                                          const notes = g.sharedContent?.notes;
                                          if (!notes) return g;
                                          const nextSecs = notes.sections.map((s, i) =>
                                            i === nsIdx
                                              ? { ...s, heading: e.target.value }
                                              : s
                                          );
                                          return {
                                            ...g,
                                            sharedContent: {
                                              ...g.sharedContent!,
                                              notes: { ...notes, sections: nextSecs },
                                            },
                                          };
                                        })
                                      }
                                      placeholder="Tiêu đề mục nhỏ (tùy chọn)..."
                                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold dark:border-slate-700 dark:bg-slate-900"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateGroup(group.id, (g) => {
                                          const notes = g.sharedContent?.notes;
                                          if (!notes) return g;
                                          const nextSecs = notes.sections.map((s, i) =>
                                            i === nsIdx
                                              ? { ...s, bullets: [...s.bullets, ""] }
                                              : s
                                          );
                                          return {
                                            ...g,
                                            sharedContent: {
                                              ...g.sharedContent!,
                                              notes: { ...notes, sections: nextSecs },
                                            },
                                          };
                                        })
                                      }
                                      className="text-[11px] font-bold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                                    >
                                      + Ý gạch đầu dòng
                                    </button>
                                    {group.sharedContent!.notes!.sections.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateGroup(group.id, (g) => {
                                            const notes = g.sharedContent?.notes;
                                            if (!notes || notes.sections.length <= 1) return g;
                                            return {
                                              ...g,
                                              sharedContent: {
                                                ...g.sharedContent!,
                                                notes: {
                                                  ...notes,
                                                  sections: notes.sections.filter(
                                                    (_, i) => i !== nsIdx
                                                  ),
                                                },
                                              },
                                            };
                                          })
                                        }
                                        className="p-1 text-red-500 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="space-y-1.5 pl-3">
                                    {nSec.bullets.map((bullet, bIdx) => (
                                      <div key={bIdx} className="flex items-center gap-1.5">
                                        <span className="text-slate-400">•</span>
                                        <input
                                          type="text"
                                          value={bullet}
                                          onChange={(e) =>
                                            updateGroup(group.id, (g) => {
                                              const notes = g.sharedContent?.notes;
                                              if (!notes) return g;
                                              const nextSecs = notes.sections.map((s, i) =>
                                                i === nsIdx
                                                  ? {
                                                      ...s,
                                                      bullets: s.bullets.map((b, bi) =>
                                                        bi === bIdx ? e.target.value : b
                                                      ),
                                                    }
                                                  : s
                                              );
                                              return {
                                                ...g,
                                                sharedContent: {
                                                  ...g.sharedContent!,
                                                  notes: { ...notes, sections: nextSecs },
                                                },
                                              };
                                            })
                                          }
                                          placeholder="Nội dung ghi chú (dùng {{n}} cho ô trống)..."
                                          className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900"
                                        />
                                        {nSec.bullets.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateGroup(group.id, (g) => {
                                                const notes = g.sharedContent?.notes;
                                                if (!notes) return g;
                                                const nextSecs = notes.sections.map((s, i) =>
                                                  i === nsIdx
                                                    ? {
                                                        ...s,
                                                        bullets: s.bullets.filter(
                                                          (_, bi) => bi !== bIdx
                                                        ),
                                                      }
                                                    : s
                                                );
                                                return {
                                                  ...g,
                                                  sharedContent: {
                                                    ...g.sharedContent!,
                                                    notes: { ...notes, sections: nextSecs },
                                                  },
                                                };
                                              })
                                            }
                                            className="p-1 text-red-500 cursor-pointer"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* E. Shared Prompt & Answer Bank Editor (Matching / Map / MCQ Multi / Word Bank) */}
                    {showBankEditor && (
                      <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-3.5 space-y-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                        {group.type === "mcq_multi" && (
                          <div className="grid gap-3 md:grid-cols-12">
                            <div className="md:col-span-9 space-y-1">
                              <label className="font-bold text-slate-800 dark:text-slate-200">
                                Câu hỏi chung cho nhóm chọn nhiều đáp án (Shared Prompt) *
                              </label>
                              <input
                                type="text"
                                value={group.sharedPrompt ?? ""}
                                onChange={(e) =>
                                  updateGroup(group.id, (g) => ({
                                    ...g,
                                    sharedPrompt: e.target.value,
                                  }))
                                }
                                placeholder="VD: Which TWO disadvantages of the current bus system are mentioned?"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                              />
                            </div>
                            <div className="md:col-span-3 space-y-1">
                              <label className="font-bold text-slate-800 dark:text-slate-200">
                                Số lựa chọn (maxSelections)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={6}
                                value={group.maxSelections ?? Math.max(2, memberQs.length)}
                                onChange={(e) =>
                                  updateGroup(group.id, (g) => ({
                                    ...g,
                                    maxSelections: Math.max(
                                      1,
                                      Math.min(6, Number(e.target.value) || 2)
                                    ),
                                  }))
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-bold dark:border-slate-700 dark:bg-slate-950"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-bold text-slate-900 dark:text-white">
                              Ngân hàng đáp án dùng chung (Answer Bank)
                            </span>
                            {group.type !== "mcq_multi" && (
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={Boolean(group.allowReuse)}
                                  onChange={(e) =>
                                    updateGroup(group.id, (g) => ({
                                      ...g,
                                      allowReuse: e.target.checked,
                                    }))
                                  }
                                />
                                <span>Cho phép dùng lặp chữ cái (NB reuse)</span>
                              </label>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateGroup(group.id, (g) => {
                                const cur = g.answerBank ?? [];
                                return {
                                  ...g,
                                  answerBank: [
                                    ...cur,
                                    { id: nextBankId(g.type, cur.length), text: "" },
                                  ],
                                };
                              })
                            }
                          >
                            <Plus className="h-3 w-3" /> Thêm mục Bank
                          </Button>
                        </div>

                        {group.type !== "mcq_multi" && (
                          <input
                            type="text"
                            value={group.sharedContent?.listTitle ?? ""}
                            onChange={(e) =>
                              updateGroup(group.id, (g) => ({
                                ...g,
                                sharedContent: g.sharedContent
                                  ? { ...g.sharedContent, listTitle: e.target.value }
                                  : e.target.value.trim()
                                  ? { kind: "list", listTitle: e.target.value }
                                  : undefined,
                              }))
                            }
                            placeholder="Tiêu đề hộp danh sách (VD: List of Researchers / List of Headings / Word Bank)..."
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                          />
                        )}

                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {(group.answerBank ?? []).map((item, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={item.id}
                                onChange={(e) =>
                                  updateGroup(group.id, (g) => {
                                    const next = [...(g.answerBank ?? [])];
                                    next[bIdx] = { ...item, id: e.target.value };
                                    return { ...g, answerBank: next };
                                  })
                                }
                                className="w-12 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-bold dark:border-slate-700 dark:bg-slate-950"
                              />
                              <input
                                type="text"
                                value={item.text}
                                onChange={(e) =>
                                  updateGroup(group.id, (g) => {
                                    const next = [...(g.answerBank ?? [])];
                                    next[bIdx] = { ...item, text: e.target.value };
                                    return { ...g, answerBank: next };
                                  })
                                }
                                placeholder={`Nội dung mục ${item.id || bIdx + 1}...`}
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-950"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateGroup(group.id, (g) => ({
                                    ...g,
                                    answerBank: (g.answerBank ?? []).filter(
                                      (_, i) => i !== bIdx
                                    ),
                                  }))
                                }
                                className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* F. Member Questions Answer Key & Details List */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Đáp án &amp; chi tiết từng câu trong nhóm ({memberQs.length} câu)
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addQuestionToGroup(group)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Thêm câu vào nhóm
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {memberQs.map((q) => {
                          const hasAns = q.correctAnswers.some((a) => a.trim().length > 0);
                          const isPromptOptional =
                            (hasInlineSharedEditor && blankSet.has(q.number)) ||
                            (group.type === "mcq_multi" &&
                              (group.sharedPrompt?.trim().length ?? 0) >= 2);
                          const showPerQOpts =
                            q.type === "mcq" ||
                            q.type === "tfng" ||
                            q.type === "ynng" ||
                            (!hasAnswerBank &&
                              q.type !== "summary_completion" &&
                              q.type !== "table_completion" &&
                              q.type !== "flowchart_completion" &&
                              q.type !== "note_completion" &&
                              q.type !== "sentence_completion" &&
                              q.type !== "short_answer");
                          const detailOpen = Boolean(expandedDetailQIds[q.id]);

                          return (
                            <div
                              key={q.id}
                              className={`rounded-xl border p-2.5 space-y-2 ${
                                !hasAns
                                  ? "border-amber-300 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/10"
                                  : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40"
                              }`}
                            >
                              <div className="grid gap-2 sm:grid-cols-12 items-center">
                                <div className="sm:col-span-1 flex items-center gap-1">
                                  <span className="flex h-7 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-[11px] font-bold text-white">
                                    {q.number}
                                  </span>
                                </div>

                                <div className="sm:col-span-5">
                                  <input
                                    type="text"
                                    value={q.prompt}
                                    onChange={(e) =>
                                      updateMemberQuestion(q.id, {
                                        prompt: e.target.value,
                                      })
                                    }
                                    placeholder={
                                      isPromptOptional
                                        ? `Ô {{${q.number}}} đã nằm trong nội dung nhóm (tùy chọn)`
                                        : `Nội dung câu hỏi ${q.number} *`
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                                  />
                                </div>

                                <div className="sm:col-span-3">
                                  <input
                                    type="text"
                                    value={formatAcceptedAnswersInput(q.correctAnswers)}
                                    onChange={(e) =>
                                      updateMemberQuestion(q.id, {
                                        correctAnswers: parseAcceptedAnswersInput(
                                          e.target.value
                                        ),
                                      })
                                    }
                                    placeholder={
                                      typeMeta?.answerHint ?? "Đáp án (dùng /)"
                                    }
                                    aria-label={`Đáp án câu ${q.number}`}
                                    className="w-full rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 font-mono font-bold text-emerald-800 dark:border-emerald-800 dark:bg-slate-950 dark:text-emerald-300"
                                  />
                                </div>

                                <div className="sm:col-span-2">
                                  <input
                                    type="text"
                                    value={q.sectionRef ?? ""}
                                    onChange={(e) =>
                                      updateMemberQuestion(q.id, {
                                        sectionRef: e.target.value,
                                      })
                                    }
                                    placeholder="VD: Paragraph B"
                                    aria-label={`Đoạn chứa đáp án câu ${q.number}`}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-950"
                                  />
                                </div>

                                <div className="sm:col-span-1 flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedDetailQIds((prev) => ({
                                        ...prev,
                                        [q.id]: !prev[q.id],
                                      }))
                                    }
                                    title="Mở rộng giải thích & lựa chọn"
                                    className="rounded p-1 text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                                  >
                                    {detailOpen ? (
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeQuestionFromGroup(group, q.id)}
                                    title="Xóa câu này khỏi nhóm"
                                    className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Collapsible Options + Explanations */}
                              {detailOpen && (
                                <div className="space-y-2.5 border-t border-slate-200/70 pt-2.5 dark:border-slate-800">
                                  {showPerQOpts && (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                                          Các lựa chọn của câu {q.number}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateMemberQuestion(q.id, {
                                              options: [...(q.options ?? []), ""],
                                            })
                                          }
                                          className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                                        >
                                          + Thêm lựa chọn
                                        </button>
                                      </div>
                                      <div className="grid gap-1.5 sm:grid-cols-2">
                                        {(q.options ?? []).map((opt, optIdx) => (
                                          <div
                                            key={optIdx}
                                            className="flex items-center gap-1"
                                          >
                                            <input
                                              type="text"
                                              value={opt}
                                              onChange={(e) => {
                                                const next = [...(q.options ?? [])];
                                                next[optIdx] = e.target.value;
                                                updateMemberQuestion(q.id, {
                                                  options: next,
                                                });
                                              }}
                                              placeholder={`Lựa chọn ${optIdx + 1}`}
                                              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                                            />
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateMemberQuestion(q.id, {
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

                                  <div className="grid gap-2 md:grid-cols-2">
                                    <textarea
                                      rows={2}
                                      value={q.explanation_vi}
                                      onChange={(e) =>
                                        updateMemberQuestion(q.id, {
                                          explanation_vi: e.target.value,
                                        })
                                      }
                                      placeholder="Giải thích tiếng Việt (hiện sau khi nộp bài)..."
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                                    />
                                    <textarea
                                      rows={2}
                                      value={q.explanation_en}
                                      onChange={(e) =>
                                        updateMemberQuestion(q.id, {
                                          explanation_en: e.target.value,
                                        })
                                      }
                                      placeholder="English explanation (optional)..."
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
