"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import type { WritingSubmission } from "@/lib/types";
import type { UsageCheckResult } from "@/lib/usage-limits";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { PaywallModal } from "./paywall-modal";

const SAMPLE_PROMPTS = {
  academic_t1: {
    prompt:
      "The bar chart compares the percentage of electricity generated from solar, wind, hydro, and fossil fuels in Vietnam between 2015 and 2025. Summarize the information by selecting and reporting the main features.",
    essay:
      "The bar chart shows how much electricity came from four energy sources in Vietnam from 2015 to 2025. Overall, fossil fuels stayed the biggest source, while solar and wind energy went up a lot during this ten-year period.\n\nIn 2015, fossil fuels produced around 65% of total power, and hydro power made up about 30%. Solar and wind were very small, each under 3%. However, after 2020, solar power increased very quickly to reach nearly 18% in 2025 because many farms were built.\n\nAt the same time, wind energy also climbed steadily to 9%. In contrast, the share of coal and gas dropped from 65% down to roughly 48%, while hydro remained stable near 25%. This shows Vietnam is slowly moving towards cleaner power.",
  },
  general_t1: {
    prompt:
      "You recently attended a community workshop at your local cultural centre and found it very helpful, though one practical aspect could be improved. Write a letter to the organizer.",
    essay:
      "Dear Cultural Centre Coordinator,\n\nI am writing to thank your team for organizing the weekend digital literacy workshop in our neighborhood. The speakers explained every topic clearly, and I learned practical tools that immediately help my daily office work.\n\nHowever, I would like to suggest one small improvement for future sessions. Because the room became quite crowded after 9:30 a.m., several participants at the back had difficulty reading the projection screen. Moving the seminar to the larger upstairs hall or sharing slides beforehand would make the experience even better.\n\nThank you once again for supporting local residents, and I look forward to attending your next event.\n\nYours sincerely,\nNguyen Minh Anh",
  },
  task_2: {
    prompt:
      "Many people believe that artificial intelligence tools in schools help students learn faster, while others worry they weaken independent thinking. Discuss both views and give your own opinion.",
    essay:
      "Artificial intelligence tools are becoming very common in schools today. While some people think these tools make learning faster and easier, others worry that students might stop thinking for themselves. In my opinion, AI can be a very good study partner if teachers guide students carefully.\n\nOn the one hand, AI platforms give students quick feedback on grammar, vocabulary, and math problems. In big classes with forty students, one teacher cannot check every essay on the same day. Therefore, using AI helps learners fix mistakes quickly and save a lot of time.\n\nOn the other hand, relying too much on software is risky. If young learners simply copy answers from a chatbot, they will not develop strong writing or critical thinking skills. That is why schools should teach students how to question AI answers and check facts independently.\n\nIn conclusion, although unguided AI use can harm independent thinking, combining AI feedback with active classroom discussion offers the best results for modern education.",
  },
};

interface WritingCheckerClientProps {
  initialUsage: UsageCheckResult;
  initialSubmissions: WritingSubmission[];
}

