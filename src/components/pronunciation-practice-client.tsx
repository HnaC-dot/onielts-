"use client";

import React, { useRef, useState } from "react";
import { useLocale } from "next-intl";
import { CheckCircle2, Loader2, Mic, Sparkles, Square, Volume2 } from "lucide-react";
import type { PronunciationSound } from "@/lib/types";
import {
  blobToBase64,
  normalizeAudioMimeForGemini,
  pickSupportedAudioMimeType,
  speakEnglish,
} from "@/lib/audio-recorder";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface PronResult {
  referenceScore: number;
  estimatedBand: number;
  labelVi: string;
  feedbackVi: string;
  mouthAdjustmentVi: string;
}

export function PronunciationPracticeClient({ sound }: { sound: PronunciationSound }) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PronResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleRecord = async () => {
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
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };
      recorderRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  const evaluatePronunciation = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      let audioBase64: string | undefined;
      let audioMimeType: string | undefined;
      if (audioBlob) {
        audioBase64 = await blobToBase64(audioBlob);
        audioMimeType = normalizeAudioMimeForGemini(audioBlob.type);
      }
      const res = await fetch("/api/pronunciation/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: sound.symbol,
          targetSentence: sound.practiceSentence,
          audioBase64,
          audioMimeType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(
          data.error ||
            (isEn ? "Pronunciation AI is temporarily unavailable." : "Không thể chấm phát âm AI lúc này.")
        );
        return;
      }
      setResult(data.result);
    } catch {
      setErrorMsg(isEn ? "Network connection error." : "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Example words with instant audio */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {isEn ? "Example Words (tap to listen)" : "Từ ví dụ tiêu biểu (nhấn để nghe phát âm chuẩn)"}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sound.examples.map((ex) => (
            <button
              key={ex.word}
              type="button"
              onClick={() => speakEnglish(ex.word, "en-GB", 0.9)}
              className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-emerald-950/30 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {ex.word}
                </span>
                <Volume2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-1 font-mono text-xs text-emerald-700 dark:text-emerald-400">
                {ex.ipa}
              </p>
              <p className="mt-1 text-xs text-slate-500">{ex.meaning_vi}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Practice Sentence + Record + AI Reference Feedback */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {isEn ? "Practice Sentence & AI Feedback" : "Luyện đọc câu & Chấm phát âm AI"}
          </h2>
          <Badge variant="amber">
            {isEn ? "Reference Score Estimate" : "điểm tham khảo"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            “{sound.practiceSentence}”
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => speakEnglish(sound.practiceSentence, "en-GB", 0.92)}
          >
            <Volume2 className="h-4 w-4 text-emerald-600" />
            {isEn ? "Listen Model" : "Nghe câu mẫu"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant={isRecording ? "destructive" : "default"}
            onClick={toggleRecord}
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isRecording
              ? isEn
                ? "Stop Recording"
                : "Dừng ghi âm"
              : isEn
              ? "Record Your Voice"
              : "Ghi âm giọng đọc"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={evaluatePronunciation}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isEn ? "Get AI Pronunciation Feedback" : "Chấm phát âm AI (điểm tham khảo)"}
          </Button>
        </div>

        {audioUrl && <audio controls src={audioUrl} className="w-full" />}

        {errorMsg && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {errorMsg}
          </p>
        )}

        {result && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-2 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-lg font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                {result.referenceScore}/100 (Band ~{result.estimatedBand.toFixed(1)})
              </span>
              <Badge variant="amber">{result.labelVi}</Badge>
            </div>
            <p className="text-sm text-slate-800 dark:text-slate-200">{result.feedbackVi}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <strong>Điều chỉnh khẩu hình:</strong> {result.mouthAdjustmentVi}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
