import React from "react";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { getFlashcardsForUser } from "@/lib/db";
import { FlashcardsClient } from "@/components/flashcards-client";

export const metadata = {
  title: "Flashcards từ vựng IELTS (Lặp lại ngắt quãng SM-2)",
  description:
    "Quản lý bộ thẻ từ vựng học thuật, lưu nhanh bằng cách bôi đen từ trên bất kỳ trang nào và ôn tập theo thuật toán lặp lại ngắt quãng SM-2.",
};

export default async function FlashcardsPage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const isEn = locale === "en";
  const { sets, cards } = await getFlashcardsForUser(user?.id ?? null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn
            ? "IELTS Flashcards & Spaced Repetition"
            : "Flashcards IELTS & Lặp lại ngắt quãng"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Review saved IELTS vocabulary with SM-2 spaced repetition. Highlight any word anywhere on the site to add it instantly."
            : "Ôn nhớ lâu từ vựng IELTS theo thuật toán SM-2. Bôi đen bất kỳ từ tiếng Anh nào trên Ôn IELTS để lưu thẻ tức thì."}
        </p>
      </div>

      <FlashcardsClient initialSets={sets} initialCards={cards} />
    </div>
  );
}
