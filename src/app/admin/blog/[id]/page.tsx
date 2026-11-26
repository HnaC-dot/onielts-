import React from "react";
import { notFound } from "next/navigation";
import { getAdminBlogPostById } from "@/lib/cms-blog";
import { BlogEditorClient } from "@/components/admin/blog-editor-client";

export const metadata = {
  title: "Chỉnh sửa bài Blog",
  robots: { index: false, follow: false },
};

export default async function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getAdminBlogPostById(id);
  if (!post) notFound();

  return <BlogEditorClient initialPost={post} />;
}
