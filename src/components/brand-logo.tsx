import React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  compact?: boolean;
}

export function BrandLogo({ className, compact = false }: BrandLogoProps) {
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
        <rect width="64" height="64" rx="16" fill="#059669" />
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
            Ôn <span className="text-emerald-600 dark:text-emerald-400">IELTS</span>
          </span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            onielts.vn
          </span>
        </span>
      )}
    </span>
  );
}
