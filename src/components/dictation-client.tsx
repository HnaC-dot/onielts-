"use client";

import React, { useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  CheckCircle2,
  Headphones,
  Mic,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";
import type { DictationLesson } from "@/lib/types";
import { diffDictationSentence, type DictationDiffResult } from "@/lib/srs";
import { pickSupportedAudioMimeType, speakEnglish } from "@/lib/audio-recorder";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function DictationClient({
  lessons,
  initialSlug,
}: {
  lessons: DictationLesson[];
  initialSlug?: string;
}) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [lessonSlug, setLessonSlug] = useState(
    lessons.find((l) => l.slug === initialSlug)?.slug ?? lessons[0]?.slug ?? ""
  );
  const [mode, setMode] = useState<"dictation" | "shadowing">("dictation");
  const [sentIdx, setSentIdx] = useState(0);
  const [speed, setSpeed] = useState(0.95);
  const [typed, setTyped] = useState("");
  const [diff, setDiff] = useState<DictationDiffResult | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // Shadowing self-recording
  const [isRecording, setIsRecording] = useState(false);
  const [shadowAudioUrl, setShadowAudioUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const lesson = lessons.find((l) => l.slug === lessonSlug) ?? lessons[0];
  if (!lesson) return null;
  const sentence = lesson.sentences[sentIdx] ?? lesson.sentences[0];

  const switchSentence = (nextIdx: number) => {
    setSentIdx(nextIdx);
    setTyped("");
    setDiff(null);
    setShowAnswer(false);
    setShadowAudioUrl(null);
  };

  const handlePlay = () => {
    speakEnglish(sentence.text, lesson.accent, speed);
  };

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typed.trim()) return;
    setDiff(diffDictationSentence(sentence.text, typed));
  };

  const toggleShadowRecord = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickSupportedAudioMimeType();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        setShadowAudioUrl(URL.createObjectURL(blob));
      };
      recorderRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Lesson selector */}
      <Card className="p-4 lg:col-span-4 space-y-2">
        <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          {isEn ? "Lessons" : "Danh sách bài luyện"}
        </p>
        {lessons.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => {
              setLessonSlug(l.slug);
              switchSentence(0);
            }}
            className={`w-full rounded-xl p-3.5 text-left transition cursor-pointer ${
              l.slug === lesson.slug
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/70"
            }`}
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold opacity-85">{l.category}</span>
              <span>{l.accent}</span>
            </div>
            <p className="mt-1 text-sm font-bold">
              {isEn ? l.title_en : l.title_vi}
            </p>
            <p
              className={`mt-0.5 text-xs ${
                l.slug === lesson.slug ? "text-emerald-100" : "text-slate-500"
              }`}
            >
              {l.sentences.length} {isEn ? "sentences" : "câu"} · {l.difficulty}
            </p>
          </button>
        ))}
      </Card>

      {/* Active Dictation / Shadowing Arena */}
      <Card className="p-6 lg:col-span-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("dictation")}
              className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer ${
                mode === "dictation"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <Headphones className="mr-1.5 inline h-3.5 w-3.5" />
              {isEn ? "Dictation (Diff Check)" : "Chép chính tả (So từng từ)"}
            </button>
            <button
              type="button"
              onClick={() => setMode("shadowing")}
              className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer ${
                mode === "shadowing"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <Mic className="mr-1.5 inline h-3.5 w-3.5" />
              {isEn ? "Shadowing Mode" : "Chế độ Shadowing (Nói đuổi)"}
            </button>
          </div>

          <Badge variant="secondary">
            {isEn ? `Sentence ${sentIdx + 1}/${lesson.sentences.length}` : `Câu ${sentIdx + 1} / ${lesson.sentences.length}`}
          </Badge>
        </div>

        {/* Audio Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50/50 p-4 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={sentIdx === 0}
              onClick={() => switchSentence(sentIdx - 1)}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button type="button" onClick={handlePlay}>
              <Play className="h-4 w-4" />
              {isEn ? "Play Sentence" : "Nghe câu này"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={sentIdx >= lesson.sentences.length - 1}
              onClick={() => switchSentence(sentIdx + 1)}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Volume2 className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              {isEn ? "Speed:" : "Tốc độ:"}
            </span>
            {[0.75, 0.95, 1.15].map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => setSpeed(sp)}
                className={`rounded-lg px-2 py-1 font-bold cursor-pointer ${
                  speed === sp
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {sp}x
              </button>
            ))}
          </div>
        </div>

        {/* DICTATION MODE */}
        {mode === "dictation" ? (
          <form onSubmit={handleCheck} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {isEn ? "Type exactly what you hear:" : "Gõ chính xác câu tiếng Anh bạn nghe được:"}
              </label>
              <textarea
                id="dictation-input"
                rows={3}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type what you hear..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" id="dictation-check-btn" disabled={!typed.trim()}>
                <CheckCircle2 className="h-4 w-4" />
                {isEn ? "Check Word Diff" : "Kiểm tra sai khác từng từ"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAnswer((v) => !v)}
              >
                {showAnswer ? (isEn ? "Hide Script" : "Ẩn đáp án") : isEn ? "Reveal Script" : "Hiện câu gốc"}
              </Button>
            </div>

            {diff && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-500">
                    {isEn ? "Word-by-Word Comparison" : "Kết quả đối chiếu từng từ"}
                  </span>
                  <Badge variant={diff.accuracyPercent >= 85 ? "default" : "amber"}>
                    {diff.accuracyPercent}% ({diff.correctCount}/{diff.totalExpected})
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5 text-sm leading-7">
                  {diff.tokens.map((tok, i) =>
                    tok.status === "correct" ? (
                      <span
                        key={i}
                        className="rounded-md bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        {tok.word}
                      </span>
                    ) : tok.status === "missing" ? (
                      <span
                        key={i}
                        className="rounded-md border border-dashed border-amber-400 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        title="Từ bị thiếu"
                      >
                        [{tok.word}]
                      </span>
                    ) : (
                      <span
                        key={i}
                        className="rounded-md bg-red-100 px-1.5 py-0.5 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                      >
                        <span className="line-through">{tok.word}</span>
                        {tok.expected && (
                          <span className="ml-1 font-bold text-emerald-700 dark:text-emerald-400">
                            → {tok.expected}
                          </span>
                        )}
                      </span>
                    )
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  <strong>Nghĩa tiếng Việt:</strong> {sentence.translation_vi}
                </p>
                {sentence.tip_vi && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    💡 {sentence.tip_vi}
                  </p>
                )}
              </div>
            )}

            {showAnswer && !diff && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-1 dark:bg-slate-900">
                <p className="font-bold text-slate-900 dark:text-white">{sentence.text}</p>
                <p className="text-xs text-slate-500">{sentence.translation_vi}</p>
              </div>
            )}
          </form>
        ) : (
          /* SHADOWING MODE */
          <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-white p-6 space-y-2 dark:border-emerald-900 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                {isEn ? "Listen & Shadow Aloud (Focus on Rhythm & Stress)" : "Nghe và nói đuổi đồng thời (Chú ý trọng âm & nối âm)"}
              </p>
              <p className="text-lg font-bold leading-relaxed text-slate-900 dark:text-white">
                {sentence.text}
              </p>
              <p className="text-xs text-slate-500">{sentence.translation_vi}</p>
              {sentence.tip_vi && (
                <p className="pt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  💡 {sentence.tip_vi}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant={isRecording ? "destructive" : "default"}
                onClick={toggleShadowRecord}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isRecording
                  ? isEn
                    ? "Stop Shadow Recording"
                    : "Dừng ghi âm nói đuổi"
                  : isEn
                  ? "Record Yourself Shadowing"
                  : "Ghi âm giọng đọc của bạn để đối chiếu"}
              </Button>
            </div>

            {shadowAudioUrl && (
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                  {isEn ? "Your Shadowing Playback:" : "Nghe lại bản ghi Shadowing của bạn:"}
                </p>
                <audio controls src={shadowAudioUrl} className="w-full" />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
