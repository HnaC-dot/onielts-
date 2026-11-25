import React from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
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
            Vui lòng đăng nhập bằng tài khoản có quyền <code>admin</code> (trong chế độ dùng thử cục bộ, hãy chọn tài khoản Quản trị viên trên trang Đăng nhập).
          </p>
          <Link href="/auth">
            <Button>Đi tới trang Đăng nhập</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const store = readStore();

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
        profiles={store.profiles}
        bandRows={store.band_conversion_tables}
        plans={store.pricing_plans}
        banner={store.promo_banner}
        promoCodes={store.promo_codes}
        orders={store.orders}
        aiLogs={store.ai_usage_logs}
        tests={store.ielts_tests}
        blogPosts={store.blog_posts}
      />
    </div>
  );
}
