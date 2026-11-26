"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Lightbulb,
  Mail,
  MailOpen,
  Search,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import type { ContactMessageItem, FeatureRequestItem } from "@/lib/types";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function InboxCmsClient({
  initialContacts,
  initialFeatureRequests,
}: {
  initialContacts: ContactMessageItem[];
  initialFeatureRequests: FeatureRequestItem[];
}) {
  const toast = useAdminToast();
  const [tab, setTab] = useState<"contacts" | "features">("contacts");
  const [contacts, setContacts] = useState<ContactMessageItem[]>(initialContacts);
  const [features, setFeatures] = useState<FeatureRequestItem[]>(initialFeatureRequests);
  const [search, setSearch] = useState("");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "contact" | "feature_request";
    id: string;
    label: string;
  } | null>(null);

  const reloadInbox = async () => {
    const res = await fetch("/api/admin/inbox");
    if (res.ok) {
      const data = await res.json();
      setContacts(data.contacts ?? []);
      setFeatures(data.featureRequests ?? []);
    }
  };

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      `${c.name} ${c.email} ${c.subject} ${c.message}`.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const filteredFeatures = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return features;
    return features.filter((f) =>
      `${f.title} ${f.description} ${f.status}`.toLowerCase().includes(q)
    );
  }, [features, search]);

  const updateContact = async (
    id: string,
    patch: { status?: "new" | "replied"; is_read?: boolean; admin_note?: string },
    msg: string
  ) => {
    const res = await fetch("/api/admin/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "contact", id, ...patch }),
    });
    if (!res.ok) {
      toast.error("Cập nhật tin nhắn thất bại.");
      return;
    }
    toast.success(msg);
    await reloadInbox();
  };

  const updateFeature = async (
    id: string,
    patch: { status?: "open" | "planned" | "shipped"; admin_note?: string },
    msg: string
  ) => {
    const res = await fetch("/api/admin/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "feature_request", id, ...patch }),
    });
    if (!res.ok) {
      toast.error("Cập nhật đề xuất thất bại.");
      return;
    }
    toast.success(msg);
    await reloadInbox();
  };

  const unreadCount = contacts.filter((c) => !c.is_read && c.status === "new").length;
  const openFrCount = features.filter((f) => f.status === "open").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Hộp thư Liên hệ &amp; Đề xuất tính năng
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Đọc và phản hồi tin nhắn từ trang /contact, đồng thời duyệt trạng thái các ý tưởng từ /feature-requests.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("contacts")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              tab === "contacts"
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            Liên hệ /contact ({contacts.length})
            {unreadCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] text-slate-950">
                {unreadCount} mới
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("features")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              tab === "features"
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Đề xuất tính năng ({features.length})
            {openFrCount > 0 && (
              <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px]">
                {openFrCount} mở
              </span>
            )}
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm trong hộp thư..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs dark:border-slate-800 dark:bg-slate-950"
          />
        </div>
      </div>

      {tab === "contacts" ? (
        <div className="space-y-3">
          {filteredContacts.length === 0 ? (
            <Card className="p-10 text-center text-xs text-slate-500">
              Chưa có tin nhắn liên hệ nào.
            </Card>
          ) : (
            filteredContacts.map((c) => {
              const noteVal = notesDraft[c.id] ?? c.admin_note ?? "";
              return (
                <Card
                  key={c.id}
                  className={`p-5 space-y-3 ${
                    !c.is_read && c.status === "new"
                      ? "border-emerald-300 bg-emerald-50/20 dark:border-emerald-900"
                      : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          {c.subject}
                        </h2>
                        <Badge variant={c.status === "replied" ? "default" : "amber"}>
                          {c.status === "replied" ? "Đã phản hồi" : "Mới"}
                        </Badge>
                        {c.is_read && <Badge variant="secondary">Đã đọc</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Từ: <strong>{c.name}</strong> ({c.email}) ·{" "}
                        {new Date(c.created_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={`mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(`Re: ${c.subject}`)}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-400"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Trả lời Email
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateContact(
                            c.id,
                            { is_read: !c.is_read },
                            c.is_read ? "Đã đánh dấu chưa đọc." : "Đã đánh dấu đã đọc."
                          )
                        }
                      >
                        <MailOpen className="h-3.5 w-3.5" />
                        {c.is_read ? "Chưa đọc" : "Đã đọc"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={c.status === "replied" ? "secondary" : "default"}
                        onClick={() =>
                          updateContact(
                            c.id,
                            {
                              status: c.status === "replied" ? "new" : "replied",
                              is_read: true,
                            },
                            "Đã cập nhật trạng thái xử lý!"
                          )
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {c.status === "replied" ? "Mở lại" : "Đã xử lý"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "contact",
                            id: c.id,
                            label: c.subject,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <p className="rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 whitespace-pre-line dark:bg-slate-900 dark:text-slate-300">
                    {c.message}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={noteVal}
                      onChange={(e) =>
                        setNotesDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      placeholder="Ghi chú nội bộ của Admin/CSKH..."
                      className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateContact(
                          c.id,
                          { admin_note: noteVal, is_read: true },
                          "Đã lưu ghi chú nội bộ!"
                        )
                      }
                    >
                      Lưu ghi chú
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFeatures.length === 0 ? (
            <Card className="p-10 text-center text-xs text-slate-500">
              Chưa có đề xuất tính năng nào.
            </Card>
          ) : (
            filteredFeatures.map((fr) => {
              const noteVal = notesDraft[`fr-${fr.id}`] ?? fr.admin_note ?? "";
              return (
                <Card key={fr.id} className="p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <ThumbsUp className="h-3 w-3" />
                          {fr.votes}
                        </span>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          {fr.title}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {fr.description}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {fr.email ? `${fr.email} · ` : ""}
                        {new Date(fr.created_at).toLocaleDateString("vi-VN")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Trạng thái đề xuất ${fr.title}`}
                        value={fr.status}
                        onChange={(e) =>
                          updateFeature(
                            fr.id,
                            {
                              status: e.target.value as FeatureRequestItem["status"],
                            },
                            `Đã chuyển trạng thái → ${e.target.value}`
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="open">Open (Đang tiếp nhận)</option>
                        <option value="planned">Planned (Đã lên kế hoạch)</option>
                        <option value="shipped">Shipped (Đã phát hành)</option>
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "feature_request",
                            id: fr.id,
                            label: fr.title,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={noteVal}
                      onChange={(e) =>
                        setNotesDraft((prev) => ({
                          ...prev,
                          [`fr-${fr.id}`]: e.target.value,
                        }))
                      }
                      placeholder="Ghi chú nội bộ cho đề xuất này..."
                      className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateFeature(
                          fr.id,
                          { admin_note: noteVal },
                          "Đã lưu ghi chú cho đề xuất!"
                        )
                      }
                    >
                      Lưu ghi chú
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xác nhận xóa?"
        description={`Mục "${deleteTarget?.label ?? ""}" sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa ngay"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const res = await fetch(
            `/api/admin/inbox?kind=${deleteTarget.kind}&id=${encodeURIComponent(deleteTarget.id)}`,
            { method: "DELETE" }
          );
          if (res.ok) {
            toast.success("Đã xóa thành công.");
            setDeleteTarget(null);
            await reloadInbox();
          }
        }}
      />
    </div>
  );
}
