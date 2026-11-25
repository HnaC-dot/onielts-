import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { readStore } from "@/lib/store";
import { VideoPlayerClient } from "@/components/video-player-client";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const video = readStore().learn_videos.find((v) => v.slug === slug);
  if (!video) return {};
  return { title: video.title_vi, description: video.description_vi };
}

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, store] = await Promise.all([getLocale(), Promise.resolve(readStore())]);
  const isEn = locale === "en";
  const video = store.learn_videos.find((v) => v.slug === slug);
  if (!video) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
      <Link href="/videos" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
        ← {isEn ? "All Learn Videos" : "Tất cả Video học IELTS"}
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <Badge>{video.level}</Badge>
          <Badge variant="secondary">{video.duration_label}</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
          {isEn ? video.title_en : video.title_vi}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn ? video.description_en : video.description_vi}
        </p>
      </div>

      <VideoPlayerClient video={video} />
    </div>
  );
}
