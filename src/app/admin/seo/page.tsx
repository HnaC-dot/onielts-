import React from "react";
import { ShieldAlert } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import {
  getAdminSeoSettings,
  getSeoHealthAudit,
  listAdminSeoRedirects,
} from "@/lib/cms-seo";
import { getAppBaseUrl } from "@/lib/seo";
import { SeoCmsClient } from "@/components/admin/seo-cms-client";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SEO toàn trang & Redirect 301 · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminSeoPage() {
  const authState = await getAuthState();
  if (authState.user?.role !== "admin") {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Chỉ tài khoản Admin mới được quản lý SEO toàn trang &amp; Redirect 301
        </h1>
        <p className="text-xs text-slate-500">
          Tài khoản Editor vẫn có thể chỉnh khung SEO riêng trên từng bài Blog, Đề thi, Khóa học và Trang tĩnh.
        </p>
      </Card>
    );
  }

  const [settings, redirects, health] = await Promise.all([
    getAdminSeoSettings(),
    listAdminSeoRedirects(),
    getSeoHealthAudit(),
  ]);

  return (
    <SeoCmsClient
      initialSettings={settings}
      initialRedirects={redirects}
      initialHealth={health}
      baseUrl={getAppBaseUrl()}
    />
  );
}
