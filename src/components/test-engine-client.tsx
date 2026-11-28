"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Headphones,
  Highlighter,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  StickyNote,
  Volume2,
} from "lucide-react";
import type { IeltsTest, QuestionType } from "@/lib/types";
import type { GradedTestResult } from "@/lib/test-grader";
import { normalizeSectionToGroups } from "@/lib/test-groups";
import { formatDuration } from "@/lib/utils";
import { TestDiagramSvg } from "./test-diagram-svg";
import { QuestionGroupRenderer } from "./exam/question-group-renderer";
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
  onDailySubmit?: (answers: Record<string, string>) => Promise<GradedTestResult | null>;
}

export function TestEngineClient({
  test,
  mode = "practice",
  initialSecondsLeft,
  onDailySubmit,
}: TestEngineClientProps) {
  const locale = useLocale();
  const isEn = locale === "en";

  const totalSeconds = initialSecondsLeft ?? test.duration_minutes * 60;
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [highlightedLines, setHighlightedLines] = useState<Record<string, boolean>>({});
  const [highlightMode, setHighlightMode] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [graded, setGraded] = useState<GradedTestResult | null>(null);
  const [showScript, setShowScript] = useState(false);

  // Real HTML5 MP3 audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mp3Playing, setMp3Playing] = useState(false);
  const [mp3Time, setMp3Time] = useState(0);
  const [mp3Duration, setMp3Duration] = useState(0);

  // Fallback Web Speech API state (only when a custom test has audioScript without audioUrl)
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [audioRate, setAudioRate] = useState(1.0);
  const [activeAudioParagraph, setActiveAudioParagraph] = useState(0);

  const currentSection = test.sections[activeSectionIdx] ?? test.sections[0];

  const allQuestions = useMemo(
    () => test.sections.flatMap((s) => s.questions),
    [test.sections]
  );

  // Countdown timer
  useEffect(() => {
    if (graded) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [graded]);

  // Cleanup TTS and audio on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sync playbackRate on HTML5 audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = audioRate;
    }
  }, [audioRate, activeSectionIdx]);

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

  const switchSection = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= test.sections.length) return;
    stopAllAudio();
    setMp3Time(0);
    setMp3Duration(0);
    setActiveAudioParagraph(0);
    setActiveSectionIdx(nextIdx);
  };

  const audioParagraphs = useMemo(() => {
    const raw = currentSection?.audioScript ?? "";
    return raw
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [currentSection]);

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
      if (mode === "daily" && onDailySubmit) {
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
      const durationSeconds = Math.max(1, totalSeconds - secondsLeft);
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
      setGraded(data.graded);
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
    if (sectionIndex !== activeSectionIdx) {
      switchSection(sectionIndex);
      setTimeout(() => {
        document.getElementById(`question-card-${qId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 60);
    } else {
      document.getElementById(`question-card-${qId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  const answeredCount = Object.values(answers).filter((v) => v.trim().length > 0).length;
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

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 space-y-5">
      {submitError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
        >
          {submitError}
        </div>
      )}
      {/* Computer-Delivered Top Exam Bar */}
      <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{test.skill.toUpperCase()}</Badge>
            <Badge variant="secondary">
              {test.module === "academic" ? "Academic" : "General"}
            </Badge>
            <Badge variant="secondary">
              {allQuestions.length} {isEn ? "questions" : "câu"}
            </Badge>
            {mode === "daily" && <Badge variant="amber">Daily Sprint</Badge>}
          </div>
          <h1 className="mt-1 truncate text-base font-bold text-slate-900 dark:text-white">
            {isEn ? test.title_en : test.title_vi}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timer */}
          <div
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold ${
              secondsLeft < 300
                ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
            }`}
          >
            <Clock className="h-4 w-4 text-emerald-600" />
            {formatDuration(secondsLeft)}
          </div>

          {/* Highlight toggle */}
          {test.skill === "reading" && (
            <Button
              type="button"
              size="sm"
              variant={highlightMode ? "default" : "outline"}
              onClick={() => setHighlightMode((v) => !v)}
            >
              <Highlighter className="h-3.5 w-3.5" />
              {isEn ? "Highlight" : "Tô sáng"}
            </Button>
          )}

          {/* Notes toggle */}
          <Button
            type="button"
            size="sm"
            variant={notesOpen ? "secondary" : "outline"}
            onClick={() => setNotesOpen((v) => !v)}
          >
            <StickyNote className="h-3.5 w-3.5" />
            {isEn ? "Notes" : "Ghi chú"}
          </Button>

          {/* Font size */}
          <div className="hidden sm:flex rounded-lg border border-slate-200 dark:border-slate-700">
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

          {!graded ? (
            <Button
              type="button"
              id="submit-test-btn"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEn
                ? `Submit (${answeredCount}/${allQuestions.length})`
                : `Nộp bài (${answeredCount}/${allQuestions.length})`}
            </Button>
          ) : (
            <Link href="/tests">
              <Button variant="outline" size="sm">
                {isEn ? "All Tests" : "Danh sách đề"}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Computer-Delivered Passage / Part Tab Bar */}
      {test.sections.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-2 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-wrap gap-1.5">
            {test.sections.map((sec, idx) => {
              const secAnswered = sec.questions.filter(
                (q) => (answers[q.id] ?? "").trim().length > 0
              ).length;
              const qStart = sec.questions[0]?.number ?? 1;
              const qEnd = sec.questions[sec.questions.length - 1]?.number ?? sec.questions.length;
              const isActive = idx === activeSectionIdx;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => switchSection(idx)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
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

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={activeSectionIdx === 0}
              onClick={() => switchSection(activeSectionIdx - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {isEn ? "Prev" : "Phần trước"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={activeSectionIdx === test.sections.length - 1}
              onClick={() => switchSection(activeSectionIdx + 1)}
            >
              {isEn ? "Next" : "Phần tiếp"}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Collapsible Scratchpad Notes */}
      {notesOpen && (
        <Card className="p-4 border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <label className="mb-1.5 block text-xs font-bold text-amber-900 dark:text-amber-300">
            {isEn
              ? "Exam Scratchpad Notes (saved during session)"
              : "Ghi chú nháp trong khi làm bài"}
          </label>
          <textarea
            rows={3}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder={
              isEn
                ? "Jot down keywords, numbers, or paraphrases..."
                : "Ghi nhanh từ khóa, con số, ý chính đoạn văn..."
            }
            className="w-full rounded-xl border border-amber-200 bg-white p-3 text-xs dark:border-amber-900 dark:bg-slate-950"
          />
        </Card>
      )}

      {/* GRADED RESULT SUMMARY + MISTAKE ANALYTICS */}
      {graded && (
        <div id="test-result-summary" className="grid gap-5 lg:grid-cols-12">
          <Card className="p-6 lg:col-span-5 flex items-center gap-5 bg-emerald-50/50 dark:bg-emerald-950/30">
            {graded.isFullIeltsTest && graded.bandScore !== null ? (
              <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <span className="text-[11px] font-semibold uppercase opacity-85">Band</span>
                <span className="text-4xl font-bold">{graded.bandScore.toFixed(1)}</span>
              </div>
            ) : (
              <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm dark:bg-emerald-700">
                <span className="text-[10px] font-semibold uppercase opacity-85">
                  {isEn ? "Accuracy" : "Chính xác"}
                </span>
                <span className="text-3xl font-bold">{graded.accuracyPercent}%</span>
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isEn ? "Test Completed!" : "Hoàn thành bài thi!"}
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {isEn
                  ? `Score: ${graded.rawScore} / ${graded.maxScore} correct (${graded.accuracyPercent}%)`
                  : `Số câu đúng: ${graded.rawScore} / ${graded.maxScore} câu (${graded.accuracyPercent}%)`}
              </p>
              {!graded.isFullIeltsTest && (
                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {isEn
                    ? "Short practice sprint (< 40 questions): official IELTS Band score is only calculated on full 40-question tests."
                    : "Đề rút gọn (< 40 câu): chỉ hiển thị tỷ lệ % chính xác, không quy đổi Band IELTS chính thức."}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {isEn
                  ? "Review bilingual explanations (VI + EN) for every question below."
                  : "Xem đáp án và giải thích chi tiết song ngữ VI + EN cho từng câu bên dưới."}
              </p>
              <div className="mt-3">
                <Link
                  href="/progress"
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  {isEn ? "View Learning Progress →" : "Xem Tiến độ học tập →"}
                </Link>
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
              {Object.entries(graded.breakdownByType).map(([type, stat]) => {
                const pct = Math.round((stat.correct / Math.max(1, stat.total)) * 100);
                return (
                  <div
                    key={type}
                    className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{QUESTION_TYPE_LABELS[type as QuestionType] ?? type}</span>
                      <span className={pct >= 70 ? "text-emerald-600" : "text-amber-600"}>
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

      {/* COMPUTER-DELIVERED SPLIT-PANE WORKSPACE (ACTIVE SECTION) */}
      {currentSection && (
        <div key={currentSection.id} className="grid gap-5 lg:grid-cols-12">
          {/* LEFT PANE: Reading Passage OR Listening Audio Player + Diagram */}
          <Card className="p-6 lg:col-span-6 lg:max-h-[75vh] lg:overflow-y-auto space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {currentSection.title}
              </h2>
              {currentSection.instruction && (
                <p className="mt-1 text-xs text-slate-500">{currentSection.instruction}</p>
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
                  onLoadedMetadata={(e) => setMp3Duration(e.currentTarget.duration || 0)}
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
                    <Button type="button" size="sm" variant="ghost" onClick={restartMp3}>
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
                  <div className="mt-2 space-y-2 rounded-xl bg-white p-3.5 text-xs leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {audioParagraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
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
                      <Button type="button" size="sm" variant="outline" onClick={stopAllAudio}>
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
                  <div className="mt-2 space-y-2 rounded-xl bg-white p-3.5 text-xs leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {audioParagraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
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

            {/* READING PASSAGE WITH CLICK-TO-HIGHLIGHT */}
            {currentSection.passage && (
              <div className={`space-y-4 ${textSizeCls} text-slate-800 dark:text-slate-200`}>
                {highlightMode && (
                  <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    {isEn
                      ? "Highlight mode ON: click any sentence below to highlight/unhighlight."
                      : "Chế độ Tô sáng đang BẬT: nhấn vào bất kỳ câu nào bên dưới để đánh dấu ý quan trọng."}
                  </p>
                )}
                {currentSection.passage.split(/\n\n+/).map((para, pIdx) => (
                  <p key={pIdx} className="whitespace-pre-line">
                    {para.split(/(?<=[.!?])\s+/).map((sent, sIdx) => {
                      const key = `${currentSection.id}-${pIdx}-${sIdx}`;
                      const isLit = Boolean(highlightedLines[key]);
                      return (
                        <span
                          key={key}
                          onClick={() => {
                            if (!highlightMode) return;
                            setHighlightedLines((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }));
                          }}
                          className={`${highlightMode ? "cursor-pointer hover:bg-amber-100/70" : ""} ${
                            isLit
                              ? "rounded bg-amber-200/80 px-0.5 text-slate-950 dark:bg-amber-700/60 dark:text-white"
                              : ""
                          }`}
                        >
                          {sent}{" "}
                        </span>
                      );
                    })}
                  </p>
                ))}
              </div>
            )}
          </Card>

          {/* RIGHT PANE: INTERACTIVE QUESTION GROUPS (CBT IELTS BY TYPE) */}
          <div className="lg:col-span-6 lg:max-h-[75vh] lg:overflow-y-auto space-y-5 pr-1">
            {(() => {
              const groups = normalizeSectionToGroups(currentSection);
              const qById = new Map(currentSection.questions.map((q) => [q.id, q]));
              return groups.map((group) => {
                const groupQuestions = group.questionIds
                  .map((id) => qById.get(id))
                  .filter((q): q is NonNullable<typeof q> => Boolean(q));
                if (groupQuestions.length === 0) return null;
                return (
                  <QuestionGroupRenderer
                    key={group.id}
                    group={group}
                    questions={groupQuestions}
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
                  />
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Bottom Question Palette (1–40 across all Passages/Parts) */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
            <FileText className="h-4 w-4 text-emerald-600" />
            {isEn ? "Question Navigator" : "Bảng chuyển nhanh câu hỏi"} ({answeredCount}/
            {allQuestions.length})
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />{" "}
              {isEn ? "Answered" : "Đã làm"}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />{" "}
              {isEn ? "Flagged" : "Đánh dấu"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {test.sections.map((sec, secIdx) =>
            sec.questions.map((q) => {
              const answered = Boolean(answers[q.id]?.trim());
              const isFlagged = Boolean(flagged[q.id]);
              const detail = graded?.details.find((d) => d.questionId === q.id);

              let cls =
                "border-slate-200 bg-white text-slate-700 hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300";
              if (detail) {
                cls = detail.isCorrect
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-red-500 bg-red-500 text-white";
              } else if (isFlagged) {
                cls = "border-amber-400 bg-amber-100 text-amber-900";
              } else if (answered) {
                cls = "border-emerald-600 bg-emerald-600 text-white";
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => jumpToQuestion(q.id, secIdx)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold transition cursor-pointer ${cls} ${
                    secIdx === activeSectionIdx ? "ring-1 ring-emerald-500/40" : "opacity-85"
                  }`}
                >
                  {q.number}
                </button>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
