"use client";

import React, { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import {
  BookmarkPlus,
  CheckCircle2,
  Layers,
  RotateCw,
  Trash2,
  Volume2,
} from "lucide-react";
import type { FlashcardItem, FlashcardSet } from "@/lib/types";
import { speakEnglish } from "@/lib/audio-recorder";
import { openAddFlashcardModal } from "./flashcard-quick-add";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function FlashcardsClient({
  initialSets,
  initialCards,
}: {
  initialSets: FlashcardSet[];
  initialCards: FlashcardItem[];
}) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [sets, setSets] = useState<FlashcardSet[]>(initialSets);
  const [cards, setCards] = useState<FlashcardItem[]>(initialCards);
  const [selectedSetId, setSelectedSetId] = useState<string>("all");
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const visibleCards = useMemo(
    () =>
      selectedSetId === "all"
        ? cards
        : cards.filter((c) => c.set_id === selectedSetId),
    [cards, selectedSetId]
  );

  const refreshCards = async () => {
    const res = await fetch("/api/flashcards");
    if (res.ok) {
      const d = await res.json();
      setSets(d.sets ?? []);
      setCards(d.cards ?? []);
    }
  };

  const handleGrade = async (quality: 1 | 3 | 4 | 5) => {
    const card = visibleCards[reviewIdx];
    if (!card) return;
    const res = await fetch("/api/flashcards/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, quality }),
    });
    if (res.ok) {
      const data = await res.json();
      setCards((prev) => prev.map((c) => (c.id === card.id ? data.card : c)));
    }
    setFlipped(false);
    if (reviewIdx + 1 < visibleCards.length) {
      setReviewIdx(reviewIdx + 1);
    } else {
      setReviewMode(false);
      setReviewIdx(0);
    }
  };

  const handleDelete = async (cardId: string) => {
    const res = await fetch("/api/flashcards/review", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId }),
    });
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    }
  };

  const currentReviewCard = visibleCards[reviewIdx];

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedSetId("all");
              setReviewMode(false);
            }}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer ${
              selectedSetId === "all"
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {isEn ? `All Cards (${cards.length})` : `Tất cả thẻ (${cards.length})`}
          </button>
          {sets.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelectedSetId(s.id);
                setReviewMode(false);
              }}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer ${
                selectedSetId === s.id
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              openAddFlashcardModal("");
              setTimeout(refreshCards, 1800);
            }}
          >
            <BookmarkPlus className="h-4 w-4 text-emerald-600" />
            {isEn ? "Add Card" : "Thêm thẻ mới"}
          </Button>
          <Button
            type="button"
            id="start-srs-review-btn"
            size="sm"
            disabled={visibleCards.length === 0}
            onClick={() => {
              setReviewIdx(0);
              setFlipped(false);
              setReviewMode((v) => !v);
            }}
          >
            <Layers className="h-4 w-4" />
            {reviewMode
              ? isEn
                ? "Exit Review"
                : "Thoát chế độ ôn"
              : isEn
              ? `Study Spaced Repetition (${visibleCards.length})`
              : `Ôn tập lặp lại ngắt quãng (${visibleCards.length})`}
          </Button>
        </div>
      </div>

      {/* SM-2 SPACED REPETITION FLIP CARD ARENA */}
      {reviewMode && currentReviewCard ? (
        <Card className="mx-auto max-w-2xl p-8 text-center space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <Badge>
              SM-2 Spaced Repetition · {reviewIdx + 1} / {visibleCards.length}
            </Badge>
            <span>
              Interval: {currentReviewCard.interval_days}d · EF {currentReviewCard.ease_factor}
            </span>
          </div>

          <div
            onClick={() => setFlipped((f) => !f)}
            className="min-h-[220px] flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 transition hover:bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30 cursor-pointer"
          >
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {currentReviewCard.term}
            </p>
            <p className="mt-1 text-sm font-mono text-emerald-700 dark:text-emerald-400">
              {currentReviewCard.phonetic}{" "}
              {currentReviewCard.part_of_speech && `(${currentReviewCard.part_of_speech})`}
            </p>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                speakEnglish(currentReviewCard.term);
              }}
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-xs hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-300 cursor-pointer"
            >
              <Volume2 className="h-3.5 w-3.5" />
              {isEn ? "Pronounce" : "Nghe phát âm"}
            </button>

            {flipped ? (
              <div className="mt-5 border-t border-emerald-200 pt-4 text-sm space-y-2 dark:border-emerald-800">
                <p className="font-bold text-slate-900 dark:text-white">
                  {currentReviewCard.definition_vi}
                </p>
                {currentReviewCard.example_sentence && (
                  <p className="text-xs italic text-slate-600 dark:text-slate-300">
                    “{currentReviewCard.example_sentence}”
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <RotateCw className="h-3.5 w-3.5" />
                {isEn ? "Tap card to reveal Vietnamese meaning & example" : "Nhấn vào thẻ để lật xem nghĩa tiếng Việt & ví dụ"}
              </p>
            )}
          </div>

          {flipped && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button variant="destructive" size="sm" onClick={() => handleGrade(1)}>
                {isEn ? "Again (1d)" : "Quên (1 ngày)"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleGrade(3)}>
                {isEn ? "Hard" : "Khó"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleGrade(4)}>
                {isEn ? "Good" : "Nhớ tốt"}
              </Button>
              <Button size="sm" onClick={() => handleGrade(5)}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isEn ? "Easy" : "Rất dễ"}
              </Button>
            </div>
          )}
        </Card>
      ) : (
        /* Card Grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => (
            <Card key={card.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {card.term}
                    </h2>
                    <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                      {card.phonetic} {card.part_of_speech && `· ${card.part_of_speech}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => speakEnglish(card.term)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 cursor-pointer"
                      aria-label="Listen"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(card.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 cursor-pointer"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {card.definition_vi}
                </p>
                {card.example_sentence && (
                  <p className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs italic text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                    “{card.example_sentence}”
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800">
                <span>Ôn lại sau: {card.interval_days} ngày</span>
                <span>Lần lặp: {card.repetitions}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
