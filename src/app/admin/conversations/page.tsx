import React from "react";
import { listLearningItems } from "@/lib/cms-learning";
import { ConversationsCmsClient } from "@/components/admin/conversations-cms-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý Hội thoại AI · Admin CMS",
  robots: { index: false, follow: false },
};

export default async function AdminConversationsPage() {
  const { items } = await listLearningItems("conversations", { page: 1, pageSize: 100 });
  return <ConversationsCmsClient initialItems={items} />;
}
