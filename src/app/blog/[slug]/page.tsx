/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Clock, Crown, Eye, Star } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin-auth";
import { getBlogPostBySlug } from "@/lib/db";
import { isBlogPostPubliclyVisible } from "@/lib/blog-shared";
import { renderBlogContentToSafeHtml } from "@/lib/sanitize";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/seo";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug, false);
  if (!post) return {};

  return buildPublicPageMetadata({
    title: post.title_vi,
    description: post.excerpt_vi,
    pathname: `/blog/${post.slug}`,
    imageUrl: post.cover_image_url,
    imageAlt: post.seo_meta?.coverImageAlt || post.title_vi,
    seoMeta: post.seo_meta,
    type: "article",
    publishedTime: post.published_at,
    authors: [post.author_name],
    keywords: post.tags ?? [],
  });
}

export default async function BlogDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ slug }, query, locale] = await Promise.all([
    params,
    searchParams,
    getLocale(),
  ]);
  const isEn = locale === "en";

  let allowPreview = false;
  if (query.preview === "1") {
    const authState = await getAuthState();
    if (
      authState.user &&
      isStaffRole(authState.user.role) &&
      !authState.user.is_locked
    ) {
      allowPreview = true;
    }
  }

  const post = await getBlogPostBySlug(slug, allowPreview);
  if (!post) notFound();

  const isUnpublishedPreview = allowPreview && !isBlogPostPubliclyVisible(post);
  const rawContent = isEn ? post.content_en : post.content_vi;
  const safeHtml = renderBlogContentToSafeHtml(rawContent);

  const articleJsonLd = buildArticleJsonLd(post);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", pathname: "/" },
    { name: "Blog & Mẹo thi IELTS", pathname: "/blog" },
    { name: post.title_vi, pathname: `/blog/${post.slug}` },
  ]);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {isUnpublishedPreview && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            Chế độ Xem trước ({post.status === "scheduled" ? "Lên lịch đăng" : "Bản nháp"}) — Khách truy cập chưa thấy bài này.
          </span>
          <Link
            href={`/admin/blog/${post.id}`}
            className="underline hover:text-amber-700"
          >
            Quay lại trình soạn thảo
          </Link>
        </div>
      )}

      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-emerald-700 dark:hover:text-emerald-400">
          {isEn ? "Home" : "Trang chủ"}
        </Link>
        <span>/</span>
        <Link href="/blog" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          {isEn ? "Blog" : "Blog & Mẹo thi"}
        </Link>
      </nav>

      <Card className="overflow-hidden">
        {post.cover_image_url && (
          <div className="max-h-[420px] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
            <img
              src={post.cover_image_url}
              alt={
                post.seo_meta?.coverImageAlt ||
                post.seo_meta?.ogImageAlt ||
                (isEn ? post.title_en : post.title_vi)
              }
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="p-6 sm:p-10 space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{post.category}</Badge>
              {post.is_featured && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <Star className="h-3 w-3 fill-current" />
                  {isEn ? "Featured" : "Nổi bật"}
                </span>
              )}
              {post.is_premium && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                  <Crown className="h-3 w-3" /> Premium
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                {post.read_minutes} {isEn ? "min read" : "phút đọc"}
              </span>
              <span className="text-xs text-slate-500">· {post.author_name}</span>
              <span className="text-xs text-slate-400">
                ·{" "}
                {new Date(post.published_at).toLocaleDateString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </span>
            </div>

            <h1 className="text-3xl font-bold leading-tight text-slate-900 dark:text-white">
              {isEn ? post.title_en : post.title_vi}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {isEn ? post.excerpt_en : post.excerpt_vi}
            </p>
          </div>

          {/* XSS-Sanitized Rich Text Body */}
          <div
            className="cms-richtext border-t border-slate-100 pt-6 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-5 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500">Tags:</span>
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </article>
  );
}
