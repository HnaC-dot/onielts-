import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ôn IELTS — Nền tảng tự học & luyện thi IELTS thông minh cùng AI",
    short_name: "Ôn IELTS",
    description:
      "Luyện thi IELTS 4 kỹ năng chuẩn máy tính, chấm Writing & Speaking bằng AI, đề thi mỗi ngày và lộ trình cá nhân hóa cho người Việt.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    lang: "vi",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
