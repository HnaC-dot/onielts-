"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaywallModal } from "@/components/paywall-modal";

interface GeneratedSample {
  title: string;
  outlineVi: string[];
  sampleEssay: string;
  wordCount: number;
  keyVocab: { phrase: string; meaningVi: string }[];
  examinerNoteVi: string;
}

export default function WritingGeneratorPage() {
  const locale = useLocale();
  const isEn = locale === "en";

  const [taskType, setTaskType] = useState<"academic_t1" | "general_t1" | "task_2">("task_2");
  const [topic, setTopic] = useState(
    "Artificial intelligence is increasingly used in classrooms and universities. Do the benefits outweigh the drawbacks?"
  );
  const [stance, setStance] = useState("balanced");
  const [sample, setSample] = useState<GeneratedSample | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/writing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType, topic, stance }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data.limitReached) {
        setPaywallOpen(true);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Không thể tạo bài mẫu.");
        return;
      }
      setSample(data.sample);
    } catch {
      setError("Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/writing"
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          {isEn ? "AI Writing Checker" : "Chấm bài Writing AI"}
        </Link>
        <Link href="/writing/generator" className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white">
          {isEn ? "Band 9 Generator" : "Tạo bài mẫu Band 9"}
        </Link>
        <Link
          href="/writing/exercises"
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          {isEn ? "Sentence Exercises" : "Bài tập nâng cấp câu"}
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "Band 9 IELTS Writing Sample Generator" : "Trình tạo bài mẫu Writing Band 9.0"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Generate an original Band 9 model essay with Vietnamese outline, C1/C2 vocabulary list, and examiner notes."
            : "Tạo bài mẫu gốc chuẩn Band 9.0 kèm dàn ý tiếng Việt, bảng cụm từ C1/C2 và nhận xét giám khảo."}
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {isEn ? "Task Type" : "Dạng bài"}
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as typeof taskType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="task_2">Writing Task 2 (Essay)</option>
                <option value="academic_t1">Academic Writing Task 1 (Chart/Process)</option>
                <option value="general_t1">General Training Task 1 (Letter)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {isEn ? "Perspective / Tone" : "Lập trường / Sắc thái"}
              </label>
              <select
                value={stance}
                onChange={(e) => setStance(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="balanced">Cân bằng có lập trường rõ (Balanced)</option>
                <option value="strongly_agree">Đồng tình mạnh mẽ (Strongly Agree)</option>
                <option value="critical">Phản biện chuyên sâu (Critical)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isEn ? "Writing Topic / Prompt" : "Nhập đề bài Writing"}
            </label>
            <textarea
              rows={3}
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <Button type="submit" size="lg" id="generate-band9-btn" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isEn ? "Generate Band 9 Sample" : "Tạo bài mẫu Band 9.0"}
          </Button>
        </form>
      </Card>

      {sample && (
        <div className="space-y-5">
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{sample.title}</h2>
                <Badge>{sample.wordCount} words</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(sample.sampleEssay);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    setError(
                      isEn
                        ? "Could not access clipboard."
                        : "Không thể truy cập clipboard. Vui lòng sao chép thủ công."
                    );
                  }
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Đã sao chép" : "Sao chép"}
              </Button>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase text-slate-500">
                {isEn ? "Essay Outline" : "Dàn ý triển khai"}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700 dark:text-slate-300">
                {sample.outlineVi.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>

            <div className="whitespace-pre-line rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 text-sm leading-7 text-slate-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-slate-100">
              {sample.sampleEssay}
            </div>

            <div className="rounded-xl bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
              <strong>{isEn ? "Examiner Note: " : "Ghi chú từ giám khảo: "}</strong>
              {sample.examinerNoteVi}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isEn ? "Band 8–9 Vocabulary & Collocations" : "Từ vựng & Collocations ăn điểm (bôi đen để lưu Flashcard)"}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {sample.keyVocab.map((v, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
                >
                  <p className="font-bold text-emerald-700 dark:text-emerald-400">{v.phrase}</p>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-400">{v.meaningVi}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} limit={3} used={3} period="daily" />
    </div>
  );
}