export function WritingCheckerClient({
  initialUsage,
  initialSubmissions,
}: WritingCheckerClientProps) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [taskType, setTaskType] = useState<"academic_t1" | "general_t1" | "task_2">("task_2");
  const [promptText, setPromptText] = useState(SAMPLE_PROMPTS.task_2.prompt);
  const [essayText, setEssayText] = useState("");
  const [chartPreview, setChartPreview] = useState<string | null>(null);
  const [chartBase64, setChartBase64] = useState<string | undefined>(undefined);
  const [chartMime, setChartMime] = useState<"image/png" | "image/jpeg" | "image/webp" | undefined>(undefined);
  const [chartName, setChartName] = useState<string | undefined>(undefined);

  const [usage, setUsage] = useState<UsageCheckResult>(initialUsage);
  const [submissions, setSubmissions] = useState<WritingSubmission[]>(initialSubmissions);
  const [activeSubmission, setActiveSubmission] = useState<WritingSubmission | null>(
    initialSubmissions[0] ?? null
  );
  const [selectedErrorIdx, setSelectedErrorIdx] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [copiedRewrite, setCopiedRewrite] = useState(false);

  const wordCount = useMemo(
    () => essayText.trim().split(/\s+/).filter(Boolean).length,
    [essayText]
  );
  const minWords = taskType === "task_2" ? 250 : 150;

  const handleTaskChange = (next: "academic_t1" | "general_t1" | "task_2") => {
    setTaskType(next);
    setPromptText(SAMPLE_PROMPTS[next].prompt);
  };

  const handleLoadSample = () => {
    setPromptText(SAMPLE_PROMPTS[taskType].prompt);
    setEssayText(SAMPLE_PROMPTS[taskType].essay);
  };

  const handleChartUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Ảnh biểu đồ tối đa 5MB.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Chỉ hỗ trợ ảnh PNG, JPG hoặc WebP.");
      return;
    }
    setError("");
    setChartName(file.name);
    setChartMime(file.type as "image/png" | "image/jpeg" | "image/webp");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setChartPreview(dataUrl);
      const base64Part = dataUrl.split(",")[1];
      setChartBase64(base64Part);
    };
    reader.readAsDataURL(file);
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/writing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType,
          promptText,
          essayText,
          chartImageBase64: taskType === "academic_t1" ? chartBase64 : undefined,
          chartImageMime: taskType === "academic_t1" ? chartMime : undefined,
          chartImageName: taskType === "academic_t1" ? chartName : undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 402 || data.limitReached) {
        if (data.usage) setUsage(data.usage);
        setPaywallOpen(true);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Không thể chấm bài.");
        return;
      }
      const created: WritingSubmission = data.submission;
      setActiveSubmission(created);
      setSubmissions((prev) => [created, ...prev]);
      setSelectedErrorIdx(0);
      if (data.usage) setUsage(data.usage);
    } catch {
      setError("Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePrivacy = async (sub: WritingSubmission) => {
    const nextPublic = !sub.is_public;
    const res = await fetch("/api/writing/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sub.id, is_public: nextPublic }),
    });
    if (res.ok) {
      const updated = { ...sub, is_public: nextPublic };
      setActiveSubmission(updated);
      setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
    }
  };

  // Render inline essay with highlighted error spans
  const renderHighlightedEssay = (sub: WritingSubmission) => {
    const errors = sub.evaluation.inlineErrors;
    if (!errors.length) return <p className="whitespace-pre-line text-sm">{sub.essay_text}</p>;

    let segments: Array<{ text: string; errorIndex: number | null }> = [
      { text: sub.essay_text, errorIndex: null },
    ];

    errors.forEach((err, idx) => {
      if (!err.original || err.original.length < 2) return;
      const nextSegments: Array<{ text: string; errorIndex: number | null }> = [];
      let matchedOnce = false;
      for (const seg of segments) {
        if (seg.errorIndex !== null || matchedOnce) {
          nextSegments.push(seg);
          continue;
        }
        const pos = seg.text.toLowerCase().indexOf(err.original.toLowerCase());
        if (pos === -1) {
          nextSegments.push(seg);
          continue;
        }
        matchedOnce = true;
        if (pos > 0) nextSegments.push({ text: seg.text.slice(0, pos), errorIndex: null });
        nextSegments.push({
          text: seg.text.slice(pos, pos + err.original.length),
          errorIndex: idx,
        });
        if (pos + err.original.length < seg.text.length) {
          nextSegments.push({
            text: seg.text.slice(pos + err.original.length),
            errorIndex: null,
          });
        }
      }
      segments = nextSegments;
    });

    return (
      <div className="whitespace-pre-line text-sm leading-7 text-slate-800 dark:text-slate-200">
        {segments.map((seg, i) =>
          seg.errorIndex === null ? (
            <React.Fragment key={i}>{seg.text}</React.Fragment>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedErrorIdx(seg.errorIndex!)}
              className={`rounded px-1 py-0.5 text-left transition cursor-pointer ${
                selectedErrorIdx === seg.errorIndex
                  ? "bg-amber-200 text-amber-950 ring-2 ring-amber-500 dark:bg-amber-900 dark:text-amber-100"
                  : "bg-red-100/90 text-red-900 underline decoration-red-400 decoration-wavy hover:bg-red-200 dark:bg-red-950/70 dark:text-red-200"
              }`}
            >
              {seg.text}
            </button>
          )
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Sub-navigation + quota badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link href="/writing" className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white">
            {isEn ? "AI Writing Checker" : "Chấm bài Writing AI"}
          </Link>
          <Link
            href="/writing/generator"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            {isEn ? "Band 9 Generator" : "Tạo bài mẫu Band 9"}
          </Link>
          <Link
            href="/writing/exercises"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            {isEn ? "Sentence Exercises" : "Bài tập nâng cấp câu"}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {usage.isPremium ? (
            <Badge>{isEn ? "Premium · Unlimited" : "Premium · Không giới hạn"}</Badge>
          ) : (
            <Badge variant={usage.remaining === 0 ? "amber" : "secondary"}>
              {isEn
                ? `Free: ${usage.remaining}/${usage.limit} checks left this month`
                : `Free: còn ${usage.remaining}/${usage.limit} lượt chấm tháng này`}
            </Badge>
          )}
        </div>
      </div>

      {/* Input Card */}
      <Card className="p-6">
        <form onSubmit={handleEvaluate} className="space-y-5">
          {/* Task type selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "academic_t1", label: "Academic Task 1 (Chart)" },
                { id: "general_t1", label: "General Task 1 (Letter)" },
                { id: "task_2", label: "Task 2 (Essay)" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTaskChange(t.id as typeof taskType)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    taskType === t.id
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              id="load-sample-essay-btn"
              onClick={handleLoadSample}
              className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
            >
              {isEn ? "Load sample essay" : "Nạp bài mẫu để chấm thử"}
            </button>
          </div>

          {/* Academic Task 1 Chart Image Upload */}
          {taskType === "academic_t1" && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <ImagePlus className="h-5 w-5 text-emerald-600" />
                  <span>
                    {chartName
                      ? `Đã chọn ảnh biểu đồ: ${chartName}`
                      : isEn
                      ? "Upload chart/diagram image (PNG, JPG, WebP · max 5MB)"
                      : "Tải lên ảnh biểu đồ / bản đồ Task 1 (PNG, JPG, WebP · tối đa 5MB)"}
                  </span>
                </div>
                <label className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer">
                  {isEn ? "Choose image" : "Chọn ảnh biểu đồ"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleChartUpload}
                    className="hidden"
                  />
                </label>
              </div>
              {chartPreview && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={chartPreview}
                  alt="Uploaded Task 1 chart preview"
                  className="mt-3 max-h-52 rounded-lg border border-slate-200 object-contain"
                />
              )}
            </div>
          )}

          {/* Prompt */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isEn ? "Exam Prompt / Question" : "Đề bài Writing"}
            </label>
            <textarea
              rows={2}
              required
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          {/* Essay */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isEn ? "Your Essay" : "Bài viết của bạn"}
              </label>
              <span
                className={`text-xs font-semibold ${
                  wordCount >= minWords ? "text-emerald-600" : "text-slate-500"
                }`}
              >
                {wordCount} / {minWords}+ {isEn ? "words" : "từ khuyến nghị"}
              </span>
            </div>
            <textarea
              rows={9}
              required
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              placeholder={
                isEn
                  ? "Write or paste your IELTS essay here..."
                  : "Nhập hoặc dán bài viết tiếng Anh của bạn tại đây..."
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              {isEn
                ? "Your essays are saved PRIVATE by default."
                : "Bài viết của bạn được lưu ở chế độ RIÊNG TƯ theo mặc định."}
            </p>
            <Button
              type="submit"
              size="lg"
              id="submit-writing-btn"
              disabled={loading || !essayText.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEn ? "Evaluating 4 criteria..." : "AI đang chấm 4 tiêu chí..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {isEn ? "Score Essay with AI" : "Chấm điểm Writing bằng AI"}
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Evaluation Results */}
      {activeSubmission && (
        <div id="writing-eval-result" className="space-y-6">
          {/* Score overview + Privacy toggle */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                  <span className="text-[11px] font-semibold uppercase opacity-85">Band</span>
                  <span className="text-3xl font-bold">
                    {activeSubmission.overall_band.toFixed(1)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {isEn ? "AI Writing Evaluation Report" : "Báo cáo chấm điểm Writing AI"}
                    </h2>
                    <Badge variant="secondary">{activeSubmission.word_count} words</Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                    {activeSubmission.evaluation.summaryVi}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleTogglePrivacy(activeSubmission)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {activeSubmission.is_public ? (
                  <>
                    <Eye className="h-3.5 w-3.5 text-emerald-600" />
                    {isEn ? "Public (Opt-in)" : "Đang công khai"}
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                    {isEn ? "Private (Default)" : "Riêng tư (Mặc định)"}
                  </>
                )}
              </button>
            </div>

            {/* 4 Criteria */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  key: "taskResponse",
                  title: taskType === "task_2" ? "Task Response (TR)" : "Task Achievement (TA)",
                  data: activeSubmission.evaluation.criteria.taskResponse,
                },
                {
                  key: "coherenceCohesion",
                  title: "Coherence & Cohesion (CC)",
                  data: activeSubmission.evaluation.criteria.coherenceCohesion,
                },
                {
                  key: "lexicalResource",
                  title: "Lexical Resource (LR)",
                  data: activeSubmission.evaluation.criteria.lexicalResource,
                },
                {
                  key: "grammaticalRange",
                  title: "Grammatical Range (GRA)",
                  data: activeSubmission.evaluation.criteria.grammaticalRange,
                },
              ].map((c) => (
                <div
                  key={c.key}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {c.title}
                    </span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {c.data.band.toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {isEn ? c.data.feedbackEn : c.data.feedbackVi}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Inline Error Highlights + Inspector */}
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="p-6 lg:col-span-7">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn
                  ? "Inline Error Highlights (click highlighted spans)"
                  : "Sửa lỗi trực tiếp trên bài viết (nhấn vào đoạn tô màu)"}
              </h3>
              <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
                {renderHighlightedEssay(activeSubmission)}
              </div>
            </Card>

            <Card className="p-6 lg:col-span-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? "Corrections & Explanations" : "Chi tiết sửa lỗi & giải thích"}
              </h3>
              <div className="space-y-3">
                {activeSubmission.evaluation.inlineErrors.map((err, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedErrorIdx(idx)}
                    className={`w-full rounded-xl border p-3.5 text-left text-xs transition cursor-pointer ${
                      selectedErrorIdx === idx
                        ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{err.category}</Badge>
                    </div>
                    <p className="mt-2 text-red-600 line-through dark:text-red-400">
                      {err.original}
                    </p>
                    <p className="mt-1 flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      {err.correction}
                    </p>
                    <p className="mt-1.5 text-slate-600 dark:text-slate-400">
                      {err.explanationVi}
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Vocabulary Upgrades + Band 8+ Rewrite */}
          <div className="grid gap-6 lg:grid-cols-12">
            <Card className="p-6 lg:col-span-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? "Vocabulary Upgrades" : "Gợi ý nâng cấp từ vựng"}
              </h3>
              {activeSubmission.evaluation.vocabUpgrades.map((v, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 p-3.5 text-xs dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                    <span className="text-slate-500">{v.basic}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">{v.upgraded}</span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">{v.noteVi}</p>
                </div>
              ))}
            </Card>

            <Card className="p-6 lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEn ? "Band 8+ Polished Rewrite" : "Bài viết lại chuẩn Band 8+"}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      activeSubmission.evaluation.band8Rewrite
                    );
                    setCopiedRewrite(true);
                    setTimeout(() => setCopiedRewrite(false), 1500);
                  }}
                >
                  {copiedRewrite ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedRewrite ? "Đã sao chép" : "Sao chép"}
                </Button>
              </div>
              <div className="whitespace-pre-line rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm leading-relaxed text-slate-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-slate-200">
                {activeSubmission.evaluation.band8Rewrite}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Saved submissions list */}
      {submissions.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isEn ? "Your Recent Writing Submissions" : "Bài viết gần đây của bạn"}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {submissions.slice(0, 6).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSubmission(s)}
                className="rounded-xl border border-slate-200 p-3.5 text-left hover:border-emerald-400 dark:border-slate-800 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <Badge>Band {s.overall_band.toFixed(1)}</Badge>
                  <span className="text-[11px] text-slate-500">
                    {s.is_public ? "Public" : "Private"} · {s.word_count}w
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
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
