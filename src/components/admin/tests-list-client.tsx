"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  ExternalLink,
  Headphones,
  Mic,
  Pencil,
  PenTool,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import type { IeltsTest } from "@/lib/types";
import { validateTestForPublish } from "@/lib/test-cms-shared";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TestsListClientProps {
  initialItems: IeltsTest[];
  initialTotal: number;
}

const SKILL_ICON = {
  reading: BookOpen,
  listening: Headphones,
  writing: PenTool,
  speaking: Mic,
} as const;

export function TestsListClient({
  initialItems,
  initialTotal,
}: TestsListClientProps) {
  const router = useRouter();
  const toast = useAdminToast();
  const [items, setItems] = useState<IeltsTest[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [mod, setMod] = useState("");
  const [published, setPublished] = useState("");
  const [premium, setPremium] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IeltsTest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [under40Warning, setUnder40Warning] = useState<{
    test: IeltsTest;
    count: number;
  } | null>(null);

  const pageSize = 15;

  const fetchTests = useCallback(
    async (
      nextPage: number,
      search: string,
      nextSkill: string,
      nextMod: string,
      nextPub: string,
      nextPrem: string
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: String(pageSize),
        });
        if (search.trim()) params.set("q", search.trim());
        if (nextSkill) params.set("skill", nextSkill);
        if (nextMod) params.set("module", nextMod);
        if (nextPub) params.set("published", nextPub);
        if (nextPrem) params.set("premium", nextPrem);
        const res = await fetch(`/api/admin/tests?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items ?? []);
          setTotal(data.total ?? 0);
          setPage(data.page ?? nextPage);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleTogglePublish = async (test: IeltsTest) => {
    const nextPub = !test.is_published;
    const isObj = test.skill === "reading" || test.skill === "listening";
    const check = validateTestForPublish(test);

    if (nextPub && isObj && check.questionCount < 40) {
      setUnder40Warning({ test, count: check.questionCount });
      toast.error(
        `Cảnh báo: Đề ${test.skill === "reading" ? "Reading" : "Listening"} mới có ${check.questionCount}/40 câu — chưa đủ 40 câu để xuất bản!`
      );
      return;
    }

    setBusyId(test.id);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_test_publish",
          id: test.id,
          is_published: nextPub,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể đổi trạng thái xuất bản đề thi.");
        return;
      }
      toast.success(
        nextPub
          ? `Đã công khai đề "${test.title_vi}"!`
          : `Đã ẩn (chuyển về Nháp) đề "${test.title_vi}".`
      );
      await fetchTests(page, q, skill, mod, published, premium);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (test: IeltsTest) => {
    setBusyId(test.id);
    try {
      const res = await fetch(`/api/admin/tests/${test.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể nhân bản đề thi.");
        return;
      }
      toast.success(`Đã nhân bản thành đề nháp "${data.test.title_vi}"`);
      await fetchTests(1, q, skill, mod, published, premium);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/tests/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể xóa đề thi.");
        return;
      }
      toast.success(`Đã xóa đề thi "${deleteTarget.title_vi}"`);
      setDeleteTarget(null);
      await fetchTests(page, q, skill, mod, published, premium);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void fetchTests(1, q, skill, mod, published, premium);
          }}
          className="flex flex-wrap items-center gap-2.5"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên đề, slug, mô tả..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <select
            value={skill}
            onChange={(e) => {
              setSkill(e.target.value);
              void fetchTests(1, q, e.target.value, mod, published, premium);
            }}
            aria-label="Lọc kỹ năng"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Mọi kỹ năng</option>
            <option value="reading">Reading</option>
            <option value="listening">Listening</option>
            <option value="writing">Writing</option>
            <option value="speaking">Speaking</option>
          </select>
          <select
            value={mod}
            onChange={(e) => {
              setMod(e.target.value);
              void fetchTests(1, q, skill, e.target.value, published, premium);
            }}
            aria-label="Lọc hình thức"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Academic &amp; General</option>
            <option value="academic">Academic</option>
            <option value="general">General Training</option>
          </select>
          <select
            value={published}
            onChange={(e) => {
              setPublished(e.target.value);
              void fetchTests(1, q, skill, mod, e.target.value, premium);
            }}
            aria-label="Lọc trạng thái"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Mọi trạng thái</option>
            <option value="true">Đã đăng</option>
            <option value="false">Nháp</option>
          </select>
          <select
            value={premium}
            onChange={(e) => {
              setPremium(e.target.value);
              void fetchTests(1, q, skill, mod, published, e.target.value);
            }}
            aria-label="Lọc Free/Premium"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Free &amp; Premium</option>
            <option value="false">Miễn phí (Free)</option>
            <option value="true">Premium</option>
          </select>
          <Button type="submit" size="sm" variant="outline" disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Lọc
          </Button>
          <Link href="/admin/tests/new">
            <Button type="button" size="sm">
              <Plus className="h-4 w-4" /> Tạo đề thi mới
            </Button>
          </Link>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Đề thi</th>
                <th className="px-4 py-3 font-semibold">Loại &amp; Thời lượng</th>
                <th className="px-4 py-3 font-semibold">Kiểm tra 40 câu</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    Không có đề thi nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                items.map((test) => {
                  const Icon = SKILL_ICON[test.skill];
                  const check = validateTestForPublish(test);
                  const isObj =
                    test.skill === "reading" || test.skill === "listening";
                  const previewUrl = test.is_published
                    ? `/tests/${test.slug}`
                    : `/tests/${test.slug}?preview=1`;

                  return (
                    <tr
                      key={test.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50"
                    >
                      <td className="px-4 py-3 max-w-sm">
                        <Link
                          href={`/admin/tests/${test.id}`}
                          className="line-clamp-1 font-bold text-slate-900 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-400"
                        >
                          {test.title_vi}
                        </Link>
                        <p className="truncate font-mono text-[11px] text-slate-500">
                          /tests/{test.slug}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {test.is_premium && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              <Crown className="h-2.5 w-2.5" /> Premium
                            </span>
                          )}
                          {test.is_daily_eligible && (
                            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                              Đề mỗi ngày
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap space-y-1">
                        <div className="inline-flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="font-bold uppercase">{test.skill}</span>
                          <Badge variant="secondary">
                            {test.module === "academic" ? "Academic" : "General"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {test.duration_minutes} phút · {test.difficulty.replace(/_/g, " ")}
                        </p>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {isObj ? (
                          check.canPublish ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {check.questionCount}/40 đạt chuẩn
                            </span>
                          ) : (
                            <span
                              title={check.errors.join(" | ")}
                              className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {check.questionCount}/40 ({check.errors.length} lỗi)
                            </span>
                          )
                        ) : (
                          <span className="text-slate-500">
                            {test.skill === "writing" ? "Prompt Writing" : "3 Parts Speaking"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busyId === test.id}
                          onClick={() => void handleTogglePublish(test)}
                          title={
                            test.is_published
                              ? "Bấm để ẩn đề (chuyển về Nháp)"
                              : "Bấm để xuất bản công khai"
                          }
                          className="cursor-pointer"
                        >
                          <Badge variant={test.is_published ? "default" : "secondary"}>
                            {test.is_published ? "Đã đăng" : "Nháp"}
                          </Badge>
                        </button>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={`/admin/tests/${test.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 px-2.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Sửa
                          </Link>
                          <button
                            type="button"
                            disabled={busyId === test.id}
                            onClick={() => void handleDuplicate(test)}
                            title="Nhân bản thành đề nháp"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Xem trước trang làm bài"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(test)}
                            title="Xóa đề thi"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
          <span>
            Tổng <strong>{total}</strong> đề thi · Trang {page}/{totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() =>
                void fetchTests(page - 1, q, skill, mod, published, premium)
              }
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Trước
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() =>
                void fetchTests(page + 1, q, skill, mod, published, premium)
              }
            >
              Sau <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xác nhận xóa đề thi IELTS"
        description={`Xóa vĩnh viễn đề "${deleteTarget?.title_vi ?? ""}" (/tests/${deleteTarget?.slug ?? ""})?`}
        confirmLabel="Xóa đề thi"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={Boolean(under40Warning)}
        title="Cảnh báo: Đề chưa đủ 40 câu!"
        description={
          under40Warning
            ? `Đề ${under40Warning.test.skill === "reading" ? "Reading" : "Listening"} "${under40Warning.test.title_vi}" hiện chỉ có ${under40Warning.count}/40 câu. Hệ thống không cho phép xuất bản đề Reading/Listening dưới 40 câu để tránh sai lệch thang điểm Band IELTS.`
            : ""
        }
        confirmLabel="Mở trình sửa đề để bổ sung câu"
        cancelLabel="Đóng"
        destructive={false}
        onCancel={() => setUnder40Warning(null)}
        onConfirm={() => {
          if (under40Warning) {
            const targetId = under40Warning.test.id;
            setUnder40Warning(null);
            router.push(`/admin/tests/${targetId}`);
          }
        }}
      />
    </div>
  );
}
