import type {
  BandConversionRow,
  BlogPost,
  ConversationTopic,
  CourseItem,
  DictationLesson,
  FeatureRequestItem,
  FlashcardItem,
  FlashcardSet,
  IeltsTest,
  LearnVideo,
  PricingPlan,
  PromoBanner,
  PromoCode,
  PronunciationSound,
  TestimonialItem,
  UserProfile,
  WritingExercise,
} from "./types";

export const DEFAULT_BAND_CONVERSIONS: BandConversionRow[] = [
  // Listening (0–40)
  { id: "l-90", skill: "listening", min_raw: 39, max_raw: 40, band_score: 9.0 },
  { id: "l-85", skill: "listening", min_raw: 37, max_raw: 38, band_score: 8.5 },
  { id: "l-80", skill: "listening", min_raw: 35, max_raw: 36, band_score: 8.0 },
  { id: "l-75", skill: "listening", min_raw: 32, max_raw: 34, band_score: 7.5 },
  { id: "l-70", skill: "listening", min_raw: 30, max_raw: 31, band_score: 7.0 },
  { id: "l-65", skill: "listening", min_raw: 26, max_raw: 29, band_score: 6.5 },
  { id: "l-60", skill: "listening", min_raw: 23, max_raw: 25, band_score: 6.0 },
  { id: "l-55", skill: "listening", min_raw: 18, max_raw: 22, band_score: 5.5 },
  { id: "l-50", skill: "listening", min_raw: 16, max_raw: 17, band_score: 5.0 },
  { id: "l-45", skill: "listening", min_raw: 13, max_raw: 15, band_score: 4.5 },
  { id: "l-40", skill: "listening", min_raw: 11, max_raw: 12, band_score: 4.0 },
  { id: "l-35", skill: "listening", min_raw: 8, max_raw: 10, band_score: 3.5 },
  { id: "l-30", skill: "listening", min_raw: 6, max_raw: 7, band_score: 3.0 },
  { id: "l-25", skill: "listening", min_raw: 4, max_raw: 5, band_score: 2.5 },
  { id: "l-20", skill: "listening", min_raw: 0, max_raw: 3, band_score: 2.0 },
  // Reading Academic (0–40)
  { id: "ra-90", skill: "reading_academic", min_raw: 39, max_raw: 40, band_score: 9.0 },
  { id: "ra-85", skill: "reading_academic", min_raw: 37, max_raw: 38, band_score: 8.5 },
  { id: "ra-80", skill: "reading_academic", min_raw: 35, max_raw: 36, band_score: 8.0 },
  { id: "ra-75", skill: "reading_academic", min_raw: 33, max_raw: 34, band_score: 7.5 },
  { id: "ra-70", skill: "reading_academic", min_raw: 30, max_raw: 32, band_score: 7.0 },
  { id: "ra-65", skill: "reading_academic", min_raw: 27, max_raw: 29, band_score: 6.5 },
  { id: "ra-60", skill: "reading_academic", min_raw: 23, max_raw: 26, band_score: 6.0 },
  { id: "ra-55", skill: "reading_academic", min_raw: 19, max_raw: 22, band_score: 5.5 },
  { id: "ra-50", skill: "reading_academic", min_raw: 15, max_raw: 18, band_score: 5.0 },
  { id: "ra-45", skill: "reading_academic", min_raw: 13, max_raw: 14, band_score: 4.5 },
  { id: "ra-40", skill: "reading_academic", min_raw: 10, max_raw: 12, band_score: 4.0 },
  { id: "ra-35", skill: "reading_academic", min_raw: 8, max_raw: 9, band_score: 3.5 },
  { id: "ra-30", skill: "reading_academic", min_raw: 6, max_raw: 7, band_score: 3.0 },
  { id: "ra-25", skill: "reading_academic", min_raw: 4, max_raw: 5, band_score: 2.5 },
  { id: "ra-20", skill: "reading_academic", min_raw: 0, max_raw: 3, band_score: 2.0 },
  // Reading General (0–40)
  { id: "rg-90", skill: "reading_general", min_raw: 40, max_raw: 40, band_score: 9.0 },
  { id: "rg-85", skill: "reading_general", min_raw: 39, max_raw: 39, band_score: 8.5 },
  { id: "rg-80", skill: "reading_general", min_raw: 37, max_raw: 38, band_score: 8.0 },
  { id: "rg-75", skill: "reading_general", min_raw: 36, max_raw: 36, band_score: 7.5 },
  { id: "rg-70", skill: "reading_general", min_raw: 34, max_raw: 35, band_score: 7.0 },
  { id: "rg-65", skill: "reading_general", min_raw: 32, max_raw: 33, band_score: 6.5 },
  { id: "rg-60", skill: "reading_general", min_raw: 30, max_raw: 31, band_score: 6.0 },
  { id: "rg-55", skill: "reading_general", min_raw: 27, max_raw: 29, band_score: 5.5 },
  { id: "rg-50", skill: "reading_general", min_raw: 23, max_raw: 26, band_score: 5.0 },
  { id: "rg-45", skill: "reading_general", min_raw: 19, max_raw: 22, band_score: 4.5 },
  { id: "rg-40", skill: "reading_general", min_raw: 15, max_raw: 18, band_score: 4.0 },
  { id: "rg-35", skill: "reading_general", min_raw: 12, max_raw: 14, band_score: 3.5 },
  { id: "rg-30", skill: "reading_general", min_raw: 9, max_raw: 11, band_score: 3.0 },
  { id: "rg-25", skill: "reading_general", min_raw: 6, max_raw: 8, band_score: 2.5 },
  { id: "rg-20", skill: "reading_general", min_raw: 0, max_raw: 5, band_score: 2.0 },
];

export const DEFAULT_DEMO_USERS: UserProfile[] = [
  {
    id: "demo-free-001",
    email: "minh.anh@onielts.vn",
    full_name: "Nguyễn Minh Anh",
    role: "learner",
    target_band: 7.0,
    current_band: 5.5,
    locale: "vi",
    premium_expires_at: null,
    referral_code: "MINHANH26",
    referred_by: null,
    email_verified: true,
    streak_count: 5,
    last_active_date: "2026-11-24",
    created_at: "2026-10-01T08:00:00.000Z",
  },
  {
    id: "demo-premium-002",
    email: "hoang.nam@onielts.vn",
    full_name: "Trần Hoàng Nam",
    role: "learner",
    target_band: 8.0,
    current_band: 7.0,
    locale: "vi",
    premium_expires_at: "2027-05-25T00:00:00.000Z",
    referral_code: "HOANGNAM80",
    referred_by: "MINHANH26",
    email_verified: true,
    streak_count: 19,
    last_active_date: "2026-11-25",
    created_at: "2026-09-15T08:00:00.000Z",
  },
  {
    id: "demo-admin-003",
    email: "admin@onielts.vn",
    full_name: "Quản trị viên Ôn IELTS",
    role: "admin",
    target_band: 8.5,
    current_band: 8.5,
    locale: "vi",
    premium_expires_at: "2029-12-31T00:00:00.000Z",
    referral_code: "ONIELTSADMIN",
    referred_by: null,
    email_verified: true,
    streak_count: 42,
    last_active_date: "2026-11-25",
    created_at: "2026-08-01T08:00:00.000Z",
  },
];

export const DEFAULT_PRICING_PLANS: PricingPlan[] = [
  {
    id: "plan-1m",
    slug: "premium-1m",
    name_vi: "Gói 1 Tháng",
    name_en: "1-Month Plan",
    duration_months: 1,
    price_vnd: 199000,
    original_price_vnd: 299000,
    is_popular: false,
    features_vi: [
      "Chấm AI Writing & Speaking không giới hạn",
      "Toàn bộ trình tạo bài mẫu Band 9",
      "Hội thoại AI đa chủ đề không giới hạn",
      "Phân tích lỗi sai theo dạng câu hỏi",
      "Bài nộp ở chế độ riêng tư mặc định",
    ],
    features_en: [
      "Unlimited AI Writing & Speaking evaluations",
      "All Band 9 sample generators",
      "Unlimited AI Role-play Conversations",
      "Mistake analytics by question type",
      "Private-by-default essay submissions",
    ],
    is_active: true,
    sort_order: 1,
  },
  {
    id: "plan-3m",
    slug: "premium-3m",
    name_vi: "Gói 3 Tháng",
    name_en: "3-Month Plan",
    duration_months: 3,
    price_vnd: 499000,
    original_price_vnd: 897000,
    is_popular: false,
    features_vi: [
      "Mọi quyền lợi Gói 1 Tháng",
      "Tiết kiệm 44% so với mua lẻ từng tháng",
      "Lộ trình cá nhân hóa từ Mentor Ôn IELTS",
      "Đồng bộ Flashcard & tiến độ đa thiết bị",
      "Hỗ trợ học thuật ưu tiên",
    ],
    features_en: [
      "Everything in 1-Month Plan",
      "Save 44% compared to monthly billing",
      "Personalized Mentor Ôn IELTS roadmap",
      "Cross-device Flashcard & progress sync",
      "Priority learner support",
    ],
    is_active: true,
    sort_order: 2,
  },
  {
    id: "plan-6m",
    slug: "premium-6m",
    name_vi: "Gói 6 Tháng",
    name_en: "6-Month Plan",
    duration_months: 6,
    price_vnd: 799000,
    original_price_vnd: 1794000,
    is_popular: true,
    features_vi: [
      "Mọi quyền lợi Gói 3 Tháng",
      "Tiết kiệm 55% — Phù hợp mục tiêu tăng 1.0–1.5 Band",
      "Không giới hạn 8 công cụ AI & Chép chính tả",
      "Báo cáo tiến độ chuyên sâu theo từng kỹ năng",
      "Ưu tiên trải nghiệm tính năng AI mới nhất",
    ],
    features_en: [
      "Everything in 3-Month Plan",
      "Save 55% — Ideal for a +1.0 to +1.5 Band jump",
      "Unlimited AI learning tools & Dictation",
      "In-depth skill analytics reports",
      "Early access to new AI features",
    ],
    is_active: true,
    sort_order: 3,
  },
  {
    id: "plan-12m",
    slug: "premium-12m",
    name_vi: "Gói 12 Tháng",
    name_en: "12-Month Plan",
    duration_months: 12,
    price_vnd: 1299000,
    original_price_vnd: 3588000,
    is_popular: false,
    features_vi: [
      "Mọi quyền lợi Gói 6 Tháng",
      "Tiết kiệm 64% — Chỉ khoảng 108.000đ/tháng",
      "Trọn bộ khóa học, đề thi và bài luyện mới cả năm",
      "Thanh toán 1 lần qua VietQR, không tự động gia hạn",
      "Hỗ trợ ưu tiên giải đáp lộ trình học",
    ],
    features_en: [
      "Everything in 6-Month Plan",
      "Save 64% — Only ~108,000 VND/month",
      "Full access to all new tests & courses all year",
      "One-time VietQR payment, zero auto-renewal",
      "Priority study-plan support",
    ],
    is_active: true,
    sort_order: 4,
  },
];

