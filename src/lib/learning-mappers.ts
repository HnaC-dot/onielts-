import type {
  ContentPublishStatus,
  ConversationTopic,
  CourseItem,
  DictationLesson,
  LearnVideo,
  PronunciationSound,
  SeoMeta,
  WritingExercise,
} from "./types";

function parseSeoMeta(raw: unknown): SeoMeta {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as SeoMeta)
    : {};
}

// =============================================================================
// 1. COURSES
// =============================================================================
export function mapCourseRow(row: Record<string, unknown>): CourseItem {
  const lessons = Array.isArray(row.lessons)
    ? (row.lessons as CourseItem["lessons"])
    : [];
  const totalMins = lessons.reduce((acc, l) => acc + (Number(l.duration_min) || 15), 0);
  return {
    id: String(row.id),
    slug: String(row.slug),
    title_vi: String(row.title_vi ?? ""),
    title_en: String(row.title_en ?? row.title_vi ?? ""),
    description_vi: String(row.description_vi ?? ""),
    description_en: String(row.description_en ?? row.description_vi ?? ""),
    level: String(row.level ?? ""),
    target_band: String(row.target_band ?? ""),
    duration_hours: Math.max(1, Math.round(totalMins / 60)),
    is_published: Boolean(row.is_published),
    is_premium: Boolean(row.is_premium),
    cover_image_url: row.cover_image_url ? String(row.cover_image_url) : null,
    seo_meta: parseSeoMeta(row.seo_meta),
    sort_order: Number(row.sort_order ?? 0),
    lessons,
  };
}

// =============================================================================
// 2. CONVERSATION TOPICS
// =============================================================================
export function uiPartToDbPart(
  part: ConversationTopic["part"]
): "part_1" | "part_2" | "part_3" {
  if (part === "Part 2") return "part_2";
  if (part === "Part 3") return "part_3";
  return "part_1";
}

export function dbPartToUiPart(
  dbPart: string,
  meta?: Record<string, unknown>
): ConversationTopic["part"] {
  if (meta?.displayPart === "Daily Life") return "Daily Life";
  if (dbPart === "part_2") return "Part 2";
  if (dbPart === "part_3") return "Part 3";
  return "Part 1";
}

export function conversationTopicToDbRow(
  topic: Omit<ConversationTopic, "id">,
  sortOrder = 0
): Record<string, unknown> {
  const baseSeo = { ...(topic.seo_meta ?? {}) } as Record<string, unknown>;
  baseSeo.level = topic.level || "Band 6.0–7.5";
  if (topic.part === "Daily Life") {
    baseSeo.displayPart = "Daily Life";
  } else {
    delete baseSeo.displayPart;
  }

  const sampleQuestions = Array.isArray(topic.sampleQuestions)
    ? topic.sampleQuestions.map((q) => q.trim()).filter(Boolean)
    : [];
  const opener = topic.opener.trim();
  const storedQuestions =
    opener && sampleQuestions[0] !== opener
      ? [opener, ...sampleQuestions.filter((q) => q !== opener)]
      : sampleQuestions.length > 0
      ? sampleQuestions
      : opener
      ? [opener]
      : [];

  return {
    slug: topic.slug,
    part: uiPartToDbPart(topic.part),
    title_vi: topic.title_vi,
    title_en: topic.title_en,
    description_vi: topic.description_vi,
    description_en: topic.description_en || topic.description_vi,
    vocabulary: topic.suggestedVocab ?? [],
    sample_questions: storedQuestions,
    system_prompt: topic.systemPrompt ?? "",
    status: topic.status ?? "published",
    is_premium: Boolean(topic.is_premium),
    seo_meta: baseSeo,
    sort_order: topic.sort_order ?? sortOrder,
  };
}

