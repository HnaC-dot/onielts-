import React from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  getBandConversionTables,
  getBlogPosts,
  getIeltsTests,
  getPricingPlans,
  getPromoBanner,
  getPromoCodes,
  listAiUsageLogs,
  listAllProfiles,
  listOrders,
} from "@/lib/db";
import { AdminClient } from "@/components/admin-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Bảng điều khiển Quản trị — Ôn IELTS",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Card className="p-8 space-y-4">
          <Shield className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Khu vực dành riêng cho Quản trị viên (Admin)
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Vui lòng đăng nhập bằng tài khoản có quyền <code>admin</code>.
          </p>
          <Link href="/auth">
            <Button>Đi tới trang Đăng nhập</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const [
    profiles,
    bandRows,
    plans,
    banner,
    promoCodes,
    orders,
    aiLogs,
    tests,
    blogPosts,
  ] = await Promise.all([
    listAllProfiles(),
    getBandConversionTables(),
    getPricingPlans(true),
    getPromoBanner(),
    getPromoCodes(),
    listOrders(),
    listAiUsageLogs(100),
    getIeltsTests(true),
    getBlogPosts(true),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Trung tâm Quản trị Ôn IELTS
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Quản lý đề thi, bảng quy đổi Band Reading/Listening, giá gói Premium, mã giảm giá, nội dung và theo dõi chi phí AI theo thời gian thực.
        </p>
      </div>

      <AdminClient
        profiles={profiles}
        bandRows={bandRows}
        plans={plans}
        banner={banner}
        promoCodes={promoCodes}
        orders={orders}
        aiLogs={aiLogs}
        tests={tests}
        blogPosts={blogPosts}
      />
    </div>
  );
}
