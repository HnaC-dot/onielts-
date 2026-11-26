"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import type { BlogPost } from "@/lib/types";
import { BLOG_CATEGORIES, resolveBlogStatus } from "@/lib/blog-shared";
import { evaluateSeoChecklist } from "@/lib/seo";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BlogListClientProps {
  initialItems: BlogPost[];
  initialTotal: number;
}

export function BlogListClient({
  initialItems,
  initialTotal,
}: BlogListClientProps) {
  const router = useRouter();
  const toast = useAdminToast();
  const [items, setItems] = useState<BlogPost[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"" | "draft" | "published" | "scheduled">("");
  const [featured, setFeatured] = useState<"" | "true" | "false">("");
  const [premium, setPremium] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 15;

  const fetchPosts = useCallback(
    async (
      nextPage: number,
      search: string,
      cat: string,
      st: string,
      feat: string,
      prem: string
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: String(pageSize),
        });
        if (search.trim()) params.set("q", search.trim());
        if (cat) params.set("category", cat);
        if (st) params.set("status", st);
        if (feat) params.set("featured", feat);
        if (prem) params.set("premium", prem);
        const res = await fetch(`/api/admin/blog?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items ?? []);
          setTotal(data.total ?? 0);
          setPage(data.page ?? nextPage);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleDuplicate = async (post: BlogPost) => {
    setBusyId(post.id);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể nhân bản bài viết.");
        return;
      }
      toast.success(`Đã nhân bản thành bản nháp "${data.post.title_vi}"`);
      await fetchPosts(1, q, category, status, featured, premium);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/blog/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể xóa bài viết.");
        return;
      }
      toast.success(`Đã xóa bài viết "${deleteTarget.title_vi}"`);
      setDeleteTarget(null);
      await fetchPosts(page, q, category, status, featured, premium);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void fetchPosts(1, q, category, status, featured, premium);
          }}
          className="flex flex-wrap items-center gap-2.5"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tiêu đề, slug, tag, tác giả..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              void fetchPosts(1, q, e.target.value, status, featured, premium);
            }}
            aria-label="Lọc theo danh mục"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Mọi danh mục</option>
            {BLOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              const next = e.target.value as typeof status;
              setStatus(next);
              void fetchPosts(1, q, category, next, featured, premium);
            }}
            aria-label="Lọc theo trạng thái"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Mọi trạng thái</option>
            <option value="published">Đã đăng</option>
            <option value="draft">Nháp</option>
            <option value="scheduled">Lên lịch đăng</option>
          </select>
          <select
            value={featured}
            onChange={(e) => {
              const next = e.target.value as typeof featured;
              setFeatured(next);
              void fetchPosts(1, q, category, status, next, premium);
            }}
            aria-label="Lọc bài nổi bật"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Nổi bật: Tất cả</option>
            <option value="true">Chỉ bài Nổi bật</option>
            <option value="false">Bài thường</option>
          </select>
          <select
            value={premium}
            onChange={(e) => {
              const next = e.target.value as typeof premium;
              setPremium(next);
              void fetchPosts(1, q, category, status, featured, next);
            }}
            aria-label="Lọc Free/Premium"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Free &amp; Premium</option>
            <option value="false">Miễn phí (Free)</option>
            <option value="true">Premium</option>
          </select>
          <Button type="submit" size="sm" variant="outline" disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Lọc
          </Button>
          <Link href="/admin/blog/new">
            <Button type="button" size="sm">
              <Plus className="h-4 w-4" /> Viết bài mới
            </Button>
          </Link>
        </form>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Bài viết</th>
                <th className="px-4 py-3 font-semibold">Danh mục &amp; Gói</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">SEO</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    <FileText className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    Không có bài viết nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                items.map((post) => {
                  const st = resolveBlogStatus(post);
                  const seo = evaluateSeoChecklist({
                    title: post.title_vi,
                    slug: post.slug,
                    excerpt: post.excerpt_vi,
                    contentHtml: post.content_vi,
                    coverImageUrl: post.cover_image_url,
                    seoMeta: post.seo_meta ?? {},
                  });
                  const previewHref =
                    st === "published"
                      ? `/blog/${post.slug}`
                      : `/blog/${post.slug}?preview=1`;

                  return (
                    <tr
                      key={post.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50"
                    >
                      <td className="px-4 py-3 max-w-sm">
                        <div className="flex items-start gap-3">
                          {post.cover_image_url ? (
                            <img
                              src={post.cover_image_url}
                              alt={post.seo_meta?.coverImageAlt || post.title_vi}
                              className="h-12 w-16 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                            />
                          ) : (
                            <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
                              <FileText className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/admin/blog/${post.id}`}
                              className="line-clamp-1 font-bold text-slate-900 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-400"
                            >
                              {post.title_vi}
                            </Link>
                            <p className="truncate font-mono text-[11px] text-slate-500">
                              /blog/{post.slug}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {post.is_featured && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  <Star className="h-2.5 w-2.5 fill-current" /> Nổi bật
                                </span>
                              )}
                              {(post.tags ?? []).slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap space-y-1">
                        <div>
                          <Badge variant="secondary">{post.category}</Badge>
                        </div>
                        <div className="text-[11px]">
                          {post.is_premium ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                              <Crown className="h-3 w-3" /> Premium
                            </span>
                          ) : (
                            <span className="text-slate-500">Miễn phí (Free)</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {st === "published" ? (
                          <Badge variant="default">Đã đăng</Badge>
                        ) : st === "scheduled" ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                              Lên lịch
                            </span>
                            {post.scheduled_at && (
                              <p className="font-mono text-[10px] text-slate-500">
                                {new Date(post.scheduled_at).toLocaleString("vi-VN", {
                                  timeZone: "Asia/Ho_Chi_Minh",
                                })}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary">Nháp</Badge>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold ${
                            seo.score >= 6
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : seo.score >= 4
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {seo.score}/{seo.maxScore}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={`/admin/blog/${post.id}`}
                            title="Chỉnh sửa"
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 px-2.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Sửa
                          </Link>
                          <button
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => void handleDuplicate(post)}
                            title="Nhân bản thành bản nháp"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={previewHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Xem trước trang public"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(post)}
                            title="Xóa bài viết"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
          <span>
            Tổng <strong>{total}</strong> bài viết · Trang {page}/{totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() =>
                void fetchPosts(page - 1, q, category, status, featured, premium)
              }
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Trước
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() =>
                void fetchPosts(page + 1, q, category, status, featured, premium)
              }
            >
              Sau <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xác nhận xóa bài viết Blog"
        description={`Xóa vĩnh viễn bài viết "${deleteTarget?.title_vi ?? ""}" (/blog/${deleteTarget?.slug ?? ""})? Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa bài viết"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
