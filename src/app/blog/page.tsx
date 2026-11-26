/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ArrowRight, Clock, Crown, Star } from "lucide-react";
import { getBlogPosts } from "@/lib/db";
import { buildBreadcrumbJsonLd, buildNextMetadata } from "@/lib/seo";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = buildNextMetadata({
  title: "Blog & Kinh nghiệm tự học IELTS",
  description:
    "Bài viết nguyên bản hướng dẫn lộ trình ôn thi, quy tắc tính điểm Band, cách sửa lỗi phát âm và mẹo chinh phục IELTS cho người Việt.",
  pathname: "/blog",
  type: "website",
});

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [params, locale, allPosts] = await Promise.all([
    searchParams,
    getLocale(),
    getBlogPosts(false),
  ]);
  const isEn = locale === "en";
  const activeCategory = params.category?.trim() || "";

  const categories = Array.from(new Set(allPosts.map((p) => p.category))).filter(
    Boolean
  );

  // Featured posts first, then newest
  const sorted = [...allPosts].sort((a, b) => {
    if (Boolean(a.is_featured) !== Boolean(b.is_featured)) {
      return a.is_featured ? -1 : 1;
    }
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  const posts = activeCategory
    ? sorted.filter((p) => p.category === activeCategory)
    : sorted;

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", pathname: "/" },
    { name: "Blog & Mẹo thi IELTS", pathname: "/blog" },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isEn ? "Ôn IELTS Study Blog & Guides" : "Blog & Kinh nghiệm tự học IELTS"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {isEn
              ? "Original IELTS roadmaps, band rounding explanations, and practical study habits."
              : "Tổng hợp lộ trình tự học, chiến thuật phòng thi và mẹo tăng điểm thực chiến."}
          </p>
        </div>

        {/* Category Filter Pills */}
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/blog"
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                !activeCategory
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {isEn ? "All" : "Tất cả"} ({allPosts.length})
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/blog?category=${encodeURIComponent(cat)}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeCategory === cat
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {cat}
              </Link>
            ))}
          </div>
        )}
      </div>

      {posts.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">
          {isEn
            ? "No articles found in this category yet."
            : "Chưa có bài viết nào trong danh mục này."}
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`}>
              <Card className="flex h-full flex-col justify-between overflow-hidden transition hover:border-emerald-400 hover:shadow-md">
                <div>
                  {post.cover_image_url && (
                    <div className="h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <img
                        src={post.cover_image_url}
                        alt={
                          post.seo_meta?.coverImageAlt ||
                          (isEn ? post.title_en : post.title_vi)
                        }
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="p-6 pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge>{post.category}</Badge>
                        {post.is_featured && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <Star className="h-2.5 w-2.5 fill-current" />
                            {isEn ? "Featured" : "Nổi bật"}
                          </span>
                        )}
                        {post.is_premium && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                            <Crown className="h-2.5 w-2.5" /> Premium
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {post.read_minutes} {isEn ? "min" : "phút"}
                      </span>
                    </div>
                    <h2 className="mt-4 text-lg font-bold leading-snug text-slate-900 dark:text-white">
                      {isEn ? post.title_en : post.title_vi}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {isEn ? post.excerpt_en : post.excerpt_vi}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 px-6 py-4 text-xs dark:border-slate-800">
                  <span className="truncate text-slate-500">{post.author_name}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                    {isEn ? "Read more" : "Đọc bài"} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
