"use client";

import React from "react";
import { RouteErrorCard } from "@/components/route-state-ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorCard
      error={error}
      reset={reset}
      title="Không thể tải trang Quản trị"
      description="Đã có sự cố khi kết nối dữ liệu quản trị Supabase. Vui lòng kiểm tra biến môi trường và thử lại."
    />
  );
}
