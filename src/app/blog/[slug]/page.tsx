import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Clock } from "lucide-react";
import { getBlogPosts } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const posts = await getBlogPosts(false);
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};
  return {
    title: post.title_vi,
    description: post.excerpt_vi,
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, posts] = await Promise.all([getLocale(), getBlogPosts(false)]);
  const isEn = locale === "en";
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  const content = isEn ? post.content_en : post.content_vi;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-6">
      <Link href="/blog" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
        ← {isEn ? "All Blog Articles" : "Tất cả bài viết Blog"}
      </Link>

      <Card className="p-6 sm:p-10 space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{post.category}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              {post.read_minutes} {isEn ? "min read" : "phút đọc"}
            </span>
            <span className="text-xs text-slate-500">· {post.author_name}</span>
          </div>
          <h1 className="text-3xl font-bold leading-tight text-slate-900 dark:text-white">
            {isEn ? post.title_en : post.title_vi}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isEn ? post.excerpt_en : post.excerpt_vi}
          </p>
        </div>

        <div className="space-y-4 border-t border-slate-100 pt-6 dark:border-slate-800">
          {content.split(/\n\n+/).map((block, idx) =>
            block.startsWith("### ") ? (
              <h2
                key={idx}
                className="pt-2 text-lg font-bold text-slate-900 dark:text-white"
              >
                {block.replace(/^###\s+/, "")}
              </h2>
            ) : (
              <p
                key={idx}
                className="whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-300"
              >
                {block}
              </p>
            )
          )}
        </div>
      </Card>
    </article>
  );
}
