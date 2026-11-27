import React from "react";
import { notFound } from "next/navigation";
import { getAuthState } from "@/lib/auth";
import { getAdminBlogPostById } from "@/lib/cms-blog";
import {
  getBlogQualityConfig,
  getInternalLinkCatalog,
} from "@/lib/cms-content-production";
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
  const [post, authState, qualityConfig, linkCatalog] = await Promise.all([
    getAdminBlogPostById(id),
    getAuthState(),
    getBlogQualityConfig(),
    getInternalLinkCatalog(),
  ]);
  if (!post) notFound();

  return (
    <BlogEditorClient
      initialPost={post}
      initialQualityConfig={qualityConfig}
      linkCatalog={linkCatalog}
      canEditQualityConfig={authState.user?.role === "admin"}
    />
  );
}
