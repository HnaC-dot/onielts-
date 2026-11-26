/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteGeneralSettings } from "@/lib/site-content";
import { BrandLogo } from "./brand-logo";

export async function SiteFooter() {
  const [locale, tBrand, tFooter, tNav, settings] = await Promise.all([
    getLocale(),
    getTranslations("brand"),
    getTranslations("footer"),
    getTranslations("nav.menu"),
    getSiteGeneralSettings(),
  ]);
  const isEn = locale === "en";
  const year = new Date().getFullYear();

  const tagline = isEn
    ? settings.taglineEn || tBrand("tagline")
    : settings.taglineVi || tBrand("tagline");
  const disclaimer = isEn
    ? settings.disclaimerEn || tBrand("disclaimer")
    : settings.disclaimerVi || tBrand("disclaimer");
  const copyrightText =
    !isEn && settings.footerCopyrightVi
      ? settings.footerCopyrightVi.replace("{year}", String(year))
      : tFooter("copyright", { year });

  const socials = [
    { label: "YouTube", href: settings.socialYoutube },
    { label: "Facebook", href: settings.socialFacebook },
    { label: "TikTok", href: settings.socialTiktok },
    { label: "Zalo", href: settings.socialZalo },
  ].filter((s) => s.href && /^https?:\/\//i.test(s.href));

  return (
    <footer className="mt-20 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand + Non-Affiliation Disclaimer */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.siteName}
                  className="h-9 w-auto object-contain"
                />
              ) : (
                <BrandLogo />
              )}
            </Link>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {tagline}
            </p>
            {(settings.supportEmail || settings.hotline) && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {settings.supportEmail && (
                  <span>
                    Email:{" "}
                    <a
                      href={`mailto:${settings.supportEmail}`}
                      className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {settings.supportEmail}
                    </a>
                  </span>
                )}
                {settings.supportEmail && settings.hotline ? " · " : ""}
                {settings.hotline && <span>Hotline: {settings.hotline}</span>}
              </p>
            )}
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {disclaimer}
            </p>
            {socials.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-slate-500">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-800"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {tFooter("resources")}
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
              <li><Link href="/tests" className="hover:text-emerald-600">{tNav("readingTests")}</Link></li>
              <li><Link href="/daily-exam" className="hover:text-emerald-600">{tNav("dailyExams")}</Link></li>
              <li><Link href="/band-calculator" className="hover:text-emerald-600">{tNav("bandCalculator")}</Link></li>
              <li><Link href="/tools" className="hover:text-emerald-600">{tNav("allTools")}</Link></li>
              <li><Link href="/blog" className="hover:text-emerald-600">{tNav("blog")}</Link></li>
              <li><Link href="/mentor" className="hover:text-emerald-600">{tNav("mentorAi")}</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {tFooter("legal")}
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
              <li><Link href="/legal/privacy" className="hover:text-emerald-600">{tFooter("privacy")}</Link></li>
              <li><Link href="/legal/terms" className="hover:text-emerald-600">{tFooter("terms")}</Link></li>
              <li><Link href="/legal/disclaimers" className="hover:text-emerald-600">{tFooter("disclaimers")}</Link></li>
              <li><Link href="/legal/refund-policy" className="hover:text-emerald-600">{tFooter("refund")}</Link></li>
              <li><Link href="/legal/faqs" className="hover:text-emerald-600">{tFooter("faqs")}</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {tFooter("company")}
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
              <li><Link href="/about" className="hover:text-emerald-600">{tFooter("about")}</Link></li>
              <li><Link href="/pricing" className="hover:text-emerald-600">{tFooter("pricing")}</Link></li>
              <li><Link href="/referral" className="hover:text-emerald-600">{tFooter("referral")}</Link></li>
              <li><Link href="/feature-requests" className="hover:text-emerald-600">{tFooter("featureRequests")}</Link></li>
              <li><Link href="/contact" className="hover:text-emerald-600">{tFooter("contact")}</Link></li>
              <li><Link href="/sitemap-html" className="hover:text-emerald-600">{tFooter("sitemap")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {copyrightText}
        </div>
      </div>
    </footer>
  );
}
