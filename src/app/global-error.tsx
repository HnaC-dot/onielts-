"use client";

import React, { useEffect } from "react";
import Link from "next/link";

/**
 * Root-level App Router error boundary (`global-error.tsx`).
 * Catches fatal errors thrown inside `src/app/layout.tsx` itself without relying
 * on layout providers, themes, or i18n context.
 */
export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root-global-error]", {
      name: error.name,
      digest: error.digest ?? null,
      message: error.message,
    });
  }, [error]);

  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 text-xl font-bold">
            !
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">
              Hệ thống đang gặp sự cố tạm thời
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Không thể khởi tạo giao diện lúc này. Vui lòng thử tải lại trang hoặc quay về trang chủ sau ít giây.
            </p>
            {error.digest && (
              <p className="text-xs text-slate-500">
                Mã tham chiếu:{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">
                  {error.digest}
                </code>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              Thử tải lại
            </button>
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
