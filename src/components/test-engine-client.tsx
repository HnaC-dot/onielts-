"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  Highlighter,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  StickyNote,
  Volume2,
  XCircle,
} from "lucide-react";
import type { IeltsTest, QuestionType } from "@/lib/types";
import type { GradedTestResult } from "@/lib/test-grader";
import { formatDuration } from "@/lib/utils";
import { TestDiagramSvg } from "./test-diagram-svg";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  tfng: "True / False / Not Given",
  ynng: "Yes / No / Not Given",
  matching_headings: "Matching Headings",
  matching_info: "Matching Information",
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
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [highlightedLines, setHighlightedLines] = useState<Record<string, boolean>>({});
  const [highlightMode, setHighlightMode] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");
  const [submitting, setSubmitting] = useState(false);
  const [graded, setGraded] = useState<GradedTestResult | null>(null);
  const [showScript, setShowScript] = useState(false);

  // Listening Audio Player state (Web Speech API)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioRate, setAudioRate] = useState(1.0);
  const [activeAudioParagraph, setActiveAudioParagraph] = useState(0);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

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

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const audioParagraphs = useMemo(() => {
    const raw = test.sections[0]?.audioScript ?? "";
    return raw
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [test.sections]);

  const playAudioFrom = (startIdx: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (startIdx >= audioParagraphs.length) {
      setIsPlayingAudio(false);
      return;
    }
    setIsPlayingAudio(true);
    setActiveAudioParagraph(startIdx);

    const speakStep = (idx: number) => {
      if (idx >= audioParagraphs.length) {
        setIsPlayingAudio(false);
        return;
      }
      setActiveAudioParagraph(idx);
      const utter = new SpeechSynthesisUtterance(audioParagraphs[idx]);
      utter.lang = "en-GB";
      utter.rate = audioRate;
      utter.onend = () => speakStep(idx + 1);
      utter.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utter);
    };
    speakStep(startIdx);
  };

  const pauseAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  const handleSubmit = async () => {
    if (submitting || graded) return;
    pauseAudio();
    setSubmitting(true);
    try {
      if (mode === "daily" && onDailySubmit) {
        const res = await onDailySubmit(answers);
        if (res) setGraded(res);
        return;
      }
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      );
      const res = await fetch("/api/tests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testSlug: test.slug,
          answers,
          durationSeconds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGraded(data.graded);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToQuestion = (qId: string) => {
    document.getElementById(`question-card-${qId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const answeredCount = Object.values(answers).filter((v) => v.trim().length > 0).length;
  const textSizeCls =
    fontSize === "sm" ? "text-xs leading-6" : fontSize === "lg" ? "text-base leading-8" : "text-sm leading-7";

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 space-y-5">
      {/* Computer-Delivered Top Exam Bar */}
      <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge>{test.skill.toUpperCase()}</Badge>
            <Badge variant="secondary">{test.module === "academic" ? "Academic" : "General"}</Badge>
            {mode === "daily" && <Badge variant="amber">Daily Exam</Badge>}
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
              {isEn ? `Submit (${answeredCount}/${allQuestions.length})` : `Nộp bài (${answeredCount}/${allQuestions.length})`}
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

      {/* Collapsible Scratchpad Notes */}
      {notesOpen && (
        <Card className="p-4 border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <label className="mb-1.5 block text-xs font-bold text-amber-900 dark:text-amber-300">
            {isEn ? "Exam Scratchpad Notes (saved during session)" : "Ghi chú nháp trong khi làm bài"}
          </label>
          <textarea
            rows={3}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder={isEn ? "Jot down keywords, numbers, or paraphrases..." : "Ghi nhanh từ khóa, con số, ý chính đoạn văn..."}
            className="w-full rounded-xl border border-amber-200 bg-white p-3 text-xs dark:border-amber-900 dark:bg-slate-950"
          />
        </Card>
      )}

      {/* GRADED RESULT SUMMARY + MISTAKE ANALYTICS */}
      {graded && (
        <div id="test-result-summary" className="grid gap-5 lg:grid-cols-12">
          <Card className="p-6 lg:col-span-5 flex items-center gap-5 bg-emerald-50/50 dark:bg-emerald-950/30">
            <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <span className="text-[11px] font-semibold uppercase opacity-85">Band</span>
              <span className="text-4xl font-bold">{graded.bandScore.toFixed(1)}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isEn ? "Test Completed!" : "Hoàn thành bài thi!"}
              </h2>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {isEn
                  ? `Score: ${graded.rawScore} / ${graded.maxScore} correct`
                  : `Số câu đúng: ${graded.rawScore} / ${graded.maxScore} câu`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {isEn
                  ? "Scroll down to review bilingual explanations (VI + EN) for every question."
                  : "Kéo xuống để xem đáp án và giải thích chi tiết song ngữ VI + EN cho từng câu."}
              </p>
            </div>
          </Card>

          <Card className="p-6 lg:col-span-7 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEn ? "Mistake Analysis by Question Type" : "Phân tích độ chính xác theo từng dạng câu hỏi"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(graded.breakdownByType).map(([type, stat]) => {
                const pct = Math.round((stat.correct / Math.max(1, stat.total)) * 100);
                return (
                  <div key={type} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{QUESTION_TYPE_LABELS[type as QuestionType] ?? type}</span>
                      <span className={pct >= 70 ? "text-emerald-600" : "text-amber-600"}>
                        {stat.correct}/{stat.total} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-600" : "bg-amber-500"}`}
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

      {/* COMPUTER-DELIVERED SPLIT-PANE WORKSPACE */}
      {test.sections.map((section) => (
        <div key={section.id} className="grid gap-5 lg:grid-cols-12">
          {/* LEFT PANE: Reading Passage OR Listening Audio Player + Diagram */}
          <Card className="p-6 lg:col-span-6 lg:max-h-[75vh] lg:overflow-y-auto space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {section.title}
              </h2>
              {section.instruction && (
                <p className="mt-1 text-xs text-slate-500">{section.instruction}</p>
              )}
            </div>

            {/* LISTENING AUDIO PLAYER */}
            {section.audioScript && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {!isPlayingAudio ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => playAudioFrom(activeAudioParagraph)}
                      >
                        <Play className="h-4 w-4" />
                        {isEn ? "Play Audio" : "Phát băng nghe"}
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={pauseAudio}>
                        <Pause className="h-4 w-4" />
                        {isEn ? "Pause" : "Tạm dừng"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => playAudioFrom(0)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {isEn ? "Restart" : "Nghe lại từ đầu"}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <Volume2 className="h-4 w-4 text-emerald-600" />
                    <select
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

                {/* Progress segment bar */}
                <div className="flex gap-1.5">
                  {audioParagraphs.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => playAudioFrom(i)}
                      className={`h-2 flex-1 rounded-full transition cursor-pointer ${
                        i < activeAudioParagraph
                          ? "bg-emerald-600"
                          : i === activeAudioParagraph && isPlayingAudio
                          ? "bg-emerald-500 animate-pulse"
                          : "bg-slate-200 dark:bg-slate-700"
                      }`}
                      title={`Segment ${i + 1}`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>
                    {isEn
                      ? `Segment ${activeAudioParagraph + 1} of ${audioParagraphs.length}`
                      : `Đoạn âm thanh ${activeAudioParagraph + 1} / ${audioParagraphs.length}`}
                  </span>
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
                </div>

                {(showScript || graded) && (
                  <div className="mt-2 space-y-2 rounded-xl bg-white p-3.5 text-xs leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {audioParagraphs.map((p, idx) => (
                      <p
                        key={idx}
                        className={
                          idx === activeAudioParagraph && isPlayingAudio
                            ? "rounded bg-emerald-100/70 px-1.5 py-0.5 dark:bg-emerald-950"
                            : ""
                        }
                      >
                        {p}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SVG MAP OR DIAGRAM */}
            {section.diagramSvgType && (
              <div className="space-y-2">
                {section.diagramLabel && (
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {section.diagramLabel}
                  </p>
                )}
                <TestDiagramSvg type={section.diagramSvgType} />
              </div>
            )}

            {/* HEADING BANK (for Matching Headings) */}
            {section.headingBank && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                  List of Headings
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-800 dark:text-slate-200">
                  {section.headingBank.map((h) => (
                    <li key={h.id}>
                      <strong className="text-emerald-700 dark:text-emerald-400">{h.id}.</strong>{" "}
                      {h.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* READING PASSAGE WITH CLICK-TO-HIGHLIGHT */}
            {section.passage && (
              <div className={`space-y-4 ${textSizeCls} text-slate-800 dark:text-slate-200`}>
                {highlightMode && (
                  <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    ✨ {isEn ? "Highlight mode ON: click any sentence below to highlight/unhighlight." : "Chế độ Tô sáng đang BẬT: nhấn vào bất kỳ câu nào bên dưới để đánh dấu ý quan trọng."}
                  </p>
                )}
                {section.passage.split(/\n\n+/).map((para, pIdx) => (
                  <p key={pIdx} className="whitespace-pre-line">
                    {para.split(/(?<=[.!?])\s+/).map((sent, sIdx) => {
                      const key = `${section.id}-${pIdx}-${sIdx}`;
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
                            isLit ? "rounded bg-amber-200/80 px-0.5 text-slate-950 dark:bg-amber-700/60 dark:text-white" : ""
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

          {/* RIGHT PANE: INTERACTIVE QUESTIONS */}
          <div className="lg:col-span-6 lg:max-h-[75vh] lg:overflow-y-auto space-y-4 pr-1">
            {section.questions.map((q) => {
              const detail = graded?.details.find((d) => d.questionId === q.id);
              const val = answers[q.id] ?? "";
              return (
                <Card
                  key={q.id}
                  id={`question-card-${q.id}`}
                  className={`p-5 transition ${
                    detail
                      ? detail.isCorrect
                        ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20"
                        : "border-red-300 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
                        {q.number}
                      </span>
                      <Badge variant="secondary">
                        {QUESTION_TYPE_LABELS[q.type]}
                      </Badge>
                    </div>
                    {!graded && (
                      <button
                        type="button"
                        onClick={() =>
                          setFlagged((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                        }
                        title="Đánh dấu xem lại"
                        className={`rounded-lg p-1.5 cursor-pointer ${
                          flagged[q.id]
                            ? "bg-amber-100 text-amber-700"
                            : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
                    {q.prompt}
                  </p>

                  {/* Answer input tailored to question type */}
                  <div className="mt-3.5">
                    {q.options && q.options.length > 0 ? (
                      <div className="grid gap-2">
                        {q.options.map((opt) => {
                          const selected = val === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              disabled={Boolean(graded)}
                              onClick={() =>
                                setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                              }
                              className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition cursor-pointer ${
                                selected
                                  ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        disabled={Boolean(graded)}
                        value={val}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder={isEn ? "Type your answer..." : "Nhập câu trả lời..."}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    )}
                  </div>

                  {/* Bilingual Explanation after submission */}
                  {detail && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 text-xs space-y-1.5 dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex items-center gap-2 font-bold">
                        {detail.isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            {isEn ? "Correct" : "Chính xác"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" />
                            {isEn ? "Incorrect" : "Chưa đúng"} · Đáp án:{" "}
                            <strong className="text-emerald-700 dark:text-emerald-400">
                              {detail.acceptedAnswers[0]}
                            </strong>
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">
                        <strong>Giải thích (VI):</strong> {detail.explanation_vi}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        <strong>Explanation (EN):</strong> {detail.explanation_en}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* BOTTOM QUESTION NAVIGATOR */}
      <Card className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <FileText className="h-4 w-4 text-emerald-600" />
          {isEn ? "Question Navigator:" : "Điều hướng câu hỏi:"}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allQuestions.map((q) => {
            const isAnswered = Boolean((answers[q.id] ?? "").trim());
            const isFlagged = Boolean(flagged[q.id]);
            const detail = graded?.details.find((d) => d.questionId === q.id);

            let cls =
              "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
            if (detail) {
              cls = detail.isCorrect
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-red-500 bg-red-500 text-white";
            } else if (isFlagged) {
              cls = "border-amber-400 bg-amber-100 text-amber-900";
            } else if (isAnswered) {
              cls = "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => scrollToQuestion(q.id)}
                className={`h-8 w-8 rounded-lg border text-xs font-bold transition cursor-pointer ${cls}`}
              >
                {q.number}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
