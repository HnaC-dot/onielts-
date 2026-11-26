import React from "react";
import { buildPublicPageMetadata } from "@/lib/seo-server";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Chuyển văn bản tiếng Anh thành giọng nói (Text-to-Speech UK/US/AU)",
    description:
      "Nghe đọc bài mẫu Writing, Speaking, từ vựng và đoạn văn IELTS với giọng Anh – Mỹ – Úc tự nhiên, tùy chỉnh tốc độ phục vụ Shadowing.",
    pathname: "/tools/text-to-speech",
    type: "website",
  });
}

export default function TextToSpeechLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
