import "server-only";
import { GENERAL_AI_TOOLS } from "./ai-tools-config";
import {
  getBlogPosts,
  getConversationTopics,
  getCourses,
  getDictationLessons,
  getIeltsTests,
  getLearnVideos,
  getPronunciationSounds,
  getWritingExercises,
} from "./db";
import type { IeltsTest } from "./types";

export interface PlatformCounts {
  publishedTestCount: number;
  readingTestCount: number;
  listeningTestCount: number;
  writingTestCount: number;
  speakingTestCount: number;
  totalObjectiveQuestions: number;
  maxObjectiveQuestionsPerTest: number;
  aiGeneralToolCount: number;
  /** GENERAL_AI_TOOLS + Text-to-Speech + Band Calculator (shown on /tools) */
  toolsHubCount: number;
  /** Tools Hub + Mentor AI (shown on homepage Learning Tools grid) */
  homeToolsCount: number;
  courseCount: number;
  ipaSoundCount: number;
  videoCount: number;
  blogPostCount: number;
  dictationCount: number;
  conversationCount: number;
  writingExerciseCount: number;
}

export function computeTestCounts(tests: IeltsTest[]) {
  let readingTestCount = 0;
  let listeningTestCount = 0;
  let writingTestCount = 0;
  let speakingTestCount = 0;
  let totalObjectiveQuestions = 0;
  let maxObjectiveQuestionsPerTest = 0;

  for (const t of tests) {
    if (t.skill === "reading") readingTestCount += 1;
    else if (t.skill === "listening") listeningTestCount += 1;
    else if (t.skill === "writing") writingTestCount += 1;
    else if (t.skill === "speaking") speakingTestCount += 1;

    if (t.skill === "reading" || t.skill === "listening") {
      const qCount = t.sections.reduce((sum, s) => sum + s.questions.length, 0);
      totalObjectiveQuestions += qCount;
      if (qCount > maxObjectiveQuestionsPerTest) {
        maxObjectiveQuestionsPerTest = qCount;
      }
    }
  }

  return {
    publishedTestCount: tests.length,
    readingTestCount,
    listeningTestCount,
    writingTestCount,
    speakingTestCount,
    totalObjectiveQuestions,
    maxObjectiveQuestionsPerTest,
  };
}

export async function getPlatformCounts(): Promise<PlatformCounts> {
  const [
    tests,
    courses,
    sounds,
    videos,
    posts,
    dictations,
    conversations,
    writingExercises,
  ] = await Promise.all([
    getIeltsTests(false),
    getCourses(false),
    getPronunciationSounds(false),
    getLearnVideos(false),
    getBlogPosts(false),
    getDictationLessons(false),
    getConversationTopics(false),
    getWritingExercises(false),
  ]);

  const testStats = computeTestCounts(tests);
  const aiGeneralToolCount = GENERAL_AI_TOOLS.length;

  return {
    ...testStats,
    aiGeneralToolCount,
    toolsHubCount: aiGeneralToolCount + 2,
    homeToolsCount: aiGeneralToolCount + 3,
    courseCount: courses.length,
    ipaSoundCount: sounds.length,
    videoCount: videos.length,
    blogPostCount: posts.length,
    dictationCount: dictations.length,
    conversationCount: conversations.length,
    writingExerciseCount: writingExercises.length,
  };
}
