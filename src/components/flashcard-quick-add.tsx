"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BookmarkPlus, Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";

interface FlashcardSetOption {
  id: string;
  title: string;
}

export function openAddFlashcardModal(term: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("onielts:add-flashcard", { detail: { term } })
    );
  }
}

export function GlobalFlashcardModal() {
  const t = useTranslations("flashcardModal");
  const [floatingBtn, setFloatingBtn] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const [term, setTerm] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [definitionVi, setDefinitionVi] = useState("");
  const [definitionEn, setDefinitionEn] = useState("");
  const [exampleSentence, setExampleSentence] = useState("");
  const [sets, setSets] = useState<FlashcardSetOption[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [newSetTitle, setNewSetTitle] = useState("");

  const [isAutofilling, setIsAutofilling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadSets = useCallback(async () => {
    try {
      const res = await fetch("/api/flashcards");
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const loaded: FlashcardSetOption[] = data.sets ?? [];
      setSets(loaded);
      setSelectedSetId((prev) => prev || loaded[0]?.id || "__new__");
    } catch {
      // ignore
    }
  }, []);

  const runAutofill = useCallback(async (word: string) => {
    if (!word.trim()) return;
    setIsAutofilling(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/flashcards/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: word.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(
          data.error ||
            "Không thể tự điền từ vựng bằng AI lúc này. Bạn vẫn có thể nhập thủ công."
        );
        return;
      }
      setPhonetic(data.phonetic ?? "");
      setPartOfSpeech(data.part_of_speech ?? "");
      setDefinitionVi(data.definition_vi ?? "");
      setDefinitionEn(data.definition_en ?? "");
      setExampleSentence(data.example_sentence ?? "");
    } catch {
      setErrorMsg("Lỗi kết nối AI tự điền. Bạn vẫn có thể nhập thủ công.");
    } finally {
      setIsAutofilling(false);
    }
  }, []);

  const openModalWithTerm = useCallback(
    (initialTerm: string) => {
      const cleaned = initialTerm.trim().slice(0, 100);
      setFloatingBtn(null);
      setTerm(cleaned);
      setPhonetic("");
      setPartOfSpeech("");
      setDefinitionVi("");
      setDefinitionEn("");
      setExampleSentence("");
      setNewSetTitle("");
      setSavedNotice(false);
      setErrorMsg("");
      setIsOpen(true);
      void loadSets();
      if (cleaned) {
        void runAutofill(cleaned);
      }
    },
    [loadSets, runAutofill]
  );

  // Listen for custom event from anywhere in the app (videos, reading, header)
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ term?: string }>;
      openModalWithTerm(custom.detail?.term ?? "");
    };
    window.addEventListener("onielts:add-flashcard", handler);
    return () => window.removeEventListener("onielts:add-flashcard", handler);
  }, [openModalWithTerm]);

  // Listen for text selection on any page
  useEffect(() => {
    const onMouseUp = () => {
      if (isOpen) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setFloatingBtn(null);
        return;
      }
      const text = sel.toString().trim();
      // Only trigger for concise words or phrases (1 to 60 chars, containing letters)
      if (text.length < 2 || text.length > 60 || !/[a-zA-Z]/.test(text)) {
        setFloatingBtn(null);
        return;
      }
      const anchorEl = sel.anchorNode?.parentElement;
      if (anchorEl?.closest("input, textarea, [data-no-flashcard-popup]")) {
        setFloatingBtn(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      setFloatingBtn({
        text,
        x: Math.min(window.innerWidth - 160, Math.max(16, rect.left + rect.width / 2 - 70)),
        y: Math.max(72, rect.top - 44),
      });
    };

    const onScroll = () => setFloatingBtn(null);

    document.addEventListener("mouseup", onMouseUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("scroll", onScroll);
    };
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim() || !definitionVi.trim()) {
      setErrorMsg("Vui lòng nhập từ vựng và nghĩa tiếng Việt.");
      return;
    }
    setIsSaving(true);
    setErrorMsg("");
    try {
      const payload = {
        term: term.trim(),
        phonetic: phonetic.trim(),
        part_of_speech: partOfSpeech.trim(),
        definition_vi: definitionVi.trim(),
        definition_en: definitionEn.trim(),
        example_sentence: exampleSentence.trim(),
        set_id: selectedSetId === "__new__" ? undefined : selectedSetId,
        new_set_title: selectedSetId === "__new__" ? newSetTitle.trim() : undefined,
      };
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || "Lưu thất bại");
        return;
      }
      setSavedNotice(true);
      setTimeout(() => {
        setIsOpen(false);
        setSavedNotice(false);
      }, 900);
    } catch {
      setErrorMsg("Lỗi kết nối máy chủ.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {floatingBtn && !isOpen && (
        <button
          type="button"
          id="floating-save-flashcard-btn"
          data-no-flashcard-popup="true"
          style={{ top: `${floatingBtn.y}px`, left: `${floatingBtn.x}px` }}
          onMouseDown={(e) => {
            e.preventDefault();
            openModalWithTerm(floatingBtn.text);
          }}
          className="fixed z-50 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-emerald-700 cursor-pointer"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          {t("quickAdd")}
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flashcard-modal-title"
          data-no-flashcard-popup="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="flashcard-modal-title"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  {t("title")}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {t("subtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t("cancel")}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t("termLabel")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="e.g. mitigate"
                    required
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isAutofilling || !term.trim()}
                    onClick={() => runAutofill(term)}
                    className="h-auto px-3"
                  >
                    {isAutofilling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {isAutofilling ? t("aiFilling") : t("aiFill")}
                    </span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t("phoneticLabel")}
                  </label>
                  <input
                    type="text"
                    value={phonetic}
                    onChange={(e) => setPhonetic(e.target.value)}
                    placeholder="/ˈmɪtɪɡeɪt/"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t("posLabel")}
                  </label>
                  <input
                    type="text"
                    value={partOfSpeech}
                    onChange={(e) => setPartOfSpeech(e.target.value)}
                    placeholder="verb / noun"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t("defViLabel")}
                </label>
                <input
                  type="text"
                  value={definitionVi}
                  onChange={(e) => setDefinitionVi(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t("exampleLabel")}
                </label>
                <textarea
                  rows={2}
                  value={exampleSentence}
                  onChange={(e) => setExampleSentence(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t("setLabel")}
                </label>
                <select
                  value={selectedSetId}
                  onChange={(e) => setSelectedSetId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                  <option value="__new__">{t("newSetOption")}</option>
                </select>
                {selectedSetId === "__new__" && (
                  <input
                    type="text"
                    value={newSetTitle}
                    onChange={(e) => setNewSetTitle(e.target.value)}
                    placeholder={t("newSetPlaceholder")}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                )}
              </div>

              {errorMsg && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {errorMsg}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={isSaving || savedNotice}>
                  {savedNotice ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t("saved")}
                    </>
                  ) : isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("saving")}
                    </>
                  ) : (
                    t("save")
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
