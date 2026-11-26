import type { IeltsTest } from "./types";
import { FULL_READING_TESTS } from "./tests-data/reading-tests";
import { FULL_LISTENING_TESTS } from "./tests-data/listening-tests";

const WRITING_AND_SPEAKING_TESTS: IeltsTest[] = [
  // =========================================================================
  // WRITING TESTS (3 ORIGINAL TESTS)
  // =========================================================================
  {
    id: "test-w-1",
    slug: "writing-academic-01-renewable-energy-remote-work",
    skill: "writing",
    module: "academic",
    title_vi: "Writing Academic 01: Biểu đồ Năng lượng tái tạo & AI trong Trường học",
    title_en: "Academic Writing 01: Renewable Energy Chart & AI in Schools Essay",
    description_vi:
      "Đề viết Academic gồm Task 1 mô tả chuyển dịch điện sạch và Task 2 thảo luận về AI trong trường học.",
    description_en:
      "Academic Writing test featuring clean energy chart analysis and an essay on AI in schools.",
    duration_minutes: 60,
    difficulty: "band_6_7",
    questionCount: 2,
    is_published: true,
    sections: [],
    writingPrompt: {
      taskType: "task_2",
      prompt:
        "Many people believe that artificial intelligence tools in schools help students learn faster, while others worry they weaken independent thinking. Discuss both views and give your own opinion.",
      minWords: 250,
    },
    created_at: "2026-11-07T08:00:00.000Z",
  },
  {
    id: "test-w-2",
    slug: "writing-academic-02-urban-public-transport",
    skill: "writing",
    module: "academic",
    title_vi: "Writing Academic 02: Giao thông công cộng & Đô thị bền vững",
    title_en: "Academic Writing 02: Public Transit & Sustainable Cities",
    description_vi:
      "Đề luyện viết dạng Problem–Solution về ùn tắc đô thị và đầu tư tàu điện công cộng.",
    description_en:
      "Problem–Solution Academic Writing prompt exploring metro investment and urban congestion.",
    duration_minutes: 60,
    difficulty: "band_7_plus",
    questionCount: 2,
    is_published: true,
    sections: [],
    writingPrompt: {
      taskType: "task_2",
      prompt:
        "Traffic congestion in major Southeast Asian cities continues to worsen despite road expansions. What are the main causes of this problem, and what practical measures can governments take?",
      minWords: 250,
    },
    created_at: "2026-11-08T08:00:00.000Z",
  },
  {
    id: "test-w-3",
    slug: "writing-general-03-community-workshop-letter",
    skill: "writing",
    module: "general",
    title_vi: "Writing General 03: Thư góp ý Hội thảo cộng đồng & Lối sống số",
    title_en: "General Writing 03: Community Workshop Letter & Digital Lifestyle",
    description_vi:
      "Đề General Training Task 1 viết thư bán trang trọng gửi ban tổ chức trung tâm văn hóa.",
    description_en:
      "General Training Task 1 semi-formal letter to a community cultural centre coordinator.",
    duration_minutes: 60,
    difficulty: "band_5_6",
    questionCount: 2,
    is_published: true,
    sections: [],
    writingPrompt: {
      taskType: "general_t1",
      prompt:
        "You recently attended a weekend digital-skills workshop at your local community centre. Write a letter to the organizer thanking them, highlighting one session you enjoyed, and suggesting one practical improvement.",
      minWords: 150,
    },
    created_at: "2026-11-09T08:00:00.000Z",
  },

  // =========================================================================
  // SPEAKING TESTS (3 ORIGINAL TESTS)
  // =========================================================================
  {
    id: "test-s-1",
    slug: "speaking-01-hometown-lifelong-learning",
    skill: "speaking",
    module: "academic",
    title_vi: "Speaking 01: Quê hương, Kỹ năng mới & Học tập suốt đời",
    title_en: "Speaking 01: Hometown, Learning a Skill & Lifelong Education",
    description_vi:
      "Đề Speaking trọn bộ 3 phần với câu hỏi quen thuộc về quê hương và thảo luận học tập hiện đại.",
    description_en:
      "Full 3-part Speaking test covering hometown, a practical skill cue card, and lifelong learning.",
    duration_minutes: 15,
    difficulty: "band_6_7",
    questionCount: 3,
    is_published: true,
    sections: [],
    speakingPrompts: {
      part1: [
        "Where is your hometown, and what do you like most about living there?",
        "Has public transport or the neighborhood changed much over the last five years?",
      ],
      part2: {
        topic: "Describe a useful skill you taught yourself outside of school.",
        bullets: [
          "What the skill is",
          "How you learned it",
          "What difficulties you faced at first",
          "And explain how this skill helps you today",
        ],
      },
      part3: [
        "Why do many adults continue taking online courses after graduating from university?",
        "Do you think practical skills should receive equal weight to academic exams at school?",
      ],
    },
    created_at: "2026-11-10T08:00:00.000Z",
  },
  {
    id: "test-s-2",
    slug: "speaking-02-green-spaces-urban-life",
    skill: "speaking",
    module: "academic",
    title_vi: "Speaking 02: Không gian xanh, Công viên & Sức khỏe đô thị",
    title_en: "Speaking 02: Green Spaces, Parks & Urban Wellbeing",
    description_vi:
      "Luyện miêu tả địa điểm ngoài trời Part 2 và thảo luận quy hoạch đô thị xanh Part 3.",
    description_en:
      "Describe an outdoor sanctuary in Part 2 and debate green city planning in Part 3.",
    duration_minutes: 15,
    difficulty: "band_6_7",
    questionCount: 3,
    is_published: true,
    sections: [],
    speakingPrompts: {
      part1: [
        "Do you prefer spending your free time indoors or outdoors?",
        "Are there many parks or walking paths near your home?",
      ],
      part2: {
        topic: "Describe a quiet outdoor place where you enjoy relaxing.",
        bullets: [
          "Where this place is",
          "How often you visit it",
          "What activities people do there",
          "And explain why it helps you recharge",
        ],
      },
      part3: [
        "How do public parks contribute to mental health in densely populated cities?",
        "Should city planners prioritize housing or green parks when land is limited?",
      ],
    },
    created_at: "2026-11-11T08:00:00.000Z",
  },
  {
    id: "test-s-3",
    slug: "speaking-03-books-podcasts-media",
    skill: "speaking",
    module: "academic",
    title_vi: "Speaking 03: Sách, Podcast & Thói quen tiếp nhận thông tin",
    title_en: "Speaking 03: Books, Podcasts & Modern Information Habits",
    description_vi:
      "Chủ đề truyền thông và đọc sách xuất hiện thường xuyên trong IELTS Speaking.",
    description_en:
      "High-frequency IELTS Speaking test focused on reading habits, audio media, and critical literacy.",
    duration_minutes: 15,
    difficulty: "band_7_plus",
    questionCount: 3,
    is_published: true,
    sections: [],
    speakingPrompts: {
      part1: [
        "Do you prefer reading printed books or listening to audiobooks and podcasts?",
        "What kinds of articles or topics catch your attention online?",
      ],
      part2: {
        topic:
          "Describe an informative article, book, or podcast that taught you something surprising.",
        bullets: [
          "What it was about",
          "When you discovered it",
          "Why you found it surprising",
          "And explain whether you shared it with anyone else",
        ],
      },
      part3: [
        "How has short-form video affected young people's concentration when reading long texts?",
        "What responsibilities do online platforms have in verifying educational information?",
      ],
    },
    created_at: "2026-11-12T08:00:00.000Z",
  },
];

/**
 * 12 100% ORIGINAL practice tests (3 per IELTS skill):
 * - 3 Full 40-question Reading tests (120 questions across 9 passages/sections)
 * - 3 Full 40-question Listening tests (120 questions across 12 parts with real MP3 audio)
 * - 3 Writing tests
 * - 3 Speaking tests
 */
export const FULL_SEED_TESTS: IeltsTest[] = [
  ...FULL_READING_TESTS,
  ...FULL_LISTENING_TESTS,
  ...WRITING_AND_SPEAKING_TESTS,
];
