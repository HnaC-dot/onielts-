import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listAdminBlogPosts } from "@/lib/cms-blog";
import { BlogListClient } from "@/components/admin/blog-list-client";

export const metadata = {
  title: "Quản lý Blog & Mẹo thi",
  robots: { index: false, follow: false },
};

export default async function AdminBlogListPage() {
  const initial = await listAdminBlogPosts({ page: 1, pageSize: 15 });

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
          Blog &amp; Mẹo thi IELTS
        </h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Soạn thảo bài viết giàu định dạng, lên lịch đăng theo giờ Việt Nam, đánh dấu Nổi bật trên trang chủ và tối ưu SEO chuẩn Google / Facebook.
        </p>
      </div>

      <BlogListClient
        initialItems={initial.items}
        initialTotal={initial.total}
      />
    </div>
  );
}
