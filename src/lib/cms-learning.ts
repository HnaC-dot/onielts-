import "server-only";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { recordAuditLog } from "./admin-auth";
import { ensureSupabaseCatalogSeeded } from "./db";
import { readStore, updateStore } from "./store";
import { slugifyVi } from "./seo";
import { extractYoutubeVideoId, sanitizeRichHtml } from "./sanitize";
import {
  conversationCmsSchema,
  courseCmsSchema,
  dictationCmsSchema,
  pronunciationCmsSchema,
  videoCmsSchema,
  writingExerciseCmsSchema,
  type LearningModuleKey,
} from "./learning-cms-shared";
import {
  conversationTopicToDbRow,
  mapConversationRow,
  mapCourseRow,
  mapDictationRow,
  mapPronunciationRow,
  mapVideoRow,
  mapWritingExerciseRow,
  writingExerciseToDbRow,
} from "./learning-mappers";
import type {
  ConversationTopic,
  CourseItem,
  DictationLesson,
  LearnVideo,
  PronunciationSound,
  SessionUser,
  WritingExercise,
} from "./types";

export type LearningRecordMap = {
  courses: CourseItem;
  conversations: ConversationTopic;
  "writing-exercises": WritingExercise;
  pronunciation: PronunciationSound;
  dictation: DictationLesson;
  videos: LearnVideo;
};

type Actor = Pick<SessionUser, "id" | "email" | "role">;

interface ModuleConfig {
  table: string;
  auditEntity: string;
  labelVi: string;
  publicListPath: string;
  detailPathPrefix?: string; // if present, slug changes create 301 redirect
  orderBy: string;
  ascending: boolean;
}

const MODULE_CONFIGS: Record<LearningModuleKey, ModuleConfig> = {
  courses: {
    table: "courses",
    auditEntity: "course",
    labelVi: "Khóa học",
    publicListPath: "/courses",
    detailPathPrefix: "/courses",
    orderBy: "sort_order",
    ascending: true,
  },
  conversations: {
    table: "conversation_topics",
    auditEntity: "conversation_topic",
    labelVi: "Chủ đề Hội thoại AI",
    publicListPath: "/conversations",
    orderBy: "sort_order",
    ascending: true,
  },
  "writing-exercises": {
    table: "writing_exercises",
    auditEntity: "writing_exercise",
    labelVi: "Bài nâng cấp câu viết",
    publicListPath: "/writing/exercises",
    orderBy: "sort_order",
    ascending: true,
  },
  pronunciation: {
    table: "pronunciation_sounds",
    auditEntity: "pronunciation_sound",
    labelVi: "Âm phát âm IPA",
    publicListPath: "/pronunciation",
    detailPathPrefix: "/pronunciation",
    orderBy: "sort_order",
    ascending: true,
  },
  dictation: {
    table: "dictation_lessons",
    auditEntity: "dictation_lesson",
    labelVi: "Bài Chép chính tả",
    publicListPath: "/dictation",
    orderBy: "created_at",
    ascending: false,
  },
  videos: {
    table: "learn_videos",
    auditEntity: "learn_video",
    labelVi: "Video tương tác",
    publicListPath: "/videos",
    detailPathPrefix: "/videos",
    orderBy: "created_at",
    ascending: false,
  },
};

function revalidateModulePaths(mod: LearningModuleKey, slugs: string[]) {
  const cfg = MODULE_CONFIGS[mod];
  try {
    revalidatePath("/");
    revalidatePath(cfg.publicListPath);
    revalidatePath("/sitemap.xml");
    if (cfg.detailPathPrefix) {
      for (const s of slugs) {
        if (s) revalidatePath(`${cfg.detailPathPrefix}/${s}`);
      }
    }
  } catch {
    // ignore outside Next request context
  }
}

async function createAuto301Redirect(
  sourcePath: string,
  destinationPath: string,
  actorId: string
): Promise<boolean> {
  if (!sourcePath || !destinationPath || sourcePath === destinationPath) {
    return false;
  }
  if (!isSupabaseConfigured()) return false;
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  try {
    const { error } = await admin.from("seo_redirects").upsert(
      {
        source_path: sourcePath,
        destination_path: destinationPath,
        status_code: 301,
        is_active: true,
        created_by: actorId,
      },
      { onConflict: "source_path" }
    );
    return !error;
  } catch {
    return false;
  }
}

