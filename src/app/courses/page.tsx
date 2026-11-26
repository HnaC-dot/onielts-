/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getCourses, getUserCourseProgress } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Khóa học tự học IELTS theo lộ trình (5.0 → 7.5+)",
  description:
    "Các khóa học IELTS nguyên bản có lưu tiến độ từng bài học, tóm tắt cốt lõi và bài kiểm tra nhanh sau mỗi bài.",
};

export default async function CoursesIndexPage() {
  const [locale, user, courses] = await Promise.all([
    getLocale(),
    getCurrentUser(),
    getCourses(),
  ]);
  const isEn = locale === "en";
  const courseProgress = await getUserCourseProgress(user?.id ?? null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? "Structured IELTS Courses" : "Khóa học IELTS theo lộ trình"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn
            ? "Follow step-by-step original IELTS courses with tracked lesson completion and quick quizzes."
            : "Học bài bản từng kỹ năng kèm thanh theo dõi tiến độ hoàn thành và câu hỏi ôn tập ngay sau bài học."}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {courses.map((course) => {
            const prog = courseProgress.find((p) => p.course_id === course.id);
            const pct = prog?.progress_percent ?? 0;

            return (
              <Link key={course.id} href={`/courses/${course.slug}`}>
                <Card className="flex h-full flex-col justify-between overflow-hidden transition hover:border-emerald-400 hover:shadow-md">
                  <div>
                    {course.cover_image_url && (
                      <img
                        src={course.cover_image_url}
                        alt={course.seo_meta?.coverImageAlt || (isEn ? course.title_en : course.title_vi)}
                        className="h-40 w-full object-cover border-b border-slate-100 dark:border-slate-800"
                      />
                    )}
                    <div className="p-6 pb-0">
                      <div className="flex items-center justify-between">
                        <Badge>Target {course.target_band}</Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          {course.duration_hours}h
                        </span>
                      </div>
                      <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                        {isEn ? course.title_en : course.title_vi}
                      </h2>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {isEn ? course.description_en : course.description_vi}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3 border-t border-slate-100 px-6 pb-6 pt-4 dark:border-slate-800">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                        <span>{isEn ? "Progress" : "Tiến độ"}</span>
                        <span className="text-emerald-700 dark:text-emerald-400">{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                        <BookOpen className="h-3.5 w-3.5" />
                        {course.lessons.length} {isEn ? "lessons" : "bài học"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        {pct > 0 ? (isEn ? "Continue" : "Học tiếp") : isEn ? "Start" : "Vào học"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
