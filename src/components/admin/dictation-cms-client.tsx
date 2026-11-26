"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  ExternalLink,
  Headphones,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import type { DictationLesson, MediaAsset, SeoMeta } from "@/lib/types";
import { slugifyVi } from "@/lib/seo";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { MediaPickerModal } from "./media-picker-modal";
import { SeoPanel } from "./seo-panel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

let dictUidSeq = 0;
function nextDictSentenceUid(): string {
  dictUidSeq += 1;
  return `ds-${dictUidSeq}`;
}

type DictationSentenceForm = {
  id: string;
  text: string;
  translation_vi: string;
  tip_vi: string;
  audioUrl: string;
};

type DictationForm = {
  id?: string;
  slug: string;
  title_vi: string;
  title_en: string;
  category: string;
  difficulty: string;
  accent: "en-GB" | "en-US" | "en-AU";
  is_published: boolean;
  is_premium: boolean;
  seo_meta: SeoMeta;
  sentences: DictationSentenceForm[];
};

function createEmptySentence(): DictationSentenceForm {
  return {
    id: nextDictSentenceUid(),
    text: "",
    translation_vi: "",
    tip_vi: "",
    audioUrl: "",
  };
}

function createEmptyDictation(): DictationForm {
  return {
    slug: "",
    title_vi: "",
    title_en: "",
    category: "Listening Part 1",
    difficulty: "Band 5.5–6.5",
    accent: "en-GB",
    is_published: true,
    is_premium: false,
    seo_meta: {},
    sentences: [createEmptySentence()],
  };
}

function dictationToForm(d: DictationLesson): DictationForm {
  return {
    id: d.id,
    slug: d.slug,
    title_vi: d.title_vi,
    title_en: d.title_en,
    category: d.category,
    difficulty: d.difficulty,
    accent: d.accent,
    is_published: d.is_published !== false,
    is_premium: Boolean(d.is_premium),
    seo_meta: d.seo_meta ?? {},
    sentences:
      d.sentences.length > 0
        ? d.sentences.map((s) => ({
            id: s.id || nextDictSentenceUid(),
            text: s.text,
            translation_vi: s.translation_vi,
            tip_vi: s.tip_vi ?? "",
            audioUrl: s.audioUrl ?? "",
          }))
        : [createEmptySentence()],
  };
}

