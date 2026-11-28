"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  FileCode2,
  HelpCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { ContentPublishStatus, FaqItem, SeoMeta, StaticPageItem } from "@/lib/types";
import { auditHeadingStructure } from "@/lib/heading-typography";
import { FAQ_CATEGORIES } from "@/lib/system-cms-shared";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { RichTextEditor } from "./rich-text-editor";
import { SeoPanel } from "./seo-panel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PagesCmsClient({
  initialPages,
  initialFaqs,
}: {
  initialPages: StaticPageItem[];
  initialFaqs: FaqItem[];
}) {
  const toast = useAdminToast();
  const [tab, setTab] = useState<"pages" | "faqs">("pages");
  const [pages, setPages] = useState<StaticPageItem[]>(initialPages);
  const [faqs, setFaqs] = useState<FaqItem[]>(initialFaqs);
  const [saving, setSaving] = useState(false);

  // Page editor state
  const [activePageSlug, setActivePageSlug] = useState<string>(
    initialPages[0]?.slug ?? "about"
  );
  const activePage = pages.find((p) => p.slug === activePageSlug) ?? pages[0] ?? null;
  const [showPageSeo, setShowPageSeo] = useState(false);
  const [publishHeadingWarnings, setPublishHeadingWarnings] = useState<string[] | null>(null);

  // FAQ editor state
  const [editingFaq, setEditingFaq] = useState<{
    id?: string;
    question_vi: string;
    question_en: string;
    answer_vi: string;
    answer_en: string;
    category: string;
    sort_order: number;
    is_published: boolean;
  } | null>(null);
  const [deleteFaqTarget, setDeleteFaqTarget] = useState<FaqItem | null>(null);

  const reloadBundle = async () => {
    const res = await fetch("/api/admin/pages");
    if (res.ok) {
      const data = await res.json();
      setPages(data.pages ?? []);
      setFaqs(data.faqs ?? []);
    }
  };

  const patchLocalPage = (slug: string, patch: Partial<StaticPageItem>) => {
    setPages((prev) => prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)));
  };

  const saveActivePage = async (bypassHeadingWarning = false) => {
    if (!activePage) return;

    if (activePage.status === "published" && !bypassHeadingWarning) {
      const viAudit = auditHeadingStructure(activePage.body_vi);
      const enAudit = activePage.body_en
        ? auditHeadingStructure(activePage.body_en)
        : { warnings: [] };
      const allWarnings = [
        ...viAudit.warnings,
        ...enAudit.warnings.map((w) => `[Bản EN] ${w}`),
      ];
      if (allWarnings.length > 0) {
        setPublishHeadingWarnings(allWarnings);
        return;
      }
    }

    setPublishHeadingWarnings(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "page",
          page: {
            id: activePage.id,
            slug: activePage.slug,
            title_vi: activePage.title_vi,
            title_en: activePage.title_en,
            body_vi: activePage.body_vi,
            body_en: activePage.body_en,
            status: activePage.status,
            seo_meta: activePage.seo_meta ?? {},
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Lưu trang tĩnh thất bại.");
        return;
      }
      toast.success(`Đã lưu nội dung trang /${activePage.slug}!`);
      await reloadBundle();
    } finally {
      setSaving(false);
    }
  };

  const saveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "faq", faq: editingFaq }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Lưu câu hỏi FAQ thất bại.");
        return;
      }
      toast.success(
        editingFaq.id ? "Đã cập nhật câu hỏi FAQ!" : "Đã thêm câu hỏi FAQ mới!"
      );
      setEditingFaq(null);
      await reloadBundle();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Trang tĩnh (/about, /legal/*) &amp; Câu hỏi thường gặp (FAQs)
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Chỉnh sửa trực tiếp nội dung trang Giới thiệu, Điều khoản, Bảo mật, Hoàn tiền và danh sách FAQ (tự sinh schema FAQPage chuẩn SEO).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab("pages")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            tab === "pages"
              ? "bg-emerald-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <FileCode2 className="h-3.5 w-3.5" />
          Trang tĩnh &amp; Pháp lý ({pages.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("faqs")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            tab === "faqs"
              ? "bg-emerald-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Câu hỏi thường gặp FAQs ({faqs.length})
        </button>
      </div>

      {/* TAB 1: STATIC PAGES */}
      {tab === "pages" && activePage && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="p-4 lg:col-span-3 space-y-1.5 h-fit">
            <p className="px-2 pb-1 text-[11px] font-bold uppercase text-slate-400">
              Chọn trang cần sửa
            </p>
            {pages.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => setActivePageSlug(p.slug)}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-xs transition cursor-pointer ${
                  p.slug === activePage.slug
                    ? "bg-emerald-600 text-white"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <p className="font-bold">{p.title_vi}</p>
                <p
                  className={`font-mono text-[10px] ${
                    p.slug === activePage.slug ? "text-emerald-100" : "text-slate-400"
                  }`}
                >
                  /{p.slug}
                </p>
              </button>
            ))}
          </Card>

          <div className="lg:col-span-9 space-y-5">
            <Card className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <Badge>/{activePage.slug}</Badge>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Cập nhật lần cuối:{" "}
                    {new Date(activePage.updated_at).toLocaleString("vi-VN")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/${activePage.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Xem trang sống
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => void saveActivePage(false)}
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Đang lưu..." : "Lưu trang"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tiêu đề (VI) *
                  </label>
                  <input
                    type="text"
                    value={activePage.title_vi}
                    onChange={(e) =>
                      patchLocalPage(activePage.slug, { title_vi: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tiêu đề (EN)
                  </label>
                  <input
                    type="text"
                    value={activePage.title_en}
                    onChange={(e) =>
                      patchLocalPage(activePage.slug, { title_en: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Trạng thái
                  </label>
                  <select
                    value={activePage.status}
                    onChange={(e) =>
                      patchLocalPage(activePage.slug, {
                        status: e.target.value as ContentPublishStatus,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="published">Công khai</option>
                    <option value="draft">Bản nháp</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nội dung trang (Tiếng Việt — Rich Text) *
                </label>
                <RichTextEditor
                  key={`${activePage.slug}-vi`}
                  preset="static-page"
                  value={activePage.body_vi}
                  onChange={(html) =>
                    patchLocalPage(activePage.slug, { body_vi: html })
                  }
                  placeholder="Nhập nội dung trang..."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nội dung trang (Tiếng Anh — tùy chọn)
                </label>
                <textarea
                  rows={4}
                  value={activePage.body_en}
                  onChange={(e) =>
                    patchLocalPage(activePage.slug, { body_en: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPageSeo((v) => !v)}
              >
                {showPageSeo ? "Ẩn SEO trang này" : "Mở cấu hình SEO trang này"}
              </Button>
            </Card>

            {showPageSeo && (
              <SeoPanel
                seoMeta={activePage.seo_meta ?? {}}
                onChange={(seo_meta: SeoMeta) =>
                  patchLocalPage(activePage.slug, { seo_meta })
                }
                fallbackTitle={activePage.title_vi}
                fallbackDescription={activePage.seo_meta?.metaDescription || activePage.title_vi}
                slug={activePage.slug}
                basePath=""
                contentHtml={activePage.body_vi}
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FAQS */}
      {tab === "faqs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setEditingFaq({
                    question_vi: "",
                    question_en: "",
                    answer_vi: "",
                    answer_en: "",
                    category: "general",
                    sort_order: faqs.length + 1,
                    is_published: true,
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Thêm câu hỏi FAQ
              </Button>
              <Link
                href="/legal/faqs"
                target="_blank"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Xem trang /legal/faqs
              </Link>
            </div>
            <Badge variant="secondary">{faqs.length} câu hỏi</Badge>
          </div>

          {editingFaq && (
            <Card className="border-emerald-300 bg-emerald-50/30 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
              <form onSubmit={saveFaq} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingFaq.id ? "Chỉnh sửa FAQ" : "Thêm FAQ mới"}
                  </h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingFaq(null)}
                  >
                    Đóng
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold">Nhóm chủ đề</label>
                    <select
                      value={editingFaq.category}
                      onChange={(e) =>
                        setEditingFaq({ ...editingFaq, category: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    >
                      {FAQ_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold">Thứ tự hiển thị</label>
                    <input
                      type="number"
                      min={0}
                      value={editingFaq.sort_order}
                      onChange={(e) =>
                        setEditingFaq({
                          ...editingFaq,
                          sort_order: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <label className="flex items-center gap-2 pt-5 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingFaq.is_published}
                      onChange={(e) =>
                        setEditingFaq({ ...editingFaq, is_published: e.target.checked })
                      }
                      className="h-4 w-4 accent-emerald-600"
                    />
                    Hiển thị công khai
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold">Câu hỏi (VI) *</label>
                    <input
                      type="text"
                      required
                      value={editingFaq.question_vi}
                      onChange={(e) =>
                        setEditingFaq({ ...editingFaq, question_vi: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold">Câu hỏi (EN)</label>
                    <input
                      type="text"
                      value={editingFaq.question_en}
                      onChange={(e) =>
                        setEditingFaq({ ...editingFaq, question_en: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold">Câu trả lời (VI) *</label>
                    <textarea
                      rows={3}
                      required
                      value={editingFaq.answer_vi}
                      onChange={(e) =>
                        setEditingFaq({ ...editingFaq, answer_vi: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold">Câu trả lời (EN)</label>
                    <textarea
                      rows={3}
                      value={editingFaq.answer_en}
                      onChange={(e) =>
                        setEditingFaq({ ...editingFaq, answer_en: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                </div>

                <Button type="submit" size="sm" disabled={saving}>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Đang lưu..." : "Lưu câu hỏi FAQ"}
                </Button>
              </form>
            </Card>
          )}

          <div className="space-y-3">
            {faqs.map((f) => (
              <Card key={f.id} className="p-4 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-[240px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">#{f.sort_order}</Badge>
                    <Badge>{f.category}</Badge>
                    {!f.is_published && <Badge variant="amber">Đang ẩn</Badge>}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {f.question_vi}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {f.answer_vi}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditingFaq({
                        id: f.id,
                        question_vi: f.question_vi,
                        question_en: f.question_en,
                        answer_vi: f.answer_vi,
                        answer_en: f.answer_en,
                        category: f.category,
                        sort_order: f.sort_order,
                        is_published: f.is_published,
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Sửa
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => setDeleteFaqTarget(f)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(publishHeadingWarnings && publishHeadingWarnings.length > 0)}
        title="Cảnh báo cấu trúc tiêu đề (SEO & Accessibility)"
        description={
          publishHeadingWarnings
            ? `Phát hiện vấn đề phân cấp tiêu đề trong trang /${activePage?.slug ?? ""}: ${publishHeadingWarnings.join(" • ")}`
            : ""
        }
        confirmLabel="Vẫn xuất bản"
        cancelLabel="Quay lại sửa"
        destructive={false}
        loading={saving}
        onCancel={() => setPublishHeadingWarnings(null)}
        onConfirm={() => void saveActivePage(true)}
      />

      <ConfirmDialog
        open={Boolean(deleteFaqTarget)}
        title="Xóa câu hỏi FAQ?"
        description={`Câu hỏi "${deleteFaqTarget?.question_vi ?? ""}" sẽ bị xóa khỏi /legal/faqs và /pricing.`}
        confirmLabel="Xóa FAQ"
        onCancel={() => setDeleteFaqTarget(null)}
        onConfirm={async () => {
          if (!deleteFaqTarget) return;
          const res = await fetch(
            `/api/admin/pages?kind=faq&id=${encodeURIComponent(deleteFaqTarget.id)}`,
            { method: "DELETE" }
          );
          if (res.ok) {
            toast.success("Đã xóa câu hỏi FAQ.");
            setDeleteFaqTarget(null);
            await reloadBundle();
          }
        }}
      />
    </div>
  );
}
