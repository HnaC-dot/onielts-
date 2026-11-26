"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  FileUp,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  Subtitles,
  Trash2,
  Video,
} from "lucide-react";
import type { LearnVideo, SeoMeta } from "@/lib/types";
import { extractYoutubeVideoId } from "@/lib/sanitize";
import { slugifyVi } from "@/lib/seo";
import {
  formatSecondsClock,
  parseSrtOrVtt,
  parseSubtitlesToTranscript,
} from "@/lib/subtitle-parser";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { SeoPanel } from "./seo-panel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TranscriptRow = {
  startSec: number;
  endSec: number;
  en: string;
  vi: string;
};

type VideoForm = {
  id?: string;
  slug: string;
  youtube_input: string;
  title_vi: string;
  title_en: string;
  description_vi: string;
  description_en: string;
  level: string;
  duration_label: string;
  is_published: boolean;
  is_premium: boolean;
  seo_meta: SeoMeta;
  transcript: TranscriptRow[];
};

function createEmptyVideo(): VideoForm {
  return {
    slug: "",
    youtube_input: "",
    title_vi: "",
    title_en: "",
    description_vi: "",
    description_en: "",
    level: "Band 6.0–7.5",
    duration_label: "08:00",
    is_published: false,
    is_premium: false,
    seo_meta: {},
    transcript: [{ startSec: 0, endSec: 10, en: "", vi: "" }],
  };
}

function videoToForm(v: LearnVideo): VideoForm {
  return {
    id: v.id,
    slug: v.slug,
    youtube_input: v.youtube_id,
    title_vi: v.title_vi,
    title_en: v.title_en,
    description_vi: v.description_vi,
    description_en: v.description_en,
    level: v.level,
    duration_label: v.duration_label,
    is_published: v.is_published !== false,
    is_premium: Boolean(v.is_premium),
    seo_meta: v.seo_meta ?? {},
    transcript:
      v.transcript.length > 0
        ? v.transcript
        : [{ startSec: 0, endSec: 10, en: "", vi: "" }],
  };
}

