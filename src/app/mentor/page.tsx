"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, GraduationCap, Loader2, Send, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MentorPlanStep {
  phase: string;
  focus: string;
  dailyRoutine: string;
  recommendedLink: string;
}

interface MentorTurn {
  role: "mentor" | "user";
  text: string;
  steps?: MentorPlanStep[];
  followUps?: string[];
}

const STARTER_PROMPTS = [
  "Mình đang ở Band 5.5 và muốn lên 7.0 trong 3 tháng, học mỗi ngày 1.5 tiếng.",
  "Mình hay bị kẹt ở Writing 6.0, làm sao tăng lên 7.0 trong 6 tuần?",
  "Gợi ý lịch học 45 phút mỗi ngày cho người đi làm bận rộn thi General Training.",
];

export default function MentorPage() {
  const [messages, setMessages] = useState<MentorTurn[]>([
    {
      role: "mentor",
      text: "Xin chào! Mình là Mentor Ôn IELTS. Hãy cho mình biết trình độ hiện tại, mục tiêu Band và thời gian bạn có thể học mỗi ngày — mình sẽ lập lộ trình tự học chi tiết từng tuần cho bạn nhé!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (textOverride?: string) => {
    const content = (textOverride ?? input).trim();
    if (!content || loading) return;

    const next = [...messages, { role: "user" as const, text: content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/mentor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: next.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "mentor",
            text: data.mentor.replyVi,
            steps: data.mentor.actionPlanSteps,
            followUps: data.mentor.followUpQuestions,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Mentor Ôn IELTS — Trợ lý lập lộ trình AI
          </h1>
          <p className="text-xs text-slate-500">
            Tư vấn hoàn toàn bằng tiếng Việt, thiết kế thời khóa biểu ôn tập cá nhân hóa theo ngày thi
          </p>
        </div>
      </div>

      {/* Quick Starter Chips */}
      <div className="flex flex-wrap gap-2">
        {STARTER_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void sendMessage(q)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
          >
            <Sparkles className="mr-1 inline h-3 w-3 text-emerald-600" />
            {q}
          </button>
        ))}
      </div>

      {/* Chat Container */}
      <Card className="overflow-hidden">
        <div className="space-y-4 p-6 max-h-[540px] overflow-y-auto">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                }`}
              >
                <p>{m.text}</p>

                {m.steps && m.steps.length > 0 && (
                  <div className="mt-4 space-y-2.5">
                    {m.steps.map((st, sIdx) => (
                      <div
                        key={sIdx}
                        className="rounded-xl border border-emerald-200 bg-white p-3.5 text-xs dark:border-emerald-900 dark:bg-slate-950"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge>{st.phase}</Badge>
                          <Link
                            href={st.recommendedLink}
                            className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            Mở công cụ <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                        <p className="mt-1.5 font-bold text-slate-900 dark:text-white">
                          {st.focus}
                        </p>
                        <p className="mt-1 text-slate-600 dark:text-slate-400">
                          {st.dailyRoutine}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {m.followUps && m.followUps.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.followUps.map((f, fIdx) => (
                      <button
                        key={fIdx}
                        type="button"
                        onClick={() => setInput(f)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 cursor-pointer"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Mentor Ôn IELTS đang thiết kế lộ trình...
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          className="flex items-center gap-2 border-t border-slate-200 p-4 dark:border-slate-800"
        >
          <input
            id="mentor-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nhập mục tiêu Band, điểm hiện tại và thời gian học mỗi ngày..."
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950"
          />
          <Button type="submit" id="mentor-send-btn" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
            Gửi
          </Button>
        </form>
      </Card>
    </div>
  );
}
