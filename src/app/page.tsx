import React from "react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  GraduationCap,
  Headphones,
  Languages,
  MessageSquare,
  Mic,
  PenTool,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  Wand2,
} from "lucide-react";
import {
  getBlogPosts,
  getConversationTopics,
  getCourses,
  getDailyExamState,
  getDictationLessons,
  getIeltsTests,
  getLearnVideos,
  getPronunciationSounds,
  getSampleTestimonials,
  getWritingExercises,
} from "@/lib/db";
import { getVietnamDateString, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TestimonialsCarousel } from "@/components/testimonials-carousel";
import { HorizontalCarouselSection } from "@/components/horizontal-carousel";

const SKILL_META = {
  reading: { label: "Reading", icon: BookOpen, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  listening: { label: "Listening", icon: Headphones, tone: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  writing: { label: "Writing", icon: PenTool, tone: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  speaking: { label: "Speaking", icon: Mic, tone: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
} as const;

const LEARNING_TOOLS = [
  {
    href: "/band-calculator",
    icon: Calculator,
    titleVi: "Tính điểm Band IELTS",
    titleEn: "Band Score Calculator",
    descVi: "Quy đổi điểm Reading/Listening & làm tròn Overall chuẩn",
    descEn: "Official rounding & Academic/General raw conversions",
  },
  {
    href: "/tools/paraphraser",
    icon: RefreshCw,
    titleVi: "Paraphraser học thuật",
    titleEn: "Academic Paraphraser",
    descVi: "Diễn đạt lại câu sang phong cách học thuật Band 8+",
    descEn: "Rewrite sentences into natural academic style",
  },
  {
    href: "/tools/summarizer",
    icon: FileText,
    titleVi: "Tóm tắt văn bản AI",
    titleEn: "AI Summarizer",
    descVi: "Rút gọn bài đọc dài thành ý chính rõ ràng",
    descEn: "Distill long passages into clear key takeaways",
  },
  {
    href: "/tools/translator",
    icon: Languages,
    titleVi: "Dịch thuật Anh ⇄ Việt",
    titleEn: "EN ⇄ VI Translator",
    descVi: "Dịch sát ngữ cảnh IELTS kèm giải thích cụm từ",
    descEn: "Context-aware IELTS translation with collocations",
  },
  {
    href: "/tools/grammar-checker",
    icon: CheckCircle2,
    titleVi: "Kiểm tra ngữ pháp",
    titleEn: "Grammar Checker",
    descVi: "Phát hiện lỗi thì, mạo từ, chia động từ & giải thích VI",
    descEn: "Spot tense, article & agreement errors with notes",
  },
  {
    href: "/tools/grammar-corrector",
    icon: Wand2,
    titleVi: "Sửa lỗi ngữ pháp nhanh",
    titleEn: "Grammar Corrector",
    descVi: "Trả về phiên bản sạch lỗi giữ trọn ý gốc của bạn",
    descEn: "Clean, error-free version preserving your intent",
  },
  {
    href: "/tools/text-improver",
    icon: Sparkles,
    titleVi: "Nâng cấp đoạn văn",
    titleEn: "Text Improver",
    descVi: "Nâng cấp từ vựng, liên kết câu & sắc thái học thuật",
    descEn: "Elevate vocabulary, flow, and academic register",
  },
  {
    href: "/tools/complex-sentence-explainer",
    icon: BookOpen,
    titleVi: "Giải thích câu phức",
    titleEn: "Complex Sentence Explainer",
    descVi: "Phân tích mệnh đề quan hệ, đảo ngữ, phân từ bằng tiếng Việt",
    descEn: "Break down clauses, inversion & grammar structures",
  },
  {
    href: "/tools/text-to-speech",
    icon: Volume2,
    titleVi: "Chuyển văn bản thành giọng nói",
    titleEn: "Text-to-Speech (UK/US)",
    descVi: "Nghe phát âm chuẩn giọng Anh – Mỹ với tốc độ tùy chỉnh",
    descEn: "Listen to natural UK/US voices at your own pace",
  },
  {
    href: "/mentor",
    icon: GraduationCap,
    titleVi: "Mentor Ôn IELTS AI",
    titleEn: "Mentor Ôn IELTS AI",
    descVi: "Trợ lý tiếng Việt lập lộ trình học cá nhân theo mục tiêu",
    descEn: "Vietnamese AI coach building your custom study plan",
  },
];

export default async function HomePage() {
  const vnToday = getVietnamDateString();
  const [
    t,
    locale,
    publishedTests,
    dailyState,
    courses,
    conversationTopics,
    writingExercises,
    pronunciationSounds,
    dictationLessons,
    learnVideos,
    sampleTestimonials,
    publishedBlogPosts,
  ] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    getIeltsTests(false),
    getDailyExamState(vnToday, null),
    getCourses(),
    getConversationTopics(false),
    getWritingExercises(),
    getPronunciationSounds(),
    getDictationLessons(),
    getLearnVideos(),
    getSampleTestimonials(),
    getBlogPosts(false),
  ]);
  const isEn = locale === "en";

  const latestTests = publishedTests.slice(0, 4);
  const featuredBlogPosts = [...publishedBlogPosts]
    .sort((a, b) => {
      if (Boolean(a.is_featured) !== Boolean(b.is_featured)) {
        return a.is_featured ? -1 : 1;
      }
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    })
    .slice(0, 6);
  const totalObjectiveQuestions = publishedTests.reduce(
    (sum, item) => sum + item.sections.reduce((sAcc, sec) => sAcc + sec.questions.length, 0),
    0
  );
  const topDaily = dailyState.leaderboard.slice(0, 3);

  return (
    <div className="pb-12">
      {/* 1. HERO SECTION */}
      <section className="border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-6">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.12] dark:text-white">
                {t("heroTitle")}
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
                {t("heroSubtitle")}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link href="/pricing">
                  <Button size="lg" id="hero-premium-cta">
                    {t("ctaPrimary")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/tests">
                  <Button variant="outline" size="lg" id="hero-free-test-cta">
                    {t("ctaSecondary")}
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEn
                  ? "Tip: Highlight any English word on this platform to save it instantly to your Flashcards."
                  : "Mẹo hay: Bôi đen bất kỳ từ tiếng Anh nào trên trang để lưu nhanh vào bộ Flashcard có IPA & nghĩa tiếng Việt."}
              </p>
            </div>

            {/* Honest, dynamically computed platform metrics */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white p-4 shadow-xs dark:bg-slate-950">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {publishedTests.length} {isEn ? "tests" : "đề thi"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t("stats.tests")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-xs dark:bg-slate-950">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {totalObjectiveQuestions} {isEn ? "Q" : "câu"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t("stats.questions")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-xs dark:bg-slate-950">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {LEARNING_TOOLS.length}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t("stats.tools")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-xs dark:bg-slate-950">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      40 {isEn ? "Q/test" : "câu/đề"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t("stats.fullFormat")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-600 px-4 py-3 text-white">
                  <div>
                    <p className="text-xs font-medium text-emerald-100">
                      {isEn ? "Quick Practice Entry" : "Bắt đầu nhanh trong 1 phút"}
                    </p>
                    <p className="text-sm font-bold">
                      {isEn ? "AI Writing & Speaking Scoring" : "Chấm thử Writing & Speaking bằng AI"}
                    </p>
                  </div>
                  <Link
                    href="/writing"
                    className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                  >
                    {isEn ? "Try now" : "Thử ngay"}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ILLUSTRATIVE STUDY JOURNEYS (CLEARLY LABELED EXAMPLES) */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-7">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t("testimonialsTitle")}
            </h2>
            <Badge variant="secondary">
              {isEn ? "Illustrative Examples" : "Dữ liệu ví dụ minh họa"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t("testimonialsSubtitle")}
          </p>
        </div>
        <TestimonialsCarousel items={sampleTestimonials} locale={locale} />
      </section>

      {/* 3. LATEST IELTS TESTS (Reading, Listening, Writing, Speaking) */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t("latestTestsTitle")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t("latestTestsSubtitle")}
            </p>
          </div>
          <Link
            href="/tests"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {t("viewAll")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {latestTests.map((test) => {
            const meta = SKILL_META[test.skill];
            const Icon = meta.icon;
            return (
              <Card
                key={test.id}
                className="flex flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${meta.tone}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {test.duration_minutes}m
                    </span>
                  </div>
                  <h3 className="mt-3.5 text-base font-bold leading-snug text-slate-900 dark:text-white">
                    {isEn ? test.title_en : test.title_vi}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {isEn ? test.description_en : test.description_vi}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {test.module === "academic" ? "Academic" : "General"}
                  </span>
                  <Link
                    href={
                      test.skill === "writing"
                        ? "/writing"
                        : test.skill === "speaking"
                        ? "/speaking"
                        : `/tests/${test.slug}`
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                  >
                    {t("startTest")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 4. DAILY EXAMS & LEADERBOARDS CTA */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-emerald-200/80 bg-emerald-900 text-white shadow-sm dark:border-emerald-900">
          <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                <Flame className="h-3.5 w-3.5 text-amber-300" />
                <span>
                  {isEn ? `Vietnam Date (UTC+7): ${vnToday}` : `Ngày thi Việt Nam (UTC+7): ${vnToday}`}
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t("dailyCtaTitle")}
              </h2>
              <p className="text-sm leading-relaxed text-emerald-100/90 sm:text-base">
                {t("dailyCtaSubtitle")}
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/daily-exam">
                  <Button
                    size="lg"
                    className="bg-white text-emerald-900 hover:bg-emerald-50"
                  >
                    {t("dailyCtaButton")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/leaderboard">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-emerald-400/50 bg-transparent text-white hover:bg-white/10"
                  >
                    <Trophy className="h-4 w-4 text-amber-300" />
                    {t("leaderboardButton")}
                  </Button>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-100">
                  <span>{isEn ? "Today's Top Scorers" : "Top dẫn đầu hôm nay"}</span>
                  <span>{isEn ? "Score · Time" : "Điểm · Thời gian"}</span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {topDaily.length === 0 ? (
                    <div className="rounded-xl bg-white/10 px-4 py-4 text-xs text-emerald-100/90">
                      {isEn
                        ? "No submissions yet today. Take today's 15-minute sprint to claim the #1 spot!"
                        : "Chưa có thí sinh nộp bài hôm nay. Hãy tham gia thử thách 15 phút để trở thành người dẫn đầu đầu tiên!"}
                    </div>
                  ) : (
                    topDaily.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-xl bg-white/10 px-3.5 py-2.5 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-300/20 text-xs font-bold text-amber-200">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold">{entry.display_name}</span>
                        </div>
                        <span className="text-xs font-medium text-emerald-100">
                          {entry.raw_score}/{entry.max_score} · {formatDuration(entry.duration_seconds)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. LEARNING TOOLS GRID */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t("toolsTitle")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t("toolsSubtitle")}
            </p>
          </div>
          <Link
            href="/tools"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {t("viewAll")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {LEARNING_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.href} href={tool.href} className="group">
                <Card className="h-full p-4 transition hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-700">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950 dark:text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                    {isEn ? tool.titleEn : tool.titleVi}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {isEn ? tool.descEn : tool.descVi}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 6A. COURSES CAROUSEL */}
      <HorizontalCarouselSection
        title={t("coursesTitle")}
        subtitle={t("coursesSubtitle")}
        viewAllHref="/courses"
        viewAllLabel={t("viewAll")}
      >
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/courses/${course.slug}`}
            className="min-w-[290px] max-w-[330px] shrink-0 snap-start"
          >
            <Card className="h-full p-5 transition hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <Badge>Target {course.target_band}</Badge>
                <span className="text-xs text-slate-500">
                  {course.lessons.length} {isEn ? "lessons" : "bài học"}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                {isEn ? course.title_en : course.title_vi}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {isEn ? course.description_en : course.description_vi}
              </p>
              <div className="mt-4 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {course.level} · {course.duration_hours}h →
              </div>
            </Card>
          </Link>
        ))}
      </HorizontalCarouselSection>

      {/* 6B. AI CONVERSATIONS CAROUSEL */}
      <HorizontalCarouselSection
        title={t("conversationsTitle")}
        subtitle={t("conversationsSubtitle")}
        viewAllHref="/conversations"
        viewAllLabel={t("viewAll")}
      >
        {conversationTopics.map((topic) => (
          <Link
            key={topic.slug}
            href={`/conversations?topic=${topic.slug}`}
            className="min-w-[260px] max-w-[290px] shrink-0 snap-start"
          >
            <Card className="h-full p-5 transition hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{topic.part}</Badge>
                <MessageSquare className="h-4 w-4 text-emerald-600" />
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                {isEn ? topic.title_en : topic.title_vi}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {isEn ? topic.description_en : topic.description_vi}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {topic.suggestedVocab.slice(0, 2).map((v) => (
                  <span
                    key={v}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </HorizontalCarouselSection>

      {/* 6C. WRITING IMPROVEMENT EXERCISES CAROUSEL */}
      <HorizontalCarouselSection
        title={t("writingExercisesTitle")}
        subtitle={t("writingExercisesSubtitle")}
        viewAllHref="/writing/exercises"
        viewAllLabel={t("viewAll")}
      >
        {writingExercises.map((ex) => (
          <Link
            key={ex.id}
            href={`/writing/exercises?slug=${ex.slug}`}
            className="min-w-[300px] max-w-[340px] shrink-0 snap-start"
          >
            <Card className="h-full p-5 transition hover:border-emerald-300 hover:shadow-md">
              <Badge>{ex.topic}</Badge>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                {isEn ? ex.title_en : ex.title_vi}
              </h3>
              <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs italic text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                “{ex.sentences[0]?.weakSentence}”
              </p>
              <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {ex.sentences.length} {isEn ? "guided sentences" : "câu thực hành"} · {ex.targetSkill}
              </p>
            </Card>
          </Link>
        ))}
      </HorizontalCarouselSection>

      {/* 6D. PRONUNCIATION (IPA SOUND CHIPS) */}
      <HorizontalCarouselSection
        title={t("pronunciationTitle")}
        subtitle={t("pronunciationSubtitle")}
        viewAllHref="/pronunciation"
        viewAllLabel={t("viewAll")}
      >
        {pronunciationSounds.map((sound) => (
          <Link
            key={sound.slug}
            href={`/pronunciation/${sound.slug}`}
            className="min-w-[165px] shrink-0 snap-start"
          >
            <Card className="h-full p-4 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {sound.symbol}
              </div>
              <p className="mt-2.5 text-sm font-bold text-slate-900 dark:text-white">
                {sound.examples[0]?.word}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {sound.examples[0]?.ipa}
              </p>
            </Card>
          </Link>
        ))}
      </HorizontalCarouselSection>

      {/* 6E. DICTATION & SHADOWING CAROUSEL */}
      <HorizontalCarouselSection
        title={t("dictationTitle")}
        subtitle={t("dictationSubtitle")}
        viewAllHref="/dictation"
        viewAllLabel={t("viewAll")}
      >
        {dictationLessons.map((lesson) => (
          <Link
            key={lesson.id}
            href={`/dictation?lesson=${lesson.slug}`}
            className="min-w-[290px] max-w-[330px] shrink-0 snap-start"
          >
            <Card className="h-full p-5 transition hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{lesson.category}</Badge>
                <span className="text-xs font-semibold text-slate-500">{lesson.accent}</span>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                {isEn ? lesson.title_en : lesson.title_vi}
              </h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                {lesson.sentences.length} {isEn ? "sentences" : "câu luyện nghe"} · {lesson.difficulty}
              </p>
            </Card>
          </Link>
        ))}
      </HorizontalCarouselSection>

      {/* 6F. YOUTUBE VIDEOS CAROUSEL */}
      <HorizontalCarouselSection
        title={t("videosTitle")}
        subtitle={t("videosSubtitle")}
        viewAllHref="/videos"
        viewAllLabel={t("viewAll")}
      >
        {learnVideos.map((video) => (
          <Link
            key={video.id}
            href={`/videos/${video.slug}`}
            className="min-w-[300px] max-w-[340px] shrink-0 snap-start"
          >
            <Card className="overflow-hidden h-full transition hover:border-emerald-300 hover:shadow-md">
              <div className="relative flex h-40 items-center justify-center bg-slate-900 text-white">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 shadow-lg">
                  <Play className="h-5 w-5 fill-current pl-0.5" />
                </div>
                <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/75 px-2 py-0.5 text-xs font-semibold">
                  {video.duration_label}
                </span>
                <span className="absolute left-2.5 top-2.5 rounded-md bg-emerald-600/90 px-2 py-0.5 text-[11px] font-semibold">
                  {video.level}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-bold leading-snug text-slate-900 dark:text-white">
                  {isEn ? video.title_en : video.title_vi}
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 line-clamp-2 dark:text-slate-400">
                  {isEn ? video.description_en : video.description_vi}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </HorizontalCarouselSection>

      {/* 6G. FEATURED BLOG & STUDY TIPS CAROUSEL */}
      {featuredBlogPosts.length > 0 && (
        <HorizontalCarouselSection
          title={isEn ? "Featured IELTS Blog & Study Tips" : "Blog & Mẹo thi IELTS nổi bật"}
          subtitle={
            isEn
              ? "Practical strategies, band-boosting tips, and study roadmaps curated by Ôn IELTS."
              : "Chiến thuật phòng thi, lộ trình tự học và kinh nghiệm tăng Band được chọn lọc."
          }
          viewAllHref="/blog"
          viewAllLabel={t("viewAll")}
        >
          {featuredBlogPosts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="min-w-[300px] max-w-[340px] shrink-0 snap-start"
            >
              <Card className="flex h-full flex-col justify-between overflow-hidden transition hover:border-emerald-300 hover:shadow-md">
                <div>
                  {post.cover_image_url && (
                    <div className="h-36 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.cover_image_url}
                        alt={
                          post.seo_meta?.coverImageAlt ||
                          (isEn ? post.title_en : post.title_vi)
                        }
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary">{post.category}</Badge>
                        {post.is_featured && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <Star className="h-2.5 w-2.5 fill-current" />
                            {isEn ? "Featured" : "Nổi bật"}
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="h-3 w-3" />
                        {post.read_minutes} {isEn ? "min" : "phút"}
                      </span>
                    </div>
                    <h3 className="mt-2.5 line-clamp-2 text-sm font-bold leading-snug text-slate-900 dark:text-white">
                      {isEn ? post.title_en : post.title_vi}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                      {isEn ? post.excerpt_en : post.excerpt_vi}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs dark:border-slate-800">
                  <span className="truncate text-slate-500">{post.author_name}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                    {isEn ? "Read" : "Đọc bài"} <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </HorizontalCarouselSection>
      )}
    </div>
  );
}
