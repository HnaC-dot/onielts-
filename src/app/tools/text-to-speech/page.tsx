"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Play, Square, Volume2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SAMPLE_SCRIPTS = [
  {
    label: "Speaking Part 2 (Band 8.0)",
    text: "One memorable skill I learned recently was digital illustration. At first, coordinating the stylus felt surprisingly tricky, yet practicing for twenty minutes each evening transformed it into my favorite way to unwind.",
  },
  {
    label: "Academic Listening (Environment)",
    text: "Coastal mangrove forests act as natural barriers against storm surges while storing far more carbon per hectare than inland woodlands. Protecting these habitats requires collaboration between local fishermen and municipal planners.",
  },
];

export default function TextToSpeechPage() {
  const locale = useLocale();
  const isEn = locale === "en";

  const [text, setText] = useState(SAMPLE_SCRIPTS[0].text);
  const [accent, setAccent] = useState("en-GB");
  const [rate, setRate] = useState(1.0);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")));
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = accent;
    utter.rate = rate;
    const matched = voices.find((v) => v.lang.toLowerCase().startsWith(accent.toLowerCase()));
    if (matched) utter.voice = matched;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const handleStop = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isEn ? "Text-to-Speech (IELTS Voices)" : "Chuyển văn bản thành giọng nói (TTS)"}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {isEn
              ? "Listen to English essays, cue cards, and vocabulary in UK, US, or Australian English using browser speech synthesis."
              : "Nghe phát âm bài mẫu Speaking/Writing và từ vựng tiếng Anh theo giọng Anh – Mỹ – Úc với tốc độ tùy chỉnh."}
          </p>
        </div>
        <Link href="/tools" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          ← {isEn ? "All AI Tools" : "Tất cả công cụ AI"}
        </Link>
      </div>

      <Card className="p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {SAMPLE_SCRIPTS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setText(s.text)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-500 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>

        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={3000}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isEn ? "Accent" : "Giọng đọc"}
            </label>
            <select
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="en-GB">British English (en-GB)</option>
              <option value="en-US">American English (en-US)</option>
              <option value="en-AU">Australian English (en-AU)</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isEn ? "Playback Speed" : "Tốc độ đọc"}
              </label>
              <Badge variant="secondary">{rate.toFixed(2)}x</Badge>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="mt-3 w-full accent-emerald-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" size="lg" onClick={handleSpeak} disabled={!text.trim()}>
            {speaking ? <Volume2 className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
            {speaking
              ? isEn
                ? "Speaking..."
                : "Đang phát..."
              : isEn
              ? "Listen Now"
              : "Nghe phát âm"}
          </Button>
          {speaking && (
            <Button type="button" variant="outline" size="lg" onClick={handleStop}>
              <Square className="h-4 w-4" />
              {isEn ? "Stop" : "Dừng"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
