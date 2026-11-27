import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getUserProgressHistory,
  getUserProgressSummary,
} from "@/lib/progress-analytics";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { ProgressDashboardClient } from "@/components/progress-dashboard-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Tiến độ học tập & Phân tích lỗi sai IELTS",
    description:
      "Theo dõi mục tiêu Band, biểu đồ điểm theo thời gian, phân tích dạng câu hay sai, lịch sử làm đề, chuỗi ngày học và gợi ý bài luyện cá nhân.",
    pathname: "/progress",
    type: "website",
    noindex: true,
  });
}

export default async function ProgressPage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const isEn = locale === "en";

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Card className="p-8 space-y-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isEn
              ? "Sign in to track your IELTS progress"
              : "Đăng nhập để xem Tiến độ học tập của bạn"}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isEn
              ? "Your test history, question-type analytics, flashcards, and study streak are stored privately in your account."
              : "Lịch sử làm đề, phân tích lỗi sai theo dạng câu hỏi, thẻ Flashcard và chuỗi ngày học được lưu riêng tư trong tài khoản của bạn."}
          </p>
          <Link href="/auth?next=/progress">
            <Button>{isEn ? "Sign in" : "Đăng nhập ngay"}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const [initialSummary, initialHistory] = await Promise.all([
    getUserProgressSummary(user),
    getUserProgressHistory(user.id, { skill: "all", page: 1, pageSize: 10 }),
  ]);

  return (
    <ProgressDashboardClient
      userName={user.full_name || user.email}
      locale={locale}
      initialSummary={initialSummary}
      initialHistory={initialHistory}
    />
  );
}
