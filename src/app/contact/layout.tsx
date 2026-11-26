import React from "react";
import { buildPublicPageMetadata } from "@/lib/seo-server";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Liên hệ & Hỗ trợ học viên Ôn IELTS",
    description:
      "Gửi câu hỏi, báo lỗi kỹ thuật, yêu cầu hỗ trợ thanh toán VietQR hoặc đề xuất hợp tác trực tiếp tới đội ngũ Ôn IELTS.",
    pathname: "/contact",
    type: "website",
  });
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
