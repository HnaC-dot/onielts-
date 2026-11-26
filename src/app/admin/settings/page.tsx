import React from "react";
import { ShieldAlert } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { getAdminGeneralSettings } from "@/lib/cms-system";
import { SettingsCmsClient } from "@/components/admin/settings-cms-client";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cài đặt chung · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const authState = await getAuthState();
  if (authState.user?.role !== "admin") {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Chỉ tài khoản Admin mới được chỉnh Cài đặt chung
        </h1>
        <p className="text-xs text-slate-500">
          Tài khoản Editor không có quyền thay đổi cấu hình thương hiệu, liên hệ và thanh thông báo toàn trang.
        </p>
      </Card>
    );
  }

  const settings = await getAdminGeneralSettings();
  return <SettingsCmsClient initialSettings={settings} />;
}
