"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function RouteErrorCard({
  error,
  reset,
  title = "Đã xảy ra lỗi khi tải trang",
  description = "Có sự cố tạm thời trong quá trình xử lý yêu cầu. Bạn hãy thử tải lại hoặc quay về trang chủ.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    console.error("[route-error-boundary]", {
      name: error.name,
      digest: error.digest ?? null,
      message: error.message,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <Card className="p-8 space-y-5">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
          {error.digest && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mã tham chiếu:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono dark:bg-slate-800">
                {error.digest}
              </code>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Button type="button" onClick={() => reset()}>
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </Button>
          <Link href="/">
            <Button variant="outline">
              <Home className="h-4 w-4" />
              Về trang chủ
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

export function PageSkeleton({
  cards = 3,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  cards?: number;
  columns?: string;
}) {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6 animate-pulse"
      aria-busy="true"
      aria-label="Đang tải nội dung"
    >
      <div className="space-y-2.5">
        <div className="h-8 w-64 max-w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-96 max-w-full rounded-lg bg-slate-200/80 dark:bg-slate-800/80" />
      </div>
      <div className={`grid gap-4 ${columns}`}>
        {Array.from({ length: cards }).map((_, idx) => (
          <div
            key={idx}
            className="h-44 rounded-2xl border border-slate-200 bg-slate-100/80 p-5 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-4 h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-2 h-4 w-full rounded bg-slate-200/70 dark:bg-slate-800/70" />
            <div className="mt-6 h-9 w-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
