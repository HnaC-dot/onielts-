"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, RotateCcw, ShieldCheck, X } from "lucide-react";
import type { IeltsTest } from "@/lib/types";
import { DEFAULT_BAND_CONVERSIONS } from "@/lib/seed-data";
import {
  gradeObjectiveTest,
  sanitizeTestForClient,
  type GradedTestResult,
} from "@/lib/test-grader";
import { TestEngineClient } from "@/components/test-engine-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TestLivePreviewModalProps {
  open: boolean;
  onClose: () => void;
  draftTest: IeltsTest;
  initialSectionIdx?: number;
}

/**
 * Full-screen Live Learner-Mode Preview right inside Admin Test Builder (GĐ6).
 * - Renders the real `TestEngineClient` against unsaved CMS drafts (via `sanitizeTestForClient`).
 * - Supports interactive testing of Full / Part / Group modes, drag-and-drop Word Bank,
 *   inline blanks, highlight/notes toolbar, and in-memory grading via `gradeObjectiveTest`
 *   without touching Supabase or learner localStorage drafts.
 */
export function TestLivePreviewModal({
  open,
  onClose,
  draftTest,
  initialSectionIdx = 0,
}: TestLivePreviewModalProps) {
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const sanitizedTest = useMemo(
    () => sanitizeTestForClient(draftTest),
    [draftTest]
  );

  const totalQuestions = useMemo(
    () => draftTest.sections.reduce((sum, s) => sum + s.questions.length, 0),
    [draftTest.sections]
  );

  // Lock page body scroll while modal is open
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Close on Escape unless user is in fullscreen or an inner drawer/dialog is open
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.fullscreenElement) return;
      const root = modalRef.current;
      if (root && root.querySelector('[role="dialog"]')) {
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handlePreviewSubmit = useCallback(
    async (answers: Record<string, string>): Promise<GradedTestResult | null> => {
      return gradeObjectiveTest(draftTest, answers, DEFAULT_BAND_CONVERSIONS);
    },
    [draftTest]
  );

  if (!open) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Xem trước trực tiếp chế độ học viên"
      className="fixed inset-0 z-[65] flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      {/* Sticky Admin Preview Header Banner */}
      <div className="shrink-0 border-b border-emerald-200 bg-emerald-950 px-4 py-2.5 text-white shadow-sm dark:border-emerald-900">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1 font-bold text-emerald-200">
              <Eye className="h-3.5 w-3.5" />
              Xem trước Trực tiếp (Chế độ học viên)
            </span>
            <Badge variant="secondary" className="bg-white/10 text-white border-white/15">
              {draftTest.skill.toUpperCase()} · {draftTest.sections.length} phần · {totalQuestions} câu
            </Badge>
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-emerald-100/90">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              Chấm điểm thử ngay trong bộ nhớ (không lưu DB hay làm ảnh hưởng nháp học viên).
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPreviewEpoch((n) => n + 1)}
              className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Làm lại thử
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onClose}
              className="bg-white text-slate-900 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" /> Đóng xem trước
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Real Exam Engine */}
      <div className="flex-1 overflow-y-auto">
        {draftTest.sections.length === 0 || totalQuestions === 0 ? (
          <div className="mx-auto my-16 max-w-lg rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <p className="font-bold text-slate-900 dark:text-white">
              Chưa có câu hỏi nào để xem trước
            </p>
            <p className="mt-1.5 text-xs">
              Hãy thêm ít nhất 1 Section/Part và 1 Nhóm câu hỏi rồi mở lại chế độ Xem trước trực tiếp.
            </p>
          </div>
        ) : (
          <TestEngineClient
            key={`admin-preview-${previewEpoch}`}
            test={sanitizedTest}
            mode="practice"
            initialPracticeMode="full"
            initialSectionIdx={initialSectionIdx}
            isAuthenticated={false}
            onPreviewSubmit={handlePreviewSubmit}
          />
        )}
      </div>
    </div>
  );
}
