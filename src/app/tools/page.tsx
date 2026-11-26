import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ArrowRight, Calculator, Sparkles, Volume2 } from "lucide-react";
import { GENERAL_AI_TOOLS } from "@/lib/ai-tools-config";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TOTAL_TOOLS_HUB_COUNT = GENERAL_AI_TOOLS.length + 2; // AI tools + Text-to-Speech + Band Calculator

export async function generateMetadata() {
  const names = GENERAL_AI_TOOLS.map((t) => t.titleVi).join(", ");
  return buildPublicPageMetadata({
    title: `Bộ ${TOTAL_TOOLS_HUB_COUNT} công cụ AI & tiện ích học IELTS`,
    description: `Tập hợp ${TOTAL_TOOLS_HUB_COUNT} công cụ học IELTS gồm ${names}, Chuyển văn bản thành giọng nói và Tính điểm Band IELTS.`,
    pathname: "/tools",
    type: "website",
  });
}

export default async function ToolsHubPage() {
  const locale = await getLocale();
  const isEn = locale === "en";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "AI Learning Tools for IELTS" : "Bộ công cụ AI luyện thi IELTS"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? `Explore ${TOTAL_TOOLS_HUB_COUNT} focused AI & study utilities powered by Gemini to accelerate reading, writing, grammar, and listening practice.`
            : `Tập hợp ${TOTAL_TOOLS_HUB_COUNT} công cụ AI & tiện ích chuyên sâu (gồm ${GENERAL_AI_TOOLS.length} trợ lý AI văn bản, Text-to-Speech và Tính điểm Band) giúp bạn học nhanh, hiểu sâu và viết chuẩn học thuật.`}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {GENERAL_AI_TOOLS.map((tool) => (
          <Link key={tool.slug} href={`/tools/${tool.slug}`} className="group">
            <Card className="h-full p-6 transition hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950 dark:text-emerald-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <Badge variant="secondary">AI</Badge>
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                {isEn ? tool.titleEn : tool.titleVi}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {isEn ? tool.descriptionEn : tool.descriptionVi}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {isEn ? "Open tool" : "Mở công cụ"} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Card>
          </Link>
        ))}

        <Link href="/tools/text-to-speech" className="group">
          <Card className="h-full p-6 transition hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950 dark:text-emerald-300">
                <Volume2 className="h-5 w-5" />
              </div>
              <Badge>Audio</Badge>
            </div>
            <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
              {isEn ? "Text-to-Speech (UK / US / AU)" : "Chuyển văn bản thành giọng nói"}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {isEn
                ? "Listen to essays, cue cards, and vocabulary lists with adjustable speed and natural voices."
                : "Nghe đọc bài mẫu Writing, Speaking hoặc danh sách từ vựng với tốc độ tùy chỉnh."}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {isEn ? "Open tool" : "Mở công cụ"} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Card>
        </Link>

        <Link href="/band-calculator" className="group">
          <Card className="h-full p-6 transition hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950 dark:text-emerald-300">
                <Calculator className="h-5 w-5" />
              </div>
              <Badge variant="secondary">IELTS</Badge>
            </div>
            <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
              {isEn ? "Band Score Calculator" : "Tính điểm Band IELTS"}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {isEn
                ? "Official 4-skill rounding and raw-score tables for Listening and Reading."
                : "Tính điểm Overall (6.25 → 6.5, 6.75 → 7.0) và quy đổi số câu đúng Reading/Listening."}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {isEn ? "Calculate now" : "Tính điểm ngay"} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Card>
        </Link>
      </div>
    </div>
  );
}
