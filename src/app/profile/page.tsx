import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserWritingSubmissions } from "@/lib/db";
import { ProfileClient } from "@/components/profile-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Hồ sơ cá nhân & Quyền riêng tư",
};

export default async function ProfilePage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const isEn = locale === "en";

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Card className="p-8 space-y-4">
          <h1 className="text-xl font-bold">
            {isEn ? "Sign in to view your Profile" : "Đăng nhập để quản lý hồ sơ"}
          </h1>
          <Link href="/auth">
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