export const DEFAULT_PROMO_BANNER: PromoBanner = {
  id: "promo-main",
  key: "main_pricing_promo",
  title_vi: "Ưu đãi mùa thi — Giảm thêm 15% cho mọi gói Premium khi nhập mã ONIELTS15",
  title_en: "Exam Season Deal — Extra 15% off any Premium plan with code ONIELTS15",
  badge_vi: "ƯU ĐÃI CÓ HẠN",
  badge_en: "LIMITED OFFER",
  ends_at: "2026-12-15T16:59:59.000Z",
  cta_vi: "Nâng cấp ngay",
  cta_en: "Upgrade now",
  is_active: true,
};

export const DEFAULT_PROMO_CODES: PromoCode[] = [
  {
    id: "code-15",
    code: "ONIELTS15",
    discount_percent: 15,
    max_discount_vnd: 250000,
    max_uses: 500,
    current_uses: 38,
    expires_at: "2027-01-31T16:59:59.000Z",
    is_active: true,
  },
  {
    id: "code-sinhvien",
    code: "SINHVIEN20",
    discount_percent: 20,
    max_discount_vnd: 300000,
    max_uses: 300,
    current_uses: 14,
    expires_at: "2027-03-31T16:59:59.000Z",
    is_active: true,
  },
];

export const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  {
    id: "t-1",
    learner_name: "Lê Thảo Vy",
    target_achieved: "Đạt 7.5 Overall",
    previous_band: 6.0,
    new_band: 7.5,
    quote_vi:
      "Nhờ công cụ chấm Writing chỉ rõ từng lỗi diễn đạt và gợi ý bài mẫu Band 8+, điểm Writing của mình tăng từ 5.5 lên 7.0 chỉ sau 7 tuần tự học ở nhà.",
    quote_en:
      "The inline Writing error highlights and Band 8+ rewrites helped me jump from 5.5 to 7.0 Writing in just 7 weeks of self-study.",
    role_vi: "Sinh viên năm 4, Đại học Kinh tế TP.HCM",
    role_en: "Senior Student, UEH Ho Chi Minh City",
    is_published: true,
  },
  {
    id: "t-2",
    learner_name: "Phạm Đức Khôi",
    target_achieved: "Đạt 8.0 Overall",
    previous_band: 6.5,
    new_band: 8.0,
    quote_vi:
      "Tính năng Chép chính tả và Đề thi mỗi ngày giúp mình giữ thói quen học 25 phút mỗi sáng. Phần phân tích lỗi theo dạng câu hỏi Reading cực kỳ hữu ích!",
    quote_en:
      "Dictation practice and Daily Exams kept my 25-minute morning habit alive. Question-type mistake analytics fixed my T/F/NG weakness fast.",
    role_vi: "Kỹ sư phần mềm, Hà Nội",
    role_en: "Software Engineer, Hanoi",
    is_published: true,
  },
  {
    id: "t-3",
    learner_name: "Vũ Ngọc Hân",
    target_achieved: "Đạt 7.0 Overall",
    previous_band: 5.0,
    new_band: 7.0,
    quote_vi:
      "Mình từng rất ngại nói vì sợ sai phát âm. Luyện hội thoại AI mỗi tối và sửa từng âm /θ/, /ð/, /ʃ/ trên Ôn IELTS giúp mình tự tin hơn hẳn khi vào phòng thi.",
    quote_en:
      "I used to be shy about speaking. Practicing AI role-plays and drilling /θ/, /ð/, /ʃ/ IPA sounds gave me real confidence on test day.",
    role_vi: "Chuyên viên Marketing, Đà Nẵng",
    role_en: "Marketing Executive, Da Nang",
    is_published: true,
  },
  {
    id: "t-4",
    learner_name: "Đỗ Gia Bảo",
    target_achieved: "Đạt 7.5 Overall",
    previous_band: 6.0,
    new_band: 7.5,
    quote_vi:
      "Thích nhất là bôi đen bất kỳ từ mới nào khi đọc bài đều lưu thẳng vào Flashcard kèm IPA và ví dụ IELTS. Ôn theo lịch lặp lại ngắt quãng nhớ rất lâu.",
    quote_en:
      "Highlighting any unfamiliar word to save directly into spaced-repetition flashcards with IPA and examples saved me hours every week.",
    role_vi: "Học sinh lớp 12, Hải Phòng",
    role_en: "Grade 12 Student, Hai Phong",
    is_published: true,
  },
];

export const DEFAULT_CONVERSATION_TOPICS: ConversationTopic[] = [
  {
    slug: "introducing-yourself",
    title_vi: "Giới thiệu bản thân",
    title_en: "Introducing Yourself",
    part: "Part 1",
    level: "Band 5.5–7.0",
    opener: "Hello! Welcome to your practice session. Could you tell me a little bit about yourself and what you currently do?",
    description_vi: "Luyện cách mở đầu tự nhiên, giới thiệu ngành học, công việc và mục tiêu cá nhân.",
    description_en: "Practice natural introductions covering studies, work, and personal goals.",
    suggestedVocab: ["currently pursuing", "specialize in", "in the near future", "rewarding experience"],
  },
  {
    slug: "family",
    title_vi: "Gia đình & Người thân",
    title_en: "Family & Relationships",
    part: "Part 1",
    level: "Band 5.5–7.5",
    opener: "Do you have a large family or a small one, and who are you closest to?",
    description_vi: "Miêu tả thành viên gia đình, thói quen cuối tuần và sự gắn kết thế hệ.",
    description_en: "Talk about family members, weekend routines, and intergenerational bonds.",
    suggestedVocab: ["close-knit family", "look up to", "quality time", "take after"],
  },
  {
    slug: "hobbies",
    title_vi: "Sở thích & Thời gian rảnh",
    title_en: "Hobbies & Free Time",
    part: "Part 1",
    level: "Band 5.5–7.5",
    opener: "What do you usually enjoy doing in your spare time after a busy week?",
    description_vi: "Chia sẻ đam mê cá nhân, lợi ích tinh thần và cách cân bằng cuộc sống.",
    description_en: "Discuss personal interests, relaxation, and work-life balance.",
    suggestedVocab: ["unwind after work", "passionate about", "pick up a hobby", "recharge my batteries"],
  },
  {
    slug: "hometown",
    title_vi: "Quê hương & Nơi sinh sống",
    title_en: "Hometown & City Life",
    part: "Part 1",
    level: "Band 6.0–8.0",
    opener: "Where is your hometown, and what has changed there over the last few years?",
    description_vi: "Mô tả nét đặc trưng quê hương, ẩm thực địa phương và tốc độ đô thị hóa.",
    description_en: "Describe your hometown's character, local food, and urban transformation.",
    suggestedVocab: ["bustling metropolis", "picturesque scenery", "rapid urbanization", "sense of community"],
  },
  {
    slug: "job-career",
    title_vi: "Công việc & Sự nghiệp",
    title_en: "Job & Career Goals",
    part: "Part 1",
    level: "Band 6.0–8.0",
    opener: "Could you tell me about your job or the career path you hope to follow?",
    description_vi: "Trình bày trách nhiệm công việc, kỹ năng quan trọng và định hướng nghề nghiệp.",
    description_en: "Explain daily responsibilities, key skills, and long-term career plans.",
    suggestedVocab: ["career progression", "collaborative environment", "steep learning curve", "job satisfaction"],
  },
  {
    slug: "home-accommodation",
    title_vi: "Nhà ở & Không gian sống",
    title_en: "Home & Accommodation",
    part: "Part 1",
    level: "Band 5.5–7.5",
    opener: "Do you live in a house or an apartment? Which room do you spend the most time in?",
    description_vi: "Nói về căn nhà hiện tại, không gian yêu thích và ngôi nhà mơ ước.",
    description_en: "Describe your living space, favorite room, and ideal future home.",
    suggestedVocab: ["natural sunlight", "minimalist interior", "conveniently located", "cozy atmosphere"],
  },
  {
    slug: "birthday-celebrations",
    title_vi: "Sinh nhật & Lễ kỷ niệm",
    title_en: "Birthdays & Celebrations",
    part: "Part 1",
    level: "Band 5.5–7.0",
    opener: "How do people in Vietnam usually celebrate birthdays, and how did you spend your last one?",
    description_vi: "Kể về kỷ niệm sinh nhật đáng nhớ và văn hóa chúc mừng tại Việt Nam.",
    description_en: "Share memorable birthday traditions and celebration customs in Vietnam.",
    suggestedVocab: ["intimate gathering", "memorable milestone", "thoughtful gesture", "mark the occasion"],
  },
  {
    slug: "school-education",
    title_vi: "Trường học & Giáo dục",
    title_en: "School & Education",
    part: "Part 3",
    level: "Band 6.5–8.5",
    opener: "In your opinion, how has digital technology changed the way students learn at school?",
    description_vi: "Thảo luận chuyên sâu về phương pháp học, vai trò giáo viên và công nghệ giáo dục.",
    description_en: "Discuss modern learning methods, teacher roles, and educational technology.",
    suggestedVocab: ["critical thinking", "personalized learning", "digital literacy", "holistic education"],
  },
];