function mapDbRowForModule<K extends LearningModuleKey>(
  mod: K,
  row: Record<string, unknown>
): LearningRecordMap[K] {
  switch (mod) {
    case "courses":
      return mapCourseRow(row) as LearningRecordMap[K];
    case "conversations":
      return mapConversationRow(row) as LearningRecordMap[K];
    case "writing-exercises":
      return mapWritingExerciseRow(row) as LearningRecordMap[K];
    case "pronunciation":
      return mapPronunciationRow(row) as LearningRecordMap[K];
    case "dictation":
      return mapDictationRow(row) as LearningRecordMap[K];
    case "videos":
      return mapVideoRow(row) as LearningRecordMap[K];
  }
}

function getLocalCollection<K extends LearningModuleKey>(
  mod: K
): LearningRecordMap[K][] {
  const store = readStore();
  switch (mod) {
    case "courses":
      return store.courses as LearningRecordMap[K][];
    case "conversations":
      return store.conversation_topics as LearningRecordMap[K][];
    case "writing-exercises":
      return store.writing_exercises as LearningRecordMap[K][];
    case "pronunciation":
      return store.pronunciation_sounds as LearningRecordMap[K][];
    case "dictation":
      return store.dictation_lessons as LearningRecordMap[K][];
    case "videos":
      return store.learn_videos as LearningRecordMap[K][];
  }
}

function getItemLabel(mod: LearningModuleKey, item: Record<string, unknown>): string {
  if (mod === "pronunciation") {
    return `${String(item.symbol ?? "")} — ${String(item.title_vi ?? item.slug ?? "")}`;
  }
  return String(item.title_vi ?? item.slug ?? "");
}

function getItemPublished(mod: LearningModuleKey, item: Record<string, unknown>): boolean {
  if (mod === "conversations" || mod === "writing-exercises") {
    return item.status !== "draft";
  }
  return item.is_published !== false;
}

function getItemSearchHaystack(mod: LearningModuleKey, item: Record<string, unknown>): string {
  const base = `${String(item.title_vi ?? "")} ${String(item.title_en ?? "")} ${String(item.slug ?? "")}`;
  if (mod === "pronunciation") {
    return `${base} ${String(item.symbol ?? "")} ${String(item.category ?? "")}`.toLowerCase();
  }
  if (mod === "conversations") {
    return `${base} ${String(item.part ?? "")} ${String(item.description_vi ?? "")}`.toLowerCase();
  }
  if (mod === "writing-exercises") {
    return `${base} ${String(item.topic ?? "")} ${String(item.targetSkill ?? "")}`.toLowerCase();
  }
  if (mod === "dictation") {
    return `${base} ${String(item.category ?? "")} ${String(item.accent ?? "")}`.toLowerCase();
  }
  if (mod === "videos") {
    return `${base} ${String(item.youtube_id ?? "")} ${String(item.level ?? "")}`.toLowerCase();
  }
  return `${base} ${String(item.level ?? "")} ${String(item.target_band ?? "")}`.toLowerCase();
}

function getItemFilterField(mod: LearningModuleKey, item: Record<string, unknown>): string {
  if (mod === "conversations") return String(item.part ?? "");
  if (mod === "pronunciation") return String(item.category ?? "");
  if (mod === "dictation") return String(item.accent ?? "");
  if (mod === "writing-exercises") return String(item.topic ?? "");
  if (mod === "courses" || mod === "videos") return String(item.level ?? "");
  return "";
}

// =============================================================================
// VALIDATION + NORMALIZATION PER MODULE
// =============================================================================
type NormalizedResult<K extends LearningModuleKey> =
  | {
      ok: true;
      slug: string;
      dbRow: Record<string, unknown>;
      localRecord: (id: string) => LearningRecordMap[K];
    }
  | { ok: false; status: number; error: string };

