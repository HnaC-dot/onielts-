import React from "react";
import { buildPublicPageMetadata } from "@/lib/seo-server";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Tạo câu trả lời mẫu IELTS Speaking Band 8+ bằng AI",
    description:
      "Tạo câu trả lời mẫu tự nhiên cho IELTS Speaking Part 1, Cue Card Part 2 và Part 3 kèm mẹo diễn đạt, từ vựng ăn điểm và giọng đọc nghe mẫu.",
    pathname: "/speaking/generator",
    type: "website",
  });
}

export default function SpeakingGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
