import React from "react";
import { getLocale } from "next-intl/server";
import { readStore } from "@/lib/store";
import { BandCalculatorClient } from "@/components/band-calculator-client";

export const metadata = {
  title: "Tính điểm Band IELTS chuẩn (Overall, Reading, Listening, Writing, Speaking)",
  description:
    "Công cụ tính điểm Band IELTS chính xác theo quy tắc làm tròn 6.25 lên 6.5, 6.75 lên 7.0 và bảng quy đổi số câu đúng Reading Academic, General & Listening.",
};

export default async function BandCalculatorPage() {
  const locale = await getLocale();
  const isEn = locale === "en";
  const store = readStore();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "IELTS Band Score Calculators" : "Công cụ tính điểm Band IELTS"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Compute Overall, Listening, Academic & General Reading, Writing, and Speaking bands with official IELTS rounding."
            : "Tính chính xác điểm Overall, Listening, Reading (Academic & General), Writing và Speaking theo quy tắc làm tròn chuẩn IELTS."}
        </p>
      </div>

      <BandCalculatorClient conversionRows={store.band_conversion_tables} />
    </div>
  );
}
