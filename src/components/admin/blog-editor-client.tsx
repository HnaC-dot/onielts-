"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Crown,
  ExternalLink,
  Image as ImageIcon,
  RotateCcw,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import type { BlogPost, ContentPublishStatus, SeoMeta } from "@/lib/types";
import {
  BLOG_CATEGORIES,
  blogPostFormSchema,
  resolveBlogStatus,
} from "@/lib/blog-shared";
import {
  DEFAULT_BLOG_QUALITY_CONFIG,
  evaluateBlogQualityGate,
  type BlogArticleTemplate,
  type BlogQualityConfig,
  type InternalLinkCandidate,
} from "@/lib/content-production-shared";
import { escapeHtml } from "@/lib/sanitize";
import { slugifyVi } from "@/lib/seo";
import { RichTextEditor } from "./rich-text-editor";
import { SeoPanel } from "./seo-panel";
import { MediaPickerModal } from "./media-picker-modal";
import { ConfirmDialog } from "./confirm-dialog";
import {
  BlogQualityGatePanel,
  BlogTemplatePicker,
  InternalLinkSuggestionsPanel,
} from "./blog-production-panels";
import { useAdminToast } from "./toast-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BlogEditorClientProps {
  initialPost?: BlogPost | null;
  defaultAuthor?: string;
  initialQualityConfig?: BlogQualityConfig;
  linkCatalog?: InternalLinkCandidate[];
  canEditQualityConfig?: boolean;
}

function toVietnamLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

