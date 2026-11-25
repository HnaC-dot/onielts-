"use client";

import React from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { CheckCircle2, Crown, X } from "lucide-react";
import { Button } from "./ui/button";

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  used?: number;
  limit?: number;
  period?: "monthly" | "daily";
}

export function PaywallModal({
  open,
  onClose,
  title,
  used = 2,
  limit = 2,
  period = "monthly",
}: PaywallModalProps) {
  const locale = useLocale();
  const isEn = locale === "en";

  if (!open) return null;

  return (
    <div
      id="paywall-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Crown className="h-6 w-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          {title ||
            (isEn
              ? "You've reached your Free AI limit"
              : "Bạn đã dùng hết lượt AI miễn phí")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? `Your Free plan includes ${limit} ${period === "monthly" ? "evaluations per skill per month" : "uses per day"} (${used}/${limit} used). Upgrade to Premium for unlimited access.`
            : `Gói Miễn phí bao gồm ${limit} lượt ${period === "monthly" ? "chấm AI mỗi kỹ năng/tháng" : "dùng công cụ mỗi ngày"} (đã dùng ${used}/${limit}). Nâng cấp Premium để mở khóa không giới hạn.`}
        </p>

        <ul className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-xs text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
          {[
            isEn ? "Unlimited AI Writing & Speaking evaluations" : "Chấm AI Writing & Speaking không giới hạn",
            isEn ? "Unlimited Band 9 Sample Generators & AI Conversations" : "Trình tạo bài mẫu Band 9 & Hội thoại AI không giới hạn",
            isEn ? "Private-by-default essays & detailed mistake analytics" : "Lưu bài riêng tư mặc định & phân tích lỗi theo dạng câu",
            isEn ? "One-time VND payment via VietQR — no auto-renewal" : "Thanh toán 1 lần qua VietQR, không tự động gia hạn",
          ].map((b) => (
            <li key={b} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/pricing" className="flex-1">
            <Button className="w-full" size="lg">
              {isEn ? "View Premium Plans" : "Xem gói Premium"}
            </Button>
          </Link>
          <Button variant="outline" size="lg" onClick={onClose}>
            {isEn ? "Later" : "Để sau"}
          </Button>
        </div>
      </div>
    </div>
  );
}