export function mapConversationRow(row: Record<string, unknown>): ConversationTopic {
  const rawMeta = parseSeoMeta(row.seo_meta) as SeoMeta & {
    level?: string;
    displayPart?: string;
  };
  const vocab = Array.isArray(row.vocabulary)
    ? row.vocabulary.map((v) => String(v)).filter(Boolean)
    : [];
  const questions = Array.isArray(row.sample_questions)
    ? row.sample_questions.map((q) => String(q)).filter(Boolean)
    : [];
  const status: ContentPublishStatus =
    row.status === "draft" || row.status === "published" || row.status === "scheduled"
      ? row.status
      : "published";

  return {
    id: String(row.id),
    slug: String(row.slug),
    title_vi: String(row.title_vi ?? ""),
    title_en: String(row.title_en ?? row.title_vi ?? ""),
    part: dbPartToUiPart(String(row.part ?? "part_1"), rawMeta as Record<string, unknown>),
    level: typeof rawMeta.level === "string" && rawMeta.level ? rawMeta.level : "Band 6.0–7.5",
    opener:
      questions[0] ??
      `Hello! Let's practice speaking about ${String(row.title_en || row.title_vi)}.`,
    description_vi: String(row.description_vi ?? ""),
    description_en: String(row.description_en ?? row.description_vi ?? ""),
    suggestedVocab: vocab,
    sampleQuestions: questions,
    systemPrompt: String(row.system_prompt ?? ""),
    status,
    is_premium: Boolean(row.is_premium),
    seo_meta: rawMeta,
    sort_order: Number(row.sort_order ?? 0),
  };
}

// =============================================================================
// 3. WRITING EXERCISES
// =============================================================================
export function writingExerciseToDbRow(
  ex: Omit<WritingExercise, "id">,
  sortOrder = 0
): Record<string, unknown> {
  const firstSentence = ex.sentences[0];
  return {
    slug: ex.slug,
    topic_vi: ex.title_vi,
    topic_en: ex.title_en || ex.title_vi,
    original_sentence: firstSentence?.weakSentence ?? "",
    practice_items: {
      topic: ex.topic,
      targetSkill: ex.targetSkill,
      sentences: ex.sentences,
    },
    model_band8: firstSentence?.band8Model ?? "",
    criteria:
      ex.criteria && ex.criteria.length > 0
        ? ex.criteria
        : ["Lexical Resource", "Grammatical Range"],
    explanation_vi: ex.explanation_vi || firstSentence?.issue_vi || "",
    explanation_en: ex.explanation_en || "",
    status: ex.status ?? "published",
    is_premium: Boolean(ex.is_premium),
    seo_meta: ex.seo_meta ?? {},
    sort_order: ex.sort_order ?? sortOrder,
  };
}

export function mapWritingExerciseRow(row: Record<string, unknown>): WritingExercise {
  const rawItems = row.practice_items;
  let topic = "IELTS Writing";
  let targetSkill = "Lexical Resource & Grammatical Range";
  let sentences: WritingExercise["sentences"] = [];

  if (Array.isArray(rawItems)) {
    sentences = rawItems as WritingExercise["sentences"];
  } else if (rawItems && typeof rawItems === "object") {
    const obj = rawItems as {
      topic?: string;
      targetSkill?: string;
      sentences?: WritingExercise["sentences"];
    };
    if (obj.topic) topic = String(obj.topic);
    if (obj.targetSkill) targetSkill = String(obj.targetSkill);
    if (Array.isArray(obj.sentences)) sentences = obj.sentences;
  }

  if (sentences.length === 0 && row.original_sentence) {
    sentences = [
      {
        id: `${String(row.id)}-s1`,
        weakSentence: String(row.original_sentence),
        issue_vi: String(row.explanation_vi ?? ""),
        hint_vi: "",
        band8Model: String(row.model_band8 ?? ""),
        keyUpgrades: [],
      },
    ];
  }

  const criteria = Array.isArray(row.criteria)
    ? row.criteria.map(String).filter(Boolean)
    : ["Lexical Resource", "Grammatical Range"];

  const status: ContentPublishStatus =
    row.status === "draft" || row.status === "published" || row.status === "scheduled"
      ? row.status
      : "published";

  return {
    id: String(row.id),
    slug: String(row.slug),
    title_vi: String(row.topic_vi ?? ""),
    title_en: String(row.topic_en ?? row.topic_vi ?? ""),
    topic,
    targetSkill: targetSkill || criteria.join(" & "),
    criteria,
    explanation_vi: String(row.explanation_vi ?? ""),
    explanation_en: String(row.explanation_en ?? ""),
    status,
    is_premium: Boolean(row.is_premium),
    seo_meta: parseSeoMeta(row.seo_meta),
    sort_order: Number(row.sort_order ?? 0),
    sentences,
  };
}

