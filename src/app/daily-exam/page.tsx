import React from "react";
import { getCurrentUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { getVietnamDateString } from "@/lib/utils";
import { DailyExamClient } from "@/components/daily-exam-client";

export const metadata = {
  title: "Đề thi IELTS mỗi ngày (Múi giờ Việt Nam UTC+7)",
  description:
    "Thử thách 1 đề thi IELTS bấm giờ máy chủ mỗi ngày theo múi giờ Asia/Ho_Chi_Minh, tích lũy chuỗi streak và leo bảng xếp hạng.",
};

export default async function DailyExamPage() {
  const [user, store] = await Promise.all([getCurrentUser(), Promise.resolve(readStore())]);
  const vnToday = getVietnamDateString();

  const eligible = store.ielts_tests.filter(
    (t) => t.is_published && t.is_daily_eligible && t.sections.length > 0
  );
  const pool = eligible.length > 0 ? eligible : store.ielts_tests.filter((t) => t.sections.length > 0);
  const dayNum = Number(vnToday.replace(/-/g, "")) || 1;
  const todaysTest = pool[dayNum % pool.length];

  const existingAttempt = user
    ? store.daily_exam_attempts.find(
        (a) => a.exam_date === vnToday && a.user_id === user.id
      ) ?? null
    : null;

  const topDaily = store.daily_exam_attempts
    .filter((a) => a.is_completed)
    .sort((a, b) => b.raw_score - a.raw_score || a.duration_seconds - b.duration_seconds)
    .slice(0, 10);

  return (
    <DailyExamClient
      examDate={vnToday}
      durationSeconds={900}
      test={todaysTest}
      isLoggedIn={Boolean(user)}
      initialAttempt={existingAttempt}
      topDaily={topDaily}
    />
  );
}
