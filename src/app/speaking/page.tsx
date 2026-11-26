import React from "react";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { checkUsageLimit } from "@/lib/usage-limits";
import { getUserSpeakingSubmissions } from "@/lib/db";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { SpeakingCheckerClient } from "@/components/speaking-checker-client";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Chấm điểm IELTS Speaking bằng AI (Parts 1–3)",
    description:
      "Ghi âm trực tiếp hoặc tải file audio để chấm IELTS Speaking theo 4 tiêu chí FC, LR, GRA và Phát âm (điểm tham khảo) kèm câu trả lời mẫu Band 8+.",
    pathname: "/speaking",
    type: "website",
  });
}

export default async function SpeakingPage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const isEn = locale === "en";
  const [usage, submissions] = await Promise.all([
    checkUsageLimit(user, "speaking_eval", user?.id ?? "guest"),
    getUserSpeakingSubmissions(user?.id ?? null),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn
            ? "AI IELTS Speaking Checker (Parts 1–3)"
            : "Chấm điểm IELTS Speaking bằng AI (Parts 1–3)"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Record in Chrome or Safari, transcribe with Gemini audio AI, and receive band feedback across FC, LR, GRA, and Pronunciation (reference score)."
            : "Ghi âm trực tiếp trên Chrome/Safari hoặc tải file âm thanh (tối đa 3 phút) để nhận phân tích 4 tiêu chí cùng điểm Phát âm tham khảo."}
        </p>
      </div>

      <SpeakingCheckerClient
        initialUsage={usage}
        initialSubmissions={submissions}
      />
    </div>
  );
}
