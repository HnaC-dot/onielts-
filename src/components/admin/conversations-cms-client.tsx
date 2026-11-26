"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Copy,
  ExternalLink,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ContentPublishStatus, ConversationTopic, SeoMeta } from "@/lib/types";
import { CONVERSATION_PARTS } from "@/lib/learning-cms-shared";
import { slugifyVi } from "@/lib/seo";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { SeoPanel } from "./seo-panel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ConversationForm = {
  id?: string;
  slug: string;
  title_vi: string;
  title_en: string;
  part: ConversationTopic["part"];
  level: string;
  opener: string;
  description_vi: string;
  description_en: string;
  vocabText: string;
  sampleQuestions: string[];
  systemPrompt: string;
  status: ContentPublishStatus;
  is_premium: boolean;
  sort_order: number;
  seo_meta: SeoMeta;
};

const PROMPT_TEMPLATES = [
  {
    label: "Examiner thân thiện (Part 1)",
    text: "Act as a warm IELTS Speaking Part 1 examiner. Keep questions conversational and concise (2-3 sentences), encourage natural elaboration with reasons/examples, and highlight useful collocations in quickTipVi.",
  },
  {
    label: "Thảo luận học thuật sâu (Part 3)",
    text: "Act as an experienced IELTS Speaking Part 3 examiner. Ask analytical follow-up questions exploring social trends, pros/cons, and future predictions. Push the learner toward Band 7.5-8.5 hedging and academic vocabulary.",
  },
  {
    label: "Đóng vai đời sống (Daily Life)",
    text: "Role-play an everyday realistic situation with the learner. Stay in character, respond naturally in 2-3 sentences, and gently correct awkward phrasing or pronunciation-related word choices in quickTipVi.",
  },
];

function createEmptyConversation(): ConversationForm {
  return {
    slug: "",
    title_vi: "",
    title_en: "",
    part: "Part 1",
    level: "Band 6.0–7.5",
    opener: "Hello! Let's start today's IELTS Speaking practice. Could you tell me about your thoughts on this topic?",
    description_vi: "",
    description_en: "",
    vocabText: "",
    sampleQuestions: [""],
    systemPrompt: "",
    status: "published",
    is_premium: false,
    sort_order: 0,
    seo_meta: {},
  };
}

function topicToForm(t: ConversationTopic): ConversationForm {
  return {
    id: t.id,
    slug: t.slug,
    title_vi: t.title_vi,
    title_en: t.title_en,
    part: t.part,
    level: t.level,
    opener: t.opener,
    description_vi: t.description_vi,
    description_en: t.description_en,
    vocabText: (t.suggestedVocab ?? []).join(", "),
    sampleQuestions:
      t.sampleQuestions && t.sampleQuestions.length > 0
        ? t.sampleQuestions
        : [t.opener],
    systemPrompt: t.systemPrompt ?? "",
    status: t.status ?? "published",
    is_premium: Boolean(t.is_premium),
    sort_order: t.sort_order ?? 0,
    seo_meta: t.seo_meta ?? {},
  };
}

