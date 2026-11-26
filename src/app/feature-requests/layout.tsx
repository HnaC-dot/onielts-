import React from "react";
import { buildPublicPageMetadata } from "@/lib/seo-server";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Đề xuất tính năng mới cho Ôn IELTS",
    description:
      "Gửi ý tưởng tính năng và bình chọn các cải tiến học tập được cộng đồng học viên Ôn IELTS mong muốn nhất.",
    pathname: "/feature-requests",
    type: "website",
  });
}

export default function FeatureRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
