"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  Video,
  X,
} from "lucide-react";
import {
  CONTENT_TYPE_META,
  CONTENT_WORKFLOW_STEPS,
  getNextWorkflowStatus,
  type ContentCalendarItem,
  type ContentItemType,
  type ContentWorkflowStatus,
} from "@/lib/content-production-shared";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ContentCalendarClientProps {
  initialItems: ContentCalendarItem[];
  initialTableReady: boolean;
  initialMonth: string;
  todayDate: string;
  defaultAssignee: string;
}

const WEEKDAYS_VI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  return `Tháng ${m}/${y}`;
}

function buildMonthGridDays(monthStr: string): Array<{
  dateStr: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}> {
  const [y, m] = monthStr.split("-").map(Number);
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const cells: Array<{
    dateStr: string;
    dayNumber: number;
    inCurrentMonth: boolean;
  }> = [];

  for (let i = 0; i < totalCells; i++) {
    const d = new Date(Date.UTC(y, m - 1, 1 - startOffset + i));
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    cells.push({
      dateStr: `${yyyy}-${mm}-${dd}`,
      dayNumber: d.getUTCDate(),
      inCurrentMonth: yyyy === y && d.getUTCMonth() + 1 === m,
    });
  }
  return cells;
}

const TYPE_ICONS: Record<ContentItemType, React.ComponentType<{ className?: string }>> = {
  blog: FileText,
  test: BookOpen,
  video: Video,
};

