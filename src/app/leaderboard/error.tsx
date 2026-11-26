"use client";

import React from "react";
import { RouteErrorCard } from "@/components/route-state-ui";

export default function LeaderboardError({
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
      title="Không thể tải Bảng xếp hạng"
      description="Đã có lỗi tạm thời khi tải bảng xếp hạng học viên. Vui lòng thử lại."
    />
  );
}
