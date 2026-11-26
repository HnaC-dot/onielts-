import React from "react";
import Link from "next/link";
import { BookOpen, FileQuestion } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TestNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Card className="p-8 space-y-4">
        <FileQuestion className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Không tìm thấy đề thi IELTS này
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Đề thi có thể chưa được xuất bản hoặc đường dẫn không tồn tại.
        </p>
        <Link href="/tests">
          <Button>
            <BookOpen className="h-4 w-4" />
            Quay lại kho đề thi
          </Button>
        </Link>
      </Card>
    </div>
  );
}
