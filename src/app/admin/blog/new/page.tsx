import React from "react";
import { getAuthState } from "@/lib/auth";
import { BlogEditorClient } from "@/components/admin/blog-editor-client";

export const metadata = {
  title: "Viết bài Blog mới",
  robots: { index: false, follow: false },
};

export default async function AdminBlogNewPage() {
  const authState = await getAuthState();
  const defaultAuthor =
    authState.user?.full_name || "Đội ngũ học thuật Ôn IELTS";

  return <BlogEditorClient defaultAuthor={defaultAuthor} />;
}
