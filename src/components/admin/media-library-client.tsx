"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileAudio,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Link2,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { MediaAsset } from "@/lib/types";
import { compressImageIfNeeded } from "@/lib/image-compress";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MediaLibraryClientProps {
  initialItems: MediaAsset[];
  initialTotal: number;
  initialTableReady: boolean;
}

const FOLDERS = [
  { value: "general", label: "Chung (general)" },
  { value: "blog", label: "Blog & Mẹo thi" },
  { value: "tests", label: "Đề thi / Sơ đồ" },
  { value: "listening", label: "Audio Listening" },
  { value: "courses", label: "Khóa học" },
  { value: "ipa", label: "Phát âm IPA" },
  { value: "seo", label: "SEO / Ảnh OG" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function MediaLibraryClient({
  initialItems,
  initialTotal,
  initialTableReady,
}: MediaLibraryClientProps) {
  const toast = useAdminToast();
  const [items, setItems] = useState<MediaAsset[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [tableReady, setTableReady] = useState(initialTableReady);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "image" | "svg" | "audio" | "pdf">("all");
  const [folderFilter, setFolderFilter] = useState("");
  const [uploadFolder, setUploadFolder] = useState("blog");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [savingAltId, setSavingAltId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 24;

  const fetchMedia = useCallback(
    async (nextPage: number, search: string, nextKind: string, nextFolder: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: String(pageSize),
          kind: nextKind,
          includeUsage: "1",
        });
        if (search.trim()) params.set("q", search.trim());
        if (nextFolder) params.set("folder", nextFolder);
        const res = await fetch(`/api/admin/media?${params.toString()}`);
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

  const uploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    let okCount = 0;
    try {
      for (const rawFile of files) {
        const processed = await compressImageIfNeeded(rawFile);
        const fd = new FormData();
        fd.append("file", processed.file);
        fd.append("folder", uploadFolder);
        if (processed.width) fd.append("width", String(processed.width));
        if (processed.height) fd.append("height", String(processed.height));

        const res = await fetch("/api/admin/media", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          toast.error(`${rawFile.name}: ${data.error || "Tải lên thất bại"}`);
        } else {
          okCount += 1;
          if (processed.wasCompressed) {
            toast.info(
              `Đã tự nén ${rawFile.name}: ${formatBytes(processed.originalSize)} → ${formatBytes(processed.compressedSize)}`
            );
          }
        }
      }
      if (okCount > 0) {
        toast.success(`Đã tải lên thành công ${okCount}/${files.length} tệp.`);
        await fetchMedia(1, q, kind, folderFilter);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSaveAlt = async (asset: MediaAsset) => {
    const nextAlt = altDrafts[asset.id] ?? asset.alt_text;
    setSavingAltId(asset.id);
    try {
      const res = await fetch(`/api/admin/media/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt_text: nextAlt }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể lưu Alt Text.");
        return;
      }
      setItems((prev) =>
        prev.map((m) => (m.id === asset.id ? { ...m, alt_text: nextAlt } : m))
      );
      toast.success(`Đã cập nhật Alt Text cho ${asset.filename}`);
    } finally {
      setSavingAltId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const hasUsages = (deleteTarget.usages?.length ?? 0) > 0;
      const url = `/api/admin/media/${deleteTarget.id}${hasUsages ? "?force=1" : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể xóa tệp.");
        return;
      }
      toast.success(`Đã xóa tệp ${deleteTarget.filename}`);
      setDeleteTarget(null);
      await fetchMedia(page, q, kind, folderFilter);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      {!tableReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Bảng <code>public.media_assets</code> hoặc bucket <code>cms-media</code> chưa sẵn sàng trên Supabase. Hãy đảm bảo đã chạy migration <code>0005_admin_cms_schema.sql</code>.
        </div>
      )}

      {/* Upload Dropzone */}
      <Card
        className={`p-5 border-2 border-dashed transition ${
          dragOver
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-slate-200 dark:border-slate-800"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) {
            void uploadFiles(e.dataTransfer.files);
          }
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Upload className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Kéo thả tệp vào đây hoặc chọn từ máy
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Hỗ trợ Ảnh (PNG/JPG/WEBP/GIF ≤ 5MB, tự động nén &amp; resize ≤ 1920px), Sơ đồ SVG (≤ 2MB, tự lọc XSS), Audio MP3/WAV/OGG (≤ 25MB), PDF (≤ 10MB).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value)}
              aria-label="Thư mục lưu file"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
            >
              {FOLDERS.map((f) => (
                <option key={f.value} value={f.value}>
                  Thư mục: {f.label}
                </option>
              ))}
            </select>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">
              <Upload className="h-4 w-4" />
              {uploading ? "Đang tải lên..." : "Chọn tệp tải lên"}
              <input
                type="file"
                multiple
                disabled={uploading}
                className="hidden"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,audio/mpeg,audio/mp3,audio/wav,audio/ogg,application/pdf"
                onChange={(e) => {
                  if (e.target.files?.length) void uploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </Card>

      {/* Search & Filters */}
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void fetchMedia(1, q, kind, folderFilter);
          }}
          className="flex flex-wrap items-center gap-2.5"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên tệp hoặc Alt Text..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <select
            value={kind}
            onChange={(e) => {
              const next = e.target.value as typeof kind;
              setKind(next);
              void fetchMedia(1, q, next, folderFilter);
            }}
            aria-label="Lọc định dạng"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">Tất cả định dạng</option>
            <option value="image">Ảnh (PNG/JPG/WEBP/GIF)</option>
            <option value="svg">Sơ đồ SVG</option>
            <option value="audio">Âm thanh MP3/WAV/OGG</option>
            <option value="pdf">Tài liệu PDF</option>
          </select>
          <select
            value={folderFilter}
            onChange={(e) => {
              setFolderFilter(e.target.value);
              void fetchMedia(1, q, kind, e.target.value);
            }}
            aria-label="Lọc thư mục"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Mọi thư mục</option>
            {FOLDERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Lọc
          </Button>
        </form>
      </Card>

      {/* Media Grid */}
      {items.length === 0 ? (
        <Card className="p-12 text-center text-xs text-slate-500">
          <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
          Chưa có tệp nào trong thư viện Media. Hãy tải lên ảnh bìa, sơ đồ SVG hoặc file MP3 ở khung trên.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((asset) => {
            const isImage = asset.mime_type.startsWith("image/");
            const isSvg = asset.mime_type === "image/svg+xml";
            const isAudio = asset.mime_type.startsWith("audio/");
            const usages = asset.usages ?? [];
            const currentAlt = altDrafts[asset.id] ?? asset.alt_text;

            return (
              <Card key={asset.id} className="flex flex-col overflow-hidden">
                {/* Preview */}
                <div className="relative flex h-40 items-center justify-center bg-slate-100 dark:bg-slate-900">
                  {isImage ? (
                    <img
                      src={asset.public_url}
                      alt={asset.alt_text || asset.filename}
                      className={`h-full w-full ${isSvg ? "object-contain p-3" : "object-cover"}`}
                    />
                  ) : isAudio ? (
                    <div className="flex w-full flex-col items-center gap-2 px-4">
                      <FileAudio className="h-8 w-8 text-sky-600" />
                      <audio controls preload="none" src={asset.public_url} className="w-full h-8" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-amber-600">
                      <FileText className="h-10 w-10" />
                      <span className="text-[11px] font-bold">PDF Document</span>
                    </div>
                  )}
                  <span className="absolute left-2 top-2">
                    <Badge variant="secondary">{asset.folder}</Badge>
                  </span>
                  {isSvg && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <FileCode2 className="h-3 w-3" /> SVG
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col justify-between p-3.5 space-y-3 text-xs">
                  <div className="space-y-1.5">
                    <p
                      title={asset.filename}
                      className="truncate font-bold text-slate-900 dark:text-white"
                    >
                      {asset.filename}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatBytes(asset.size_bytes)}
                      {asset.width && asset.height
                        ? ` · ${asset.width}×${asset.height}px`
                        : ""}{" "}
                      · {new Date(asset.created_at).toLocaleDateString("vi-VN")}
                    </p>

                    {/* Alt Text Inline Editor */}
                    <div className="flex items-center gap-1 pt-1">
                      <input
                        type="text"
                        value={currentAlt}
                        onChange={(e) =>
                          setAltDrafts((prev) => ({
                            ...prev,
                            [asset.id]: e.target.value,
                          }))
                        }
                        placeholder="Nhập Alt Text (SEO)..."
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveAlt(asset)}
                        disabled={savingAltId === asset.id}
                        title="Lưu Alt Text"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Usage references */}
                    <div className="pt-1">
                      {usages.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                          Chưa gắn vào bài viết / đề thi nào
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <Link2 className="h-3 w-3" /> Đang dùng ở {usages.length} nơi:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {usages.slice(0, 3).map((u) => (
                              <Link
                                key={`${u.entityType}-${u.entityId}`}
                                href={u.href}
                                className="max-w-full truncate rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 hover:underline dark:bg-emerald-950/60 dark:text-emerald-300"
                              >
                                {u.label}
                              </Link>
                            ))}
                            {usages.length > 3 && (
                              <span className="text-[10px] text-slate-400">
                                +{usages.length - 3} khác
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard.writeText(asset.public_url);
                          setCopiedId(asset.id);
                          toast.info("Đã copy URL tệp Media");
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                      >
                        {copiedId === asset.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        URL
                      </Button>
                      <a
                        href={asset.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Mở trong tab mới"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(asset)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Tổng <strong>{total}</strong> tệp · Trang {page}/{totalPages}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => void fetchMedia(page - 1, q, kind, folderFilter)}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Trước
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => void fetchMedia(page + 1, q, kind, folderFilter)}
          >
            Sau <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Delete Confirm Dialog with Usage Warning */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xác nhận xóa tệp Media"
        description={
          deleteTarget && (deleteTarget.usages?.length ?? 0) > 0
            ? `CẢNH BÁO: Tệp "${deleteTarget.filename}" đang được gắn ở ${deleteTarget.usages!.length} nơi (${deleteTarget.usages!.map((u) => u.label).slice(0, 3).join(", ")}). Nếu xóa, ảnh/audio ở các trang đó sẽ bị lỗi hiển thị!`
            : `Xóa vĩnh viễn "${deleteTarget?.filename ?? ""}" khỏi Supabase Storage và Thư viện Media?`
        }
        confirmLabel={
          deleteTarget && (deleteTarget.usages?.length ?? 0) > 0
            ? "Vẫn xóa bắt buộc"
            : "Xóa vĩnh viễn"
        }
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Helper note */}
      <div className="flex items-center gap-2 rounded-xl bg-slate-100/80 px-4 py-2.5 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        Mọi tệp được lưu an toàn trên Supabase Storage bucket <code>cms-media</code> (không ghi ra ổ đĩa Vercel) và dùng lại được trong Blog, Đề thi, Khóa học, IPA và SEO.
      </div>
    </div>
  );
}
