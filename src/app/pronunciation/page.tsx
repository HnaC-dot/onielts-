import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getPronunciationSounds } from "@/lib/db";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata() {
  const sounds = await getPronunciationSounds(false);
  return buildPublicPageMetadata({
    title: `Luyện phát âm tiếng Anh chuẩn bảng IPA (${sounds.length} âm)`,
    description: `Bảng ký hiệu ngữ âm IPA gồm ${sounds.length} nguyên âm đơn, nguyên âm đôi và phụ âm kèm hướng dẫn khẩu hình, mẹo sửa lỗi người Việt và chấm phát âm AI tham khảo.`,
    pathname: "/pronunciation",
    type: "website",
  });
}

export default async function PronunciationIndexPage() {
  const [locale, allSounds] = await Promise.all([
    getLocale(),
    getPronunciationSounds(),
  ]);
  const isEn = locale === "en";

  const groups = [
    { id: "vowel", label: isEn ? "Single Vowels (Monophthongs)" : "Nguyên âm đơn (Vowels)" },
    { id: "diphthong", label: isEn ? "Diphthongs" : "Nguyên âm đôi (Diphthongs)" },
    { id: "consonant", label: isEn ? "Key Consonants for Vietnamese Learners" : "Phụ âm trọng tâm cho người Việt" },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "Interactive IPA Pronunciation Chart" : "Bảng luyện phát âm chuẩn IPA"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Select any IPA sound to view mouth placement, Vietnamese learner tips, audio examples, and AI reference scoring."
            : "Chọn từng âm IPA để xem khẩu hình, mẹo khắc phục lỗi phát âm người Việt, nghe từ mẫu và ghi âm chấm điểm tham khảo."}
        </p>
      </div>

      {groups.map((g) => {
        const sounds = allSounds.filter((s) => s.category === g.id);
        return (
          <section key={g.id} className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{g.label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {sounds.map((s) => (
                <Link key={s.slug} href={`/pronunciation/${s.slug}`}>
                  <Card className="h-full p-5 transition hover:border-emerald-400 hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {s.symbol}
                      </span>
                      <Badge variant="secondary">{s.examples.length} từ</Badge>
                    </div>
                    <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                      {isEn ? s.title_en : s.title_vi}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {s.examples.map((e) => e.word).slice(0, 3).join(", ")}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
