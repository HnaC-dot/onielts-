import React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Cpu,
  CreditCard,
  ExternalLink,
  FileCode2,
  FileText,
  Globe,
  GraduationCap,
  Headphones,
  Image as ImageIcon,
  Inbox,
  MessageSquare,
  PenTool,
  Settings,
  SlidersHorizontal,
  Users,
  Video,
  Volume2,
} from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { getAdminDashboardSummary } from "@/lib/admin-auth";
import { formatVnd } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Dashboard Quản trị",
  robots: { index: false, follow: false },
};

const ROADMAP_MODULES = [
  {
    phase: "GĐ1",
    status: "active" as const,
    title: "Phân quyền, Khung CMS & Nhật ký",
    desc: "Role admin/editor/learner, khóa tài khoản, bảo vệ Proxy + Server, tìm nhanh ⌘K, nhật ký hoạt động.",
    href: "/admin/audit",
    icon: Activity,
  },
  {
    phase: "GĐ2",
    status: "next" as const,
    title: "Thư viện Media & Blog + SEO",
    desc: "Upload ảnh/MP3/PDF/SVG lên Supabase Storage, nén ảnh, soạn thảo Blog giàu định dạng + khung SEO & xem trước Google/FB.",
    href: "/admin/legacy?tab=content",
    icon: ImageIcon,
  },
  {
    phase: "GĐ3",
    status: "planned" as const,
    title: "Trình tạo Đề thi & Đề mỗi ngày",
    desc: "Form tạo đủ 8 dạng câu hỏi, tự kiểm tra 40 câu trước xuất bản, lịch đề UTC+7, quản lý bảng quy đổi Band.",
    href: "/admin/legacy?tab=tests",
    icon: BookOpen,
  },
  {
    phase: "GĐ4",
    status: "planned" as const,
    title: "6 Module Học tập & Luyện tập",
    desc: "Khóa học kéo-thả bài, Hội thoại AI, Nâng cấp câu viết, Phát âm IPA, Chép chính tả, Video tương tác (.srt/.vtt).",
    href: "/courses",
    icon: GraduationCap,
  },
  {
    phase: "GĐ5",
    status: "planned" as const,
    title: "Người dùng, Hộp thư & Trang tĩnh",
    desc: "Quản lý user/Premium/gói giá, hộp thư liên hệ & đề xuất tính năng, sửa /about, /legal/*, FAQs và cài đặt chung.",
    href: "/admin/legacy?tab=users",
    icon: Settings,
  },
  {
    phase: "GĐ6",
    status: "planned" as const,
    title: "SEO toàn trang & Redirect 301",
    desc: "Dynamic sitemap.xml, robots.txt, JSON-LD tự động, Twitter summary_large_image, tự tạo 301 khi đổi slug.",
    href: "/sitemap.xml",
    icon: Globe,
  },
];

