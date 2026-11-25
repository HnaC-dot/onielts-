"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import {
  Loader2,
  MessageSquare,
  Mic,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { ConversationTopic } from "@/lib/types";
import { speakEnglish } from "@/lib/audio-recorder";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { PaywallModal } from "./paywall-modal";

interface ChatTurn {
  role: "ai" | "user";
  text: string;
  tipVi?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

export function ConversationsClient({
  topics,
  initialTopicSlug,
}: {
  topics: ConversationTopic[];
  initialTopicSlug?: string;
}) {
  const locale = useLocale();
  const isEn = locale === "en";

  const initialTopic =
    topics.find((t) => t.slug === initialTopicSlug) ?? topics[0];

  const [selectedSlug, setSelectedSlug] = useState(initialTopic.slug);
  const [messages, setMessages] = useState<ChatTurn[]>([
    { role: "ai", text: initialTopic.opener },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([
    `Sure! I'd be happy to talk about ${initialTopic.title_en.toLowerCase()}.`,
    "Actually, that's one of my favorite topics to discuss because it plays a big role in my daily life.",
    "Let me share a quick story from my own experience in Vietnam.",
  ]);
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const activeTopic = topics.find((t) => t.slug === selectedSlug) ?? topics[0];

  const selectTopic = (topic: ConversationTopic) => {
    setSelectedSlug(topic.slug);
    setMessages([{ role: "ai", text: topic.opener }]);
    setSuggestions([
      `Sure! I'd love to share a bit about ${topic.title_en.toLowerCase()}.`,
      "To be honest, it has changed quite a lot for me over the last couple of years.",
      "One thing that stands out immediately is how much it helps me unwind.",
    ]);
    if (autoSpeak) speakEnglish(topic.opener);
  };

  const sendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || loading) return;

    const nextHistory: ChatTurn[] = [...messages, { role: "user", text: content }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/conversations/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicTitle: activeTopic.title_en,
          history: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          userMessage: content,
        }),
      });
      const data = await res.json();
      if (res.status === 402 || data.limitReached) {
        setPaywallOpen(true);
        return;
      }
      if (res.ok && data.reply) {
        const aiTurn: ChatTurn = {
          role: "ai",
          text: data.reply.aiReply,
          tipVi: data.reply.quickTipVi,
        };
        setMessages((prev) => [...prev, aiTurn]);
        setSuggestions(data.reply.suggestedReplies ?? []);
        if (autoSpeak) speakEnglish(data.reply.aiReply);
      }
    } finally {
      setLoading(false);
    }
  };

  const startVoiceInput = () => {
    if (typeof window === "undefined") return;
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setInput("I'd love to practice speaking about this topic in detail.");
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    setListening(true);
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) setInput(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Topic Picker Sidebar */}
      <Card className="p-4 lg:col-span-4 space-y-2">
        <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          {isEn ? "Role-play Topics" : "Chủ đề hội thoại đóng vai"}
        </p>
        <div className="space-y-1.5">
          {topics.map((topic) => (
            <button
              key={topic.slug}
              type="button"
              onClick={() => selectTopic(topic)}
              className={`w-full rounded-xl p-3 text-left transition cursor-pointer ${
                topic.slug === activeTopic.slug
                  ? "bg-emerald-600 text-white"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/70"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  {isEn ? topic.title_en : topic.title_vi}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    topic.slug === activeTopic.slug
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {topic.part}
                </span>
              </div>
              <p
                className={`mt-1 text-xs ${
                  topic.slug === activeTopic.slug
                    ? "text-emerald-100"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {isEn ? topic.description_en : topic.description_vi}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* Live Chat Arena */}
      <Card className="flex flex-col lg:col-span-8 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? activeTopic.title_en : activeTopic.title_vi}
              </h2>
              <Badge>{activeTopic.level}</Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {activeTopic.suggestedVocab.map((v) => (
                <span
                  key={v}
                  className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAutoSpeak((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {autoSpeak ? (
              <>
                <Volume2 className="h-4 w-4 text-emerald-600" />
                {isEn ? "Voice On" : "Tự đọc giọng AI"}
              </>
            ) : (
              <>
                <VolumeX className="h-4 w-4 text-slate-400" />
                {isEn ? "Voice Off" : "Tắt giọng đọc"}
              </>
            )}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6 max-h-[440px]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                }`}
              >
                <p>{m.text}</p>
                {m.role === "ai" && (
                  <button
                    type="button"
                    onClick={() => speakEnglish(m.text)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    {isEn ? "Replay voice" : "Nghe lại"}
                  </button>
                )}
              </div>

              {m.tipVi && (
                <p className="mt-1.5 max-w-[85%] rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <Sparkles className="mr-1 inline h-3.5 w-3.5 text-amber-600" />
                  {m.tipVi}
                </p>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              {isEn ? "AI partner is thinking..." : "Bạn luyện nói AI đang phản hồi..."}
            </div>
          )}
        </div>

        {/* Smart Reply Suggestions */}
        {suggestions.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="mb-2 text-[11px] font-bold uppercase text-slate-500">
              {isEn ? "Suggested Band 8 Replies (click to use)" : "Gợi ý câu trả lời Band 8 (nhấn để chọn)"}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInput(sug)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          className="flex items-center gap-2 border-t border-slate-200 p-4 dark:border-slate-800"
        >
          <Button
            type="button"
            variant={listening ? "destructive" : "outline"}
            size="icon"
            onClick={startVoiceInput}
            title={isEn ? "Speak reply" : "Nhập bằng giọng nói"}
          >
            <Mic className={`h-4 w-4 ${listening ? "animate-pulse" : ""}`} />
          </Button>
          <input
            id="conversation-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isEn
                ? "Speak or type your English reply..."
                : "Nói hoặc gõ câu trả lời tiếng Anh của bạn..."
            }
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950"
          />
          <Button type="submit" id="conversation-send-btn" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{isEn ? "Send" : "Gửi"}</span>
          </Button>
        </form>
      </Card>

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} limit={5} used={5} period="daily" />
    </div>
  );
}
