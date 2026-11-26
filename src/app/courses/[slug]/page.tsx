import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { getCourseBySlug, getUserCourseProgress } from "@/lib/db";
import { CoursePlayerClient } from "@/components/course-player-client";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return {};
  return { title: course.title_vi, description: course.description_vi };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, user, course] = await Promise.all([
    getLocale(),
    getCurrentUser(),
    getCourseBySlug(slug),
  ]);
  const isEn = locale === "en";
  if (!course) notFound();

  const progressList = await getUserCourseProgress(user?.id ?? null);
  const prog = progressList.find((p) => p.course_id === course.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6">
      <Link
        href="/courses"
        className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← {isEn ? "All Courses" : "Tất cả Khóa học"}
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <Badge>Target {course.target_band}</Badge>
          <Badge variant="secondary">{course.level}</Badge>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
          {isEn ? course.title_en : course.title_vi}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {isEn ? course.description_en : course.description_vi}
        </p>
      </div>

      <CoursePlayerClient
        course={course}
        initialCompletedIds={prog?.completed_lesson_ids ?? []}
      />
    </div>
  );
}
