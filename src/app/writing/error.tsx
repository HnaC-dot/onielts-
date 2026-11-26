"use client";

import React from "react";
import { RouteErrorCard } from "@/components/route-state-ui";

export default function WritingError({
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
      title="Không thể tải phòng luyện Writing AI"
      description="Đã có lỗi tạm thời khi tải bài luyện Writing. Vui lòng thử lại."
    />
  );
}