export const DEFAULT_WRITING_EXERCISES: WritingExercise[] = [
  {
    id: "we-1",
    slug: "nang-cap-cau-chu-de-moi-truong",
    title_vi: "Nâng cấp câu chủ đề Môi trường & Năng lượng xanh",
    title_en: "Upgrading Environment & Clean Energy Sentences",
    topic: "Environment",
    targetSkill: "Lexical Resource & Complex Clauses",
    sentences: [
      {
        id: "we-1-s1",
        weakSentence: "Many cars make the air very dirty in big cities nowadays.",
        issue_vi: "Từ vựng quá đơn giản ('make', 'very dirty'), thiếu sắc thái học thuật.",
        hint_vi: "Dùng danh từ hóa (vehicular emissions), động từ học thuật (exacerbate) và cụm urban air pollution.",
        band8Model:
          "The rapid proliferation of private vehicles has significantly exacerbated urban air pollution in major metropolitan areas.",
        keyUpgrades: ["proliferation of private vehicles", "exacerbated", "metropolitan areas"],
      },
      {
        id: "we-1-s2",
        weakSentence: "Governments should give money to solar energy so people stop using coal.",
        issue_vi: "Cấu trúc câu đơn giản, 'give money' không trang trọng trong IELTS Academic.",
        hint_vi: "Thay 'give money' bằng 'allocate subsidies to', dùng mệnh đề mục đích 'in order to accelerate the transition away from'.",
        band8Model:
          "Governments should allocate substantial subsidies to solar infrastructure in order to accelerate the transition away from coal dependency.",
        keyUpgrades: ["allocate substantial subsidies", "accelerate the transition", "coal dependency"],
      },
      {
        id: "we-1-s3",
        weakSentence: "Plastic bags are bad because animals in the sea eat them and die.",
        issue_vi: "Diễn đạt mang tính văn nói ('are bad'), thiếu mạch kết nối nguyên nhân – hệ quả.",
        hint_vi: "Dùng 'pose a severe threat to marine ecosystems' kết hợp mệnh đề quan hệ không xác định.",
        band8Model:
          "Single-use plastics pose a severe threat to marine ecosystems, as aquatic species frequently ingest discarded waste with fatal consequences.",
        keyUpgrades: ["pose a severe threat to", "marine ecosystems", "with fatal consequences"],
      },
    ],
  },
  {
    id: "we-2",
    slug: "nang-cap-cau-mo-ta-bieu-do-task-1",
    title_vi: "Diễn đạt xu hướng số liệu Academic Task 1",
    title_en: "Describing Data Trends in Academic Task 1",
    topic: "Data & Charts",
    targetSkill: "Task Achievement & Grammatical Range",
    sentences: [
      {
        id: "we-2-s1",
        weakSentence: "The number of online shoppers went up a lot from 2015 to 2025.",
        issue_vi: "'went up a lot' quá phổ thông, cần động từ mô tả biên độ chính xác.",
        hint_vi: "Dùng cấu trúc 'witnessed a dramatic surge' hoặc 'climbed markedly over the ten-year period'.",
        band8Model:
          "The proportion of online consumers witnessed a dramatic surge over the decade from 2015 to 2025.",
        keyUpgrades: ["proportion of", "witnessed a dramatic surge", "over the decade"],
      },
      {
        id: "we-2-s2",
        weakSentence: "Spending on books was lower than spending on streaming apps.",
        issue_vi: "Thiếu cụm so sánh học thuật và cấu trúc tham chiếu (that of).",
        hint_vi: "Dùng 'expenditure on', 'trailed considerably behind', và đại từ thay thế 'that of'.",
        band8Model:
          "Household expenditure on printed books trailed considerably behind that of digital streaming subscriptions.",
        keyUpgrades: ["Household expenditure", "trailed considerably behind", "that of"],
      },
    ],
  },
  {
    id: "we-3",
    slug: "nang-cap-lap-luan-giao-duc-cong-nghe",
    title_vi: "Viết câu luận sắc bén chủ đề Giáo dục & AI",
    title_en: "Sharpening Arguments on Education & AI",
    topic: "Education & Technology",
    targetSkill: "Coherence & Hedging",
    sentences: [
      {
        id: "we-3-s1",
        weakSentence: "AI will replace all teachers because it knows everything.",
        issue_vi: "Khẳng định tuyệt đối hóa ('all teachers', 'everything') làm giảm tính thuyết phục học thuật.",
        hint_vi: "Dùng ngôn ngữ rào đón (hedging: 'While AI can automate...'), đối lập với vai trò cảm xúc của giáo viên.",
        band8Model:
          "While artificial intelligence can streamline routine instruction, it is unlikely to replace human educators who cultivate empathy and mentorship.",
        keyUpgrades: ["streamline routine instruction", "unlikely to replace", "cultivate empathy"],
      },
      {
        id: "we-3-s2",
        weakSentence: "Studying online is good for busy people who have jobs.",
        issue_vi: "Từ 'good' mơ hồ, cần nêu rõ lợi ích cụ thể là tính linh hoạt.",
        hint_vi: "Dùng 'offers unparalleled flexibility for working professionals'.",
        band8Model:
          "Online degree programmes offer unparalleled flexibility for working professionals striving to upskill without sacrificing their careers.",
        keyUpgrades: ["unparalleled flexibility", "working professionals", "striving to upskill"],
      },
    ],
  },
];

