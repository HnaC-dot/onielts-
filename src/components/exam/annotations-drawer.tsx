"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BookmarkPlus,
  Highlighter,
  LocateFixed,
  Pencil,
  StickyNote,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { ExamAnnotationColor, ExamTextAnnotation } from "@/lib/exam-session";
import { filterAnnotations, prepareFlashcardTerm } from "@/lib/exam-annotations";
import { openAddFlashcardModal } from "@/components/flashcard-quick-add";

interface AnnotationsDrawerProps {
  open: boolean;
  onClose: () => void;
  annotations: ExamTextAnnotation[];
  sectionLabelsById: Record<string, string>;
  notesText: string;
  onNotesTextChange: (next: string) => void;
  canUndo: boolean;
  onUndo: () => void;
  onJumpToAnnotation: (annotation: ExamTextAnnotation) => void;
  onUpdateAnnotation: (
    id: string,
    patch: { color?: ExamAnnotationColor; note?: string | null }
  ) => void;
  onDeleteAnnotation: (id: string) => void;
  onClearAllAnnotations: () => void;
  isEn: boolean;
}

export function AnnotationsDrawer({
  open,
  onClose,
  annotations,
  sectionLabelsById,
  notesText,
  onNotesTextChange,
  canUndo,
  onUndo,
  onJumpToAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onClearAllAnnotations,
  isEn,
}: AnnotationsDrawerProps) {
  const [activeTab, setActiveTab] = useState<"annotations" | "scratchpad">(
    "annotations"
  );
  const [onlyNotes, setOnlyNotes] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const noteCount = useMemo(
    () => annotations.filter((a) => Boolean(a.note?.trim())).length,
    [annotations]
  );

  const visibleAnnotations = useMemo(
    () => filterAnnotations(annotations, { onlyNotes }),
    [annotations, onlyNotes]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? "My Notes and Highlights" : "Ghi chú của tôi"}
      data-no-flashcard-popup="true"
      className="fixed inset-0 z-[55] flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setConfirmClear(false);
          onClose();
        }
      }}
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEn ? "My Notes & Highlights" : "Ghi chú của tôi"}
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {annotations.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              title={isEn ? "Undo (Ctrl/Cmd+Z)" : "Hoàn tác (Ctrl/Cmd+Z)"}
              aria-label={isEn ? "Undo annotation change" : "Hoàn tác thao tác đánh dấu"}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {isEn ? "Undo" : "Hoàn tác"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmClear(false);
                onClose();
              }}
              aria-label={isEn ? "Close drawer" : "Đóng ngăn kéo ghi chú"}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Drawer Tabs */}
        <div className="grid grid-cols-2 gap-1.5 border-b border-slate-200 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-950/60">
          <button
            type="button"
            onClick={() => setActiveTab("annotations")}
            className={`min-h-[40px] rounded-xl px-3 text-xs font-bold transition cursor-pointer ${
              activeTab === "annotations"
                ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            {isEn
              ? `Highlights (${annotations.length})`
              : `Tô sáng & Ghi chú (${annotations.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scratchpad")}
            className={`min-h-[40px] rounded-xl px-3 text-xs font-bold transition cursor-pointer ${
              activeTab === "scratchpad"
                ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
            }`}
          >
            {isEn ? "Scratchpad Notes" : "Ghi chú nháp tự do"}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === "annotations" ? (
            <>
              {/* Filter + Clear All bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => setOnlyNotes(false)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                      !onlyNotes
                        ? "bg-emerald-600 text-white"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {isEn ? `All (${annotations.length})` : `Tất cả (${annotations.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlyNotes(true)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                      onlyNotes
                        ? "bg-emerald-600 text-white"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {isEn ? `Notes (${noteCount})` : `Có ghi chú (${noteCount})`}
                  </button>
                </div>

                {annotations.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {confirmClear ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onClearAllAnnotations();
                            setConfirmClear(false);
                          }}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 cursor-pointer"
                        >
                          {isEn ? "Confirm clear" : "Xác nhận xóa"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClear(false)}
                          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {isEn ? "Cancel" : "Hủy"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClear(true)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        {isEn ? "Clear all" : "Xóa tất cả"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {visibleAnnotations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
                  <Highlighter className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {onlyNotes
                      ? isEn
                        ? "No notes attached yet."
                        : "Chưa có ghi chú nào được gắn vào đoạn văn."
                      : isEn
                      ? "No highlights or notes yet."
                      : "Chưa có đoạn tô sáng hoặc ghi chú nào."}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {isEn
                      ? "Select any phrase in the passage to highlight, add notes, copy, or save to Flashcards."
                      : "Bôi đen bất kỳ cụm từ nào trong bài đọc để tô sáng, thêm ghi chú, sao chép hoặc lưu vào Flashcard."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleAnnotations.map((ann) => {
                    const secLabel =
                      sectionLabelsById[ann.sectionId] ??
                      (isEn ? "Passage" : "Bài đọc");
                    const isEditing = editingId === ann.id;
                    return (
                      <div
                        key={ann.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 transition hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-emerald-800 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                ann.color === "sky"
                                  ? "bg-sky-400"
                                  : "bg-amber-400"
                              }`}
                            />
                            <span>{secLabel}</span>
                            <span>·</span>
                            <span>
                              {isEn
                                ? `Para ${ann.paragraphIndex + 1}`
                                : `Đoạn ${ann.paragraphIndex + 1}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onJumpToAnnotation(ann)}
                              title={isEn ? "Jump to passage" : "Đi tới đoạn văn"}
                              aria-label={isEn ? "Jump to passage" : "Đi tới đoạn văn"}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-emerald-700 dark:hover:bg-slate-800 dark:hover:text-emerald-300 cursor-pointer"
                            >
                              <LocateFixed className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const term = prepareFlashcardTerm(ann.text);
                                if (term) openAddFlashcardModal(term);
                              }}
                              title={isEn ? "Save to Flashcard" : "Lưu vào Flashcard"}
                              aria-label={isEn ? "Save to Flashcard" : "Lưu vào Flashcard"}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/60 cursor-pointer"
                            >
                              <BookmarkPlus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(ann.id);
                                setEditDraft(ann.note ?? "");
                              }}
                              title={isEn ? "Edit note" : "Sửa ghi chú"}
                              aria-label={isEn ? "Edit note" : "Sửa ghi chú"}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteAnnotation(ann.id)}
                              title={isEn ? "Delete" : "Xóa"}
                              aria-label={isEn ? "Delete highlight" : "Xóa tô sáng"}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onJumpToAnnotation(ann)}
                          className="block w-full text-left text-xs leading-relaxed text-slate-800 hover:text-emerald-800 dark:text-slate-200 dark:hover:text-emerald-300 cursor-pointer"
                        >
                          <span
                            className={`rounded-xs px-1 py-0.5 ${
                              ann.color === "sky"
                                ? "bg-sky-200/75 dark:bg-sky-500/30"
                                : "bg-amber-200/75 dark:bg-amber-500/30"
                            }`}
                          >
                            &ldquo;{ann.text}&rdquo;
                          </span>
                        </button>

                        {isEditing ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              autoFocus
                              rows={2}
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              placeholder={
                                isEn
                                  ? "Write your note..."
                                  : "Nhập ghi chú cho đoạn này..."
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                {isEn ? "Cancel" : "Hủy"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateAnnotation(ann.id, {
                                    note: editDraft,
                                  });
                                  setEditingId(null);
                                }}
                                className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                              >
                                {isEn ? "Save" : "Lưu"}
                              </button>
                            </div>
                          </div>
                        ) : ann.note ? (
                          <p className="rounded-xl border border-emerald-200/70 bg-white px-2.5 py-2 text-xs text-slate-700 dark:border-emerald-900/60 dark:bg-slate-900 dark:text-slate-300 whitespace-pre-wrap">
                            {ann.note}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor="exam-scratchpad-textarea"
                className="block text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                {isEn
                  ? "Freeform Exam Scratchpad (auto-saved)"
                  : "Ghi chú nháp tự do trong khi làm bài (tự động lưu)"}
              </label>
              <textarea
                id="exam-scratchpad-textarea"
                rows={12}
                value={notesText}
                onChange={(e) => onNotesTextChange(e.target.value)}
                placeholder={
                  isEn
                    ? "Jot down keywords, numbers, paraphrases, or paragraph outlines..."
                    : "Ghi nhanh từ khóa, con số, từ đồng nghĩa hoặc dàn ý đoạn văn..."
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}
        </div>

        {/* Footer Tip */}
        <div className="border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {isEn
            ? "Tip: Press Ctrl/Cmd+Z anytime to undo your last highlight or note change."
            : "Mẹo: Nhấn Ctrl/Cmd+Z bất cứ lúc nào để hoàn tác thao tác tô sáng hoặc ghi chú gần nhất."}
        </div>
      </div>
    </div>
  );
}
