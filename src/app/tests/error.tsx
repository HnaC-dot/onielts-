"use client";

import React from "react";
import { RouteErrorCard } from "@/components/route-state-ui";

export default function TestsError({
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
      title="Không thể tải kho đề thi IELTS"
      description="Đã có lỗi tạm thời khi tải danh sách đề thi. Vui lòng thử lại."
    />
  );
}
