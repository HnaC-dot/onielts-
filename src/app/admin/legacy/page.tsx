import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin-auth";
import {
  getBandConversionTables,
  getBlogPosts,
  getIeltsTestSummaries,
  getPricingPlans,
  getPromoBanner,
  getPromoCodes,
  listAiUsageLogs,
  listAllProfiles,
  listOrders,
} from "@/lib/db";
import { AdminClient, type AdminLegacyTab } from "@/components/admin-client";

export const metadata = {
  title: "Quản trị nhanh (6 Tab)",
  robots: { index: false, follow: false },
};

const VALID_TABS: AdminLegacyTab[] = [
  "ai",
  "bands",
  "pricing",
  "tests",
  "content",
  "users",
];

const EDITOR_ALLOWED_TABS = new Set<AdminLegacyTab>(["tests", "content", "ai"]);

export default async function AdminLegacyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [params, authState] = await Promise.all([searchParams, getAuthState()]);
  const user = authState.user;

  if (!user || !isStaffRole(user.role) || user.is_locked) {
    return null;
  }

  const isAdmin = user.role === "admin";
  const requestedTab = VALID_TABS.includes(params.tab as AdminLegacyTab)
    ? (params.tab as AdminLegacyTab)
    : isAdmin
    ? "ai"
    : "tests";

  const initialTab: AdminLegacyTab =
    !isAdmin && !EDITOR_ALLOWED_TABS.has(requestedTab) ? "tests" : requestedTab;

  const [aiLogs, tests, blogPosts, banner] = await Promise.all([
    listAiUsageLogs(100),
    getIeltsTestSummaries(true),
    getBlogPosts(true),
    getPromoBanner(),
  ]);

  const [profiles, bandRows, plans, promoCodes, orders] = isAdmin
    ? await Promise.all([
        listAllProfiles(),
        getBandConversionTables(),
        getPricingPlans(true),
        getPromoCodes(),
        listOrders(),
      ])
    : [[], [], [], [], []];

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin"
          className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại Dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Quản trị nhanh (6 Tab)
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {isAdmin
            ? "Toàn bộ công cụ quản trị hiện có (Đề thi, Blog, Bảng Band, Gói giá, Người dùng, Chi phí AI) kèm ghi nhật ký hoạt động tự động."
            : "Chế độ Biên tập viên (Editor): chỉ hiển thị các tab quản lý nội dung Đề thi, Blog và theo dõi AI."}
        </p>
      </div>

      <AdminClient
        key={initialTab}
        initialTab={initialTab}
        userRole={user.role}
        currentUserId={user.id}
        profiles={profiles}
        bandRows={bandRows}
        plans={plans}
        banner={banner}
        promoCodes={promoCodes}
        orders={orders}
        aiLogs={aiLogs}
        tests={tests}
        blogPosts={blogPosts}
      />
    </div>
  );
}
