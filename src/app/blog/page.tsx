import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ArrowRight, Clock } from "lucide-react";
import { readStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Blog & Kinh nghiệm tự học IELTS",
  description:
    "Bài viết nguyên bản hướng dẫn lộ trình ôn thi, quy tắc tính điểm Band, cách sửa lỗi phát âm và mẹo chinh phục IELTS cho người Việt.",
};

export default async function BlogIndexPage() {
  const [locale, store] = await Promise.all([getLocale(), Promise.resolve(readStore())]);
  const isEn = locale === "en";
  const posts = store.blog_posts.filter((p) => p.is_published);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-8">
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

      <div className="grid gap-6 md:grid-cols-3">
        {posts.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`}>
            <Card className="flex h-full flex-col justify-between p-6 transition hover:border-emerald-400 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <Badge>{post.category}</Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    {post.read_minutes} {isEn ? "min" : "phút"}
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-bold leading-snug text-slate-900 dark:text-white">
                  {isEn ? post.title_en : post.title_vi}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {isEn ? post.excerpt_en : post.excerpt_vi}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
                <span className="text-slate-500">{post.author_name}</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                  {isEn ? "Read more" : "Đọc bài"} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
