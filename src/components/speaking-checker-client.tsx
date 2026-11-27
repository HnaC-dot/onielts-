"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mic,
  Sparkles,
  Square,
  Upload,
  Volume2,
} from "lucide-react";
import type { SpeakingSubmission } from "@/lib/types";
import type { UsageCheckResult } from "@/lib/usage-limits";
import {
  blobToBase64,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_SEC,
  normalizeAudioMimeForGemini,
  pickSupportedAudioMimeType,
  speakEnglish,
} from "@/lib/audio-recorder";
import { formatDuration } from "@/lib/utils";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { PaywallModal } from "./paywall-modal";

const SAMPLE_SPEAKING_PROMPTS = {
  part_1: "What do you usually enjoy doing on weekends, and has that changed compared to a few years ago?",
  part_2:
    "Describe a quiet outdoor place in your hometown where you enjoy relaxing.\nYou should say:\n• Where it is located\n• How often you visit it\n• What you usually do there\n• And explain why it helps you unwind.",
  part_3:
    "Why do you think urban residents increasingly seek out green spaces, and should cities dedicate more public budgets to parks?",
};

export function SpeakingCheckerClient({
  initialUsage,
  initialSubmissions,
}: {
  initialUsage: UsageCheckResult;
  initialSubmissions: SpeakingSubmission[];
}) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [part, setPart] = useState<"part_1" | "part_2" | "part_3">("part_1");
  const [promptText, setPromptText] = useState(SAMPLE_SPEAKING_PROMPTS.part_1);
  const [transcriptHint, setTranscriptHint] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMime, setAudioMime] = useState<string>("audio/webm");
  const [recordError, setRecordError] = useState("");

  const [usage, setUsage] = useState<UsageCheckResult>(initialUsage);
  const [submissions, setSubmissions] = useState<SpeakingSubmission[]>(initialSubmissions);
  const [active, setActive] = useState<SpeakingSubmission | null>(initialSubmissions[0] ?? null);
  const [loading, setLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const startRecording = async () => {
    setRecordError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chosenMime = pickSupportedAudioMimeType();
      const recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || chosenMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMime });
        stream.getTracks().forEach((tr) => tr.stop());
        if (blob.size > MAX_AUDIO_BYTES) {
          setRecordError("Tệp ghi âm vượt quá giới hạn 10MB.");
          return;
        }
        setAudioBlob(blob);
        setAudioMime(normalizeAudioMimeForGemini(finalMime));
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setElapsedSec(0);

      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => {
          if (prev + 1 >= MAX_AUDIO_DURATION_SEC) {
            stopRecording();
            return MAX_AUDIO_DURATION_SEC;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setRecordError(
        isEn
          ? "Microphone access unavailable. You can upload an audio file or type/test a sample below."
          : "Không thể truy cập micro trên thiết bị này. Bạn có thể tải tệp âm thanh hoặc nhập/chấm thử bản ghi mẫu bên dưới."
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AUDIO_BYTES) {
      setRecordError("Tệp âm thanh vượt quá 10MB.");
      return;
    }
    setRecordError("");
    setAudioBlob(file);
    setAudioMime(normalizeAudioMimeForGemini(file.type || "audio/mpeg"));
    setElapsedSec(45);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const submitEvaluation = async (overrideTranscript?: string) => {
    setLoading(true);
    setRecordError("");
    try {
      let audioBase64: string | undefined;
      if (audioBlob && !overrideTranscript) {
        audioBase64 = await blobToBase64(audioBlob);
      }

      const res = await fetch("/api/speaking/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part,
          promptText,
          durationSec: Math.max(10, Math.min(MAX_AUDIO_DURATION_SEC, elapsedSec || 35)),
          audioBase64,
          audioMimeType: audioBase64 ? audioMime : undefined,
          transcriptHint: overrideTranscript ?? (transcriptHint.trim() || undefined),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data.limitReached) {
        if (data.usage) setUsage(data.usage);
        setPaywallOpen(true);
        return;
      }
      if (!res.ok) {
        setRecordError(data.error || "Không thể chấm bài nói.");
        return;
      }
      const created: SpeakingSubmission = data.submission;
      setActive(created);
      setSubmissions((prev) => [created, ...prev]);
      if (data.usage) setUsage(data.usage);
    } catch {
      setRecordError("Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Sub-navigation + Quota */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link href="/speaking" className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white">
            {isEn ? "AI Speaking Checker" : "Chấm bài Speaking AI"}
          </Link>
          <Link
            href="/speaking/generator"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            {isEn ? "Parts 1–3 Sample Generator" : "Tạo câu trả lời mẫu Parts 1–3"}
          </Link>
          <Link
            href="/conversations"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            {isEn ? "AI Role-play Conversations" : "Hội thoại AI đóng vai"}
          </Link>
        </div>

        {usage.isPremium ? (
          <Badge variant={usage.remaining === 0 ? "amber" : "default"}>
            {usage.limit !== null
              ? isEn
                ? `Premium · ${usage.remaining}/${usage.limit} checks left today`
                : `Premium · còn ${usage.remaining}/${usage.limit} lượt hôm nay`
              : isEn
              ? "Premium · Unlimited"
              : "Premium · Không giới hạn"}
          </Badge>
        ) : (
          <Badge variant={usage.remaining === 0 ? "amber" : "secondary"}>
            {isEn
              ? `Free: ${usage.remaining}/${usage.limit} speaking checks left`
              : `Free: còn ${usage.remaining}/${usage.limit} lượt chấm tháng này`}
          </Badge>
        )}
      </div>

      {/* Recorder & Input Card */}
      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(["part_1", "part_2", "part_3"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPart(p);
                  setPromptText(SAMPLE_SPEAKING_PROMPTS[p]);
                }}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer ${
                  part === p
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {p === "part_1" ? "Part 1" : p === "part_2" ? "Part 2 (Cue Card)" : "Part 3"}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => speakEnglish(promptText)}
          >
            <Volume2 className="h-4 w-4 text-emerald-600" />
            {isEn ? "Listen to examiner question" : "Nghe giám khảo đọc đề"}
          </Button>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
            {isEn ? "Speaking Question / Cue Card" : "Câu hỏi / Thẻ Cue Card"}
          </label>
          <textarea
            rows={part === "part_2" ? 5 : 2}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        {/* Recording controls */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {!isRecording ? (
                <Button type="button" size="lg" onClick={startRecording}>
                  <Mic className="h-4 w-4" />
                  {isEn ? "Record Answer (max 3m)" : "Ghi âm câu trả lời (tối đa 3 phút)"}
                </Button>
              ) : (
                <Button type="button" size="lg" variant="destructive" onClick={stopRecording}>
                  <Square className="h-4 w-4" />
                  {isEn ? "Stop Recording" : "Dừng ghi âm"} ({formatDuration(elapsedSec)})
                </Button>
              )}

              <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer">
                <Upload className="h-4 w-4 text-emerald-600" />
                {isEn ? "Upload Audio (≤10MB)" : "Tải file ghi âm (≤10MB)"}
                <input
                  type="file"
                  accept="audio/webm,audio/mp4,audio/mpeg,audio/wav,audio/ogg,.m4a,.mp3,.wav,.webm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <span className="text-xs font-medium text-slate-500">
              Safari (MP4) & Chrome (WebM) · {formatDuration(elapsedSec)} / 03:00
            </span>
          </div>

          {audioUrl && (
            <div className="mt-4">
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}
        </div>

        {/* Optional transcript / fallback */}
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
            {isEn
              ? "Optional: Type or paste your spoken answer (if not recording)"
              : "Tùy chọn: Nhập câu trả lời nói (nếu không dùng micro)"}
          </label>
          <textarea
            rows={3}
            value={transcriptHint}
            onChange={(e) => setTranscriptHint(e.target.value)}
            placeholder="Honestly, I really enjoy spending my weekends..."
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        {recordError && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {recordError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            id="speaking-demo-eval-btn"
            disabled={loading}
            onClick={() =>
              submitEvaluation(
                "Honestly, I really enjoy spending my weekends exploring quiet riverside parks or reading in local coffee shops with close friends. It helps me recharge after a demanding week at work."
              )
            }
          >
            {isEn ? "Try with Sample Answer" : "Chấm thử bằng câu trả lời mẫu"}
          </Button>

          <Button
            type="button"
            size="lg"
            disabled={loading || (!audioBlob && transcriptHint.trim().length < 15)}
            onClick={() => submitEvaluation()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEn ? "Transcribing & Scoring..." : "Đang chuyển văn bản & chấm AI..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {isEn ? "Evaluate Speaking" : "Chấm điểm Speaking AI"}
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Evaluation Output */}
      {active && (
        <div id="speaking-eval-result" className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <span className="text-[11px] font-semibold uppercase opacity-85">Band</span>
                  <span className="text-3xl font-bold">{active.overall_band.toFixed(1)}</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {isEn ? "AI Speaking Evaluation" : "Kết quả chấm điểm Speaking AI"}
                    </h2>
                    <Badge variant="amber">
                      {isEn ? "Pronunciation: reference score" : "Phát âm: điểm tham khảo"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {active.evaluation.criteria.pronunciation.referenceNoteVi}
                  </p>
                </div>
              </div>
              <Link
                href="/progress"
                className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                {isEn ? "My Progress →" : "Xem Tiến độ →"}
              </Link>
            </div>

            {/* 4 Criteria */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: "Fluency & Coherence (FC)", data: active.evaluation.criteria.fluencyCoherence },
                { title: "Lexical Resource (LR)", data: active.evaluation.criteria.lexicalResource },
                { title: "Grammatical Range (GRA)", data: active.evaluation.criteria.grammaticalRange },
                {
                  title: isEn
                    ? "Pronunciation (reference score)"
                    : "Pronunciation (điểm tham khảo)",
                  data: active.evaluation.criteria.pronunciation,
                },
              ].map((c) => (
                <div key={c.title} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {c.title}
                    </span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {c.data.band.toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {c.data.feedbackVi}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? "Transcript & Feedback" : "Bản ghi lời nói & Nhận xét"}
              </h3>
              <p className="rounded-xl bg-slate-50 p-4 text-sm italic leading-relaxed text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                “{active.evaluation.transcript}”
              </p>
              <div className="space-y-2 text-xs">
                <p className="font-bold text-emerald-700 dark:text-emerald-400">Điểm mạnh:</p>
                {active.evaluation.strengthsVi.map((s, i) => (
                  <p key={i} className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    {s}
                  </p>
                ))}
                <p className="pt-2 font-bold text-amber-700 dark:text-amber-400">Cần cải thiện:</p>
                {active.evaluation.improvementsVi.map((s, i) => (
                  <p key={i} className="text-slate-700 dark:text-slate-300">
                    • {s}
                  </p>
                ))}
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEn ? "Band 8.0+ Improved Answer" : "Câu trả lời nâng cấp Band 8.0+"}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => speakEnglish(active.evaluation.improvedAnswer)}
                >
                  <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                  {isEn ? "Listen" : "Nghe mẫu"}
                </Button>
              </div>
              <p className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm leading-7 text-slate-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-slate-200">
                {active.evaluation.improvedAnswer}
              </p>
            </Card>
          </div>
        </div>
      )}

      {submissions.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isEn ? "Recent Speaking Attempts" : "Bài nói gần đây"}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {submissions.slice(0, 6).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s)}
                className="rounded-xl border border-slate-200 p-3 text-left text-xs hover:border-emerald-400 dark:border-slate-800 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <Badge>Band {s.overall_band.toFixed(1)}</Badge>
                  <span className="text-slate-500">{s.part.toUpperCase()}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-slate-700 dark:text-slate-300">
                  {s.prompt_text}
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        used={usage.used}
        limit={usage.limit ?? 2}
        period="monthly"
      />
    </div>
  );
}
