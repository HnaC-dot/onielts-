import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getUserReferrals } from "@/lib/db";
import { getReferralConfig } from "@/lib/site-content";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { ReferralClient } from "@/components/referral-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  const refCfg = await getReferralConfig();
  return buildPublicPageMetadata({
    title: "Mời bạn bè ôn thi IELTS cùng nhau",
    description:
      refCfg.headlineVi ||
      "Chia sẻ liên kết giới thiệu Ôn IELTS và theo dõi lượt đăng ký, nâng cấp của bạn bè.",
    pathname: "/referral",
    type: "website",
  });
}

export default async function ReferralPage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const isEn = locale === "en";

  if (!user && isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Card className="p-8 space-y-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {isEn
              ? "Sign in to get your personal referral link"
              : "Đăng nhập để lấy liên kết giới thiệu cá nhân"}
          </h1>
          <Link href="/auth">
            <Button>{isEn ? "Sign in" : "Đăng nhập ngay"}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const referralCode = user?.referral_code ?? "MINHANH26";
  const referrals = await getUserReferrals(user?.id ?? null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "Referral Program (Tracking)" : "Mời bạn bè cùng ôn IELTS"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Invite friends with your unique link and track signups and Premium upgrades transparently."
            : "Gửi đường dẫn cá nhân cho bạn bè luyện thi cùng nhau và theo dõi minh bạch các lượt tham gia."}
        </p>
      </div>
      <ReferralClient referralCode={referralCode} referrals={referrals} />
    </div>
  );
}