export const DEFAULT_IPA_SOUNDS: PronunciationSound[] = [
  {
    slug: "i-long",
    symbol: "/iː/",
    category: "vowel",
    title_vi: "Nguyên âm dài /iː/",
    title_en: "Long Vowel /iː/",
    mouthPosition_vi: "Khóe miệng kéo rộng sang hai bên như đang mỉm cười, đầu lưỡi nâng cao gần vòm miệng, giữ âm dài và căng.",
    vietnameseTip_vi: "Người Việt hay đọc ngắn thành âm 'i' thường khiến 'sheep' giống 'ship'. Hãy kéo dài hơi rõ hơn ~0.3 giây.",
    tip_en: "Spread your lips gently as if smiling and sustain the tense high vowel longer than /ɪ/.",
    examples: [
      { word: "achieve", ipa: "/əˈtʃiːv/", meaning_vi: "đạt được" },
      { word: "research", ipa: "/rɪˈsɜːtʃ/ or /ˈriːsɜːtʃ/", meaning_vi: "nghiên cứu" },
      { word: "sustainable", ipa: "/səˈsteɪnəbl/ (compare: green /ɡriːn/)", meaning_vi: "xanh, bền vững" },
      { word: "increase", ipa: "/ɪnˈkriːs/", meaning_vi: "tăng lên" },
    ],
    practiceSentence: "Green policies help cities achieve cleaner streets and healthier communities.",
  },
  {
    slug: "i-short",
    symbol: "/ɪ/",
    category: "vowel",
    title_vi: "Nguyên âm ngắn /ɪ/",
    title_en: "Short Vowel /ɪ/",
    mouthPosition_vi: "Môi thả lỏng tự nhiên, lưỡi hơi hạ thấp và lùi nhẹ so với /iː/, phát âm nhanh và dứt khoát.",
    vietnameseTip_vi: "Tránh kéo dài thành 'i' tiếng Việt. Âm này nằm giữa 'i' và 'ê' ngắn.",
    tip_en: "Relax your lips and tongue slightly lower than /iː/; keep the sound brief and lax.",
    examples: [
      { word: "significant", ipa: "/sɪɡˈnɪfɪkənt/", meaning_vi: "đáng kể" },
      { word: "benefit", ipa: "/ˈbenɪfɪt/", meaning_vi: "lợi ích" },
      { word: "skill", ipa: "/skɪl/", meaning_vi: "kỹ năng" },
      { word: "limit", ipa: "/ˈlɪmɪt/", meaning_vi: "giới hạn" },
    ],
    practiceSentence: "Building critical listening skills brings significant benefits in limited time.",
  },
  {
    slug: "ae",
    symbol: "/æ/",
    category: "vowel",
    title_vi: "Nguyên âm bẹt /æ/",
    title_en: "Open-Mid Front /æ/",
    mouthPosition_vi: "Hạ hàm dưới xuống rộng như nói chữ 'a', nhưng giữ lưỡi phẳng hướng về phía trước như chữ 'e'.",
    vietnameseTip_vi: "Lỗi kinh điển là đọc 'bad' thành 'bed'. Mở rộng khẩu hình dọc nhiều hơn khi đọc /æ/.",
    tip_en: "Drop your jaw wider than for /e/ while keeping the tongue flat and forward.",
    examples: [
      { word: "academic", ipa: "/ˌækəˈdemɪk/", meaning_vi: "học thuật" },
      { word: "impact", ipa: "/ˈɪmpækt/", meaning_vi: "tác động" },
      { word: "transport", ipa: "/ˈtrænspɔːt/", meaning_vi: "giao thông" },
      { word: "habit", ipa: "/ˈhæbɪt/", meaning_vi: "thói quen" },
    ],
    practiceSentence: "Practical academic habits have a lasting impact on exam confidence.",
  },
  {
    slug: "schwa",
    symbol: "/ə/",
    category: "vowel",
    title_vi: "Âm lướt Schwa /ə/",
    title_en: "Schwa /ə/",
    mouthPosition_vi: "Toàn bộ môi, hàm và lưỡi hoàn toàn thả lỏng; phát âm rất nhẹ, ngắn ở các âm tiết không nhấn trọng âm.",
    vietnameseTip_vi: "Đây là âm phổ biến nhất tiếng Anh! Đừng đọc rõ từng nguyên âm theo mặt chữ — hãy lướt nhẹ bằng /ə/ để nói tự nhiên như người bản xứ.",
    tip_en: "Keep mouth and tongue completely neutral; produce a very soft, unstressed sound.",
    examples: [
      { word: "environment", ipa: "/ɪnˈvaɪrənmənt/", meaning_vi: "môi trường" },
      { word: "government", ipa: "/ˈɡʌvənmənt/", meaning_vi: "chính phủ" },
      { word: "support", ipa: "/səˈpɔːt/", meaning_vi: "hỗ trợ" },
      { word: "develop", ipa: "/dɪˈveləp/", meaning_vi: "phát triển" },
    ],
    practiceSentence: "Local governments develop practical support programmes for urban residents.",
  },
  {
    slug: "er-long",
    symbol: "/ɜː/",
    category: "vowel",
    title_vi: "Nguyên âm dài /ɜː/",
    title_en: "Long Central /ɜː/",
    mouthPosition_vi: "Môi hơi chu nhẹ tự nhiên, giữa lưỡi nâng lên trung bình, giữ âm đều (giọng Mỹ hơi cong đầu lưỡi).",
    vietnameseTip_vi: "Tránh đọc thành 'ơ' quá ngắn. Kéo dài và giữ hơi chắc trong các từ như 'work', 'learn', 'urban'.",
    tip_en: "Hold a steady mid-central vowel; add slight r-coloring if targeting General American.",
    examples: [
      { word: "urban", ipa: "/ˈɜːbən/", meaning_vi: "đô thị" },
      { word: "research", ipa: "/rɪˈsɜːtʃ/", meaning_vi: "nghiên cứu" },
      { word: "furthermore", ipa: "/ˌfɜːðəˈmɔː/", meaning_vi: "hơn nữa" },
      { word: "journey", ipa: "/ˈdʒɜːni/", meaning_vi: "hành trình" },
    ],
    practiceSentence: "Further urban research confirms that early learning shapes lifelong journeys.",
  },
  {
    slug: "ei",
    symbol: "/eɪ/",
    category: "diphthong",
    title_vi: "Nguyên âm đôi /eɪ/",
    title_en: "Diphthong /eɪ/",
    mouthPosition_vi: "Bắt đầu ở vị trí /e/ rồi lướt mượt mà khép dần về /ɪ/.",
    vietnameseTip_vi: "Người Việt hay rút gọn 'make' thành 'mếch'. Hãy nghe rõ độ lướt từ 'e' sang 'i' trước khi bật âm cuối.",
    tip_en: "Glide smoothly from /e/ upward toward /ɪ/ before closing on the final consonant.",
    examples: [
      { word: "education", ipa: "/ˌedʒuˈkeɪʃn/", meaning_vi: "giáo dục" },
      { word: "sustainable", ipa: "/səˈsteɪnəbl/", meaning_vi: "bền vững" },
      { word: "debate", ipa: "/dɪˈbeɪt/", meaning_vi: "tranh luận" },
      { word: "maintain", ipa: "/meɪnˈteɪn/", meaning_vi: "duy trì" },
    ],
    practiceSentence: "Great education helps nations maintain sustainable innovation.",
  },
  {
    slug: "ai",
    symbol: "/aɪ/",
    category: "diphthong",
    title_vi: "Nguyên âm đôi /aɪ/",
    title_en: "Diphthong /aɪ/",
    mouthPosition_vi: "Mở miệng rộng ở /a/ sau đó nâng lưỡi lướt lên /ɪ/.",
    vietnameseTip_vi: "Giữ âm đầu rõ rồi lướt mềm sang /ɪ/, nhớ giữ nguyên âm cuối như /t/, /d/, /z/ trong 'time', 'rise'.",
    tip_en: "Start open on /a/ and glide smoothly upward to /ɪ/.",
    examples: [
      { word: "lifestyle", ipa: "/ˈlaɪfstaɪl/", meaning_vi: "lối sống" },
      { word: "provide", ipa: "/prəˈvaɪd/", meaning_vi: "cung cấp" },
      { word: "climate", ipa: "/ˈklaɪmət/", meaning_vi: "khí hậu" },
      { word: "decline", ipa: "/dɪˈklaɪn/", meaning_vi: "suy giảm" },
    ],
    practiceSentence: "Climate guidelines provide reliable advice for a healthier lifestyle.",
  },
  {
    slug: "ou",
    symbol: "/əʊ/",
    category: "diphthong",
    title_vi: "Nguyên âm đôi /əʊ/",
    title_en: "Diphthong /əʊ/",
    mouthPosition_vi: "Bắt đầu từ âm lướt thả lỏng /ə/ rồi tròn môi dần về /ʊ/.",
    vietnameseTip_vi: "Đừng đọc cứng thành chữ 'ô' tiếng Việt. Môi phải chuyển động tròn dần ở cuối âm.",
    tip_en: "Begin relaxed in the center and gradually round your lips toward /ʊ/.",
    examples: [
      { word: "global", ipa: "/ˈɡləʊbl/", meaning_vi: "toàn cầu" },
      { word: "promote", ipa: "/prəˈməʊt/", meaning_vi: "thúc đẩy" },
      { word: "focus", ipa: "/ˈfəʊkəs/", meaning_vi: "tập trung" },
      { word: "growth", ipa: "/ɡrəʊθ/", meaning_vi: "tăng trưởng" },
    ],
    practiceSentence: "Global programmes focus on promoting slow, steady economic growth.",
  },
  {
    slug: "th-voiceless",
    symbol: "/θ/",
    category: "consonant",
    title_vi: "Phụ âm vô thanh /θ/",
    title_en: "Voiceless Dental /θ/",
    mouthPosition_vi: "Đặt nhẹ đầu lưỡi giữa hai hàm răng cửa, thổi luồng hơi mảnh ra ngoài, KHÔNG rung dây thanh quản.",
    vietnameseTip_vi: "Rất nhiều bạn đọc nhầm thành 'thờ' tiếng Việt (bật hơi sau răng). Chỉ cần đặt lưỡi chạm nhẹ mép răng trên và thổi gió!",
    tip_en: "Place the tongue tip gently between the teeth and release a soft stream of air with no voice.",
    examples: [
      { word: "think", ipa: "/θɪŋk/", meaning_vi: "suy nghĩ" },
      { word: "health", ipa: "/helθ/", meaning_vi: "sức khỏe" },
      { word: "growth", ipa: "/ɡrəʊθ/", meaning_vi: "sự tăng trưởng" },
      { word: "method", ipa: "/ˈmeθəd/", meaning_vi: "phương pháp" },
    ],
    practiceSentence: "Thoughtful health methods strengthen both youth and elderly communities.",
  },
  {
    slug: "th-voiced",
    symbol: "/ð/",
    category: "consonant",
    title_vi: "Phụ âm hữu thanh /ð/",
    title_en: "Voiced Dental /ð/",
    mouthPosition_vi: "Vị trí lưỡi giống hệt /θ/ (giữa hai hàm răng) nhưng RUNG dây thanh quản khi đẩy hơi ra.",
    vietnameseTip_vi: "Tránh đọc thành 'dờ' tiếng Việt. Đặt ngón tay lên cổ họng để cảm nhận độ rung rõ khi đọc 'this, that, although'.",
    tip_en: "Use the exact same tongue placement as /θ/, but turn on vocal cord vibration.",
    examples: [
      { word: "although", ipa: "/ɔːlˈðəʊ/", meaning_vi: "mặc dù" },
      { word: "furthermore", ipa: "/ˌfɜːðəˈmɔː/", meaning_vi: "hơn nữa" },
      { word: "weather", ipa: "/ˈweðə/", meaning_vi: "thời tiết" },
      { word: "gather", ipa: "/ˈɡæðə/", meaning_vi: "tụ họp" },
    ],
    practiceSentence: "Although the weather shifts quickly, families gather together every weekend.",
  },
  {
    slug: "sh",
    symbol: "/ʃ/",
    category: "consonant",
    title_vi: "Phụ âm xát /ʃ/",
    title_en: "Voiceless Post-alveolar /ʃ/",
    mouthPosition_vi: "Chu môi tròn nhẹ về phía trước, nâng mặt lưỡi gần vòm miệng cứng, thổi luồng hơi êm (như ra hiệu 'suỵt!').",
    vietnameseTip_vi: "Phân biệt rõ 'she' (/ʃ/) với 'see' (/s/). Nhớ chu môi rõ khi đọc các đuôi '-tion', '-sion'.",
    tip_en: "Round your lips forward and push a smooth, hushed stream of air without voice.",
    examples: [
      { word: "solution", ipa: "/səˈluːʃn/", meaning_vi: "giải pháp" },
      { word: "efficient", ipa: "/ɪˈfɪʃnt/", meaning_vi: "hiệu quả" },
      { word: "social", ipa: "/ˈsəʊʃl/", meaning_vi: "xã hội" },
      { word: "issue", ipa: "/ˈɪʃuː/", meaning_vi: "vấn đề" },
    ],
    practiceSentence: "Fresh social initiatives offer efficient solutions to pressing urban issues.",
  },
  {
    slug: "t-ending",
    symbol: "/t/ & /d/",
    category: "consonant",
    title_vi: "Âm cuối /t/ & /d/",
    title_en: "Final Stops /t/ & /d/",
    mouthPosition_vi: "Chạm đầu lưỡi vào gờ lợi trên rồi bật hơi dứt khoát (/t/ vô thanh, /d/ hữu thanh).",
    vietnameseTip_vi: "Bỏ sót âm cuối là nguyên nhân hàng đầu khiến người Việt bị trừ điểm Pronunciation. Hãy bật nhẹ âm cuối ở cuối cụm từ!",
    tip_en: "Articulate final /t/ and /d/ clearly so tense markers (-ed) and meaning stay unmistakable.",
    examples: [
      { word: "developed", ipa: "/dɪˈveləpt/", meaning_vi: "đã phát triển" },
      { word: "student", ipa: "/ˈstjuːdnt/", meaning_vi: "học sinh, sinh viên" },
      { word: "improved", ipa: "/ɪmˈpruːvd/", meaning_vi: "được cải thiện" },
      { word: "result", ipa: "/rɪˈzʌlt/", meaning_vi: "kết quả" },
    ],
    practiceSentence: "Dedicated students improved their test results through consistent daily habits.",
  },
];

