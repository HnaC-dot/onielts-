"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudCheck,
  Eye,
  FileText,
  HardDrive,
  Headphones,
  Layers,
  ListChecks,
  Loader2,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  Pause,
  Play,
  RotateCcw,
  StickyNote,
  Undo2,
  Volume2,
  X,
} from "lucide-react";
import type { IeltsTest, QuestionType } from "@/lib/types";
import type { GradedTestResult, QuestionGradeDetail } from "@/lib/test-grader";
import { locateEvidenceParagraph } from "@/lib/exam-evidence";
import {
  normalizeSectionToGroups,
  splitPassageParagraphs,
} from "@/lib/test-groups";
import {
  buildDraftStorageKey,
  buildModeKey,
  clampSplitRatio,
  computeSubsetGradingSummary,
  countFilledAnswers,
  DEFAULT_SPLIT_RATIO,
  hasMeaningfulDraftContent,
  inferRelevantPassageForGroup,
  MAX_SPLIT_RATIO,
  mergeDraftSnapshots,
  MIN_SPLIT_RATIO,
  SPLIT_RATIO_STORAGE_KEY,
  type ExamAnnotationColor,
  type ExamDraftPayload,
  type ExamPracticeMode,
  type ExamTextAnnotation,
} from "@/lib/exam-session";
import {
  applyAnnotationsBatch,
  clearAnnotations,
  popAnnotationHistory,
  pushAnnotationHistory,
  removeAnnotationById,
  updateAnnotationById,
} from "@/lib/exam-annotations";
import { formatDuration } from "@/lib/utils";
import { TestDiagramSvg } from "./test-diagram-svg";
import { QuestionGroupRenderer } from "./exam/question-group-renderer";
import { AnnotatablePassage } from "./exam/annotatable-passage";
import { AnnotationsDrawer } from "./exam/annotations-drawer";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  mcq_multi: "Multiple Choice (Multi)",
  tfng: "True / False / Not Given",
  ynng: "Yes / No / Not Given",
  matching_headings: "Matching Headings",
  matching_info: "Matching Information",
  matching_features: "Matching Features",
  matching_sentence_endings: "Matching Sentence Endings",
  sentence_completion: "Sentence Completion",
  summary_completion: "Summary Completion",
  table_completion: "Table Completion",
  note_completion: "Note Completion",
  flowchart_completion: "Flow-chart Completion",
  map_labelling: "Map / Diagram Labelling",
  short_answer: "Short Answer",
};

interface TestEngineClientProps {
  test: IeltsTest;
  mode?: "practice" | "daily";
  initialSecondsLeft?: number;
  initialPracticeMode?: ExamPracticeMode;
  initialSectionIdx?: number;
  initialGroupId?: string;
  isAuthenticated?: boolean;
  onDailySubmit?: (answers: Record<string, string>) => Promise<GradedTestResult | null>;
}

function readLocalDraft(storageKey: string): ExamDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExamDraftPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      testSlug: typeof parsed.testSlug === "string" ? parsed.testSlug : "",
      modeKey: typeof parsed.modeKey === "string" ? parsed.modeKey : "full",
      answers:
        parsed.answers && typeof parsed.answers === "object"
          ? parsed.answers
          : {},
      flagged:
        parsed.flagged && typeof parsed.flagged === "object"
          ? parsed.flagged
          : {},
      highlightedLines:
        parsed.highlightedLines && typeof parsed.highlightedLines === "object"
          ? parsed.highlightedLines
          : {},
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
      notesText: typeof parsed.notesText === "string" ? parsed.notesText : "",
      timerSeconds:
        typeof parsed.timerSeconds === "number" && Number.isFinite(parsed.timerSeconds)
          ? Math.max(0, Math.floor(parsed.timerSeconds))
          : 0,
      activeSectionIdx:
        typeof parsed.activeSectionIdx === "number" &&
        Number.isFinite(parsed.activeSectionIdx)
          ? Math.max(0, Math.floor(parsed.activeSectionIdx))
          : 0,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeLocalDraft(storageKey: string, payload: ExamDraftPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Ignore quota/private-mode storage errors
  }
}

function removeLocalDraft(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage errors
  }
}