export default async function AdminDashboardPage() {
  const [authState, summary] = await Promise.all([
    getAuthState(),
    getAdminDashboardSummary(),
  ]);

  const user = authState.user;
  const isAdmin = user?.role === "admin";
  const { counts } = summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Tổng quan CMS Ôn IELTS
            </h1>
            <Badge variant={isAdmin ? "default" : "secondary"}>
              {isAdmin ? "Admin" : "Editor"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {isAdmin
              ? "Toàn quyền quản trị đề thi, nội dung học tập, người dùng, doanh thu và nhật ký hệ thống."
              : "Quyền Biên tập viên (Editor): quản lý nội dung đề thi, blog và tài liệu học tập (không đổi cài đặt hệ thống hay xóa user)."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/legacy">
            <Button size="sm" variant="outline">
              <SlidersHorizontal className="h-4 w-4" />
              Quản trị nhanh (6 Tab)
            </Button>
          </Link>
          <Link href="/admin/audit">
            <Button size="sm">
              <Activity className="h-4 w-4" />
              Nhật ký hoạt động
            </Button>
          </Link>
        </div>
      </div>

      {/* Migration 0005 readiness alert */}
      {!summary.auditTableReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-bold">
              Chưa phát hiện bảng CMS Giai đoạn 1 trên Supabase (0005_admin_cms_schema.sql)
            </p>
            <p className="leading-relaxed">
              Hãy mở Supabase SQL Editor và chạy toàn bộ file{" "}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono dark:bg-amber-900/60">
                supabase/migrations/0005_admin_cms_schema.sql
              </code>{" "}
              để kích hoạt bảng Nhật ký hoạt động, phân quyền Editor, khóa tài khoản và bucket lưu trữ Media.
            </p>
          </div>
        </div>
      )}

      {/* Daily Exam (UTC+7) status */}
      <Card
        id="daily-exam"
        className={`p-4 border ${
          summary.hasDailyExamToday
            ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
            : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {summary.hasDailyExamToday ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CalendarDays className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div className="text-xs">
              <p className="font-bold text-slate-900 dark:text-white">
                Đề thi mỗi ngày ({summary.vnToday} · UTC+7):{" "}
                {summary.hasDailyExamToday ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Đang hoạt động — {summary.dailyExamTitle}
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-300">
                    Chưa có đề gán cho hôm nay
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                Số lượt nộp bài trên bảng xếp hạng hôm nay:{" "}
                <strong>{summary.dailySubmissionsToday}</strong>
              </p>
            </div>
          </div>
          <Link
            href="/daily-exam"
            target="_blank"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Xem trang Đề mỗi ngày
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Kho Đề thi IELTS</span>
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {counts.tests}
          </p>
          <p className="text-[11px] text-slate-500">
            {counts.publishedTests} đã đăng · R:{counts.testsBySkill.reading} · L:
            {counts.testsBySkill.listening} · W:{counts.testsBySkill.writing} · S:
            {counts.testsBySkill.speaking}
          </p>
        </Card>

        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Nội dung Học tập & Blog</span>
            <FileText className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {counts.blogPosts +
              counts.courses +
              counts.videos +
              counts.dictations +
              counts.ipaSounds}
          </p>
          <p className="text-[11px] text-slate-500">
            {counts.publishedBlogPosts}/{counts.blogPosts} Blog · {counts.courses} Khóa ·{" "}
            {counts.videos} Video · {counts.dictations} Dictation · {counts.ipaSounds} IPA
          </p>
        </Card>

        {isAdmin ? (
          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Người dùng & Premium</span>
              <Users className="h-4 w-4 text-violet-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {counts.users}
            </p>
            <p className="text-[11px] text-slate-500">
              {counts.premiumUsers} Premium · {counts.staffCount} Admin/Editor
            </p>
          </Card>
        ) : (
          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Thư viện Media & Hộp thư</span>
              <Inbox className="h-4 w-4 text-violet-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {counts.mediaAssets}
            </p>
            <p className="text-[11px] text-slate-500">
              {counts.unreadContacts} tin liên hệ · {counts.openFeatureRequests} đề xuất mở
            </p>
          </Card>
        )}

        {isAdmin ? (
          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Doanh thu & Chi phí AI</span>
              <CreditCard className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatVnd(counts.totalRevenueVnd)}
            </p>
            <p className="text-[11px] text-slate-500">
              {counts.paidOrders} đơn đã thanh toán · AI: ${counts.totalAiCostUsd.toFixed(4)} (
              {counts.aiCalls} lượt)
            </p>
          </Card>
        ) : (
          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Lượt chấm AI gần đây</span>
              <Cpu className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {counts.aiCalls}
            </p>
            <p className="text-[11px] text-slate-500">
              {counts.totalAiTokens.toLocaleString("vi-VN")} token Gemini
            </p>
          </Card>
        )}
      </div>

      {/* Secondary quick counts strip */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Khóa học", count: counts.courses, icon: GraduationCap },
          { label: "Video tương tác", count: counts.videos, icon: Video },
          { label: "Chép chính tả", count: counts.dictations, icon: Headphones },
          { label: "Phát âm IPA", count: counts.ipaSounds, icon: Volume2 },
          { label: "Tệp Media", count: counts.mediaAssets, icon: ImageIcon },
          {
            label: "Liên hệ / Đề xuất",
            count: counts.unreadContacts + counts.openFeatureRequests,
            icon: Inbox,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <Icon className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {item.count}
                </p>
                <p className="truncate text-[11px] text-slate-500">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main 2-column area: Recent Audit Logs + CMS Roadmap */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Audit Logs */}
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Nhật ký hoạt động gần đây
            </h2>
            <Link
              href="/admin/audit"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Xem tất cả
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {summary.recentAuditLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800">
              <Activity className="mx-auto mb-2 h-5 w-5 opacity-40" />
              Chưa có hoạt động quản trị nào được ghi lại. Mọi thao tác thêm/sửa trên CMS sẽ tự động lưu tại đây.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {summary.recentAuditLogs.map((log) => (
                <div key={log.id} className="py-2.5 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-900 dark:text-white">
                      {log.actor_email || "system"}
                    </span>
                    <Badge
                      variant={log.actor_role === "admin" ? "default" : "secondary"}
                    >
                      {log.actor_role}
                    </Badge>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{log.summary}</p>
                  <p className="font-mono text-[10px] text-slate-400">
                    {log.action} ·{" "}
                    {new Date(log.created_at).toLocaleString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 6-Stage CMS Roadmap */}
        <Card id="roadmap" className="p-5 lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Lộ trình 13 Module Admin CMS (6 Giai đoạn)
              </h2>
              <p className="text-xs text-slate-500">
                Triển khai từng giai đoạn độc lập, không gián đoạn trang public đang chạy.
              </p>
            </div>
            <Badge variant="default">Đang ở GĐ1</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {ROADMAP_MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.phase}
                  href={mod.href}
                  className="group rounded-xl border border-slate-200 p-3.5 transition hover:border-emerald-300 hover:bg-emerald-50/30 dark:border-slate-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                      <Icon className="h-4 w-4 text-emerald-600" />
                      {mod.phase}: {mod.title}
                    </span>
                    <Badge
                      variant={mod.status === "active" ? "default" : "secondary"}
                    >
                      {mod.status === "active"
                        ? "Hoạt động"
                        : mod.status === "next"
                        ? "Tiếp theo"
                        : "Kế hoạch"}
                    </Badge>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {mod.desc}
                  </p>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> Hội thoại AI
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <PenTool className="h-3.5 w-3.5" /> Nâng cấp câu viết
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <FileCode2 className="h-3.5 w-3.5" /> Trang tĩnh & Pháp lý
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