export function VideosCmsClient({
  initialItems,
}: {
  initialItems: LearnVideo[];
}) {
  const toast = useAdminToast();
  const [items, setItems] = useState<LearnVideo[]>(initialItems);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<VideoForm | null>(null);
  const [slugLocked, setSlugLocked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "subtitles" | "seo">("info");

  // Subtitle file / raw paste import state
  const enFileRef = useRef<HTMLInputElement>(null);
  const viFileRef = useRef<HTMLInputElement>(null);
  const [pasteBoxOpen, setPasteBoxOpen] = useState(false);
  const [rawPasteText, setRawPasteText] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<LearnVideo | null>(null);
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
    return items.filter((v) => {
      if (!q) return true;
      const hay = `${v.title_vi} ${v.title_en} ${v.slug} ${v.youtube_id} ${v.level}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  const reloadItems = async () => {
    const res = await fetch("/api/admin/learning/videos?pageSize=100");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  };

  const updateForm = (patch: Partial<VideoForm>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const updateLine = (idx: number, patch: Partial<TranscriptRow>) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = [...prev.transcript];
      if (!next[idx]) return prev;
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, transcript: next };
    });
    setDirty(true);
  };

  const handleImportEnSubtitleFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editing) return;
    const raw = await file.text();
    const parsed = parseSubtitlesToTranscript(raw);
    if (parsed.length === 0) {
      toast.error("Không đọc được dòng phụ đề hợp lệ từ file .srt/.vtt này.");
      return;
    }
    updateForm({ transcript: parsed });
    toast.success(`Đã nhập thành công ${parsed.length} dòng phụ đề tiếng Anh!`);
  };

  const handleMergeViSubtitleFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editing) return;
    const raw = await file.text();
    const viCues = parseSrtOrVtt(raw);
    if (viCues.length === 0) {
      toast.error("Không đọc được phụ đề tiếng Việt hợp lệ từ file này.");
      return;
    }
    const merged = editing.transcript.map((line, idx) => {
      const byTime = viCues.find(
        (v) => Math.abs(v.startSec - line.startSec) <= 2
      );
      const vi = byTime?.text ?? viCues[idx]?.text ?? line.vi;
      return { ...line, vi };
    });
    updateForm({ transcript: merged });
    toast.success(`Đã ghép bản dịch tiếng Việt (${viCues.length} dòng)!`);
  };

  const handlePasteImport = () => {
    if (!editing || !rawPasteText.trim()) return;
    const parsed = parseSubtitlesToTranscript(rawPasteText);
    if (parsed.length === 0) {
      toast.error("Định dạng SRT/VTT chưa hợp lệ. Kiểm tra mốc thời gian dạng 00:00:05,000 --> 00:00:12,000.");
      return;
    }
    updateForm({ transcript: parsed });
    setRawPasteText("");
    setPasteBoxOpen(false);
    toast.success(`Đã nhập ${parsed.length} dòng phụ đề từ nội dung dán!`);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        slug: editing.slug || slugifyVi(editing.title_vi),
        youtube_input: editing.youtube_input,
        title_vi: editing.title_vi,
        title_en: editing.title_en || editing.title_vi,
        description_vi: editing.description_vi,
        description_en: editing.description_en || editing.description_vi,
        level: editing.level,
        duration_label: editing.duration_label,
        is_published: editing.is_published,
        is_premium: editing.is_premium,
        seo_meta: editing.seo_meta,
        transcript: editing.transcript.filter((l) => l.en.trim()),
      };

      const isEdit = Boolean(editing.id);
      const url = isEdit
        ? `/api/admin/learning/videos/${editing.id}`
        : "/api/admin/learning/videos";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể lưu video.");
        return;
      }

      toast.success(
        isEdit
          ? data.redirectCreated
            ? "Đã lưu video và tự tạo Redirect 301!"
            : "Đã cập nhật video thành công!"
          : "Đã tạo video tương tác mới!"
      );
      setDirty(false);
      await reloadItems();
      setEditing(videoToForm(data.item));
      setSlugLocked(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (v: LearnVideo) => {
    const res = await fetch(`/api/admin/learning/videos/${v.id}`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Nhân bản thất bại.");
      return;
    }
    toast.success("Đã nhân bản video thành bản nháp!");
    await reloadItems();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/learning/videos/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Xóa thất bại.");
        return;
      }
      toast.success(`Đã xóa video "${deleteTarget.title_vi}".`);
      setDeleteTarget(null);
      await reloadItems();
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    const parsedYtId = extractYoutubeVideoId(editing.youtube_input);
    const ytThumb = parsedYtId
      ? `https://i.ytimg.com/vi/${parsedYtId}/hqdefault.jpg`
      : null;

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
              Danh sách Video
            </Button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {editing.id ? "Chỉnh sửa Video tương tác" : "Thêm Video tương tác mới"}
              </h1>
              <p className="text-xs text-slate-500">
                {editing.transcript.length} dòng phụ đề · YouTube ID:{" "}
                <span className="font-mono">{parsedYtId ?? "chưa hợp lệ"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editing.slug && (
              <Link
                href={`/videos/${editing.slug}?preview=1`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Xem trước
              </Link>
            )}
            <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
              <Save className="h-4 w-4" />
              {saving ? "Đang lưu..." : "Lưu Video"}
            </Button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          {[
            { id: "info" as const, label: "1. Thông tin & Link YouTube" },
            {
              id: "subtitles" as const,
              label: `2. Trình sửa Phụ đề & Import .SRT/.VTT (${editing.transcript.length})`,
            },
            { id: "seo" as const, label: "3. SEO & VideoObject Schema" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === tab.id
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: INFO */}
        {activeTab === "info" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Link YouTube hoặc YouTube Video ID *
                </label>
                <input
                  type="text"
                  value={editing.youtube_input}
                  onChange={(e) => updateForm({ youtube_input: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=M7lc1UVf-VE hoặc M7lc1UVf-VE"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Hỗ trợ tự tách ID từ link <code>youtube.com/watch?v=...</code>,{" "}
                  <code>youtu.be/...</code>, <code>youtube.com/shorts/...</code> hoặc 11 ký tự ID.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tiêu đề Video (VI) *
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tiêu đề Video (EN)
                  </label>
                  <input
                    type="text"
                    value={editing.title_en}
                    onChange={(e) => updateForm({ title_en: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Slug (/videos/...) *
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
                    Trình độ (Level)
                  </label>
                  <input
                    type="text"
                    value={editing.level}
                    onChange={(e) => updateForm({ level: e.target.value })}
                    placeholder="Band 6.0–7.5"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Thời lượng (MM:SS)
                  </label>
                  <input
                    type="text"
                    value={editing.duration_label}
                    onChange={(e) => updateForm({ duration_label: e.target.value })}
                    placeholder="08:45"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mô tả Video (VI) *
                </label>
                <textarea
                  rows={3}
                  value={editing.description_vi}
                  onChange={(e) => updateForm({ description_vi: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mô tả Video (EN)
                </label>
                <textarea
                  rows={2}
                  value={editing.description_en}
                  onChange={(e) => updateForm({ description_en: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-5 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Xem trước YouTube
                </h2>
                {ytThumb ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                    <img
                      src={ytThumb}
                      alt={editing.title_vi || "YouTube thumbnail"}
                      className="aspect-video w-full object-cover"
                    />
                    <p className="bg-slate-50 px-3 py-2 font-mono text-[11px] text-emerald-700 dark:bg-slate-900 dark:text-emerald-400">
                      ✓ Đã nhận diện ID: {parsedYtId}
                    </p>
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700">
                    Dán link YouTube để xem trước
                  </div>
                )}
              </Card>

              <Card className="p-5 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Xuất bản
                </h2>
                <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800 cursor-pointer">
                  <span className="font-bold">Xuất bản công khai</span>
                  <input
                    type="checkbox"
                    checked={editing.is_published}
                    onChange={(e) => updateForm({ is_published: e.target.checked })}
                    className="h-4 w-4 accent-emerald-600"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800 cursor-pointer">
                  <span className="font-bold">Video Premium</span>
                  <input
                    type="checkbox"
                    checked={editing.is_premium}
                    onChange={(e) => updateForm({ is_premium: e.target.checked })}
                    className="h-4 w-4 accent-emerald-600"
                  />
                </label>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: SUBTITLE EDITOR + SRT/VTT IMPORTER */}
        {activeTab === "subtitles" && (
          <div className="space-y-4">
            <Card className="p-4 flex flex-wrap items-center justify-between gap-3 bg-emerald-50/40 border-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="space-y-0.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  <Subtitles className="h-4 w-4 text-emerald-600" />
                  Nhập nhanh phụ đề từ file .SRT / .VTT
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Tải file phụ đề tiếng Anh (tự động tách mốc giây), sau đó có thể ghép thêm file dịch tiếng Việt cùng mốc thời gian.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={enFileRef}
                  type="file"
                  accept=".srt,.vtt,.txt"
                  onChange={handleImportEnSubtitleFile}
                  className="hidden"
                />
                <input
                  ref={viFileRef}
                  type="file"
                  accept=".srt,.vtt,.txt"
                  onChange={handleMergeViSubtitleFile}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => enFileRef.current?.click()}
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Nhập .SRT/.VTT (EN)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => viFileRef.current?.click()}
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Ghép dịch .SRT/.VTT (VI)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPasteBoxOpen((v) => !v)}
                >
                  Dán nội dung SRT/VTT
                </Button>
              </div>
            </Card>

            {pasteBoxOpen && (
              <Card className="p-4 space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Dán trực tiếp nội dung file .SRT hoặc WebVTT:
                </label>
                <textarea
                  rows={6}
                  value={rawPasteText}
                  onChange={(e) => setRawPasteText(e.target.value)}
                  placeholder={"1\n00:00:00,000 --> 00:00:12,000\nWelcome back to Ôn IELTS.\n\n2\n00:00:12,000 --> 00:00:25,000\nToday we will explore five paraphrasing strategies."}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handlePasteImport}>
                    Phân tích & Nhập dòng phụ đề
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPasteBoxOpen(false)}
                  >
                    Đóng
                  </Button>
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tổng cộng {editing.transcript.length} dòng phụ đề tương tác
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const last = editing.transcript[editing.transcript.length - 1];
                  const nextStart = last ? last.endSec : 0;
                  updateForm({
                    transcript: [
                      ...editing.transcript,
                      {
                        startSec: nextStart,
                        endSec: nextStart + 12,
                        en: "",
                        vi: "",
                      },
                    ],
                  });
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm dòng phụ đề
              </Button>
            </div>

            <div className="space-y-3">
              {editing.transcript.map((line, idx) => (
                <Card key={idx} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge>#{idx + 1}</Badge>
                      <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                        {formatSecondsClock(line.startSec)} → {formatSecondsClock(line.endSec)}
                      </span>
                      <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        Bắt đầu (s):
                        <input
                          type="number"
                          min={0}
                          value={line.startSec}
                          onChange={(e) =>
                            updateLine(idx, {
                              startSec: Number.parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                      <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        Kết thúc (s):
                        <input
                          type="number"
                          min={1}
                          value={line.endSec}
                          onChange={(e) =>
                            updateLine(idx, {
                              endSec: Number.parseInt(e.target.value, 10) || 1,
                            })
                          }
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      disabled={editing.transcript.length <= 1}
                      onClick={() =>
                        updateForm({
                          transcript: editing.transcript.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={line.en}
                      onChange={(e) => updateLine(idx, { en: e.target.value })}
                      placeholder="Phụ đề tiếng Anh (EN)..."
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <input
                      type="text"
                      value={line.vi}
                      onChange={(e) => updateLine(idx, { vi: e.target.value })}
                      placeholder="Bản dịch tiếng Việt (VI)..."
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SEO */}
        {activeTab === "seo" && (
          <SeoPanel
            seoMeta={editing.seo_meta}
            onChange={(seo_meta) => updateForm({ seo_meta })}
            fallbackTitle={editing.title_vi}
            fallbackDescription={editing.description_vi}
            slug={editing.slug}
            basePath="/videos"
            contentHtml={`<h2>${editing.title_vi}</h2><p>${editing.description_vi}</p><p>${editing.transcript
              .map((l) => l.en)
              .join(" ")}</p>`}
            coverImageUrl={ytThumb}
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
            Quản lý Video tương tác (YouTube + Phụ đề song ngữ)
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Quản lý video YouTube, nhập phụ đề trực tiếp từ file .SRT / .VTT và tự sinh schema VideoObject chuẩn SEO.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditing(createEmptyVideo());
            setSlugLocked(false);
            setActiveTab("info");
            setDirty(false);
          }}
        >
          <Plus className="h-4 w-4" />
          Thêm Video mới
        </Button>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên video, YouTube ID, trình độ..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950"
          />
        </div>
        <Badge variant="secondary">{filteredItems.length} video</Badge>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((video) => (
          <Card key={video.id} className="flex flex-col justify-between overflow-hidden">
            <div>
              <div className="relative aspect-video bg-slate-900">
                <img
                  src={`https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`}
                  alt={video.title_vi}
                  className="h-full w-full object-cover opacity-90"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/90 text-white shadow-lg">
                    <Play className="h-5 w-5 fill-current pl-0.5" />
                  </span>
                </div>
                <span className="absolute left-3 top-3 flex gap-1.5">
                  <Badge variant={video.is_published === false ? "secondary" : "default"}>
                    {video.is_published === false ? "Nháp" : "Đang hiện"}
                  </Badge>
                  <Badge variant="secondary">{video.level}</Badge>
                </span>
                <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-0.5 text-[11px] font-bold text-white">
                  {video.duration_label}
                </span>
              </div>

              <div className="p-5 space-y-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {video.title_vi}
                </h2>
                <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                  {video.description_vi}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Video className="h-3.5 w-3.5" />
                  <span className="font-mono">{video.youtube_id}</span>
                  <span>· {video.transcript.length} dòng phụ đề</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditing(videoToForm(video));
                    setSlugLocked(true);
                    setActiveTab("info");
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
                  onClick={() => handleDuplicate(video)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Link
                  href={`/videos/${video.slug}?preview=1`}
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
                onClick={() => setDeleteTarget(video)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa Video tương tác?"
        description={`Video "${deleteTarget?.title_vi ?? ""}" và toàn bộ phụ đề song ngữ sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa Video"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
