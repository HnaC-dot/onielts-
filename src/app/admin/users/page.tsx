import React from "react";
import { ShieldAlert } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { listAdminUsers } from "@/lib/cms-system";
import { UsersCmsClient } from "@/components/admin/users-cms-client";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Người dùng & Premium · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage() {
  const authState = await getAuthState();
  if (authState.user?.role !== "admin") {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Chỉ tài khoản Admin mới được quản lý Người dùng &amp; Premium
        </h1>
        <p className="text-xs text-slate-500">
          Tài khoản Editor không có quyền đổi vai trò, khóa tài khoản hay cấp/thu hồi Premium.
        </p>
      </Card>
    );
  }

  const data = await listAdminUsers({ page: 1, pageSize: 100 });
  return (
    <UsersCmsClient
      currentAdminId={authState.user.id}
      initialUsers={data.items}
      initialOrders={data.orders}
      initialStats={data.stats}
    />
  );
}
