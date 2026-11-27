import React from "react";
import { getAdminAnonymousAnalytics } from "@/lib/progress-analytics";
import { AnalyticsCmsClient } from "@/components/admin/analytics-cms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Thống kê học tập (Ẩn danh) · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsPage() {
  const analytics = await getAdminAnonymousAnalytics();
  return <AnalyticsCmsClient initialData={analytics} />;
}
