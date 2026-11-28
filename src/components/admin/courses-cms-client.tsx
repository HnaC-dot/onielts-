"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Copy,
  ExternalLink,
  GripVertical,
  Headphones,
  Image as ImageIcon,
  Layers,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import type { CourseItem, MediaAsset, SeoMeta } from "@/lib/types";
import { slugifyVi } from "@/lib/seo";
import { auditHeadingStructure } from "@/lib/heading-typography";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { MediaPickerModal } from "./media-picker-modal";
import { RichTextEditor } from "./rich-text-editor";
import { SeoPanel } from "./seo-panel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

let courseUidSeq = 0;
function nextLessonUid(): string {
  courseUidSeq += 1;
  return `lesson-${courseUidSeq}`;
}

type LessonForm = {
  id: string;
  title_vi: string;
  title_en: string;
  duration_min: number;
  content_vi: string;
  content_en: string;
  videoUrl: string;
  audioUrl: string;
  keyTakeaways: string[];
  hasQuiz: boolean;
  quizQuestion: string;
  quizOptions: string[];
  quizCorrectIndex: number;
  quizExplanationVi: string;
};

type CourseFormState = {
  id?: string;
  slug: string;
  title_vi: string;
  title_en: string;
  description_vi: string;
  description_en: string;
  level: string;
  target_band: string;
  cover_image_url: string;
  is_published: boolean;
  is_premium: boolean;
  sort_order: number;
  seo_meta: SeoMeta;
  lessons: LessonForm[];
};

function createEmptyLesson(index: number): LessonForm {
  return {
    id: nextLessonUid(),
    title_vi: `Bài ${index}: Tiêu đề bài học mới`,
    title_en: `Lesson ${index}: New Lesson`,
    duration_min: 20,
    content_vi: "<p>Nhập nội dung kiến thức chi tiết cho bài học tại đây...</p>",
    content_en: "",
    videoUrl: "",
    audioUrl: "",
    keyTakeaways: ["Điểm ghi nhớ quan trọng #1"],
    hasQuiz: false,
    quizQuestion: "",
    quizOptions: ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    quizCorrectIndex: 0,
    quizExplanationVi: "",
  };
}

function createEmptyCourse(): CourseFormState {
  return {
    slug: "",
    title_vi: "",
    title_en: "",
    description_vi: "",
    description_en: "",
    level: "Cơ bản – Trung cấp",
    target_band: "6.5+",
    cover_image_url: "",
    is_published: false,
    is_premium: false,
    sort_order: 0,
    seo_meta: {},
    lessons: [createEmptyLesson(1)],
  };
}

function courseToForm(c: CourseItem): CourseFormState {
  return {
    id: c.id,
    slug: c.slug,
    title_vi: c.title_vi,
    title_en: c.title_en,
    description_vi: c.description_vi,
    description_en: c.description_en,
    level: c.level,
    target_band: c.target_band,
    cover_image_url: c.cover_image_url ?? "",
    is_published: c.is_published,
    is_premium: Boolean(c.is_premium),
    sort_order: c.sort_order ?? 0,
    seo_meta: c.seo_meta ?? {},
    lessons:
      c.lessons.length > 0
        ? c.lessons.map((l) => ({
            id: l.id || nextLessonUid(),
            title_vi: l.title_vi,
            title_en: l.title_en || "",
            duration_min: l.duration_min || 20,
            content_vi: l.content_vi || "",
            content_en: l.content_en || "",
            videoUrl: l.videoUrl || "",
            audioUrl: l.audioUrl || "",
            keyTakeaways: l.keyTakeaways?.length ? l.keyTakeaways : [],
            hasQuiz: Boolean(l.quiz?.question),
            quizQuestion: l.quiz?.question ?? "",
            quizOptions:
              l.quiz?.options && l.quiz.options.length >= 2
                ? l.quiz.options
                : ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
            quizCorrectIndex: l.quiz?.correctIndex ?? 0,
            quizExplanationVi: l.quiz?.explanation_vi ?? "",
          }))
        : [createEmptyLesson(1)],
  };
}

