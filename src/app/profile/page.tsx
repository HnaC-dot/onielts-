import React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getLocale } from "next-intl/server";
import { getAuthState } from "@/lib/auth";
import { getUserWritingSubmissions } from "@/lib/db";
import { ProfileClient } from "@/components/profile-client";
import { AuthErrorActions } from "@/components/auth-error-actions";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Hồ sơ cá nhân & Quyền riêng tư",
    description:
      "Quản lý thông tin tài khoản, gói Premium, cài đặt quyền riêng tư bài viết Writing và ghi âm Speaking trên Ôn IELTS.",
    pathname: "/profile",
    type: "website",
    noindex: true,
  });
}

export default async function ProfilePage() {
  const [locale, authState] = await Promise.all([getLocale(), getAuthState()]);
  const isEn = locale === "en";

  if (authState.status === "profile_error") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Card className="p-8 space-y-4">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isEn
              ? "Signed in, but your profile could not be loaded"
              : "Đã đăng nhập, nhưng không thể tải hồ sơ"}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isEn
              ? "Your Supabase session is active, but the server could not read or create your row in public.profiles. Please retry or check your Supabase schema & RLS policies."
              : "Phiên đăng nhập Supabase của bạn đang hoạt động, nhưng máy chủ chưa thể đọc hoặc tạo hồ sơ trong bảng public.profiles. Vui lòng thử tải lại hoặc kiểm tra cấu hình Supabase."}
          </p>
          {authState.errorCode && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEn ? "Error code: " : "Mã lỗi: "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono dark:bg-slate-800">
                {authState.errorCode}
              </code>
            </p>
          )}
          <AuthErrorActions isEn={isEn} showLogout />
        </Card>
      </div>
    );
  }

  const user = authState.user;

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Card className="p-8 space-y-4">
          <h1 className="text-xl font-bold">
            {isEn ? "Sign in to view your Profile" : "Đăng nhập để quản lý hồ sơ"}
          </h1>
          <Link href="/auth?next=/profile">
            <Button>{isEn ? "Sign in" : "Đăng nhập ngay"}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const submissions = await getUserWritingSubmissions(user.id, false);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "Learner Profile" : "Hồ sơ học viên"}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Manage your target IELTS band, subscription status, and essay privacy."
            : "Cập nhật mục tiêu điểm Band, theo dõi gói Premium và quản lý quyền riêng tư bài viết."}
        </p>
      </div>
      <ProfileClient user={user} submissions={submissions} />
    </div>
  );
}
