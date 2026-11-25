import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { CoursePlayerClient } from "@/components/course-player-client";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = readStore().courses.find((c) => c.slug === slug);
  if (!course) return {};
  return { title: course.title_vi, description: course.description_vi };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const isEn = locale === "en";
  const store = readStore();
  const course = store.courses.find((c) => c.slug === slug);
  if (!course) notFound();

  const userId = user?.id ?? "demo-free-001";
  const prog = store.course_progress.find(
    (p) => p.user_id === userId && p.course_id === course.id
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6">
      <Link href="/courses" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
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