export function CoursesCmsClient({
  initialItems,
}: {
  initialItems: CourseItem[];
}) {
  const toast = useAdminToast();
  const [items, setItems] = useState<CourseItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");
  const [editing, setEditing] = useState<CourseFormState | null>(null);
  const [activeLessonIdx, setActiveLessonIdx] = useState(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [slugLocked, setSlugLocked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<"info" | "lessons" | "seo">("info");

  // Media picker states
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);

  // Confirm delete state
  const [deleteTarget, setDeleteTarget] = useState<CourseItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishHeadingWarnings, setPublishHeadingWarnings] = useState<string[] | null>(null);

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
    return items.filter((item) => {
      if (statusFilter === "true" && !item.is_published) return false;
      if (statusFilter === "false" && item.is_published) return false;
      if (q) {
        const hay = `${item.title_vi} ${item.title_en} ${item.slug} ${item.level} ${item.target_band}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter]);

  const reloadItems = async () => {
    const res = await fetch("/api/admin/learning/courses?pageSize=100");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  };

  const openCreate = () => {
    setEditing(createEmptyCourse());
    setActiveLessonIdx(0);
    setSlugLocked(false);
    setEditorTab("info");
    setDirty(false);
  };

  const openEdit = (course: CourseItem) => {
    setEditing(courseToForm(course));
    setActiveLessonIdx(0);
    setSlugLocked(true);
    setEditorTab("info");
    setDirty(false);
  };

  const updateForm = (patch: Partial<CourseFormState>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const updateLesson = (idx: number, patch: Partial<LessonForm>) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = [...prev.lessons];
      if (!next[idx]) return prev;
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, lessons: next };
    });
    setDirty(true);
  };

  const addLesson = () => {
    if (!editing) return;
    const nextLessons = [...editing.lessons, createEmptyLesson(editing.lessons.length + 1)];
    updateForm({ lessons: nextLessons });
    setActiveLessonIdx(nextLessons.length - 1);
  };

  const removeLesson = (idx: number) => {
    if (!editing || editing.lessons.length <= 1) {
      toast.info("Khóa học cần có ít nhất 1 bài học.");
      return;
    }
    const nextLessons = editing.lessons.filter((_, i) => i !== idx);
    updateForm({ lessons: nextLessons });
    setActiveLessonIdx(Math.max(0, Math.min(activeLessonIdx, nextLessons.length - 1)));
  };

  const moveLesson = (fromIdx: number, toIdx: number) => {
    if (!editing) return;
    if (toIdx < 0 || toIdx >= editing.lessons.length || fromIdx === toIdx) return;
    const next = [...editing.lessons];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    updateForm({ lessons: next });
    setActiveLessonIdx(toIdx);
  };

  const handleSave = async (bypassHeadingWarning = false) => {
    if (!editing) return;

    if (editing.is_published && !bypassHeadingWarning) {
      const allWarnings: string[] = [];
      editing.lessons.forEach((lesson, idx) => {
        const audit = auditHeadingStructure(lesson.content_vi);
        for (const w of audit.warnings) {
          allWarnings.push(`Bài ${idx + 1} (${lesson.title_vi || `#${idx + 1}`}): ${w}`);
        }
      });
      if (allWarnings.length > 0) {
        setPublishHeadingWarnings(allWarnings);
        return;
      }
    }

    setPublishHeadingWarnings(null);
    setSaving(true);
    try {
      const payload = {
        slug: editing.slug || slugifyVi(editing.title_vi),
        title_vi: editing.title_vi,
        title_en: editing.title_en || editing.title_vi,
        description_vi: editing.description_vi,
        description_en: editing.description_en || editing.description_vi,
        level: editing.level,
        target_band: editing.target_band,
        cover_image_url: editing.cover_image_url || null,
        is_published: editing.is_published,
        is_premium: editing.is_premium,
        sort_order: Number(editing.sort_order) || 0,
        seo_meta: editing.seo_meta,
        lessons: editing.lessons.map((l) => ({
          id: l.id,
          title_vi: l.title_vi,
          title_en: l.title_en || l.title_vi,
          duration_min: Math.max(1, Number(l.duration_min) || 15),
          content_vi: l.content_vi,
          content_en: l.content_en || l.content_vi,
          videoUrl: l.videoUrl.trim(),
          audioUrl: l.audioUrl.trim(),
          keyTakeaways: l.keyTakeaways.map((k) => k.trim()).filter(Boolean),
          quiz:
            l.hasQuiz && l.quizQuestion.trim()
              ? {
                  question: l.quizQuestion.trim(),
                  options: l.quizOptions.map((o) => o.trim()).filter(Boolean),
                  correctIndex: l.quizCorrectIndex,
                  explanation_vi: l.quizExplanationVi.trim(),
                }
              : null,
        })),
      };

      const isEdit = Boolean(editing.id);
      const url = isEdit
        ? `/api/admin/learning/courses/${editing.id}`
        : "/api/admin/learning/courses";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể lưu khóa học.");
        return;
      }

      toast.success(
        isEdit
          ? data.redirectCreated
            ? "Đã lưu khóa học và tự tạo Redirect 301 cho slug cũ!"
            : "Đã cập nhật khóa học thành công!"
          : "Đã tạo khóa học mới thành công!"
      );
      setDirty(false);
      await reloadItems();
      setEditing(courseToForm(data.item));
      setSlugLocked(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (course: CourseItem) => {
    const res = await fetch(`/api/admin/learning/courses/${course.id}`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Không thể nhân bản khóa học.");
      return;
    }
    toast.success("Đã nhân bản khóa học thành bản nháp!");
    await reloadItems();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/learning/courses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Xóa khóa học thất bại.");
        return;
      }
      toast.success(`Đã xóa khóa học "${deleteTarget.title_vi}".`);
      setDeleteTarget(null);
      await reloadItems();
    } finally {
      setDeleting(false);
    }
  };

  // =========================================================================
  // EDITOR VIEW
  // =========================================================================
  if (editing) {
    const activeLesson = editing.lessons[activeLessonIdx] ?? editing.lessons[0];
    const combinedHtmlForSeo = editing.lessons
      .map((l) => `<h2>${l.title_vi}</h2> ${l.content_vi}`)
      .join(" ");

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (dirty && !window.confirm("Bạn có thay đổi chưa lưu. Rời khỏi trang sửa?")) {
                  return;
                }
                setEditing(null);
                setDirty(false);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Danh sách khóa học
            </Button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {editing.id ? "Chỉnh sửa Khóa học" : "Tạo Khóa học mới"}
              </h1>
              <p className="text-xs text-slate-500">
                {editing.lessons.length} bài học ·{" "}
                {editing.is_published ? "Đang xuất bản" : "Bản nháp"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editing.slug && (
              <Link
                href={`/courses/${editing.slug}?preview=1`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Xem trước
              </Link>
            )}
            <Button type="button" size="sm" disabled={saving} onClick={() => void handleSave(false)}>
              <Save className="h-4 w-4" />
              {saving ? "Đang lưu..." : "Lưu khóa học"}
            </Button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          {[
            { id: "info" as const, label: "1. Thông tin & Ảnh bìa" },
            { id: "lessons" as const, label: `2. Danh sách bài học (${editing.lessons.length})` },
            { id: "seo" as const, label: "3. SEO & Xem trước Google/FB" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setEditorTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                editorTab === tab.id
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: METADATA */}
        {editorTab === "info" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tên khóa học (Tiếng Việt) *
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
                    placeholder="VD: Lộ trình Nền tảng IELTS 5.0 → 6.5"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tên khóa học (Tiếng Anh)
                  </label>
                  <input
                    type="text"
                    value={editing.title_en}
                    onChange={(e) => updateForm({ title_en: e.target.value })}
                    placeholder="IELTS Foundation Roadmap"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Đường dẫn Slug (/courses/...) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editing.slug}
                    onChange={(e) => {
                      setSlugLocked(true);
                      updateForm({ slug: e.target.value });
                    }}
                    placeholder="nen-tang-ielts-5-0-den-6-5"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateForm({ slug: slugifyVi(editing.title_vi) })}
                  >
                    Tạo tự động
                  </Button>
                </div>
                {editing.id && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Khi đổi slug của khóa học đang hoạt động, hệ thống sẽ tự tạo Redirect 301 giữ nguyên thứ hạng SEO.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Trình độ (Level)
                  </label>
                  <input
                    type="text"
                    value={editing.level}
                    onChange={(e) => updateForm({ level: e.target.value })}
                    placeholder="Cơ bản – Trung cấp"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mục tiêu Band
                  </label>
                  <input
                    type="text"
                    value={editing.target_band}
                    onChange={(e) => updateForm({ target_band: e.target.value })}
                    placeholder="6.5+"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
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
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mô tả khóa học (Tiếng Việt) *
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
                  Mô tả khóa học (Tiếng Anh)
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
              <Card className="p-5 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Trạng thái & Quyền truy cập
                </h2>
                <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800 cursor-pointer">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Xuất bản công khai</p>
                    <p className="text-[11px] text-slate-500">Hiển thị trên /courses và Trang chủ</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editing.is_published}
                    onChange={(e) => updateForm({ is_published: e.target.checked })}
                    className="h-4 w-4 accent-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800 cursor-pointer">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Khóa học Premium</p>
                    <p className="text-[11px] text-slate-500">Gắn nhãn dành cho hội viên Premium</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editing.is_premium}
                    onChange={(e) => updateForm({ is_premium: e.target.checked })}
                    className="h-4 w-4 accent-emerald-600"
                  />
                </label>
              </Card>

              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Ảnh bìa Khóa học
                  </h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCoverPickerOpen(true)}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Chọn ảnh
                  </Button>
                </div>
                {editing.cover_image_url ? (
                  <div className="space-y-2">
                    <img
                      src={editing.cover_image_url}
                      alt={editing.title_vi}
                      className="h-40 w-full rounded-xl border border-slate-200 object-cover dark:border-slate-800"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full text-red-600"
                      onClick={() => updateForm({ cover_image_url: "" })}
                    >
                      Gỡ ảnh bìa
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700">
                    Chưa chọn ảnh bìa
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: LESSONS WITH DRAG-AND-DROP ORDERING */}
        {editorTab === "lessons" && activeLesson && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Draggable Lesson List */}
            <Card className="p-4 lg:col-span-4 space-y-3 h-fit">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Thứ tự bài học
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Kéo thả hoặc dùng nút ▲ ▼ để đổi thứ tự
                  </p>
                </div>
                <Button type="button" size="sm" onClick={addLesson}>
                  <Plus className="h-3.5 w-3.5" />
                  Thêm bài
                </Button>
              </div>

              <div className="space-y-2">
                {editing.lessons.map((lesson, idx) => {
                  const selected = idx === activeLessonIdx;
                  return (
                    <div
                      key={lesson.id}
                      draggable
                      onDragStart={() => setDragIdx(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIdx !== null && dragIdx !== idx) {
                          moveLesson(dragIdx, idx);
                        }
                        setDragIdx(null);
                      }}
                      onDragEnd={() => setDragIdx(null)}
                      onClick={() => setActiveLessonIdx(idx)}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs transition cursor-pointer ${
                        selected
                          ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950"
                      } ${dragIdx === idx ? "opacity-50" : ""}`}
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-slate-400 cursor-grab" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-slate-900 dark:text-white">
                          {idx + 1}. {lesson.title_vi || "Bài học chưa đặt tên"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {lesson.duration_min} phút
                          {lesson.hasQuiz ? " · Có Quiz" : ""}
                          {lesson.videoUrl ? " · Video" : ""}
                          {lesson.audioUrl ? " · Audio" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          aria-label="Chuyển lên"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLesson(idx, idx - 1);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Chuyển xuống"
                          disabled={idx === editing.lessons.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLesson(idx, idx + 1);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Xóa bài học"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLesson(idx);
                          }}
                          className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Active Lesson Editor */}
            <Card className="p-5 lg:col-span-8 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Đang soạn: Bài #{activeLessonIdx + 1}
                </h2>
                <Badge variant="secondary">ID: {activeLesson.id}</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tiêu đề bài học (VI) *
                  </label>
                  <input
                    type="text"
                    value={activeLesson.title_vi}
                    onChange={(e) =>
                      updateLesson(activeLessonIdx, { title_vi: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Thời lượng (phút)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={activeLesson.duration_min}
                    onChange={(e) =>
                      updateLesson(activeLessonIdx, {
                        duration_min: Number.parseInt(e.target.value, 10) || 15,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tiêu đề bài học (EN)
                </label>
                <input
                  type="text"
                  value={activeLesson.title_en}
                  onChange={(e) =>
                    updateLesson(activeLessonIdx, { title_en: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              {/* Optional Lesson Video & Audio */}
              <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Video className="h-3.5 w-3.5 text-emerald-600" />
                    Link Video YouTube bài giảng (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={activeLesson.videoUrl}
                    onChange={(e) =>
                      updateLesson(activeLessonIdx, { videoUrl: e.target.value })
                    }
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Headphones className="h-3.5 w-3.5 text-emerald-600" />
                    File Audio bài giảng MP3 (tùy chọn)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={activeLesson.audioUrl}
                      onChange={(e) =>
                        updateLesson(activeLessonIdx, { audioUrl: e.target.value })
                      }
                      placeholder="/audio/... hoặc chọn từ Media"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAudioPickerOpen(true)}
                    >
                      Chọn MP3
                    </Button>
                  </div>
                </div>
              </div>

              {/* Rich Text Lesson Content */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nội dung bài học (Rich Text — hỗ trợ định dạng, bảng, ảnh, YouTube) *
                </label>
                <RichTextEditor
                  key={activeLesson.id}
                  preset="course"
                  value={activeLesson.content_vi}
                  onChange={(html) =>
                    updateLesson(activeLessonIdx, { content_vi: html })
                  }
                  placeholder="Soạn nội dung chi tiết cho bài học..."
                />
              </div>

              {/* Key Takeaways */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Điểm ghi nhớ cốt lõi (Key Takeaways)
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateLesson(activeLessonIdx, {
                        keyTakeaways: [...activeLesson.keyTakeaways, ""],
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm ý
                  </Button>
                </div>
                {activeLesson.keyTakeaways.map((item, kIdx) => (
                  <div key={kIdx} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const next = [...activeLesson.keyTakeaways];
                        next[kIdx] = e.target.value;
                        updateLesson(activeLessonIdx, { keyTakeaways: next });
                      }}
                      placeholder={`Điểm ghi nhớ #${kIdx + 1}`}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateLesson(activeLessonIdx, {
                          keyTakeaways: activeLesson.keyTakeaways.filter(
                            (_, i) => i !== kIdx
                          ),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* End-of-lesson Quiz */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3 dark:border-slate-800">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    Bài kiểm tra nhanh cuối bài (Checkpoint Quiz)
                  </span>
                  <input
                    type="checkbox"
                    checked={activeLesson.hasQuiz}
                    onChange={(e) =>
                      updateLesson(activeLessonIdx, { hasQuiz: e.target.checked })
                    }
                    className="h-4 w-4 accent-emerald-600"
                  />
                </label>

                {activeLesson.hasQuiz && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Câu hỏi
                      </label>
                      <input
                        type="text"
                        value={activeLesson.quizQuestion}
                        onChange={(e) =>
                          updateLesson(activeLessonIdx, {
                            quizQuestion: e.target.value,
                          })
                        }
                        placeholder="Nhập câu hỏi kiểm tra kiến thức cuối bài..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-500">
                        Các phương án trả lời (chọn chấm tròn cho đáp án đúng):
                      </p>
                      {activeLesson.quizOptions.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`quiz-correct-${activeLesson.id}`}
                            checked={activeLesson.quizCorrectIndex === oIdx}
                            onChange={() =>
                              updateLesson(activeLessonIdx, {
                                quizCorrectIndex: oIdx,
                              })
                            }
                            className="h-4 w-4 accent-emerald-600"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const next = [...activeLesson.quizOptions];
                              next[oIdx] = e.target.value;
                              updateLesson(activeLessonIdx, { quizOptions: next });
                            }}
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                          />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Giải thích đáp án (VI)
                      </label>
                      <textarea
                        rows={2}
                        value={activeLesson.quizExplanationVi}
                        onChange={(e) =>
                          updateLesson(activeLessonIdx, {
                            quizExplanationVi: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: SEO PANEL */}
        {editorTab === "seo" && (
          <SeoPanel
            seoMeta={editing.seo_meta}
            onChange={(seo_meta) => updateForm({ seo_meta })}
            fallbackTitle={editing.title_vi}
            fallbackDescription={editing.description_vi}
            slug={editing.slug}
            basePath="/courses"
            contentHtml={combinedHtmlForSeo}
            coverImageUrl={editing.cover_image_url}
          />
        )}

        <MediaPickerModal
          open={coverPickerOpen}
          onClose={() => setCoverPickerOpen(false)}
          acceptKind="image"
          defaultFolder="courses"
          title="Chọn ảnh bìa Khóa học"
          onSelect={(asset: MediaAsset) => {
            updateForm({ cover_image_url: asset.public_url });
            setCoverPickerOpen(false);
          }}
        />

        <MediaPickerModal
          open={audioPickerOpen}
          onClose={() => setAudioPickerOpen(false)}
          acceptKind="audio"
          defaultFolder="courses"
          title="Chọn file Audio MP3 cho bài học"
          onSelect={(asset: MediaAsset) => {
            updateLesson(activeLessonIdx, { audioUrl: asset.public_url });
            setAudioPickerOpen(false);
          }}
        />

        <ConfirmDialog
          open={Boolean(publishHeadingWarnings && publishHeadingWarnings.length > 0)}
          title="Cảnh báo cấu trúc tiêu đề bài học (SEO & Accessibility)"
          description={
            publishHeadingWarnings
              ? `Phát hiện vấn đề phân cấp tiêu đề trước khi xuất bản khóa học: ${publishHeadingWarnings.join(" • ")}`
              : ""
          }
          confirmLabel="Vẫn lưu & Xuất bản"
          cancelLabel="Quay lại sửa"
          destructive={false}
          loading={saving}
          onCancel={() => setPublishHeadingWarnings(null)}
          onConfirm={() => void handleSave(true)}
        />
      </div>
    );
  }

  // =========================================================================
  // LIST VIEW
  // =========================================================================
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quản lý Khóa học & Bài học
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Tạo khóa học theo lộ trình, sắp xếp bài học kéo-thả, soạn thảo Rich Text, gắn Video/Audio & Quiz cuối bài.
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Tạo khóa học mới
        </Button>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên khóa học, slug, mục tiêu band..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | "true" | "false")}
          aria-label="Lọc trạng thái"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đã xuất bản</option>
          <option value="false">Bản nháp</option>
        </select>
        <Badge variant="secondary">{filteredItems.length} khóa học</Badge>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((course) => (
          <Card key={course.id} className="flex flex-col justify-between overflow-hidden">
            <div>
              {course.cover_image_url ? (
                <img
                  src={course.cover_image_url}
                  alt={course.title_vi}
                  className="h-36 w-full object-cover border-b border-slate-100 dark:border-slate-800"
                />
              ) : (
                <div className="flex h-24 items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 px-5 text-white">
                  <Layers className="h-7 w-7 opacity-80" />
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">
                    Target {course.target_band}
                  </span>
                </div>
              )}

              <div className="p-5 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={course.is_published ? "default" : "secondary"}>
                    {course.is_published ? "Đã đăng" : "Bản nháp"}
                  </Badge>
                  {course.is_premium && <Badge variant="amber">Premium</Badge>}
                  <Badge variant="secondary">
                    <BookOpen className="mr-1 h-3 w-3" />
                    {course.lessons.length} bài
                  </Badge>
                </div>

                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {course.title_vi}
                </h2>
                <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                  {course.description_vi}
                </p>
                <p className="font-mono text-[11px] text-slate-400">
                  /courses/{course.slug}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-1.5">
                <Button type="button" size="sm" onClick={() => openEdit(course)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Sửa
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  title="Nhân bản thành bản nháp"
                  onClick={() => handleDuplicate(course)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Link
                  href={`/courses/${course.slug}?preview=1`}
                  target="_blank"
                  title="Xem trang công khai"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => setDeleteTarget(course)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa khóa học?"
        description={`Khóa học "${deleteTarget?.title_vi ?? ""}" và toàn bộ danh sách bài học bên trong sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa khóa học"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