export const DEFAULT_COURSES: CourseItem[] = [
  {
    id: "course-1",
    slug: "nen-tang-ielts-5-0-den-6-5",
    title_vi: "Lộ trình Nền tảng IELTS 5.0 → 6.5",
    title_en: "IELTS Foundation Roadmap 5.0 → 6.5",
    description_vi:
      "Củng cố ngữ pháp học thuật, kỹ thuật đọc hiểu Skimming/Scanning, nghe bắt từ khóa và khung viết đoạn chuẩn IELTS.",
    description_en:
      "Master academic grammar, skimming/scanning strategies, active listening cues, and clear paragraph structures.",
    level: "Cơ bản – Trung cấp",
    target_band: "6.5",
    duration_hours: 18,
    is_published: true,
    lessons: [
      {
        id: "c1-l1",
        title_vi: "Bài 1: Hiểu đúng 4 tiêu chí chấm điểm IELTS",
        title_en: "Lesson 1: Understanding the 4 IELTS Band Descriptors",
        duration_min: 20,
        content_vi:
          "Để tăng điểm nhanh, bạn cần học đúng thứ giám khảo tìm kiếm. Ở Writing và Speaking, mỗi kỹ năng đều được đánh giá qua 4 tiêu chí có trọng số bằng nhau (25% mỗi tiêu chí). Nhiều học viên Việt Nam tập trung học từ vựng hiếm nhưng lại bỏ qua tính mạch lạc (Coherence & Cohesion) và trả lời đúng trọng tâm đề bài (Task Response).\n\nNguyên tắc vàng cho Band 6.5+: viết câu rõ ý, liên kết tự nhiên bằng từ nối hợp lý và đảm bảo mọi luận điểm đều có giải thích + ví dụ cụ thể.",
        content_en:
          "Fast band improvement starts with understanding what examiners measure. Both Writing and Speaking are graded equally across four criteria (25% each). Rather than memorizing obscure words, Band 6.5+ candidates answer every part of the prompt clearly with logical progression and accurate everyday academic collocations.",
        keyTakeaways: [
          "4 tiêu chí chấm điểm có tỷ trọng ngang nhau 25%.",
          "Trả lời đủ mọi vế của câu hỏi quan trọng hơn dùng từ hoa mỹ.",
          "Dùng cấu trúc câu ghép/phức chính xác thay vì câu quá dài dễ sai ngữ pháp.",
        ],
        quiz: {
          question: "Tiêu chí nào đánh giá việc bạn trả lời đầy đủ và có lập trường rõ ràng trong Writing Task 2?",
          options: [
            "Task Response",
            "Lexical Resource",
            "Pronunciation",
            "Grammatical Range",
          ],
          correctIndex: 0,
          explanation_vi: "Task Response (TR) đánh giá mức độ trả lời trọn vẹn đề bài và phát triển ý tưởng.",
        },
      },
      {
        id: "c1-l2",
        title_vi: "Bài 2: Chiến thuật làm Reading T/F/NG không bị bẫy",
        title_en: "Lesson 2: Mastering Reading True / False / Not Given",
        duration_min: 25,
        content_vi:
          "Sự khác biệt cốt lõi giữa FALSE và NOT GIVEN nằm ở tính mâu thuẫn trực tiếp.\n- TRUE: thông tin trong bài đọc đồng nghĩa với phát biểu (thường được paraphrase).\n- FALSE: bài đọc đưa ra thông tin trái ngược hoàn toàn với phát biểu.\n- NOT GIVEN: bài đọc không đề cập hoặc không đủ dữ kiện để kết luận đúng hay sai.\n\nMẹo thực chiến: gạch chân các từ giới hạn (only, all, always, first, comparison words) vì đây là vị trí ra đề phổ biến nhất.",
        content_en:
          "FALSE means the passage directly contradicts the statement; NOT GIVEN means no clear evidence exists either way. Always check qualifiers like 'only', 'mainly', or comparative words before choosing.",
        keyTakeaways: [
          "Câu hỏi T/F/NG luôn xuất hiện theo thứ tự từ trên xuống dưới trong bài đọc.",
          "Đừng suy diễn bằng kiến thức ngoài bài đọc.",
          "Chú ý các từ giới hạn: only, most, solely, never.",
        ],
        quiz: {
          question: "Nếu bài đọc nói 'Hầu hết sinh viên thích học nhóm' còn câu hỏi viết 'Tất cả sinh viên thích học nhóm', đáp án là gì?",
          options: ["TRUE", "FALSE", "NOT GIVEN"],
          correctIndex: 1,
          explanation_vi: "'Tất cả' mâu thuẫn trực tiếp với 'Hầu hết' nên đáp án là FALSE.",
        },
      },
      {
        id: "c1-l3",
        title_vi: "Bài 3: Nghe dự đoán loại từ (Prediction) cho Listening Section 1 & 4",
        title_en: "Lesson 3: Word-Type Prediction in Listening Form & Note Completion",
        duration_min: 20,
        content_vi:
          "Trước khi băng chạy, bạn luôn có 20–30 giây đọc trước câu hỏi. Đừng đọc lướt thụ động — hãy xác định ngay chỗ trống cần danh từ số ít/nhiều, động từ, con số hay tên riêng, đồng thời chú ý giới hạn từ (VD: NO MORE THAN TWO WORDS AND/OR A NUMBER).\n\nTrong Section 1 và Section 2, người nói thường tự sửa lại thông tin (distractors) như 'Oh sorry, we moved the workshop to Thursday instead of Tuesday'. Luôn nghe trọn câu trước khi chốt đáp án!",
        content_en:
          "Use the preview pause to predict grammar (noun, number, date) and check word limits carefully. Watch out for self-corrections (distractors) where speakers revise a time, price, or location.",
        keyTakeaways: [
          "Kiểm tra giới hạn số từ trước khi nghe.",
          "Cẩn thận với bẫy tự sửa thông tin (actually, sorry, instead).",
          "Kiểm tra số ít/số nhiều và chính tả sau khi điền.",
        ],
      },
    ],
  },
  {
    id: "course-2",
    slug: "but-pha-ielts-writing-7-5",
    title_vi: "Bứt phá IELTS Writing Academic 7.5+",
    title_en: "IELTS Academic Writing Intensive 7.5+",
    description_vi:
      "Phương pháp phân tích biểu đồ Task 1 sắc bén và xây dựng lập luận Task 2 mạch lạc bằng collocations tự nhiên.",
    description_en:
      "Write insightful Task 1 overviews and cohesive Task 2 arguments using natural academic collocations.",
    level: "Trung cấp – Nâng cao",
    target_band: "7.5+",
    duration_hours: 14,
    is_published: true,
    lessons: [
      {
        id: "c2-l1",
        title_vi: "Bài 1: Viết đoạn Overview đắt giá cho Task 1",
        title_en: "Lesson 1: Crafting a High-Scoring Task 1 Overview",
        duration_min: 25,
        content_vi:
          "Đoạn Overview là trái tim của bài Academic Task 1. Nếu thiếu Overview rõ ràng, điểm Task Achievement gần như bị chặn ở Band 5.0.\n\nMột Overview tốt gồm 2 câu tóm tắt 2–3 xu hướng nổi bật nhất (xu hướng chung tăng/giảm, nhóm dẫn đầu, nhóm thấp nhất hoặc thay đổi lớn nhất) mà KHÔNG liệt kê số liệu chi tiết.",
        content_en:
          "A clear Overview is essential to reach Band 7+ in Task Achievement. Summarize the two or three main trends or standout categories in two concise sentences without quoting specific numbers.",
        keyTakeaways: [
          "Đặt Overview ngay sau câu Introduction.",
          "Không đưa số liệu phần trăm chi tiết vào Overview.",
          "So sánh điểm cao nhất, thấp nhất và xu hướng tổng thể.",
        ],
      },
      {
        id: "c2-l2",
        title_vi: "Bài 2: Cấu trúc đoạn thân bài PEEL cho Task 2",
        title_en: "Lesson 2: Structuring Cohesive Body Paragraphs with PEEL",
        duration_min: 30,
        content_vi:
          "Mô hình PEEL (Point – Explanation – Example – Link) giúp đoạn văn thân bài không bao giờ lan man:\n1. Point: Câu chủ đề nêu rõ 1 ý chính.\n2. Explanation: Giải thích cơ chế tại sao điều đó xảy ra.\n3. Example: Ví dụ thực tế hoặc tình huống điển hình.\n4. Link: Chốt lại liên hệ trực tiếp với câu hỏi đề bài.",
        content_en:
          "The PEEL method (Point, Explanation, Example, Link) keeps every Task 2 body paragraph focused, logically developed, and easy for examiners to follow.",
        keyTakeaways: [
          "Mỗi đoạn thân bài tập trung vào 1–2 luận điểm được phân tích sâu.",
          "Tránh liệt kê 4–5 ý rời rạc không giải thích.",
          "Dùng đại từ tham chiếu (this trend, such measures) để tăng tính mạch lạc.",
        ],
      },
    ],
  },
  {
    id: "course-3",
    slug: "phan-xa-speaking-tu-nhien-part-1-2-3",
    title_vi: "Phản xạ IELTS Speaking Tự nhiên Parts 1–3",
    title_en: "Natural Fluency for IELTS Speaking Parts 1–3",
    description_vi:
      "Mở rộng câu trả lời Part 1, ghi chú nhanh 1 phút cho Cue Card Part 2 và xử lý câu hỏi trừu tượng Part 3 tự tin.",
    description_en:
      "Extend Part 1 answers smoothly, plan Part 2 cue cards in 60 seconds, and tackle abstract Part 3 questions.",
    level: "Mọi trình độ",
    target_band: "7.0+",
    duration_hours: 12,
    is_published: true,
    lessons: [
      {
        id: "c3-l1",
        title_vi: "Bài 1: Công thức 3 bước trả lời Part 1 không bị cụt ý",
        title_en: "Lesson 1: The 3-Step Formula for Extended Part 1 Answers",
        duration_min: 18,
        content_vi:
          "Trong Part 1, câu trả lời quá ngắn (1 câu) không đủ dữ liệu để giám khảo đánh giá vốn từ và ngữ pháp. Hãy dùng công thức A–R–E:\n- Answer: Trả lời trực tiếp câu hỏi.\n- Reason: Nêu 1 lý do tự nhiên.\n- Example / Contrast: Thêm ví dụ ngắn hoặc so sánh quá khứ – hiện tại.\nĐộ dài lý tưởng là 2–4 câu (khoảng 15–25 giây).",
        content_en:
          "Use the Answer–Reason–Example (ARE) structure to produce natural 15–25 second Part 1 responses without sounding rehearsed.",
        keyTakeaways: [
          "Giữ câu trả lời tự nhiên trong 2–4 câu.",
          "Dùng cụm từ nối giao tiếp tự nhiên: Honestly, To be fair, Back in high school...",
          "Tập trung phát âm rõ âm cuối và ngữ điệu lên xuống.",
        ],
      },
      {
        id: "c3-l2",
        title_vi: "Bài 2: Lập dàn ý Cue Card Part 2 trong 60 giây",
        title_en: "Lesson 2: Structuring a 2-Minute Part 2 Cue Card in 60 Seconds",
        duration_min: 22,
        content_vi:
          "Trong 1 phút chuẩn bị, đừng viết cả câu! Chỉ ghi 5–7 từ khóa theo trục thời gian: Bối cảnh (Before) → Sự kiện chính (During) → Cảm xúc & bài học (After). Cách kể chuyện theo dòng thời gian giúp bạn nói trôi chảy đủ 2 phút mà không bị bí ý giữa chừng.",
        content_en:
          "Spend your 60-second prep jotting down keywords along a Past–Event–Reflection timeline so you can speak fluently for the full two minutes.",
        keyTakeaways: [
          "Chỉ ghi từ khóa (keywords), không viết thành câu hoàn chỉnh.",
          "Đảm bảo trả lời đủ 4 gợi ý trên thẻ cue card.",
          "Thêm cảm xúc cá nhân để câu chuyện sinh động.",
        ],
      },
    ],
  },
];

