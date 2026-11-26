import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getDailyExamCalendarMonth,
  listDailyAttemptsForDate,
} from "@/lib/cms-daily-exam";
import { getVietnamDateString } from "@/lib/utils";
import { DailyExamAdminClient } from "@/components/admin/daily-exam-client";

export const metadata = {
  title: "Lịch Đề thi mỗi ngày (UTC+7)",
  robots: { index: false, follow: false },
};

export default async function AdminDailyExamPage() {
  const vnToday = getVietnamDateString();
  const [year, month] = vnToday.split("-").map(Number);
  const [calendar, attempts] = await Promise.all([
    getDailyExamCalendarMonth(year, month),
    listDailyAttemptsForDate(vnToday),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin"
          className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại Dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Đề thi mỗi ngày &amp; Kiểm duyệt Bảng xếp hạng (UTC+7)
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Lên lịch đề 15 phút cho từng ngày theo giờ Việt Nam, nhận cảnh báo ngày trống và ẩn/xóa kết quả bất thường trên bảng xếp hạng.
        </p>
      </div>

      <DailyExamAdminClient
        initialCalendar={calendar}
        initialSelectedDate={vnToday}
        initialAttempts={attempts}
      />
    </div>
  );
}
