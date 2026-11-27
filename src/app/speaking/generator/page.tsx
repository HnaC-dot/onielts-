"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Loader2, Sparkles, Volume2 } from "lucide-react";
import { speakEnglish } from "@/lib/audio-recorder";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaywallModal } from "@/components/paywall-modal";

interface SpeakingGenResult {
  partTitle: string;
  cueCardBullets?: string[];
  items: {
    question: string;
    band8Answer: string;
    vocabTips: string[];
    strategyVi: string;
  }[];
}

export default function SpeakingGeneratorPage() {
  const locale = useLocale();
  const isEn = locale === "en";

  const [part, setPart] = useState<"part_1" | "part_2" | "part_3">("part_2");
  const [topic, setTopic] = useState("Learning a practical new skill");
  const [result, setResult] = useState<SpeakingGenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/speaking/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part, topic }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data.limitReached) {
        setPaywallOpen(true);
        return;
      }
      if (!res.ok) {
        setError(
          data.error ||
            (isEn ? "Speaking sample generator is temporarily unavailable." : "Không thể tạo bộ câu hỏi mẫu lúc này.")
        );
        return;
      }
      setResult(data.result);
    } catch {
      setError(isEn ? "Network connection error." : "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href="/speaking" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {isEn ? "AI Speaking Checker" : "Chấm bài Speaking AI"}
        </Link>
        <Link href="/speaking/generator" className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white">
          {isEn ? "Parts 1–3 Sample Generator" : "Tạo câu trả lời mẫu Parts 1–3"}
        </Link>
        <Link href="/conversations" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {isEn ? "AI Role-play Conversations" : "Hội thoại AI đóng vai"}
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "AI Speaking Sample & Cue Card Generator" : "Trình tạo đề & câu trả lời mẫu Speaking Parts 1–3"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Create original Part 1 Q&As, Part 2 Cue Cards, and Part 3 discussions with Band 8.5 answers and audio playback."
            : "Tạo câu hỏi Part 1, thẻ Cue Card Part 2 và câu hỏi thảo luận Part 3 chuẩn Band 8.5 kèm giọng đọc mẫu."}
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleGenerate} className="grid gap-4 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-4">
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Speaking Part
            </label>
            <select
              value={part}
              onChange={(e) => setPart(e.target.value as typeof part)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="part_1">Part 1 — Everyday Q&A</option>
              <option value="part_2">Part 2 — Cue Card (2 mins)</option>
              <option value="part_3">Part 3 — Abstract Discussion</option>
            </select>
          </div>
          <div className="sm:col-span-5">
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isEn ? "Topic" : "Chủ đề muốn luyện"}
            </label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" size="lg" id="generate-speaking-btn" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isEn ? "Generate" : "Tạo mẫu"}
            </Button>
          </div>
        </form>
      </Card>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{result.partTitle}</h2>

          {result.cueCardBullets && result.cueCardBullets.length > 0 && (
            <Card className="border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                Cue Card — You should say:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">
                {result.cueCardBullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </Card>
          )}

          {result.items.map((item, idx) => (
            <Card key={idx} className="p-6 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Q{idx + 1}: {item.question}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => speakEnglish(item.band8Answer)}
                >
                  <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                  {isEn ? "Listen" : "Nghe đọc mẫu"}
                </Button>
              </div>

              <p className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {item.band8Answer}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {item.vocabTips.map((v) => (
                  <Badge key={v}>{v}</Badge>
                ))}
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                <strong>Chiến thuật: </strong>
                {item.strategyVi}
              </p>
            </Card>
          ))}
        </div>
      )}

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} limit={3} used={3} period="daily" />
    </div>
  );
}
