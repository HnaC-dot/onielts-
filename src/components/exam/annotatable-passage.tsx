"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  Check,
  Copy,
  Highlighter,
  MessageSquarePlus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import type { ExamAnnotationColor, ExamTextAnnotation } from "@/lib/exam-session";
import type { PassageParagraph } from "@/lib/test-groups";
import {
  buildParagraphSegments,
  createAnnotationId,
  prepareFlashcardTerm,
  splitSelectionAcrossParagraphs,
  type SplitParagraphRange,
} from "@/lib/exam-annotations";
import { openAddFlashcardModal } from "@/components/flashcard-quick-add";

interface AnnotatablePassageProps {
  sectionId: string;
  paragraphs: PassageParagraph[];
  annotations: ExamTextAnnotation[];
  textSizeClass: string;
  isEn: boolean;
  flashedAnnotationId?: string | null;
  highlightedEvidenceParagraphIndex?: number | null;
  evidenceBadgeText?: string | null;
  onAddAnnotations: (items: ExamTextAnnotation[]) => void;
  onUpdateAnnotation: (
    id: string,
    patch: { color?: ExamAnnotationColor; note?: string | null }
  ) => void;
  onDeleteAnnotation: (id: string) => void;
  showHint?: boolean;
}

interface PendingSelectionState {
  chunks: SplitParagraphRange[];
  fullText: string;
  x: number;
  y: number;
  placeBelow: boolean;
}

interface ActivePopoverState {
  annotationId: string;
  x: number;
  y: number;
  placeBelow: boolean;
  editingNote: boolean;
  noteDraft: string;
}

const MARK_COLOR_CLASSES: Record<ExamAnnotationColor, string> = {
  amber:
    "bg-amber-200/85 text-slate-950 hover:bg-amber-300/90 dark:bg-amber-500/35 dark:text-amber-50 dark:hover:bg-amber-500/50",
  sky: "bg-sky-200/85 text-slate-950 hover:bg-sky-300/90 dark:bg-sky-500/35 dark:text-sky-50 dark:hover:bg-sky-500/50",
  emerald:
    "bg-emerald-200/85 text-slate-950 hover:bg-emerald-300/90 dark:bg-emerald-500/35 dark:text-emerald-50 dark:hover:bg-emerald-500/50",
  rose: "bg-rose-200/85 text-slate-950 hover:bg-rose-300/90 dark:bg-rose-500/35 dark:text-rose-50 dark:hover:bg-rose-500/50",
};

function findParagraphElement(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;
  return el ? el.closest<HTMLElement>("[data-paragraph-index]") : null;
}

/**
 * Computes the exact plain-text character offset of `(targetNode, targetOffset)`
 * inside a `[data-paragraph-index]` element, skipping any UI decoration spans
 * marked with `data-annotation-ui="true"`.
 */
function getCharacterOffsetInParagraph(
  paragraphEl: HTMLElement,
  targetNode: Node,
  targetOffset: number
): number {
  let resolvedNode: Node = targetNode;
  let resolvedOffset = targetOffset;

  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    const el = targetNode as HTMLElement;
    const childCount = el.childNodes.length;
    if (targetOffset >= childCount) {
      // End of element: measure full text length up to the end of `el`
      let total = 0;
      const walker = document.createTreeWalker(paragraphEl, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        if (!current.parentElement?.closest("[data-annotation-ui='true']")) {
          total += current.textContent?.length ?? 0;
        }
        if (el.contains(current)) {
          // keep going until last text inside el
        } else if (
          el.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING
        ) {
          break;
        }
        current = walker.nextNode();
      }
      return total;
    }
    resolvedNode = el.childNodes[targetOffset];
    resolvedOffset = 0;
  }

  let offset = 0;
  const walker = document.createTreeWalker(paragraphEl, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.parentElement?.closest("[data-annotation-ui='true']")) {
      current = walker.nextNode();
      continue;
    }
    if (current === resolvedNode) {
      return offset + Math.min(resolvedOffset, current.textContent?.length ?? 0);
    }
    if (resolvedNode.contains(current)) {
      return offset;
    }
    if (
      resolvedNode.compareDocumentPosition(current) &
      Node.DOCUMENT_POSITION_FOLLOWING
    ) {
      return offset;
    }
    offset += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return offset;
}

