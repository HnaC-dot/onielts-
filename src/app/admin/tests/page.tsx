import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listAdminTests } from "@/lib/cms-tests";
import { TestsListClient } from "@/components/admin/tests-list-client";

export const metadata = {
  title: "Quản lý Đề thi IELTS",
  robots: { index: false, follow: false },
};

export default async function AdminTestsPage() {
  const initial = await listAdminTests({ page: 1, pageSize: 15 });

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
          Kho Đề thi IELTS (Reading · Listening · Writing · Speaking)
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Tạo và chỉnh sửa đề thi trực quan không cần viết JSON, upload MP3/SVG sơ đồ, kiểm tra tự động đủ 40 câu &amp; đáp án trước khi xuất bản.
        </p>
      </div>

      <TestsListClient
        initialItems={initial.items}
        initialTotal={initial.total}
        initialSampleIds={initial.sampleIds}
        initialSampleTotal={initial.sampleTotal}
      />
    </div>
  );
}
