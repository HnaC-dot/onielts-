"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import type { SessionUser, WritingSubmission } from "@/lib/types";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function ProfileClient({
  user,
  submissions: initialSubs,
}: {
  user: SessionUser;
  submissions: WritingSubmission[];
}) {
  const locale = useLocale();
  const isEn = locale === "en";
  const router = useRouter();

  const [fullName, setFullName] = useState(user.full_name);
  const [targetBand, setTargetBand] = useState(user.target_band);
  const [currentBand, setCurrentBand] = useState(user.current_band ?? 5.5);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [submissions, setSubmissions] = useState(initialSubs);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          target_band: Number(targetBand),
          current_band: Number(currentBand),
        }),
      });
      if (res.ok) {
        setSavedMsg(isEn ? "Profile updated!" : "Đã lưu hồ sơ học tập!");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleEssayPrivacy = async (sub: WritingSubmission) => {
    const res = await fetch("/api/writing/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sub.id, is_public: !sub.is_public }),
    });
    if (res.ok) {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, is_public: !s.is_public } : s))
      );
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="p-6 lg:col-span-7 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEn ? "Account Details & Band Target" : "Thông tin tài khoản & Mục tiêu Band"}
          </h2>
          <Badge variant={user.email_verified ? "default" : "amber"}>
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            {user.email_verified
              ? isEn
                ? "Email Verified"
                : "Email đã xác minh"
              : isEn
              ? "Unverified"
              : "Chưa xác minh"}
          </Badge>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              type="text"
              disabled
              value={user.email}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isEn ? "Display Name" : "Họ tên hiển thị"}
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {isEn ? "Current Band" : "Trình độ hiện tại"}
              </label>
              <select
                value={currentBand}
                onChange={(e) => setCurrentBand(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {[4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5].map((b) => (
                  <option key={b} value={b}>
                    Band {b.toFixed(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {isEn ? "Target Band" : "Mục tiêu Band IELTS"}
              </label>
              <select
                value={targetBand}
                onChange={(e) => setTargetBand(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {[5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0].map((b) => (
                  <option key={b} value={b}>
                    Band {b.toFixed(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEn ? "Save Changes" : "Lưu thay đổi"}
            </Button>
            {savedMsg && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {savedMsg}
              </span>
            )}
          </div>
        </form>
      </Card>

      {/* Subscription Card */}
      <Card className="p-6 lg:col-span-5 flex flex-col justify-between space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Crown className={`h-6 w-6 ${user.isPremium ? "text-amber-500" : "text-slate-400"}`} />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {user.role === "admin"
                ? "Tài khoản Quản trị (Admin)"
                : user.isPremium
                ? "Gói Ôn IELTS Premium"
                : "Gói Miễn phí (Free)"}
            </h2>
          </div>

          {user.isPremium ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isEn ? "Unlimited AI scoring active until: " : "Bạn đang mở khóa toàn bộ AI không giới hạn đến ngày: "}
              <strong className="text-emerald-700 dark:text-emerald-400">
                {user.premium_expires_at
                  ? new Date(user.premium_expires_at).toLocaleDateString("vi-VN")
                  : "Không giới hạn"}
              </strong>
            </p>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isEn
                ? "Upgrade to Premium for unlimited AI Writing & Speaking evaluations and Band 9 generators."
                : "Nâng cấp Premium để chấm Writing/Speaking không giới hạn, tạo bài mẫu Band 9 và xem phân tích lỗi chuyên sâu."}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/pricing">
            <Button size="sm">
              {user.isPremium
                ? isEn
                  ? "Extend Premium"
                  : "Gia hạn thêm gói"
                : isEn
                ? "Upgrade to Premium"
                : "Nâng cấp Premium"}
            </Button>
          </Link>
          <Link href="/progress">
            <Button variant="outline" size="sm">
              {isEn ? "View Progress" : "Xem bảng Tiến độ"}
            </Button>
          </Link>
        </div>
      </Card>

      {/* Writing Essay Privacy Controls */}
      <Card className="p-6 lg:col-span-12 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {isEn
              ? "Writing Submissions Privacy (Private by Default)"
              : "Quản lý quyền riêng tư bài viết Writing (Mặc định Riêng tư)"}
          </h2>
          <p className="text-xs text-slate-500">
            {isEn
              ? "Your essays stay private unless you explicitly opt in to share them."
              : "Mọi bài luận bạn nộp chỉ hiển thị với chính bạn trừ khi bạn chủ động bật Công khai."}
          </p>
        </div>

        {submissions.length === 0 ? (
          <p className="text-xs text-slate-500">
            {isEn ? "No writing submissions yet." : "Bạn chưa nộp bài Writing nào."}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
              >
                <div className="min-w-0 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <Badge>Band {sub.overall_band.toFixed(1)}</Badge>
                    <span className="font-semibold text-slate-500">{sub.task_type}</span>
                    <span className="text-slate-400">{sub.word_count} từ</span>
                  </div>
                  <p className="mt-1 truncate text-slate-700 dark:text-slate-300">
                    {sub.prompt_text}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => toggleEssayPrivacy(sub)}
                >
                  {sub.is_public ? (
                    <>
                      <Eye className="h-3.5 w-3.5 text-emerald-600" />
                      Công khai
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                      Riêng tư
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
