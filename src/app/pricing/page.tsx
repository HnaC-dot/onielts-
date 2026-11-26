import React from "react";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { getPricingPlans, getPromoBanner } from "@/lib/db";
import { getPublicFaqs } from "@/lib/site-content";
import { buildFaqPageJsonLd } from "@/lib/seo";
import { PricingClient } from "@/components/pricing-client";
import { Card } from "@/components/ui/card";

export const metadata = {
  title: "Bảng giá gói Ôn IELTS Premium (Thanh toán 1 lần qua VietQR)",
  description:
    "Nâng cấp Ôn IELTS Premium với các gói 1, 3, 6, 12 tháng trả một lần qua PayOS VietQR. Không giới hạn chấm AI Writing, Speaking và bài mẫu Band 9.",
};

export default async function PricingPage() {
  const [locale, user, activePlans, banner, allFaqs] = await Promise.all([
    getLocale(),
    getCurrentUser(),
    getPricingPlans(false),
    getPromoBanner(),
    getPublicFaqs(),
  ]);
  const isEn = locale === "en";
  const pricingFaqs = allFaqs.filter(
    (f) => f.category === "pricing" || f.category === "general"
  );
  const shownFaqs = (pricingFaqs.length > 0 ? pricingFaqs : allFaqs).slice(0, 6);
  const faqJsonLd =
    shownFaqs.length > 0
      ? buildFaqPageJsonLd(
          shownFaqs.map((f) => ({
            question: isEn ? f.question_en || f.question_vi : f.question_vi,
            answer: isEn ? f.answer_en || f.answer_vi : f.answer_vi,
          }))
        )
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-12">
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {isEn
            ? "Simple One-Time Pricing in VND"
            : "Đầu tư một lần — Bứt phá Band IELTS không giới hạn"}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Choose 1, 3, 6, or 12 months with instant VietQR activation and zero automatic renewals."
            : "Chọn gói 1, 3, 6 hoặc 12 tháng phù hợp với ngày thi của bạn. Kích hoạt tức thì qua mã VietQR."}
        </p>
      </div>

      <PricingClient plans={activePlans} banner={banner} user={user} />

      {shownFaqs.length > 0 && (
        <section className="mx-auto max-w-4xl space-y-4">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isEn ? "Frequently Asked Questions" : "Câu hỏi thường gặp về gói Premium"}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {shownFaqs.map((f) => (
              <Card key={f.id} className="p-5 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isEn ? f.question_en || f.question_vi : f.question_vi}
                </h3>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {isEn ? f.answer_en || f.answer_vi : f.answer_vi}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
