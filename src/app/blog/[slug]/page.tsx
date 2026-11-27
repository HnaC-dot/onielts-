/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Crown,
  Eye,
  ListTree,
  RefreshCw,
  Star,
} from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin-auth";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/db";
import { isBlogPostPubliclyVisible } from "@/lib/blog-shared";
import { extractTocAndInjectAnchors } from "@/lib/content-production-shared";
import { renderBlogContentToSafeHtml } from "@/lib/sanitize";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  getAppBaseUrl,
} from "@/lib/seo";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import type { BlogPost } from "@/lib/types";
import {
  BlogNewsletterBox,
  BlogShareButtons,
} from "@/components/blog-article-widgets";
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

function selectRelatedPosts(current: BlogPost, allPublished: BlogPost[], limit = 3): BlogPost[] {
  const currentTags = new Set(
    (current.tags ?? []).map((t) => t.trim().toLowerCase())
  );

  return allPublished
    .filter((p) => p.id !== current.id && p.slug !== current.slug)
    .map((candidate) => {
      let score = 0;
      if (candidate.category === current.category) score += 4;
      for (const tag of candidate.tags ?? []) {
        if (currentTags.has(tag.trim().toLowerCase())) score += 2;
      }
      if (candidate.is_featured) score += 0.5;
      return { post: candidate, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        new Date(b.post.published_at).getTime() -
        new Date(a.post.published_at).getTime()
      );
    })
    .slice(0, limit)
    .map((x) => x.post);
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

  const [post, allPublished] = await Promise.all([
    getBlogPostBySlug(slug, allowPreview),
    getBlogPosts(false),
  ]);
  if (!post) notFound();

  const isUnpublishedPreview = allowPreview && !isBlogPostPubliclyVisible(post);
  const rawContent = isEn ? post.content_en : post.content_vi;
  const safeHtml = renderBlogContentToSafeHtml(rawContent);
  const { htmlWithAnchors, items: tocItems } =
    extractTocAndInjectAnchors(safeHtml);

  const relatedPosts = selectRelatedPosts(post, allPublished, 3);
  const articleTitle = isEn ? post.title_en : post.title_vi;
  const canonicalShareUrl = `${getAppBaseUrl()}/blog/${post.slug}`;

  const publishedDateLabel = new Date(post.published_at).toLocaleDateString(
    isEn ? "en-GB" : "vi-VN",
    { timeZone: "Asia/Ho_Chi_Minh" }
  );
  const updatedIso = post.updated_at || post.published_at;
  const updatedDateLabel = new Date(updatedIso).toLocaleDateString(
    isEn ? "en-GB" : "vi-VN",
    { timeZone: "Asia/Ho_Chi_Minh" }
  );

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
                articleTitle
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
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {isEn ? "Published:" : "Đăng ngày:"} {publishedDateLabel}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                <RefreshCw className="h-3.5 w-3.5" />
                {isEn ? "Updated:" : "Cập nhật:"} {updatedDateLabel}
              </span>
            </div>

            <h1 className="text-3xl font-bold leading-tight text-slate-900 dark:text-white">
              {articleTitle}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {isEn ? post.excerpt_en : post.excerpt_vi}
            </p>

            <div className="pt-1">
              <BlogShareButtons
                url={canonicalShareUrl}
                title={articleTitle}
                isEn={isEn}
              />
            </div>
          </div>

          {tocItems.length >= 2 && (
            <nav
              aria-label={isEn ? "Table of contents" : "Mục lục bài viết"}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                <ListTree className="h-4 w-4 text-emerald-600" />
                {isEn ? "Table of Contents" : "Mục lục bài viết"}
              </div>
              <ol className="space-y-1.5 text-xs">
                {tocItems.map((item) => (
                  <li
                    key={item.id}
                    className={item.level === 3 ? "pl-4" : "font-semibold"}
                  >
                    <a
                      href={`#${item.id}`}
                      className="text-slate-700 transition hover:text-emerald-700 hover:underline dark:text-slate-300 dark:hover:text-emerald-400"
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div
            className="cms-richtext border-t border-slate-100 pt-6 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300 [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24"
            dangerouslySetInnerHTML={{ __html: htmlWithAnchors }}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5 dark:border-slate-800">
            {post.tags && post.tags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
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
            ) : (
              <div />
            )}
            <BlogShareButtons
              url={canonicalShareUrl}
              title={articleTitle}
              isEn={isEn}
            />
          </div>
        </div>
      </Card>

      <BlogNewsletterBox sourceSlug={post.slug} isEn={isEn} />

      {relatedPosts.length > 0 && (
        <section className="space-y-4 pt-2" aria-labelledby="related-posts-heading">
          <div className="flex items-center justify-between">
            <h2
              id="related-posts-heading"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              {isEn ? "Related IELTS Articles" : "Bài viết liên quan"}
            </h2>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {isEn ? "All articles" : "Xem tất cả"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {relatedPosts.map((rel) => (
              <Link key={rel.id} href={`/blog/${rel.slug}`}>
                <Card className="flex h-full flex-col justify-between p-4 transition hover:border-emerald-400 hover:shadow-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{rel.category}</Badge>
                      <span className="text-[11px] text-slate-400">
                        {rel.read_minutes} {isEn ? "min" : "phút"}
                      </span>
                    </div>
                    <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 dark:text-white">
                      {isEn ? rel.title_en : rel.title_vi}
                    </h3>
                    <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                      {isEn ? rel.excerpt_en : rel.excerpt_vi}
                    </p>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {isEn ? "Read guide" : "Đọc tiếp"}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
