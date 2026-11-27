import React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Mail } from "lucide-react";
import { listAdminBlogPosts } from "@/lib/cms-blog";
import { BlogListClient } from "@/components/admin/blog-list-client";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Quản lý Blog & Mẹo thi",
  robots: { index: false, follow: false },
};

export default async function AdminBlogListPage() {
  const initial = await listAdminBlogPosts({ page: 1, pageSize: 15 });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
            Soạn thảo bài viết giàu định dạng với 4 mẫu bài chuẩn, gợi ý link nội bộ tự động, kiểm tra chất lượng trước khi đăng và tối ưu SEO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/calendar">
            <Button type="button" size="sm" variant="outline">
              <CalendarDays className="h-3.5 w-3.5" />
              Lịch nội dung
            </Button>
          </Link>
          <Link href="/admin/subscribers">
            <Button type="button" size="sm" variant="outline">
              <Mail className="h-3.5 w-3.5" />
              Email đăng ký
            </Button>
          </Link>
        </div>
      </div>

      <BlogListClient
        initialItems={initial.items}
        initialTotal={initial.total}
      />
    </div>
  );
}
