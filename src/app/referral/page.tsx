import React from "react";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { ReferralClient } from "@/components/referral-client";

export const metadata = {
  title: "Mời bạn bè ôn thi IELTS cùng nhau",
  description:
    "Chia sẻ liên kết giới thiệu Ôn IELTS và theo dõi lượt đăng ký, nâng cấp của bạn bè.",
};

export default async function ReferralPage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const isEn = locale === "en";
  const store = readStore();
  const userId = user?.id ?? "demo-free-001";
  const profile = store.profiles.find((p) => p.id === userId) ?? store.profiles[0];
  const referrals = store.referrals.filter((r) => r.referrer_id === profile.id);

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
      <ReferralClient referralCode={profile.referral_code} referrals={referrals} />
    </div>
  );
}
