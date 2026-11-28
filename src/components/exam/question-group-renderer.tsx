"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Check,
  CheckCircle2,
  Flag,
  GripVertical,
  Info,
  LocateFixed,
  X,
  XCircle,
} from "lucide-react";
import type {
  QuestionGroup,
  QuestionGroupOption,
  QuestionType,
  QuestionWordLimit,
  TestQuestion,
} from "@/lib/types";
import type { GradedTestResult, QuestionGradeDetail } from "@/lib/test-grader";
import { getQuestionTypeLabel } from "@/lib/progress-shared";
import {
  checkWordLimitSoftWarning,
  formatWordLimitDirective,
  getOptionDisplayParts,
  parseOptionToBankItem,
  parseTemplateSegments,
  parseWordLimitFromText,
  promptToBlankTemplate,
  resolveGroupDisplayContent,
  stripLegacyPromptPrefix,
} from "@/lib/test-groups";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

export interface QuestionGroupRendererProps {
  group: QuestionGroup;
  questions: TestQuestion[];
  answers: Record<string, string>;
  flagged: Record<string, boolean>;
  graded: GradedTestResult | null;
  isEn: boolean;
  onAnswerChange: (questionId: string, value: string) => void;
  onAnswersPatch: (patch: Record<string, string>) => void;
  onToggleFlag: (questionId: string) => void;
  onLocateEvidence?: (detail: QuestionGradeDetail) => void;
  canLocateEvidence?: boolean;
}

function normalizeTokenId(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/^([A-Za-z]{1,4}|[ivxlcdmIVXLCDM]{1,5})[.):-]\s+/);
  return m ? m[1].trim() : trimmed;
}

