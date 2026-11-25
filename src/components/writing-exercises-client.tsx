"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { CheckCircle2, Eye, Lightbulb, Loader2, Sparkles } from "lucide-react";
import type { WritingExercise } from "@/lib/types";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface CheckFeedback {
  estimatedBand: number;
  feedbackVi: string;
  strengthsVi: string[];
  nextStepVi: string;
}

export function WritingExercisesClient({
  exercises,
  initialSlug,
}: {
  exercises: WritingExercise[];
  initialSlug?: string;
}) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [activeSlug, setActiveSlug] = useState(
    exercises.find((e) => e.slug === initialSlug)?.slug ?? exercises[0]?.slug ?? ""
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hintsShown, setHintsShown] = useState<Record<string, boolean>>({});
  const [modelsShown, setModelsShown] = useState<Record<string, boolean>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, CheckFeedback>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const active = exercises.find((e) => e.slug === activeSlug) ?? exercises[0];
  if (!active) return null;

  const handleCheck = async (sentenceId: string, weakSentence: string, band8Model: string) => {
    const userRewrite = (answers[sentenceId] ?? "").trim();
    if (!userRewrite) return;
    setLoadingId(sentenceId);
    try {
      const res = await fetch("/api/writing/exercise-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weakSentence, userRewrite, band8Model }),
      });
      if (res.ok) {
        const data = await res.json();
        setFeedbacks((prev) => ({ ...prev, [sentenceId]: data.result }));
        setModelsShown((prev) => ({ ...prev, [sentenceId]: true }));
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/writing"
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          {isEn ? "AI Writing Checker" : "Chấm bài Writing AI"}
        </Link>
        <Link
          href="/writing/generator"
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          {isEn ? "Band 9 Generator" : "Tạo bài mẫu Band 9"}
        </Link>
        <Link href="/writing/exercises" className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white">
          {isEn ? "Sentence Exercises" : "Bài tập nâng cấp câu"}
        </Link>
      </div>

      {/* Topic Selector */}
      <div className="flex flex-wrap gap-2">
        {exercises.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => setActiveSlug(ex.slug)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              ex.slug === active.slug
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {isEn ? ex.title_en : ex.title_vi}
          </button>
        ))}
      </div>

      {/* Sentence cards */}
      <div className="space-y-5">
        {active.sentences.map((s, idx) => {
          const fb = feedbacks[s.id];
          return (
            <Card key={s.id} className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge>
                  {isEn ? `Sentence ${idx + 1}` : `Câu ${idx + 1}`} · {active.topic}
                </Badge>
                <span className="text-xs text-slate-500">{active.targetSkill}</span>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
                  {isEn ? "Band 5.5 Draft Sentence:" : "Câu gốc mức Band 5.5:"}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  “{s.weakSentence}”
                </p>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  <strong>{isEn ? "Issue: " : "Điểm yếu: "}</strong>
                  {s.issue_vi}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isEn ? "Your Upgraded Sentence (aim for Band 7.5–8.5)" : "Viết lại câu nâng cấp của bạn"}
                </label>
                <textarea
                  rows={2}
                  value={answers[s.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [s.id]: e.target.value }))
                  }
                  placeholder="Write your upgraded academic sentence here..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={loadingId === s.id || !(answers[s.id] ?? "").trim()}
                  onClick={() => handleCheck(s.id, s.weakSentence, s.band8Model)}
                >
                  {loadingId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isEn ? "Check with AI" : "Chấm câu với AI"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setHintsShown((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                  }
                >
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  {isEn ? "Hint" : "Gợi ý"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setModelsShown((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                  }
                >
                  <Eye className="h-3.5 w-3.5" />
                  {isEn ? "Band 8 Model" : "Xem câu mẫu Band 8"}
                </Button>
              </div>

              {hintsShown[s.id] && (
                <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  💡 {s.hint_vi}
                </p>
              )}

              {fb && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs space-y-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Ước lượng: Band {fb.estimatedBand.toFixed(1)}
                  </div>
                  <p className="text-slate-700 dark:text-slate-200">{fb.feedbackVi}</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <strong>Gợi ý tiếp theo:</strong> {fb.nextStepVi}
                  </p>
                </div>
              )}

              {modelsShown[s.id] && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
                  <p className="font-bold text-emerald-700 dark:text-emerald-400">
                    {isEn ? "Band 8.0+ Model Sentence:" : "Câu mẫu Band 8.0+:"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                    {s.band8Model}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.keyUpgrades.map((kw) => (
                      <Badge key={kw} variant="secondary">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
