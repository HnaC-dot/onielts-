import React from "react";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { PricingClient } from "@/components/pricing-client";

export const metadata = {
  title: "Bảng giá gói Ôn IELTS Premium (Thanh toán 1 lần qua VietQR)",
  description:
    "Nâng cấp Ôn IELTS Premium với các gói 1, 3, 6, 12 tháng trả một lần qua PayOS VietQR. Không giới hạn chấm AI Writing, Speaking và bài mẫu Band 9.",
};

export default async function PricingPage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const isEn = locale === "en";
  const store = readStore();

  const activePlans = store.pricing_plans
    .filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-8">
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

      <PricingClient
        plans={activePlans}
        banner={store.promo_banner}
        user={user}
      />
    </div>
  );
}
