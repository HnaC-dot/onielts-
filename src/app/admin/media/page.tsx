import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listMediaAssets } from "@/lib/cms-media";
import { MediaLibraryClient } from "@/components/admin/media-library-client";

export const metadata = {
  title: "Thư viện Media",
  robots: { index: false, follow: false },
};

export default async function AdminMediaPage() {
  const initial = await listMediaAssets({
    page: 1,
    pageSize: 24,
    includeUsage: true,
  });

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
          Thư viện Media (Supabase Storage)
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Quản lý ảnh bìa, sơ đồ SVG, audio MP3/WAV và PDF tập trung; tự nén ảnh khi tải lên và theo dõi chính xác nơi đang sử dụng từng tệp.
        </p>
      </div>

      <MediaLibraryClient
        initialItems={initial.items}
        initialTotal={initial.total}
        initialTableReady={initial.tableReady}
      />
    </div>
  );
}
