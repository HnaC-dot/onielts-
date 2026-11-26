import React from "react";
import { buildPublicPageMetadata } from "@/lib/seo-server";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Tạo bài mẫu IELTS Writing Band 8.5–9.0 bằng AI",
    description:
      "Nhập đề IELTS Writing Task 1 hoặc Task 2 để AI lập dàn ý tiếng Việt, tạo bài mẫu Band 8.5–9.0 nguyên bản cùng danh sách từ vựng học thuật.",
    pathname: "/writing/generator",
    type: "website",
  });
}

export default function WritingGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
