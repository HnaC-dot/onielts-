import type { Metadata } from "next";
import Script from "next/script";
import { Be_Vietnam_Pro } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteWidgets } from "@/components/site-widgets";
import { GlobalFlashcardModal } from "@/components/flashcard-quick-add";
import { MentorFloatingButton } from "@/components/mentor-floating-button";
import { getAuthState } from "@/lib/auth";
import { getServerNowMs, getSiteSeoSettings } from "@/lib/site-content";
import {
  getEffectiveAppearance,
  getPublishedAppearance,
} from "@/lib/cms-appearance";
import {
  applyUiTextOverrides,
  buildThemeCssVariables,
  getGoogleFontHref,
} from "@/lib/appearance-shared";
import { isValidSocialProfileUrl } from "@/lib/system-cms-shared";
import { GA4_ID_REGEX, GSC_TOKEN_REGEX } from "@/lib/seo-cms-shared";
import { getAppBaseUrl, serializeJsonLd } from "@/lib/seo";
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
  const [seo, appearance] = await Promise.all([
    getSiteSeoSettings(),
    getPublishedAppearance(),
  ]);

  const siteName = appearance.branding.siteName || "Ôn IELTS";
  const gscCandidate = (
    seo.googleSiteVerification ||
    appearance.analytics.googleSiteVerification ||
    ""
  ).trim();
  const gscToken =
    gscCandidate && GSC_TOKEN_REGEX.test(gscCandidate) ? gscCandidate : "";
  const faviconUrl = appearance.branding.faviconUrl?.trim();

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
    icons: faviconUrl ? { icon: faviconUrl, shortcut: faviconUrl } : undefined,
    verification: gscToken ? { google: gscToken } : undefined,
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
  const [locale, messages, authState, seoSettings] = await Promise.all([
    getLocale(),
    getMessages(),
    getAuthState(),
    getSiteSeoSettings(),
  ]);

  const isAdmin = authState.user?.role === "admin";
  const { config: appearance, isPreviewingDraft } =
    await getEffectiveAppearance(isAdmin);
  const serverNowMs = getServerNowMs();

  const mergedMessages = applyUiTextOverrides(
    messages as Record<string, unknown>,
    appearance.uiTexts,
    locale
  );

  const sameAs = [
    appearance.footer.socialYoutube,
    appearance.footer.socialFacebook,
    appearance.footer.socialTiktok,
    appearance.footer.socialZalo,
  ].filter((u) => isValidSocialProfileUrl(u));

  const orgLogoUrl = toAbsoluteUrl(
    seoSettings.organizationLogo || appearance.branding.logoLightUrl,
    baseUrl
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: appearance.branding.siteName || "Ôn IELTS",
    url: baseUrl,
    logo: orgLogoUrl,
    email: appearance.footer.email || undefined,
    description:
      appearance.branding.taglineVi ||
      seoSettings.defaultMetaDescription ||
      "Nền tảng tự học và luyện thi IELTS toàn diện tích hợp AI cho người học Việt Nam.",
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };

  // Strict allowlist check before rendering GA4 script (NO arbitrary <script> injection)
  const ga4Candidate = (
    seoSettings.googleAnalyticsId ||
    appearance.analytics.googleAnalyticsId ||
    ""
  ).trim();
  const ga4Id =
    ga4Candidate && GA4_ID_REGEX.test(ga4Candidate) ? ga4Candidate : "";

  const googleFontHref = getGoogleFontHref(appearance.theme.fontFamily);
  const themeCss = buildThemeCssVariables(appearance.theme);

  return (
    <html lang={locale} suppressHydrationWarning className={beVietnamPro.variable}>
      <head>
        {googleFontHref && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
              rel="preconnect"
              href="https://fonts.gstatic.com"
              crossOrigin="anonymous"
            />
            <link rel="stylesheet" href={googleFontHref} />
          </>
        )}
        <style
          id="cms-theme-vars"
          dangerouslySetInnerHTML={{ __html: themeCss }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
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
        <ThemeProvider defaultTheme={appearance.theme.defaultColorMode}>
          <NextIntlClientProvider locale={locale} messages={mergedMessages}>
            <SiteWidgets
              widgets={appearance.widgets}
              isAdmin={isAdmin}
              isPreviewingDraft={isPreviewingDraft}
              locale={locale}
              serverNowMs={serverNowMs}
            >
              <SiteHeader
                user={authState.user}
                authStatus={authState.status}
                branding={appearance.branding}
                headerMenu={appearance.menus.publicHeader}
              />
              <main className="flex-1">{children}</main>
              <SiteFooter />
              <GlobalFlashcardModal />
              <MentorFloatingButton />
            </SiteWidgets>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
