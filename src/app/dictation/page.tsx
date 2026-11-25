import React from "react";
import { getLocale } from "next-intl/server";
import { readStore } from "@/lib/store";
import { DictationClient } from "@/components/dictation-client";

export const metadata = {
  title: "Chép chính tả (Dictation) & Luyện nói đuổi (Shadowing) IELTS",
  description:
    "Luyện nghe sâu từng câu chuẩn giọng Anh – Mỹ – Úc, kiểm tra lỗi sai từng từ và luyện nói đuổi Shadowing cải thiện ngữ điệu Speaking.",
};

export default async function DictationPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const isEn = locale === "en";
  const store = readStore();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "IELTS Dictation & Shadowing Studio" : "Chép chính tả & Luyện nói đuổi Shadowing"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Sharpen listening accuracy with word-level diff feedback and build natural speaking rhythm in Shadowing mode."
            : "Tăng độ nhạy nghe chi tiết qua đối chiếu từng từ và luyện ngữ điệu tự nhiên trong chế độ Shadowing."}
        </p>
      </div>

      <DictationClient
        lessons={store.dictation_lessons}
        initialSlug={params.lesson}
      />
    </div>
  );
}
