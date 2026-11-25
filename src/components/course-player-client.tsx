"use client";

import React, { useState } from "react";
import { useLocale } from "next-intl";
import { BookOpen, CheckCircle2, Circle, Clock } from "lucide-react";
import type { CourseItem } from "@/lib/types";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function CoursePlayerClient({
  course,
  initialCompletedIds,
}: {
  course: CourseItem;
  initialCompletedIds: string[];
}) {
  const locale = useLocale();
  const isEn = locale === "en";

  const [activeLessonId, setActiveLessonId] = useState(course.lessons[0]?.id ?? "");
  const [completedIds, setCompletedIds] = useState<string[]>(initialCompletedIds);
  const [quizChoice, setQuizChoice] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const activeLesson =
    course.lessons.find((l) => l.id === activeLessonId) ?? course.lessons[0];
  if (!activeLesson) return null;

  const progressPct = Math.round(
    (completedIds.length / Math.max(1, course.lessons.length)) * 100
  );
  const isCompleted = completedIds.includes(activeLesson.id);

  const toggleComplete = async () => {
    setSaving(true);
    const nextCompleted = !isCompleted;
    try {
      const res = await fetch("/api/courses/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          lessonId: activeLesson.id,
          completed: nextCompleted,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompletedIds(data.progress.completed_lesson_ids ?? []);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Card */}
      <Card className="p-5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-700 dark:text-slate-300">
            {isEn ? "Course Progress" : "Tiến độ hoàn thành khóa học"}
          </span>
          <span className="text-emerald-700 dark:text-emerald-400">
            {completedIds.length} / {course.lessons.length} ({progressPct}%)
          </span>
        </div>
        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Curriculum Sidebar */}
        <Card className="p-4 lg:col-span-4 space-y-2 h-fit">
          <p className="px-2 text-xs font-bold uppercase text-slate-500">
            {isEn ? "Lessons" : "Nội dung bài học"}
          </p>
          {course.lessons.map((l) => {
            const done = completedIds.includes(l.id);
            const selected = l.id === activeLesson.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setActiveLessonId(l.id)}
                className={`flex w-full items-start gap-2.5 rounded-xl p-3 text-left text-xs transition cursor-pointer ${
                  selected
                    ? "bg-emerald-600 text-white"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {done ? (
                  <CheckCircle2
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      selected ? "text-emerald-200" : "text-emerald-600"
                    }`}
                  />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
                )}
                <div>
                  <p className="font-bold">{isEn ? l.title_en : l.title_vi}</p>
                  <p className={`mt-0.5 text-[11px] ${selected ? "text-emerald-100" : "text-slate-500"}`}>
                    <Clock className="mr-1 inline h-3 w-3" />
                    {l.duration_min} {isEn ? "min" : "phút"}
                  </p>
                </div>
              </button>
            );
          })}
        </Card>

        {/* Active Lesson Content */}
        <Card className="p-6 lg:col-span-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <Badge>
                <BookOpen className="mr-1 h-3 w-3" />
                {activeLesson.duration_min} {isEn ? "min" : "phút"}
              </Badge>
              <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {isEn ? activeLesson.title_en : activeLesson.title_vi}
              </h2>
            </div>

            <Button
              type="button"
              variant={isCompleted ? "secondary" : "default"}
              disabled={saving}
              onClick={toggleComplete}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isCompleted
                ? isEn
                  ? "Completed"
                  : "Đã hoàn thành"
                : isEn
                ? "Mark Lesson Complete"
                : "Đánh dấu hoàn thành"}
            </Button>
          </div>

          <div className="whitespace-pre-line text-sm leading-7 text-slate-800 dark:text-slate-200">
            {isEn ? activeLesson.content_en : activeLesson.content_vi}
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
            <h3 className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">
              {isEn ? "Key Takeaways" : "Điểm ghi nhớ cốt lõi"}
            </h3>
            <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-sm text-slate-800 dark:text-slate-200">
              {activeLesson.keyTakeaways.map((k, i) => (
                <li key={i}>{k}</li>
              ))}
            </ul>
          </div>

          {/* Interactive Lesson Checkpoint Quiz */}
          {activeLesson.quiz && (
            <div className="rounded-2xl border border-slate-200 p-5 space-y-3 dark:border-slate-800">
              <p className="text-xs font-bold uppercase text-slate-500">
                {isEn ? "Quick Checkpoint Quiz" : "Câu hỏi kiểm tra nhanh"}
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {activeLesson.quiz.question}
              </p>
              <div className="grid gap-2">
                {activeLesson.quiz.options.map((opt, idx) => {
                  const chosen = quizChoice[activeLesson.id];
                  const isPicked = chosen === idx;
                  const isCorrectOpt = idx === activeLesson.quiz!.correctIndex;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setQuizChoice((prev) => ({ ...prev, [activeLesson.id]: idx }))
                      }
                      className={`rounded-xl border px-4 py-2.5 text-left text-xs font-semibold transition cursor-pointer ${
                        chosen === undefined
                          ? "border-slate-200 hover:border-emerald-400 dark:border-slate-700"
                          : isCorrectOpt
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                          : isPicked
                          ? "border-red-500 bg-red-50 text-red-800"
                          : "border-slate-200 opacity-60 dark:border-slate-800"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {quizChoice[activeLesson.id] !== undefined && (
                <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {activeLesson.quiz.explanation_vi}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
