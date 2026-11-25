import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GlobalFlashcardModal } from "@/components/flashcard-quick-add";
import { MentorFloatingButton } from "@/components/mentor-floating-button";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://onielts.vn"),
  title: {
    default: "Ôn IELTS — Ôn luyện IELTS thông minh cùng AI",
    template: "%s | Ôn IELTS",
  },
  description:
    "Nền tảng tự học và luyện thi IELTS toàn diện cho người Việt: làm đề thi chuẩn máy tính, chấm Writing & Speaking bằng AI, luyện phát âm IPA, chép chính tả, Shadowing và Flashcard lặp lại ngắt quãng.",
  keywords: [
    "Ôn IELTS",
    "luyện thi IELTS",
    "chấm Writing IELTS AI",
    "luyện Speaking IELTS AI",
    "tính điểm band IELTS",
    "chép chính tả IELTS",
    "phát âm IPA",
  ],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    alternateLocale: ["en_US"],
    siteName: "Ôn IELTS",
    title: "Ôn IELTS — Ôn luyện IELTS thông minh cùng AI",
    description:
      "Làm đề thi IELTS chuẩn máy tính, chấm AI Writing & Speaking tức thì, luyện phát âm IPA và Flashcard thông minh.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages, user] = await Promise.all([
    getLocale(),
    getMessages(),
    getCurrentUser(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Ôn IELTS",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://onielts.vn",
    description:
      "Nền tảng tự học và luyện thi IELTS toàn diện tích hợp AI cho người học Việt Nam.",
    sameAs: ["https://youtube.com", "https://facebook.com", "https://tiktok.com"],
  };

  return (
    <html lang={locale} suppressHydrationWarning className={beVietnamPro.variable}>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <SiteHeader user={user} />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <GlobalFlashcardModal />
            <MentorFloatingButton />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
