"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Headphones,
  Image as ImageIcon,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Volume2,
} from "lucide-react";
import type { MediaAsset, PronunciationSound, SeoMeta } from "@/lib/types";
import { slugifyVi } from "@/lib/seo";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { MediaPickerModal } from "./media-picker-modal";
import { SeoPanel } from "./seo-panel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PronunciationForm = {
  id?: string;
  slug: string;
  symbol: string;
  category: "vowel" | "diphthong" | "consonant";
  title_vi: string;
  title_en: string;
  mouthPosition_vi: string;
  vietnameseTip_vi: string;
  tip_en: string;
  practiceSentence: string;
  examples: { word: string; ipa: string; meaning_vi: string }[];
  mouth_image_url: string;
  audio_url: string;
  is_published: boolean;
  is_premium: boolean;
  sort_order: number;
  seo_meta: SeoMeta;
};

const CATEGORY_LABELS: Record<PronunciationSound["category"], string> = {
  vowel: "Nguyên âm đơn (Vowel)",
  diphthong: "Nguyên âm đôi (Diphthong)",
  consonant: "Phụ âm (Consonant)",
};

function createEmptySound(): PronunciationForm {
  return {
    slug: "",
    symbol: "",
    category: "vowel",
    title_vi: "",
    title_en: "",
    mouthPosition_vi: "",
    vietnameseTip_vi: "",
    tip_en: "",
    practiceSentence: "",
    examples: [{ word: "", ipa: "", meaning_vi: "" }],
    mouth_image_url: "",
    audio_url: "",
    is_published: true,
    is_premium: false,
    sort_order: 0,
    seo_meta: {},
  };
}

function soundToForm(s: PronunciationSound): PronunciationForm {
  return {
    id: s.id ?? s.slug,
    slug: s.slug,
    symbol: s.symbol,
    category: s.category,
    title_vi: s.title_vi,
    title_en: s.title_en,
    mouthPosition_vi: s.mouthPosition_vi,
    vietnameseTip_vi: s.vietnameseTip_vi,
    tip_en: s.tip_en,
    practiceSentence: s.practiceSentence,
    examples:
      s.examples.length > 0
        ? s.examples
        : [{ word: "", ipa: "", meaning_vi: "" }],
    mouth_image_url: s.mouth_image_url ?? "",
    audio_url: s.audio_url ?? "",
    is_published: s.is_published !== false,
    is_premium: Boolean(s.is_premium),
    sort_order: s.sort_order ?? 0,
    seo_meta: s.seo_meta ?? {},
  };
}