export function DictationCmsClient({
  initialItems,
}: {
  initialItems: DictationLesson[];
}) {
  const toast = useAdminToast();
  const [items, setItems] = useState<DictationLesson[]>(initialItems);
  const [search, setSearch] = useState("");
  const [accentFilter, setAccentFilter] = useState("");
  const [editing, setEditing] = useState<DictationForm | null>(null);
  const [slugLocked, setSlugLocked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSeo, setShowSeo] = useState(false);

  const [audioTargetIdx, setAudioTargetIdx] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DictationLesson | null>(null);
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
    return items.filter((d) => {
      if (accentFilter && d.accent !== accentFilter) return false;
      if (q) {
        const hay = `${d.title_vi} ${d.title_en} ${d.slug} ${d.category} ${d.accent}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, accentFilter]);

  const reloadItems = async () => {
    const res = await fetch("/api/admin/learning/dictation?pageSize=100");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  };

  const updateForm = (patch: Partial<DictationForm>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const updateSentence = (idx: number, patch: Partial<DictationSentenceForm>) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = [...prev.sentences];
      if (!next[idx]) return prev;
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, sentences: next };
    });
    setDirty(true);
  };

  const moveSentence = (from: number, to: number) => {
    if (!editing || to < 0 || to >= editing.sentences.length) return;
    const next = [...editing.sentences];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateForm({ sentences: next });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        slug: editing.slug || slugifyVi(editing.title_vi),
        title_vi: editing.title_vi,
        title_en: editing.title_en || editing.title_vi,
        category: editing.category,
        difficulty: editing.difficulty,
        accent: editing.accent,
        is_published: editing.is_published,
        is_premium: editing.is_premium,
        seo_meta: editing.seo_meta,
        sentences: editing.sentences.map((s) => ({
          id: s.id,
          text: s.text,
          translation_vi: s.translation_vi,
          tip_vi: s.tip_vi,
          audioUrl: s.audioUrl,
        })),
      };

      const isEdit = Boolean(editing.id);
      const url = isEdit
        ? `/api/admin/learning/dictation/${editing.id}`
        : "/api/admin/learning/dictation";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể lưu bài chép chính tả.");
        return;
      }

      toast.success(
        isEdit
          ? "Đã cập nhật bài Chép chính tả!"
          : "Đã tạo bài Chép chính tả mới!"
      );
      setDirty(false);
      await reloadItems();
      setEditing(dictationToForm(data.item));
      setSlugLocked(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (d: DictationLesson) => {
    const res = await fetch(`/api/admin/learning/dictation/${d.id}`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Nhân bản thất bại.");
      return;
    }
    toast.success("Đã nhân bản bài chép chính tả thành bản nháp!");
    await reloadItems();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/learning/dictation/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Xóa thất bại.");
        return;
      }
      toast.success(`Đã xóa bài "${deleteTarget.title_vi}".`);
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
              Danh sách bài luyện
            </Button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {editing.id ? "Chỉnh sửa Bài Chép chính tả" : "Tạo Bài Chép chính tả mới"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {editing.slug && (
              <Link
                href={`/dictation?lesson=${editing.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Mở phòng luyện
              </Link>
            )}
            <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
              <Save className="h-4 w-4" />
              {saving ? "Đang lưu..." : "Lưu bài luyện"}
            </Button>
          </div>
        </div>

        <Card className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tiêu đề bài luyện (VI) *
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
                placeholder="VD: Hướng dẫn sử dụng Thư viện Đại học (Listening Part 1)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tiêu đề bài luyện (EN)
              </label>
              <input
                type="text"
                value={editing.title_en}
                onChange={(e) => updateForm({ title_en: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
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
                Danh mục
              </label>
              <input
                type="text"
                value={editing.category}
                onChange={(e) => updateForm({ category: e.target.value })}
                placeholder="Listening Part 1 / Daily English"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Giọng đọc (Accent)
              </label>
              <select
                value={editing.accent}
                onChange={(e) =>
                  updateForm({ accent: e.target.value as DictationForm["accent"] })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="en-GB">Anh – Anh (en-GB)</option>
                <option value="en-US">Anh – Mỹ (en-US)</option>
                <option value="en-AU">Anh – Úc (en-AU)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Độ khó (Band)
              </label>
              <input
                type="text"
                value={editing.difficulty}
                onChange={(e) => updateForm({ difficulty: e.target.value })}
                placeholder="Band 5.5–6.5"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_published}
                  onChange={(e) => updateForm({ is_published: e.target.checked })}
                  className="h-4 w-4 accent-emerald-600"
                />
                Xuất bản công khai
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_premium}
                  onChange={(e) => updateForm({ is_premium: e.target.checked })}
                  className="h-4 w-4 accent-emerald-600"
                />
                Bài luyện Premium
              </label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSeo((v) => !v)}
            >
              {showSeo ? "Ẩn SEO" : "Cấu hình SEO"}
            </Button>
          </div>
        </Card>

        {/* Sentences Editor */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Danh sách câu nghe & chép ({editing.sentences.length} câu)
              </h2>
              <p className="text-[11px] text-slate-500">
                Có thể gắn file MP3 riêng cho từng câu từ Thư viện Media (nếu để trống, trình duyệt tự đọc bằng TTS chuẩn giọng {editing.accent}).
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                updateForm({
                  sentences: [...editing.sentences, createEmptySentence()],
                })
              }
            >
              <Plus className="h-4 w-4" />
              Thêm câu
            </Button>
          </div>

          {editing.sentences.map((s, idx) => (
            <Card key={s.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge>Câu #{idx + 1}</Badge>
                  {s.audioUrl && <Badge variant="amber">MP3 riêng</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={idx === 0}
                    onClick={() => moveSentence(idx, idx - 1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={idx === editing.sentences.length - 1}
                    onClick={() => moveSentence(idx, idx + 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    disabled={editing.sentences.length <= 1}
                    onClick={() =>
                      updateForm({
                        sentences: editing.sentences.filter((_, i) => i !== idx),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Câu gốc tiếng Anh (Transcript) *
                  </label>
                  <textarea
                    rows={2}
                    value={s.text}
                    onChange={(e) => updateSentence(idx, { text: e.target.value })}
                    placeholder="Welcome to the central campus library orientation..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bản dịch tiếng Việt *
                  </label>
                  <textarea
                    rows={2}
                    value={s.translation_vi}
                    onChange={(e) =>
                      updateSentence(idx, { translation_vi: e.target.value })
                    }
                    placeholder="Chào mừng đến với buổi hướng dẫn thư viện..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mẹo nghe / nối âm (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={s.tip_vi}
                    onChange={(e) => updateSentence(idx, { tip_vi: e.target.value })}
                    placeholder="Chú ý nối âm và âm cuối /s/..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    File MP3 câu này (tùy chọn)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={s.audioUrl}
                      onChange={(e) =>
                        updateSentence(idx, { audioUrl: e.target.value })
                      }
                      placeholder="Để trống để dùng TTS tự động"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAudioTargetIdx(idx)}
                    >
                      <Headphones className="h-3.5 w-3.5" />
                      MP3
                    </Button>
                  </div>
                </div>
              </div>

              {s.audioUrl && (
                <audio controls src={s.audioUrl} className="w-full h-9" />
              )}
            </Card>
          ))}
        </div>

        {showSeo && (
          <SeoPanel
            seoMeta={editing.seo_meta}
            onChange={(seo_meta) => updateForm({ seo_meta })}
            fallbackTitle={editing.title_vi}
            fallbackDescription={`${editing.category} · ${editing.difficulty} · ${editing.sentences.length} câu chép chính tả & shadowing.`}
            slug={editing.slug}
            basePath="/dictation"
            contentHtml={`<h2>${editing.title_vi}</h2><p>${editing.sentences
              .map((s) => s.text)
              .join(" ")}</p>`}
          />
        )}

        <MediaPickerModal
          open={audioTargetIdx !== null}
          onClose={() => setAudioTargetIdx(null)}
          acceptKind="audio"
          defaultFolder="dictation"
          title="Chọn file Audio MP3 cho câu chép chính tả"
          onSelect={(asset: MediaAsset) => {
            if (audioTargetIdx !== null) {
              updateSentence(audioTargetIdx, { audioUrl: asset.public_url });
            }
            setAudioTargetIdx(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quản lý Chép chính tả (Dictation) & Shadowing
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Soạn bài nghe theo từng câu chuẩn giọng Anh – Mỹ – Úc, gắn bản dịch tiếng Việt, mẹo nối âm và file MP3 riêng.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditing(createEmptyDictation());
            setSlugLocked(false);
            setDirty(false);
          }}
        >
          <Plus className="h-4 w-4" />
          Tạo bài Dictation mới
        </Button>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên bài, danh mục, giọng đọc..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950"
          />
        </div>
        <select
          value={accentFilter}
          onChange={(e) => setAccentFilter(e.target.value)}
          aria-label="Lọc giọng đọc"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"
        >
          <option value="">Tất cả giọng đọc</option>
          <option value="en-GB">en-GB (Anh – Anh)</option>
          <option value="en-US">en-US (Anh – Mỹ)</option>
          <option value="en-AU">en-AU (Anh – Úc)</option>
        </select>
        <Badge variant="secondary">{filteredItems.length} bài luyện</Badge>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((lesson) => {
          const mp3Count = lesson.sentences.filter((s) => Boolean(s.audioUrl)).length;
          return (
            <Card key={lesson.id} className="flex flex-col justify-between p-5 space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge>{lesson.accent}</Badge>
                    <Badge variant={lesson.is_published === false ? "secondary" : "default"}>
                      {lesson.is_published === false ? "Nháp" : "Đang hiện"}
                    </Badge>
                    {mp3Count > 0 && <Badge variant="amber">{mp3Count} MP3</Badge>}
                  </div>
                  <Headphones className="h-4 w-4 text-emerald-600" />
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-400">
                    {lesson.category} · {lesson.difficulty}
                  </p>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {lesson.title_vi}
                  </h2>
                </div>

                <p className="text-xs text-slate-500">
                  {lesson.sentences.length} câu luyện nghe & shadowing
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setEditing(dictationToForm(lesson));
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
                    onClick={() => handleDuplicate(lesson)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Link
                    href={`/dictation?lesson=${lesson.slug}`}
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
                  onClick={() => setDeleteTarget(lesson)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa bài Chép chính tả?"
        description={`Bài luyện "${deleteTarget?.title_vi ?? ""}" sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa bài luyện"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
