import React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { maskEmailAddress } from "@/lib/admin-auth";
import { getAuthState } from "@/lib/auth";
import { listNewsletterSubscribers } from "@/lib/cms-content-production";
import { SubscribersCmsClient } from "@/components/admin/subscribers-cms-client";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Email đăng ký nhận bài Blog",
  robots: { index: false, follow: false },
};

export default async function AdminSubscribersPage() {
  const [authState, initial] = await Promise.all([
    getAuthState(),
    listNewsletterSubscribers(),
  ]);
  const isAdmin = authState.user?.role === "admin";
  const initialItems = isAdmin
    ? initial.items
    : initial.items.map((item) => ({
        ...item,
        email: maskEmailAddress(item.email),
      }));

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
            Danh sách Email đăng ký nhận bài mới
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Thu thập tự động từ form &ldquo;Đăng ký nhận bài mới qua email&rdquo; ở cuối các bài viết Blog.
            {isAdmin
              ? " Hỗ trợ tìm kiếm và xuất file CSV chuẩn Excel."
              : " Tài khoản Editor xem email ở chế độ ẩn một phần; chỉ Admin có quyền xuất CSV và xóa."}
          </p>
        </div>

        <Link href="/admin/calendar">
          <Button type="button" size="sm" variant="outline">
            <CalendarDays className="h-3.5 w-3.5" />
            Lịch nội dung
          </Button>
        </Link>
      </div>

      <SubscribersCmsClient
        initialItems={initialItems}
        initialTableReady={initial.tableReady}
        isAdmin={isAdmin}
      />
    </div>
  );
}
