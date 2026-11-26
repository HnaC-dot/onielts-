import React from "react";
import Link from "next/link";
import { BookOpen, FileQuestion, Home } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <Card className="p-8 space-y-5">
        <FileQuestion className="mx-auto h-11 w-11 text-emerald-600" />
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            404 — Not Found
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Không tìm thấy trang bạn yêu cầu
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Đường dẫn có thể đã thay đổi hoặc nội dung chưa được xuất bản. Bạn có thể quay về trang chủ hoặc khám phá kho đề thi IELTS.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link href="/">
            <Button>
              <Home className="h-4 w-4" />
              Về trang chủ
            </Button>
          </Link>
          <Link href="/tests">
            <Button variant="outline">
              <BookOpen className="h-4 w-4" />
              Kho đề thi IELTS
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
