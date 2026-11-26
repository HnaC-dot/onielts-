/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { Play } from "lucide-react";
import { getLearnVideos } from "@/lib/db";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata() {
  const videos = await getLearnVideos(false);
  return buildPublicPageMetadata({
    title: "Video học IELTS kèm phụ đề tương tác song ngữ",
    description: `${videos.length} video học IELTS chọn lọc kèm bản ghi tương tác đồng bộ: bấm từng câu để tua video, bấm từng từ để lưu ngay vào Flashcard.`,
    pathname: "/videos",
    type: "website",
  });
}

export default async function VideosIndexPage() {
  const [locale, videos] = await Promise.all([getLocale(), getLearnVideos()]);
  const isEn = locale === "en";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "Learn IELTS with Interactive Videos" : "Video học IELTS kèm phụ đề tương tác"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Click any transcript line to seek, and click any word to save it directly into your spaced-repetition Flashcards."
            : "Nhấn từng dòng phụ đề để tua nhanh và nhấn từng từ tiếng Anh để lưu vào bộ Flashcard cá nhân."}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <Link key={v.id} href={`/videos/${v.slug}`}>
            <Card className="overflow-hidden h-full transition hover:border-emerald-400 hover:shadow-md">
              <div className="relative flex h-44 items-center justify-center bg-slate-900 text-white">
                <img
                  src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`}
                  alt={isEn ? v.title_en : v.title_vi}
                  className="absolute inset-0 h-full w-full object-cover opacity-75 transition hover:opacity-85"
                />
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 shadow-lg">
                  <Play className="h-6 w-6 fill-current pl-0.5" />
                </div>
                <span className="absolute bottom-3 right-3 z-10 rounded-md bg-black/75 px-2 py-0.5 text-xs font-semibold">
                  {v.duration_label}
                </span>
                <span className="absolute left-3 top-3 z-10">
                  <Badge>{v.level}</Badge>
                </span>
              </div>
              <div className="p-5">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEn ? v.title_en : v.title_vi}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {isEn ? v.description_en : v.description_vi}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
