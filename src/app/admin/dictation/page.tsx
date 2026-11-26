import React from "react";
import { listLearningItems } from "@/lib/cms-learning";
import { DictationCmsClient } from "@/components/admin/dictation-cms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý Chép chính tả & Shadowing · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminDictationPage() {
  const { items } = await listLearningItems("dictation", {
    page: 1,
    pageSize: 100,
  });
  return <DictationCmsClient initialItems={items} />;
}
