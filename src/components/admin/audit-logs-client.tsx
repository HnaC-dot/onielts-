"use client";

import React, { useCallback, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import type { AdminAuditLog } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AuditLogsClientProps {
  initialItems: AdminAuditLog[];
  initialTotal: number;
  initialTableReady: boolean;
}

const ENTITY_FILTERS = [
  { value: "", label: "Tất cả loại" },
  { value: "ielts_test", label: "Đề thi IELTS" },
  { value: "daily_exam", label: "Lịch Đề mỗi ngày" },
  { value: "daily_exam_attempt", label: "BXH Đề mỗi ngày" },
  { value: "band_conversion", label: "Bảng quy đổi Band" },
  { value: "media_asset", label: "Thư viện Media" },
  { value: "blog_post", label: "Blog & Mẹo thi" },
  { value: "course", label: "Khóa học & Bài học" },
  { value: "conversation_topic", label: "Hội thoại AI" },
  { value: "writing_exercise", label: "Nâng cấp câu viết" },
  { value: "pronunciation_sound", label: "Phát âm IPA" },
  { value: "dictation_lesson", label: "Chép chính tả" },
  { value: "learn_video", label: "Video tương tác" },
  { value: "profile", label: "Người dùng / Role" },
  { value: "pricing_plan", label: "Gói giá" },
  { value: "promo_code", label: "Mã giảm giá" },
  { value: "promo_banner", label: "Banner" },
  { value: "contact_message", label: "Hộp thư Liên hệ" },
  { value: "feature_request", label: "Đề xuất tính năng" },
  { value: "static_page", label: "Trang tĩnh & Pháp lý" },
  { value: "faq", label: "Câu hỏi FAQ" },
  { value: "site_settings", label: "Cài đặt chung / SEO / Referral" },
  { value: "appearance", label: "Giao diện & Trang chủ" },
  { value: "seo_redirect", label: "Redirect 301 / 302" },
];

export function AuditLogsClient({
  initialItems,
  initialTotal,
  initialTableReady,
}: AuditLogsClientProps) {
  const [items, setItems] = useState<AdminAuditLog[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [tableReady, setTableReady] = useState(initialTableReady);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const fetchLogs = useCallback(
    async (nextPage: number, q: string, entity: string, role: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: String(pageSize),
        });
        if (q.trim()) params.set("q", q.trim());
        if (entity) params.set("entityType", entity);
        if (role) params.set("actorRole", role);
        const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items ?? []);
          setTotal(data.total ?? 0);
          setTableReady(Boolean(data.tableReady));
          setPage(data.page ?? nextPage);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {!tableReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Bảng <code>public.admin_audit_logs</code> chưa được tạo trên Supabase. Hãy chạy file migration{" "}
          <code>supabase/migrations/0005_admin_cms_schema.sql</code> trong Supabase SQL Editor rồi bấm tải lại.
        </div>
      )}

      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchLogs(1, search, entityType, actorRole);
          }}
          className="flex flex-wrap items-center gap-2.5"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo email, hành động, nội dung..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              fetchLogs(1, search, e.target.value, actorRole);
            }}
            aria-label="Lọc theo đối tượng"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {ENTITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={actorRole}
            onChange={(e) => {
              setActorRole(e.target.value);
              fetchLogs(1, search, entityType, e.target.value);
            }}
            aria-label="Lọc theo vai trò"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="">Mọi vai trò</option>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
          </select>
          <Button type="submit" size="sm" disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Lọc
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold">Người thực hiện</th>
                <th className="px-4 py-3 font-semibold">Hành động</th>
                <th className="px-4 py-3 font-semibold">Đối tượng</th>
                <th className="px-4 py-3 font-semibold">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    <Activity className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    Chưa có bản ghi nhật ký hoạt động nào phù hợp.
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-500">
                      {new Date(log.created_at).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {log.actor_email || "system"}
                      </p>
                      <Badge
                        variant={log.actor_role === "admin" ? "default" : "secondary"}
                      >
                        {log.actor_role}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-800">
                        {log.action}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {log.entity_label || log.entity_id || "-"}
                      </p>
                      <p className="text-[11px] text-slate-500">{log.entity_type}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {log.summary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
          <span>
            Tổng <strong>{total}</strong> bản ghi · Trang {page}/{totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => fetchLogs(page - 1, search, entityType, actorRole)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => fetchLogs(page + 1, search, entityType, actorRole)}
            >
              Sau
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