function validateAndNormalize<K extends LearningModuleKey>(
  mod: K,
  rawInput: unknown
): NormalizedResult<K> {
  if (mod === "courses") {
    const parsed = courseCmsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: parsed.error.issues[0]?.message || "Dữ liệu khóa học không hợp lệ.",
      };
    }
    const d = parsed.data;
    const slug = slugifyVi(d.slug);
    if (!slug) return { ok: false, status: 400, error: "Slug khóa học không hợp lệ." };

    const lessons = d.lessons.map((l) => {
      const safeContentVi = /<[a-z][\s\S]*>/i.test(l.content_vi)
        ? sanitizeRichHtml(l.content_vi)
        : l.content_vi.trim();
      const rawEn = l.content_en?.trim() || l.content_vi;
      const safeContentEn = /<[a-z][\s\S]*>/i.test(rawEn)
        ? sanitizeRichHtml(rawEn)
        : rawEn.trim();
      return {
        id: l.id,
        title_vi: l.title_vi,
        title_en: l.title_en || l.title_vi,
        duration_min: l.duration_min,
        content_vi: safeContentVi,
        content_en: safeContentEn,
        videoUrl: l.videoUrl || undefined,
        audioUrl: l.audioUrl || undefined,
        keyTakeaways: l.keyTakeaways.filter(Boolean),
        quiz:
          l.quiz && l.quiz.question.trim()
            ? {
                question: l.quiz.question.trim(),
                options: l.quiz.options.map((o) => o.trim()).filter(Boolean),
                correctIndex: Math.min(
                  Math.max(0, l.quiz.correctIndex),
                  Math.max(0, l.quiz.options.length - 1)
                ),
                explanation_vi: l.quiz.explanation_vi.trim(),
              }
            : undefined,
      };
    });

    const totalMins = lessons.reduce((acc, l) => acc + l.duration_min, 0);
    const dbRow = {
      slug,
      title_vi: d.title_vi,
      title_en: d.title_en || d.title_vi,
      description_vi: d.description_vi,
      description_en: d.description_en || d.description_vi,
      level: d.level,
      target_band: d.target_band,
      lessons,
      cover_image_url: d.cover_image_url ?? null,
      is_published: d.is_published,
      is_premium: d.is_premium,
      sort_order: d.sort_order,
      seo_meta: d.seo_meta ?? {},
    };
    return {
      ok: true,
      slug,
      dbRow,
      localRecord: (id) =>
        ({
          id,
          ...dbRow,
          duration_hours: Math.max(1, Math.round(totalMins / 60)),
        }) as LearningRecordMap[K],
    };
  }

  if (mod === "conversations") {
    const parsed = conversationCmsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: parsed.error.issues[0]?.message || "Dữ liệu chủ đề hội thoại không hợp lệ.",
      };
    }
    const d = parsed.data;
    const slug = slugifyVi(d.slug);
    if (!slug) return { ok: false, status: 400, error: "Slug hội thoại không hợp lệ." };
    const topic: Omit<ConversationTopic, "id"> = {
      slug,
      title_vi: d.title_vi,
      title_en: d.title_en,
      part: d.part,
      level: d.level,
      opener: d.opener,
      description_vi: d.description_vi,
      description_en: d.description_en || d.description_vi,
      suggestedVocab: d.suggestedVocab,
      sampleQuestions: d.sampleQuestions,
      systemPrompt: d.systemPrompt,
      status: d.status,
      is_premium: d.is_premium,
      seo_meta: d.seo_meta ?? {},
      sort_order: d.sort_order,
    };
    return {
      ok: true,
      slug,
      dbRow: conversationTopicToDbRow(topic, d.sort_order),
      localRecord: (id) => ({ id, ...topic }) as LearningRecordMap[K],
    };
  }

  if (mod === "writing-exercises") {
    const parsed = writingExerciseCmsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: parsed.error.issues[0]?.message || "Dữ liệu bài tập nâng cấp câu không hợp lệ.",
      };
    }
    const d = parsed.data;
    const slug = slugifyVi(d.slug);
    if (!slug) return { ok: false, status: 400, error: "Slug bài tập không hợp lệ." };
    const ex: Omit<WritingExercise, "id"> = {
      slug,
      title_vi: d.title_vi,
      title_en: d.title_en || d.title_vi,
      topic: d.topic,
      targetSkill: d.targetSkill || d.criteria.join(" & "),
      criteria: d.criteria,
      explanation_vi: d.explanation_vi || "",
      explanation_en: d.explanation_en || "",
      status: d.status,
      is_premium: d.is_premium,
      seo_meta: d.seo_meta ?? {},
      sort_order: d.sort_order,
      sentences: d.sentences,
    };
    return {
      ok: true,
      slug,
      dbRow: writingExerciseToDbRow(ex, d.sort_order),
      localRecord: (id) => ({ id, ...ex }) as LearningRecordMap[K],
    };
  }

  if (mod === "pronunciation") {
    const parsed = pronunciationCmsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: parsed.error.issues[0]?.message || "Dữ liệu âm IPA không hợp lệ.",
      };
    }
    const d = parsed.data;
    const slug = slugifyVi(d.slug);
    if (!slug) return { ok: false, status: 400, error: "Slug âm IPA không hợp lệ." };
    const dbRow = {
      slug,
      symbol: d.symbol,
      category: d.category,
      title_vi: d.title_vi,
      title_en: d.title_en || d.title_vi,
      tip_vi: d.vietnameseTip_vi,
      tip_en: d.tip_en || d.mouthPosition_vi,
      examples: {
        mouthPosition_vi: d.mouthPosition_vi,
        practiceSentence: d.practiceSentence,
        words: d.examples,
      },
      mouth_image_url: d.mouth_image_url ?? null,
      audio_url: d.audio_url ?? null,
      is_published: d.is_published,
      is_premium: d.is_premium,
      sort_order: d.sort_order,
      seo_meta: d.seo_meta ?? {},
    };
    return {
      ok: true,
      slug,
      dbRow,
      localRecord: (id) =>
        ({
          id,
          slug,
          symbol: d.symbol,
          category: d.category,
          title_vi: d.title_vi,
          title_en: d.title_en || d.title_vi,
          mouthPosition_vi: d.mouthPosition_vi,
          vietnameseTip_vi: d.vietnameseTip_vi,
          tip_en: d.tip_en || d.mouthPosition_vi,
          examples: d.examples,
          practiceSentence: d.practiceSentence,
          mouth_image_url: d.mouth_image_url ?? null,
          audio_url: d.audio_url ?? null,
          is_published: d.is_published,
          is_premium: d.is_premium,
          sort_order: d.sort_order,
          seo_meta: d.seo_meta ?? {},
        }) as LearningRecordMap[K],
    };
  }

  if (mod === "dictation") {
    const parsed = dictationCmsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: parsed.error.issues[0]?.message || "Dữ liệu bài chép chính tả không hợp lệ.",
      };
    }
    const d = parsed.data;
    const slug = slugifyVi(d.slug);
    if (!slug) return { ok: false, status: 400, error: "Slug bài chép chính tả không hợp lệ." };
    const sentences = d.sentences.map((s) => ({
      id: s.id,
      text: s.text,
      translation_vi: s.translation_vi,
      tip_vi: s.tip_vi || undefined,
      audioUrl: s.audioUrl || undefined,
    }));
    const dbRow = {
      slug,
      title_vi: d.title_vi,
      title_en: d.title_en || d.title_vi,
      category: d.category,
      difficulty: d.difficulty,
      accent: d.accent,
      sentences,
      is_published: d.is_published,
      is_premium: d.is_premium,
      seo_meta: d.seo_meta ?? {},
    };
    return {
      ok: true,
      slug,
      dbRow,
      localRecord: (id) => ({ id, ...dbRow }) as LearningRecordMap[K],
    };
  }

  // videos
  const parsed = videoCmsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message || "Dữ liệu video không hợp lệ.",
    };
  }
  const d = parsed.data;
  const slug = slugifyVi(d.slug);
  if (!slug) return { ok: false, status: 400, error: "Slug video không hợp lệ." };
  const youtubeId = extractYoutubeVideoId(d.youtube_input);
  if (!youtubeId) {
    return {
      ok: false,
      status: 400,
      error:
        "Link YouTube hoặc Video ID không hợp lệ. Vui lòng dán link YouTube chuẩn (vd: https://youtu.be/... hoặc 11 ký tự ID).",
    };
  }
  const transcript = d.transcript
    .map((line) => ({
      startSec: Math.max(0, Math.round(line.startSec)),
      endSec: Math.max(Math.round(line.startSec) + 1, Math.round(line.endSec)),
      en: line.en.trim(),
      vi: line.vi.trim(),
    }))
    .sort((a, b) => a.startSec - b.startSec);

  const dbRow = {
    slug,
    youtube_id: youtubeId,
    title_vi: d.title_vi,
    title_en: d.title_en || d.title_vi,
    description_vi: d.description_vi,
    description_en: d.description_en || d.description_vi,
    level: d.level,
    duration_label: d.duration_label,
    transcript,
    is_published: d.is_published,
    is_premium: d.is_premium,
    seo_meta: d.seo_meta ?? {},
  };
  return {
    ok: true,
    slug,
    dbRow,
    localRecord: (id) => ({ id, ...dbRow }) as LearningRecordMap[K],
  };
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================
export async function listLearningItems<K extends LearningModuleKey>(
  mod: K,
  options?: {
    q?: string;
    filter?: string;
    published?: "" | "true" | "false";
    premium?: "" | "true" | "false";
    page?: number;
    pageSize?: number;
  }
): Promise<{
  items: LearningRecordMap[K][];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, options?.pageSize ?? 25));
  const q = (options?.q ?? "").trim().toLowerCase();
  const filter = (options?.filter ?? "").trim();
  const published = options?.published ?? "";
  const premium = options?.premium ?? "";

  let all: LearningRecordMap[K][] = [];

  if (!isSupabaseConfigured()) {
    all = [...getLocalCollection(mod)];
  } else {
    await ensureSupabaseCatalogSeeded();
    const admin = createSupabaseAdminClient();
    const cfg = MODULE_CONFIGS[mod];
    if (admin) {
      const { data } = await admin
        .from(cfg.table)
        .select("*")
        .order(cfg.orderBy, { ascending: cfg.ascending })
        .limit(500);
      all = (data ?? []).map((r) =>
        mapDbRowForModule(mod, r as Record<string, unknown>)
      );
    }
  }

  const filtered = all.filter((item) => {
    const rec = item as unknown as Record<string, unknown>;
    if (published === "true" && !getItemPublished(mod, rec)) return false;
    if (published === "false" && getItemPublished(mod, rec)) return false;
    if (premium === "true" && !rec.is_premium) return false;
    if (premium === "false" && rec.is_premium) return false;
    if (filter && getItemFilterField(mod, rec) !== filter) return false;
    if (q && !getItemSearchHaystack(mod, rec).includes(q)) return false;
    return true;
  });

  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

