import React from "react";
import { listLearningItems } from "@/lib/cms-learning";
import { WritingExercisesCmsClient } from "@/components/admin/writing-exercises-cms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý Nâng cấp câu viết · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminWritingExercisesPage() {
  const { items } = await listLearningItems("writing-exercises", {
    page: 1,
    pageSize: 100,
  });
  return <WritingExercisesCmsClient initialItems={items} />;
}
