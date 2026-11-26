"use client";

import React from "react";
import { RouteErrorCard } from "@/components/route-state-ui";

export default function ProfileError({
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
      title="Không thể tải trang Hồ sơ"
      description="Đã có lỗi khi tải dữ liệu hồ sơ học viên. Vui lòng thử lại."
    />
  );
}