function clampPopoverPosition(
  rect: DOMRect,
  popoverWidth: number
): { x: number; y: number; placeBelow: boolean } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const centerX = rect.left + rect.width / 2;
  const half = popoverWidth / 2;
  const x = Math.min(vw - half - 12, Math.max(half + 12, centerX));
  const placeBelow = rect.top < 92;
  const y = placeBelow ? rect.bottom + 10 : rect.top - 10;
  return { x, y, placeBelow };
}

async function copyTextSafe(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function AnnotatablePassage({
  sectionId,
  paragraphs,
  annotations,
  textSizeClass,
  isEn,
  flashedAnnotationId = null,
  highlightedEvidenceParagraphIndex = null,
  evidenceBadgeText = null,
  onAddAnnotations,
  onUpdateAnnotation,
  onDeleteAnnotation,
  showHint = true,
}: AnnotatablePassageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [pendingSelection, setPendingSelection] =
    useState<PendingSelectionState | null>(null);
  const [newNoteMode, setNewNoteMode] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteColor, setNewNoteColor] = useState<ExamAnnotationColor>("amber");
  const [activePopover, setActivePopover] = useState<ActivePopoverState | null>(
    null
  );
  const [copiedToast, setCopiedToast] = useState(false);

  const sectionAnnotations = useMemo(
    () => annotations.filter((a) => a.sectionId === sectionId),
    [annotations, sectionId]
  );

  const annotationsByParagraph = useMemo(() => {
    const map = new Map<number, ExamTextAnnotation[]>();
    for (const ann of sectionAnnotations) {
      const list = map.get(ann.paragraphIndex) ?? [];
      list.push(ann);
      map.set(ann.paragraphIndex, list);
    }
    return map;
  }, [sectionAnnotations]);

  const activeAnnotation = useMemo(() => {
    if (!activePopover) return null;
    return (
      sectionAnnotations.find((a) => a.id === activePopover.annotationId) ?? null
    );
  }, [activePopover, sectionAnnotations]);

  const dismissAllPopups = useCallback(() => {
    setPendingSelection(null);
    setNewNoteMode(false);
    setNewNoteText("");
    setActivePopover(null);
  }, []);

  // Dismiss popups on outside click or Escape
  useEffect(() => {
    if (!pendingSelection && !activePopover) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (toolbarRef.current && target && toolbarRef.current.contains(target)) {
        return;
      }
      if (popoverRef.current && target && popoverRef.current.contains(target)) {
        return;
      }
      // Allow clicking on a mark to switch directly to that mark's popover
      const targetEl =
        target?.nodeType === Node.ELEMENT_NODE
          ? (target as HTMLElement)
          : target?.parentElement;
      if (targetEl?.closest("mark[data-annotation-id]")) {
        setPendingSelection(null);
        setNewNoteMode(false);
        return;
      }
      dismissAllPopups();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissAllPopups();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingSelection, activePopover, dismissAllPopups]);

  // Dismiss floating selection toolbar (when not actively typing a note) on scroll
  useEffect(() => {
    if (!pendingSelection || newNoteMode) return;
    const handleScroll = () => {
      setPendingSelection(null);
    };
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () =>
      window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [pendingSelection, newNoteMode]);

  const captureCurrentSelection = useCallback(() => {
    if (typeof window === "undefined") return;
    const container = containerRef.current;
    if (!container) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      return;
    }

    const range = sel.getRangeAt(0);
    if (
      !container.contains(range.startContainer) ||
      !container.contains(range.endContainer)
    ) {
      return;
    }

    const startParaEl = findParagraphElement(range.startContainer);
    const endParaEl = findParagraphElement(range.endContainer);
    if (!startParaEl || !endParaEl) return;

    const startPIdx = Number.parseInt(
      startParaEl.dataset.paragraphIndex ?? "",
      10
    );
    const endPIdx = Number.parseInt(endParaEl.dataset.paragraphIndex ?? "", 10);
    if (!Number.isFinite(startPIdx) || !Number.isFinite(endPIdx)) return;

    const startOffset = getCharacterOffsetInParagraph(
      startParaEl,
      range.startContainer,
      range.startOffset
    );
    const endOffset = getCharacterOffsetInParagraph(
      endParaEl,
      range.endContainer,
      range.endOffset
    );

    const chunks = splitSelectionAcrossParagraphs(paragraphs, {
      startParagraphIndex: startPIdx,
      startOffset,
      endParagraphIndex: endPIdx,
      endOffset,
    });

    if (chunks.length === 0) return;

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const fullText = chunks.map((c) => c.text).join(" ");
    const pos = clampPopoverPosition(rect, 272);

    setActivePopover(null);
    setNewNoteMode(false);
    setNewNoteText("");
    setNewNoteColor("amber");
    setPendingSelection({
      chunks,
      fullText,
      x: pos.x,
      y: pos.y,
      placeBelow: pos.placeBelow,
    });
  }, [paragraphs]);

  const handleApplyHighlight = (
    color: ExamAnnotationColor,
    note?: string
  ) => {
    if (!pendingSelection) return;
    const now = new Date().toISOString();
    const cleanedNote = note?.trim() ? note.trim() : undefined;
    const items: ExamTextAnnotation[] = pendingSelection.chunks.map(
      (chunk, idx) => ({
        id: createAnnotationId(),
        sectionId,
        paragraphIndex: chunk.paragraphIndex,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        text: chunk.text,
        color,
        // Attach note to the first chunk of a multi-paragraph selection so it isn't duplicated
        note: idx === 0 ? cleanedNote : undefined,
        createdAt: now,
      })
    );
    onAddAnnotations(items);
    window.getSelection()?.removeAllRanges();
    dismissAllPopups();
  };

  const handleCopyText = async (text: string) => {
    const ok = await copyTextSafe(text);
    if (ok) {
      setCopiedToast(true);
      window.setTimeout(() => setCopiedToast(false), 1600);
    }
    window.getSelection()?.removeAllRanges();
    setPendingSelection(null);
    setNewNoteMode(false);
  };

  const handleSaveToFlashcard = (text: string) => {
    const cleaned = prepareFlashcardTerm(text);
    if (!cleaned) return;
    window.getSelection()?.removeAllRanges();
    dismissAllPopups();
    openAddFlashcardModal(cleaned);
  };

  const handleClickMark = (
    e: React.MouseEvent<HTMLElement>,
    ann: ExamTextAnnotation
  ) => {
    // Do not intercept if the learner just dragged a text selection across this mark
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      return;
    }
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = clampPopoverPosition(rect, 310);
    setPendingSelection(null);
    setNewNoteMode(false);
    setActivePopover({
      annotationId: ann.id,
      x: pos.x,
      y: pos.y,
      placeBelow: pos.placeBelow,
      editingNote: false,
      noteDraft: ann.note ?? "",
    });
  };

  const handleToolbarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")
    );
    if (buttons.length === 0) return;
    const currentIdx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = buttons[(currentIdx + 1 + buttons.length) % buttons.length];
      next?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = buttons[(currentIdx - 1 + buttons.length) % buttons.length];
      prev?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      buttons[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      buttons[buttons.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      dismissAllPopups();
    }
  };

  return (
    <div
      ref={containerRef}
      data-no-flashcard-popup="true"
      data-section-id={sectionId}
      onMouseUp={captureCurrentSelection}
      onTouchEnd={() => {
        window.setTimeout(captureCurrentSelection, 30);
      }}
      onKeyUp={(e) => {
        if (e.shiftKey || e.key === "Shift") {
          captureCurrentSelection();
        }
      }}
      className="relative space-y-4"
    >
      {showHint && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Highlighter className="h-3.5 w-3.5 text-amber-500" />
            {isEn
              ? "Select any text below to highlight, add a note, copy, or save directly to Flashcards."
              : "Bôi đen bất kỳ đoạn chữ nào bên dưới để tô sáng, thêm ghi chú, sao chép hoặc lưu vào Flashcard."}
          </span>
          {copiedToast && (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            >
              <Check className="h-3 w-3" />
              {isEn ? "Copied!" : "Đã sao chép!"}
            </span>
          )}
        </div>
      )}

      {/* Passage paragraphs rendered cleanly from lossless offset segments */}
      <div
        className={`space-y-4 ${textSizeClass} text-slate-800 dark:text-slate-200 selection:bg-emerald-200/70 dark:selection:bg-emerald-700/60`}
      >
        {paragraphs.map((para) => {
          const paraAnnotations = annotationsByParagraph.get(para.index) ?? [];
          const segments = buildParagraphSegments(para.text, paraAnnotations);
          const isEvidenceHighlighted =
            highlightedEvidenceParagraphIndex === para.index;
          return (
            <div
              key={para.index}
              className={
                isEvidenceHighlighted
                  ? "rounded-xl border-l-4 border-emerald-500 bg-emerald-50/80 px-3.5 py-2.5 -mx-3.5 ring-1 ring-emerald-200 transition-all dark:bg-emerald-950/40 dark:ring-emerald-800/70"
                  : "transition-all"
              }
            >
              {isEvidenceHighlighted && evidenceBadgeText && (
                <div
                  data-annotation-ui="true"
                  className="mb-1.5 inline-flex select-none items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs"
                >
                  {evidenceBadgeText}
                </div>
              )}
              {(() => {
                const Tag =
                  para.kind === "passage-title" || para.kind === "heading"
                    ? "h3"
                    : "p";
                const blockClass =
                  para.kind === "passage-title"
                    ? "reading-passage-title whitespace-pre-line"
                    : para.kind === "heading"
                    ? "ht-tests-h3 whitespace-pre-line text-slate-900 dark:text-white"
                    : "whitespace-pre-line";
                return (
                  <Tag
                    data-paragraph-index={para.index}
                    className={blockClass}
                  >
                    {segments.map((seg, idx) => {
                      if (seg.type === "text" || !seg.annotation) {
                        return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
                      }
                      const ann = seg.annotation;
                      const hasNote = Boolean(ann.note && ann.note.trim().length > 0);
                      const isFlashed = flashedAnnotationId === ann.id;
                      const colorCls =
                        MARK_COLOR_CLASSES[ann.color] ?? MARK_COLOR_CLASSES.amber;
                      return (
                        <mark
                          key={ann.id}
                          data-annotation-id={ann.id}
                          role="button"
                          tabIndex={0}
                          title={
                            hasNote
                              ? ann.note
                              : isEn
                              ? "Click to change color, add note, save to flashcard, or remove"
                              : "Nhấn để đổi màu, thêm ghi chú, lưu Flashcard hoặc xóa"
                          }
                          onClick={(e) => handleClickMark(e, ann)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pos = clampPopoverPosition(rect, 310);
                              setPendingSelection(null);
                              setNewNoteMode(false);
                              setActivePopover({
                                annotationId: ann.id,
                                x: pos.x,
                                y: pos.y,
                                placeBelow: pos.placeBelow,
                                editingNote: false,
                                noteDraft: ann.note ?? "",
                              });
                            }
                          }}
                          className={`cursor-pointer rounded-xs px-0.5 transition ${colorCls} ${
                            hasNote
                              ? "underline decoration-emerald-600/85 decoration-2 underline-offset-2 dark:decoration-emerald-400"
                              : ""
                          } ${
                            isFlashed
                              ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 animate-pulse"
                              : ""
                          }`}
                        >
                          {seg.text}
                          {hasNote && (
                            <span
                              data-annotation-ui="true"
                              aria-hidden="true"
                              className="ml-0.5 inline-flex select-none align-super text-emerald-700 dark:text-emerald-300"
                            >
                              <StickyNote className="h-3 w-3" />
                            </span>
                          )}
                        </mark>
                      );
                    })}
                  </Tag>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* FLOATING 5-BUTTON SELECTION TOOLBAR (Color 1, Color 2, Note, Copy, Save to Flashcard) */}
      {pendingSelection && !newNoteMode && (
        <div
          ref={toolbarRef}
          role="toolbar"
          aria-label={
            isEn
              ? "Highlight, note, copy, and flashcard tools"
              : "Thanh công cụ tô sáng, ghi chú, sao chép và Flashcard"
          }
          data-no-flashcard-popup="true"
          onKeyDown={handleToolbarKeyDown}
          style={{
            left: `${pendingSelection.x}px`,
            top: `${pendingSelection.y}px`,
            transform: pendingSelection.placeBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
          className="fixed z-[60] flex items-center gap-1 rounded-2xl border border-slate-200/90 bg-white/98 p-1.5 shadow-xl ring-1 ring-slate-950/5 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/98 dark:ring-white/10"
        >
          {/* 1. Highlight Color 1 (Amber / Yellow) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleApplyHighlight("amber")}
            aria-label={isEn ? "Highlight yellow" : "Tô sáng vàng"}
            title={isEn ? "Highlight yellow" : "Tô sáng vàng"}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/70 cursor-pointer"
          >
            <span className="relative flex items-center justify-center">
              <Highlighter className="h-4 w-4" />
              <span
                aria-hidden="true"
                className="absolute -right-1 -bottom-1 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-white dark:ring-slate-900"
              />
            </span>
          </button>

          {/* 2. Highlight Color 2 (Sky Blue) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleApplyHighlight("sky")}
            aria-label={isEn ? "Highlight blue" : "Tô sáng xanh dương"}
            title={isEn ? "Highlight blue" : "Tô sáng xanh dương"}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-sky-800/80 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/70 cursor-pointer"
          >
            <span className="relative flex items-center justify-center">
              <Highlighter className="h-4 w-4" />
              <span
                aria-hidden="true"
                className="absolute -right-1 -bottom-1 h-2 w-2 rounded-full bg-sky-500 ring-1 ring-white dark:ring-slate-900"
              />
            </span>
          </button>

          {/* 3. Add Note */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setNewNoteMode(true);
              setNewNoteText("");
              setNewNoteColor("amber");
            }}
            aria-label={isEn ? "Add note" : "Thêm ghi chú"}
            title={isEn ? "Add note" : "Thêm ghi chú"}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>

          {/* 4. Copy */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void handleCopyText(pendingSelection.fullText)}
            aria-label={isEn ? "Copy text" : "Sao chép"}
            title={isEn ? "Copy text" : "Sao chép"}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <Copy className="h-4 w-4" />
          </button>

          <div
            aria-hidden="true"
            className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700"
          />

          {/* 5. Save to Flashcard (Ôn IELTS integration) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSaveToFlashcard(pendingSelection.fullText)}
            aria-label={isEn ? "Save to Flashcard" : "Lưu vào Flashcard"}
            title={isEn ? "Save to Flashcard" : "Lưu vào Flashcard"}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
          >
            <BookmarkPlus className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Flashcard</span>
          </button>
        </div>
      )}

      {/* INLINE NEW-NOTE POPOVER */}
      {pendingSelection && newNoteMode && (
        <div
          ref={toolbarRef}
          role="dialog"
          aria-label={isEn ? "Add passage note" : "Thêm ghi chú đoạn văn"}
          data-no-flashcard-popup="true"
          style={{
            left: `${pendingSelection.x}px`,
            top: `${pendingSelection.y}px`,
            transform: pendingSelection.placeBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
          className="fixed z-[60] w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {isEn ? "Add Note to Selection" : "Thêm ghi chú cho đoạn đã chọn"}
            </span>
            <button
              type="button"
              onClick={dismissAllPopups}
              aria-label={isEn ? "Close" : "Đóng"}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="line-clamp-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] italic text-slate-600 dark:bg-slate-950 dark:text-slate-400">
            &ldquo;{pendingSelection.fullText}&rdquo;
          </p>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <span>{isEn ? "Color:" : "Màu:"}</span>
            {(["amber", "sky"] as const).map((clr) => (
              <button
                key={clr}
                type="button"
                onClick={() => setNewNoteColor(clr)}
                aria-label={
                  clr === "amber"
                    ? isEn
                      ? "Yellow"
                      : "Màu vàng"
                    : isEn
                    ? "Blue"
                    : "Màu xanh dương"
                }
                className={`h-6 w-6 rounded-full border-2 transition cursor-pointer ${
                  clr === "amber" ? "bg-amber-300" : "bg-sky-300"
                } ${
                  newNoteColor === clr
                    ? "border-emerald-600 scale-110"
                    : "border-transparent opacity-75 hover:opacity-100"
                }`}
              />
            ))}
          </div>
          <textarea
            autoFocus
            rows={3}
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                handleApplyHighlight(newNoteColor, newNoteText);
              }
            }}
            placeholder={
              isEn
                ? "Write your note, paraphrase, or keyword hint..."
                : "Nhập ghi chú, từ đồng nghĩa hoặc gợi ý trả lời..."
            }
            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={dismissAllPopups}
              className="min-h-[36px] rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              {isEn ? "Cancel" : "Hủy"}
            </button>
            <button
              type="button"
              onClick={() => handleApplyHighlight(newNoteColor, newNoteText)}
              className="min-h-[36px] rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
            >
              {isEn ? "Save Note" : "Lưu ghi chú"}
            </button>
          </div>
        </div>
      )}

      {/* EXISTING HIGHLIGHT / NOTE POPOVER (Recolor, View/Edit Note, Copy, Save Flashcard, Delete) */}
      {activePopover && activeAnnotation && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={isEn ? "Manage highlight" : "Tùy chỉnh đoạn tô sáng"}
          data-no-flashcard-popup="true"
          style={{
            left: `${activePopover.x}px`,
            top: `${activePopover.y}px`,
            transform: activePopover.placeBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
          className="fixed z-[60] w-80 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-xs font-medium italic text-slate-600 dark:text-slate-300">
              &ldquo;{activeAnnotation.text}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setActivePopover(null)}
              aria-label={isEn ? "Close" : "Đóng"}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Note view or inline editor */}
          {activePopover.editingNote ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                rows={3}
                value={activePopover.noteDraft}
                onChange={(e) =>
                  setActivePopover((prev) =>
                    prev ? { ...prev, noteDraft: e.target.value } : null
                  )
                }
                placeholder={
                  isEn ? "Edit note..." : "Nhập hoặc sửa ghi chú..."
                }
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setActivePopover((prev) =>
                      prev
                        ? {
                            ...prev,
                            editingNote: false,
                            noteDraft: activeAnnotation.note ?? "",
                          }
                        : null
                    )
                  }
                  className="min-h-[36px] rounded-xl px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {isEn ? "Cancel" : "Hủy"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateAnnotation(activeAnnotation.id, {
                      note: activePopover.noteDraft,
                    });
                    setActivePopover((prev) =>
                      prev ? { ...prev, editingNote: false } : null
                    );
                  }}
                  className="min-h-[36px] rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  {isEn ? "Save" : "Lưu"}
                </button>
              </div>
            </div>
          ) : activeAnnotation.note ? (
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-2.5 text-xs text-slate-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-slate-200">
              <p className="whitespace-pre-wrap">{activeAnnotation.note}</p>
            </div>
          ) : null}

          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
            {/* Color switcher */}
            <div className="flex items-center gap-1.5">
              {(["amber", "sky"] as const).map((clr) => (
                <button
                  key={clr}
                  type="button"
                  onClick={() =>
                    onUpdateAnnotation(activeAnnotation.id, { color: clr })
                  }
                  aria-label={
                    clr === "amber"
                      ? isEn
                        ? "Switch to yellow"
                        : "Đổi sang màu vàng"
                      : isEn
                      ? "Switch to blue"
                      : "Đổi sang màu xanh dương"
                  }
                  title={
                    clr === "amber"
                      ? isEn
                        ? "Yellow"
                        : "Màu vàng"
                      : isEn
                      ? "Blue"
                      : "Màu xanh"
                  }
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition cursor-pointer ${
                    clr === "amber"
                      ? "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300"
                  } ${
                    activeAnnotation.color === clr
                      ? "ring-2 ring-emerald-600"
                      : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <Highlighter className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>

            {/* Note / Copy / Flashcard / Delete */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setActivePopover((prev) =>
                    prev
                      ? {
                          ...prev,
                          editingNote: true,
                          noteDraft: activeAnnotation.note ?? "",
                        }
                      : null
                  )
                }
                aria-label={
                  activeAnnotation.note
                    ? isEn
                      ? "Edit note"
                      : "Sửa ghi chú"
                    : isEn
                    ? "Add note"
                    : "Thêm ghi chú"
                }
                title={
                  activeAnnotation.note
                    ? isEn
                      ? "Edit note"
                      : "Sửa ghi chú"
                    : isEn
                    ? "Add note"
                    : "Thêm ghi chú"
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => void handleCopyText(activeAnnotation.text)}
                aria-label={isEn ? "Copy text" : "Sao chép"}
                title={isEn ? "Copy text" : "Sao chép"}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleSaveToFlashcard(activeAnnotation.text)}
                aria-label={isEn ? "Save to Flashcard" : "Lưu vào Flashcard"}
                title={isEn ? "Save to Flashcard" : "Lưu vào Flashcard"}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 cursor-pointer"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onDeleteAnnotation(activeAnnotation.id);
                  setActivePopover(null);
                }}
                aria-label={isEn ? "Delete highlight" : "Xóa tô sáng"}
                title={isEn ? "Delete highlight" : "Xóa tô sáng"}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/60 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
