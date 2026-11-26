import React from "react";
import { ShieldAlert } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { getAdminPricingBundle } from "@/lib/cms-system";
import { PricingCmsClient } from "@/components/admin/pricing-cms-client";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gói giá, Khuyến mãi & Referral · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminPricingPage() {
  const authState = await getAuthState();
  if (authState.user?.role !== "admin") {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-red-500" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Chỉ tài khoản Admin mới được quản lý Gói giá &amp; Khuyến mãi
        </h1>
        <p className="text-xs text-slate-500">
          Tài khoản Editor không có quyền chỉnh sửa bảng giá bán, mã giảm giá hay chính sách Referral.
        </p>
      </Card>
    );
  }

  const bundle = await getAdminPricingBundle();
  return (
    <PricingCmsClient
      initialPlans={bundle.plans}
      initialBanner={bundle.banner}
      initialPromoCodes={bundle.promoCodes}
      initialReferrals={bundle.referrals}
      initialReferralConfig={bundle.referralConfig}
    />
  );
}