export function PronunciationCmsClient({
  initialItems,
}: {
  initialItems: PronunciationSound[];
}) {
  const toast = useAdminToast();
  const [items, setItems] = useState<PronunciationSound[]>(initialItems);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editing, setEditing] = useState<PronunciationForm | null>(null);
  const [slugLocked, setSlugLocked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSeo, setShowSeo] = useState(false);

  const [imgPickerOpen, setImgPickerOpen] = useState(false);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PronunciationSound | null>(null);
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
    return items.filter((s) => {
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (q) {
        const hay = `${s.symbol} ${s.title_vi} ${s.title_en} ${s.slug}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, categoryFilter]);

  const reloadItems = async () => {
    const res = await fetch("/api/admin/learning/pronunciation?pageSize=100");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  };

  const updateForm = (patch: Partial<PronunciationForm>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        slug: editing.slug || slugifyVi(editing.title_vi),
        symbol: editing.symbol,
        category: editing.category,
        title_vi: editing.title_vi,
        title_en: editing.title_en || editing.title_vi,
        mouthPosition_vi: editing.mouthPosition_vi,
        vietnameseTip_vi: editing.vietnameseTip_vi,
        tip_en: editing.tip_en || editing.mouthPosition_vi,
        practiceSentence: editing.practiceSentence,
        examples: editing.examples.filter((e) => e.word.trim()),
        mouth_image_url: editing.mouth_image_url || null,
        audio_url: editing.audio_url || null,
        is_published: editing.is_published,
        is_premium: editing.is_premium,
        sort_order: Number(editing.sort_order) || 0,
        seo_meta: editing.seo_meta,
      };

      const isEdit = Boolean(editing.id);
      const url = isEdit
        ? `/api/admin/learning/pronunciation/${editing.id}`
        : "/api/admin/learning/pronunciation";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể lưu âm IPA.");
        return;
      }

      toast.success(
        isEdit
          ? data.redirectCreated
            ? "Đã lưu âm IPA và tự tạo Redirect 301!"
            : "Đã cập nhật âm IPA thành công!"
          : "Đã thêm âm IPA mới thành công!"
      );
      setDirty(false);
      await reloadItems();
      setEditing(soundToForm(data.item));
      setSlugLocked(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (s: PronunciationSound) => {
    const id = s.id ?? s.slug;
    const res = await fetch(`/api/admin/learning/pronunciation/${id}`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Nhân bản thất bại.");
      return;
    }
    toast.success("Đã nhân bản âm IPA thành bản nháp!");
    await reloadItems();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const id = deleteTarget.id ?? deleteTarget.slug;
      const res = await fetch(`/api/admin/learning/pronunciation/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Xóa thất bại.");
        return;
      }
      toast.success(`Đã xóa âm IPA ${deleteTarget.symbol}.`);
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
              Bảng IPA
            </Button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {editing.id ? `Chỉnh sửa âm IPA ${editing.symbol}` : "Thêm âm IPA mới"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {editing.slug && (
              <Link
                href={`/pronunciation/${editing.slug}?preview=1`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Xem trước
              </Link>
            )}
            <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
              <Save className="h-4 w-4" />
              {saving ? "Đang lưu..." : "Lưu âm IPA"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Ký hiệu IPA *
                </label>
                <input
                  type="text"
                  value={editing.symbol}
                  onChange={(e) => updateForm({ symbol: e.target.value })}
                  placeholder="/θ/"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base font-bold dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nhóm âm *
                </label>
                <select
                  value={editing.category}
                  onChange={(e) =>
                    updateForm({
                      category: e.target.value as PronunciationForm["category"],
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="vowel">Nguyên âm đơn (Vowel)</option>
                  <option value="diphthong">Nguyên âm đôi (Diphthong)</option>
                  <option value="consonant">Phụ âm (Consonant)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Slug (/pronunciation/...) *
                </label>
                <input
                  type="text"
                  value={editing.slug}
                  onChange={(e) => {
                    setSlugLocked(true);
                    updateForm({ slug: e.target.value });
                  }}
                  placeholder="th-voiceless"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tên gọi (VI) *
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
                  placeholder="Phụ âm vô thanh /θ/"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tên gọi (EN)
                </label>
                <input
                  type="text"
                  value={editing.title_en}
                  onChange={(e) => updateForm({ title_en: e.target.value })}
                  placeholder="Voiceless Dental /θ/"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Hướng dẫn khẩu hình & vị trí lưỡi (VI) *
              </label>
              <textarea
                rows={3}
                value={editing.mouthPosition_vi}
                onChange={(e) => updateForm({ mouthPosition_vi: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-amber-800 dark:text-amber-300">
                Lỗi người Việt hay gặp & Mẹo sửa (VI) *
              </label>
              <textarea
                rows={3}
                value={editing.vietnameseTip_vi}
                onChange={(e) => updateForm({ vietnameseTip_vi: e.target.value })}
                className="w-full rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Hướng dẫn (EN)
              </label>
              <textarea
                rows={2}
                value={editing.tip_en}
                onChange={(e) => updateForm({ tip_en: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Câu thực hành đọc mẫu (Practice Sentence) *
              </label>
              <input
                type="text"
                value={editing.practiceSentence}
                onChange={(e) => updateForm({ practiceSentence: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            {/* Examples */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Từ ví dụ tiêu biểu ({editing.examples.length})
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateForm({
                      examples: [
                        ...editing.examples,
                        { word: "", ipa: "", meaning_vi: "" },
                      ],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm từ ví dụ
                </Button>
              </div>
              {editing.examples.map((ex, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-12">
                  <input
                    type="text"
                    value={ex.word}
                    onChange={(e) => {
                      const next = [...editing.examples];
                      next[idx] = { ...next[idx], word: e.target.value };
                      updateForm({ examples: next });
                    }}
                    placeholder="Từ (VD: think)"
                    className="sm:col-span-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
                  />
                  <input
                    type="text"
                    value={ex.ipa}
                    onChange={(e) => {
                      const next = [...editing.examples];
                      next[idx] = { ...next[idx], ipa: e.target.value };
                      updateForm({ examples: next });
                    }}
                    placeholder="IPA (VD: /θɪŋk/)"
                    className="sm:col-span-4 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <input
                    type="text"
                    value={ex.meaning_vi}
                    onChange={(e) => {
                      const next = [...editing.examples];
                      next[idx] = { ...next[idx], meaning_vi: e.target.value };
                      updateForm({ examples: next });
                    }}
                    placeholder="Nghĩa tiếng Việt"
                    className="sm:col-span-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="sm:col-span-1 text-red-500"
                    disabled={editing.examples.length <= 1}
                    onClick={() =>
                      updateForm({
                        examples: editing.examples.filter((_, i) => i !== idx),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            {/* Mouth Image Picker */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ảnh minh họa khẩu hình
                </h2>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setImgPickerOpen(true)}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Chọn ảnh
                </Button>
              </div>
              {editing.mouth_image_url ? (
                <div className="space-y-2">
                  <img
                    src={editing.mouth_image_url}
                    alt={`Khẩu hình ${editing.symbol}`}
                    className="h-44 w-full rounded-xl border border-slate-200 object-contain bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full text-red-600"
                    onClick={() => updateForm({ mouth_image_url: "" })}
                  >
                    Gỡ ảnh khẩu hình
                  </Button>
                </div>
              ) : (
                <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700">
                  Chưa gắn sơ đồ khẩu hình
                </div>
              )}
            </Card>

            {/* Sample Audio Picker */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Audio phát âm mẫu (MP3)
                </h2>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAudioPickerOpen(true)}
                >
                  <Headphones className="h-3.5 w-3.5" />
                  Chọn MP3
                </Button>
              </div>
              <input
                type="text"
                value={editing.audio_url}
                onChange={(e) => updateForm({ audio_url: e.target.value })}
                placeholder="Để trống để dùng giọng đọc TTS tự động..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              {editing.audio_url && (
                <audio controls src={editing.audio_url} className="w-full h-9" />
              )}
            </Card>

            {/* Publishing */}
            <Card className="p-5 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Hiển thị & SEO
              </h2>
              <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800 cursor-pointer">
                <span className="font-bold">Xuất bản trên /pronunciation</span>
                <input
                  type="checkbox"
                  checked={editing.is_published}
                  onChange={(e) => updateForm({ is_published: e.target.checked })}
                  className="h-4 w-4 accent-emerald-600"
                />
              </label>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowSeo((v) => !v)}
              >
                {showSeo ? "Ẩn SEO" : "Mở cấu hình SEO"}
              </Button>
            </Card>
          </div>
        </div>

        {showSeo && (
          <SeoPanel
            seoMeta={editing.seo_meta}
            onChange={(seo_meta) => updateForm({ seo_meta })}
            fallbackTitle={`Cách phát âm ${editing.symbol} (${editing.title_vi})`}
            fallbackDescription={editing.vietnameseTip_vi}
            slug={editing.slug}
            basePath="/pronunciation"
            contentHtml={`<h2>${editing.title_vi}</h2><p>${editing.mouthPosition_vi}</p><p>${editing.vietnameseTip_vi}</p>`}
            coverImageUrl={editing.mouth_image_url}
          />
        )}

        <MediaPickerModal
          open={imgPickerOpen}
          onClose={() => setImgPickerOpen(false)}
          acceptKind="image"
          defaultFolder="pronunciation"
          title="Chọn ảnh sơ đồ khẩu hình IPA"
          onSelect={(asset: MediaAsset) => {
            updateForm({ mouth_image_url: asset.public_url });
            setImgPickerOpen(false);
          }}
        />
        <MediaPickerModal
          open={audioPickerOpen}
          onClose={() => setAudioPickerOpen(false)}
          acceptKind="audio"
          defaultFolder="pronunciation"
          title="Chọn Audio mẫu phát âm IPA"
          onSelect={(asset: MediaAsset) => {
            updateForm({ audio_url: asset.public_url });
            setAudioPickerOpen(false);
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
            Quản lý Phát âm IPA
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Quản lý từng âm IPA, từ ví dụ, sơ đồ khẩu hình, mẹo sửa lỗi cho người Việt và audio đọc mẫu.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditing(createEmptySound());
            setSlugLocked(false);
            setDirty(false);
          }}
        >
          <Plus className="h-4 w-4" />
          Thêm âm IPA mới
        </Button>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo ký hiệu IPA (/θ/, /æ/), tên gọi, slug..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Lọc nhóm âm"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"
        >
          <option value="">Tất cả nhóm âm</option>
          <option value="vowel">Nguyên âm đơn</option>
          <option value="diphthong">Nguyên âm đôi</option>
          <option value="consonant">Phụ âm</option>
        </select>
        <Badge variant="secondary">{filteredItems.length} âm IPA</Badge>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredItems.map((sound) => (
          <Card key={sound.id ?? sound.slug} className="flex flex-col justify-between p-5 space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-xs">
                  {sound.symbol}
                </span>
                <div className="flex flex-wrap justify-end gap-1">
                  <Badge variant={sound.is_published === false ? "secondary" : "default"}>
                    {sound.is_published === false ? "Nháp" : "Đang hiện"}
                  </Badge>
                  {sound.audio_url && <Badge variant="amber">MP3</Badge>}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-400">
                  {CATEGORY_LABELS[sound.category]}
                </p>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {sound.title_vi}
                </h2>
              </div>

              <p className="text-xs text-slate-500 line-clamp-2">
                {sound.examples.map((e) => e.word).join(", ")}
              </p>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Volume2 className="h-3.5 w-3.5" />
                <span>{sound.examples.length} từ ví dụ</span>
                {sound.mouth_image_url && <span>· Có ảnh khẩu hình</span>}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditing(soundToForm(sound));
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
                  onClick={() => handleDuplicate(sound)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Link
                  href={`/pronunciation/${sound.slug}?preview=1`}
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
                onClick={() => setDeleteTarget(sound)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa âm phát âm IPA?"
        description={`Âm IPA ${deleteTarget?.symbol ?? ""} (${deleteTarget?.title_vi ?? ""}) sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa âm IPA"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
