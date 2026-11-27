import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TestsImportClient } from "@/components/admin/tests-import-client";

export const metadata = {
  title: "Nhập hàng loạt đề thi (CSV / JSON)",
  robots: { index: false, follow: false },
};

export default function AdminTestsImportPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/tests"
          className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại Kho Đề thi IELTS
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Nhập hàng loạt đề thi IELTS (CSV / JSON)
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Tải file mẫu chuẩn, tải lên hoặc dán dữ liệu, kiểm tra lỗi từng dòng trước khi nhập.
          Tất cả đề thi sau khi nhập đều tự động lưu ở trạng thái <strong>Nháp</strong> để rà soát trước khi xuất bản.
        </p>
      </div>

      <TestsImportClient />
    </div>
  );
}
