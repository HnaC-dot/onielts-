import React from "react";
import { listLearningItems } from "@/lib/cms-learning";
import { PronunciationCmsClient } from "@/components/admin/pronunciation-cms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý Phát âm IPA · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminPronunciationPage() {
  const { items } = await listLearningItems("pronunciation", {
    page: 1,
    pageSize: 100,
  });
  return <PronunciationCmsClient initialItems={items} />;
}
