import "server-only";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "./supabase/server";
import {
  getBandConversionTables,
  getCourses,
  getIeltsTests,
  getUserCourseProgress,
  isValidUuid,
} from "./db";
import { readStore, updateStore } from "./store";
import { gradeObjectiveTest } from "./test-grader";
import { calculateOverallBand } from "./band-calculator";
import {
  getQuestionTypeLabel,
  type AdminAnonymousAnalyticsPayload,
  type HistorySkillFilter,
  type ProgressAttemptReviewPayload,
  type ProgressHistoryItem,
  type ProgressHistoryPage,
  type ProgressSummaryPayload,
  type QuestionTypeStatItem,
  type RecommendedPracticeItem,
  type SkillBandPoint,
} from "./progress-shared";
import type {
  IeltsSkill,
  IeltsTest,
  SessionUser,
  SpeakingEvaluation,
  WritingEvaluation,
} from "./types";

function formatShortDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  // Vietnam UTC+7 display dd/MM
  const vn = new Date(dt.getTime() + 7 * 60 * 60 * 1000);
  const dd = String(vn.getUTCDate()).padStart(2, "0");
  const mm = String(vn.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function roundToHalf(val: number): number {
  return Math.round(val * 2) / 2;
}

function averageOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return roundToHalf(avg);
}

function buildPracticeLinkForQuestionType(
  qType: string,
  publishedTests: IeltsTest[]
): { href: string; title?: string; skill: IeltsSkill } {
  // Find a published test containing the most questions of this type
  let bestTest: IeltsTest | null = null;
  let bestCount = 0;

  for (const t of publishedTests) {
    if (t.skill !== "reading" && t.skill !== "listening") continue;
    const count = t.sections.reduce(
      (sum, s) => sum + s.questions.filter((q) => q.type === qType).length,
      0
    );
    if (count > bestCount) {
      bestCount = count;
      bestTest = t;
    }
  }

  if (bestTest) {
    return {
      href: `/tests/${bestTest.slug}`,
      title: bestTest.title_vi,
      skill: bestTest.skill,
    };
  }

  const listeningTypes = new Set([
    "map_labelling",
    "note_completion",
    "table_completion",
    "flowchart_completion",
  ]);
  const fallbackSkill: IeltsSkill = listeningTypes.has(qType)
    ? "listening"
    : "reading";
  return {
    href: `/tests?skill=${fallbackSkill}`,
    skill: fallbackSkill,
  };
}

function buildRecommendations(
  questionStats: QuestionTypeStatItem[],
  estimatedBands: ProgressSummaryPayload["estimatedBands"],
  publishedTests: IeltsTest[],
  completedTestIds: Set<string>
): RecommendedPracticeItem[] {
  const recs: RecommendedPracticeItem[] = [];
  const usedHrefs = new Set<string>();

  // 1. Weakest question types first (accuracy < 80% or lowest accuracy)
  const sortedWeak = [...questionStats]
    .filter((s) => s.total > 0)
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent || b.wrong - a.wrong);

  for (const stat of sortedWeak.slice(0, 2)) {
    // Prefer an uncompleted test containing this question type, else fallback
    const candidates = publishedTests
      .filter((t) => t.skill === "reading" || t.skill === "listening")
      .map((t) => ({
        test: t,
        matchCount: t.sections.reduce(
          (sum, s) => sum + s.questions.filter((q) => q.type === stat.type).length,
          0
        ),
        notDone: !completedTestIds.has(t.id),
      }))
      .filter((c) => c.matchCount > 0)
      .sort(
        (a, b) =>
          Number(b.notDone) - Number(a.notDone) || b.matchCount - a.matchCount
      );

    const chosen = candidates[0]?.test;
    const href = chosen ? `/tests/${chosen.slug}` : stat.practiceHref;
    if (usedHrefs.has(href)) continue;
    usedHrefs.add(href);

    recs.push({
      reasonVi: `Dạng "${stat.labelVi}" đang đạt ${stat.accuracyPercent}% (${stat.wrong} câu sai)`,
      reasonEn: `"${stat.labelEn}" is currently at ${stat.accuracyPercent}% (${stat.wrong} missed)`,
      titleVi: chosen ? chosen.title_vi : `Luyện tập dạng ${stat.labelVi}`,
      titleEn: chosen ? chosen.title_en : `Practice ${stat.labelEn}`,
      skill: chosen ? chosen.skill : "reading",
      href,
      weakType: stat.type,
      badgeText: `${stat.accuracyPercent}%`,
    });
  }

  // 2. Weakest overall skill (or unpracticed skill)
  const skillEntries: Array<{
    skill: IeltsSkill;
    band: number;
    href: string;
    titleVi: string;
    titleEn: string;
  }> = [
    {
      skill: "reading",
      band: estimatedBands.reading ?? -1,
      href: "/tests?skill=reading",
      titleVi: "Làm 1 đề Reading 40 câu chuẩn máy tính",
      titleEn: "Complete a full 40-question Reading test",
    },
    {
      skill: "listening",
      band: estimatedBands.listening ?? -1,
      href: "/tests?skill=listening",
      titleVi: "Làm 1 đề Listening 40 câu có MP3 thật",
      titleEn: "Complete a full 40-question Listening test",
    },
    {
      skill: "writing",
      band: estimatedBands.writing ?? -1,
      href: "/writing",
      titleVi: "Nộp 1 bài Writing chấm AI 4 tiêu chí",
      titleEn: "Submit a Writing essay for 4-criterion AI feedback",
    },
    {
      skill: "speaking",
      band: estimatedBands.speaking ?? -1,
      href: "/speaking",
      titleVi: "Ghi âm Speaking Part 1–3 chấm điểm tham khảo",
      titleEn: "Record Speaking Parts 1–3 for AI feedback",
    },
  ];
  skillEntries.sort((a, b) => a.band - b.band);

  for (const sk of skillEntries) {
    if (recs.length >= 3) break;
    if (usedHrefs.has(sk.href)) continue;
    usedHrefs.add(sk.href);
    recs.push({
      reasonVi:
        sk.band < 0
          ? `Bạn chưa có điểm đánh giá kỹ năng ${sk.skill.toUpperCase()}`
          : `${sk.skill.toUpperCase()} đang là kỹ năng thấp nhất (Band ${sk.band.toFixed(1)})`,
      reasonEn:
        sk.band < 0
          ? `No baseline score yet for ${sk.skill.toUpperCase()}`
          : `${sk.skill.toUpperCase()} is currently your lowest skill (Band ${sk.band.toFixed(1)})`,
      titleVi: sk.titleVi,
      titleEn: sk.titleEn,
      skill: sk.skill,
      href: sk.href,
      badgeText: sk.band < 0 ? "Mới" : `Band ${sk.band.toFixed(1)}`,
    });
  }

  return recs.slice(0, 3);
}

