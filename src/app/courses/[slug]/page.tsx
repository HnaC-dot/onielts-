/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin-auth";
import { getCourseBySlug, getUserCourseProgress } from "@/lib/db";
import {
  buildBreadcrumbJsonLd,
  buildCourseJsonLd,
  buildNextMetadata,
} from "@/lib/seo";
import { CoursePlayerClient } from "@/components/course-player-client";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug, false);
  if (!course) return {};
  return buildNextMetadata({
    title: course.title_vi,
    description: course.description_vi,
    pathname: `/courses/${course.slug}`,
    imageUrl: course.cover_image_url,
    imageAlt: course.seo_meta?.coverImageAlt || course.title_vi,
    seoMeta: course.seo_meta,
    type: "website",
  });
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ slug }, query, locale, user] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getCurrentUser(),
  ]);
  const isStaff = Boolean(user && isStaffRole(user.role));
  const isPreview = query.preview === "1" && isStaff;

  const course = await getCourseBySlug(slug, isPreview);
  const isEn = locale === "en";
  if (!course) notFound();

  const progressList = await getUserCourseProgress(user?.id ?? null);
  const prog = progressList.find((p) => p.course_id === course.id);

  const courseJsonLd = buildCourseJsonLd(course);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", pathname: "/" },
    { name: "Khóa học IELTS", pathname: "/courses" },
    { name: course.title_vi, pathname: `/courses/${course.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {!course.is_published && isPreview && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          Chế độ xem trước bản nháp (chỉ Admin / Editor nhìn thấy).
        </div>
      )}

      <Link
        href="/courses"
        className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
      >
        ← {isEn ? "All Courses" : "Tất cả Khóa học"}
      </Link>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
        <div className={course.cover_image_url ? "lg:col-span-8" : "lg:col-span-12"}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Target {course.target_band}</Badge>
            <Badge variant="secondary">{course.level}</Badge>
            {course.is_premium && <Badge variant="amber">Premium</Badge>}
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {isEn ? course.title_en : course.title_vi}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {isEn ? course.description_en : course.description_vi}
          </p>
        </div>
        {course.cover_image_url && (
          <div className="lg:col-span-4">
            <img
              src={course.cover_image_url}
              alt={course.seo_meta?.coverImageAlt || course.title_vi}
              className="h-44 w-full rounded-2xl border border-slate-200 object-cover shadow-xs dark:border-slate-800"
            />
          </div>
        )}
      </div>

      <CoursePlayerClient
        course={course}
        initialCompletedIds={prog?.completed_lesson_ids ?? []}
      />
    </div>
  );
}