export const DEFAULT_DICTATION_LESSONS: DictationLesson[] = [
  {
    id: "dict-1",
    slug: "campus-library-orientation",
    title_vi: "Hướng dẫn sử dụng Thư viện Đại học (Listening Part 1)",
    title_en: "University Library Orientation (Listening Part 1)",
    category: "Listening Part 1",
    difficulty: "Band 5.5–6.5",
    accent: "en-GB",
    sentences: [
      {
        id: "d1-1",
        text: "Welcome to the central campus library orientation for new students.",
        translation_vi: "Chào mừng đến với buổi hướng dẫn sử dụng thư viện trung tâm dành cho sinh viên mới.",
        tip_vi: "Chú ý nối âm 'welcome to' và âm cuối /s/ ở 'students'.",
      },
      {
        id: "d1-2",
        text: "Undergraduates may borrow up to twelve printed books for three weeks.",
        translation_vi: "Sinh viên đại học có thể mượn tối đa 12 cuốn sách in trong vòng ba tuần.",
        tip_vi: "Nghe kỹ con số 'twelve' và 'three weeks'.",
      },
      {
        id: "d1-3",
        text: "Quiet study booths on the third floor must be booked online in advance.",
        translation_vi: "Các phòng học yên tĩnh trên tầng ba phải được đặt trước qua mạng.",
        tip_vi: "Chú ý cụm bị động 'must be booked' và 'in advance'.",
      },
      {
        id: "d1-4",
        text: "Please remember to carry your student card whenever you enter the building.",
        translation_vi: "Vui lòng nhớ mang theo thẻ sinh viên mỗi khi bạn vào tòa nhà.",
        tip_vi: "Chú ý từ 'whenever' và trọng âm của 'remember'.",
      },
    ],
  },
  {
    id: "dict-2",
    slug: "urban-vertical-farming",
    title_vi: "Nông nghiệp thẳng đứng tại đô thị (Listening Part 4)",
    title_en: "Urban Vertical Farming Trends (Listening Part 4)",
    category: "Listening Part 4",
    difficulty: "Band 6.5–7.5",
    accent: "en-AU",
    sentences: [
      {
        id: "d2-1",
        text: "Vertical farming grows fresh produce in stacked indoor layers using controlled lighting.",
        translation_vi: "Nông nghiệp thẳng đứng trồng nông sản tươi theo các tầng xếp chồng trong nhà với ánh sáng được kiểm soát.",
        tip_vi: "Chú ý từ học thuật 'produce' (danh từ: /ˈprɒdjuːs/) và 'stacked'.",
      },
      {
        id: "d2-2",
        text: "Because water is recycled continuously, these systems use far less moisture than traditional fields.",
        translation_vi: "Vì nước được tuần hoàn liên tục, các hệ thống này dùng ít nước hơn rất nhiều so với cánh đồng truyền thống.",
        tip_vi: "Nghe kỹ trạng từ 'continuously' và so sánh 'far less'.",
      },
      {
        id: "d2-3",
        text: "However, high electricity costs remain a major challenge for commercial expansion.",
        translation_vi: "Tuy nhiên, chi phí điện năng cao vẫn là thách thức lớn cho việc mở rộng thương mại.",
        tip_vi: "Chú ý từ nối chuyển hướng 'However' và cụm 'commercial expansion'.",
      },
    ],
  },
  {
    id: "dict-3",
    slug: "coffee-culture-and-productivity",
    title_vi: "Văn hóa cà phê & Thói quen làm việc hiện đại (Daily English)",
    title_en: "Coffee Culture & Modern Work Habits",
    category: "Speaking & Daily",
    difficulty: "Band 6.0–7.0",
    accent: "en-US",
    sentences: [
      {
        id: "d3-1",
        text: "Many remote workers prefer local cafes because gentle background noise boosts concentration.",
        translation_vi: "Nhiều người làm việc từ xa thích quán cà phê địa phương vì tiếng ồn nền nhẹ nhàng giúp tăng sự tập trung.",
      },
      {
        id: "d3-2",
        text: "Taking a short break away from screens often leads to more creative problem solving.",
        translation_vi: "Nghỉ giải lao ngắn rời xa màn hình thường dẫn đến khả năng giải quyết vấn đề sáng tạo hơn.",
      },
      {
        id: "d3-3",
        text: "Nevertheless, drinking too much caffeine late in the afternoon can disrupt sleep quality.",
        translation_vi: "Tuy vậy, uống quá nhiều caffeine vào cuối buổi chiều có thể làm rối loạn chất lượng giấc ngủ.",
      },
    ],
  },
];

