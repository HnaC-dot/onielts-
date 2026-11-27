"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  LayoutTemplate,
  Link2,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  BLOG_TEMPLATES,
  rankInternalLinkSuggestions,
  type BlogArticleTemplate,
  type BlogQualityConfig,
  type InternalLinkCandidate,
  type QualityGateReport,
} from "@/lib/content-production-shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BlogTemplatePickerProps {
  onApplyTemplate: (template: BlogArticleTemplate) => void;
}

export function BlogTemplatePicker({ onApplyTemplate }: BlogTemplatePickerProps) {
  return (
    <Card className="p-4 space-y-3 border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-xs font-bold text-slate-900 dark:text-white">
            Mẫu bài viết IELTS chuẩn SEO (có sẵn khung H2/H3, FAQ &amp; Box Bài tập luyện thêm)
          </h2>
        </div>
        <span className="text-[11px] text-slate-500">Bấm chọn để chèn nhanh khung bài</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {BLOG_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onApplyTemplate(tpl)}
            className="flex flex-col items-start gap-1 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-500 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-600 cursor-pointer"
          >
            <div className="flex w-full items-center justify-between gap-1">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {tpl.nameVi}
              </span>
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            </div>
            <p className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {tpl.shortDescVi}
            </p>
          </button>
        ))}
      </div>
    </Card>
  );
}

interface BlogQualityGatePanelProps {
  report: QualityGateReport;
  config: BlogQualityConfig;
  canEditConfig: boolean;
  onSaveConfig: (next: BlogQualityConfig) => Promise<void>;
}

export function BlogQualityGatePanel({
  report,
  config,
  canEditConfig,
  onSaveConfig,
}: BlogQualityGatePanelProps) {
  const [editing, setEditing] = useState(false);
  const [minWordsInput, setMinWordsInput] = useState(String(config.minWordCount));
  const [minLinksInput, setMinLinksInput] = useState(String(config.minInternalLinks));
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveConfig({
        minWordCount: Math.max(100, Number(minWordsInput) || 800),
        minInternalLinks: Math.max(1, Number(minLinksInput) || 2),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck
            className={`h-4 w-4 ${
              report.passed ? "text-emerald-600" : "text-amber-500"
            }`}
          />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Kiểm tra chất lượng trước khi đăng
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={report.passed ? "default" : "amber"}>
            {report.score}/{report.maxScore}
          </Badge>
          {canEditConfig && (
            <button
              type="button"
              onClick={() => {
                setMinWordsInput(String(config.minWordCount));
                setMinLinksInput(String(config.minInternalLinks));
                setEditing((v) => !v);
              }}
              title="Cấu hình ngưỡng từ tối thiểu"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {editing && canEditConfig && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
            Cấu hình tiêu chuẩn xuất bản (áp dụng toàn hệ thống):
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600 dark:text-slate-400">
                Số từ tối thiểu
              </label>
              <input
                type="number"
                min={100}
                max={5000}
                value={minWordsInput}
                onChange={(e) => setMinWordsInput(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600 dark:text-slate-400">
                Link nội bộ tối thiểu
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={minLinksInput}
                onChange={(e) => setMinLinksInput(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu chuẩn"}
            </Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-center text-xs dark:bg-slate-900">
        <div>
          <p className="text-[10px] text-slate-500">Số từ hiện tại</p>
          <p className="font-bold text-slate-900 dark:text-white">
            {report.wordCount.toLocaleString("vi-VN")}{" "}
            <span className="font-normal text-slate-400">/ {config.minWordCount}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Link nội bộ</p>
          <p className="font-bold text-slate-900 dark:text-white">
            {report.internalLinkCount}{" "}
            <span className="font-normal text-slate-400">
              / {config.minInternalLinks}
            </span>
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {report.checks.map((chk) => (
          <li
            key={chk.id}
            className="flex items-start gap-2 rounded-xl border border-slate-100 px-2.5 py-2 text-xs dark:border-slate-800/80"
          >
            {chk.passed ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            )}
            <div className="min-w-0">
              <p
                className={`font-semibold ${
                  chk.passed
                    ? "text-slate-800 dark:text-slate-200"
                    : "text-amber-900 dark:text-amber-200"
                }`}
              >
                {chk.label}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {chk.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface InternalLinkSuggestionsPanelProps {
  title: string;
  category: string;
  tags: string[];
  primaryKeyword?: string;
  contentHtml: string;
  catalog: InternalLinkCandidate[];
  hasZeroInternalLinks: boolean;
  onInsertLink: (item: InternalLinkCandidate) => void;
}

const KIND_META = {
  test: { label: "Đề thi", Icon: BookOpen, color: "text-sky-600" },
  course: { label: "Khóa học", Icon: GraduationCap, color: "text-violet-600" },
  tool: { label: "Công cụ AI", Icon: Wrench, color: "text-emerald-600" },
} as const;

export function InternalLinkSuggestionsPanel({
  title,
  category,
  tags,
  primaryKeyword,
  contentHtml,
  catalog,
  hasZeroInternalLinks,
  onInsertLink,
}: InternalLinkSuggestionsPanelProps) {
  const [kindFilter, setKindFilter] = useState<"all" | "test" | "course" | "tool">(
    "all"
  );

  const suggestions = useMemo(
    () =>
      rankInternalLinkSuggestions(
        { title, category, tags, primaryKeyword, contentHtml },
        catalog,
        12
      ),
    [title, category, tags, primaryKeyword, contentHtml, catalog]
  );

  const visible = useMemo(
    () =>
      kindFilter === "all"
        ? suggestions.slice(0, 8)
        : suggestions.filter((s) => s.kind === kindFilter).slice(0, 8),
    [suggestions, kindFilter]
  );

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Gợi ý Link nội bộ tự động
          </h2>
        </div>
      </div>

      {hasZeroInternalLinks && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            <strong>Cảnh báo:</strong> Bài viết chưa có link nội bộ nào! Hãy chèn ít nhất 2 liên kết tới đề thi, khóa học hoặc công cụ AI bên dưới.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "all", label: "Tất cả" },
            { id: "test", label: "Đề thi" },
            { id: "course", label: "Khóa học" },
            { id: "tool", label: "Công cụ AI" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setKindFilter(tab.id)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
              kindFilter === tab.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5">
        {visible.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">
            Chưa có gợi ý phù hợp trong nhóm này.
          </p>
        ) : (
          visible.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.Icon;
            return (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
                    <span className="truncate font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {item.subtitle} · <code>{item.href}</code>
                  </p>
                </div>
                {item.alreadyLinked ? (
                  <Badge variant="default" className="shrink-0">
                    Đã gắn
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onInsertLink(item)}
                    className="h-7 shrink-0 px-2 text-[11px]"
                  >
                    <Plus className="h-3 w-3" /> Chèn
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
