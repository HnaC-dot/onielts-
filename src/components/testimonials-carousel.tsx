"use client";

import React, { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import type { TestimonialItem } from "@/lib/types";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

interface TestimonialsCarouselProps {
  items: TestimonialItem[];
  locale: string;
}

export function TestimonialsCarousel({ items, locale }: TestimonialsCarouselProps) {
  const [page, setPage] = useState(0);
  const visibleCount = 3;
  const maxPage = Math.max(0, items.length - visibleCount);

  if (items.length === 0) return null;

  const displayed =
    items.length <= visibleCount
      ? items
      : items.slice(page, page + visibleCount);

  return (
    <div className="relative">
      <div className="grid gap-5 md:grid-cols-3">
        {displayed.map((item) => (
          <Card
            key={item.id}
            className="flex flex-col justify-between p-6 transition hover:shadow-md"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary">
                    {locale === "en" ? "Example" : "Ví dụ minh họa"}
                  </Badge>
                  <Badge>{item.target_achieved}</Badge>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                  {item.previous_band.toFixed(1)}
                  <ArrowRight className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {item.new_band.toFixed(1)}
                  </span>
                </span>
              </div>
              <Quote className="mt-4 h-6 w-6 text-emerald-600/30" />
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                “{locale === "en" ? item.quote_en : item.quote_vi}”
              </p>
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {item.learner_name.slice(0, 1)}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {item.learner_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {locale === "en" ? item.role_en : item.role_vi}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {items.length > visibleCount && (
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            aria-label="Previous testimonials"
            onClick={() => setPage((p) => (p > 0 ? p - 1 : maxPage))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next testimonials"
            onClick={() => setPage((p) => (p < maxPage ? p + 1 : 0))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
