import React from "react";
import { buildPublicPageMetadata } from "@/lib/seo-server";

export async function generateMetadata() {
  return buildPublicPageMetadata({
    title: "Đăng nhập tài khoản Ôn IELTS",
    description:
      "Đăng nhập bằng Google hoặc Email OTP để lưu lịch sử làm đề thi IELTS, đồng bộ Flashcards và chấm bài Writing/Speaking bằng AI.",
    pathname: "/auth",
    type: "website",
    noindex: true,
  });
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