export function ContentCalendarClient({
  initialItems,
  initialTableReady,
  initialMonth,
  todayDate,
  defaultAssignee,
}: ContentCalendarClientProps) {
  const toast = useAdminToast();
  const [items, setItems] = useState<ContentCalendarItem[]>(initialItems);
  const [tableReady, setTableReady] = useState(initialTableReady);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"" | ContentItemType>("");
  const [filterStatus, setFilterStatus] = useState<"" | ContentWorkflowStatus>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentItemType>("blog");
  const [workflowStatus, setWorkflowStatus] =
    useState<ContentWorkflowStatus>("idea");
  const [assigneeName, setAssigneeName] = useState(defaultAssignee);
  const [plannedDate, setPlannedDate] = useState(todayDate);
  const [linkedHref, setLinkedHref] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ContentCalendarItem | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const monthItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (!item.planned_date.startsWith(currentMonth)) return false;
        if (filterType && item.content_type !== filterType) return false;
        if (filterStatus && item.workflow_status !== filterStatus) return false;
        if (q) {
          const hay = `${item.title} ${item.assignee_name} ${item.notes ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.planned_date.localeCompare(b.planned_date));
  }, [items, currentMonth, filterType, filterStatus, search]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ContentCalendarItem[]>();
    for (const item of monthItems) {
      const arr = map.get(item.planned_date) ?? [];
      arr.push(item);
      map.set(item.planned_date, arr);
    }
    return map;
  }, [monthItems]);

  const statusCounts = useMemo(() => {
    const counts: Record<ContentWorkflowStatus, number> = {
      idea: 0,
      writing: 0,
      review: 0,
      scheduled: 0,
      published: 0,
    };
    for (const item of items) {
      if (item.planned_date.startsWith(currentMonth)) {
        counts[item.workflow_status] += 1;
      }
    }
    return counts;
  }, [items, currentMonth]);

  const gridDays = useMemo(
    () => buildMonthGridDays(currentMonth),
    [currentMonth]
  );

  const openCreateModal = (dateStr?: string) => {
    setEditingId(null);
    setTitle("");
    setContentType("blog");
    setWorkflowStatus("idea");
    setAssigneeName(defaultAssignee);
    setPlannedDate(dateStr || todayDate);
    setLinkedHref("");
    setNotes("");
    setModalOpen(true);
  };

  const openEditModal = (item: ContentCalendarItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setContentType(item.content_type);
    setWorkflowStatus(item.workflow_status);
    setAssigneeName(item.assignee_name);
    setPlannedDate(item.planned_date);
    setLinkedHref(item.linked_href ?? "");
    setNotes(item.notes ?? "");
    setModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          title,
          content_type: contentType,
          workflow_status: workflowStatus,
          assignee_name: assigneeName,
          planned_date: plannedDate,
          linked_href: linkedHref.trim() || null,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể lưu mục lịch nội dung.");
        return;
      }
      if (typeof data.tableReady === "boolean") setTableReady(data.tableReady);
      const saved: ContentCalendarItem = data.item;
      setItems((prev) => {
        const exists = prev.some((x) => x.id === saved.id);
        return exists
          ? prev.map((x) => (x.id === saved.id ? saved : x))
          : [...prev, saved];
      });
      setModalOpen(false);
      toast.success(
        editingId
          ? "Đã cập nhật kế hoạch nội dung."
          : "Đã thêm mục mới vào Lịch nội dung!"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdvance = async (item: ContentCalendarItem) => {
    const nextStatus = getNextWorkflowStatus(item.workflow_status);
    if (!nextStatus) return;

    const res = await fetch("/api/admin/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        title: item.title,
        content_type: item.content_type,
        workflow_status: nextStatus,
        assignee_name: item.assignee_name,
        planned_date: item.planned_date,
        linked_href: item.linked_href ?? null,
        notes: item.notes ?? "",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Không thể cập nhật trạng thái.");
      return;
    }
    const updated: ContentCalendarItem = data.item;
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    const nextMeta = CONTENT_WORKFLOW_STEPS.find((s) => s.value === nextStatus);
    toast.success(`Đã chuyển "${item.title}" sang ${nextMeta?.labelVi ?? nextStatus}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/calendar?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể xóa mục lịch.");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      toast.success(`Đã xóa "${deleteTarget.title}".`);
      setDeleteTarget(null);
      if (editingId === deleteTarget.id) setModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {!tableReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Dữ liệu đang lưu tạm an toàn trong <code>site_settings</code> vì bảng{" "}
          <code>public.content_calendar_items</code> chưa được tạo. Hãy chạy file{" "}
          <code>supabase/migrations/0007_content_production.sql</code> trong Supabase SQL Editor để kích hoạt bảng riêng có index.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {CONTENT_WORKFLOW_STEPS.map((step) => {
          const active = filterStatus === step.value;
          return (
            <button
              key={step.value}
              type="button"
              onClick={() => setFilterStatus(active ? "" : step.value)}
              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition cursor-pointer ${
                active
                  ? "border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500 dark:bg-emerald-950/40"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${step.dotClass}`} />
                <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {step.labelVi}
                </span>
              </div>
              <span className="ml-2 text-base font-bold text-slate-900 dark:text-white">
                {statusCounts[step.value]}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCurrentMonth((m) => shiftMonth(m, -1))}
              aria-label="Tháng trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[125px] text-center text-sm font-bold text-slate-900 dark:text-white">
              {formatMonthLabel(currentMonth)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCurrentMonth((m) => shiftMonth(m, 1))}
              aria-label="Tháng sau"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setCurrentMonth(todayDate.slice(0, 7))}
            >
              Tháng này
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tiêu đề, người phụ trách..."
                className="w-48 rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "" | ContentItemType)}
              aria-label="Lọc loại nội dung"
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Mọi loại nội dung</option>
              <option value="blog">Bài Blog</option>
              <option value="test">Đề thi IELTS</option>
              <option value="video">Video</option>
            </select>

            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" /> Lịch tháng
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                  viewMode === "list"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                <List className="h-3.5 w-3.5" /> Danh sách
              </button>
            </div>

            <Button type="button" size="sm" onClick={() => openCreateModal()}>
              <Plus className="h-4 w-4" /> Thêm kế hoạch
            </Button>
          </div>
        </div>
      </Card>

      {viewMode === "calendar" ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            {WEEKDAYS_VI.map((day) => (
              <div key={day} className="py-2.5">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
            {gridDays.map((cell) => {
              const dayItems = itemsByDate.get(cell.dateStr) ?? [];
              const isToday = cell.dateStr === todayDate;
              return (
                <div
                  key={cell.dateStr}
                  className={`min-h-[124px] p-1.5 sm:p-2 transition ${
                    cell.inCurrentMonth
                      ? "bg-white dark:bg-slate-950"
                      : "bg-slate-50/70 text-slate-400 dark:bg-slate-900/40"
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        isToday
                          ? "bg-emerald-600 text-white"
                          : cell.inCurrentMonth
                          ? "text-slate-800 dark:text-slate-200"
                          : "text-slate-400"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => openCreateModal(cell.dateStr)}
                      title={`Thêm nội dung ngày ${cell.dateStr}`}
                      className="rounded p-0.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {dayItems.map((item) => {
                      const stepMeta =
                        CONTENT_WORKFLOW_STEPS.find(
                          (s) => s.value === item.workflow_status
                        ) ?? CONTENT_WORKFLOW_STEPS[0];
                      const typeMeta = CONTENT_TYPE_META[item.content_type];
                      const Icon = TYPE_ICONS[item.content_type];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openEditModal(item)}
                          className={`w-full rounded-lg border px-1.5 py-1 text-left transition hover:shadow-xs cursor-pointer ${stepMeta.badgeClass}`}
                        >
                          <div className="flex items-center gap-1">
                            <Icon className="h-3 w-3 shrink-0 opacity-80" />
                            <span className="truncate text-[11px] font-semibold">
                              {item.title}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] opacity-80">
                            <span className="truncate">
                              {typeMeta.shortVi} · {stepMeta.labelVi}
                            </span>
                            {item.assignee_name && (
                              <span className="hidden truncate sm:inline max-w-[60px]">
                                {item.assignee_name}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Ngày dự kiến</th>
                  <th className="px-4 py-3 font-semibold">Nội dung</th>
                  <th className="px-4 py-3 font-semibold">Người phụ trách</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {monthItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      Chưa có kế hoạch nội dung nào trong {formatMonthLabel(currentMonth)}.
                    </td>
                  </tr>
                ) : (
                  monthItems.map((item) => {
                    const stepMeta =
                      CONTENT_WORKFLOW_STEPS.find(
                        (s) => s.value === item.workflow_status
                      ) ?? CONTENT_WORKFLOW_STEPS[0];
                    const typeMeta = CONTENT_TYPE_META[item.content_type];
                    const nextStatus = getNextWorkflowStatus(item.workflow_status);
                    const nextMeta = nextStatus
                      ? CONTENT_WORKFLOW_STEPS.find((s) => s.value === nextStatus)
                      : null;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50"
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {item.planned_date}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${typeMeta.badgeClass}`}
                            >
                              {typeMeta.labelVi}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {item.title}
                            </span>
                            {item.linked_href && (
                              <Link
                                href={item.linked_href}
                                target="_blank"
                                className="inline-flex items-center gap-0.5 text-[11px] text-emerald-700 hover:underline dark:text-emerald-400"
                              >
                                <ExternalLink className="h-3 w-3" /> Mở
                              </Link>
                            )}
                          </div>
                          {item.notes && (
                            <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">
                              {item.notes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5 opacity-60" />
                            {item.assignee_name || "Chưa gán"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${stepMeta.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${stepMeta.dotClass}`} />
                            {stepMeta.labelVi}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {nextMeta && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleQuickAdvance(item)}
                                title={`Chuyển sang ${nextMeta.labelVi}`}
                              >
                                {nextMeta.labelVi}
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditModal(item)}
                              aria-label="Sửa"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteTarget(item)}
                              aria-label="Xóa"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingId ? "Cập nhật kế hoạch nội dung" : "Thêm kế hoạch nội dung mới"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tiêu đề nội dung *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Chiến thuật Matching Headings đạt 8.0 Reading"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Loại nội dung *
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) =>
                      setContentType(e.target.value as ContentItemType)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="blog">Bài Blog</option>
                    <option value="test">Đề thi IELTS</option>
                    <option value="video">Video học IELTS</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Ngày dự kiến *
                  </label>
                  <input
                    type="date"
                    required
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Trạng thái quy trình *
                  </label>
                  <select
                    value={workflowStatus}
                    onChange={(e) =>
                      setWorkflowStatus(e.target.value as ContentWorkflowStatus)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
                  >
                    {CONTENT_WORKFLOW_STEPS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.labelVi}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Người phụ trách
                  </label>
                  <input
                    type="text"
                    value={assigneeName}
                    onChange={(e) => setAssigneeName(e.target.value)}
                    placeholder="VD: Minh Anh"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Link bài viết / đề thi / video (tùy chọn)
                </label>
                <input
                  type="text"
                  value={linkedHref}
                  onChange={(e) => setLinkedHref(e.target.value)}
                  placeholder="VD: /admin/blog/new hoặc /blog/meo-reading"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ghi chú biên tập / từ khóa mục tiêu
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú từ khóa SEO, đề cần gắn link nội bộ, yêu cầu hình ảnh..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div>
                  {editingId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => {
                        const found = items.find((x) => x.id === editingId);
                        if (found) setDeleteTarget(found);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Xóa
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingId && linkedHref && (
                    <Link href={linkedHref} target="_blank">
                      <Button type="button" size="sm" variant="outline">
                        <ExternalLink className="h-3.5 w-3.5" /> Mở link
                      </Button>
                    </Link>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setModalOpen(false)}
                  >
                    Đóng
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo kế hoạch"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa kế hoạch khỏi Lịch nội dung"
        description={`Xóa mục "${deleteTarget?.title ?? ""}" khỏi lịch nội dung?`}
        confirmLabel="Xóa"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Lối tắt tạo nội dung thật:</span>
        <Link href="/admin/blog/new">
          <Badge variant="outline" className="cursor-pointer hover:border-emerald-500">
            + Viết bài Blog mới
          </Badge>
        </Link>
        <Link href="/admin/tests/new">
          <Badge variant="outline" className="cursor-pointer hover:border-emerald-500">
            + Tạo đề thi mới
          </Badge>
        </Link>
        <Link href="/admin/tests/import">
          <Badge variant="outline" className="cursor-pointer hover:border-emerald-500">
            + Nhập hàng loạt đề (CSV/JSON)
          </Badge>
        </Link>
        <Link href="/admin/videos">
          <Badge variant="outline" className="cursor-pointer hover:border-emerald-500">
            + Quản lý Video
          </Badge>
        </Link>
      </div>
    </div>
  );
}
