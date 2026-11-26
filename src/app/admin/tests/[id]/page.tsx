import React from "react";
import { notFound } from "next/navigation";
import { getAdminTestById } from "@/lib/cms-tests";
import { TestBuilderClient } from "@/components/admin/test-builder-client";

export const metadata = {
  title: "Chỉnh sửa Đề thi IELTS",
  robots: { index: false, follow: false },
};

export default async function AdminTestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const test = await getAdminTestById(id);
  if (!test) notFound();

  return <TestBuilderClient initialTest={test} />;
}
