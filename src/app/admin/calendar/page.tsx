import React from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { listContentCalendarItems } from "@/lib/cms-content-production";
import { getVietnamDateString } from "@/lib/utils";
import { ContentCalendarClient } from "@/components/admin/content-calendar-client";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Lịch nội dung",
  robots: { index: false, follow: false },
};

export default async function AdminContentCalendarPage() {
  const today = getVietnamDateString();
  const initialMonth = today.slice(0, 7);

  const [authState, initial] = await Promise.all([
    getAuthState(),
    listContentCalendarItems(),
  ]);

  const defaultAssignee = authState.user?.full_name || "Biên tập viên";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Lịch sản xuất nội dung (Blog · Đề thi · Video)
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Lên kế hoạch theo tháng và theo dõi tiến độ từng nội dung theo quy trình:
            Ý tưởng → Đang viết → Chờ duyệt → Đã lên lịch → Đã đăng.
          </p>
        </div>

        <Link href="/admin/subscribers">
          <Button type="button" size="sm" variant="outline">
            <Mail className="h-3.5 w-3.5" />
            Email đăng ký Blog
          </Button>
        </Link>
      </div>

      <ContentCalendarClient
        initialItems={initial.items}
        initialTableReady={initial.tableReady}
        initialMonth={initialMonth}
        todayDate={today}
        defaultAssignee={defaultAssignee}
      />
    </div>
  );
}