export async function getLearningItemById<K extends LearningModuleKey>(
  mod: K,
  id: string
): Promise<LearningRecordMap[K] | null> {
  if (!isSupabaseConfigured()) {
    const list = getLocalCollection(mod) as unknown as Array<Record<string, unknown>>;
    const found = list.find((item) => String(item.id ?? item.slug) === id);
    return (found as unknown as LearningRecordMap[K]) ?? null;
  }
  await ensureSupabaseCatalogSeeded();
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const cfg = MODULE_CONFIGS[mod];
  const { data } = await admin
    .from(cfg.table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapDbRowForModule(mod, data as Record<string, unknown>) : null;
}

export async function createLearningItem<K extends LearningModuleKey>(
  mod: K,
  rawInput: unknown,
  actor: Actor
): Promise<
  | { ok: true; item: LearningRecordMap[K] }
  | { ok: false; status: number; error: string }
> {
  const norm = validateAndNormalize(mod, rawInput);
  if (!norm.ok) return norm;
  const cfg = MODULE_CONFIGS[mod];

  if (!isSupabaseConfigured()) {
    const list = getLocalCollection(mod) as unknown as Array<Record<string, unknown>>;
    if (list.some((item) => item.slug === norm.slug)) {
      return { ok: false, status: 409, error: `Slug "${norm.slug}" đã tồn tại.` };
    }
    const id = `${mod}-${Date.now()}`;
    const created = norm.localRecord(id);
    updateStore((store) => {
      switch (mod) {
        case "courses":
          store.courses.unshift(created as CourseItem);
          break;
        case "conversations":
          store.conversation_topics.unshift(created as ConversationTopic);
          break;
        case "writing-exercises":
          store.writing_exercises.unshift(created as WritingExercise);
          break;
        case "pronunciation":
          store.pronunciation_sounds.unshift(created as PronunciationSound);
          break;
        case "dictation":
          store.dictation_lessons.unshift(created as DictationLesson);
          break;
        case "videos":
          store.learn_videos.unshift(created as LearnVideo);
          break;
      }
    });
    await recordAuditLog({
      actor,
      action: `${cfg.auditEntity}.create`,
      entityType: cfg.auditEntity,
      entityId: id,
      entityLabel: getItemLabel(mod, created as unknown as Record<string, unknown>),
      summary: `Tạo mới ${cfg.labelVi}: ${getItemLabel(mod, created as unknown as Record<string, unknown>)}`,
    });
    revalidateModulePaths(mod, [norm.slug]);
    return { ok: true, item: created };
  }

  await ensureSupabaseCatalogSeeded();
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, status: 500, error: "Chưa kết nối được Supabase Admin." };

  const { data: dup } = await admin
    .from(cfg.table)
    .select("id")
    .eq("slug", norm.slug)
    .maybeSingle();
  if (dup) {
    return { ok: false, status: 409, error: `Slug "${norm.slug}" đã tồn tại.` };
  }

  const { data: inserted, error } = await admin
    .from(cfg.table)
    .insert(norm.dbRow)
    .select("*")
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      status: 500,
      error: error?.message || `Không thể tạo ${cfg.labelVi}.`,
    };
  }

  const mapped = mapDbRowForModule(mod, inserted as Record<string, unknown>);
  await recordAuditLog({
    actor,
    action: `${cfg.auditEntity}.create`,
    entityType: cfg.auditEntity,
    entityId: String(inserted.id),
    entityLabel: getItemLabel(mod, mapped as unknown as Record<string, unknown>),
    summary: `Tạo mới ${cfg.labelVi}: ${getItemLabel(mod, mapped as unknown as Record<string, unknown>)}`,
  });
  revalidateModulePaths(mod, [norm.slug]);
  return { ok: true, item: mapped };
}

