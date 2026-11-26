import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { Be_Vietnam_Pro } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GlobalFlashcardModal } from "@/components/flashcard-quick-add";
import { MentorFloatingButton } from "@/components/mentor-floating-button";
import { getAuthState } from "@/lib/auth";
import {
  getSiteGeneralSettings,
  getSiteSeoSettings,
} from "@/lib/site-content";
import { isValidSocialProfileUrl } from "@/lib/system-cms-shared";
import { GA4_ID_REGEX } from "@/lib/seo-cms-shared";
import { getAppBaseUrl } from "@/lib/seo";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

function toAbsoluteUrl(raw: string | undefined, baseUrl: string): string | undefined {
  const trimmed = (raw || "").trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${baseUrl}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getAppBaseUrl();
  const [seo, general] = await Promise.all([
    getSiteSeoSettings(),
    getSiteGeneralSettings(),
  ]);

  const siteName = general.siteName || "Ôn IELTS";

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: seo.defaultMetaTitle,
      template: seo.titleTemplate.includes("%s")
        ? seo.titleTemplate
        : `%s | ${siteName}`,
    },
    description: seo.defaultMetaDescription,
    keywords: seo.defaultKeywords.length > 0 ? seo.defaultKeywords : undefined,
    verification: seo.googleSiteVerification
      ? { google: seo.googleSiteVerification }
      : undefined,
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = getAppBaseUrl();
  const [locale, messages, authState, siteSettings, seoSettings] =
    await Promise.all([
      getLocale(),
      getMessages(),
      getAuthState(),
      getSiteGeneralSettings(),
      getSiteSeoSettings(),
    ]);

  const sameAs = [
    siteSettings.socialYoutube,
    siteSettings.socialFacebook,
    siteSettings.socialTiktok,
    siteSettings.socialZalo,
  ].filter((u) => isValidSocialProfileUrl(u));

  const orgLogoUrl = toAbsoluteUrl(
    seoSettings.organizationLogo || siteSettings.logoUrl,
    baseUrl
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: siteSettings.siteName || "Ôn IELTS",
    url: baseUrl,
    logo: orgLogoUrl,
    email: siteSettings.supportEmail || undefined,
    description:
      siteSettings.taglineVi ||
      seoSettings.defaultMetaDescription ||
      "Nền tảng tự học và luyện thi IELTS toàn diện tích hợp AI cho người học Việt Nam.",
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };

  const announcementText =
    locale === "en"
      ? siteSettings.announcementTextEn || siteSettings.announcementTextVi
      : siteSettings.announcementTextVi;

  // Strict allowlist check before rendering GA4 script (prevents arbitrary script injection)
  const ga4Id =
    seoSettings.googleAnalyticsId &&
    GA4_ID_REGEX.test(seoSettings.googleAnalyticsId.trim())
      ? seoSettings.googleAnalyticsId.trim()
      : "";

  return (
    <html lang={locale} suppressHydrationWarning className={beVietnamPro.variable}>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {ga4Id && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}');`}
            </Script>
          </>
        )}
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {siteSettings.announcementEnabled && announcementText && (
              <div className="bg-emerald-700 px-4 py-2 text-center text-xs font-semibold text-white">
                {siteSettings.announcementHref ? (
                  <Link
                    href={siteSettings.announcementHref}
                    className="hover:underline"
                  >
                    {announcementText} →
                  </Link>
                ) : (
                  <span>{announcementText}</span>
                )}
              </div>
            )}
            <SiteHeader user={authState.user} authStatus={authState.status} />
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