export function ConversationsCmsClient({
  initialItems,
}: {
  initialItems: ConversationTopic[];
}) {
  const toast = useAdminToast();
  const [items, setItems] = useState<ConversationTopic[]>(initialItems);
  const [search, setSearch] = useState("");
  const [partFilter, setPartFilter] = useState("");
  const [editing, setEditing] = useState<ConversationForm | null>(null);
  const [slugLocked, setSlugLocked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSeo, setShowSeo] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConversationTopic | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!dirty || !editing) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, editing]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((t) => {
      if (partFilter && t.part !== partFilter) return false;
      if (q) {
        const hay = `${t.title_vi} ${t.title_en} ${t.slug} ${t.part} ${t.description_vi}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, partFilter]);

  const reloadItems = async () => {
    const res = await fetch("/api/admin/learning/conversations?pageSize=100");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  };

  const updateForm = (patch: Partial<ConversationForm>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const suggestedVocab = editing.vocabText
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean);
      const sampleQuestions = editing.sampleQuestions
        .map((q) => q.trim())
        .filter(Boolean);

      const payload = {
        slug: editing.slug || slugifyVi(editing.title_en || editing.title_vi),
        title_vi: editing.title_vi,
        title_en: editing.title_en || editing.title_vi,
        part: editing.part,
        level: editing.level,
        opener: editing.opener,
        description_vi: editing.description_vi,
        description_en: editing.description_en || editing.description_vi,
        suggestedVocab,
        sampleQuestions,
        systemPrompt: editing.systemPrompt,
        status: editing.status,
        is_premium: editing.is_premium,
        sort_order: Number(editing.sort_order) || 0,
        seo_meta: editing.seo_meta,
      };

      const isEdit = Boolean(editing.id);
      const url = isEdit
        ? `/api/admin/learning/conversations/${editing.id}`
        : "/api/admin/learning/conversations";

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể lưu chủ đề hội thoại.");
        return;
      }

      toast.success(
        isEdit
          ? "Đã cập nhật chủ đề Hội thoại AI!"
          : "Đã thêm chủ đề Hội thoại AI mới!"
      );
      setDirty(false);
      await reloadItems();
      setEditing(topicToForm(data.item));
      setSlugLocked(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (t: ConversationTopic) => {
    const id = t.id ?? t.slug;
    const res = await fetch(`/api/admin/learning/conversations/${id}`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Không thể nhân bản chủ đề.");
      return;
    }
    toast.success("Đã nhân bản chủ đề thành bản nháp!");
    await reloadItems();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const id = deleteTarget.id ?? deleteTarget.slug;
      const res = await fetch(`/api/admin/learning/conversations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Xóa thất bại.");
        return;
      }
      toast.success(`Đã xóa chủ đề "${deleteTarget.title_vi}".`);
      setDeleteTarget(null);
      await reloadItems();
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (dirty && !window.confirm("Bạn có thay đổi chưa lưu. Rời trang?")) return;
                setEditing(null);
                setDirty(false);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Danh sách chủ đề
            </Button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {editing.id ? "Chỉnh sửa Chủ đề Hội thoại AI" : "Tạo Chủ đề Hội thoại AI mới"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {editing.slug && (
              <Link
                href={`/conversations?topic=${editing.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Mở thử với AI
              </Link>
            )}
            <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
              <Save className="h-4 w-4" />
              {saving ? "Đang lưu..." : "Lưu chủ đề"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tên chủ đề (Tiếng Việt) *
                </label>
                <input
                  type="text"
                  value={editing.title_vi}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateForm({
                      title_vi: val,
                      ...(!slugLocked ? { slug: slugifyVi(val) } : {}),
                    });
                  }}
                  placeholder="VD: Công việc & Sự nghiệp"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tên chủ đề (Tiếng Anh) *
                </label>
                <input
                  type="text"
                  value={editing.title_en}
                  onChange={(e) => updateForm({ title_en: e.target.value })}
                  placeholder="Job & Career Goals"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Slug *
                </label>
                <input
                  type="text"
                  value={editing.slug}
                  onChange={(e) => {
                    setSlugLocked(true);
                    updateForm({ slug: e.target.value });
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Phần thi Speaking
                </label>
                <select
                  value={editing.part}
                  onChange={(e) =>
                    updateForm({ part: e.target.value as ConversationTopic["part"] })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  {CONVERSATION_PARTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Trình độ Band
                </label>
                <input
                  type="text"
                  value={editing.level}
                  onChange={(e) => updateForm({ level: e.target.value })}
                  placeholder="Band 6.0–8.0"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Câu mở đầu hội thoại của AI (Tiếng Anh) *
              </label>
              <textarea
                rows={2}
                value={editing.opener}
                onChange={(e) => updateForm({ opener: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mô tả ngắn (VI) *
                </label>
                <textarea
                  rows={2}
                  value={editing.description_vi}
                  onChange={(e) => updateForm({ description_vi: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mô tả ngắn (EN)
                </label>
                <textarea
                  rows={2}
                  value={editing.description_en}
                  onChange={(e) => updateForm({ description_en: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Từ vựng / Collocations gợi ý (phân tách bằng dấu phẩy)
              </label>
              <input
                type="text"
                value={editing.vocabText}
                onChange={(e) => updateForm({ vocabText: e.target.value })}
                placeholder="close-knit family, look up to, quality time, take after"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            {/* Sample Follow-up Questions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Bộ câu hỏi mẫu trong chủ đề
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateForm({
                      sampleQuestions: [...editing.sampleQuestions, ""],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm câu hỏi
                </Button>
              </div>
              {editing.sampleQuestions.map((q, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => {
                      const next = [...editing.sampleQuestions];
                      next[idx] = e.target.value;
                      updateForm({ sampleQuestions: next });
                    }}
                    placeholder={`Câu hỏi mẫu #${idx + 1}...`}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      updateForm({
                        sampleQuestions: editing.sampleQuestions.filter(
                          (_, i) => i !== idx
                        ),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>

            {/* AI System Prompt */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  <Bot className="h-4 w-4 text-emerald-600" />
                  Prompt hướng dẫn vai trò AI (System Prompt — kết nối trực tiếp Gemini)
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => updateForm({ systemPrompt: tpl.text })}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    {tpl.label}
                  </button>
                ))}
              </div>
              <textarea
                rows={4}
                value={editing.systemPrompt}
                onChange={(e) => updateForm({ systemPrompt: e.target.value })}
                placeholder="Để trống để dùng prompt mặc định của Ôn IELTS, hoặc nhập chỉ dẫn riêng cho chủ đề này (vai diễn, ngữ cảnh, tiêu chí sửa lỗi)..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Xuất bản & Thứ tự
              </h2>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Trạng thái
                </label>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    updateForm({ status: e.target.value as ContentPublishStatus })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="published">Đã xuất bản</option>
                  <option value="draft">Bản nháp (Ẩn khỏi học viên)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Thứ tự hiển thị
                </label>
                <input
                  type="number"
                  min={0}
                  value={editing.sort_order}
                  onChange={(e) =>
                    updateForm({ sort_order: Number.parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800 cursor-pointer">
                <span className="font-bold text-slate-900 dark:text-white">
                  Chủ đề Premium
                </span>
                <input
                  type="checkbox"
                  checked={editing.is_premium}
                  onChange={(e) => updateForm({ is_premium: e.target.checked })}
                  className="h-4 w-4 accent-emerald-600"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowSeo((v) => !v)}
              >
                {showSeo ? "Ẩn tùy chọn SEO" : "Mở cấu hình SEO"}
              </Button>
            </Card>
          </div>
        </div>

        {showSeo && (
          <SeoPanel
            seoMeta={editing.seo_meta}
            onChange={(seo_meta) => updateForm({ seo_meta })}
            fallbackTitle={editing.title_vi}
            fallbackDescription={editing.description_vi}
            slug={editing.slug}
            basePath="/conversations"
            contentHtml={`<h2>${editing.title_vi}</h2><p>${editing.description_vi}</p><p>${editing.opener}</p>`}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quản lý Hội thoại AI (Speaking Role-play)
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Cấu hình chủ đề hội thoại, từ vựng gợi ý, câu hỏi mẫu và System Prompt điều khiển trực tiếp trợ lý Speaking AI.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditing(createEmptyConversation());
            setSlugLocked(false);
            setDirty(false);
          }}
        >
          <Plus className="h-4 w-4" />
          Thêm chủ đề mới
        </Button>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên chủ đề, slug, từ vựng..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950"
          />
        </div>
        <select
          value={partFilter}
          onChange={(e) => setPartFilter(e.target.value)}
          aria-label="Lọc theo Part"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"
        >
          <option value="">Tất cả phần thi</option>
          {CONVERSATION_PARTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Badge variant="secondary">{filteredItems.length} chủ đề</Badge>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((topic) => (
          <Card key={topic.id ?? topic.slug} className="flex flex-col justify-between p-5 space-y-4">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge>{topic.part}</Badge>
                  <Badge variant={topic.status === "draft" ? "secondary" : "default"}>
                    {topic.status === "draft" ? "Nháp" : "Đang hiện"}
                  </Badge>
                  {topic.systemPrompt?.trim() && (
                    <Badge variant="amber">Custom Prompt</Badge>
                  )}
                </div>
                <MessageSquare className="h-4 w-4 text-emerald-600" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {topic.title_vi}
                </h2>
                <p className="text-xs text-slate-500">{topic.title_en}</p>
              </div>

              <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                {topic.description_vi}
              </p>

              <div className="flex flex-wrap gap-1">
                {topic.suggestedVocab.slice(0, 3).map((v) => (
                  <span
                    key={v}
                    className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditing(topicToForm(topic));
                    setSlugLocked(true);
                    setDirty(false);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Sửa
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleDuplicate(topic)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Link
                  href={`/conversations?topic=${topic.slug}`}
                  target="_blank"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-600"
                onClick={() => setDeleteTarget(topic)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa chủ đề hội thoại?"
        description={`Chủ đề "${deleteTarget?.title_vi ?? ""}" sẽ bị xóa khỏi danh sách luyện nói AI.`}
        confirmLabel="Xóa chủ đề"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
