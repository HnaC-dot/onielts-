import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getAuthState } from "@/lib/auth";
import { getEffectiveAppearance } from "@/lib/cms-appearance";
import { getSiteGeneralSettings } from "@/lib/site-content";
import { isSafeNavHref } from "@/lib/appearance-shared";
import { isValidSocialProfileUrl } from "@/lib/system-cms-shared";
import { BrandLogo } from "./brand-logo";

function isExternalUrl(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

export async function SiteFooter() {
  const [locale, authState, general] = await Promise.all([
    getLocale(),
    getAuthState(),
    getSiteGeneralSettings(),
  ]);
  const isAdmin = authState.user?.role === "admin";
  const { config: appearance } = await getEffectiveAppearance(isAdmin);

  const isEn = locale === "en";
  const year = new Date().getFullYear();
  const { branding, footer, menus } = appearance;

  const email = (footer.email || general.supportEmail || "").trim();
  const phone = (footer.phone || general.hotline || "").trim();
  const address = (footer.address || general.address || "").trim();

  const description = isEn
    ? footer.descriptionEn || footer.descriptionVi || branding.taglineEn || general.taglineEn
    : footer.descriptionVi || branding.taglineVi || general.taglineVi;
  const disclaimer = isEn
    ? footer.disclaimerEn || footer.disclaimerVi || general.disclaimerEn
    : footer.disclaimerVi || general.disclaimerVi;
  const rawCopyright = isEn
    ? footer.copyrightEn || footer.copyrightVi
    : footer.copyrightVi || general.footerCopyrightVi;
  const copyrightText = rawCopyright
    ? rawCopyright.replace("{year}", String(year))
    : `© ${year} ${branding.siteName}.`;

  const socials = [
    { label: "YouTube", href: footer.socialYoutube || general.socialYoutube },
    { label: "Facebook", href: footer.socialFacebook || general.socialFacebook },
    { label: "TikTok", href: footer.socialTiktok || general.socialTiktok },
    { label: "Zalo", href: footer.socialZalo || general.socialZalo },
  ].filter((s) => isValidSocialProfileUrl(s.href));

  const visibleColumns = (menus.publicFooter ?? []).filter((c) => c.visible);
  const gridColsClass =
    visibleColumns.length === 0
      ? "lg:grid-cols-2"
      : visibleColumns.length === 1
      ? "lg:grid-cols-3"
      : visibleColumns.length === 2
      ? "lg:grid-cols-4"
      : visibleColumns.length === 3
      ? "lg:grid-cols-5"
      : "lg:grid-cols-6";

  return (
    <footer className="mt-20 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className={`grid gap-10 md:grid-cols-2 ${gridColsClass}`}>
          {/* Brand + Contact + Disclaimer + Socials */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <BrandLogo branding={branding} />
            </Link>
            {description && (
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {description}
              </p>
            )}
            {(email || phone || address) && (
              <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {(email || phone) && (
                  <p>
                    {email && (
                      <span>
                        Email:{" "}
                        <a
                          href={`mailto:${email}`}
                          className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          {email}
                        </a>
                      </span>
                    )}
                    {email && phone ? " · " : ""}
                    {phone && (
                      <span>
                        Hotline:{" "}
                        <a
                          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                          className="font-semibold text-slate-700 hover:underline dark:text-slate-300"
                        >
                          {phone}
                        </a>
                      </span>
                    )}
                  </p>
                )}
                {address && <p>{address}</p>}
              </div>
            )}
            {disclaimer && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                {disclaimer}
              </p>
            )}
            {socials.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-slate-500">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-800"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Footer Columns (toggleable & editable from /admin/appearance) */}
          {visibleColumns.map((col) => {
            const visibleLinks = (col.links ?? []).filter(
              (l) => l.visible && isSafeNavHref(l.href)
            );
            return (
              <div key={col.id}>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isEn ? col.labelEn || col.labelVi : col.labelVi}
                </h3>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
                  {visibleLinks.map((link) => {
                    const text = isEn
                      ? link.labelEn || link.labelVi
                      : link.labelVi;
                    return (
                      <li key={link.id}>
                        {isExternalUrl(link.href) ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-emerald-600"
                          >
                            {text}
                          </a>
                        ) : (
                          <Link href={link.href} className="hover:text-emerald-600">
                            {text}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {copyrightText}
        </div>
      </div>
    </footer>
  );
}
