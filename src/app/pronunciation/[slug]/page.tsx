/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Headphones } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin-auth";
import { getPronunciationSoundBySlug } from "@/lib/db";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { PronunciationPracticeClient } from "@/components/pronunciation-practice-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sound = await getPronunciationSoundBySlug(slug, false);
  if (!sound) return {};
  return buildPublicPageMetadata({
    title: `Cách phát âm ${sound.symbol} (${sound.title_vi})`,
    description: sound.vietnameseTip_vi,
    pathname: `/pronunciation/${sound.slug}`,
    imageUrl: sound.mouth_image_url,
    imageAlt: sound.seo_meta?.coverImageAlt || `Khẩu hình âm ${sound.symbol}`,
    seoMeta: sound.seo_meta,
    type: "article",
  });
}

export default async function PronunciationDetailPage({
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

  const sound = await getPronunciationSoundBySlug(slug, isPreview);
  const isEn = locale === "en";
  if (!sound) notFound();

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", pathname: "/" },
    { name: "Phát âm IPA", pathname: "/pronunciation" },
    { name: `${sound.symbol} — ${sound.title_vi}`, pathname: `/pronunciation/${sound.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {sound.is_published === false && isPreview && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Chế độ xem trước bản nháp (chỉ Admin / Editor nhìn thấy).
        </div>
      )}

      <Link href="/pronunciation" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
        ← {isEn ? "Back to IPA Chart" : "Quay lại bảng IPA"}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white shadow-sm">
            {sound.symbol}
          </div>
          <div>
            <Badge variant="secondary">{sound.category}</Badge>
            <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
              {isEn ? sound.title_en : sound.title_vi}
            </h1>
          </div>
        </div>

        {sound.audio_url && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
            <Headphones className="h-4 w-4 text-emerald-600 shrink-0" />
            <audio controls src={sound.audio_url} className="h-8 max-w-[220px]" />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {isEn ? "Articulation & Mouth Placement" : "Khẩu hình & Vị trí lưỡi"}
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {isEn ? sound.tip_en : sound.mouthPosition_vi}
          </p>
          {sound.mouth_image_url && (
            <img
              src={sound.mouth_image_url}
              alt={sound.seo_meta?.coverImageAlt || `Sơ đồ khẩu hình ${sound.symbol}`}
              className="mt-2 max-h-56 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-slate-800 dark:bg-slate-900"
            />
          )}
        </Card>
        <Card className="border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900 dark:bg-amber-950/20">
          <h2 className="text-sm font-bold text-amber-950 dark:text-amber-200">
            {isEn ? "Tip for Vietnamese Learners" : "Mẹo sửa lỗi phổ biến của người Việt"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {sound.vietnameseTip_vi}
          </p>
        </Card>
      </div>

      <PronunciationPracticeClient sound={sound} />
    </div>
  );
}
