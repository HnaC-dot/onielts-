export interface ToolOptionDef {
  key: string;
  labelVi: string;
  labelEn: string;
  choices: { value: string; labelVi: string; labelEn: string }[];
  defaultValue: string;
}

export interface GeneralAiToolConfig {
  slug: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  placeholderVi: string;
  placeholderEn: string;
  sampleInput: string;
  maxChars: number;
  systemPrompt: string;
  options: ToolOptionDef[];
}

export const GENERAL_AI_TOOLS: GeneralAiToolConfig[] = [
  {
    slug: "paraphraser",
    titleVi: "Paraphraser học thuật",
    titleEn: "Academic Paraphraser",
    descriptionVi:
      "Diễn đạt lại câu và đoạn văn tiếng Anh sang văn phong học thuật IELTS tự nhiên mà không làm đổi ý gốc.",
    descriptionEn:
      "Rewrite English sentences into natural IELTS academic style while preserving exact meaning.",
    placeholderVi: "Nhập câu hoặc đoạn tiếng Anh cần diễn đạt lại...",
    placeholderEn: "Enter English text to paraphrase...",
    sampleInput:
      "Many people think that big cities have too much traffic and pollution, so governments need to build better public transport.",
    maxChars: 2500,
    systemPrompt:
      "You are an expert IELTS Academic writing coach. Paraphrase the user's text according to the requested tone and target band. Provide the paraphrased version, 3-5 key vocabulary upgrades used, and a brief Vietnamese explanation of the changes.",
    options: [
      {
        key: "tone",
        labelVi: "Văn phong",
        labelEn: "Tone",
        defaultValue: "academic",
        choices: [
          { value: "academic", labelVi: "Học thuật (IELTS Academic)", labelEn: "Academic IELTS" },
          { value: "formal", labelVi: "Trang trọng (Formal)", labelEn: "Formal" },
          { value: "natural", labelVi: "Tự nhiên (Speaking)", labelEn: "Natural Speaking" },
          { value: "concise", labelVi: "Cô đọng (Concise)", labelEn: "Concise" },
        ],
      },
      {
        key: "targetBand",
        labelVi: "Mục tiêu Band",
        labelEn: "Target Band",
        defaultValue: "8.0",
        choices: [
          { value: "7.0", labelVi: "Band 7.0", labelEn: "Band 7.0" },
          { value: "8.0", labelVi: "Band 8.0", labelEn: "Band 8.0" },
          { value: "9.0", labelVi: "Band 8.5–9.0", labelEn: "Band 8.5–9.0" },
        ],
      },
    ],
  },
  {
    slug: "summarizer",
    titleVi: "Tóm tắt văn bản AI",
    titleEn: "AI Text Summarizer",
    descriptionVi:
      "Rút gọn bài đọc IELTS dài thành các ý chính cô đọng kèm danh sách từ khóa quan trọng giúp ôn luyện Reading nhanh hơn.",
    descriptionEn:
      "Condense long IELTS passages into crisp key points and essential vocabulary.",
    placeholderVi: "Dán đoạn bài đọc IELTS cần tóm tắt...",
    placeholderEn: "Paste a reading passage to summarize...",
    sampleInput:
      "Urban microclimates are created when dense networks of asphalt roads, concrete buildings, and dark rooftops absorb solar radiation throughout the day and release heat slowly at night. As a result, metropolitan centres often record temperatures three to five degrees higher than surrounding rural farmland. City planners are increasingly adopting reflective pavements, shaded tree corridors, and rooftop gardens to cool neighbourhoods while simultaneously reducing summer electricity demand.",
    maxChars: 5000,
    systemPrompt:
      "You are an IELTS Reading specialist. Summarize the user's text clearly in the requested format and length, extract 3-5 key academic terms with brief Vietnamese glosses, and summarize the main thesis in Vietnamese.",
    options: [
      {
        key: "format",
        labelVi: "Định dạng",
        labelEn: "Format",
        defaultValue: "bullets",
        choices: [
          { value: "bullets", labelVi: "Gạch đầu dòng ý chính", labelEn: "Bullet Points" },
          { value: "paragraph", labelVi: "Đoạn văn tóm tắt", labelEn: "Short Paragraph" },
          { value: "bilingual", labelVi: "Tóm tắt song ngữ EN + VI", labelEn: "Bilingual EN + VI" },
        ],
      },
      {
        key: "length",
        labelVi: "Độ dài",
        labelEn: "Length",
        defaultValue: "standard",
        choices: [
          { value: "brief", labelVi: "Siêu gọn (2–3 câu)", labelEn: "Brief" },
          { value: "standard", labelVi: "Tiêu chuẩn", labelEn: "Standard" },
        ],
      },
    ],
  },
  {
    slug: "translator",
    titleVi: "Dịch thuật Anh ⇄ Việt học thuật",
    titleEn: "EN ⇄ VI IELTS Translator",
    descriptionVi:
      "Dịch sát nghĩa học thuật giữa tiếng Anh và tiếng Việt, kèm phân tích collocations đắt giá cho IELTS.",
    descriptionEn:
      "Context-accurate English ⇄ Vietnamese translation with high-value IELTS collocations.",
    placeholderVi: "Nhập văn bản tiếng Anh hoặc tiếng Việt cần dịch...",
    placeholderEn: "Enter English or Vietnamese text to translate...",
    sampleInput:
      "Việc đầu tư vào hệ thống giao thông công cộng hiện đại không chỉ giảm ùn tắc mà còn cải thiện chất lượng không khí đô thị một cách bền vững.",
    maxChars: 3000,
    systemPrompt:
      "You are an IELTS bilingual academic translator (Vietnamese <-> English). Translate accurately for the selected direction and register. Highlight 3-5 useful collocations and explain nuanced phrasing in Vietnamese.",
    options: [
      {
        key: "direction",
        labelVi: "Chiều dịch",
        labelEn: "Direction",
        defaultValue: "auto",
        choices: [
          { value: "auto", labelVi: "Tự động phát hiện (EN ⇄ VI)", labelEn: "Auto-detect (EN ⇄ VI)" },
          { value: "vi_to_en", labelVi: "Việt → Anh học thuật", labelEn: "Vietnamese → English" },
          { value: "en_to_vi", labelVi: "Anh → Việt tự nhiên", labelEn: "English → Vietnamese" },
        ],
      },
      {
        key: "style",
        labelVi: "Phong cách",
        labelEn: "Register",
        defaultValue: "academic",
        choices: [
          { value: "academic", labelVi: "IELTS Academic Writing", labelEn: "Academic Writing" },
          { value: "speaking", labelVi: "IELTS Speaking tự nhiên", labelEn: "Natural Speaking" },
        ],
      },
    ],
  },
  {
    slug: "grammar-checker",
    titleVi: "Kiểm tra lỗi ngữ pháp",
    titleEn: "Grammar Checker",
    descriptionVi:
      "Phát hiện chi tiết lỗi thì động từ, mạo từ (a/an/the), hòa hợp chủ ngữ – động từ và giải thích rõ bằng tiếng Việt.",
    descriptionEn:
      "Identify tense, article, agreement, and punctuation errors with clear explanations.",
    placeholderVi: "Nhập câu hoặc đoạn tiếng Anh muốn kiểm tra lỗi ngữ pháp...",
    placeholderEn: "Paste English text to inspect for grammar issues...",
    sampleInput:
      "Nowadays, many student spend too much time on their phone which make them lose focus in class and affect badly to their study result.",
    maxChars: 3000,
    systemPrompt:
      "You are an IELTS Grammar Examiner. Inspect the user's text thoroughly, list every grammatical and lexical accuracy issue with original -> correction and Vietnamese explanation, and provide the corrected version.",
    options: [
      {
        key: "strictness",
        labelVi: "Mức độ chấm",
        labelEn: "Strictness",
        defaultValue: "examiner",
        choices: [
          { value: "examiner", labelVi: "Khắt khe như Giám khảo IELTS", labelEn: "IELTS Examiner Strict" },
          { value: "friendly", labelVi: "Gợi ý dễ hiểu (Cơ bản)", labelEn: "Friendly Tutor" },
        ],
      },
    ],
  },
  {
    slug: "grammar-corrector",
    titleVi: "Sửa lỗi ngữ pháp tức thì",
    titleEn: "Grammar Corrector",
    descriptionVi:
      "Tự động chỉnh sửa toàn bộ lỗi ngữ pháp & chính tả, trả về bản sạch lỗi nhưng giữ đúng ý diễn đạt của bạn.",
    descriptionEn:
      "Automatically produce an error-free version of your writing while keeping your own voice.",
    placeholderVi: "Nhập đoạn tiếng Anh cần sửa nhanh...",
    placeholderEn: "Enter text to correct immediately...",
    sampleInput:
      "Although technology bring many benefit for young people, it also cause several problem if they does not manage screen time carefully.",
    maxChars: 3000,
    systemPrompt:
      "You are a precision English proofreader. Correct all grammar, spelling, preposition, and punctuation mistakes in the user's text according to the chosen mode, and summarize key fixes in Vietnamese.",
    options: [
      {
        key: "mode",
        labelVi: "Chế độ sửa",
        labelEn: "Correction Mode",
        defaultValue: "minimal",
        choices: [
          { value: "minimal", labelVi: "Sửa tối thiểu (giữ câu gốc)", labelEn: "Minimal Edits" },
          { value: "fluent", labelVi: "Sửa tự nhiên mượt mà", labelEn: "Natural Fluency" },
        ],
      },
    ],
  },
  {
    slug: "text-improver",
    titleVi: "Nâng cấp đoạn văn lên Band 8+",
    titleEn: "IELTS Text Improver",
    descriptionVi:
      "Biến đoạn viết còn đơn giản thành bài viết mạch lạc, giàu collocations và đa dạng cấu trúc câu phức.",
    descriptionEn:
      "Upgrade plain drafts with stronger cohesion, academic collocations, and complex structures.",
    placeholderVi: "Nhập đoạn bài luận Task 1 hoặc Task 2 muốn nâng cấp...",
    placeholderEn: "Enter a Writing paragraph to upgrade...",
    sampleInput:
      "Working from home is very good for employees because they do not need to go to the office every day. They can save time and money. Also, they feel less stressed.",
    maxChars: 3500,
    systemPrompt:
      "You are a Band 9 IELTS Writing specialist. Rewrite and elevate the user's paragraph according to the target band and focus area. Provide the upgraded text, highlighted improvements, and practical Vietnamese tips.",
    options: [
      {
        key: "targetBand",
        labelVi: "Mục tiêu",
        labelEn: "Target",
        defaultValue: "8.0",
        choices: [
          { value: "7.5", labelVi: "Band 7.5 (Tự nhiên, dễ học)", labelEn: "Band 7.5" },
          { value: "8.5", labelVi: "Band 8.5+ (Học thuật cao)", labelEn: "Band 8.5+" },
        ],
      },
      {
        key: "focus",
        labelVi: "Trọng tâm nâng cấp",
        labelEn: "Focus Area",
        defaultValue: "all",
        choices: [
          { value: "all", labelVi: "Toàn diện (Từ vựng + Mạch lạc + Ngữ pháp)", labelEn: "Balanced All" },
          { value: "vocabulary", labelVi: "Từ vựng & Collocations", labelEn: "Lexical Resource" },
          { value: "cohesion", labelVi: "Liên kết câu & Mạch lập luận", labelEn: "Coherence & Cohesion" },
        ],
      },
    ],
  },
  {
    slug: "complex-sentence-explainer",
    titleVi: "Giải thích câu phức tiếng Anh",
    titleEn: "Complex Sentence Explainer",
    descriptionVi:
      "Bóc tách cấu trúc chủ – vị, mệnh đề quan hệ, đảo ngữ, phân từ và dịch nghĩa từng vế bằng tiếng Việt dễ hiểu.",
    descriptionEn:
      "Break down clauses, inversion, participles, and academic vocabulary step by step in Vietnamese.",
    placeholderVi: "Dán 1–2 câu tiếng Anh dài khó hiểu từ bài Reading...",
    placeholderEn: "Paste a dense complex sentence from Reading...",
    sampleInput:
      "Not only did the rapid expansion of coastal aquaculture boost rural incomes, but it also prompted ecologists to reassess the long-term resilience of mangrove wetlands.",
    maxChars: 1500,
    systemPrompt:
      "You are an IELTS Reading & Grammar teacher for Vietnamese learners. Break down the user's complex sentence into main clause, subordinate clauses, special grammar structures (inversion, participle clauses, relative clauses), translate into clear Vietnamese, and list key vocabulary.",
    options: [
      {
        key: "depth",
        labelVi: "Mức độ phân tích",
        labelEn: "Breakdown Depth",
        defaultValue: "detailed",
        choices: [
          { value: "detailed", labelVi: "Chi tiết từng mệnh đề & ngữ pháp", labelEn: "Detailed Clause Breakdown" },
          { value: "quick", labelVi: "Tóm tắt cấu trúc chính nhanh", labelEn: "Quick Core Structure" },
        ],
      },
    ],
  },
];

export function getGeneralAiTool(slug: string): GeneralAiToolConfig | undefined {
  return GENERAL_AI_TOOLS.find((t) => t.slug === slug);
}