export async function updateLearningItem<K extends LearningModuleKey>(
  mod: K,
  id: string,
  rawInput: unknown,
  actor: Actor
): Promise<
  | { ok: true; item: LearningRecordMap[K]; redirectCreated?: boolean }
  | { ok: false; status: number; error: string }
> {
  const norm = validateAndNormalize(mod, rawInput);
  if (!norm.ok) return norm;
  const cfg = MODULE_CONFIGS[mod];

  const existing = await getLearningItemById(mod, id);
  if (!existing) {
    return { ok: false, status: 404, error: `Không tìm thấy ${cfg.labelVi}.` };
  }
  const oldSlug = String((existing as unknown as Record<string, unknown>).slug ?? "");

  if (!isSupabaseConfigured()) {
    const list = getLocalCollection(mod) as unknown as Array<Record<string, unknown>>;
    if (
      list.some(
        (item) => item.slug === norm.slug && String(item.id ?? item.slug) !== id
      )
    ) {
      return { ok: false, status: 409, error: `Slug "${norm.slug}" đã được dùng bởi mục khác.` };
    }
    const updated = norm.localRecord(id);
    updateStore((store) => {
      const replaceIn = <T extends { id?: string; slug: string }>(arr: T[], next: T) => {
        const idx = arr.findIndex((i) => String(i.id ?? i.slug) === id);
        if (idx >= 0) arr[idx] = next;
      };
      switch (mod) {
        case "courses":
          replaceIn(store.courses, updated as CourseItem);
          break;
        case "conversations":
          replaceIn(store.conversation_topics, updated as ConversationTopic);
          break;
        case "writing-exercises":
          replaceIn(store.writing_exercises, updated as WritingExercise);
          break;
        case "pronunciation":
          replaceIn(store.pronunciation_sounds, updated as PronunciationSound);
          break;
        case "dictation":
          replaceIn(store.dictation_lessons, updated as DictationLesson);
          break;
        case "videos":
          replaceIn(store.learn_videos, updated as LearnVideo);
          break;
      }
    });
    await recordAuditLog({
      actor,
      action: `${cfg.auditEntity}.update`,
      entityType: cfg.auditEntity,
      entityId: id,
      entityLabel: getItemLabel(mod, updated as unknown as Record<string, unknown>),
      summary: `Cập nhật ${cfg.labelVi}: ${getItemLabel(mod, updated as unknown as Record<string, unknown>)}`,
    });
    revalidateModulePaths(mod, [oldSlug, norm.slug]);
    return { ok: true, item: updated };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, status: 500, error: "Chưa kết nối được Supabase Admin." };

  const { data: dup } = await admin
    .from(cfg.table)
    .select("id")
    .eq("slug", norm.slug)
    .neq("id", id)
    .maybeSingle();
  if (dup) {
    return { ok: false, status: 409, error: `Slug "${norm.slug}" đã được dùng bởi mục khác.` };
  }

  const { data: updatedRow, error } = await admin
    .from(cfg.table)
    .update(norm.dbRow)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !updatedRow) {
    return {
      ok: false,
      status: 500,
      error: error?.message || `Không thể cập nhật ${cfg.labelVi}.`,
    };
  }

  let redirectCreated = false;
  if (cfg.detailPathPrefix && oldSlug && oldSlug !== norm.slug) {
    redirectCreated = await createAuto301Redirect(
      `${cfg.detailPathPrefix}/${oldSlug}`,
      `${cfg.detailPathPrefix}/${norm.slug}`,
      actor.id
    );
  }

  const mapped = mapDbRowForModule(mod, updatedRow as Record<string, unknown>);
  await recordAuditLog({
    actor,
    action: `${cfg.auditEntity}.update`,
    entityType: cfg.auditEntity,
    entityId: id,
    entityLabel: getItemLabel(mod, mapped as unknown as Record<string, unknown>),
    summary: `Cập nhật ${cfg.labelVi}: ${getItemLabel(mod, mapped as unknown as Record<string, unknown>)}${
      redirectCreated ? " (đã tự tạo Redirect 301)" : ""
    }`,
  });
  revalidateModulePaths(mod, [oldSlug, norm.slug]);
  return { ok: true, item: mapped, redirectCreated };
}

