"use client";

import React from "react";
import { RouteErrorCard } from "@/components/route-state-ui";

export default function SpeakingError({
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
      title="Không thể tải phòng luyện Speaking AI"
      description="Đã có lỗi tạm thời khi tải bài luyện Speaking. Vui lòng thử lại."
    />
  );
}