// =============================================================================
// 4. PRONUNCIATION IPA
// =============================================================================
export function mapPronunciationRow(row: Record<string, unknown>): PronunciationSound {
  const rawEx = row.examples;
  let mouthPositionVi = "";
  let practiceSentence = "";
  let words: PronunciationSound["examples"] = [];

  if (Array.isArray(rawEx)) {
    words = rawEx as PronunciationSound["examples"];
  } else if (rawEx && typeof rawEx === "object") {
    const obj = rawEx as {
      mouthPosition_vi?: string;
      practiceSentence?: string;
      words?: PronunciationSound["examples"];
    };
    mouthPositionVi = String(obj.mouthPosition_vi ?? "");
    practiceSentence = String(obj.practiceSentence ?? "");
    words = Array.isArray(obj.words) ? obj.words : [];
  }

  const category =
    row.category === "vowel" ||
    row.category === "diphthong" ||
    row.category === "consonant"
      ? row.category
      : "vowel";

  return {
    id: row.id ? String(row.id) : undefined,
    slug: String(row.slug),
    symbol: String(row.symbol),
    category,
    title_vi: String(row.title_vi ?? ""),
    title_en: String(row.title_en ?? row.title_vi ?? ""),
    mouthPosition_vi: mouthPositionVi || String(row.tip_vi ?? ""),
    vietnameseTip_vi: String(row.tip_vi ?? ""),
    tip_en: String(row.tip_en ?? ""),
    examples: words,
    practiceSentence: practiceSentence || (words[0] ? `Practice saying "${words[0].word}" clearly.` : ""),
    mouth_image_url: row.mouth_image_url ? String(row.mouth_image_url) : null,
    audio_url: row.audio_url ? String(row.audio_url) : null,
    is_published: row.is_published !== false,
    is_premium: Boolean(row.is_premium),
    seo_meta: parseSeoMeta(row.seo_meta),
    sort_order: Number(row.sort_order ?? 0),
  };
}

// =============================================================================
// 5. DICTATION LESSONS
// =============================================================================
export function mapDictationRow(row: Record<string, unknown>): DictationLesson {
  const accent =
    row.accent === "en-GB" || row.accent === "en-US" || row.accent === "en-AU"
      ? row.accent
      : "en-GB";
  return {
    id: String(row.id),
    slug: String(row.slug),
    title_vi: String(row.title_vi ?? ""),
    title_en: String(row.title_en ?? row.title_vi ?? ""),
    category: String(row.category ?? "Listening Part 1"),
    difficulty: String(row.difficulty ?? "Band 5.5–6.5"),
    accent,
    is_published: row.is_published !== false,
    is_premium: Boolean(row.is_premium),
    seo_meta: parseSeoMeta(row.seo_meta),
    sentences: Array.isArray(row.sentences)
      ? (row.sentences as DictationLesson["sentences"])
      : [],
  };
}

// =============================================================================
// 6. LEARN VIDEOS
// =============================================================================
export function mapVideoRow(row: Record<string, unknown>): LearnVideo {
  return {
    id: String(row.id),
    slug: String(row.slug),
    youtube_id: String(row.youtube_id ?? ""),
    title_vi: String(row.title_vi ?? ""),
    title_en: String(row.title_en ?? row.title_vi ?? ""),
    description_vi: String(row.description_vi ?? ""),
    description_en: String(row.description_en ?? row.description_vi ?? ""),
    level: String(row.level ?? "Band 6.0–7.5"),
    duration_label: String(row.duration_label ?? "08:00"),
    is_published: row.is_published !== false,
    is_premium: Boolean(row.is_premium),
    seo_meta: parseSeoMeta(row.seo_meta),
    transcript: Array.isArray(row.transcript)
      ? (row.transcript as LearnVideo["transcript"])
      : [],
  };
}
