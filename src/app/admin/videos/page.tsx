import React from "react";
import { listLearningItems } from "@/lib/cms-learning";
import { VideosCmsClient } from "@/components/admin/videos-cms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý Video tương tác · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminVideosPage() {
  const { items } = await listLearningItems("videos", {
    page: 1,
    pageSize: 100,
  });
  return <VideosCmsClient initialItems={items} />;
}
