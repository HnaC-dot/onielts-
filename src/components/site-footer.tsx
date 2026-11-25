import React from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "./brand-logo";

export async function SiteFooter() {
  const tBrand = await getTranslations("brand");
  const tFooter = await getTranslations("footer");
  const tNav = await getTranslations("nav.menu");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand + Non-Affiliation Disclaimer */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <BrandLogo />
            </Link>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {tBrand("tagline")}
            </p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {tBrand("disclaimer")}
            </p>
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-800"
              >
                YouTube
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-800"
              >
                Facebook
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-800"
              >
                TikTok
              </a>
            </div>
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
          {tFooter("copyright", { year })}
        </div>
      </div>
    </footer>
  );
}
