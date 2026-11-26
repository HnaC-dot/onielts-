import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { getDailyExamState } from "@/lib/db";
import { sanitizeTestForClient } from "@/lib/test-grader";
import { getVietnamDateString } from "@/lib/utils";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { DailyExamClient } from "@/components/daily-exam-client";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Đề thi IELTS mỗi ngày (Múi giờ Việt Nam UTC+7)",
    description:
      "Thử thách 1 đề rút gọn 15 phút bấm giờ máy chủ mỗi ngày theo múi giờ Asia/Ho_Chi_Minh, tích lũy chuỗi streak và leo bảng xếp hạng Ôn IELTS.",
    pathname: "/daily-exam",
    type: "website",
  });
}

export default async function DailyExamPage() {
  const vnToday = getVietnamDateString();
  const user = await getCurrentUser();
  const { dailyTest, durationSeconds, existingAttempt, leaderboard } =
    await getDailyExamState(vnToday, user?.id ?? null);

  // Never send answer keys or explanations to the browser before submission
  const safeDailyTest = sanitizeTestForClient(dailyTest);

  return (
    <DailyExamClient
      examDate={vnToday}
      durationSeconds={durationSeconds ?? 900}
      test={safeDailyTest}
      isLoggedIn={Boolean(user)}
      initialAttempt={existingAttempt}
      topDaily={leaderboard.slice(0, 10)}
    />
  );
}
