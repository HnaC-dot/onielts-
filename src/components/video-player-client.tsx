"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import { BookmarkPlus, Eye, EyeOff, Play, Volume2 } from "lucide-react";
import type { LearnVideo } from "@/lib/types";
import { speakEnglish } from "@/lib/audio-recorder";
import { openAddFlashcardModal } from "./flashcard-quick-add";
import { formatDuration } from "@/lib/utils";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

export function VideoPlayerClient({ video }: { video: LearnVideo }) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [seekSec, setSeekSec] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showVi, setShowVi] = useState(true);

  const handleSeekLine = (idx: number, startSec: number) => {
    setActiveIdx(idx);
    setSeekSec(startSec);
    speakEnglish(video.transcript[idx]?.en ?? "");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* YouTube Player Column */}
      <div className="lg:col-span-7 space-y-4">
        <div className="aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-800">
          <iframe
            key={seekSec}
            src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}?start=${seekSec}&rel=0`}
            title={isEn ? video.title_en : video.title_vi}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>

        <Card className="p-4 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <BookmarkPlus className="h-4 w-4 text-emerald-600" />
            {isEn
              ? "Click any transcript line to seek, or tap any English word to save it directly into Flashcards."
              : "Nhấn vào mốc thời gian để tua video, hoặc nhấn trực tiếp vào từ tiếng Anh bất kỳ để lưu ngay vào Flashcard."}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowVi((v) => !v)}
          >
            {showVi ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showVi ? "Ẩn dịch VI" : "Hiện dịch VI"}
          </Button>
        </Card>
      </div>

      {/* Interactive Synced Transcript Column */}
      <Card className="p-5 lg:col-span-5 max-h-[560px] overflow-y-auto space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {isEn ? "Interactive Synced Transcript" : "Phụ đề tương tác đồng bộ"}
          </h2>
          <span className="text-[11px] text-slate-500">
            {video.transcript.length} {isEn ? "lines" : "đoạn"}
          </span>
        </div>

        <div className="space-y-2.5">
          {video.transcript.map((line, idx) => {
            const isActive = idx === activeIdx;
            const words = line.en.split(/\s+/);
            return (
              <div
                key={idx}
                className={`rounded-xl border p-3.5 transition ${
                  isActive
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <button
                    type="button"
                    onClick={() => handleSeekLine(idx, line.startSec)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-600 hover:text-white dark:text-emerald-300 cursor-pointer"
                  >
                    <Play className="h-3 w-3" />
                    {formatDuration(line.startSec)}
                  </button>
                  <button
                    type="button"
                    onClick={() => speakEnglish(line.en)}
                    title="Đọc câu này"
                    className="text-slate-400 hover:text-emerald-600 cursor-pointer"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                  {words.map((w, wIdx) => {
                    const cleaned = w.replace(/[^a-zA-Z'-]/g, "");
                    return (
                      <React.Fragment key={wIdx}>
                        <button
                          type="button"
                          onClick={() => {
                            if (cleaned.length >= 2) openAddFlashcardModal(cleaned);
                          }}
                          title="Nhấn để lưu Flashcard"
                          className="rounded px-0.5 transition hover:bg-emerald-200/80 hover:text-emerald-950 dark:hover:bg-emerald-800 dark:hover:text-white cursor-pointer"
                        >
                          {w}
                        </button>{" "}
                      </React.Fragment>
                    );
                  })}
                </p>

                {showVi && (
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {line.vi}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