export const DEFAULT_LEARN_VIDEOS: LearnVideo[] = [
  {
    id: "vid-1",
    slug: "ky-thuat-paraphrase-trong-ielts-writing",
    youtube_id: "M7lc1UVf-VE",
    title_vi: "5 Kỹ thuật Paraphrase tự nhiên cho IELTS Writing & Reading",
    title_en: "5 Natural Paraphrasing Techniques for IELTS Writing & Reading",
    description_vi:
      "Học cách biến đổi cấu trúc câu chủ động/bị động, thay đổi từ loại và dùng từ đồng nghĩa đúng ngữ cảnh học thuật.",
    description_en:
      "Learn how to transform active/passive voice, shift word forms, and select accurate academic synonyms.",
    level: "Band 6.0–7.5",
    duration_label: "08:45",
    transcript: [
      {
        startSec: 0,
        endSec: 12,
        en: "Welcome back to Ôn IELTS. Today we will explore five practical paraphrasing strategies that sound natural in academic writing.",
        vi: "Chào mừng trở lại với Ôn IELTS. Hôm nay chúng ta sẽ khám phá 5 chiến thuật diễn đạt lại tự nhiên trong viết học thuật.",
      },
      {
        startSec: 12,
        endSec: 25,
        en: "The first mistake learners often make is replacing every single word with a rare dictionary synonym.",
        vi: "Sai lầm đầu tiên người học hay mắc là cố gắng thay từng từ bằng một từ đồng nghĩa hiếm trong từ điển.",
      },
      {
        startSec: 25,
        endSec: 40,
        en: "Instead, try shifting word forms—for example, turning the verb 'pollute rapidly' into the noun phrase 'rapid environmental pollution'.",
        vi: "Thay vào đó, hãy thử đổi từ loại — ví dụ biến động từ 'pollute rapidly' thành cụm danh từ 'rapid environmental pollution'.",
      },
      {
        startSec: 40,
        endSec: 55,
        en: "Our second strategy is switching between active and passive structures while preserving the original meaning clearly.",
        vi: "Chiến thuật thứ hai là chuyển đổi linh hoạt giữa câu chủ động và bị động mà vẫn giữ nguyên vẹn ý nghĩa ban đầu.",
      },
      {
        startSec: 55,
        endSec: 70,
        en: "Finally, always reread your paraphrased sentence aloud to confirm that the collocations feel effortless and precise.",
        vi: "Cuối cùng, hãy luôn đọc lại câu vừa viết để chắc chắn các cụm từ kết hợp thật mượt mà và chính xác.",
      },
    ],
  },
  {
    id: "vid-2",
    slug: "meo-nghe-map-labelling-ielts-listening",
    youtube_id: "aqz-KE-bpKQ",
    title_vi: "Chinh phục dạng Map Labelling trong IELTS Listening Part 2",
    title_en: "Conquering Map Labelling in IELTS Listening Part 2",
    description_vi:
      "Nắm vững từ vựng chỉ phương hướng (clockwise, opposite, adjacent to, just past) để không bao giờ lạc hướng trên bản đồ.",
    description_en:
      "Master spatial prepositions and directional cues so you never lose track during Part 2 map tasks.",
    level: "Band 5.5–7.0",
    duration_label: "06:30",
    transcript: [
      {
        startSec: 0,
        endSec: 14,
        en: "Before the audio begins, always locate the entrance or the 'You Are Here' arrow on the map.",
        vi: "Trước khi âm thanh bắt đầu, hãy luôn xác định vị trí lối vào hoặc mũi tên 'You Are Here' trên bản đồ.",
      },
      {
        startSec: 14,
        endSec: 28,
        en: "Next, glance at the compass rose in the corner so you know immediately which direction is north, south, east, and west.",
        vi: "Tiếp theo, liếc nhanh la bàn ở góc bản đồ để biết ngay hướng Bắc, Nam, Đông, Tây.",
      },
      {
        startSec: 28,
        endSec: 44,
        en: "Pay close attention to prepositions such as 'adjacent to', 'directly opposite', and 'branching off to the left'.",
        vi: "Đặc biệt chú ý các giới từ vị trí như 'adjacent to' (kế bên), 'directly opposite' (đối diện trực tiếp) và 'branching off to the left' (rẽ sang trái).",
      },
      {
        startSec: 44,
        endSec: 60,
        en: "Use your pencil or cursor to trace the speaker's path in real time—this prevents confusion when a landmark is mentioned twice.",
        vi: "Dùng bút hoặc con trỏ di chuyển theo lộ trình người nói theo thời gian thực để không bị rối khi một địa điểm được nhắc hai lần.",
      },
    ],
  },
  {
    id: "vid-3",
    slug: "cach-keo-dai-speaking-part-2-tu-nhien",
    youtube_id: "ysz5S6PUM-U",
    title_vi: "Cách nói trôi chảy 2 phút IELTS Speaking Part 2 không cần học thuộc",
    title_en: "How to Speak Fluently for 2 Minutes in Speaking Part 2",
    description_vi:
      "Bí quyết kể chuyện tự nhiên theo trục Quá khứ – Hiện tại – Cảm nhận giúp bài nói Part 2 giàu cảm xúc và đúng trọng tâm.",
    description_en:
      "Use a simple storytelling framework to deliver engaging, well-paced two-minute Cue Card talks.",
    level: "Band 6.0–8.0",
    duration_label: "07:20",
    transcript: [
      {
        startSec: 0,
        endSec: 15,
        en: "Many candidates freeze after forty seconds in Speaking Part 2 because they rush straight through the four bullet points.",
        vi: "Nhiều thí sinh bị khựng lại sau 40 giây ở Speaking Part 2 vì trả lời quá nhanh cả 4 gạch đầu dòng.",
      },
      {
        startSec: 15,
        endSec: 32,
        en: "A much calmer technique is painting a brief scene first: mention when it happened, who was with you, and why it stood out.",
        vi: "Một kỹ thuật bình tĩnh hơn nhiều là phác họa bối cảnh trước: nhắc thời điểm xảy ra, ai đi cùng bạn và vì sao khoảnh khắc đó đặc biệt.",
      },
      {
        startSec: 32,
        endSec: 50,
        en: "Then spend the final thirty seconds reflecting on what you learned or how you would do it differently next time.",
        vi: "Sau đó dành 30 giây cuối chia sẻ điều bạn rút ra hoặc bạn sẽ làm khác đi thế nào trong lần tới.",
      },
    ],
  },
];

export const DEFAULT_BLOG_POSTS: BlogPost[] = [
  {
    id: "blog-1",
    slug: "lo-trinh-tu-hoc-ielts-6-5-trong-3-thang",
    title_vi: "Lộ trình tự học IELTS từ 5.0 lên 6.5 trong 12 tuần cho người bận rộn",
    title_en: "12-Week Self-Study Roadmap from IELTS 5.0 to 6.5 for Busy Learners",
    excerpt_vi:
      "Phân bổ thời gian 90 phút mỗi ngày khoa học giữa 4 kỹ năng, kết hợp Đề thi mỗi ngày và Flashcard lặp lại ngắt quãng.",
    excerpt_en:
      "A practical 90-minute daily schedule balancing all four skills with Daily Exams and spaced-repetition flashcards.",
    content_vi: `### Tuần 1–4: Xây nền vững chắc & sửa lỗi gốc
Trong 4 tuần đầu, mục tiêu không phải là giải đề ồ ạt mà là vá lỗ hổng ngữ pháp và phát âm. Hãy dành 30 phút mỗi ngày học phát âm IPA và chép chính tả 1 đoạn ngắn 3–4 câu. Song song đó, đọc các bài Reading ngắn để tích lũy từ vựng học thuật vào bộ Flashcard cá nhân.

### Tuần 5–8: Luyện kỹ thuật từng dạng câu hỏi
Chuyển sang làm từng phần riêng lẻ của Reading và Listening (như Matching Headings, T/F/NG, Map Labelling). Với Writing, mỗi tuần viết 2 bài Task 1 và 2 bài Task 2 rồi sử dụng AI chấm lỗi trực tiếp để nhận diện mẫu lỗi lặp lại của bản thân.

### Tuần 9–12: Thi thử bấm giờ chuẩn & tối ưu tốc độ
Mỗi tuần làm trọn vẹn 2 đề thi chuẩn máy tính dưới áp lực thời gian thật. Ghi lại điểm mạnh và dạng câu hay sai trong bảng Tiến độ để tập trung ôn đúng trọng tâm trước ngày thi.`,
    content_en: `### Weeks 1–4: Strengthen Core Foundations
Focus on fixing recurring pronunciation habits using IPA drills, short daily dictation, and core academic vocabulary saved to spaced-repetition flashcards.

### Weeks 5–8: Master Individual Question Types
Drill tricky Reading and Listening formats (True/False/Not Given, Matching Headings, Map Labelling) and write two timed essays per week with structured AI criterion feedback.

### Weeks 9–12: Full Timed Simulation
Complete two full computer-delivered mock tests per week, tracking question-type accuracy in your Progress dashboard to close the final gaps before exam day.`,
    category: "Lộ trình học",
    author_name: "Đội ngũ học thuật Ôn IELTS",
    read_minutes: 6,
    published_at: "2026-11-10T08:00:00.000Z",
    is_published: true,
  },
  {
    id: "blog-2",
    slug: "quy-tac-lam-tron-diem-overall-ielts",
    title_vi: "Hiểu rõ quy tắc làm tròn điểm Overall IELTS (6.25 lên 6.5, 6.75 lên 7.0)",
    title_en: "Official IELTS Overall Band Rounding Rules Explained",
    excerpt_vi:
      "Cách tính điểm trung bình 4 kỹ năng chính xác nhất để đặt mục tiêu thông minh cho từng môn Nghe – Nói – Đọc – Viết.",
    excerpt_en:
      "How the four-skill average rounds to the nearest half or whole band so you can plan your target scores strategically.",
    content_vi: `### Công thức tính điểm Overall
Điểm Overall IELTS là trung bình cộng của 4 kỹ năng (Listening, Reading, Writing, Speaking), sau đó được làm tròn đến bậc 0.5 gần nhất theo quy tắc:
- Phần thập phân **.25** được làm tròn LÊN **.5** (ví dụ: 6.25 → **6.5**).
- Phần thập phân **.75** được làm tròn LÊN số nguyên kế tiếp (ví dụ: 6.75 → **7.0**).
- Phần thập phân **.125** làm tròn xuống **.0** (ví dụ: 6.125 → **6.0**).
- Phần thập phân **.625** làm tròn xuống **.5** (ví dụ: 6.625 → **6.5**).

### Chiến lược phân bổ điểm thông minh
Để đạt Overall 7.0, bạn chỉ cần tổng 4 kỹ năng đạt **27.0 điểm** (trung bình 6.75 → làm tròn 7.0), ví dụ: Listening 7.5, Reading 7.5, Writing 6.0, Speaking 6.0! Hãy thử ngay công cụ Tính điểm Band của Ôn IELTS để lập kế hoạch điểm số tối ưu cho riêng bạn.`,
    content_en: `### How Overall Rounding Works
Take the mean of Listening, Reading, Writing, and Speaking, then apply standard IELTS rounding:
- **.25** rounds UP to **.5** (e.g., 6.25 → **6.5**)
- **.75** rounds UP to the next whole band (e.g., 6.75 → **7.0**)
- **.125** rounds DOWN to **.0**, and **.625** rounds DOWN to **.5**.

Use our interactive Band Calculator to plan the smartest four-skill combination for your target score.`,
    category: "Kiến thức IELTS",
    author_name: "Đội ngũ học thuật Ôn IELTS",
    read_minutes: 4,
    published_at: "2026-11-18T08:00:00.000Z",
    is_published: true,
  },
  {
    id: "blog-3",
    slug: "5-loi-phat-am-pho-bien-cua-nguoi-viet",
    title_vi: "5 lỗi phát âm tiếng Anh phổ biến nhất của người Việt khi thi IELTS Speaking",
    title_en: "5 Common Pronunciation Pitfalls for Vietnamese IELTS Candidates",
    excerpt_vi:
      "Từ quên âm cuối /s/, /t/, /ed/ đến nhầm lẫn /θ/ và /ð/ — cách tự phát hiện và sửa nhanh chỉ sau 15 phút luyện mỗi ngày.",
    excerpt_en:
      "From dropped final consonants to dental fricatives /θ/ and /ð/ — practical ways to improve clarity fast.",
    content_vi: `### 1. Bỏ sót âm cuối (Final Consonants)
Tiếng Việt không bật hơi các phụ âm cuối như /t/, /d/, /k/, /s/, /z/. Khi nói tiếng Anh, việc thiếu âm cuối khiến từ như 'write', 'ride', 'rice' nghe giống hệt nhau.

### 2. Nhầm lẫn nguyên âm ngắn và dài (/ɪ/ vs /iː/, /ʊ/ vs /uː/)
Phân biệt độ căng cơ miệng và độ dài âm giúp câu nói rõ nghĩa hơn ngay lập tức.

### 3. Đọc sai cặp âm răng /θ/ và /ð/
Đặt nhẹ đầu lưỡi giữa hai hàm răng thay vì đọc thành âm 'th' hoặc 'd' tiếng Việt.

### 4. Đọc đều không có trọng âm từ và trọng âm câu
Tiếng Anh là ngôn ngữ nhịp trọng âm (stress-timed). Nhấn mạnh vào từ mang nội dung chính (content words) và lướt nhẹ các giới từ/mạo từ bằng âm Schwa /ə/.

### 5. Ngữ điệu phẳng khi kết thúc câu
Tập kết hợp công cụ Luyện phát âm IPA và Shadowing trên Ôn IELTS để nghe và điều chỉnh ngữ điệu tự nhiên.`,
    content_en: `Focusing on final consonants, vowel length contrasts, dental sounds /θ/ and /ð/, word stress, and natural sentence rhythm delivers immediate gains in Speaking intelligibility.`,
    category: "Speaking & Phát âm",
    author_name: "Đội ngũ học thuật Ôn IELTS",
    read_minutes: 5,
    published_at: "2026-11-22T08:00:00.000Z",
    is_published: true,
  },
];

