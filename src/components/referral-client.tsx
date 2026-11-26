"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import { Check, Copy, Gift, Users } from "lucide-react";
import type { ReferralRecord } from "@/lib/types";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function ReferralClient({
  referralCode,
  referrals,
  siteBaseUrl = "https://onielts.vn",
}: {
  referralCode: string;
  referrals: ReferralRecord[];
  siteBaseUrl?: string;
}) {
  const locale = useLocale();
  const isEn = locale === "en";
  const [copied, setCopied] = useState(false);

  const shareUrl = `${siteBaseUrl.replace(/\/+$/, "")}/auth?ref=${referralCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const convertedCount = referrals.filter((r) => r.status === "converted_premium").length;

  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8 bg-emerald-50/50 border-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/30 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEn ? "Your Personal Referral Link" : "Liên kết giới thiệu của riêng bạn"}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {isEn
                ? "Tracking-only MVP — records every signup and Premium conversion linked to your code (no automatic payouts yet)."
                : "Phiên bản MVP theo dõi tự động lượt đăng ký và nâng cấp Premium qua mã của bạn (chưa tự động chi trả hoa hồng)."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          />
          <Button type="button" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? (isEn ? "Copied!" : "Đã sao chép!") : isEn ? "Copy Link" : "Sao chép link"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-slate-500">{isEn ? "Your Code" : "Mã giới thiệu"}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {referralCode}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500">{isEn ? "Friends Signed Up" : "Bạn bè đã đăng ký"}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{referrals.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500">{isEn ? "Upgraded to Premium" : "Đã nâng cấp Premium"}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {convertedCount}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <Users className="h-4 w-4 text-emerald-600" />
          {isEn ? "Tracked Referrals" : "Danh sách lượt giới thiệu đã ghi nhận"}
        </h3>
        {referrals.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            {isEn ? "Share your link above to invite study buddies!" : "Chia sẻ đường dẫn phía trên cho bạn bè cùng ôn IELTS nhé!"}
          </p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{r.referred_email}</p>
                  <p className="text-slate-500">
                    {new Date(r.created_at).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <Badge variant={r.status === "converted_premium" ? "default" : "secondary"}>
                  {r.status === "converted_premium" ? "Premium" : "Đã đăng ký"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
