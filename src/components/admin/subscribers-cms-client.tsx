"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Mail, RefreshCw, Search, Trash2 } from "lucide-react";
import type { NewsletterSubscriber } from "@/lib/content-production-shared";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SubscribersCmsClientProps {
  initialItems: NewsletterSubscriber[];
  initialTableReady: boolean;
}

export function SubscribersCmsClient({
  initialItems,
  initialTableReady,
}: SubscribersCmsClientProps) {
  const toast = useAdminToast();
  const [items, setItems] = useState<NewsletterSubscriber[]>(initialItems);
  const [tableReady, setTableReady] = useState(initialTableReady);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NewsletterSubscriber | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (s) =>
        s.email.toLowerCase().includes(query) ||
        (s.source_slug ?? "").toLowerCase().includes(query)
    );
  }, [items, q]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscribers");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        if (typeof data.tableReady === "boolean") setTableReady(data.tableReady);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/subscribers?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể xóa email.");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      toast.success(`Đã xóa ${deleteTarget.email} khỏi danh sách.`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const exportUrl = q.trim()
    ? `/api/admin/subscribers?format=csv&q=${encodeURIComponent(q.trim())}`
    : "/api/admin/subscribers?format=csv";

  return (
    <div className="space-y-4">
      {!tableReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Danh sách đang lưu tạm an toàn trong <code>site_settings</code> vì bảng{" "}
          <code>public.newsletter_subscribers</code> chưa được tạo. Hãy chạy file{" "}
          <code>supabase/migrations/0007_content_production.sql</code> trong Supabase SQL Editor.
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-[220px]">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo email hoặc slug bài viết nguồn..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <Badge variant="secondary">Tổng: {filtered.length} email</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => void handleRefresh()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Tải lại
            </Button>
            <a href={exportUrl} download>
              <Button type="button" size="sm" disabled={filtered.length === 0}>
                <Download className="h-3.5 w-3.5" />
                Xuất danh sách CSV ({filtered.length})
              </Button>
            </a>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Email đăng ký</th>
                <th className="px-4 py-3 font-semibold">Bài viết nguồn</th>
                <th className="px-4 py-3 font-semibold">Ngôn ngữ</th>
                <th className="px-4 py-3 font-semibold">Ngày đăng ký</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    <Mail className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    Chưa có email đăng ký nhận bài viết nào.
                  </td>
                </tr>
              ) : (
                filtered.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {sub.email}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {sub.source_slug ? (
                        <Link
                          href={`/blog/${sub.source_slug}`}
                          target="_blank"
                          className="font-mono text-[11px] text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          /blog/{sub.source_slug}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Trang Blog</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{sub.locale.toUpperCase()}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(sub.subscribed_at).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(sub)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Xóa ${sub.email}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa email đăng ký"
        description={`Xóa email "${deleteTarget?.email ?? ""}" khỏi danh sách nhận bài mới?`}
        confirmLabel="Xóa"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
