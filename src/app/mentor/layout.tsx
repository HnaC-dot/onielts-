import React from "react";
import { buildPublicPageMetadata } from "@/lib/seo-server";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Mentor Ôn IELTS AI — Lập lộ trình tự học IELTS cá nhân",
    description:
      "Trò chuyện cùng Mentor Ôn IELTS AI bằng tiếng Việt để phân tích điểm yếu, lập kế hoạch ôn tập theo mục tiêu Band và giải đáp mọi thắc mắc IELTS.",
    pathname: "/mentor",
    type: "website",
  });
}

export default function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
