import { z } from "zod";
import { seoMetaSchema, slugifyVi } from "./seo";
import type { BlogPost } from "./types";

export const BLOG_CATEGORIES = [
  "Listening",
  "Reading",
  "Writing",
  "Speaking",
  "Từ vựng",
  "Ngữ pháp",
  "Tips",
  "Chiến thuật IELTS",
] as const;

export const blogPostFormSchema = z.object({
  title_vi: z
    .string()
    .trim()
    .min(5, "Tiêu đề cần ít nhất 5 ký tự.")
    .max(200, "Tiêu đề tối đa 200 ký tự."),
  title_en: z.string().trim().max(200).optional().default(""),
  slug: z
    .string()
    .trim()
    .min(3, "Slug cần ít nhất 3 ký tự.")
    .max(120, "Slug tối đa 120 ký tự.")
    .transform((v) => slugifyVi(v))
    .refine((v) => v.length >= 3, "Slug chỉ gồm chữ thường, số và dấu gạch ngang."),
  excerpt_vi: z
    .string()
    .trim()
    .min(10, "Tóm tắt cần ít nhất 10 ký tự.")
    .max(500, "Tóm tắt tối đa 500 ký tự."),
  excerpt_en: z.string().trim().max(500).optional().default(""),
  content_vi: z
    .string()
    .trim()
    .min(20, "Nội dung bài viết cần ít nhất 20 ký tự.")
    .max(200_000, "Nội dung quá dài (tối đa 200.000 ký tự)."),
  content_en: z.string().trim().max(200_000).optional().default(""),
  category: z.string().trim().min(2, "Vui lòng chọn danh mục.").max(60),
  author_name: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .default("Đội ngũ học thuật Ôn IELTS"),
  read_minutes: z.coerce.number().int().min(1).max(120).optional(),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  scheduled_at: z.string().nullable().optional(),
  is_featured: z.boolean().optional().default(false),
  is_premium: z.boolean().optional().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  cover_image_url: z.string().trim().max(1000).nullable().optional(),
  title_size: z.enum(["", "lg", "xl"]).nullable().optional().default(""),
  seo_meta: seoMetaSchema,
});

export type BlogPostFormInput = z.infer<typeof blogPostFormSchema>;

export function resolveBlogStatus(post: Pick<BlogPost, "status" | "is_published">): "draft" | "published" | "scheduled" {
  if (post.status === "draft" || post.status === "published" || post.status === "scheduled") {
    return post.status;
  }
  return post.is_published ? "published" : "draft";
}

export function isBlogPostPubliclyVisible(
  post: Pick<BlogPost, "status" | "is_published" | "scheduled_at">,
  nowMs = Date.now()
): boolean {
  const status = resolveBlogStatus(post);
  if (status === "published") return true;
  if (status === "scheduled") {
    if (!post.scheduled_at) return false;
    const schedMs = new Date(post.scheduled_at).getTime();
    return Number.isFinite(schedMs) && schedMs <= nowMs;
  }
  return false;
}
