import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { getBandConversionTables } from "@/lib/db";
import { BandTablesClient } from "@/components/admin/band-tables-client";
import { Card } from "@/components/ui/card";

export const metadata = {
  title: "Bảng quy đổi điểm Band IELTS",
  robots: { index: false, follow: false },
};

export default async function AdminBandTablesPage() {
  const authState = await getAuthState();
  if (authState.user?.role !== "admin") {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Chỉ tài khoản Admin mới được chỉnh Bảng quy đổi Band
        </h1>
        <p className="text-xs text-slate-500">
          Tài khoản Editor chỉ có quyền tạo/sửa nội dung và đề thi, không được thay đổi cấu hình quy đổi điểm toàn hệ thống.
        </p>
      </Card>
    );
  }

  const rows = await getBandConversionTables();

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
          Bảng quy đổi số câu đúng sang điểm Band IELTS
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Dùng trực tiếp cho công cụ <code>/band-calculator</code> và hệ thống tự chấm đề thi 40 câu Reading Academic, Reading General và Listening.
        </p>
      </div>

      <BandTablesClient initialRows={rows} />
    </div>
  );
}