export async function duplicateLearningItem<K extends LearningModuleKey>(
  mod: K,
  id: string,
  actor: Actor
): Promise<
  | { ok: true; item: LearningRecordMap[K] }
  | { ok: false; status: number; error: string }
> {
  const existing = await getLearningItemById(mod, id);
  if (!existing) {
    return { ok: false, status: 404, error: "Không tìm thấy mục cần nhân bản." };
  }

  const rec = existing as unknown as Record<string, unknown>;
  const suffix = `${Date.now().toString(36).slice(-4)}`;
  const copySlug = `${String(rec.slug)}-ban-sao-${suffix}`;
  const copyTitleVi = `${String(rec.title_vi ?? "")} (Bản sao)`;
  const copyTitleEn = `${String(rec.title_en ?? rec.title_vi ?? "")} (Copy)`;

  const draftInput: Record<string, unknown> = {
    ...rec,
    slug: copySlug,
    title_vi: copyTitleVi,
    title_en: copyTitleEn,
  };

  if (mod === "conversations" || mod === "writing-exercises") {
    draftInput.status = "draft";
  } else {
    draftInput.is_published = false;
  }

  if (mod === "videos") {
    draftInput.youtube_input = String(rec.youtube_id ?? "");
  }

  return createLearningItem(mod, draftInput, actor);
}

