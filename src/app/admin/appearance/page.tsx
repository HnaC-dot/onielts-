import React from "react";
import { ShieldAlert } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { getAdminAppearanceBundle } from "@/lib/cms-appearance";
import { AppearanceCmsClient } from "@/components/admin/appearance-cms-client";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Giao diện & Trang chủ · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminAppearancePage() {
  const authState = await getAuthState();
  if (authState.user?.role !== "admin") {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Chỉ tài khoản Admin mới được quản lý Giao diện &amp; Trang chủ
        </h1>
        <p className="text-xs text-slate-500">
          Tài khoản Editor không có quyền chỉnh sửa bố cục trang chủ, màu sắc, menu, footer hay chế độ bảo trì.
        </p>
      </Card>
    );
  }

  const bundle = await getAdminAppearanceBundle();
  return (
    <AppearanceCmsClient
      initialPublished={bundle.published}
      initialDraft={bundle.draft}
      initialHistory={bundle.history}
      initialHasUnpublished={bundle.hasUnpublishedChanges}
    />
  );
}
