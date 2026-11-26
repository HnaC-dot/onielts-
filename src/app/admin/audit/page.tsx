import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listAuditLogs } from "@/lib/admin-auth";
import { AuditLogsClient } from "@/components/admin/audit-logs-client";

export const metadata = {
  title: "Nhật ký hoạt động",
  robots: { index: false, follow: false },
};

export default async function AdminAuditPage() {
  const initial = await listAuditLogs({ page: 1, pageSize: 20 });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Nhật ký hoạt động quản trị (Audit Logs)
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Theo dõi toàn bộ thao tác tạo, chỉnh sửa, khóa tài khoản và thay đổi cấu hình của Admin &amp; Editor theo giờ Việt Nam (UTC+7).
          </p>
        </div>
      </div>

      <AuditLogsClient
        initialItems={initial.items}
        initialTotal={initial.total}
        initialTableReady={initial.tableReady}
      />
    </div>
  );
}
