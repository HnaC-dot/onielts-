"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  FileAudio,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import type { MediaAsset } from "@/lib/types";
import { compressImageIfNeeded } from "@/lib/image-compress";
import { useAdminToast } from "./toast-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  acceptKind?: "all" | "image" | "svg" | "audio" | "pdf";
  defaultFolder?: string;
  title?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  acceptKind = "all",
  defaultFolder = "blog",
  title = "Chọn từ Thư viện Media",
}: MediaPickerModalProps) {
  const toast = useAdminToast();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "image" | "svg" | "audio" | "pdf">(
    acceptKind
  );
  const [selected, setSelected] = useState<MediaAsset | null>(null);

  const loadAssets = useCallback(
    async (searchText: string, filterKind: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "24",
          kind: filterKind,
          includeUsage: "0",
        });
        if (searchText.trim()) params.set("q", searchText.trim());
        const res = await fetch(`/api/admin/media?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items ?? []);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) {
        await loadAssets("", acceptKind);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, acceptKind, loadAssets]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const processed = await compressImageIfNeeded(file);
      const fd = new FormData();
      fd.append("file", processed.file);
      fd.append("folder", defaultFolder);
      if (processed.width) fd.append("width", String(processed.width));
      if (processed.height) fd.append("height", String(processed.height));

      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Tải lên thất bại.");
        return;
      }
      const asset = data.asset as MediaAsset;
      setItems((prev) => [asset, ...prev]);
      setSelected(asset);
      toast.success(
        processed.wasCompressed
          ? `Đã nén & tải lên ${asset.filename} (${formatBytes(processed.originalSize)} → ${formatBytes(processed.compressedSize)})`
          : `Đã tải lên ${asset.filename}`
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadAssets(q, kind);
            }}
            className="flex flex-1 flex-wrap items-center gap-2 min-w-[220px]"
          >
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo tên file hoặc alt text..."
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <select
              value={kind}
              onChange={(e) => {
                const next = e.target.value as typeof kind;
                setKind(next);
                void loadAssets(q, next);
              }}
              aria-label="Lọc loại file"
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">Tất cả</option>
              <option value="image">Ảnh (PNG/JPG/WEBP)</option>
              <option value="svg">Sơ đồ SVG</option>
              <option value="audio">Âm thanh MP3/WAV</option>
              <option value="pdf">Tài liệu PDF</option>
            </select>
            <Button type="submit" size="sm" variant="outline" disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </form>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Đang tải lên..." : "Tải file mới"}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,audio/mpeg,audio/mp3,audio/wav,audio/ogg,application/pdf"
              onChange={handleQuickUpload}
            />
          </label>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center text-xs text-slate-500 dark:border-slate-800">
              <ImageIcon className="mx-auto mb-2 h-7 w-7 opacity-40" />
              {loading
                ? "Đang tải thư viện Media..."
                : "Chưa có tệp nào phù hợp. Bấm 'Tải file mới' ở góc phải để upload."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => {
                const isSelected = selected?.id === item.id;
                const isVisual = item.mime_type.startsWith("image/");
                const isAudio = item.mime_type.startsWith("audio/");
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 ring-2 ring-emerald-500/30"
                        : "border-slate-200 hover:border-emerald-300 dark:border-slate-800"
                    }`}
                  >
                    <div className="relative flex h-28 items-center justify-center bg-slate-100 dark:bg-slate-950">
                      {isVisual ? (
                        <img
                          src={item.public_url}
                          alt={item.alt_text || item.filename}
                          className="h-full w-full object-cover"
                        />
                      ) : isAudio ? (
                        <FileAudio className="h-9 w-9 text-sky-600" />
                      ) : (
                        <FileText className="h-9 w-9 text-amber-600" />
                      )}
                      {isSelected && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 space-y-0.5">
                      <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white">
                        {item.filename}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{formatBytes(item.size_bytes)}</span>
                        <Badge variant="secondary">{item.folder}</Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="min-w-0 flex-1 text-xs text-slate-500">
            {selected ? (
              <span className="truncate block">
                Đã chọn: <strong className="text-slate-900 dark:text-white">{selected.filename}</strong>{" "}
                ({formatBytes(selected.size_bytes)}
                {selected.width && selected.height ? ` · ${selected.width}×${selected.height}` : ""})
              </span>
            ) : (
              "Chọn 1 tệp để chèn vào biểu mẫu"
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selected}
              onClick={() => {
                if (selected) {
                  onSelect(selected);
                  onClose();
                }
              }}
            >
              Chèn tệp này
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
