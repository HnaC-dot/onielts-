import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { getDailyExamState } from "@/lib/db";
import { getVietnamDateString } from "@/lib/utils";
import { DailyExamClient } from "@/components/daily-exam-client";

export const metadata = {
  title: "Đề thi IELTS mỗi ngày (Múi giờ Việt Nam UTC+7)",
  description:
    "Thử thách 1 đề rút gọn 15 phút bấm giờ máy chủ mỗi ngày theo múi giờ Asia/Ho_Chi_Minh, tích lũy chuỗi streak và leo bảng xếp hạng.",
};

export default async function DailyExamPage() {
  const vnToday = getVietnamDateString();
  const user = await getCurrentUser();
  const { dailyTest, existingAttempt, leaderboard } = await getDailyExamState(
    vnToday,
    user?.id ?? null
  );

  return (
    <DailyExamClient
      examDate={vnToday}
      durationSeconds={900}
      test={dailyTest}
      isLoggedIn={Boolean(user)}
      initialAttempt={existingAttempt}
      topDaily={leaderboard.slice(0, 10)}
    />
  );
}
