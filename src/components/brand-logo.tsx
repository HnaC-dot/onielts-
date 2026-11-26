/* eslint-disable @next/next/no-img-element */
import React from "react";
import { cn } from "@/lib/utils";
import type { BrandingConfig } from "@/lib/appearance-shared";

interface BrandLogoProps {
  className?: string;
  compact?: boolean;
  branding?: Pick<BrandingConfig, "siteName" | "logoLightUrl" | "logoDarkUrl">;
}

function renderStyledSiteName(siteName: string) {
  const trimmed = siteName.trim() || "Ôn IELTS";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0];
    const rest = parts.slice(1).join(" ");
    return (
      <>
        {first}{" "}
        <span className="text-emerald-600 dark:text-emerald-400">{rest}</span>
      </>
    );
  }
  return trimmed;
}

export function BrandLogo({
  className,
  compact = false,
  branding,
}: BrandLogoProps) {
  const siteName = branding?.siteName?.trim() || "Ôn IELTS";
  const lightUrl = branding?.logoLightUrl?.trim() || "";
  const darkUrl = branding?.logoDarkUrl?.trim() || "";

  if (lightUrl || darkUrl) {
    const resolvedLight = lightUrl || darkUrl;
    const resolvedDark = darkUrl || lightUrl;
    return (
      <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
        <img
          src={resolvedLight}
          alt={siteName}
          className={cn(
            "h-8 w-auto max-w-[160px] object-contain",
            darkUrl && lightUrl ? "dark:hidden" : ""
          )}
        />
        {darkUrl && lightUrl && (
          <img
            src={resolvedDark}
            alt={siteName}
            className="hidden h-8 w-auto max-w-[160px] object-contain dark:block"
          />
        )}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <svg
        width="34"
        height="34"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="64" height="64" rx="16" fill="var(--primary, #059669)" />
        <path
          d="M16 22C16 19.7909 17.7909 18 20 18H30C32.2091 18 34 19.7909 34 22V46C34 44.3431 32.6569 43 31 43H18C16.8954 43 16 42.1046 16 41V22Z"
          fill="#FFFFFF"
          fillOpacity="0.96"
        />
        <path
          d="M48 22C48 19.7909 46.2091 18 44 18H34C31.7909 18 30 19.7909 30 22V46C30 44.3431 31.3431 43 33 43H46C47.1046 43 48 42.1046 48 41V22Z"
          fill="#D1FAE5"
        />
        <circle cx="45" cy="18" r="6" fill="#FEF08A" />
        <path
          d="M45 14.5V21.5M41.5 18H48.5"
          stroke="#047857"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {renderStyledSiteName(siteName)}
          </span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {(() => {
              const raw = (
                process.env.NEXT_PUBLIC_SITE_URL ||
                process.env.NEXT_PUBLIC_APP_URL ||
                ""
              ).trim();
              if (!raw) return "onielts.vn";
              try {
                const h = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).host;
                return h.startsWith("localhost") ? "onielts.vn" : h;
              } catch {
                return "onielts.vn";
              }
            })()}
          </span>
        </span>
      )}
    </span>
  );
}
