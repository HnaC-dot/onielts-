import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { readStore } from "@/lib/store";
import { PronunciationPracticeClient } from "@/components/pronunciation-practice-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sound = readStore().pronunciation_sounds.find((s) => s.slug === slug);
  if (!sound) return {};
  return {
    title: `Cách phát âm ${sound.symbol} (${sound.title_vi})`,
    description: sound.vietnameseTip_vi,
  };
}

export default async function PronunciationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, store] = await Promise.all([getLocale(), Promise.resolve(readStore())]);
  const isEn = locale === "en";
  const sound = store.pronunciation_sounds.find((s) => s.slug === slug);
  if (!sound) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-6">
      <Link href="/pronunciation" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
        ← {isEn ? "Back to IPA Chart" : "Quay lại bảng IPA"}
      </Link>

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

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {isEn ? "Articulation & Mouth Placement" : "Khẩu hình & Vị trí lưỡi"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {isEn ? sound.tip_en : sound.mouthPosition_vi}
          </p>
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