function getSelectedLettersForMultiGroup(
  questions: TestQuestion[],
  answers: Record<string, string>
): string[] {
  if (questions.length > 1) {
    return questions
      .map((q) => (answers[q.id] ?? "").trim())
      .filter(Boolean);
  }
  const single = questions[0];
  if (!single) return [];
  return (answers[single.id] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function QuestionGroupRenderer({
  group,
  questions,
  answers,
  flagged,
  graded,
  isEn,
  onAnswerChange,
  onAnswersPatch,
  onToggleFlag,
  onLocateEvidence,
  canLocateEvidence = false,
}: QuestionGroupRendererProps) {
  const [armedOptionId, setArmedOptionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);

  const questionByNumber = useMemo(
    () => new Map(questions.map((q) => [q.number, q])),
    [questions]
  );

  const detailById = useMemo(() => {
    const map = new Map<string, QuestionGradeDetail>();
    for (const d of graded?.details ?? []) {
      map.set(d.questionId, d);
    }
    return map;
  }, [graded]);

  const isLocked = Boolean(graded);
  const rangeLabel =
    group.questionRange.start === group.questionRange.end
      ? isEn
        ? `Question ${group.questionRange.start}`
        : `Câu ${group.questionRange.start}`
      : isEn
      ? `Questions ${group.questionRange.start}–${group.questionRange.end}`
      : `Câu hỏi ${group.questionRange.start}–${group.questionRange.end}`;

  const wordLimitBadge = formatWordLimitDirective(
    group.wordLimit,
    isEn ? "en" : "vi"
  );

  // Derive bank items for bank-backed question types
  const bankItems: QuestionGroupOption[] = useMemo(() => {
    if (group.answerBank && group.answerBank.length > 0) {
      return group.answerBank;
    }
    const firstOpts = questions[0]?.options ?? [];
    if (firstOpts.length > 0) {
      return firstOpts.map((opt, idx) => parseOptionToBankItem(opt, idx));
    }
    return [];
  }, [group.answerBank, questions]);

  const bankById = useMemo(
    () => new Map(bankItems.map((item) => [item.id, item])),
    [bankItems]
  );

  // Track which bank IDs are already assigned across this group's questions
  const usedBankMap = useMemo(() => {
    const map = new Map<string, string>(); // optionId -> questionId
    for (const q of questions) {
      const val = (answers[q.id] ?? "").trim();
      if (val) {
        map.set(normalizeTokenId(val), q.id);
      }
    }
    return map;
  }, [answers, questions]);

  const isSingleUseBank = group.allowReuse !== true;

  const assignBankOptionToQuestion = (qId: string, optionId: string) => {
    if (isLocked) return;
    const cleanId = optionId.trim();
    if (!cleanId) return;

    const patch: Record<string, string> = {};
    if (isSingleUseBank) {
      // If another question already holds this one-time option, clear that old slot
      for (const q of questions) {
        if (q.id !== qId && normalizeTokenId(answers[q.id] ?? "") === cleanId) {
          patch[q.id] = "";
        }
      }
    }
    patch[qId] = cleanId;
    onAnswersPatch(patch);
    setArmedOptionId(null);
    setDragOverQuestionId(null);
  };

  const renderFlagButton = (q: TestQuestion) => {
    if (isLocked) return null;
    const isFlagged = Boolean(flagged[q.id]);
    return (
      <button
        type="button"
        onClick={() => onToggleFlag(q.id)}
        aria-pressed={isFlagged}
        aria-label={
          isEn
            ? `Flag question ${q.number} for review`
            : `Đánh dấu câu ${q.number} để xem lại`
        }
        title={isEn ? "Flag for review" : "Đánh dấu xem lại"}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 ${
          isFlagged
            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300"
            : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        }`}
      >
        <Flag className="h-3.5 w-3.5" />
      </button>
    );
  };

  const renderLocateEvidenceButton = (detail: QuestionGradeDetail) => {
    if (!onLocateEvidence || !canLocateEvidence) return null;
    if (!detail.sectionRef && detail.acceptedAnswers.length === 0) return null;
    return (
      <button
        type="button"
        onClick={() => onLocateEvidence(detail)}
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 cursor-pointer"
      >
        <LocateFixed className="h-3.5 w-3.5 shrink-0" />
        {isEn ? "View evidence in passage" : "Xem đoạn chứa đáp án"}
        {detail.sectionRef ? ` (${detail.sectionRef})` : ""}
      </button>
    );
  };

  const renderQuestionExplanation = (q: TestQuestion) => {
    const detail = detailById.get(q.id);
    if (!detail) return null;
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5 text-xs space-y-1.5 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 font-bold">
            {detail.isCorrect ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {isEn ? "Correct" : "Chính xác"}
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-1 text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4 shrink-0" />
                {isEn ? "Incorrect" : "Chưa đúng"} ·{" "}
                {isEn ? "Answer:" : "Đáp án:"}{" "}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {detail.acceptedAnswers.join(" / ")}
                </strong>
              </span>
            )}
            {detail.wordLimitExceeded && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                {isEn ? "Word limit exceeded" : "Vượt giới hạn số từ"}
              </span>
            )}
          </div>
          {renderLocateEvidenceButton(detail)}
        </div>
        {detail.sectionRef && !onLocateEvidence && (
          <p className="text-emerald-800 dark:text-emerald-300">
            <strong>{isEn ? "Evidence:" : "Đoạn chứa đáp án:"}</strong>{" "}
            {detail.sectionRef}
          </p>
        )}
        {detail.explanation_vi && (
          <p className="text-slate-700 dark:text-slate-300">
            <strong>Giải thích (VI):</strong> {detail.explanation_vi}
          </p>
        )}
        {detail.explanation_en && (
          <p className="text-slate-500 dark:text-slate-400">
            <strong>Explanation (EN):</strong> {detail.explanation_en}
          </p>
        )}
      </div>
    );
  };

  const renderGroupReviewDrawer = () => {
    if (!graded) return null;
    const groupDetails = questions
      .map((q) => ({ q, detail: detailById.get(q.id) }))
      .filter((item): item is { q: TestQuestion; detail: QuestionGradeDetail } =>
        Boolean(item.detail)
      );
    if (groupDetails.length === 0) return null;

    return (
      <div className="mt-5 space-y-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {isEn ? "Answer Key & Explanations" : "Đáp án & Giải thích chi tiết"}
        </p>
        <div className="space-y-2">
          {groupDetails.map(({ q, detail }) => (
            <div
              key={q.id}
              className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                detail.isCorrect
                  ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
                  : "border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[11px] font-bold text-white ${
                      detail.isCorrect ? "bg-emerald-600" : "bg-red-500"
                    }`}
                  >
                    {q.number}
                  </span>
                  {detail.isCorrect ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {detail.userAnswer || detail.acceptedAnswers[0]}
                    </span>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-1.5 text-red-700 dark:text-red-300">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {isEn ? "Yours:" : "Bạn chọn:"}{" "}
                        <strong>{detail.userAnswer || (isEn ? "(blank)" : "(bỏ trống)")}</strong>
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {isEn ? "Key:" : "Đáp án:"}{" "}
                        <strong>{detail.acceptedAnswers.join(" / ")}</strong>
                      </span>
                    </span>
                  )}
                  {detail.wordLimitExceeded && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3" />
                      {isEn ? "Word limit exceeded" : "Vượt giới hạn số từ"}
                    </span>
                  )}
                </div>
                {renderLocateEvidenceButton(detail)}
              </div>
              {detail.sectionRef && !onLocateEvidence && (
                <p className="text-emerald-800 dark:text-emerald-300">
                  <strong>{isEn ? "Evidence:" : "Đoạn chứa đáp án:"}</strong> {detail.sectionRef}
                </p>
              )}
              {detail.explanation_vi && (
                <p className="text-slate-700 dark:text-slate-300">
                  <strong>VI:</strong> {detail.explanation_vi}
                </p>
              )}
              {detail.explanation_en && (
                <p className="text-slate-500 dark:text-slate-400">
                  <strong>EN:</strong> {detail.explanation_en}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // =========================================================================
  // INLINE BLANK (TEXT INPUT) FOR COMPLETION TYPES
  // =========================================================================
  const renderInlineTextBlank = (q: TestQuestion) => {
    const val = answers[q.id] ?? "";
    const detail = detailById.get(q.id);
    const effectiveLimit: QuestionWordLimit | undefined =
      parseWordLimitFromText(q.prompt) ?? group.wordLimit;
    const warning = checkWordLimitSoftWarning(val, effectiveLimit, isEn);

    const borderCls = detail
      ? detail.isCorrect
        ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-100"
        : "border-red-400 bg-red-50/70 text-red-950 dark:border-red-700 dark:bg-red-950/50 dark:text-red-100"
      : warning.exceeded
      ? "border-amber-500 bg-amber-50/60 text-slate-900 ring-2 ring-amber-400/30 dark:border-amber-500 dark:bg-amber-950/40 dark:text-white"
      : "border-slate-300 bg-white text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

    return (
      <span
        id={`question-card-${q.id}`}
        className="mx-1 my-0.5 inline-flex flex-wrap items-center gap-1 align-middle"
      >
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {q.number}
        </span>
        <input
          type="text"
          disabled={isLocked}
          value={val}
          onChange={(e) => onAnswerChange(q.id, e.target.value)}
          aria-label={isEn ? `Answer for question ${q.number}` : `Đáp án câu ${q.number}`}
          aria-invalid={warning.exceeded || (detail ? !detail.isCorrect : undefined)}
          placeholder={isEn ? "Type answer" : "Nhập đáp án"}
          className={`h-8 w-36 sm:w-40 rounded-lg border px-2.5 text-xs font-semibold transition focus:outline-none ${borderCls}`}
        />
        {!isLocked && warning.wordCount > 0 && effectiveLimit?.maxWords ? (
          <span
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              warning.exceeded
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
            title={warning.message}
          >
            {warning.exceeded && <AlertTriangle className="h-3 w-3" />}
            {warning.wordCount}/{effectiveLimit.maxWords}
            {effectiveLimit.allowNumber ? "+" : ""}
          </span>
        ) : null}
        {!isLocked && warning.exceeded && warning.message ? (
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {warning.message}
          </span>
        ) : null}
        {detail && !detail.isCorrect ? (
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            ✓ {detail.acceptedAnswers[0]}
          </span>
        ) : null}
      </span>
    );
  };

  // =========================================================================
  // INLINE DROP / CLICK-TO-PLACE BLANK FOR WORD BANK & SENTENCE ENDINGS
  // =========================================================================
  const renderInlineBankBlank = (q: TestQuestion) => {
    const rawVal = (answers[q.id] ?? "").trim();
    const tokenId = rawVal ? normalizeTokenId(rawVal) : "";
    const placedOpt = tokenId ? bankById.get(tokenId) : undefined;
    const detail = detailById.get(q.id);
    const isDropTarget = dragOverQuestionId === q.id;
    const isArmed = Boolean(armedOptionId) && !isLocked;

    const slotCls = detail
      ? detail.isCorrect
        ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200"
        : "border-red-400 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200"
      : isDropTarget
      ? "border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500/40 dark:bg-emerald-950/60"
      : isArmed
      ? "border-emerald-500 border-dashed bg-emerald-50/40 hover:bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30"
      : tokenId
      ? "border-emerald-500/80 bg-emerald-50/60 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
      : "border-dashed border-slate-300 bg-slate-50/80 text-slate-500 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400";

    return (
      <span
        id={`question-card-${q.id}`}
        onDragOver={(e) => {
          if (isLocked) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dragOverQuestionId !== q.id) setDragOverQuestionId(q.id);
        }}
        onDragLeave={() => {
          if (dragOverQuestionId === q.id) setDragOverQuestionId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (isLocked) return;
          const droppedId = e.dataTransfer.getData("text/plain") || armedOptionId;
          if (droppedId) {
            assignBankOptionToQuestion(q.id, droppedId);
          }
          setDragOverQuestionId(null);
        }}
        className="mx-1 my-0.5 inline-flex items-center gap-1 align-middle"
      >
        <button
          type="button"
          disabled={isLocked}
          onClick={() => {
            if (isLocked) return;
            if (armedOptionId) {
              assignBankOptionToQuestion(q.id, armedOptionId);
            } else if (tokenId) {
              onAnswerChange(q.id, "");
            }
          }}
          onKeyDown={(e) => {
            if (isLocked) return;
            if ((e.key === "Backspace" || e.key === "Delete") && tokenId) {
              e.preventDefault();
              onAnswerChange(q.id, "");
            } else if (e.key === "Escape" && armedOptionId) {
              e.preventDefault();
              setArmedOptionId(null);
            }
          }}
          aria-label={
            tokenId
              ? isEn
                ? `Question ${q.number}, selected ${placedOpt ? `${placedOpt.id}. ${placedOpt.text}` : tokenId}. Press Delete or click to clear.`
                : `Câu ${q.number}, đã điền ${placedOpt ? `${placedOpt.id}. ${placedOpt.text}` : tokenId}. Nhấn Delete hoặc bấm để bỏ.`
              : isEn
              ? `Blank for question ${q.number}. Drop an option or select an option below then click here.`
              : `Ô trống câu ${q.number}. Kéo đáp án vào đây hoặc chọn đáp án bên dưới rồi bấm.`
          }
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 ${slotCls}`}
        >
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-300 bg-white px-1 text-[11px] font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
            {q.number}
          </span>
          {tokenId ? (
            <span className="max-w-[260px] truncate text-left">
              <strong className="mr-1 text-emerald-700 dark:text-emerald-400">
                {placedOpt?.id ?? tokenId}.
              </strong>
              {placedOpt && placedOpt.text !== placedOpt.id ? placedOpt.text : ""}
            </span>
          ) : (
            <span className="italic opacity-75">
              {isArmed
                ? isEn
                  ? `Place ${armedOptionId}`
                  : `Điền ${armedOptionId}`
                : isEn
                ? "Drop or select"
                : "Kéo / chọn đáp án"}
            </span>
          )}
        </button>
        {!isLocked && tokenId && (
          <button
            type="button"
            onClick={() => onAnswerChange(q.id, "")}
            aria-label={
              isEn
                ? `Remove answer from question ${q.number}`
                : `Xóa đáp án khỏi câu ${q.number}`
            }
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    );
  };

  // =========================================================================
  // TEMPLATE RENDERER ({{n}} -> inline text input OR inline bank drop-zone)
  // =========================================================================
  const renderTemplateText = (
    text: string,
    mode: "input" | "bank"
  ): React.ReactNode => {
    const segments = parseTemplateSegments(text);
    return segments.map((seg, idx) => {
      if (seg.type === "text") {
        return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
      }
      const q = questionByNumber.get(seg.number);
      if (!q) {
        return (
          <span
            key={idx}
            className="mx-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-500 dark:bg-slate-800"
          >
            [{seg.number}]
          </span>
        );
      }
      return (
        <React.Fragment key={idx}>
          {mode === "bank" ? renderInlineBankBlank(q) : renderInlineTextBlank(q)}
        </React.Fragment>
      );
    });
  };

  // =========================================================================
  // INTERACTIVE ANSWER BANK TRAY (Summary Word Bank & Matching Sentence Endings)
  // =========================================================================
  const renderBankTray = (layout: "chips" | "stacked") => {
    if (bankItems.length === 0) return null;
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs italic text-slate-600 dark:text-slate-400">
            {isEn
              ? "Drag an option into a blank, or select an option and then click a blank."
              : "Kéo đáp án vào ô trống, hoặc bấm chọn đáp án bên dưới rồi bấm vào ô trống."}
          </p>
          {armedOptionId && !isLocked && (
            <div
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            >
              <span>
                {isEn
                  ? `Selected ${armedOptionId} — tap a blank`
                  : `Đang chọn ${armedOptionId} — bấm ô trống để điền`}
              </span>
              <button
                type="button"
                onClick={() => setArmedOptionId(null)}
                className="rounded p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-900 cursor-pointer"
                aria-label={isEn ? "Cancel selection" : "Hủy chọn"}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div
          className={
            layout === "stacked"
              ? "flex flex-col gap-2"
              : "flex flex-wrap gap-2"
          }
          role="listbox"
          aria-label={isEn ? "Answer choices bank" : "Ngân hàng đáp án"}
        >
          {bankItems.map((opt) => {
            const usedByQId = usedBankMap.get(opt.id);
            const isDimmed = isSingleUseBank && Boolean(usedByQId);
            const isArmed = armedOptionId === opt.id;
            const disabled = isLocked || isDimmed;

            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isArmed}
                aria-disabled={disabled}
                disabled={disabled}
                draggable={!disabled}
                onDragStart={(e) => {
                  if (disabled) return;
                  e.dataTransfer.setData("text/plain", opt.id);
                  e.dataTransfer.effectAllowed = "move";
                  setArmedOptionId(opt.id);
                }}
                onDragEnd={() => setDragOverQuestionId(null)}
                onClick={() => {
                  if (disabled) return;
                  setArmedOptionId((prev) => (prev === opt.id ? null : opt.id));
                }}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                  layout === "stacked" ? "w-full" : ""
                } ${
                  isDimmed
                    ? "border-slate-200 bg-slate-100/80 text-slate-400 line-through opacity-50 cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600"
                    : isArmed
                    ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30 dark:border-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-100 cursor-pointer"
                    : "border-slate-200 bg-white text-slate-800 hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-emerald-600 cursor-grab active:cursor-grabbing"
                }`}
              >
                {!disabled && (
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                )}
                <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 px-1.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {opt.id}
                </span>
                <span className="leading-snug">
                  {opt.text !== opt.id ? opt.text : opt.id}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDER BODY BY QUESTION TYPE
  // =========================================================================
  const renderGroupBody = () => {
    const type: QuestionType = group.type;

    // 1. TFNG / YNNG / MCQ (Single Choice) / MAP LABELLING
    if (
      type === "tfng" ||
      type === "ynng" ||
      type === "mcq" ||
      type === "map_labelling"
    ) {
      return (
        <div className="space-y-5">
          {questions.map((q) => {
            const val = answers[q.id] ?? "";
            const detail = detailById.get(q.id);
            const cleanedPrompt =
              type === "map_labelling"
                ? stripLegacyPromptPrefix(q.prompt)
                : q.prompt;
            const opts =
              q.options && q.options.length > 0
                ? q.options
                : type === "tfng"
                ? ["TRUE", "FALSE", "NOT GIVEN"]
                : type === "ynng"
                ? ["YES", "NO", "NOT GIVEN"]
                : bankItems.map((b) =>
                    b.text !== b.id ? `${b.id}. ${b.text}` : b.id
                  );

            return (
              <fieldset
                key={q.id}
                id={`question-card-${q.id}`}
                className={`rounded-xl border p-4 transition ${
                  detail
                    ? detail.isCorrect
                      ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20"
                      : "border-red-300 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20"
                    : "border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <legend className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-slate-900 dark:text-white">
                    <span className="mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {q.number}
                    </span>
                    <span>{cleanedPrompt}</span>
                  </legend>
                  {renderFlagButton(q)}
                </div>

                <div
                  role="radiogroup"
                  aria-label={isEn ? `Choices for question ${q.number}` : `Lựa chọn câu ${q.number}`}
                  className="mt-3 space-y-2 pl-0 sm:pl-8"
                >
                  {opts.map((rawOpt, optIdx) => {
                    const parts = getOptionDisplayParts(rawOpt, optIdx);
                    const isSelected = val === parts.value;
                    return (
                      <button
                        key={rawOpt}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={isLocked}
                        onClick={() => onAnswerChange(q.id, parts.value)}
                        className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3.5 py-2 text-left text-xs font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-100"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600"
                        }`}
                      >
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {parts.letter}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                            isSelected
                              ? "border-emerald-600 dark:border-emerald-400"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                          )}
                        </span>
                        <span className="leading-snug">{parts.label}</span>
                      </button>
                    );
                  })}
                </div>

                {renderQuestionExplanation(q)}
              </fieldset>
            );
          })}
        </div>
      );
    }

    // 2. MCQ MULTI ("Choose TWO / THREE letters", 1 group occupying multiple question numbers)
    if (type === "mcq_multi") {
      const maxSelections = Math.max(
        1,
        group.maxSelections ?? (questions.length > 1 ? questions.length : 2)
      );
      const selectedValues = getSelectedLettersForMultiGroup(questions, answers);
      const atLimit = selectedValues.length >= maxSelections;
      const stem = group.sharedPrompt || questions[0]?.prompt || "";
      const opts =
        group.answerBank && group.answerBank.length > 0
          ? group.answerBank.map((b) =>
              b.text !== b.id ? `${b.id}. ${b.text}` : b.id
            )
          : questions[0]?.options ?? [];

      const toggleOption = (optVal: string) => {
        if (isLocked) return;
        const already = selectedValues.includes(optVal);
        if (!already && atLimit) return;

        const nextSelected = already
          ? selectedValues.filter((v) => v !== optVal)
          : [...selectedValues, optVal];

        if (questions.length > 1) {
          const patch: Record<string, string> = {};
          questions.forEach((q, idx) => {
            patch[q.id] = nextSelected[idx] ?? "";
          });
          onAnswersPatch(patch);
        } else if (questions[0]) {
          onAnswerChange(questions[0].id, nextSelected.join(", "));
        }
      };

      return (
        <div
          id={questions[0] ? `question-card-${questions[0].id}` : undefined}
          className="space-y-4"
        >
          {/* Hidden scroll anchors for extra numbers in the multi-choice group */}
          {questions.slice(1).map((q) => (
            <span key={q.id} id={`question-card-${q.id}`} className="sr-only" />
          ))}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <div className="flex shrink-0 items-center gap-1 pt-0.5">
                {questions.map((q) => (
                  <span
                    key={q.id}
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {q.number}
                  </span>
                ))}
              </div>
              <p className="text-sm font-medium leading-relaxed text-slate-900 dark:text-white">
                {stem}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={atLimit ? "default" : "secondary"}>
                {isEn
                  ? `${selectedValues.length}/${maxSelections} selected`
                  : `Đã chọn ${selectedValues.length}/${maxSelections}`}
              </Badge>
              {questions[0] && renderFlagButton(questions[0])}
            </div>
          </div>

          <div
            role="group"
            aria-label={
              isEn
                ? `Choose ${maxSelections} options for ${rangeLabel}`
                : `Chọn ${maxSelections} đáp án cho ${rangeLabel}`
            }
            className="space-y-2"
          >
            {(() => {
              const expectedLetters = new Set<string>();
              if (isLocked) {
                for (const q of questions) {
                  const d = detailById.get(q.id);
                  for (const acc of d?.acceptedAnswers ?? []) {
                    for (const tok of acc.split(/[,|&/]+|\band\b/i)) {
                      const letter = normalizeTokenId(tok).toUpperCase();
                      if (letter) expectedLetters.add(letter);
                    }
                  }
                }
              }

              return opts.map((rawOpt, optIdx) => {
                const parts = getOptionDisplayParts(rawOpt, optIdx);
                const isSelected = selectedValues.includes(parts.value);
                const isDisabled = isLocked || (!isSelected && atLimit);
                const optLetter = parts.letter.toUpperCase();
                const isExpectedKey = isLocked && expectedLetters.has(optLetter);

                let btnCls =
                  "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer";
                if (isLocked) {
                  if (isSelected && isExpectedKey) {
                    btnCls =
                      "border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-100";
                  } else if (isSelected && !isExpectedKey) {
                    btnCls =
                      "border-red-500 bg-red-50 text-red-950 dark:border-red-500 dark:bg-red-950/50 dark:text-red-100";
                  } else if (!isSelected && isExpectedKey) {
                    btnCls =
                      "border-emerald-400 border-dashed bg-emerald-50/40 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/25 dark:text-emerald-200";
                  } else {
                    btnCls =
                      "border-slate-200 bg-slate-50 text-slate-400 opacity-65 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500";
                  }
                } else if (isSelected) {
                  btnCls =
                    "border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-100 cursor-pointer";
                } else if (isDisabled) {
                  btnCls =
                    "border-slate-200 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500";
                }

                return (
                  <button
                    key={rawOpt}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                    onClick={() => toggleOption(parts.value)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3.5 py-2 text-left text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-emerald-600 ${btnCls}`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        isLocked && isSelected && !isExpectedKey
                          ? "bg-red-500 text-white"
                          : isSelected || isExpectedKey
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {parts.letter}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isLocked && isSelected && !isExpectedKey
                          ? "border-red-500 bg-red-500 text-white"
                          : isSelected
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 leading-snug">{parts.label}</span>
                    {isLocked && isExpectedKey && (
                      <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {isEn ? "Key" : "Đáp án"}
                      </span>
                    )}
                  </button>
                );
              });
            })()}
          </div>

          {!isLocked && atLimit && (
            <p
              role="status"
              aria-live="polite"
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400"
            >
              {isEn
                ? `You have selected all ${maxSelections} answers. Uncheck one to pick a different option.`
                : `Bạn đã chọn đủ ${maxSelections} đáp án. Bỏ chọn 1 ô nếu muốn đổi sang phương án khác.`}
            </p>
          )}

          {renderGroupReviewDrawer()}
        </div>
      );
    }

    // 3. MATCHING INFORMATION (A–G) & MATCHING FEATURES (A–D) — RADIO MATRIX TABLE
    if (type === "matching_info" || type === "matching_features") {
      const columns =
        bankItems.length > 0
          ? bankItems
          : ["A", "B", "C", "D"].map((id) => ({ id, text: id }));
      const hasDescriptiveFeatures = columns.some((c) => c.text !== c.id);
      const allowReuse = group.allowReuse !== false;

      return (
        <div className="space-y-4">
          {allowReuse && (
            <p className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs italic font-medium text-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
              <Info className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              {isEn
                ? "NB You may use any letter more than once."
                : "Lưu ý (NB): Bạn có thể dùng một chữ cái nhiều hơn một lần."}
            </p>
          )}

          {hasDescriptiveFeatures && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {group.sharedContent?.listTitle ||
                  group.title ||
                  (isEn ? "List of Options" : "Danh sách đối tượng")}
              </p>
              <ul className="mt-2.5 space-y-1.5 text-xs text-slate-800 dark:text-slate-200">
                {columns.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-emerald-100 px-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {item.id}
                    </span>
                    <span className="leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  <th
                    scope="col"
                    className="min-w-[220px] px-3.5 py-2.5 font-bold text-slate-700 dark:text-slate-200"
                  >
                    {isEn ? "Statement" : "Nội dung câu hỏi"}
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      scope="col"
                      className="w-11 px-1.5 py-2.5 text-center font-bold text-slate-800 dark:text-slate-100"
                    >
                      {col.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950/40">
                {questions.map((q) => {
                  const val = normalizeTokenId(answers[q.id] ?? "");
                  const detail = detailById.get(q.id);
                  return (
                    <tr
                      key={q.id}
                      id={`question-card-${q.id}`}
                      className={
                        detail
                          ? detail.isCorrect
                            ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                            : "bg-red-50/40 dark:bg-red-950/20"
                          : "hover:bg-slate-50/70 dark:hover:bg-slate-900/50"
                      }
                    >
                      <td className="px-3.5 py-3 align-middle">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 text-xs font-medium leading-relaxed text-slate-900 dark:text-slate-100">
                            <span className="mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                              {q.number}
                            </span>
                            <span>{q.prompt}</span>
                          </div>
                          {renderFlagButton(q)}
                        </div>
                      </td>
                      {columns.map((col) => {
                        const isSelected = val === col.id;
                        return (
                          <td
                            key={col.id}
                            className="border-l border-slate-100 p-0 text-center align-middle dark:border-slate-800/80"
                          >
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              aria-label={
                                isEn
                                  ? `Question ${q.number}, option ${col.id}`
                                  : `Câu ${q.number}, chọn ${col.id}`
                              }
                              disabled={isLocked}
                              onClick={() => onAnswerChange(q.id, col.id)}
                              className={`flex h-11 w-full min-w-[44px] items-center justify-center transition cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                                isSelected
                                  ? "bg-emerald-50/80 dark:bg-emerald-950/50"
                                  : "hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                                  isSelected
                                    ? "border-emerald-600 bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-500"
                                    : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                                }`}
                              >
                                {isSelected && (
                                  <span className="h-2 w-2 rounded-full bg-white" />
                                )}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {renderGroupReviewDrawer()}
        </div>
      );
    }

    // 4. MATCHING HEADINGS (List of Headings + One-time use selector & drag/click slot)
    if (type === "matching_headings") {
      return (
        <div className="space-y-4">
          {bankItems.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                  {group.title || (isEn ? "List of Headings" : "Danh sách tiêu đề (List of Headings)")}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isEn
                    ? "Each heading may be used once"
                    : "Mỗi tiêu đề chỉ dùng một lần"}
                </span>
              </div>
              <div className="space-y-1.5">
                {bankItems.map((h) => {
                  const usedByQId = usedBankMap.get(h.id);
                  const isUsed = isSingleUseBank && Boolean(usedByQId);
                  const isArmed = armedOptionId === h.id;
                  const disabled = isLocked || isUsed;

                  return (
                    <button
                      key={h.id}
                      type="button"
                      disabled={disabled}
                      draggable={!disabled}
                      onDragStart={(e) => {
                        if (disabled) return;
                        e.dataTransfer.setData("text/plain", h.id);
                        setArmedOptionId(h.id);
                      }}
                      onClick={() => {
                        if (disabled) return;
                        setArmedOptionId((prev) => (prev === h.id ? null : h.id));
                      }}
                      className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-xs transition focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                        isUsed
                          ? "border-slate-200 bg-slate-100 text-slate-400 line-through opacity-55 cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600"
                          : isArmed
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30 dark:border-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-100 cursor-pointer"
                          : "border-slate-200 bg-white text-slate-800 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-grab"
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <strong className="min-w-6 font-bold text-emerald-700 dark:text-emerald-400">
                          {h.id}.
                        </strong>
                        <span>{h.text !== h.id ? h.text : h.id}</span>
                      </span>
                      {isUsed && (
                        <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold no-underline text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {isEn ? "Used" : "Đã dùng"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {questions.map((q) => {
              const selectedId = normalizeTokenId(answers[q.id] ?? "");
              const detail = detailById.get(q.id);

              return (
                <div
                  key={q.id}
                  id={`question-card-${q.id}`}
                  onDragOver={(e) => {
                    if (isLocked) return;
                    e.preventDefault();
                    setDragOverQuestionId(q.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverQuestionId === q.id) setDragOverQuestionId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isLocked) return;
                    const dropped = e.dataTransfer.getData("text/plain") || armedOptionId;
                    if (dropped) assignBankOptionToQuestion(q.id, dropped);
                  }}
                  onClick={() => {
                    if (!isLocked && armedOptionId) {
                      assignBankOptionToQuestion(q.id, armedOptionId);
                    }
                  }}
                  className={`rounded-xl border p-3.5 transition ${
                    detail
                      ? detail.isCorrect
                        ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20"
                        : "border-red-300 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20"
                      : dragOverQuestionId === q.id || armedOptionId
                      ? "border-emerald-400 border-dashed bg-emerald-50/30 dark:border-emerald-600 dark:bg-emerald-950/20"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-1.5 text-[11px] font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        {q.number}
                      </span>
                      <span>{q.prompt}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!isLocked && selectedId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAnswerChange(q.id, "");
                          }}
                          aria-label={isEn ? `Clear heading for Q${q.number}` : `Xóa tiêu đề câu ${q.number}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600 dark:border-slate-700 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {renderFlagButton(q)}
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <select
                      disabled={isLocked}
                      value={selectedId}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!next) onAnswerChange(q.id, "");
                        else assignBankOptionToQuestion(q.id, next);
                      }}
                      aria-label={
                        isEn
                          ? `Select heading for question ${q.number}`
                          : `Chọn tiêu đề cho câu ${q.number}`
                      }
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="">
                        {isEn ? "— Select a heading —" : "— Chọn tiêu đề phù hợp —"}
                      </option>
                      {bankItems.map((h) => {
                        const usedElsewhere =
                          isSingleUseBank &&
                          usedBankMap.has(h.id) &&
                          usedBankMap.get(h.id) !== q.id;
                        return (
                          <option key={h.id} value={h.id} disabled={usedElsewhere}>
                            {h.id}. {h.text !== h.id ? h.text : h.id}
                            {usedElsewhere ? (isEn ? " (used)" : " (đã dùng)") : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {renderGroupReviewDrawer()}
        </div>
      );
    }

    // 5. MATCHING SENTENCE ENDINGS (Stems with inline drop-zone + stacked bank below)
    if (type === "matching_sentence_endings") {
      return (
        <div className="space-y-4">
          <div className="space-y-3">
            {questions.map((q) => {
              const tpl = promptToBlankTemplate(q.prompt, q.number);
              return (
                <div
                  key={q.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-3.5 text-sm leading-7 text-slate-800 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-100"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" />
                    <div>{renderTemplateText(tpl, "bank")}</div>
                  </div>
                  {renderFlagButton(q)}
                </div>
              );
            })}
          </div>

          {renderBankTray("stacked")}
          {renderGroupReviewDrawer()}
        </div>
      );
    }

    // 6. SUMMARY COMPLETION WITH WORD BANK (Flowing summary drop-zones + chip bank)
    if (type === "summary_completion" && bankItems.length > 0) {
      const display = resolveGroupDisplayContent(group, questions, isEn);
      const summaryText =
        display?.text ||
        questions.map((q) => promptToBlankTemplate(q.prompt, q.number)).join(" ");

      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 text-sm leading-8 text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100">
            {group.title && (
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {group.title}
              </h4>
            )}
            {summaryText.split(/\n\n+/).map((para, pIdx) => (
              <p key={pIdx}>{renderTemplateText(para, "bank")}</p>
            ))}
          </div>

          {!isLocked && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span>{isEn ? "Flag:" : "Đánh dấu:"}</span>
              {questions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onToggleFlag(q.id)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold cursor-pointer ${
                    flagged[q.id]
                      ? "border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700"
                  }`}
                >
                  <Flag className="h-2.5 w-2.5" />
                  {q.number}
                </button>
              ))}
            </div>
          )}

          {renderBankTray("chips")}
          {renderGroupReviewDrawer()}
        </div>
      );
    }

    // 7. COMPLETION TYPES WITH INLINE TEXT INPUTS:
    //    table_completion, flowchart_completion, note_completion, summary_completion (typed),
    //    sentence_completion, short_answer
    const display = resolveGroupDisplayContent(group, questions, isEn);

    const renderCompactFlagRow = () => {
      if (isLocked) return null;
      return (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <span>{isEn ? "Flag for review:" : "Đánh dấu xem lại:"}</span>
          {questions.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => onToggleFlag(q.id)}
              aria-pressed={Boolean(flagged[q.id])}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                flagged[q.id]
                  ? "border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700"
              }`}
            >
              <Flag className="h-2.5 w-2.5" />
              {q.number}
            </button>
          ))}
        </div>
      );
    };

    if (display?.kind === "table" && display.table) {
      const { title, headers, rows } = display.table;
      return (
        <div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                {title && (
                  <tr className="border-b border-slate-200 bg-emerald-50/70 dark:border-slate-800 dark:bg-emerald-950/30">
                    <th
                      colSpan={Math.max(1, headers.length)}
                      className="px-4 py-2.5 text-center text-sm font-bold text-slate-900 dark:text-white"
                    >
                      {title}
                    </th>
                  </tr>
                )}
                {headers.length > 0 && (
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                    {headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        scope="col"
                        className="border-r last:border-r-0 border-slate-200 px-3.5 py-2.5 font-bold text-slate-700 dark:border-slate-800 dark:text-slate-200"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => {
                      const lines = cell.split(/\n+/).map((l) => l.trim()).filter(Boolean);
                      return (
                        <td
                          key={cIdx}
                          className="border-r last:border-r-0 border-slate-200 px-3.5 py-3 align-top leading-7 text-slate-800 dark:border-slate-800 dark:text-slate-200"
                        >
                          {lines.length > 1 ? (
                            <ul className="list-disc space-y-1 pl-4">
                              {lines.map((line, lIdx) => (
                                <li key={lIdx}>
                                  {renderTemplateText(line.replace(/^[•*-]\s*/, ""), "input")}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            renderTemplateText(cell, "input")
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderCompactFlagRow()}
          {renderGroupReviewDrawer()}
        </div>
      );
    }

    if (display?.kind === "flowchart" && display.flowchart) {
      const { title, steps } = display.flowchart;
      return (
        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2 dark:border-slate-800 dark:bg-slate-900/60">
            {title && (
              <h4 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                {title}
              </h4>
            )}
            <div className="space-y-2">
              {steps.map((step, sIdx) => (
                <React.Fragment key={sIdx}>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-7 text-slate-800 dark:border-slate-700/80 dark:bg-slate-950/60 dark:text-slate-100">
                    {renderTemplateText(step, "input")}
                  </div>
                  {sIdx < steps.length - 1 && (
                    <div className="flex justify-center py-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
                      <ArrowDown className="h-4 w-4" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          {renderCompactFlagRow()}
          {renderGroupReviewDrawer()}
        </div>
      );
    }

    if (display?.kind === "notes" && display.notes) {
      const { title, sections } = display.notes;
      return (
        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900/60">
            {title && (
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {title}
              </h4>
            )}
            {sections.map((sec, sIdx) => (
              <div key={sIdx} className="space-y-2">
                {sec.heading && (
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    {sec.heading}
                  </p>
                )}
                <ul className="list-disc space-y-2.5 pl-5 text-sm leading-8 text-slate-800 dark:text-slate-100">
                  {sec.bullets.map((bullet, bIdx) => (
                    <li key={bIdx}>{renderTemplateText(bullet, "input")}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {renderCompactFlagRow()}
          {renderGroupReviewDrawer()}
        </div>
      );
    }

    if (display?.kind === "summary" && display.text) {
      return (
        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 text-sm leading-8 text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100">
            {group.title && (
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {group.title}
              </h4>
            )}
            {display.text.split(/\n\n+/).map((para, pIdx) => (
              <p key={pIdx}>{renderTemplateText(para, "input")}</p>
            ))}
          </div>
          {renderCompactFlagRow()}
          {renderGroupReviewDrawer()}
        </div>
      );
    }

    if (display?.kind === "plain" && display.text) {
      const lines = display.text.split(/\n+/).filter(Boolean);
      return (
        <div>
          <div className="space-y-3">
            {lines.map((line, lIdx) => (
              <div
                key={lIdx}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-8 text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100"
              >
                {renderTemplateText(line, "input")}
              </div>
            ))}
          </div>
          {renderCompactFlagRow()}
          {renderGroupReviewDrawer()}
        </div>
      );
    }

    // Short Answer fallback (clean numbered questions + word-counted input)
    return (
      <div className="space-y-4">
        {questions.map((q) => {
          const val = answers[q.id] ?? "";
          const detail = detailById.get(q.id);
          const effectiveLimit = parseWordLimitFromText(q.prompt) ?? group.wordLimit;
          const warning = checkWordLimitSoftWarning(val, effectiveLimit, isEn);

          return (
            <div
              key={q.id}
              id={`question-card-${q.id}`}
              className={`rounded-xl border p-4 transition ${
                detail
                  ? detail.isCorrect
                    ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20"
                    : "border-red-300 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <label
                  htmlFor={`input-${q.id}`}
                  className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-slate-900 dark:text-white"
                >
                  <span className="mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                    {q.number}
                  </span>
                  <span>{stripLegacyPromptPrefix(q.prompt)}</span>
                </label>
                {renderFlagButton(q)}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-8">
                <input
                  id={`input-${q.id}`}
                  type="text"
                  disabled={isLocked}
                  value={val}
                  onChange={(e) => onAnswerChange(q.id, e.target.value)}
                  aria-invalid={warning.exceeded || (detail ? !detail.isCorrect : undefined)}
                  placeholder={isEn ? "Type your answer..." : "Nhập câu trả lời..."}
                  className={`min-h-[44px] w-full max-w-md rounded-xl border px-3.5 py-2 text-sm font-medium transition focus:outline-none ${
                    warning.exceeded
                      ? "border-amber-500 bg-amber-50/50 text-slate-900 ring-2 ring-amber-400/30 dark:bg-amber-950/30 dark:text-white"
                      : "border-slate-200 bg-white text-slate-900 focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  }`}
                />
                {!isLocked && warning.wordCount > 0 && effectiveLimit?.maxWords ? (
                  <span
                    role="status"
                    aria-live="polite"
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
                      warning.exceeded
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {warning.exceeded && <AlertTriangle className="h-3.5 w-3.5" />}
                    {warning.wordCount}/{effectiveLimit.maxWords} {isEn ? "words" : "từ"}
                  </span>
                ) : null}
              </div>

              {!isLocked && warning.exceeded && warning.message && (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-1.5 text-xs font-medium text-amber-700 sm:pl-8 dark:text-amber-300"
                >
                  {warning.message}
                </p>
              )}

              {renderQuestionExplanation(q)}
            </div>
          );
        })}
      </div>
    );
  };

  const groupScore = useMemo(() => {
    if (!graded) return null;
    let correct = 0;
    let total = 0;
    for (const q of questions) {
      const d = detailById.get(q.id);
      if (d) {
        total += 1;
        if (d.isCorrect) correct += 1;
      }
    }
    return total > 0 ? { correct, total } : null;
  }, [graded, questions, detailById]);

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      {/* Shared Group Header */}
      <div className="space-y-1.5 border-b border-slate-100 pb-3.5 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            {rangeLabel}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {groupScore && (
              <Badge
                variant={
                  groupScore.correct / groupScore.total >= 0.7
                    ? "default"
                    : "amber"
                }
              >
                {isEn
                  ? `${groupScore.correct}/${groupScore.total} correct`
                  : `Đúng ${groupScore.correct}/${groupScore.total}`}
              </Badge>
            )}
            <Badge variant="secondary">
              {getQuestionTypeLabel(group.type, isEn)}
            </Badge>
            {wordLimitBadge && (
              <Badge variant="amber">{wordLimitBadge}</Badge>
            )}
          </div>
        </div>
        {group.instruction && (
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {group.instruction}
          </p>
        )}
      </div>

      {renderGroupBody()}
    </Card>
  );
}
