import React from "react";
import { TestBuilderClient } from "@/components/admin/test-builder-client";

export const metadata = {
  title: "Tạo đề thi IELTS mới",
  robots: { index: false, follow: false },
};

export default function AdminTestsNewPage() {
  return <TestBuilderClient />;
}