export async function deleteLearningItem(
  mod: LearningModuleKey,
  id: string,
  actor: Actor
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const cfg = MODULE_CONFIGS[mod];
  const existing = await getLearningItemById(mod, id);
  if (!existing) {
    return { ok: false, status: 404, error: `Không tìm thấy ${cfg.labelVi}.` };
  }
  const rec = existing as unknown as Record<string, unknown>;
  const slug = String(rec.slug ?? "");
  const label = getItemLabel(mod, rec);

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const filterOut = <T extends { id?: string; slug: string }>(arr: T[]) =>
        arr.filter((i) => String(i.id ?? i.slug) !== id);
      switch (mod) {
        case "courses":
          store.courses = filterOut(store.courses);
          break;
        case "conversations":
          store.conversation_topics = filterOut(store.conversation_topics);
          break;
        case "writing-exercises":
          store.writing_exercises = filterOut(store.writing_exercises);
          break;
        case "pronunciation":
          store.pronunciation_sounds = filterOut(store.pronunciation_sounds);
          break;
        case "dictation":
          store.dictation_lessons = filterOut(store.dictation_lessons);
          break;
        case "videos":
          store.learn_videos = filterOut(store.learn_videos);
          break;
      }
    });
    await recordAuditLog({
      actor,
      action: `${cfg.auditEntity}.delete`,
      entityType: cfg.auditEntity,
      entityId: id,
      entityLabel: label,
      summary: `Xóa ${cfg.labelVi}: ${label}`,
    });
    revalidateModulePaths(mod, [slug]);
    return { ok: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, status: 500, error: "Chưa kết nối được Supabase Admin." };

  const { error } = await admin.from(cfg.table).delete().eq("id", id);
  if (error) {
    return { ok: false, status: 500, error: error.message || `Không thể xóa ${cfg.labelVi}.` };
  }

  await recordAuditLog({
    actor,
    action: `${cfg.auditEntity}.delete`,
    entityType: cfg.auditEntity,
    entityId: id,
    entityLabel: label,
    summary: `Xóa ${cfg.labelVi}: ${label}`,
  });
  revalidateModulePaths(mod, [slug]);
  return { ok: true };
}
