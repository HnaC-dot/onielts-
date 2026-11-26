import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin-auth";
import { getLearnVideoBySlug } from "@/lib/db";
import {
  buildBreadcrumbJsonLd,
  buildVideoObjectJsonLd,
} from "@/lib/seo";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { VideoPlayerClient } from "@/components/video-player-client";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const video = await getLearnVideoBySlug(slug, false);
  if (!video) return {};
  return buildPublicPageMetadata({
    title: video.title_vi,
    description: video.description_vi,
    pathname: `/videos/${video.slug}`,
    imageUrl: `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`,
    imageAlt: video.seo_meta?.ogImageAlt || video.title_vi,
    seoMeta: video.seo_meta,
    type: "article",
  });
}

export default async function VideoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ slug }, query, locale, user] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getCurrentUser(),
  ]);
  const isStaff = Boolean(user && isStaffRole(user.role));
  const isPreview = query.preview === "1" && isStaff;

  const video = await getLearnVideoBySlug(slug, isPreview);
  const isEn = locale === "en";
  if (!video) notFound();

  const videoJsonLd = buildVideoObjectJsonLd(video);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", pathname: "/" },
    { name: "Video học IELTS", pathname: "/videos" },
    { name: video.title_vi, pathname: `/videos/${video.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {video.is_published === false && isPreview && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Chế độ xem trước bản nháp (chỉ Admin / Editor nhìn thấy).
        </div>
      )}

      <Link href="/videos" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
        ← {isEn ? "All Learn Videos" : "Tất cả Video học IELTS"}
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <Badge>{video.level}</Badge>
          <Badge variant="secondary">{video.duration_label}</Badge>
          {video.is_premium && <Badge variant="amber">Premium</Badge>}
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
