"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

interface HorizontalCarouselSectionProps {
  title: string;
  subtitle: string;
  viewAllHref: string;
  viewAllLabel: string;
  children: React.ReactNode;
}

export function HorizontalCarouselSection({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel,
  children,
}: HorizontalCarouselSectionProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollByAmount(-340)}
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollByAmount(340)}
            className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/60"
          >
            {viewAllLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="no-scrollbar mt-6 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
      >
        {children}
      </div>
    </section>
  );
}