function vietnamLocalInputToIso(localVal: string): string | null {
  if (!localVal.trim()) return null;
  const parsed = new Date(`${localVal}:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function BlogEditorClient({
  initialPost,
  defaultAuthor = "Đội ngũ học thuật Ôn IELTS",
  initialQualityConfig = DEFAULT_BLOG_QUALITY_CONFIG,
  linkCatalog = [],
  canEditQualityConfig = false,
}: BlogEditorClientProps) {
  const router = useRouter();
  const toast = useAdminToast();
  const isEdit = Boolean(initialPost);
  const draftStorageKey = `onielts_cms_blog_draft_${initialPost?.id ?? "new"}`;

  const [titleVi, setTitleVi] = useState(initialPost?.title_vi ?? "");
  const [titleEn, setTitleEn] = useState(initialPost?.title_en ?? "");
  const [slug, setSlug] = useState(initialPost?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialPost));
  const [excerptVi, setExcerptVi] = useState(initialPost?.excerpt_vi ?? "");
  const [excerptEn, setExcerptEn] = useState(initialPost?.excerpt_en ?? "");
  const [contentVi, setContentVi] = useState(initialPost?.content_vi ?? "");
  const [contentEn, setContentEn] = useState(initialPost?.content_en ?? "");
  const [showEnFields, setShowEnFields] = useState(false);

  const [category, setCategory] = useState<string>(
    initialPost?.category ?? BLOG_CATEGORIES[6]
  );
  const [authorName, setAuthorName] = useState(
    initialPost?.author_name ?? defaultAuthor
  );
  const [readMinutes, setReadMinutes] = useState<number>(
    initialPost?.read_minutes ?? 5
  );
  const [status, setStatus] = useState<ContentPublishStatus>(
    initialPost ? resolveBlogStatus(initialPost) : "draft"
  );
  const [scheduledLocal, setScheduledLocal] = useState(
    toVietnamLocalInputValue(initialPost?.scheduled_at)
  );
  const [isFeatured, setIsFeatured] = useState(Boolean(initialPost?.is_featured));
  const [isPremium, setIsPremium] = useState(Boolean(initialPost?.is_premium));
  const [tagsText, setTagsText] = useState((initialPost?.tags ?? []).join(", "));
  const [coverImageUrl, setCoverImageUrl] = useState(
    initialPost?.cover_image_url ?? ""
  );
  const [seoMeta, setSeoMeta] = useState<SeoMeta>(initialPost?.seo_meta ?? {});

  const [qualityConfig, setQualityConfig] =
    useState<BlogQualityConfig>(initialQualityConfig);
  const [pendingPublishStatus, setPendingPublishStatus] =
    useState<ContentPublishStatus | null>(null);

  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  const [restorableDraft, setRestorableDraft] = useState<Record<string, unknown> | null>(
    null
  );

  const parsedTags = useMemo(
    () =>
      tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsText]
  );

  const qualityReport = useMemo(
    () =>
      evaluateBlogQualityGate(
        {
          title: titleVi,
          excerpt: excerptVi,
          contentHtml: contentVi,
          coverImageUrl,
          seoMeta,
        },
        qualityConfig
      ),
    [titleVi, excerptVi, contentVi, coverImageUrl, seoMeta, qualityConfig]
  );

  // Check for previously auto-saved local draft on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.savedAt) {
          queueMicrotask(() => setRestorableDraft(parsed));
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [draftStorageKey]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Debounced auto-save to localStorage whenever user edits
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      try {
        const snapshot = {
          titleVi,
          titleEn,
          slug,
          excerptVi,
          excerptEn,
          contentVi,
          contentEn,
          category,
          authorName,
          readMinutes,
          status,
          scheduledLocal,
          isFeatured,
          isPremium,
          tagsText,
          coverImageUrl,
          seoMeta,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
        setAutoSavedAt(
          new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch {
        // ignore quota errors
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    draftStorageKey,
    titleVi,
    titleEn,
    slug,
    excerptVi,
    excerptEn,
    contentVi,
    contentEn,
    category,
    authorName,
    readMinutes,
    status,
    scheduledLocal,
    isFeatured,
    isPremium,
    tagsText,
    coverImageUrl,
    seoMeta,
  ]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const restoreLocalDraft = () => {
    if (!restorableDraft) return;
    setTitleVi(String(restorableDraft.titleVi ?? ""));
    setTitleEn(String(restorableDraft.titleEn ?? ""));
    setSlug(String(restorableDraft.slug ?? ""));
    setExcerptVi(String(restorableDraft.excerptVi ?? ""));
    setExcerptEn(String(restorableDraft.excerptEn ?? ""));
    setContentVi(String(restorableDraft.contentVi ?? ""));
    setContentEn(String(restorableDraft.contentEn ?? ""));
    setCategory(String(restorableDraft.category ?? BLOG_CATEGORIES[6]));
    setAuthorName(String(restorableDraft.authorName ?? defaultAuthor));
    setReadMinutes(Number(restorableDraft.readMinutes ?? 5));
    setStatus(
      (restorableDraft.status as ContentPublishStatus) ?? "draft"
    );
    setScheduledLocal(String(restorableDraft.scheduledLocal ?? ""));
    setIsFeatured(Boolean(restorableDraft.isFeatured));
    setIsPremium(Boolean(restorableDraft.isPremium));
    setTagsText(String(restorableDraft.tagsText ?? ""));
    setCoverImageUrl(String(restorableDraft.coverImageUrl ?? ""));
    setSeoMeta((restorableDraft.seoMeta as SeoMeta) ?? {});
    setRestorableDraft(null);
    setIsDirty(true);
    toast.info("Đã khôi phục bản nháp tự lưu gần nhất.");
  };

  const handleApplyTemplate = (template: BlogArticleTemplate) => {
    if (
      contentVi.trim().length > 40 &&
      !window.confirm(
        `Áp dụng mẫu "${template.nameVi}" sẽ thay thế nội dung hiện tại trong khung soạn thảo. Bạn có muốn tiếp tục?`
      )
    ) {
      return;
    }
    setContentVi(template.contentHtml);
    if (!titleVi.trim()) {
      setTitleVi(template.suggestedTitle);
      if (!slugTouched) setSlug(slugifyVi(template.suggestedTitle));
    }
    if (!excerptVi.trim()) {
      setExcerptVi(template.suggestedExcerpt);
    }
    if (!tagsText.trim()) {
      setTagsText(template.defaultTags.join(", "));
    }
    if (!seoMeta.primaryKeyword?.trim()) {
      setSeoMeta((prev) => ({
        ...prev,
        primaryKeyword: template.suggestedPrimaryKeyword,
      }));
    }
    setCategory(template.defaultCategory);
    markDirty();
    toast.success(
      `Đã chèn mẫu "${template.nameVi}" kèm khung tiêu đề, FAQ và Box Bài tập luyện thêm.`
    );
  };

  const handleInsertInternalLink = (item: InternalLinkCandidate) => {
    const snippet = `<p>👉 Luyện tập liên quan: <a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a></p>`;
    setContentVi((prev) => (prev.trim() ? `${prev}\n${snippet}` : snippet));
    markDirty();
    toast.success(`Đã chèn link nội bộ tới "${item.title}".`);
  };

  const handleSaveQualityConfig = async (nextConfig: BlogQualityConfig) => {
    const res = await fetch("/api/admin/content/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextConfig),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Không thể lưu tiêu chuẩn xuất bản.");
      return;
    }
    setQualityConfig(data.qualityConfig);
    toast.success(
      `Đã cập nhật tiêu chuẩn: tối thiểu ${data.qualityConfig.minWordCount} từ & ${data.qualityConfig.minInternalLinks} link nội bộ.`
    );
  };

  const handleSave = async (
    overrideStatus?: ContentPublishStatus,
    skipQualityCheck = false
  ) => {
    setValidationError("");
    const effectiveStatus = overrideStatus ?? status;
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title_vi: titleVi,
      title_en: titleEn || titleVi,
      slug: slug || slugifyVi(titleVi),
      excerpt_vi: excerptVi,
      excerpt_en: excerptEn || excerptVi,
      content_vi: contentVi,
      content_en: contentEn || contentVi,
      category,
      author_name: authorName,
      read_minutes: readMinutes,
      status: effectiveStatus,
      scheduled_at:
        effectiveStatus === "scheduled"
          ? vietnamLocalInputToIso(scheduledLocal)
          : null,
      is_featured: isFeatured,
      is_premium: isPremium,
      tags,
      cover_image_url: coverImageUrl.trim() || null,
      seo_meta: seoMeta,
    };

    const parsed = blogPostFormSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Vui lòng kiểm tra lại các trường bắt buộc.";
      setValidationError(msg);
      toast.error(msg);
      return;
    }

    if (effectiveStatus === "scheduled" && !payload.scheduled_at) {
      const msg = "Vui lòng chọn ngày & giờ (giờ Việt Nam) khi lên lịch đăng.";
      setValidationError(msg);
      toast.error(msg);
      return;
    }

    if (
      !skipQualityCheck &&
      (effectiveStatus === "published" || effectiveStatus === "scheduled") &&
      !qualityReport.passed
    ) {
      setPendingPublishStatus(effectiveStatus);
      return;
    }

    setPendingPublishStatus(null);
    setSaving(true);
    try {
      const endpoint = isEdit
        ? `/api/admin/blog/${initialPost!.id}`
        : "/api/admin/blog";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || "Lưu bài viết thất bại.");
        toast.error(data.error || "Lưu bài viết thất bại.");
        return;
      }

      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore
      }
      setIsDirty(false);
      setStatus(effectiveStatus);

      if (data.redirectCreated) {
        toast.success(
          `Đã lưu bài viết và tự động tạo Redirect 301 (${data.redirectCreated.from} → ${data.redirectCreated.to}).`
        );
      } else {
        toast.success(
          effectiveStatus === "published"
            ? "Đã xuất bản bài viết thành công!"
            : effectiveStatus === "scheduled"
            ? "Đã lưu lịch đăng bài viết!"
            : "Đã lưu bản nháp thành công!"
        );
      }

      if (!isEdit && data.post?.id) {
        router.push(`/admin/blog/${data.post.id}`);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialPost) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/blog/${initialPost.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Xóa bài viết thất bại.");
        return;
      }
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore
      }
      setIsDirty(false);
      toast.success("Đã xóa bài viết.");
      router.push("/admin/blog");
      router.refresh();
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const slugChanged = Boolean(isEdit && initialPost && slug && slug !== initialPost.slug);

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/blog"
            onClick={(e) => {
              if (
                isDirty &&
                !window.confirm("Bạn có thay đổi chưa lưu. Vẫn rời khỏi trang?")
              ) {
                e.preventDefault();
              }
            }}
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Danh sách Blog &amp; Mẹo thi
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isEdit ? "Chỉnh sửa bài viết Blog" : "Soạn bài viết Blog mới"}
            </h1>
            {isDirty && <Badge variant="secondary">Chưa lưu</Badge>}
            {autoSavedAt && (
              <span className="text-[11px] text-slate-400">
                Tự lưu nháp cục bộ lúc {autoSavedAt}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEdit && initialPost && (
            <a
              href={
                status === "published"
                  ? `/blog/${slug || initialPost.slug}`
                  : `/blog/${slug || initialPost.slug}?preview=1`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button type="button" size="sm" variant="outline">
                <ExternalLink className="h-3.5 w-3.5" />
                Xem trước
              </Button>
            </a>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => void handleSave("draft")}
          >
            Lưu Nháp
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            <Save className="h-3.5 w-3.5" />
            {saving
              ? "Đang lưu..."
              : status === "published"
              ? "Cập nhật & Đăng"
              : status === "scheduled"
              ? "Lưu lịch đăng"
              : "Lưu bài viết"}
          </Button>
        </div>
      </div>

      {/* Restore Auto-saved Draft Banner */}
      {restorableDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 shrink-0" />
            <span>
              Tìm thấy bản nháp tự lưu trên trình duyệt lúc{" "}
              <strong>
                {new Date(String(restorableDraft.savedAt)).toLocaleString("vi-VN")}
              </strong>
              .
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={restoreLocalDraft}>
              Khôi phục bản nháp
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                try {
                  window.localStorage.removeItem(draftStorageKey);
                } catch {
                  // ignore
                }
                setRestorableDraft(null);
              }}
            >
              Bỏ qua
            </Button>
          </div>
        </div>
      )}

      {validationError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {validationError}
        </div>
      )}

      {/* 2-column CMS Editor Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Column */}
        <div className="lg:col-span-8 space-y-5">
          <BlogTemplatePicker onApplyTemplate={handleApplyTemplate} />

          <Card className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Tiêu đề bài viết (Tiếng Việt) *
              </label>
              <input
                type="text"
                value={titleVi}
                onChange={(e) => {
                  const val = e.target.value;
                  setTitleVi(val);
                  if (!slugTouched) setSlug(slugifyVi(val));
                  markDirty();
                }}
                placeholder="VD: 5 Chiến thuật làm dạng True/False/Not Given đạt 8.0+ IELTS Reading"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800 dark:text-slate-200">
                  Đường dẫn tĩnh (Slug) *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSlug(slugifyVi(titleVi));
                    setSlugTouched(false);
                    markDirty();
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                >
                  Tạo tự động từ tiêu đề
                </button>
              </div>
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs text-slate-400">/blog/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugifyVi(e.target.value));
                    setSlugTouched(true);
                    markDirty();
                  }}
                  placeholder="chien-thuat-true-false-not-given"
                  className="w-full bg-transparent py-2 pl-1 font-mono text-xs text-slate-900 focus:outline-none dark:text-white"
                />
              </div>
              {slugChanged && (
                <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Đổi slug sẽ tự động tạo Redirect 301 từ <code>/blog/{initialPost!.slug}</code> sang <code>/blog/{slug}</code> để giữ nguyên thứ hạng SEO.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Tóm tắt ngắn (Excerpt) *
              </label>
              <textarea
                rows={3}
                value={excerptVi}
                onChange={(e) => {
                  setExcerptVi(e.target.value);
                  markDirty();
                }}
                placeholder="Đoạn mở đầu ngắn gọn (2–3 câu) hiện trên danh sách Blog và dùng làm Meta Description mặc định..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Nội dung bài viết (Rich Text) *
              </label>
              {qualityReport.hasZeroInternalLinks && qualityReport.wordCount >= 10 && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Cảnh báo: Bài viết hiện chưa có link nội bộ nào! Dùng hộp{" "}
                    <strong>Gợi ý Link nội bộ tự động</strong> ở cột phải để chèn nhanh.
                  </span>
                </div>
              )}
              <RichTextEditor
                value={contentVi}
                onChange={(html) => {
                  setContentVi(html);
                  markDirty();
                }}
              />
            </div>

            {/* Optional English translation toggle */}
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEnFields((v) => !v)}
                className="text-xs font-semibold text-slate-600 hover:text-emerald-700 dark:text-slate-400 cursor-pointer"
              >
                {showEnFields
                  ? "− Ẩn phiên bản tiếng Anh (tùy chọn)"
                  : "+ Thêm bản dịch tiếng Anh cho giao diện EN (tùy chọn — để trống sẽ dùng bản VI)"}
              </button>
              {showEnFields && (
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={titleEn}
                    onChange={(e) => {
                      setTitleEn(e.target.value);
                      markDirty();
                    }}
                    placeholder="English Title (optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <textarea
                    rows={2}
                    value={excerptEn}
                    onChange={(e) => {
                      setExcerptEn(e.target.value);
                      markDirty();
                    }}
                    placeholder="English Excerpt (optional)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <RichTextEditor
                    value={contentEn}
                    onChange={(html) => {
                      setContentEn(html);
                      markDirty();
                    }}
                    placeholder="English article content (optional)..."
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Reusable SEO Panel */}
          <SeoPanel
            seoMeta={seoMeta}
            onChange={(next) => {
              setSeoMeta(next);
              markDirty();
            }}
            fallbackTitle={titleVi}
            fallbackDescription={excerptVi}
            slug={slug}
            basePath="/blog"
            contentHtml={contentVi}
            coverImageUrl={coverImageUrl}
          />
        </div>

        {/* Right Sidebar Column */}
        <div className="lg:col-span-4 space-y-5">
          {/* Publishing Settings */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Xuất bản &amp; Phân loại
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Trạng thái
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as ContentPublishStatus);
                  markDirty();
                }}
                aria-label="Trạng thái bài viết"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="draft">Nháp (chỉ Admin/Editor thấy)</option>
                <option value="published">Đã đăng (công khai ngay)</option>
                <option value="scheduled">Lên lịch đăng (giờ VN UTC+7)</option>
              </select>
            </div>

            {status === "scheduled" && (
              <div className="space-y-1.5 rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900 dark:bg-sky-950/30">
                <label className="inline-flex items-center gap-1 text-xs font-semibold text-sky-900 dark:text-sky-200">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Ngày &amp; giờ đăng (UTC+7)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={(e) => {
                    setScheduledLocal(e.target.value);
                    markDirty();
                  }}
                  className="w-full rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-xs dark:border-sky-800 dark:bg-slate-900"
                />
                <p className="text-[10px] text-sky-700 dark:text-sky-300">
                  Bài viết sẽ tự động hiển thị công khai khi đến đúng thời điểm này.
                </p>
              </div>
            )}

            <div className="space-y-2.5 pt-1 text-xs">
              <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer dark:border-slate-800">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                  <Star className="h-4 w-4 text-amber-500" />
                  Bài viết Nổi bật (hiện ở Trang chủ)
                </span>
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => {
                    setIsFeatured(e.target.checked);
                    markDirty();
                  }}
                />
              </label>

              <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer dark:border-slate-800">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Nội dung Premium
                </span>
                <input
                  type="checkbox"
                  checked={isPremium}
                  onChange={(e) => {
                    setIsPremium(e.target.checked);
                    markDirty();
                  }}
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Danh mục *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  markDirty();
                }}
                aria-label="Danh mục bài viết"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              >
                {BLOG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tags (phân tách bởi dấu phẩy)
              </label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => {
                  setTagsText(e.target.value);
                  markDirty();
                }}
                placeholder="VD: ielts reading, band 8, tu hoc"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tác giả
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => {
                    setAuthorName(e.target.value);
                    markDirty();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Phút đọc
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={readMinutes}
                  onChange={(e) => {
                    setReadMinutes(Math.max(1, Number(e.target.value) || 1));
                    markDirty();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
          </Card>

          {/* Cover Image */}
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Ảnh đại diện bài viết
            </h2>

            {coverImageUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <img
                  src={coverImageUrl}
                  alt={seoMeta.coverImageAlt || titleVi || "Cover image"}
                  className="h-44 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCoverImageUrl("");
                    markDirty();
                  }}
                  className="absolute right-2 top-2 rounded-lg bg-slate-950/75 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-600 cursor-pointer"
                >
                  Gỡ ảnh
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCoverPickerOpen(true)}
                className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-500 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-800 cursor-pointer"
              >
                <ImageIcon className="h-6 w-6 opacity-60" />
                Chọn hoặc tải ảnh đại diện
              </button>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCoverPickerOpen(true)}
                className="w-full"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Chọn từ Thư viện Media
              </Button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Alt Text ảnh đại diện (SEO)
              </label>
              <input
                type="text"
                value={seoMeta.coverImageAlt ?? ""}
                onChange={(e) => {
                  setSeoMeta((prev) => ({
                    ...prev,
                    coverImageAlt: e.target.value,
                  }));
                  markDirty();
                }}
                placeholder="Mô tả ngắn nội dung bức ảnh..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </Card>

          {/* Pre-Publish Quality Gate */}
          <BlogQualityGatePanel
            report={qualityReport}
            config={qualityConfig}
            canEditConfig={canEditQualityConfig}
            onSaveConfig={handleSaveQualityConfig}
          />

          {/* Auto Internal Link Suggestions */}
          <InternalLinkSuggestionsPanel
            title={titleVi}
            category={category}
            tags={parsedTags}
            primaryKeyword={seoMeta.primaryKeyword}
            contentHtml={contentVi}
            catalog={linkCatalog}
            hasZeroInternalLinks={qualityReport.hasZeroInternalLinks}
            onInsertLink={handleInsertInternalLink}
          />

          {/* Danger Zone (Edit mode) */}
          {isEdit && initialPost && (
            <Card className="border-red-200 p-5 space-y-3 dark:border-red-900/60">
              <h2 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                Xóa bài viết
              </h2>
              <p className="text-[11px] text-slate-500">
                Xóa bài viết khỏi hệ thống và cập nhật lại trang `/blog` ngay lập tức.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" /> Xóa bài viết này
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Pre-Publish Quality Gate Modal */}
      {pendingPublishStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-xl dark:border-amber-900 dark:bg-slate-900 space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Bài viết chưa đạt đủ tiêu chuẩn chất lượng ({qualityReport.score}/{qualityReport.maxScore})
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Các tiêu chí dưới đây chưa hoàn tất trước khi{" "}
                  {pendingPublishStatus === "scheduled" ? "lên lịch đăng" : "xuất bản công khai"}:
                </p>
              </div>
            </div>

            <ul className="space-y-1.5 rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {qualityReport.checks
                .filter((c) => !c.passed)
                .map((c) => (
                  <li key={c.id}>
                    <strong>• {c.label}:</strong> {c.detail}
                  </li>
                ))}
            </ul>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const target = pendingPublishStatus;
                  setPendingPublishStatus(null);
                  void handleSave(target, true);
                }}
              >
                Vẫn {pendingPublishStatus === "scheduled" ? "lên lịch" : "xuất bản"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setPendingPublishStatus(null)}
              >
                Quay lại hoàn thiện
              </Button>
            </div>
          </div>
        </div>
      )}

      <MediaPickerModal
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        acceptKind="image"
        defaultFolder="blog"
        title="Chọn ảnh đại diện cho bài viết"
        onSelect={(asset) => {
          setCoverImageUrl(asset.public_url);
          if (!seoMeta.coverImageAlt && asset.alt_text) {
            setSeoMeta((prev) => ({ ...prev, coverImageAlt: asset.alt_text }));
          }
          markDirty();
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Xác nhận xóa bài viết"
        description={`Xóa vĩnh viễn bài viết "${titleVi}"? Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa bài viết"
        destructive
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
