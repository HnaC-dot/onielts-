import React from "react";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { checkUsageLimit } from "@/lib/usage-limits";
import { getUserWritingSubmissions } from "@/lib/db";
import { WritingCheckerClient } from "@/components/writing-checker-client";

export const metadata = {
  title: "Chấm điểm IELTS Writing bằng AI (Task 1 & Task 2)",
  description:
    "Chấm bài IELTS Academic Task 1 (kèm ảnh biểu đồ), General Task 1 và Task 2 theo 4 tiêu chí kèm highlight lỗi trực tiếp, nâng cấp từ vựng và bài viết lại Band 8+.",
};

export default async function WritingPage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const isEn = locale === "en";
  const [usage, submissions] = await Promise.all([
    checkUsageLimit(user, "writing_eval", user?.id ?? "guest"),
    getUserWritingSubmissions(user?.id ?? null),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "AI IELTS Writing Checker" : "Chấm bài IELTS Writing bằng AI"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Get detailed 4-criterion band scores, inline error corrections, vocabulary upgrades, and a Band 8+ rewrite."
            : "Chấm chi tiết 4 tiêu chí (TA/TR, CC, LR, GRA), sửa lỗi trực tiếp trên bài, giải thích tiếng Việt và viết lại chuẩn Band 8+."}
        </p>
      </div>

      <WritingCheckerClient
        initialUsage={usage}
        initialSubmissions={submissions}
      />
    </div>
  );
}