export const DEFAULT_FLASHCARD_SETS: FlashcardSet[] = [
  {
    id: "set-academic-core",
    user_id: "demo-free-001",
    title: "Từ vựng Học thuật IELTS Cốt lõi",
    description: "Các từ và cụm từ tần suất cao trong Reading & Writing Task 2",
    is_public: true,
    created_at: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "set-environment",
    user_id: "demo-free-001",
    title: "Chủ đề Môi trường & Đô thị",
    description: "Collocations ăn điểm Band 7.5+ cho Writing và Speaking Part 3",
    is_public: true,
    created_at: "2026-11-10T08:00:00.000Z",
  },
];

export const DEFAULT_FLASHCARDS: FlashcardItem[] = [
  {
    id: "fc-1",
    set_id: "set-academic-core",
    user_id: "demo-free-001",
    term: "mitigate",
    phonetic: "/ˈmɪtɪɡeɪt/",
    part_of_speech: "verb",
    definition_vi: "giảm nhẹ, làm dịu bớt (tác hại, rủi ro)",
    definition_en: "to make something less harmful, unpleasant, or bad",
    example_sentence: "Expanding public transit networks can significantly mitigate urban traffic congestion.",
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 1,
    next_review_at: "2026-11-24T00:00:00.000Z",
    created_at: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "fc-2",
    set_id: "set-academic-core",
    user_id: "demo-free-001",
    term: "exacerbate",
    phonetic: "/ɪɡˈzæsəbeɪt/",
    part_of_speech: "verb",
    definition_vi: "làm trầm trọng thêm (một vấn đề sẵn có)",
    definition_en: "to make an existing problem or bad situation worse",
    example_sentence: "Unregulated urban sprawl tends to exacerbate housing affordability issues.",
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    next_review_at: "2026-11-24T00:00:00.000Z",
    created_at: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "fc-3",
    set_id: "set-academic-core",
    user_id: "demo-free-001",
    term: "unprecedented",
    phonetic: "/ʌnˈpresɪdentɪd/",
    part_of_speech: "adjective",
    definition_vi: "chưa từng có tiền lệ",
    definition_en: "never having happened or existed in the past",
    example_sentence: "Remote learning platforms experienced unprecedented growth over the past decade.",
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    next_review_at: "2026-11-24T00:00:00.000Z",
    created_at: "2026-11-02T08:00:00.000Z",
  },
  {
    id: "fc-4",
    set_id: "set-environment",
    user_id: "demo-free-001",
    term: "carbon footprint",
    phonetic: "/ˌkɑːbən ˈfʊtprɪnt/",
    part_of_speech: "noun phrase",
    definition_vi: "lượng khí thải carbon (dấu chân carbon)",
    definition_en: "the total greenhouse gases emitted directly or indirectly by an activity",
    example_sentence: "Consumers can lower their carbon footprint by choosing locally sourced food.",
    ease_factor: 2.5,
    interval_days: 0,
    repetitions: 0,
    next_review_at: "2026-11-24T00:00:00.000Z",
    created_at: "2026-11-10T08:00:00.000Z",
  },
];

export const DEFAULT_FEATURE_REQUESTS: FeatureRequestItem[] = [
  {
    id: "fr-1",
    title: "Thêm chế độ luyện nghe tăng tốc 1.25x cho Listening",
    description: "Giúp học viên mục tiêu 8.0+ rèn phản xạ nghe nhanh hơn tốc độ phòng thi.",
    votes: 48,
    status: "shipped",
    created_at: "2026-10-20T08:00:00.000Z",
  },
  {
    id: "fr-2",
    title: "Xuất bộ Flashcard ra file CSV / Anki",
    description: "Cho phép tải danh sách từ đã lưu để ôn offline trên điện thoại.",
    votes: 35,
    status: "planned",
    created_at: "2026-11-05T08:00:00.000Z",
  },
  {
    id: "fr-3",
    title: "Luyện Speaking phòng thi mô phỏng 15 phút trọn gói",
    description: "Kết nối liên tục Part 1 → Part 2 → Part 3 và trả về 1 bảng điểm tổng hợp.",
    votes: 62,
    status: "open",
    created_at: "2026-11-19T08:00:00.000Z",
  },
];

// Initial test previews — expanded in Phase 5 into full 12 multi-section original tests (3 per skill)
export const INITIAL_TEST_PREVIEWS: IeltsTest[] = [
  {
    id: "test-r-1",
    slug: "academic-reading-01-urban-microclimates",
    skill: "reading",
    module: "academic",
    title_vi: "Reading Academic 01: Vi khí hậu đô thị & Kiến trúc xanh",
    title_en: "Academic Reading 01: Urban Microclimates & Green Architecture",
    description_vi: "Đề luyện đọc học thuật gồm T/F/NG, Matching Headings, Summary Completion và MCQ.",
    description_en: "Original academic reading test featuring T/F/NG, Matching Headings, Summary Completion, and MCQ.",
    duration_minutes: 60,
    difficulty: "band_6_7",
    questionCount: 14,
    is_published: true,
    is_daily_eligible: true,
    sections: [],
    created_at: "2026-11-01T08:00:00.000Z",
  },
  {
    id: "test-l-1",
    slug: "listening-01-community-heritage-centre",
    skill: "listening",
    module: "academic",
    title_vi: "Listening 01: Trung tâm Di sản Cộng đồng & Nghiên cứu Biển",
    title_en: "Listening 01: Community Heritage Centre & Marine Research",
    description_vi: "4 phần nghe chuẩn IELTS với Form Completion, Map Labelling, MCQ và Note Completion.",
    description_en: "4-section listening test with Form Completion, Map Labelling, MCQ, and Note Completion.",
    duration_minutes: 30,
    difficulty: "band_6_7",
    questionCount: 14,
    is_published: true,
    is_daily_eligible: true,
    sections: [],
    created_at: "2026-11-02T08:00:00.000Z",
  },
  {
    id: "test-w-1",
    slug: "writing-academic-01-renewable-energy-remote-work",
    skill: "writing",
    module: "academic",
    title_vi: "Writing Academic 01: Biểu đồ Năng lượng tái tạo & Làm việc từ xa",
    title_en: "Academic Writing 01: Renewable Energy Chart & Remote Work Essay",
    description_vi: "Đề thi viết Academic trọn bộ Task 1 & Task 2 kèm chấm AI 4 tiêu chí.",
    description_en: "Full Academic Writing Task 1 & Task 2 prompt with instant AI 4-criterion scoring.",
    duration_minutes: 60,
    difficulty: "band_6_7",
    questionCount: 2,
    is_published: true,
    sections: [],
    created_at: "2026-11-03T08:00:00.000Z",
  },
  {
    id: "test-s-1",
    slug: "speaking-01-hometown-lifelong-learning",
    skill: "speaking",
    module: "academic",
    title_vi: "Speaking 01: Quê hương, Kỹ năng mới & Học tập suốt đời",
    title_en: "Speaking 01: Hometown, Learning a Skill & Lifelong Education",
    description_vi: "Bộ đề Speaking đầy đủ Part 1, Cue Card Part 2 và thảo luận Part 3 có ghi âm chấm AI.",
    description_en: "Complete Speaking Parts 1, 2, and 3 simulation with browser recording and AI scoring.",
    duration_minutes: 15,
    difficulty: "band_6_7",
    questionCount: 3,
    is_published: true,
    sections: [],
    created_at: "2026-11-04T08:00:00.000Z",
  },
];
