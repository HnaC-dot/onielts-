"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { GeneralAiToolConfig } from "@/lib/ai-tools-config";
import type { GeneralToolOutput } from "@/lib/ai";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface HistoryEntry {
  id: string;
  input: string;
  output: GeneralToolOutput;
  createdAt: string;
}

interface AiToolWorkbenchProps {
  tool: GeneralAiToolConfig;
  allTools: { slug: string; titleVi: string; titleEn: string }[];
}

export function AiToolWorkbench({ tool, allTools }: AiToolWorkbenchProps) {
  const locale = useLocale();
  const isEn = locale === "en";
  const storageKey = `onielts_tool_history_${tool.slug}`;

  const [input, setInput] = useState("");
  const [options, setOptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(tool.options.map((o) => [o.key, o.defaultValue]))
  );
  const [output, setOutput] = useState<GeneralToolOutput | null>(null);
  const [meta, setMeta] = useState<{ model?: string; cached?: boolean; mocked?: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          setHistory(JSON.parse(raw) as HistoryEntry[]);
        } else {
          setHistory([]);
        }
      } catch {
        setHistory([]);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [storageKey]);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tools/${tool.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim(), options }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Không thể xử lý yêu cầu.");
        return;
      }
      const result: GeneralToolOutput = data.output;
      setOutput(result);
      setMeta({ model: data.model, cached: data.cached, mocked: data.mocked });

      const entry: HistoryEntry = {
        id: String(Date.now()),
        input: input.trim(),
        output: result,
        createdAt: new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      const updated = [entry, ...history].slice(0, 8);
      setHistory(updated);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // ignore storage quota errors
      }
    } catch {
      setError("Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output.resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(
        isEn
          ? "Could not access clipboard. Please select and copy manually."
          : "Không thể truy cập clipboard. Vui lòng bôi đen và sao chép thủ công."
      );
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-8">
      {/* Tool switcher strip */}
      <div className="flex flex-wrap gap-2">
        {allTools.map((t) => (
          <Link
            key={t.slug}
            href={`/tools/${t.slug}`}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              t.slug === tool.slug
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {isEn ? t.titleEn : t.titleVi}
          </Link>
        ))}
        <Link
          href="/tools/text-to-speech"
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          Text-to-Speech
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? tool.titleEn : tool.titleVi}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn ? tool.descriptionEn : tool.descriptionVi}
        </p>
      </div>

      {/* Main Split Workbench */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input side */}
        <Card className="p-6">
          <form onSubmit={handleRun} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-bold text-slate-900 dark:text-white">
                {isEn ? "Your Text" : "Văn bản đầu vào"}
              </label>
              <button
                type="button"
                onClick={() => setInput(tool.sampleInput)}
                className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
              >
                {isEn ? "Load sample text" : "Dùng câu mẫu IELTS"}
              </button>
            </div>

            <textarea
              rows={7}
              value={input}
              maxLength={tool.maxChars}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isEn ? tool.placeholderEn : tool.placeholderVi}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {input.length} / {tool.maxChars} {isEn ? "chars" : "ký tự"}
              </span>
              {input && (
                <button
                  type="button"
                  onClick={() => setInput("")}
                  className="hover:text-red-600 cursor-pointer"
                >
                  {isEn ? "Clear" : "Xóa"}
                </button>
              )}
            </div>

            {/* Dynamic Tool Options */}
            <div className="grid gap-3 sm:grid-cols-2">
              {tool.options.map((opt) => (
                <div key={opt.key}>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isEn ? opt.labelEn : opt.labelVi}
                  </label>
                  <select
                    value={options[opt.key] ?? opt.defaultValue}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, [opt.key]: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
                  >
                    {opt.choices.map((c) => (
                      <option key={c.value} value={c.value}>
                        {isEn ? c.labelEn : c.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              id="ai-tool-submit-btn"
              disabled={loading || !input.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEn ? "Processing with AI..." : "AI đang phân tích..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {isEn ? "Run AI Tool" : "Chạy công cụ AI"}
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Output side */}
        <Card className="p-6 flex flex-col justify-between">
          {!output ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center text-slate-500">
              <Sparkles className="h-10 w-10 text-emerald-600/40" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                {isEn
                  ? "Your AI result and key language upgrades will appear here."
                  : "Kết quả xử lý AI và bảng phân tích điểm nâng cấp sẽ hiển thị tại đây."}
              </p>
              <p className="mt-1 text-xs">
                {isEn
                  ? "Tip: Highlight any word in the output to save it as a Flashcard!"
                  : "Mẹo: Bôi đen từ hay trong kết quả để lưu ngay vào bộ Flashcard!"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {isEn ? "AI Result" : "Kết quả AI"}
                  </span>
                  {meta.cached && <Badge variant="secondary">Cached</Badge>}
                  {meta.mocked && <Badge variant="amber">Demo AI</Badge>}
                </div>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      {isEn ? "Copied" : "Đã sao chép"}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {isEn ? "Copy" : "Sao chép"}
                    </>
                  )}
                </Button>
              </div>

              <div className="whitespace-pre-line rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm leading-relaxed text-slate-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-slate-100">
                {output.resultText}
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-white">
                  {isEn ? "Coach Note: " : "Nhận xét chi tiết: "}
                </span>
                {output.notesVi}
              </div>

              {output.highlights.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {isEn ? "Key Upgrades & Notes" : "Điểm thay đổi nổi bật"}
                  </p>
                  <div className="space-y-2">
                    {output.highlights.map((h, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800"
                      >
                        <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                          <span className="text-slate-500 line-through">{h.before}</span>
                          <ArrowRight className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-700 dark:text-emerald-400">{h.after}</span>
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-400">{h.reasonVi}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Recent History */}
      {history.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Clock className="h-4 w-4 text-emerald-600" />
              {isEn ? "Recent History (saved in browser)" : "Lịch sử gần đây"}
            </h2>
            <button
              type="button"
              onClick={clearHistory}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isEn ? "Clear history" : "Xóa lịch sử"}
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setInput(item.input);
                  setOutput(item.output);
                }}
                className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-emerald-400 dark:border-slate-800 cursor-pointer"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{item.createdAt}</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {isEn ? "Restore" : "Xem lại"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-800 dark:text-slate-200">
                  {item.input}
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
