import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ArrowRight, Compass, Home } from "lucide-react";
import { getAuthState } from "@/lib/auth";
import { getEffectiveAppearance } from "@/lib/cms-appearance";
import { isSafeNavHref } from "@/lib/appearance-shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function NotFoundPage() {
  const [locale, authState] = await Promise.all([getLocale(), getAuthState()]);
  const isAdmin = authState.user?.role === "admin";
  const { config: appearance } = await getEffectiveAppearance(isAdmin);
  const cfg = appearance.widgets.notFoundPage;
  const isEn = locale === "en";

  const title = isEn ? cfg.titleEn || cfg.titleVi : cfg.titleVi;
  const description = isEn
    ? cfg.descriptionEn || cfg.descriptionVi
    : cfg.descriptionVi;
  const buttonLabel = isEn
    ? cfg.buttonLabelEn || cfg.buttonLabelVi
    : cfg.buttonLabelVi;

  const validLinks = (cfg.quickLinks ?? []).filter(
    (l) => l.href && isSafeNavHref(l.href)
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
        <Compass className="h-3.5 w-3.5" />
        <span>404</span>
      </div>

      <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
        {title}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
        {description}
      </p>

      <div className="mt-7">
        <Link href="/">
          <Button size="lg">
            <Home className="h-4 w-4" />
            {buttonLabel}
          </Button>
        </Link>
      </div>

      {validLinks.length > 0 && (
        <div className="mt-10 w-full">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {isEn ? "Popular destinations" : "Liên kết gợi ý"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {validLinks.map((item, idx) => (
              <Link key={`${item.href}-${idx}`} href={item.href}>
                <Card className="flex items-center justify-between px-4 py-3.5 text-left transition hover:border-emerald-400 hover:shadow-xs">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {isEn ? item.labelEn || item.labelVi : item.labelVi}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-emerald-600" />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