// =============================================================================
// 1. AGGREGATED USER PROGRESS SUMMARY (Server-side, Premium-gated, Privacy-safe)
// =============================================================================
export async function getUserProgressSummary(
  user: Pick<SessionUser, "id" | "role" | "isPremium" | "target_band" | "streak_count">
): Promise<ProgressSummaryPayload> {
  const canViewPremium = Boolean(user.isPremium || user.role === "admin");
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [publishedTests, courses, courseProgs] = await Promise.all([
    getIeltsTests(false),
    getCourses(false),
    getUserCourseProgress(user.id),
  ]);

  type LightAttempt = {
    id: string;
    test_id: string;
    test_title: string;
    skill: IeltsSkill;
    raw_score: number;
    max_score: number;
    band_score: number;
    breakdown_by_type: Record<string, { correct: number; total: number }>;
    duration_seconds: number;
    completed_at: string;
  };
  type LightDaily = {
    id: string;
    raw_score: number;
    max_score: number;
    band_score: number;
    breakdown_by_type: Record<string, { correct: number; total: number }>;
    duration_seconds: number;
    submitted_at: string;
  };
  type LightWriting = {
    id: string;
    task_type: string;
    overall_band: number;
    word_count: number;
    created_at: string;
  };
  type LightSpeaking = {
    id: string;
    part: string;
    overall_band: number;
    audio_duration_sec: number;
    created_at: string;
  };

  let attempts: LightAttempt[] = [];
  let dailyAttempts: LightDaily[] = [];
  let writingSubs: LightWriting[] = [];
  let speakingSubs: LightSpeaking[] = [];
  let flashcardsTotal = 0;
  let flashcardsLearned = 0;
  const typeTotals: Record<string, { correct: number; total: number }> = {};

  if (!isSupabaseConfigured()) {
    const store = readStore();
    attempts = store.test_attempts
      .filter((a) => a.user_id === user.id)
      .sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))
      .map((a) => ({
        id: a.id,
        test_id: a.test_id,
        test_title: a.test_title,
        skill: a.skill,
        raw_score: a.raw_score,
        max_score: a.max_score,
        band_score: a.band_score,
        breakdown_by_type: a.breakdown_by_type ?? {},
        duration_seconds: a.duration_seconds,
        completed_at: a.completed_at,
      }));

    dailyAttempts = store.daily_exam_attempts
      .filter((d) => d.user_id === user.id && d.is_completed)
      .map((d) => ({
        id: d.id,
        raw_score: d.raw_score,
        max_score: d.max_score,
        band_score: d.band_score,
        breakdown_by_type: d.breakdown_by_type ?? {},
        duration_seconds: d.duration_seconds,
        submitted_at: d.submitted_at || d.started_at,
      }));

    writingSubs = store.writing_submissions
      .filter((w) => w.user_id === user.id)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((w) => ({
        id: w.id,
        task_type: w.task_type,
        overall_band: w.overall_band,
        word_count: w.word_count,
        created_at: w.created_at,
      }));

    speakingSubs = store.speaking_submissions
      .filter((s) => s.user_id === user.id)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((s) => ({
        id: s.id,
        part: s.part,
        overall_band: s.overall_band,
        audio_duration_sec: s.audio_duration_sec,
        created_at: s.created_at,
      }));

    const userCards = store.flashcards.filter((c) => c.user_id === user.id);
    flashcardsTotal = userCards.length;
    flashcardsLearned = userCards.filter((c) => c.repetitions > 0).length;

    const normalizedAnswers = (store.test_attempt_answers ?? []).filter(
      (r) => r.user_id === user.id
    );
    if (normalizedAnswers.length > 0) {
      for (const r of normalizedAnswers) {
        if (!typeTotals[r.question_type]) {
          typeTotals[r.question_type] = { correct: 0, total: 0 };
        }
        typeTotals[r.question_type].total += 1;
        if (r.is_correct) typeTotals[r.question_type].correct += 1;
      }
    } else {
      for (const a of attempts) {
        for (const [k, st] of Object.entries(a.breakdown_by_type)) {
          if (!typeTotals[k]) typeTotals[k] = { correct: 0, total: 0 };
          typeTotals[k].correct += st.correct;
          typeTotals[k].total += st.total;
        }
      }
    }
  } else if (isValidUuid(user.id)) {
    const sb = await createSupabaseServerClient();
    if (sb) {
      // Lightweight column-projected queries backed by composite user_id indexes (NO full JSON essays/answers fetched!)
      const [attRes, dailyRes, wrRes, spRes, fcTotalRes, fcLearnedRes, ansRes] =
        await Promise.all([
          sb
            .from("test_attempts")
            .select(
              "id, test_id, skill, raw_score, max_score, band_score, breakdown_by_type, duration_seconds, completed_at, ielts_tests(title_vi)"
            )
            .eq("user_id", user.id)
            .order("completed_at", { ascending: false })
            .limit(200),
          sb
            .from("daily_exam_attempts")
            .select(
              "id, raw_score, band_score, duration_seconds, submitted_at, started_at, is_completed"
            )
            .eq("user_id", user.id)
            .eq("is_completed", true)
            .order("submitted_at", { ascending: false })
            .limit(100),
          sb
            .from("writing_submissions")
            .select("id, task_type, overall_band, word_count, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(100),
          sb
            .from("speaking_submissions")
            .select("id, part, overall_band, audio_duration_sec, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(100),
          sb
            .from("flashcards")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          sb
            .from("flashcards")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gt("repetitions", 0),
          sb
            .from("test_attempt_answers")
            .select("question_type, is_correct")
            .eq("user_id", user.id)
            .limit(2500),
        ]);

      attempts = (attRes.data ?? []).map((row) => {
        const joined = row.ielts_tests as { title_vi?: string } | null;
        return {
          id: String(row.id),
          test_id: String(row.test_id),
          test_title: String(joined?.title_vi ?? "IELTS Test"),
          skill: row.skill as IeltsSkill,
          raw_score: Number(row.raw_score ?? 0),
          max_score: Number(row.max_score ?? 40),
          band_score: Number(row.band_score ?? 0),
          breakdown_by_type:
            (row.breakdown_by_type as Record<
              string,
              { correct: number; total: number }
            >) ?? {},
          duration_seconds: Number(row.duration_seconds ?? 0),
          completed_at: String(row.completed_at),
        };
      });

      dailyAttempts = (dailyRes.data ?? []).map((row) => ({
        id: String(row.id),
        raw_score: Number(row.raw_score ?? 0),
        max_score: 10,
        band_score: Number(row.band_score ?? 0),
        breakdown_by_type: {},
        duration_seconds: Number(row.duration_seconds ?? 0),
        submitted_at: String(row.submitted_at || row.started_at),
      }));

      writingSubs = (wrRes.data ?? []).map((row) => ({
        id: String(row.id),
        task_type: String(row.task_type),
        overall_band: Number(row.overall_band ?? 0),
        word_count: Number(row.word_count ?? 0),
        created_at: String(row.created_at),
      }));

      speakingSubs = (spRes.data ?? []).map((row) => ({
        id: String(row.id),
        part: String(row.part),
        overall_band: Number(row.overall_band ?? 0),
        audio_duration_sec: Number(row.audio_duration_sec ?? 0),
        created_at: String(row.created_at),
      }));

      flashcardsTotal = fcTotalRes.count ?? 0;
      flashcardsLearned = fcLearnedRes.count ?? 0;

      // Prefer normalized test_attempt_answers (migration 0006); fallback to breakdown_by_type
      if (!ansRes.error && Array.isArray(ansRes.data) && ansRes.data.length > 0) {
        for (const r of ansRes.data) {
          const qt = String(r.question_type || "");
          if (!qt) continue;
          if (!typeTotals[qt]) typeTotals[qt] = { correct: 0, total: 0 };
          typeTotals[qt].total += 1;
          if (r.is_correct) typeTotals[qt].correct += 1;
        }
      } else {
        for (const a of attempts) {
          for (const [k, st] of Object.entries(a.breakdown_by_type)) {
            if (!typeTotals[k]) typeTotals[k] = { correct: 0, total: 0 };
            typeTotals[k].correct += st.correct;
            typeTotals[k].total += st.total;
          }
        }
      }
    }
  }

  // Merge any daily breakdown_by_type into typeTotals
  for (const d of dailyAttempts) {
    for (const [k, st] of Object.entries(d.breakdown_by_type ?? {})) {
      if (!typeTotals[k]) typeTotals[k] = { correct: 0, total: 0 };
      typeTotals[k].correct += st.correct;
      typeTotals[k].total += st.total;
    }
  }

  // Weekly study time (last 7 days)
  const sevenDaysMs = Date.parse(sevenDaysAgoIso);
  const weeklyStudySeconds =
    attempts
      .filter((a) => Date.parse(a.completed_at) >= sevenDaysMs)
      .reduce((sum, a) => sum + Math.max(0, a.duration_seconds), 0) +
    dailyAttempts
      .filter((d) => Date.parse(d.submitted_at) >= sevenDaysMs)
      .reduce((sum, d) => sum + Math.max(0, d.duration_seconds), 0) +
    speakingSubs
      .filter((s) => Date.parse(s.created_at) >= sevenDaysMs)
      .reduce((sum, s) => sum + Math.max(30, s.audio_duration_sec), 0) +
    writingSubs
      .filter((w) => Date.parse(w.created_at) >= sevenDaysMs)
      .reduce(
        (sum, w) => sum + Math.min(2400, Math.max(300, Math.round((w.word_count / 12) * 60))),
        0
      );

  // Skill band averages (last 5 recent official/graded entries for realistic current estimate)
  const fullReading = attempts.filter(
    (a) => a.skill === "reading" && a.max_score >= 40 && a.band_score > 0
  );
  const fullListening = attempts.filter(
    (a) => a.skill === "listening" && a.max_score >= 40 && a.band_score > 0
  );

  const readingBand = averageOrNull(fullReading.slice(0, 5).map((a) => a.band_score));
  const listeningBand = averageOrNull(
    fullListening.slice(0, 5).map((a) => a.band_score)
  );
  const writingBand = averageOrNull(
    writingSubs.slice(0, 5).map((w) => w.overall_band)
  );
  const speakingBand = averageOrNull(
    speakingSubs.slice(0, 5).map((s) => s.overall_band)
  );

  const availableBands = [readingBand, listeningBand, writingBand, speakingBand].filter(
    (v): v is number => v !== null
  );
  const overallBand =
    readingBand !== null &&
    listeningBand !== null &&
    writingBand !== null &&
    speakingBand !== null
      ? calculateOverallBand({
          listening: listeningBand,
          reading: readingBand,
          writing: writingBand,
          speaking: speakingBand,
        }).overall
      : averageOrNull(availableBands);

  const latestReading = attempts.find((a) => a.skill === "reading") ?? null;
  const latestListening = attempts.find((a) => a.skill === "listening") ?? null;
  const latestWriting = writingSubs[0] ?? null;
  const latestSpeaking = speakingSubs[0] ?? null;

  // Build Premium analytics ONLY when server verifies canViewPremium
  const allChartPointsCount =
    fullReading.length +
    fullListening.length +
    writingSubs.length +
    speakingSubs.length;

  let charts: ProgressSummaryPayload["charts"] = null;
  let questionTypeStats: QuestionTypeStatItem[] | null = null;
  let recommendations: RecommendedPracticeItem[] | null = null;

  if (canViewPremium) {
    charts = {
      reading: fullReading
        .slice(0, 15)
        .reverse()
        .map((a) => ({
          date: a.completed_at,
          label: formatShortDate(a.completed_at),
          band: a.band_score,
          title: a.test_title,
        })),
      listening: fullListening
        .slice(0, 15)
        .reverse()
        .map((a) => ({
          date: a.completed_at,
          label: formatShortDate(a.completed_at),
          band: a.band_score,
          title: a.test_title,
        })),
      writing: writingSubs
        .slice(0, 15)
        .reverse()
        .map((w) => ({
          date: w.created_at,
          label: formatShortDate(w.created_at),
          band: w.overall_band,
          title: w.task_type.toUpperCase(),
        })),
      speaking: speakingSubs
        .slice(0, 15)
        .reverse()
        .map((s) => ({
          date: s.created_at,
          label: formatShortDate(s.created_at),
          band: s.overall_band,
          title: s.part.replace("_", " ").toUpperCase(),
        })),
    };

    questionTypeStats = Object.entries(typeTotals)
      .filter(([, st]) => st.total > 0)
      .map(([type, st]) => {
        const accuracyPercent = Math.round((st.correct / st.total) * 100);
        const practice = buildPracticeLinkForQuestionType(type, publishedTests);
        return {
          type,
          labelVi: getQuestionTypeLabel(type, false),
          labelEn: getQuestionTypeLabel(type, true),
          correct: st.correct,
          wrong: Math.max(0, st.total - st.correct),
          total: st.total,
          accuracyPercent,
          practiceHref: practice.href,
          practiceTestTitle: practice.title,
        };
      })
      .sort(
        (a, b) =>
          a.accuracyPercent - b.accuracyPercent || b.wrong - a.wrong
      );

    const completedTestIds = new Set(attempts.map((a) => a.test_id));
    recommendations = buildRecommendations(
      questionTypeStats,
      {
        reading: readingBand,
        listening: listeningBand,
        writing: writingBand,
        speaking: speakingBand,
        overall: overallBand,
      },
      publishedTests,
      completedTestIds
    );
  }

  return {
    isPremium: canViewPremium,
    targetBand: Number(user.target_band ?? 7.0),
    streakCount: Number(user.streak_count ?? 0),
    weeklyStudySeconds,
    counts: {
      testsCompleted: attempts.length,
      dailyExamsCompleted: dailyAttempts.length,
      writingCount: writingSubs.length,
      speakingCount: speakingSubs.length,
      flashcardsTotal,
      flashcardsLearned,
    },
    estimatedBands: {
      reading: readingBand,
      listening: listeningBand,
      writing: writingBand,
      speaking: speakingBand,
      overall: overallBand,
    },
    latestScores: {
      reading: latestReading
        ? {
            band: latestReading.band_score,
            rawScore: latestReading.raw_score,
            maxScore: latestReading.max_score,
            completedAt: latestReading.completed_at,
            title: latestReading.test_title,
          }
        : null,
      listening: latestListening
        ? {
            band: latestListening.band_score,
            rawScore: latestListening.raw_score,
            maxScore: latestListening.max_score,
            completedAt: latestListening.completed_at,
            title: latestListening.test_title,
          }
        : null,
      writing: latestWriting
        ? {
            band: latestWriting.overall_band,
            taskType: latestWriting.task_type,
            completedAt: latestWriting.created_at,
          }
        : null,
      speaking: latestSpeaking
        ? {
            band: latestSpeaking.overall_band,
            part: latestSpeaking.part,
            completedAt: latestSpeaking.created_at,
          }
        : null,
    },
    charts,
    questionTypeStats,
    recommendations,
    lockedMeta: {
      trackedQuestionTypesCount: Object.keys(typeTotals).length,
      chartPointsCount: allChartPointsCount,
    },
    courseProgress: courses.slice(0, 6).map((c) => {
      const prog = courseProgs.find((p) => p.course_id === c.id);
      return {
        courseId: c.id,
        slug: c.slug,
        titleVi: c.title_vi,
        titleEn: c.title_en,
        progressPercent: prog?.progress_percent ?? 0,
      };
    }),
  };
}

// =============================================================================
// 2. SERVER-SIDE PAGINATED & FILTERED HISTORY (Never loads all rows to client)
// =============================================================================
export async function getUserProgressHistory(
  userId: string,
  options: {
    skill?: HistorySkillFilter;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<ProgressHistoryPage> {
  const skill: HistorySkillFilter = options.skill ?? "all";
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.max(5, Math.min(25, Math.floor(options.pageSize ?? 10)));
  const offset = (page - 1) * pageSize;

  if (!isSupabaseConfigured()) {
    const store = readStore();
    const all: ProgressHistoryItem[] = [];

    if (skill === "all" || skill === "reading" || skill === "listening") {
      for (const a of store.test_attempts) {
        if (a.user_id !== userId) continue;
        if (skill !== "all" && a.skill !== skill) continue;
        all.push({
          id: a.id,
          kind: "test",
          skill: a.skill,
          title: a.test_title,
          subtitle: `${a.raw_score}/${a.max_score} câu đúng`,
          testSlug: a.test_slug,
          rawScore: a.raw_score,
          maxScore: a.max_score,
          bandScore: a.max_score >= 40 ? a.band_score : null,
          durationSeconds: a.duration_seconds,
          completedAt: a.completed_at,
        });
      }
    }

    if (skill === "all" || skill === "daily") {
      for (const d of store.daily_exam_attempts) {
        if (d.user_id !== userId || !d.is_completed) continue;
        all.push({
          id: d.id,
          kind: "daily",
          skill: "reading",
          title: `Đề thi mỗi ngày (${d.exam_date})`,
          subtitle: `${d.raw_score}/${d.max_score} câu đúng`,
          testSlug: d.test_slug,
          rawScore: d.raw_score,
          maxScore: d.max_score,
          bandScore: d.band_score > 0 ? d.band_score : null,
          durationSeconds: d.duration_seconds,
          completedAt: d.submitted_at || d.started_at,
        });
      }
    }

    if (skill === "all" || skill === "writing") {
      for (const w of store.writing_submissions) {
        if (w.user_id !== userId) continue;
        all.push({
          id: w.id,
          kind: "writing",
          skill: "writing",
          title: `Writing ${w.task_type.replace("_", " ").toUpperCase()}`,
          subtitle: `${w.word_count} từ · ${w.prompt_text.slice(0, 65)}`,
          bandScore: w.overall_band,
          durationSeconds: Math.min(2400, Math.max(300, Math.round((w.word_count / 12) * 60))),
          completedAt: w.created_at,
          isPublic: w.is_public,
        });
      }
    }

    if (skill === "all" || skill === "speaking") {
      for (const s of store.speaking_submissions) {
        if (s.user_id !== userId) continue;
        all.push({
          id: s.id,
          kind: "speaking",
          skill: "speaking",
          title: `Speaking ${s.part.replace("_", " ").toUpperCase()}`,
          subtitle: s.prompt_text.slice(0, 75),
          bandScore: s.overall_band,
          durationSeconds: s.audio_duration_sec,
          completedAt: s.created_at,
          isPublic: s.is_public,
        });
      }
    }

    all.sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
    const total = all.length;
    return {
      items: all.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  if (!isValidUuid(userId)) {
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }
  const sb = await createSupabaseServerClient();
  if (!sb) {
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }

  // Single-table direct SQL pagination when filtered by a specific skill
  if (skill === "reading" || skill === "listening") {
    const { data, count } = await sb
      .from("test_attempts")
      .select(
        "id, skill, raw_score, max_score, band_score, duration_seconds, completed_at, ielts_tests(slug, title_vi)",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .eq("skill", skill)
      .order("completed_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const total = count ?? 0;
    const items: ProgressHistoryItem[] = (data ?? []).map((row) => {
      const joined = row.ielts_tests as { slug?: string; title_vi?: string } | null;
      const maxScore = Number(row.max_score ?? 40);
      return {
        id: String(row.id),
        kind: "test",
        skill: row.skill as IeltsSkill,
        title: String(joined?.title_vi ?? "IELTS Test"),
        subtitle: `${row.raw_score}/${maxScore} câu đúng`,
        testSlug: joined?.slug ? String(joined.slug) : undefined,
        rawScore: Number(row.raw_score ?? 0),
        maxScore,
        bandScore: maxScore >= 40 ? Number(row.band_score ?? 0) : null,
        durationSeconds: Number(row.duration_seconds ?? 0),
        completedAt: String(row.completed_at),
      };
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  if (skill === "writing") {
    const { data, count } = await sb
      .from("writing_submissions")
      .select("id, task_type, prompt_text, word_count, overall_band, is_public, created_at", {
        count: "exact",
      })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const total = count ?? 0;
    const items: ProgressHistoryItem[] = (data ?? []).map((row) => ({
      id: String(row.id),
      kind: "writing",
      skill: "writing",
      title: `Writing ${String(row.task_type).replace("_", " ").toUpperCase()}`,
      subtitle: `${row.word_count} từ · ${String(row.prompt_text ?? "").slice(0, 65)}`,
      bandScore: Number(row.overall_band ?? 0),
      durationSeconds: Math.min(
        2400,
        Math.max(300, Math.round((Number(row.word_count ?? 150) / 12) * 60))
      ),
      completedAt: String(row.created_at),
      isPublic: Boolean(row.is_public),
    }));
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  if (skill === "speaking") {
    const { data, count } = await sb
      .from("speaking_submissions")
      .select("id, part, prompt_text, audio_duration_sec, overall_band, is_public, created_at", {
        count: "exact",
      })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const total = count ?? 0;
    const items: ProgressHistoryItem[] = (data ?? []).map((row) => ({
      id: String(row.id),
      kind: "speaking",
      skill: "speaking",
      title: `Speaking ${String(row.part).replace("_", " ").toUpperCase()}`,
      subtitle: String(row.prompt_text ?? "").slice(0, 75),
      bandScore: Number(row.overall_band ?? 0),
      durationSeconds: Number(row.audio_duration_sec ?? 0),
      completedAt: String(row.created_at),
      isPublic: Boolean(row.is_public),
    }));
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  if (skill === "daily") {
    const { data, count } = await sb
      .from("daily_exam_attempts")
      .select(
        "id, raw_score, band_score, duration_seconds, submitted_at, started_at, daily_exams(exam_date, title_vi, ielts_tests(slug))",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .eq("is_completed", true)
      .order("submitted_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const total = count ?? 0;
    const items: ProgressHistoryItem[] = (data ?? []).map((row) => {
      const de = row.daily_exams as {
        exam_date?: string;
        title_vi?: string;
        ielts_tests?: { slug?: string } | null;
      } | null;
      return {
        id: String(row.id),
        kind: "daily",
        skill: "reading",
        title: de?.title_vi || `Đề thi mỗi ngày (${de?.exam_date ?? ""})`,
        subtitle: `${row.raw_score} câu đúng · Đề mỗi ngày`,
        testSlug: de?.ielts_tests?.slug,
        rawScore: Number(row.raw_score ?? 0),
        bandScore: Number(row.band_score ?? 0) > 0 ? Number(row.band_score) : null,
        durationSeconds: Number(row.duration_seconds ?? 0),
        completedAt: String(row.submitted_at || row.started_at),
      };
    });
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // "all" combined view: bounded top-N slice per indexed table (offset + pageSize) + exact totals
  const fetchLimit = offset + pageSize;
  const [attRes, dailyRes, wrRes, spRes] = await Promise.all([
    sb
      .from("test_attempts")
      .select(
        "id, skill, raw_score, max_score, band_score, duration_seconds, completed_at, ielts_tests(slug, title_vi)",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(fetchLimit),
    sb
      .from("daily_exam_attempts")
      .select(
        "id, raw_score, band_score, duration_seconds, submitted_at, started_at, daily_exams(exam_date, title_vi, ielts_tests(slug))",
        { count: "exact" }
      )
      .eq("user_id", userId)
      .eq("is_completed", true)
      .order("submitted_at", { ascending: false })
      .limit(fetchLimit),
    sb
      .from("writing_submissions")
      .select("id, task_type, prompt_text, word_count, overall_band, is_public, created_at", {
        count: "exact",
      })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit),
    sb
      .from("speaking_submissions")
      .select("id, part, prompt_text, audio_duration_sec, overall_band, is_public, created_at", {
        count: "exact",
      })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit),
  ]);

  const combined: ProgressHistoryItem[] = [
    ...(attRes.data ?? []).map((row) => {
      const joined = row.ielts_tests as { slug?: string; title_vi?: string } | null;
      const maxScore = Number(row.max_score ?? 40);
      return {
        id: String(row.id),
        kind: "test" as const,
        skill: row.skill as IeltsSkill,
        title: String(joined?.title_vi ?? "IELTS Test"),
        subtitle: `${row.raw_score}/${maxScore} câu đúng`,
        testSlug: joined?.slug ? String(joined.slug) : undefined,
        rawScore: Number(row.raw_score ?? 0),
        maxScore,
        bandScore: maxScore >= 40 ? Number(row.band_score ?? 0) : null,
        durationSeconds: Number(row.duration_seconds ?? 0),
        completedAt: String(row.completed_at),
      };
    }),
    ...(dailyRes.data ?? []).map((row) => {
      const de = row.daily_exams as {
        exam_date?: string;
        title_vi?: string;
        ielts_tests?: { slug?: string } | null;
      } | null;
      return {
        id: String(row.id),
        kind: "daily" as const,
        skill: "reading" as const,
        title: de?.title_vi || `Đề thi mỗi ngày (${de?.exam_date ?? ""})`,
        subtitle: `${row.raw_score} câu đúng · Đề mỗi ngày`,
        testSlug: de?.ielts_tests?.slug,
        rawScore: Number(row.raw_score ?? 0),
        bandScore: Number(row.band_score ?? 0) > 0 ? Number(row.band_score) : null,
        durationSeconds: Number(row.duration_seconds ?? 0),
        completedAt: String(row.submitted_at || row.started_at),
      };
    }),
    ...(wrRes.data ?? []).map((row) => ({
      id: String(row.id),
      kind: "writing" as const,
      skill: "writing" as const,
      title: `Writing ${String(row.task_type).replace("_", " ").toUpperCase()}`,
      subtitle: `${row.word_count} từ · ${String(row.prompt_text ?? "").slice(0, 65)}`,
      bandScore: Number(row.overall_band ?? 0),
      durationSeconds: Math.min(
        2400,
        Math.max(300, Math.round((Number(row.word_count ?? 150) / 12) * 60))
      ),
      completedAt: String(row.created_at),
      isPublic: Boolean(row.is_public),
    })),
    ...(spRes.data ?? []).map((row) => ({
      id: String(row.id),
      kind: "speaking" as const,
      skill: "speaking" as const,
      title: `Speaking ${String(row.part).replace("_", " ").toUpperCase()}`,
      subtitle: String(row.prompt_text ?? "").slice(0, 75),
      bandScore: Number(row.overall_band ?? 0),
      durationSeconds: Number(row.audio_duration_sec ?? 0),
      completedAt: String(row.created_at),
      isPublic: Boolean(row.is_public),
    })),
  ];

  combined.sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const total =
    (attRes.count ?? 0) +
    (dailyRes.count ?? 0) +
    (wrRes.count ?? 0) +
    (spRes.count ?? 0);

  return {
    items: combined.slice(offset, offset + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// =============================================================================
// 3. OWN-ONLY ATTEMPT REVIEW (Answers + Correct Keys + Explanations)
// =============================================================================
export async function getUserAttemptReview(
  userId: string,
  kind: "test" | "daily" | "writing" | "speaking",
  id: string
): Promise<ProgressAttemptReviewPayload | null> {
  const [allTests, conversionTable] = await Promise.all([
    kind === "test" || kind === "daily" ? getIeltsTests(true) : Promise.resolve([]),
    kind === "test" || kind === "daily"
      ? getBandConversionTables()
      : Promise.resolve([]),
  ]);

  if (!isSupabaseConfigured()) {
    const store = readStore();
    if (kind === "test") {
      const att = store.test_attempts.find(
        (a) => a.id === id && a.user_id === userId
      );
      if (!att) return null;
      const test = allTests.find(
        (t) => t.id === att.test_id || t.slug === att.test_slug
      );
      const graded = test
        ? gradeObjectiveTest(test, att.answers ?? {}, conversionTable)
        : null;
      const qPromptMap = new Map(
        (test?.sections ?? [])
          .flatMap((s) => s.questions)
          .map((q) => [q.id, q.prompt])
      );
      return {
        kind: "test",
        id: att.id,
        title: att.test_title,
        skill: att.skill,
        completedAt: att.completed_at,
        durationSeconds: att.duration_seconds,
        rawScore: att.raw_score,
        maxScore: att.max_score,
        bandScore: att.max_score >= 40 ? att.band_score : null,
        testSlug: att.test_slug,
        breakdownByType: att.breakdown_by_type,
        questionDetails: graded?.details.map((d) => ({
          questionId: d.questionId,
          number: d.number,
          type: d.type,
          prompt: qPromptMap.get(d.questionId) ?? "",
          userAnswer: d.userAnswer,
          acceptedAnswers: d.acceptedAnswers,
          isCorrect: d.isCorrect,
          explanationVi: d.explanation_vi,
          explanationEn: d.explanation_en,
          sectionRef: d.sectionRef,
        })),
      };
    }

    if (kind === "daily") {
      const d = store.daily_exam_attempts.find(
        (a) => a.id === id && a.user_id === userId
      );
      if (!d) return null;
      const test = allTests.find((t) => t.slug === d.test_slug);
      const sprintTest =
        test && test.sections.length > 0
          ? { ...test, sections: [test.sections[0]] }
          : test;
      const graded = sprintTest
        ? gradeObjectiveTest(sprintTest, d.answers ?? {}, conversionTable)
        : null;
      const qPromptMap = new Map(
        (sprintTest?.sections ?? [])
          .flatMap((s) => s.questions)
          .map((q) => [q.id, q.prompt])
      );
      return {
        kind: "daily",
        id: d.id,
        title: `Đề thi mỗi ngày (${d.exam_date})`,
        skill: sprintTest?.skill ?? "reading",
        completedAt: d.submitted_at || d.started_at,
        durationSeconds: d.duration_seconds,
        rawScore: d.raw_score,
        maxScore: d.max_score,
        bandScore: d.band_score > 0 ? d.band_score : null,
        testSlug: d.test_slug,
        breakdownByType: graded?.breakdownByType ?? d.breakdown_by_type,
        questionDetails: graded?.details.map((det) => ({
          questionId: det.questionId,
          number: det.number,
          type: det.type,
          prompt: qPromptMap.get(det.questionId) ?? "",
          userAnswer: det.userAnswer,
          acceptedAnswers: det.acceptedAnswers,
          isCorrect: det.isCorrect,
          explanationVi: det.explanation_vi,
          explanationEn: det.explanation_en,
          sectionRef: det.sectionRef,
        })),
      };
    }

    if (kind === "writing") {
      const w = store.writing_submissions.find(
        (s) => s.id === id && s.user_id === userId
      );
      if (!w) return null;
      return {
        kind: "writing",
        id: w.id,
        title: `Writing ${w.task_type.replace("_", " ").toUpperCase()}`,
        skill: "writing",
        completedAt: w.created_at,
        durationSeconds: Math.min(2400, Math.max(300, Math.round((w.word_count / 12) * 60))),
        bandScore: w.overall_band,
        writingReview: {
          taskType: w.task_type,
          promptText: w.prompt_text,
          essayText: w.essay_text,
          wordCount: w.word_count,
          isPublic: w.is_public,
          summaryVi: w.evaluation.summaryVi,
          criteria: {
            taskResponse: {
              band: w.evaluation.criteria.taskResponse.band,
              feedbackVi: w.evaluation.criteria.taskResponse.feedbackVi,
            },
            coherenceCohesion: {
              band: w.evaluation.criteria.coherenceCohesion.band,
              feedbackVi: w.evaluation.criteria.coherenceCohesion.feedbackVi,
            },
            lexicalResource: {
              band: w.evaluation.criteria.lexicalResource.band,
              feedbackVi: w.evaluation.criteria.lexicalResource.feedbackVi,
            },
            grammaticalRange: {
              band: w.evaluation.criteria.grammaticalRange.band,
              feedbackVi: w.evaluation.criteria.grammaticalRange.feedbackVi,
            },
          },
          band8Rewrite: w.evaluation.band8Rewrite,
        },
      };
    }

    const sp = store.speaking_submissions.find(
      (s) => s.id === id && s.user_id === userId
    );
    if (!sp) return null;
    return {
      kind: "speaking",
      id: sp.id,
      title: `Speaking ${sp.part.replace("_", " ").toUpperCase()}`,
      skill: "speaking",
      completedAt: sp.created_at,
      durationSeconds: sp.audio_duration_sec,
      bandScore: sp.overall_band,
      speakingReview: {
        part: sp.part,
        promptText: sp.prompt_text,
        transcript: sp.transcript,
        isPublic: sp.is_public,
        criteria: sp.evaluation.criteria,
        improvedAnswer: sp.evaluation.improvedAnswer,
      },
    };
  }

  if (!isValidUuid(userId) || !isValidUuid(id)) return null;
  const sb = await createSupabaseServerClient();
  if (!sb) return null;

  if (kind === "test") {
    const { data } = await sb
      .from("test_attempts")
      .select("*, ielts_tests(id, slug, title_vi)")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return null;
    const joined = data.ielts_tests as {
      id?: string;
      slug?: string;
      title_vi?: string;
    } | null;
    const test = allTests.find(
      (t) => t.id === String(data.test_id) || t.slug === joined?.slug
    );
    const answers = (data.answers as Record<string, string>) ?? {};
    const graded = test
      ? gradeObjectiveTest(test, answers, conversionTable)
      : null;
    const qPromptMap = new Map(
      (test?.sections ?? [])
        .flatMap((s) => s.questions)
        .map((q) => [q.id, q.prompt])
    );
    const maxScore = Number(data.max_score ?? 40);
    return {
      kind: "test",
      id: String(data.id),
      title: String(joined?.title_vi ?? "IELTS Test"),
      skill: data.skill as IeltsSkill,
      completedAt: String(data.completed_at),
      durationSeconds: Number(data.duration_seconds ?? 0),
      rawScore: Number(data.raw_score ?? 0),
      maxScore,
      bandScore: maxScore >= 40 ? Number(data.band_score ?? 0) : null,
      testSlug: joined?.slug,
      breakdownByType:
        (data.breakdown_by_type as Record<
          string,
          { correct: number; total: number }
        >) ?? {},
      questionDetails: graded?.details.map((d) => ({
        questionId: d.questionId,
        number: d.number,
        type: d.type,
        prompt: qPromptMap.get(d.questionId) ?? "",
        userAnswer: d.userAnswer,
        acceptedAnswers: d.acceptedAnswers,
        isCorrect: d.isCorrect,
        explanationVi: d.explanation_vi,
        explanationEn: d.explanation_en,
        sectionRef: d.sectionRef,
      })),
    };
  }

  if (kind === "daily") {
    const { data } = await sb
      .from("daily_exam_attempts")
      .select("*, daily_exams(exam_date, title_vi, test_id, ielts_tests(slug))")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return null;
    const de = data.daily_exams as {
      exam_date?: string;
      title_vi?: string;
      test_id?: string;
      ielts_tests?: { slug?: string } | null;
    } | null;
    const test = allTests.find(
      (t) => t.id === de?.test_id || t.slug === de?.ielts_tests?.slug
    );
    const sprintTest =
      test && test.sections.length > 0
        ? { ...test, sections: [test.sections[0]] }
        : test;
    const answers = (data.answers as Record<string, string>) ?? {};
    const graded = sprintTest
      ? gradeObjectiveTest(sprintTest, answers, conversionTable)
      : null;
    const qPromptMap = new Map(
      (sprintTest?.sections ?? [])
        .flatMap((s) => s.questions)
        .map((q) => [q.id, q.prompt])
    );
    return {
      kind: "daily",
      id: String(data.id),
      title: de?.title_vi || `Đề thi mỗi ngày (${de?.exam_date ?? ""})`,
      skill: sprintTest?.skill ?? "reading",
      completedAt: String(data.submitted_at || data.started_at),
      durationSeconds: Number(data.duration_seconds ?? 0),
      rawScore: Number(data.raw_score ?? 0),
      maxScore: graded?.maxScore ?? 10,
      bandScore: Number(data.band_score ?? 0) > 0 ? Number(data.band_score) : null,
      testSlug: de?.ielts_tests?.slug,
      breakdownByType: graded?.breakdownByType,
      questionDetails: graded?.details.map((d) => ({
        questionId: d.questionId,
        number: d.number,
        type: d.type,
        prompt: qPromptMap.get(d.questionId) ?? "",
        userAnswer: d.userAnswer,
        acceptedAnswers: d.acceptedAnswers,
        isCorrect: d.isCorrect,
        explanationVi: d.explanation_vi,
        explanationEn: d.explanation_en,
        sectionRef: d.sectionRef,
      })),
    };
  }

  if (kind === "writing") {
    const { data } = await sb
      .from("writing_submissions")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return null;
    const ev = data.evaluation_json as WritingEvaluation;
    return {
      kind: "writing",
      id: String(data.id),
      title: `Writing ${String(data.task_type).replace("_", " ").toUpperCase()}`,
      skill: "writing",
      completedAt: String(data.created_at),
      durationSeconds: Math.min(
        2400,
        Math.max(300, Math.round((Number(data.word_count ?? 150) / 12) * 60))
      ),
      bandScore: Number(data.overall_band ?? 0),
      writingReview: {
        taskType: String(data.task_type),
        promptText: String(data.prompt_text),
        essayText: String(data.essay_text),
        wordCount: Number(data.word_count ?? 0),
        isPublic: Boolean(data.is_public),
        summaryVi: ev?.summaryVi ?? "",
        criteria: {
          taskResponse: {
            band: ev?.criteria?.taskResponse?.band ?? 0,
            feedbackVi: ev?.criteria?.taskResponse?.feedbackVi ?? "",
          },
          coherenceCohesion: {
            band: ev?.criteria?.coherenceCohesion?.band ?? 0,
            feedbackVi: ev?.criteria?.coherenceCohesion?.feedbackVi ?? "",
          },
          lexicalResource: {
            band: ev?.criteria?.lexicalResource?.band ?? 0,
            feedbackVi: ev?.criteria?.lexicalResource?.feedbackVi ?? "",
          },
          grammaticalRange: {
            band: ev?.criteria?.grammaticalRange?.band ?? 0,
            feedbackVi: ev?.criteria?.grammaticalRange?.feedbackVi ?? "",
          },
        },
        band8Rewrite: ev?.band8Rewrite ?? "",
      },
    };
  }

  const { data } = await sb
    .from("speaking_submissions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const ev = data.evaluation_json as SpeakingEvaluation;
  return {
    kind: "speaking",
    id: String(data.id),
    title: `Speaking ${String(data.part).replace("_", " ").toUpperCase()}`,
    skill: "speaking",
    completedAt: String(data.created_at),
    durationSeconds: Number(data.audio_duration_sec ?? 0),
    bandScore: Number(data.overall_band ?? 0),
    speakingReview: {
      part: String(data.part),
      promptText: String(data.prompt_text),
      transcript: String(data.transcript ?? ""),
      isPublic: Boolean(data.is_public),
      criteria: ev?.criteria,
      improvedAnswer: ev?.improvedAnswer ?? "",
    },
  };
}

// =============================================================================
// 4. CLEAR OWN LEARNING HISTORY (Strict self-only privacy control)
// =============================================================================
export async function clearUserLearningHistory(
  userId: string,
  scope: "all" | "tests" | "writing" | "speaking" | "daily" = "all"
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      if (scope === "all" || scope === "tests") {
        store.test_attempts = store.test_attempts.filter((a) => a.user_id !== userId);
        store.test_attempt_answers = (store.test_attempt_answers ?? []).filter(
          (a) => a.user_id !== userId
        );
      }
      if (scope === "all" || scope === "writing") {
        store.writing_submissions = store.writing_submissions.filter(
          (w) => w.user_id !== userId
        );
      }
      if (scope === "all" || scope === "speaking") {
        store.speaking_submissions = store.speaking_submissions.filter(
          (s) => s.user_id !== userId
        );
      }
      if (scope === "all" || scope === "daily") {
        store.daily_exam_attempts = store.daily_exam_attempts.filter(
          (d) => d.user_id !== userId
        );
      }
      if (scope === "all") {
        const prof = store.profiles.find((p) => p.id === userId);
        if (prof) {
          prof.streak_count = 0;
          prof.last_active_date = null;
        }
      }
    });
    return { ok: true };
  }

  if (!isValidUuid(userId)) {
    return { ok: false, error: "Phiên đăng nhập không hợp lệ." };
  }

  const sb = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const client = sb ?? admin;
  if (!client) {
    return { ok: false, error: "Không thể kết nối cơ sở dữ liệu." };
  }

  try {
    if (scope === "all" || scope === "tests") {
      await client.from("test_attempts").delete().eq("user_id", userId);
      // test_attempt_answers cascades on FK delete; extra best-effort cleanup
      try {
        await client.from("test_attempt_answers").delete().eq("user_id", userId);
      } catch {
        // ignore if table not migrated yet
      }
    }
    if (scope === "all" || scope === "writing") {
      await client.from("writing_submissions").delete().eq("user_id", userId);
    }
    if (scope === "all" || scope === "speaking") {
      await client.from("speaking_submissions").delete().eq("user_id", userId);
    }
    if (scope === "all" || scope === "daily") {
      await (admin ?? client)
        .from("daily_exam_attempts")
        .delete()
        .eq("user_id", userId);
    }
    if (scope === "all" && admin) {
      await admin
        .from("profiles")
        .update({ streak_count: 0, last_active_date: null })
        .eq("id", userId);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Không thể xóa lịch sử học tập lúc này." };
  }
}

// =============================================================================
// 5. ADMIN ANONYMOUS AGGREGATE ANALYTICS (Zero PII — never returns user_id/email)
// =============================================================================
export async function getAdminAnonymousAnalytics(): Promise<AdminAnonymousAnalyticsPayload> {
  const allTests = await getIeltsTests(true);
  const testMap = new Map(allTests.map((t) => [t.id, t]));
  const testSlugMap = new Map(allTests.map((t) => [t.slug, t]));

  const testAgg = new Map<
    string,
    {
      testId: string;
      testSlug: string;
      testTitle: string;
      skill: IeltsSkill;
      attemptCount: number;
      accuracySum: number;
      bandSum: number;
      bandCount: number;
    }
  >();

  const questionAgg = new Map<
    string,
    {
      testId: string;
      questionNumber: number;
      questionType: string;
      total: number;
      wrong: number;
    }
  >();

  const typeAgg = new Map<string, { total: number; wrong: number }>();

  let totalTestAttempts = 0;
  let totalDailyAttempts = 0;
  let totalWriting = 0;
  let totalSpeaking = 0;
  let trackedAnswers = 0;
  let answerTableReady = true;

  if (!isSupabaseConfigured()) {
    const store = readStore();
    totalTestAttempts = store.test_attempts.length;
    totalDailyAttempts = store.daily_exam_attempts.filter((d) => d.is_completed).length;
    totalWriting = store.writing_submissions.length;
    totalSpeaking = store.speaking_submissions.length;

    for (const a of store.test_attempts) {
      const t = testMap.get(a.test_id) ?? testSlugMap.get(a.test_slug);
      const key = t?.id ?? a.test_id;
      const cur = testAgg.get(key) ?? {
        testId: key,
        testSlug: t?.slug ?? a.test_slug,
        testTitle: t?.title_vi ?? a.test_title,
        skill: a.skill,
        attemptCount: 0,
        accuracySum: 0,
        bandSum: 0,
        bandCount: 0,
      };
      cur.attemptCount += 1;
      cur.accuracySum += a.max_score > 0 ? (a.raw_score / a.max_score) * 100 : 0;
      if (a.max_score >= 40 && a.band_score > 0) {
        cur.bandSum += a.band_score;
        cur.bandCount += 1;
      }
      testAgg.set(key, cur);
    }

    const ansRows = store.test_attempt_answers ?? [];
    trackedAnswers = ansRows.length;
    for (const r of ansRows) {
      const qKey = `${r.test_id}#${r.question_number}`;
      const qCur = questionAgg.get(qKey) ?? {
        testId: r.test_id,
        questionNumber: r.question_number,
        questionType: r.question_type,
        total: 0,
        wrong: 0,
      };
      qCur.total += 1;
      if (!r.is_correct) qCur.wrong += 1;
      questionAgg.set(qKey, qCur);

      const tCur = typeAgg.get(r.question_type) ?? { total: 0, wrong: 0 };
      tCur.total += 1;
      if (!r.is_correct) tCur.wrong += 1;
      typeAgg.set(r.question_type, tCur);
    }
  } else {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const [attRes, dailyRes, wrRes, spRes, ansRes] = await Promise.all([
        admin
          .from("test_attempts")
          .select("test_id, skill, raw_score, max_score, band_score, breakdown_by_type", {
            count: "exact",
          })
          .order("completed_at", { ascending: false })
          .limit(2000),
        admin
          .from("daily_exam_attempts")
          .select("id", { count: "exact", head: true })
          .eq("is_completed", true),
        admin
          .from("writing_submissions")
          .select("id", { count: "exact", head: true }),
        admin
          .from("speaking_submissions")
          .select("id", { count: "exact", head: true }),
        admin
          .from("test_attempt_answers")
          .select("test_id, question_number, question_type, is_correct", {
            count: "exact",
          })
          .limit(5000),
      ]);

      totalTestAttempts = attRes.count ?? (attRes.data?.length ?? 0);
      totalDailyAttempts = dailyRes.count ?? 0;
      totalWriting = wrRes.count ?? 0;
      totalSpeaking = spRes.count ?? 0;

      for (const a of attRes.data ?? []) {
        const tid = String(a.test_id);
        const t = testMap.get(tid);
        const cur = testAgg.get(tid) ?? {
          testId: tid,
          testSlug: t?.slug ?? "",
          testTitle: t?.title_vi ?? "IELTS Test",
          skill: (a.skill as IeltsSkill) ?? "reading",
          attemptCount: 0,
          accuracySum: 0,
          bandSum: 0,
          bandCount: 0,
        };
        const maxS = Number(a.max_score ?? 40);
        const rawS = Number(a.raw_score ?? 0);
        const bandS = Number(a.band_score ?? 0);
        cur.attemptCount += 1;
        cur.accuracySum += maxS > 0 ? (rawS / maxS) * 100 : 0;
        if (maxS >= 40 && bandS > 0) {
          cur.bandSum += bandS;
          cur.bandCount += 1;
        }
        testAgg.set(tid, cur);
      }

      if (ansRes.error) {
        answerTableReady = false;
        // Fallback question-type overview from test_attempts.breakdown_by_type
        for (const a of attRes.data ?? []) {
          const br = (a.breakdown_by_type as Record<string, { correct: number; total: number }>) ?? {};
          for (const [qt, st] of Object.entries(br)) {
            const tCur = typeAgg.get(qt) ?? { total: 0, wrong: 0 };
            tCur.total += st.total;
            tCur.wrong += Math.max(0, st.total - st.correct);
            typeAgg.set(qt, tCur);
          }
        }
      } else {
        trackedAnswers = ansRes.count ?? (ansRes.data?.length ?? 0);
        for (const r of ansRes.data ?? []) {
          const tid = String(r.test_id);
          const qNum = Number(r.question_number);
          const qt = String(r.question_type || "unknown");
          const qKey = `${tid}#${qNum}`;
          const qCur = questionAgg.get(qKey) ?? {
            testId: tid,
            questionNumber: qNum,
            questionType: qt,
            total: 0,
            wrong: 0,
          };
          qCur.total += 1;
          if (!r.is_correct) qCur.wrong += 1;
          questionAgg.set(qKey, qCur);

          const tCur = typeAgg.get(qt) ?? { total: 0, wrong: 0 };
          tCur.total += 1;
          if (!r.is_correct) tCur.wrong += 1;
          typeAgg.set(qt, tCur);
        }
      }
    }
  }

  const topTests = Array.from(testAgg.values())
    .sort((a, b) => b.attemptCount - a.attemptCount)
    .slice(0, 15)
    .map((t) => ({
      testId: t.testId,
      testSlug: t.testSlug,
      testTitle: t.testTitle,
      skill: t.skill,
      attemptCount: t.attemptCount,
      avgAccuracyPercent: Math.round(t.accuracySum / Math.max(1, t.attemptCount)),
      avgBand:
        t.bandCount > 0 ? Math.round((t.bandSum / t.bandCount) * 10) / 10 : null,
    }));

  const hardestQuestions = Array.from(questionAgg.values())
    .filter((q) => q.total >= 1 && q.wrong > 0)
    .map((q) => {
      const test = testMap.get(q.testId);
      const qObj = test?.sections
        .flatMap((s) => s.questions)
        .find((item) => item.number === q.questionNumber);
      return {
        testId: q.testId,
        testSlug: test?.slug ?? "",
        testTitle: test?.title_vi ?? "IELTS Test",
        skill: test?.skill ?? ("reading" as IeltsSkill),
        questionNumber: q.questionNumber,
        questionType: q.questionType,
        promptSnippet: (qObj?.prompt ?? "").slice(0, 110),
        totalAnswers: q.total,
        wrongAnswers: q.wrong,
        wrongRatePercent: Math.round((q.wrong / q.total) * 100),
      };
    })
    .sort(
      (a, b) =>
        b.wrongRatePercent - a.wrongRatePercent || b.wrongAnswers - a.wrongAnswers
    )
    .slice(0, 20);

  const questionTypeOverview = Array.from(typeAgg.entries())
    .filter(([, st]) => st.total > 0)
    .map(([type, st]) => ({
      type,
      labelVi: getQuestionTypeLabel(type, false),
      totalAnswers: st.total,
      wrongAnswers: st.wrong,
      wrongRatePercent: Math.round((st.wrong / st.total) * 100),
    }))
    .sort((a, b) => b.wrongRatePercent - a.wrongRatePercent);

  return {
    totals: {
      testAttempts: totalTestAttempts,
      dailyExamAttempts: totalDailyAttempts,
      writingSubmissions: totalWriting,
      speakingSubmissions: totalSpeaking,
      trackedAnswers,
    },
    topTests,
    hardestQuestions,
    questionTypeOverview,
    answerTableReady,
  };
}
