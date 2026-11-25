import React from "react";
import { getLocale } from "next-intl/server";
import { readStore } from "@/lib/store";
import { WritingExercisesClient } from "@/components/writing-exercises-client";

export const metadata = {
  title: "Bài tập nâng cấp câu viết IELTS (Band 5.5 → 8.0+)",
  description:
    "Thực hành viết lại từng câu học thuật theo chủ đề Môi trường, Biểu đồ Task 1 và Giáo dục có gợi ý và chấm điểm bằng AI.",
};

export default async function WritingExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const isEn = locale === "en";
  const store = readStore();

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

      <WritingExercisesClient
        exercises={store.writing_exercises}
        initialSlug={params.slug}
      />
    </div>
  );
}
