import React from "react";
import { getLocale } from "next-intl/server";
import { getWritingExercises } from "@/lib/db";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { WritingExercisesClient } from "@/components/writing-exercises-client";

export async function generateMetadata() {
  const exercises = await getWritingExercises(false);
  const totalSentences = exercises.reduce((sum, e) => sum + e.sentences.length, 0);
  return buildPublicPageMetadata({
    title: "Bài tập nâng cấp câu viết IELTS (Band 5.5 → 8.0+)",
    description: `${exercises.length} bộ bài tập nâng cấp câu viết học thuật (${totalSentences} câu thực hành) kèm gợi ý từ vựng, câu mẫu Band 8+ và chấm điểm bằng AI.`,
    pathname: "/writing/exercises",
    type: "website",
  });
}

export default async function WritingExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const [locale, params, exercises] = await Promise.all([
    getLocale(),
    searchParams,
    getWritingExercises(),
  ]);
  const isEn = locale === "en";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "Writing Improvement Exercises" : "Bài tập nâng cấp câu viết IELTS"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Transform plain Band 5.5 sentences into polished Band 8.0+ academic expressions step by step."
            : "Luyện biến đổi từng câu viết đơn giản từ Band 5.5 lên Band 8.0+ với phân tích lỗi và gợi ý AI."}
        </p>
      </div>

      <WritingExercisesClient exercises={exercises} initialSlug={params.slug} />
    </div>
  );
}
