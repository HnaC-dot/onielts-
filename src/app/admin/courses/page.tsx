import React from "react";
import { listLearningItems } from "@/lib/cms-learning";
import { CoursesCmsClient } from "@/components/admin/courses-cms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý Khóa học & Bài học · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminCoursesPage() {
  const { items } = await listLearningItems("courses", { page: 1, pageSize: 100 });
  return <CoursesCmsClient initialItems={items} />;
}