export function TestEngineClient({
  test,
  mode = "practice",
  initialSecondsLeft,
  initialPracticeMode = "full",
  initialSectionIdx = 0,
  initialGroupId,
  isAuthenticated = false,
  onDailySubmit,
}: TestEngineClientProps) {
  const locale = useLocale();
  const isEn = locale === "en";

  const isDaily = mode === "daily";
  const totalSeconds = initialSecondsLeft ?? test.duration_minutes * 60;

  // Normalized sections & catalog of all QuestionGroups across sections
  const sectionGroupsList = useMemo(
    () =>
      test.sections.map((sec, sIdx) => {
        const groups = normalizeSectionToGroups(sec);
        const qById = new Map(sec.questions.map((q) => [q.id, q]));
        return {
          sectionIdx: sIdx,
          section: sec,
          groups: groups
            .map((group) => {
              const groupQuestions = group.questionIds
                .map((id) => qById.get(id))
                .filter((q): q is NonNullable<typeof q> => Boolean(q));
              return {
                sectionIdx: sIdx,
                section: sec,
                group,
                groupQuestions,
                startNumber: groupQuestions[0]?.number ?? 1,
                endNumber:
                  groupQuestions[groupQuestions.length - 1]?.number ??
                  groupQuestions[0]?.number ??
                  1,
              };
            })
            .filter((entry) => entry.groupQuestions.length > 0),
        };
      }),
    [test.sections]
  );

  const allGroupEntries = useMemo(
    () => sectionGroupsList.flatMap((s) => s.groups),
    [sectionGroupsList]
  );

  const safeInitialSectionIdx = Math.min(
    Math.max(0, initialSectionIdx),
    Math.max(0, test.sections.length - 1)
  );
  const safeInitialGroupId =
    initialGroupId && allGroupEntries.some((g) => g.group.id === initialGroupId)
      ? initialGroupId
      : allGroupEntries[0]?.group.id ?? "";

  // Practice mode & active scope state
  const [practiceMode, setPracticeMode] = useState<ExamPracticeMode>(
    isDaily ? "full" : initialPracticeMode
  );
  const [activeSectionIdx, setActiveSectionIdx] = useState(safeInitialSectionIdx);
  const [activeGroupId, setActiveGroupId] = useState(safeInitialGroupId);
  const [showFullPassage, setShowFullPassage] = useState(false);

  // Timers (countdown in full/daily; count-up with pause in part/group)
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  // Answers, flags, offset-based annotations (GĐ4), scratchpad notes
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [annotations, setAnnotations] = useState<ExamTextAnnotation[]>([]);
  const [annotationHistory, setAnnotationHistory] = useState<ExamTextAnnotation[][]>([]);
  const [flashedAnnotationId, setFlashedAnnotationId] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const [evidenceHighlight, setEvidenceHighlight] = useState<{
    sectionId: string;
    paragraphIndex: number;
    label: string;
  } | null>(null);
  const evidenceTimerRef = useRef<number | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");

  // Layout controls: resizable split-pane (desktop), 2-tab switcher (mobile), Focus Mode
  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT_RATIO);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [mobilePane, setMobilePane] = useState<"passage" | "questions">("passage");
  const [focusMode, setFocusMode] = useState(false);

  // Auto-save & submission state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "local" | "synced">("idle");
  const [restoredInfo, setRestoredInfo] = useState<{
    answeredCount: number;
    updatedAt: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [graded, setGraded] = useState<GradedTestResult | null>(null);
  const [showScript, setShowScript] = useState(false);

  const hydratedModeKeyRef = useRef<string | null>(null);
  const serverDraftTableReadyRef = useRef(true);
  const lastServerPayloadHashRef = useRef<string>("");

  // Real HTML5 MP3 audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mp3Playing, setMp3Playing] = useState(false);
  const [mp3Time, setMp3Time] = useState(0);
  const [mp3Duration, setMp3Duration] = useState(0);

  // Fallback Web Speech API state
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [audioRate, setAudioRate] = useState(1.0);
  const [activeAudioParagraph, setActiveAudioParagraph] = useState(0);

  // Active group & section resolution
  const activeGroupEntry = useMemo(() => {
    if (practiceMode !== "group") return undefined;
    return (
      allGroupEntries.find((e) => e.group.id === activeGroupId) ??
      allGroupEntries[0]
    );
  }, [practiceMode, allGroupEntries, activeGroupId]);

  const effectiveSectionIdx =
    practiceMode === "group" && activeGroupEntry
      ? activeGroupEntry.sectionIdx
      : activeSectionIdx;

  const currentSection = test.sections[effectiveSectionIdx] ?? test.sections[0];

  const currentSectionGroups = useMemo(() => {
    const found = sectionGroupsList[effectiveSectionIdx];
    return found ? found.groups : [];
  }, [sectionGroupsList, effectiveSectionIdx]);

  const visibleGroupEntries = useMemo(() => {
    if (practiceMode === "group" && activeGroupEntry) {
      return [activeGroupEntry];
    }
    return currentSectionGroups;
  }, [practiceMode, activeGroupEntry, currentSectionGroups]);

  const allQuestions = useMemo(
    () => test.sections.flatMap((s) => s.questions),
    [test.sections]
  );

  const scopedQuestions = useMemo(() => {
    if (practiceMode === "group" && activeGroupEntry) {
      return activeGroupEntry.groupQuestions;
    }
    if (practiceMode === "part" && currentSection) {
      return currentSection.questions;
    }
    return allQuestions;
  }, [practiceMode, activeGroupEntry, currentSection, allQuestions]);

  const scopedAnsweredCount = useMemo(
    () =>
      scopedQuestions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
    [scopedQuestions, answers]
  );

  const totalAnsweredCount = useMemo(() => countFilledAnswers(answers), [answers]);

  const isCountdown = isDaily || practiceMode === "full";
  const modeKey = isDaily
    ? "daily"
    : buildModeKey(practiceMode, effectiveSectionIdx, activeGroupEntry?.group.id);
  const draftStorageKey = buildDraftStorageKey(test.slug, modeKey);

  // Relevant passage resolution (Group Practice mode)
  const allPassageParagraphs = useMemo(
    () => splitPassageParagraphs(currentSection?.passage),
    [currentSection?.passage]
  );

  const passageResolution = useMemo(() => {
    if (
      practiceMode === "group" &&
      currentSection &&
      activeGroupEntry &&
      currentSection.passage
    ) {
      return inferRelevantPassageForGroup(
        currentSection,
        activeGroupEntry.group,
        activeGroupEntry.groupQuestions
      );
    }
    return {
      paragraphs: allPassageParagraphs,
      isFiltered: false,
      totalParagraphs: allPassageParagraphs.length,
      inferredFrom: "none" as const,
    };
  }, [practiceMode, currentSection, activeGroupEntry, allPassageParagraphs]);

  const renderedParagraphs =
    passageResolution.isFiltered && !showFullPassage
      ? passageResolution.paragraphs
      : allPassageParagraphs;

  // Subset grading summary when practicing a single Part or Question Group
  const subsetSummary = useMemo(() => {
    if (!graded || isDaily || practiceMode === "full") return null;
    return computeSubsetGradingSummary(
      graded,
      scopedQuestions.map((q) => q.id)
    );
  }, [graded, isDaily, practiceMode, scopedQuestions]);

  // Restore saved split-pane ratio from localStorage after mount (hydration-safe)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rafId = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(SPLIT_RATIO_STORAGE_KEY);
        if (stored) {
          const parsed = Number.parseFloat(stored);
          if (Number.isFinite(parsed)) {
            setSplitRatio(clampSplitRatio(parsed));
          }
        }
      } catch {
        // Ignore storage errors
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const persistSplitRatio = useCallback((nextRatio: number) => {
    const clamped = clampSplitRatio(nextRatio);
    setSplitRatio(clamped);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SPLIT_RATIO_STORAGE_KEY, String(clamped));
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  // Desktop split-pane drag handling
  useEffect(() => {
    if (!isDraggingSplit) return;

    const handlePointerMove = (e: PointerEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(clampSplitRatio(pct));
    };

    const handlePointerUp = () => {
      setIsDraggingSplit(false);
      setSplitRatio((curr) => {
        const clamped = clampSplitRatio(curr);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(SPLIT_RATIO_STORAGE_KEY, String(clamped));
          } catch {
            // Ignore
          }
        }
        return clamped;
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDraggingSplit]);

  // Focus Mode: body scroll lock + Escape & native fullscreen sync
  useEffect(() => {
    if (!focusMode) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !notesOpen) {
        setFocusMode(false);
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // Keep Focus mode controllable even if native fullscreen was exited
        setFocusMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [focusMode, notesOpen]);

  const toggleFocusMode = () => {
    setFocusMode((prev) => {
      const next = !prev;
      if (typeof document !== "undefined") {
        if (next && !document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else if (!next && document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
      }
      return next;
    });
  };

  // Timer tick (countdown in full/daily; count-up in part/group with pause support)
  useEffect(() => {
    if (graded) return;
    if (!isCountdown && isTimerPaused) return;
    const id = setInterval(() => {
      if (isCountdown) {
        setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      } else {
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [graded, isCountdown, isTimerPaused]);

  // Restore draft on mount and whenever modeKey changes (non-daily modes)
  useEffect(() => {
    if (isDaily) {
      hydratedModeKeyRef.current = "daily";
      return;
    }

    let cancelled = false;
    hydratedModeKeyRef.current = null;

    async function hydrateDraft() {
      const localDraft = readLocalDraft(draftStorageKey);
      let remoteDraft: ExamDraftPayload | null = null;

      if (isAuthenticated && serverDraftTableReadyRef.current) {
        try {
          const qs = new URLSearchParams({
            testSlug: test.slug,
            modeKey,
          });
          const res = await fetch(`/api/tests/draft?${qs.toString()}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = (await res.json().catch(() => null)) as {
              draft?: ExamDraftPayload | null;
              tableReady?: boolean;
            } | null;
            if (data?.tableReady === false) {
              serverDraftTableReadyRef.current = false;
            } else if (data?.draft) {
              remoteDraft = data.draft;
            }
          }
        } catch {
          // Offline or transient network error — fall back cleanly to localDraft
        }
      } else {
        // Yield once so state updates happen asynchronously after effect registration
        await Promise.resolve();
      }

      if (cancelled) return;

      const merged = mergeDraftSnapshots(localDraft, remoteDraft);
      if (merged) {
        setAnswers(merged.answers);
        setFlagged(merged.flagged);
        setAnnotations(merged.annotations ?? []);
        setAnnotationHistory([]);
        setNotesText(merged.notesText ?? "");
        if (isCountdown) {
          if (merged.timerSeconds > 0 && merged.timerSeconds <= totalSeconds) {
            setSecondsLeft(merged.timerSeconds);
          } else {
            setSecondsLeft(totalSeconds);
          }
        } else {
          setElapsedSeconds(Math.max(0, merged.timerSeconds));
          setIsTimerPaused(false);
        }
        if (
          practiceMode === "full" &&
          merged.activeSectionIdx >= 0 &&
          merged.activeSectionIdx < test.sections.length
        ) {
          setActiveSectionIdx(merged.activeSectionIdx);
        }
        setRestoredInfo({
          answeredCount: countFilledAnswers(merged.answers),
          updatedAt: merged.updatedAt,
        });
        setSaveStatus(remoteDraft && merged === remoteDraft ? "synced" : "local");
      } else {
        setAnswers({});
        setFlagged({});
        setAnnotations([]);
        setAnnotationHistory([]);
        setNotesText("");
        setSecondsLeft(totalSeconds);
        setElapsedSeconds(0);
        setIsTimerPaused(false);
        setRestoredInfo(null);
        setSaveStatus("idle");
      }

      lastServerPayloadHashRef.current = "";
      hydratedModeKeyRef.current = modeKey;
    }

    void hydrateDraft();

    return () => {
      cancelled = true;
    };
  }, [
    isDaily,
    draftStorageKey,
    isAuthenticated,
    test.slug,
    test.sections.length,
    modeKey,
    isCountdown,
    totalSeconds,
    practiceMode,
  ]);

  // Build current draft snapshot
  const buildCurrentDraftPayload = useCallback((): ExamDraftPayload => {
    return {
      testSlug: test.slug,
      modeKey,
      answers,
      flagged,
      annotations,
      notesText,
      timerSeconds: isCountdown ? secondsLeft : elapsedSeconds,
      activeSectionIdx: effectiveSectionIdx,
      updatedAt: new Date().toISOString(),
    };
  }, [
    test.slug,
    modeKey,
    answers,
    flagged,
    annotations,
    notesText,
    isCountdown,
    secondsLeft,
    elapsedSeconds,
    effectiveSectionIdx,
  ]);

  // Debounced localStorage auto-save (400ms)
  useEffect(() => {
    if (isDaily || graded) return;
    if (hydratedModeKeyRef.current !== modeKey) return;

    const payload = buildCurrentDraftPayload();
    if (!hasMeaningfulDraftContent(payload)) return;

    const timer = window.setTimeout(() => {
      writeLocalDraft(draftStorageKey, payload);
      setSaveStatus((prev) => (prev === "synced" ? "local" : "local"));
    }, 400);

    return () => window.clearTimeout(timer);
  }, [isDaily, graded, modeKey, draftStorageKey, buildCurrentDraftPayload]);

  // Debounced server auto-save (2500ms) for authenticated learners
  useEffect(() => {
    if (isDaily || graded || !isAuthenticated) return;
    if (hydratedModeKeyRef.current !== modeKey) return;
    if (!serverDraftTableReadyRef.current) return;

    const payload = buildCurrentDraftPayload();
    if (!hasMeaningfulDraftContent(payload)) return;

    // Hash excluding volatile updatedAt & per-second timer jitter
    const contentSignature = JSON.stringify({
      modeKey: payload.modeKey,
      answers: payload.answers,
      flagged: payload.flagged,
      annotations: payload.annotations,
      notesText: payload.notesText,
      activeSectionIdx: payload.activeSectionIdx,
    });
    if (contentSignature === lastServerPayloadHashRef.current) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      setSaveStatus("saving");
      try {
        const res = await fetch("/api/tests/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testSlug: payload.testSlug,
            modeKey: payload.modeKey,
            answers: payload.answers,
            flagged: payload.flagged,
            annotations: payload.annotations,
            notesText: payload.notesText,
            timerSeconds: payload.timerSeconds,
            activeSectionIdx: payload.activeSectionIdx,
          }),
        });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as {
            saved?: boolean;
            tableReady?: boolean;
          } | null;
          if (data?.tableReady === false) {
            serverDraftTableReadyRef.current = false;
            setSaveStatus("local");
          } else if (data?.saved) {
            lastServerPayloadHashRef.current = contentSignature;
            setSaveStatus("synced");
          }
        } else {
          setSaveStatus("local");
        }
      } catch {
        if (!cancelled) setSaveStatus("local");
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isDaily, graded, isAuthenticated, modeKey, buildCurrentDraftPayload]);

  // Warn before closing tab / refreshing when unsubmitted answers, highlights, or notes exist
  const hasUnsavedWork =
    !graded &&
    (totalAnsweredCount > 0 ||
      notesText.trim().length > 0 ||
      annotations.length > 0);
  useEffect(() => {
    if (!hasUnsavedWork || typeof window === "undefined") return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedWork]);

  // Cleanup TTS and annotation flash timer on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
      }
      if (evidenceTimerRef.current) {
        window.clearTimeout(evidenceTimerRef.current);
      }
    };
  }, []);

  // GĐ4 Annotation CRUD & Undo stack (works in both Exam Mode and Review Mode)
  const handleAddAnnotations = useCallback(
    (items: ExamTextAnnotation[]) => {
      if (items.length === 0) return;
      setAnnotationHistory((hist) => pushAnnotationHistory(hist, annotations));
      setAnnotations(applyAnnotationsBatch(annotations, items));
    },
    [annotations]
  );

  const handleUpdateAnnotation = useCallback(
    (id: string, patch: { color?: ExamAnnotationColor; note?: string | null }) => {
      setAnnotationHistory((hist) => pushAnnotationHistory(hist, annotations));
      setAnnotations(updateAnnotationById(annotations, id, patch));
    },
    [annotations]
  );

  const handleDeleteAnnotation = useCallback(
    (id: string) => {
      setAnnotationHistory((hist) => pushAnnotationHistory(hist, annotations));
      setAnnotations(removeAnnotationById(annotations, id));
    },
    [annotations]
  );

  const handleClearAllAnnotations = useCallback(() => {
    if (annotations.length === 0) return;
    setAnnotationHistory((hist) => pushAnnotationHistory(hist, annotations));
    setAnnotations(clearAnnotations(annotations));
  }, [annotations]);

  const handleUndoAnnotation = useCallback(() => {
    const { previous, nextHistory } = popAnnotationHistory(annotationHistory);
    if (!previous) return;
    setAnnotationHistory(nextHistory);
    setAnnotations(previous);
  }, [annotationHistory]);

  // Global Ctrl/Cmd+Z undo shortcut for annotations (never hijacks text inputs/textareas)
  useEffect(() => {
    if (annotationHistory.length === 0 || typeof window === "undefined") return;
    const handleUndoShortcut = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "z") return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleUndoAnnotation();
    };
    window.addEventListener("keydown", handleUndoShortcut);
    return () => window.removeEventListener("keydown", handleUndoShortcut);
  }, [annotationHistory.length, handleUndoAnnotation]);

  // Sync playbackRate on HTML5 audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = audioRate;
    }
  }, [audioRate, effectiveSectionIdx]);

  const stopAllAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setMp3Playing(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingTts(false);
  };

  const flushCurrentLocalDraft = () => {
    if (isDaily || graded || hydratedModeKeyRef.current !== modeKey) return;
    const payload = buildCurrentDraftPayload();
    if (hasMeaningfulDraftContent(payload)) {
      writeLocalDraft(draftStorageKey, payload);
    }
  };

  const switchSection = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= test.sections.length) return;
    if (practiceMode === "part") {
      flushCurrentLocalDraft();
      setGraded(null);
      setSubmitError("");
    }
    stopAllAudio();
    setMp3Time(0);
    setMp3Duration(0);
    setActiveAudioParagraph(0);
    setActiveSectionIdx(nextIdx);
  };

  const handleChangePracticeMode = (nextMode: ExamPracticeMode) => {
    if (isDaily || nextMode === practiceMode) return;
    flushCurrentLocalDraft();
    stopAllAudio();
    setMp3Time(0);
    setMp3Duration(0);
    setActiveAudioParagraph(0);
    setGraded(null);
    setSubmitError("");
    setShowFullPassage(false);
    if (nextMode === "group" && !activeGroupId && allGroupEntries[0]) {
      setActiveGroupId(allGroupEntries[0].group.id);
    }
    setPracticeMode(nextMode);
  };

  const handleSelectGroup = (nextGroupId: string) => {
    if (nextGroupId === activeGroupId) return;
    flushCurrentLocalDraft();
    stopAllAudio();
    setMp3Time(0);
    setMp3Duration(0);
    setActiveAudioParagraph(0);
    setGraded(null);
    setSubmitError("");
    setShowFullPassage(false);
    setActiveGroupId(nextGroupId);
  };

  const clearPersistedDraft = useCallback(() => {
    if (isDaily) return;
    removeLocalDraft(draftStorageKey);
    lastServerPayloadHashRef.current = "";
    if (isAuthenticated && serverDraftTableReadyRef.current) {
      const qs = new URLSearchParams({ testSlug: test.slug, modeKey });
      void fetch(`/api/tests/draft?${qs.toString()}`, { method: "DELETE" }).catch(
        () => {}
      );
    }
  }, [isDaily, draftStorageKey, isAuthenticated, test.slug, modeKey]);

  const handleResetSession = () => {
    stopAllAudio();
    clearPersistedDraft();
    setAnswers({});
    setFlagged({});
    setAnnotations([]);
    setAnnotationHistory([]);
    setNotesText("");
    setSecondsLeft(totalSeconds);
    setElapsedSeconds(0);
    setIsTimerPaused(false);
    setGraded(null);
    setSubmitError("");
    setRestoredInfo(null);
    setSaveStatus("idle");
  };

  const handleJumpToAnnotation = (ann: ExamTextAnnotation) => {
    const isTranscript = ann.sectionId.endsWith("::transcript");
    const baseSectionId = isTranscript
      ? ann.sectionId.slice(0, -"::transcript".length)
      : ann.sectionId;
    const targetSecIdx = test.sections.findIndex((s) => s.id === baseSectionId);

    if (isTranscript) {
      setShowScript(true);
    }
    if (targetSecIdx >= 0 && targetSecIdx !== effectiveSectionIdx && practiceMode !== "group") {
      switchSection(targetSecIdx);
    }
    if (passageResolution.isFiltered && !showFullPassage) {
      setShowFullPassage(true);
    }
    setMobilePane("passage");
    setNotesOpen(false);

    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }
    setFlashedAnnotationId(ann.id);

    window.setTimeout(() => {
      const markEl = document.querySelector<HTMLElement>(
        `mark[data-annotation-id="${CSS.escape(ann.id)}"]`
      );
      markEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 90);

    flashTimerRef.current = window.setTimeout(() => {
      setFlashedAnnotationId(null);
    }, 1900);
  };

  const audioParagraphs = useMemo(() => {
    const raw = currentSection?.audioScript ?? "";
    return raw
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [currentSection]);

  const audioPassageParagraphs = useMemo(
    () =>
      audioParagraphs.map((text, index) => ({
        index,
        text,
      })),
    [audioParagraphs]
  );

  const handleLocateEvidence = (detail: QuestionGradeDetail) => {
    if (!currentSection) return;
    const isReadingPassage = Boolean(currentSection.passage);
    const targetParagraphs = isReadingPassage
      ? allPassageParagraphs
      : audioPassageParagraphs;
    if (targetParagraphs.length === 0) return;

    const targetSectionId = isReadingPassage
      ? currentSection.id
      : `${currentSection.id}::transcript`;

    const located = locateEvidenceParagraph(
      targetParagraphs,
      detail.sectionRef,
      detail.acceptedAnswers
    );
    const targetIdx = located ? located.paragraphIndex : 0;

    if (isReadingPassage && passageResolution.isFiltered && !showFullPassage) {
      setShowFullPassage(true);
    }
    if (!isReadingPassage) {
      setShowScript(true);
    }
    setMobilePane("passage");

    const badgeLabel = isEn
      ? `Evidence · Q${detail.number}${detail.sectionRef ? ` (${detail.sectionRef})` : ""}`
      : `Đoạn chứa đáp án · Câu ${detail.number}${detail.sectionRef ? ` (${detail.sectionRef})` : ""}`;

    if (evidenceTimerRef.current) {
      window.clearTimeout(evidenceTimerRef.current);
    }
    setEvidenceHighlight({
      sectionId: targetSectionId,
      paragraphIndex: targetIdx,
      label: badgeLabel,
    });

    window.setTimeout(() => {
      const targetEl = document.querySelector<HTMLElement>(
        `[data-section-id="${CSS.escape(targetSectionId)}"] [data-paragraph-index="${targetIdx}"]`
      );
      targetEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 90);

    evidenceTimerRef.current = window.setTimeout(() => {
      setEvidenceHighlight(null);
    }, 4200);
  };

  const toggleMp3Play = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.playbackRate = audioRate;
      await el.play();
      setMp3Playing(true);
    } else {
      el.pause();
      setMp3Playing(false);
    }
  };

  const restartMp3 = async () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.playbackRate = audioRate;
    await el.play();
    setMp3Playing(true);
  };

  const playTtsFrom = (startIdx: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (startIdx >= audioParagraphs.length) {
      setIsPlayingTts(false);
      return;
    }
    setIsPlayingTts(true);
    setActiveAudioParagraph(startIdx);

    const speakStep = (idx: number) => {
      if (idx >= audioParagraphs.length) {
        setIsPlayingTts(false);
        return;
      }
      setActiveAudioParagraph(idx);
      const utter = new SpeechSynthesisUtterance(audioParagraphs[idx]);
      utter.lang = "en-GB";
      utter.rate = audioRate;
      utter.onend = () => speakStep(idx + 1);
      utter.onerror = () => setIsPlayingTts(false);
      window.speechSynthesis.speak(utter);
    };
    speakStep(startIdx);
  };

  const handleSubmit = async () => {
    if (submitting || graded) return;
    stopAllAudio();
    setSubmitting(true);
    setSubmitError("");
    try {
      if (isDaily && onDailySubmit) {
        const res = await onDailySubmit(answers);
        if (res) {
          setGraded(res);
        } else {
          setSubmitError(
            isEn
              ? "Could not submit your Daily Exam. Please try clicking Submit again."
              : "Không thể nộp bài Đề thi mỗi ngày. Vui lòng thử bấm Nộp bài lại."
          );
        }
        return;
      }
      const durationSeconds = isCountdown
        ? Math.max(1, totalSeconds - secondsLeft)
        : Math.max(1, elapsedSeconds);

      const res = await fetch("/api/tests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testSlug: test.slug,
          answers,
          durationSeconds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.graded) {
        setSubmitError(
          data?.error ||
            (isEn
              ? "Submission failed. Your answers are still preserved — please click Submit again."
              : "Chấm bài thất bại tạm thời. Đáp án của bạn vẫn được giữ nguyên — hãy bấm Nộp bài lại.")
        );
        return;
      }
      clearPersistedDraft();
      setRestoredInfo(null);
      setSaveStatus("idle");
      setGraded(data.graded);
      setMobilePane("questions");
    } catch {
      setSubmitError(
        isEn
          ? "Network error while submitting your test. Your answers are still safe — please retry."
          : "Lỗi kết nối khi nộp bài. Đáp án của bạn vẫn còn nguyên — hãy kiểm tra mạng và bấm Nộp bài lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const jumpToQuestion = (qId: string, sectionIndex: number) => {
    setMobilePane("questions");
    if (practiceMode === "full" && sectionIndex !== effectiveSectionIdx) {
      switchSection(sectionIndex);
      setTimeout(() => {
        document.getElementById(`question-card-${qId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 60);
    } else {
      setTimeout(() => {
        document.getElementById(`question-card-${qId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 20);
    }
  };

  const textSizeCls =
    fontSize === "sm"
      ? "text-xs leading-6"
      : fontSize === "lg"
      ? "text-base leading-8"
      : "text-sm leading-7";

  const sectionUnitLabel =
    test.skill === "listening"
      ? "Part"
      : test.module === "general"
      ? "Section"
      : "Passage";

  const sectionLabelsById = useMemo(() => {
    const map: Record<string, string> = {};
    test.sections.forEach((sec, idx) => {
      map[sec.id] = `${sectionUnitLabel} ${idx + 1}`;
      map[`${sec.id}::transcript`] = `${sectionUnitLabel} ${idx + 1} (Transcript)`;
    });
    return map;
  }, [test.sections, sectionUnitLabel]);

  const navigatorItems = useMemo(() => {
    if (practiceMode === "group" && activeGroupEntry) {
      return activeGroupEntry.groupQuestions.map((q) => ({
        q,
        secIdx: activeGroupEntry.sectionIdx,
      }));
    }
    if (practiceMode === "part" && currentSection) {
      return currentSection.questions.map((q) => ({
        q,
        secIdx: effectiveSectionIdx,
      }));
    }
    return test.sections.flatMap((sec, secIdx) =>
      sec.questions.map((q) => ({ q, secIdx }))
    );
  }, [practiceMode, activeGroupEntry, currentSection, effectiveSectionIdx, test.sections]);

  return (
    <div
      className={
        focusMode
          ? "fixed inset-0 z-50 flex flex-col gap-3 overflow-hidden bg-slate-50 px-3 py-3 sm:px-5 dark:bg-slate-950"
          : "mx-auto max-w-[1440px] space-y-4 px-4 py-6 sm:px-6"
      }
    >
      {submitError && (
        <div
          role="alert"
          className="shrink-0 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
        >
          {submitError}
        </div>
      )}

      {/* Computer-Delivered Top Exam Bar */}
      <div
        className={`${
          focusMode ? "shrink-0" : "sticky top-16 z-30"
        } flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{test.skill.toUpperCase()}</Badge>
            <Badge variant="secondary">
              {test.module === "academic" ? "Academic" : "General"}
            </Badge>
            <Badge variant="secondary">
              {scopedQuestions.length} {isEn ? "questions" : "câu"}
            </Badge>
            {isDaily && <Badge variant="amber">Daily Sprint</Badge>}
            {!isDaily && practiceMode === "part" && (
              <Badge variant="amber">
                {isEn ? "Part Practice" : "Luyện từng phần"}
              </Badge>
            )}
            {!isDaily && practiceMode === "group" && (
              <Badge variant="amber">
                {isEn ? "Group Practice" : "Luyện theo dạng"}
              </Badge>
            )}
            {!isDaily && saveStatus !== "idle" && !graded && (
              <span
                aria-live="polite"
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {saveStatus === "saving" ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                    {isEn ? "Saving..." : "Đang lưu..."}
                  </>
                ) : saveStatus === "synced" ? (
                  <>
                    <CloudCheck className="h-3 w-3 text-emerald-600" />
                    {isEn ? "Synced" : "Đã đồng bộ"}
                  </>
                ) : (
                  <>
                    <HardDrive className="h-3 w-3 text-emerald-600" />
                    {isEn ? "Saved locally" : "Đã lưu cục bộ"}
                  </>
                )}
              </span>
            )}
          </div>
          <h1 className="mt-1 truncate text-sm font-bold text-slate-900 sm:text-base dark:text-white">
            {isEn ? test.title_en : test.title_vi}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Timer (Countdown for Full/Daily; Count-up + Pause/Resume for Part/Group) */}
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
            <div
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
                isCountdown && secondsLeft < 300
                  ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : "text-slate-800 dark:text-slate-100"
              }`}
            >
              <Clock className="h-4 w-4 text-emerald-600" />
              {formatDuration(isCountdown ? secondsLeft : elapsedSeconds)}
            </div>
            {!isCountdown && !graded && (
              <button
                type="button"
                onClick={() => setIsTimerPaused((v) => !v)}
                aria-label={
                  isTimerPaused
                    ? isEn
                      ? "Resume practice timer"
                      : "Tiếp tục đếm giờ"
                    : isEn
                    ? "Pause practice timer"
                    : "Tạm dừng đồng hồ"
                }
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                title={
                  isTimerPaused
                    ? isEn
                      ? "Resume timer"
                      : "Tiếp tục"
                    : isEn
                    ? "Pause timer"
                    : "Tạm dừng"
                }
              >
                {isTimerPaused ? (
                  <Play className="h-3.5 w-3.5" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>

          {/* Undo last highlight/note change (Ctrl/Cmd+Z) */}
          {annotationHistory.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUndoAnnotation}
              title={isEn ? "Undo highlight/note (Ctrl/Cmd+Z)" : "Hoàn tác tô sáng/ghi chú (Ctrl/Cmd+Z)"}
              aria-label={isEn ? "Undo highlight or note" : "Hoàn tác tô sáng hoặc ghi chú"}
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">
                {isEn ? "Undo" : "Hoàn tác"}
              </span>
            </Button>
          )}

          {/* My Notes & Highlights drawer trigger */}
          <Button
            type="button"
            size="sm"
            variant={notesOpen ? "secondary" : "outline"}
            onClick={() => setNotesOpen((v) => !v)}
          >
            <StickyNote className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {isEn ? "My Notes" : "Ghi chú của tôi"}
            </span>
            {annotations.length > 0 && (
              <span className="rounded-full bg-emerald-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {annotations.length}
              </span>
            )}
          </Button>

          {/* Font size */}
          <div className="hidden md:flex rounded-lg border border-slate-200 dark:border-slate-700">
            {(["sm", "base", "lg"] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setFontSize(sz)}
                className={`px-2 py-1 text-xs font-bold cursor-pointer ${
                  fontSize === sz
                    ? "bg-emerald-600 text-white rounded-md"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {sz === "sm" ? "A-" : sz === "base" ? "A" : "A+"}
              </button>
            ))}
          </div>

          {/* Focus Mode toggle */}
          <Button
            type="button"
            size="sm"
            variant={focusMode ? "default" : "outline"}
            aria-pressed={focusMode}
            onClick={toggleFocusMode}
            title={
              focusMode
                ? isEn
                  ? "Exit Focus Mode (Esc)"
                  : "Thoát chế độ Tập trung (Esc)"
                : isEn
                ? "Enter Focus Mode"
                : "Chế độ Tập trung (Toàn màn hình)"
            }
          >
            {focusMode ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden xl:inline">
              {focusMode
                ? isEn
                  ? "Exit Focus"
                  : "Thoát tập trung"
                : isEn
                ? "Focus"
                : "Tập trung"}
            </span>
          </Button>

          {!graded ? (
            <Button
              type="button"
              id="submit-test-btn"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEn
                ? `Submit (${scopedAnsweredCount}/${scopedQuestions.length})`
                : `Nộp bài (${scopedAnsweredCount}/${scopedQuestions.length})`}
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              {!isDaily && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetSession}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {isEn ? "Retry" : "Làm lại"}
                </Button>
              )}
              <Link href="/tests">
                <Button variant="outline" size="sm">
                  {isEn ? "All Tests" : "Danh sách đề"}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Practice Mode Selector + Section / Group Bar (Hidden in Daily Sprint) */}
      {!isDaily && (
        <div className="shrink-0 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 p-2.5 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 3 Practice Modes */}
            <div
              role="tablist"
              aria-label={isEn ? "Practice mode" : "Chế độ luyện tập"}
              className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
            >
              {(
                [
                  {
                    id: "full" as const,
                    labelVi: `Thi đủ đề (${allQuestions.length} câu)`,
                    labelEn: `Full Test (${allQuestions.length}Q)`,
                    icon: CheckCircle2,
                  },
                  {
                    id: "part" as const,
                    labelVi: "Luyện từng phần",
                    labelEn: "Practice Part",
                    icon: Layers,
                  },
                  {
                    id: "group" as const,
                    labelVi: "Luyện theo dạng",
                    labelEn: "Practice Group",
                    icon: ListChecks,
                  },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = practiceMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleChangePracticeMode(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      active
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {isEn ? item.labelEn : item.labelVi}
                  </button>
                );
              })}
            </div>

            {/* Prev / Next Section or Reset */}
            <div className="flex flex-wrap items-center gap-1.5">
              {practiceMode !== "group" && test.sections.length > 1 && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={effectiveSectionIdx === 0}
                    onClick={() => switchSection(effectiveSectionIdx - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {isEn ? "Prev" : "Phần trước"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={effectiveSectionIdx === test.sections.length - 1}
                    onClick={() => switchSection(effectiveSectionIdx + 1)}
                  >
                    {isEn ? "Next" : "Phần tiếp"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              {!graded && hasUnsavedWork && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleResetSession}
                  className="text-slate-500 hover:text-red-600"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {isEn ? "Start fresh" : "Làm lại từ đầu"}
                </Button>
              )}
            </div>
          </div>

          {/* Section Pills (Full & Part modes) */}
          {practiceMode !== "group" && test.sections.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {test.sections.map((sec, idx) => {
                const secAnswered = sec.questions.filter(
                  (q) => (answers[q.id] ?? "").trim().length > 0
                ).length;
                const qStart = sec.questions[0]?.number ?? 1;
                const qEnd =
                  sec.questions[sec.questions.length - 1]?.number ??
                  sec.questions.length;
                const isActive = idx === effectiveSectionIdx;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => switchSection(idx)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>
                      {sectionUnitLabel} {idx + 1} (Q{qStart}–{qEnd})
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                        isActive
                          ? "bg-white/20 text-white"
                          : secAnswered === sec.questions.length
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                      }`}
                    >
                      {secAnswered}/{sec.questions.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Question Group Picker (Group Practice mode) */}
          {practiceMode === "group" && allGroupEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="practice-group-select"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                {isEn ? "Select Question Group:" : "Chọn nhóm câu hỏi:"}
              </label>
              <select
                id="practice-group-select"
                value={activeGroupEntry?.group.id ?? ""}
                onChange={(e) => handleSelectGroup(e.target.value)}
                className="min-w-[260px] flex-1 max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {allGroupEntries.map((entry) => {
                  const typeLabel =
                    QUESTION_TYPE_LABELS[entry.group.type] ?? entry.group.type;
                  const rangeLabel =
                    entry.startNumber === entry.endNumber
                      ? `Q${entry.startNumber}`
                      : `Q${entry.startNumber}–${entry.endNumber}`;
                  return (
                    <option key={entry.group.id} value={entry.group.id}>
                      {sectionUnitLabel} {entry.sectionIdx + 1} · {rangeLabel}:{" "}
                      {typeLabel} ({entry.groupQuestions.length}{" "}
                      {isEn ? "qs" : "câu"})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Restored Draft Notice */}
      {restoredInfo && !graded && (
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="font-semibold">
            {isEn
              ? `Restored your latest saved progress (${restoredInfo.answeredCount} answered).`
              : `Đã khôi phục bài làm gần nhất (${restoredInfo.answeredCount} câu đã điền).`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetSession}
              className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 cursor-pointer"
            >
              {isEn ? "Start fresh" : "Làm lại từ đầu"}
            </button>
            <button
              type="button"
              onClick={() => setRestoredInfo(null)}
              aria-label={isEn ? "Dismiss notice" : "Đóng thông báo"}
              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/60 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* GRADED RESULT SUMMARY + MISTAKE ANALYTICS */}
      {graded && (
        <div
          id="test-result-summary"
          className="shrink-0 grid gap-5 lg:grid-cols-12"
        >
          <Card className="p-6 lg:col-span-5 flex items-center gap-5 bg-emerald-50/50 dark:bg-emerald-950/30">
            {subsetSummary ? (
              <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm dark:bg-emerald-700">
                <span className="text-[10px] font-semibold uppercase opacity-85">
                  {isEn ? "Practice" : "Luyện tập"}
                </span>
                <span className="text-3xl font-bold">
                  {subsetSummary.accuracyPercent}%
                </span>
              </div>
            ) : graded.isFullIeltsTest && graded.bandScore !== null ? (
              <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <span className="text-[11px] font-semibold uppercase opacity-85">
                  Band
                </span>
                <span className="text-4xl font-bold">
                  {graded.bandScore.toFixed(1)}
                </span>
              </div>
            ) : (
              <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm dark:bg-emerald-700">
                <span className="text-[10px] font-semibold uppercase opacity-85">
                  {isEn ? "Accuracy" : "Chính xác"}
                </span>
                <span className="text-3xl font-bold">
                  {graded.accuracyPercent}%
                </span>
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {subsetSummary
                  ? isEn
                    ? "Practice Session Completed!"
                    : "Hoàn thành phiên luyện tập!"
                  : isEn
                  ? "Test Completed!"
                  : "Hoàn thành bài thi!"}
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {subsetSummary
                  ? isEn
                    ? `Score: ${subsetSummary.rawScore} / ${subsetSummary.maxScore} correct (${subsetSummary.accuracyPercent}%)`
                    : `Số câu đúng: ${subsetSummary.rawScore} / ${subsetSummary.maxScore} câu (${subsetSummary.accuracyPercent}%)`
                  : isEn
                  ? `Score: ${graded.rawScore} / ${graded.maxScore} correct (${graded.accuracyPercent}%)`
                  : `Số câu đúng: ${graded.rawScore} / ${graded.maxScore} câu (${graded.accuracyPercent}%)`}
              </p>
              {subsetSummary ? (
                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {isEn
                    ? "Part/Group practice mode: switch to Full Test (40 questions) for an official IELTS Band score."
                    : "Chế độ luyện từng phần / theo dạng: chuyển sang Thi đủ đề 40 câu để tính Band IELTS chính thức."}
                </p>
              ) : !graded.isFullIeltsTest ? (
                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {isEn
                    ? "Short practice sprint (< 40 questions): official IELTS Band score is only calculated on full 40-question tests."
                    : "Đề rút gọn (< 40 câu): chỉ hiển thị tỷ lệ % chính xác, không quy đổi Band IELTS chính thức."}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                {isEn
                  ? "Review bilingual explanations (VI + EN) for every question below."
                  : "Xem đáp án và giải thích chi tiết song ngữ VI + EN cho từng câu bên dưới."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href="/progress"
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  {isEn ? "View Learning Progress →" : "Xem Tiến độ học tập →"}
                </Link>
                {subsetSummary && (
                  <button
                    type="button"
                    onClick={() => handleChangePracticeMode("full")}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 cursor-pointer"
                  >
                    {isEn ? "Try Full 40-Q Test" : "Thi đủ đề 40 câu"}
                  </button>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6 lg:col-span-7 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEn
                ? "Mistake Analysis by Question Type"
                : "Phân tích độ chính xác theo từng dạng câu hỏi"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(
                subsetSummary
                  ? subsetSummary.breakdownByType
                  : graded.breakdownByType
              ).map(([type, stat]) => {
                if (!stat) return null;
                const pct = Math.round(
                  (stat.correct / Math.max(1, stat.total)) * 100
                );
                return (
                  <div
                    key={type}
                    className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>
                        {QUESTION_TYPE_LABELS[type as QuestionType] ?? type}
                      </span>
                      <span
                        className={
                          pct >= 70 ? "text-emerald-600" : "text-amber-600"
                        }
                      >
                        {stat.correct}/{stat.total} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 70 ? "bg-emerald-600" : "bg-amber-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* MOBILE 2-TAB SWITCHER (< lg) */}
      {currentSection && (
        <div
          role="tablist"
          aria-label={isEn ? "Exam view switcher" : "Chuyển đổi khung xem"}
          className="grid shrink-0 grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 p-1 lg:hidden dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === "passage"}
            onClick={() => setMobilePane("passage")}
            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition cursor-pointer ${
              mobilePane === "passage"
                ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {test.skill === "listening" ? (
              <Headphones className="h-4 w-4" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            {test.skill === "listening"
              ? isEn
                ? "Listening Audio"
                : "Băng nghe"
              : isEn
              ? "Reading Passage"
              : "Bài đọc"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === "questions"}
            onClick={() => setMobilePane("questions")}
            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition cursor-pointer ${
              mobilePane === "questions"
                ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <FileText className="h-4 w-4" />
            {isEn
              ? `Questions (${scopedAnsweredCount}/${scopedQuestions.length})`
              : `Câu hỏi (${scopedAnsweredCount}/${scopedQuestions.length})`}
          </button>
        </div>
      )}

      {/* COMPUTER-DELIVERED RESIZABLE SPLIT-PANE WORKSPACE */}
      {currentSection && (
        <div
          key={currentSection.id}
          ref={splitContainerRef}
          style={{ "--exam-split": `${splitRatio}%` } as React.CSSProperties}
          className={`flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-0 ${
            focusMode
              ? "flex-1 min-h-0"
              : "lg:h-[calc(100vh-14rem)] lg:min-h-[540px] lg:max-h-[820px]"
          }`}
        >
          {/* LEFT PANE: Reading Passage OR Listening Audio Player + Diagram */}
          <Card
            className={`${
              mobilePane === "passage" ? "block" : "hidden lg:block"
            } p-5 sm:p-6 lg:basis-[var(--exam-split)] lg:grow-0 lg:shrink-0 lg:min-w-0 lg:h-full lg:overflow-y-auto space-y-5 ${
              focusMode ? "flex-1 min-h-0 overflow-y-auto" : ""
            }`}
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {currentSection.title}
              </h2>
              {currentSection.instruction && (
                <p className="mt-1 text-xs text-slate-500">
                  {currentSection.instruction}
                </p>
              )}
            </div>

            {/* REAL MP3 AUDIO PLAYER (Preferred when audioUrl is present) */}
            {currentSection.audioUrl ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <audio
                  ref={audioRef}
                  key={currentSection.audioUrl}
                  src={currentSection.audioUrl}
                  preload="metadata"
                  onTimeUpdate={(e) => setMp3Time(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) =>
                    setMp3Duration(e.currentTarget.duration || 0)
                  }
                  onEnded={() => setMp3Playing(false)}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" onClick={toggleMp3Play}>
                      {mp3Playing ? (
                        <>
                          <Pause className="h-4 w-4" />
                          {isEn ? "Pause" : "Tạm dừng"}
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          {isEn ? "Play Audio" : "Phát file nghe"}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={restartMp3}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {isEn ? "Restart" : "Nghe lại"}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Headphones className="h-4 w-4 text-emerald-600" />
                    <select
                      aria-label="Playback speed"
                      value={audioRate}
                      onChange={(e) => setAudioRate(Number(e.target.value))}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value={0.85}>0.85x</option>
                      <option value={1.0}>1.0x (Chuẩn)</option>
                      <option value={1.15}>1.15x</option>
                      <option value={1.25}>1.25x</option>
                    </select>
                  </div>
                </div>

                {/* Seekable Timeline */}
                <div className="flex items-center gap-3">
                  <span className="w-10 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {formatDuration(Math.floor(mp3Time))}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, mp3Duration)}
                    step={0.5}
                    value={mp3Time}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      if (audioRef.current) audioRef.current.currentTime = next;
                      setMp3Time(next);
                    }}
                    className="h-2 flex-1 accent-emerald-600 cursor-pointer"
                  />
                  <span className="w-10 text-right font-mono text-[11px] text-slate-500">
                    {formatDuration(Math.floor(mp3Duration))}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-800 dark:text-emerald-300">
                    <Volume2 className="h-3.5 w-3.5" />
                    {isEn
                      ? "Real multi-speaker MP3 recording (UK / AU / US voices)"
                      : "Băng nghe MP3 thật (đa giọng Anh / Úc / Mỹ)"}
                  </span>
                  {currentSection.audioScript && (
                    <button
                      type="button"
                      onClick={() => setShowScript((v) => !v)}
                      className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                    >
                      {showScript
                        ? isEn
                          ? "Hide Transcript"
                          : "Ẩn bản ghi (Transcript)"
                        : isEn
                        ? "Show Transcript"
                        : "Xem bản ghi (Transcript)"}
                    </button>
                  )}
                </div>

                {currentSection.audioScript && (showScript || graded) && (
                  <div className="mt-2 rounded-xl bg-white p-3.5 dark:bg-slate-950">
                    <AnnotatablePassage
                      sectionId={`${currentSection.id}::transcript`}
                      paragraphs={audioPassageParagraphs}
                      annotations={annotations}
                      textSizeClass="text-xs leading-6"
                      isEn={isEn}
                      flashedAnnotationId={flashedAnnotationId}
                      highlightedEvidenceParagraphIndex={
                        evidenceHighlight?.sectionId === `${currentSection.id}::transcript`
                          ? evidenceHighlight.paragraphIndex
                          : null
                      }
                      evidenceBadgeText={
                        evidenceHighlight?.sectionId === `${currentSection.id}::transcript`
                          ? evidenceHighlight.label
                          : null
                      }
                      onAddAnnotations={handleAddAnnotations}
                      onUpdateAnnotation={handleUpdateAnnotation}
                      onDeleteAnnotation={handleDeleteAnnotation}
                      showHint={false}
                    />
                  </div>
                )}
              </div>
            ) : currentSection.audioScript ? (
              /* Fallback Web Speech player only for custom tests without MP3 */
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {!isPlayingTts ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => playTtsFrom(activeAudioParagraph)}
                      >
                        <Play className="h-4 w-4" />
                        {isEn ? "Play Audio" : "Phát băng nghe"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={stopAllAudio}
                      >
                        <Pause className="h-4 w-4" />
                        {isEn ? "Pause" : "Tạm dừng"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => playTtsFrom(0)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {isEn ? "Restart" : "Nghe lại từ đầu"}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScript((v) => !v)}
                    className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                  >
                    {showScript
                      ? isEn
                        ? "Hide Transcript"
                        : "Ẩn bản ghi"
                      : isEn
                      ? "Show Transcript"
                      : "Xem bản ghi"}
                  </button>
                </div>
                {(showScript || graded) && (
                  <div className="mt-2 rounded-xl bg-white p-3.5 dark:bg-slate-950">
                    <AnnotatablePassage
                      sectionId={`${currentSection.id}::transcript`}
                      paragraphs={audioPassageParagraphs}
                      annotations={annotations}
                      textSizeClass="text-xs leading-6"
                      isEn={isEn}
                      flashedAnnotationId={flashedAnnotationId}
                      highlightedEvidenceParagraphIndex={
                        evidenceHighlight?.sectionId === `${currentSection.id}::transcript`
                          ? evidenceHighlight.paragraphIndex
                          : null
                      }
                      evidenceBadgeText={
                        evidenceHighlight?.sectionId === `${currentSection.id}::transcript`
                          ? evidenceHighlight.label
                          : null
                      }
                      onAddAnnotations={handleAddAnnotations}
                      onUpdateAnnotation={handleUpdateAnnotation}
                      onDeleteAnnotation={handleDeleteAnnotation}
                      showHint={false}
                    />
                  </div>
                )}
              </div>
            ) : null}

            {/* SVG MAP OR DIAGRAM */}
            {(currentSection.diagramSvgType || currentSection.diagramImageUrl) && (
              <div className="space-y-2">
                {currentSection.diagramLabel && (
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {currentSection.diagramLabel}
                  </p>
                )}
                {currentSection.diagramImageUrl ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentSection.diagramImageUrl}
                      alt={currentSection.diagramLabel || currentSection.title}
                      className="mx-auto max-h-96 w-full object-contain"
                    />
                  </div>
                ) : currentSection.diagramSvgType ? (
                  <TestDiagramSvg type={currentSection.diagramSvgType} />
                ) : null}
              </div>
            )}

            {/* HEADING BANK (only shown on left if not already embedded in a matching_headings group) */}
            {currentSection.headingBank &&
              !normalizeSectionToGroups(currentSection).some(
                (g) => g.type === "matching_headings"
              ) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                    List of Headings
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-800 dark:text-slate-200">
                    {currentSection.headingBank.map((h) => (
                      <li key={h.id}>
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {h.id}.
                        </strong>{" "}
                        {h.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* RELEVANT-PASSAGE NOTICE BANNER (Group Practice mode) */}
            {passageResolution.isFiltered && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Eye className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  {!showFullPassage
                    ? isEn
                      ? `Showing only the passage text relevant to this section (${passageResolution.paragraphs.length}/${passageResolution.totalParagraphs} paragraphs).`
                      : `Đang chỉ hiển thị các đoạn văn liên quan đến nhóm câu hỏi này (${passageResolution.paragraphs.length}/${passageResolution.totalParagraphs} đoạn).`
                    : isEn
                    ? `Showing full passage (${passageResolution.totalParagraphs} paragraphs).`
                    : `Đang hiển thị toàn bộ bài đọc (${passageResolution.totalParagraphs} đoạn).`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowFullPassage((v) => !v)}
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 cursor-pointer"
                >
                  {!showFullPassage
                    ? isEn
                      ? "Show full passage"
                      : "Hiện toàn bộ đoạn văn"
                    : isEn
                    ? "Show relevant text only"
                    : "Chỉ hiện đoạn liên quan"}
                </button>
              </div>
            )}

            {/* READING PASSAGE WITH OFFSET-BASED HIGHLIGHT, NOTE, COPY & FLASHCARD TOOLBAR */}
            {currentSection.passage && (
              <AnnotatablePassage
                sectionId={currentSection.id}
                paragraphs={renderedParagraphs}
                annotations={annotations}
                textSizeClass={textSizeCls}
                isEn={isEn}
                flashedAnnotationId={flashedAnnotationId}
                highlightedEvidenceParagraphIndex={
                  evidenceHighlight?.sectionId === currentSection.id
                    ? evidenceHighlight.paragraphIndex
                    : null
                }
                evidenceBadgeText={
                  evidenceHighlight?.sectionId === currentSection.id
                    ? evidenceHighlight.label
                    : null
                }
                onAddAnnotations={handleAddAnnotations}
                onUpdateAnnotation={handleUpdateAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
              />
            )}
          </Card>

          {/* DESKTOP DRAGGABLE SPLIT SEPARATOR (↔) */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={
              isEn
                ? "Resize passage and questions panes"
                : "Kéo để thay đổi tỷ lệ khung bài đọc và câu hỏi"
            }
            aria-valuemin={MIN_SPLIT_RATIO}
            aria-valuemax={MAX_SPLIT_RATIO}
            aria-valuenow={Math.round(splitRatio)}
            tabIndex={0}
            title={
              isEn
                ? "Drag to resize · Double-click to reset 50/50"
                : "Kéo để thay đổi kích thước · Nhấn đúp để đặt lại 50/50"
            }
            onPointerDown={(e) => {
              e.preventDefault();
              setIsDraggingSplit(true);
            }}
            onDoubleClick={() => persistSplitRatio(DEFAULT_SPLIT_RATIO)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                persistSplitRatio(splitRatio - 3);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                persistSplitRatio(splitRatio + 3);
              } else if (e.key === "Home") {
                e.preventDefault();
                persistSplitRatio(MIN_SPLIT_RATIO);
              } else if (e.key === "End") {
                e.preventDefault();
                persistSplitRatio(MAX_SPLIT_RATIO);
              } else if (e.key === "Enter" || e.key === "0") {
                e.preventDefault();
                persistSplitRatio(DEFAULT_SPLIT_RATIO);
              }
            }}
            className={`group relative hidden w-4 shrink-0 cursor-col-resize select-none items-center justify-center focus:outline-none lg:flex ${
              isDraggingSplit ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            <div
              className={`h-full w-0.5 rounded-full transition ${
                isDraggingSplit
                  ? "bg-emerald-500"
                  : "bg-slate-200 group-hover:bg-emerald-400 group-focus-visible:bg-emerald-500 dark:bg-slate-800"
              }`}
            />
            <span
              className={`absolute flex h-8 w-5 items-center justify-center rounded-full border shadow-xs transition ${
                isDraggingSplit
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-500 group-hover:border-emerald-400 group-hover:text-emerald-600 group-focus-visible:ring-2 group-focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <MoveHorizontal className="h-3.5 w-3.5" />
            </span>
          </div>

          {/* RIGHT PANE: INTERACTIVE QUESTION GROUPS (CBT IELTS BY TYPE) */}
          <div
            className={`${
              mobilePane === "questions" ? "block" : "hidden lg:block"
            } lg:flex-1 lg:min-w-0 lg:h-full lg:overflow-y-auto space-y-5 lg:pr-1 ${
              focusMode ? "flex-1 min-h-0 overflow-y-auto" : ""
            }`}
          >
            {visibleGroupEntries.map((entry) => (
              <QuestionGroupRenderer
                key={entry.group.id}
                group={entry.group}
                questions={entry.groupQuestions}
                answers={answers}
                flagged={flagged}
                graded={graded}
                isEn={isEn}
                onAnswerChange={(qId, value) =>
                  setAnswers((prev) => ({ ...prev, [qId]: value }))
                }
                onAnswersPatch={(patch) =>
                  setAnswers((prev) => ({ ...prev, ...patch }))
                }
                onToggleFlag={(qId) =>
                  setFlagged((prev) => ({ ...prev, [qId]: !prev[qId] }))
                }
                onLocateEvidence={handleLocateEvidence}
                canLocateEvidence={Boolean(
                  currentSection.passage || currentSection.audioScript
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom Question Navigator (Scoped to Full / Part / Group) */}
      <Card className={`shrink-0 ${focusMode ? "p-3" : "p-4"}`}>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <FileText className="h-4 w-4 text-emerald-600" />
            {isEn ? "Question Navigator" : "Bảng chuyển nhanh câu hỏi"} (
            {scopedAnsweredCount}/{scopedQuestions.length})
          </span>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />{" "}
              {isEn ? "Answered" : "Đã làm"}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />{" "}
              {isEn ? "Flagged" : "Đánh dấu"}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900" />{" "}
              {isEn ? "Unanswered" : "Chưa làm"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {navigatorItems.map(({ q, secIdx }) => {
            const answered = Boolean(answers[q.id]?.trim());
            const isFlagged = Boolean(flagged[q.id]);
            const detail = graded?.details.find((d) => d.questionId === q.id);

            let cls =
              "border-slate-200 bg-white text-slate-700 hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300";
            if (detail) {
              cls = detail.isCorrect
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-red-500 bg-red-500 text-white";
            } else if (isFlagged && answered) {
              cls =
                "border-amber-500 bg-emerald-600 text-white ring-2 ring-amber-400/70";
            } else if (isFlagged) {
              cls =
                "border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200";
            } else if (answered) {
              cls = "border-emerald-600 bg-emerald-600 text-white";
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => jumpToQuestion(q.id, secIdx)}
                className={`relative flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold transition cursor-pointer ${cls} ${
                  secIdx === effectiveSectionIdx
                    ? "ring-1 ring-emerald-500/40"
                    : "opacity-85"
                }`}
              >
                {q.number}
                {isFlagged && !detail && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-white dark:ring-slate-900"
                  />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* My Notes & Highlights Drawer (GĐ4) */}
      <AnnotationsDrawer
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        annotations={annotations}
        sectionLabelsById={sectionLabelsById}
        notesText={notesText}
        onNotesTextChange={setNotesText}
        canUndo={annotationHistory.length > 0}
        onUndo={handleUndoAnnotation}
        onJumpToAnnotation={handleJumpToAnnotation}
        onUpdateAnnotation={handleUpdateAnnotation}
        onDeleteAnnotation={handleDeleteAnnotation}
        onClearAllAnnotations={handleClearAllAnnotations}
        isEn={isEn}
      />
    </div>
  );
}
