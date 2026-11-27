import React from "react";
import { getAuthState } from "@/lib/auth";
import {
  getBlogQualityConfig,
  getInternalLinkCatalog,
} from "@/lib/cms-content-production";
import { BlogEditorClient } from "@/components/admin/blog-editor-client";

export const metadata = {
  title: "Viết bài Blog mới",
  robots: { index: false, follow: false },
};

export default async function AdminBlogNewPage() {
  const [authState, qualityConfig, linkCatalog] = await Promise.all([
    getAuthState(),
    getBlogQualityConfig(),
    getInternalLinkCatalog(),
  ]);
  const defaultAuthor =
    authState.user?.full_name || "Đội ngũ học thuật Ôn IELTS";
  const canEditQualityConfig = authState.user?.role === "admin";

  return (
    <BlogEditorClient
      defaultAuthor={defaultAuthor}
      initialQualityConfig={qualityConfig}
      linkCatalog={linkCatalog}
      canEditQualityConfig={canEditQualityConfig}
    />
  );
}
