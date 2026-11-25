import type { IeltsTest } from "./types";

/**
 * 12 100% ORIGINAL practice tests (3 per IELTS skill: Reading, Listening, Writing, Speaking).
 * Authored cleanly from scratch for Ôn IELTS — zero third-party or copyrighted test material.
 */
export const FULL_SEED_TESTS: IeltsTest[] = [
  // =========================================================================
  // READING TESTS (3 ORIGINAL TESTS COVERING ALL QUESTION TYPES)
  // =========================================================================
  {
    id: "test-r-1",
    slug: "academic-reading-01-urban-microclimates",
    skill: "reading",
    module: "academic",
    title_vi: "Reading Academic 01: Vi khí hậu đô thị & Kiến trúc xanh",
    title_en: "Academic Reading 01: Urban Microclimates & Green Architecture",
    description_vi:
      "Đề đọc học thuật nguyên bản gồm T/F/NG, Matching Headings, Summary Completion, MCQ và Short Answer.",
    description_en:
      "Original Academic Reading featuring T/F/NG, Matching Headings, Summary Completion, MCQ, and Short Answer.",
    duration_minutes: 60,
    difficulty: "band_6_7",
    questionCount: 10,
    is_published: true,
    is_daily_eligible: true,
    created_at: "2026-11-01T08:00:00.000Z",
    sections: [
      {
        id: "r1-s1",
        title: "Passage 1: Cooling Tropical Cities Through Urban Design",
        instruction: "Read the passage carefully and answer Questions 1–10.",
        passage: `Paragraph A
Across rapidly expanding cities in Southeast Asia, daytime concrete temperatures frequently exceed those of neighboring agricultural valleys by four to six degrees Celsius. Meteorologists call this localized warming the Urban Heat Island (UHI) effect. Dark asphalt avenues, glass-clad office towers, and dense arrays of air-conditioning exhaust units absorb intense solar radiation during peak afternoon hours and release stored heat well past midnight.

Paragraph B
Historically, urban engineers addressed rising indoor heat almost exclusively by enlarging mechanical cooling grids. While air conditioning provides immediate comfort inside individual offices, waste heat expelled onto surrounding sidewalks raises ambient street temperatures further, triggering a self-reinforcing cycle of electricity demand. During heatwaves, peak cooling loads can strain municipal transformers and disproportionately burden lower-income households.

Paragraph C
In response, landscape architects have revived passive cooling principles adapted for dense twenty-first-century districts. In Ho Chi Minh City and Singapore alike, planners increasingly orient new residential blocks along prevailing monsoon corridors so natural breezes flush warm air out of narrow courtyards. Shaded arcades, perforated brick facades, and high-albedo reflective roof coatings can cut roof-surface heat absorption by nearly forty percent without consuming a single kilowatt of power.

Paragraph D
Urban forestry plays an equally measurable role. Field sensors installed beneath continuous street-tree canopies record pedestrian-level air temperatures up to 3.2 degrees cooler than unshaded concrete plazas just fifty meters away. Crucially, trees cool streets through two distinct mechanisms: blocking direct solar radiation and releasing water vapor through evapotranspiration. However, ecologists caution that planting ornamental species with shallow roots in cramped concrete pits often leads to high sapling mortality unless underground soil trenches are properly linked.`,
        headingBank: [
          { id: "i", text: "Passive architectural solutions using wind and reflective surfaces" },
          { id: "ii", text: "Why mechanical cooling alone intensifies urban heat" },
          { id: "iii", text: "Causes of elevated temperatures in expanding cities" },
          { id: "iv", text: "Dual cooling benefits and planting conditions of city trees" },
          { id: "v", text: "Financial subsidies offered to suburban farmers" },
        ],
        questions: [
          {
            id: "r1-q1",
            number: 1,
            type: "matching_headings",
            prompt: "Choose the most suitable heading for Paragraph A.",
            options: ["i", "ii", "iii", "iv", "v"],
            correctAnswers: ["iii"],
            explanation_vi: "Đoạn A giải thích hiện tượng đảo nhiệt đô thị (UHI) và các nguyên nhân (đường nhựa tối màu, tòa nhà kính, cục nóng điều hòa).",
            explanation_en: "Paragraph A introduces the Urban Heat Island effect and explains why cities become hotter than rural areas.",
            sectionRef: "Paragraph A",
          },
          {
            id: "r1-q2",
            number: 2,
            type: "matching_headings",
            prompt: "Choose the most suitable heading for Paragraph B.",
            options: ["i", "ii", "iii", "iv", "v"],
            correctAnswers: ["ii"],
            explanation_vi: "Đoạn B chỉ ra máy lạnh thải nhiệt ra ngoài khiến đường phố nóng thêm, tạo vòng lặp tiêu thụ điện.",
            explanation_en: "Paragraph B explains how air-conditioning exhaust creates a self-reinforcing warming cycle.",
            sectionRef: "Paragraph B",
          },
          {
            id: "r1-q3",
            number: 3,
            type: "matching_headings",
            prompt: "Choose the most suitable heading for Paragraph C.",
            options: ["i", "ii", "iii", "iv", "v"],
            correctAnswers: ["i"],
            explanation_vi: "Đoạn C mô tả các giải pháp kiến trúc thụ động: hành lang gió mùa, mái sơn phản xạ nhiệt không tốn điện.",
            explanation_en: "Paragraph C focuses on passive design using wind corridors and reflective coatings.",
            sectionRef: "Paragraph C",
          },
          {
            id: "r1-q4",
            number: 4,
            type: "matching_headings",
            prompt: "Choose the most suitable heading for Paragraph D.",
            options: ["i", "ii", "iii", "iv", "v"],
            correctAnswers: ["iv"],
            explanation_vi: "Đoạn D nêu 2 cơ chế làm mát của cây xanh (che nắng & thoát hơi nước) kèm điều kiện trồng rễ ngầm.",
            explanation_en: "Paragraph D details trees' two cooling mechanisms and soil trench requirements.",
            sectionRef: "Paragraph D",
          },
          {
            id: "r1-q5",
            number: 5,
            type: "tfng",
            prompt: "Dark road surfaces in Southeast Asian cities stop releasing absorbed heat immediately after sunset.",
            options: ["TRUE", "FALSE", "NOT GIVEN"],
            correctAnswers: ["FALSE"],
            explanation_vi: "Đoạn A nói rõ chúng 'release stored heat well past midnight' (tỏa nhiệt tích tụ đến tận quá nửa đêm), trái ngược với câu hỏi.",
            explanation_en: "Paragraph A states surfaces release stored heat 'well past midnight', contradicting 'immediately after sunset'.",
            sectionRef: "Paragraph A",
          },
          {
            id: "r1-q6",
            number: 6,
            type: "tfng",
            prompt: "High-albedo reflective roof coatings require significant electricity to operate efficiently.",
            options: ["TRUE", "FALSE", "NOT GIVEN"],
            correctAnswers: ["FALSE"],
            explanation_vi: "Đoạn C nhấn mạnh giải pháp này giảm gần 40% nhiệt 'without consuming a single kilowatt of power'.",
            explanation_en: "Paragraph C notes reflective coatings work 'without consuming a single kilowatt of power'.",
            sectionRef: "Paragraph C",
          },
          {
            id: "r1-q7",
            number: 7,
            type: "tfng",
            prompt: "Singapore currently spends a larger share of its national budget on urban forestry than Ho Chi Minh City.",
            options: ["TRUE", "FALSE", "NOT GIVEN"],
            correctAnswers: ["NOT GIVEN"],
            explanation_vi: "Bài đọc có nhắc đến cả TP.HCM và Singapore ở đoạn C nhưng hoàn toàn không so sánh ngân sách giữa hai nơi.",
            explanation_en: "Both cities are mentioned in Paragraph C, but no budget comparison is given.",
            sectionRef: "Paragraph C",
          },
          {
            id: "r1-q8",
            number: 8,
            type: "summary_completion",
            prompt: "Complete the summary (ONE WORD ONLY): Trees lower street temperatures by blocking sunlight and releasing moisture via __________.",
            correctAnswers: ["evapotranspiration"],
            explanation_vi: "Đoạn D ghi: 'releasing water vapor through evapotranspiration'.",
            explanation_en: "Paragraph D explicitly states 'releasing water vapor through evapotranspiration'.",
            sectionRef: "Paragraph D",
          },
          {
            id: "r1-q9",
            number: 9,
            type: "mcq",
            prompt: "According to Paragraph D, why do young ornamental trees often fail to survive along city streets?",
            options: [
              "A. They receive too little direct sunlight from tall towers.",
              "B. They are planted in isolated small pits lacking connected soil space.",
              "C. Monsoon winds uproot them before maturity.",
              "D. Reflective pavements overheat their leaves.",
            ],
            correctAnswers: ["B", "B. They are planted in isolated small pits lacking connected soil space."],
            explanation_vi: "Cuối đoạn D chỉ ra trồng cây rễ nông trong hố bê tông chật hẹp thiếu rãnh đất nối liền khiến cây non dễ chết.",
            explanation_en: "Paragraph D warns that shallow-rooted trees in cramped pits suffer high mortality without linked soil trenches.",
            sectionRef: "Paragraph D",
          },
          {
            id: "r1-q10",
            number: 10,
            type: "short_answer",
            prompt: "Short Answer (NO MORE THAN TWO WORDS AND/OR A NUMBER): By approximately what percentage can passive roof and facade methods reduce roof heat absorption?",
            correctAnswers: ["40%", "forty percent", "nearly 40%", "40 percent"],
            explanation_vi: "Đoạn C ghi rõ 'cut roof-surface heat absorption by nearly forty percent'.",
            explanation_en: "Paragraph C states 'by nearly forty percent'.",
            sectionRef: "Paragraph C",
          },
        ],
      },
    ],
  },
  {
    id: "test-r-2",
    slug: "academic-reading-02-ancient-maritime-navigation",
    skill: "reading",
    module: "academic",
    title_vi: "Reading Academic 02: Hàng hải cổ đại & Robot sinh học",
    title_en: "Academic Reading 02: Ancient Navigation & Bio-Inspired Robotics",
    description_vi:
      "Luyện dạng Y/N/NG, Matching Information, Flow-chart Completion, Table Completion và Sentence Completion.",
    description_en:
      "Practice Y/N/NG, Matching Information, Flow-chart Completion, Table Completion, and Sentence Completion.",
    duration_minutes: 60,
    difficulty: "band_7_plus",
    questionCount: 8,
    is_published: true,
    is_daily_eligible: true,
    created_at: "2026-11-02T08:00:00.000Z",
    sections: [
      {
        id: "r2-s1",
        title: "Passage 1: Reading the Ocean Before Satellites",
        instruction: "Read the text and answer Questions 1–8.",
        passage: `Section A
Long before magnetic compasses or GPS receivers existed, Pacific and Southeast Asian seafarers crossed thousands of kilometers of open water with astonishing reliability. Rather than treating the ocean as a featureless desert, master navigators memorized star paths along the horizon and read subtle intersections of ocean swells refracting around unseen islands.

Section B
To transmit this spatial knowledge across generations, Micronesian navigators constructed stick charts from slender coconut palm ribs lashed with plant fiber and dotted with cowrie shells representing atolls. Importantly, these tactile charts were never carried aboard canoes during voyages; apprentices studied them on land to internalize wave-refraction patterns before setting sail.

Section C
Modern marine roboticists are now borrowing similar multi-sensory logic for autonomous underwater vehicles (AUVs). Because radio signals attenuate within meters beneath saltwater, engineers equip sleek robotic gliders with lateral pressure arrays modeled on fish sensory lines. First, sensors capture minute flow variations; next, onboard processors filter background turbulence; finally, the glider adjusts its buoyancy bladder to ride deep currents while conserving battery reserves.

Section D
I believe the revival of indigenous wayfinding offers far more than historical nostalgia. It reminds contemporary technologists that resilience comes from pairing lightweight environmental awareness with disciplined human observation—not merely adding heavier power-hungry hardware.`,
        questions: [
          {
            id: "r2-q1",
            number: 1,
            type: "ynng",
            prompt: "The writer believes traditional navigation principles still hold practical lessons for modern engineers.",
            options: ["YES", "NO", "NOT GIVEN"],
            correctAnswers: ["YES"],
            explanation_vi: "Đoạn D tác giả khẳng định việc hồi sinh tri thức định hướng bản địa 'offers far more than historical nostalgia' và nhắc nhở các nhà công nghệ hiện đại.",
            explanation_en: "In Section D, the writer explicitly states wayfinding offers practical lessons for modern technologists.",
            sectionRef: "Section D",
          },
          {
            id: "r2-q2",
            number: 2,
            type: "ynng",
            prompt: "Micronesian navigators routinely consulted coconut stick charts while steering their canoes at sea.",
            options: ["YES", "NO", "NOT GIVEN"],
            correctAnswers: ["NO"],
            explanation_vi: "Đoạn B nêu rõ 'these tactile charts were never carried aboard canoes during voyages' — học viên chỉ học thuộc trên đất liền.",
            explanation_en: "Section B states the charts were 'never carried aboard canoes during voyages'.",
            sectionRef: "Section B",
          },
          {
            id: "r2-q3",
            number: 3,
            type: "matching_info",
            prompt: "Which section explains why standard wireless signals fail underwater?",
            options: ["A", "B", "C", "D"],
            correctAnswers: ["C"],
            explanation_vi: "Đoạn C giải thích sóng vô tuyến (radio signals) suy hao chỉ trong vài mét dưới nước mặn.",
            explanation_en: "Section C states that 'radio signals attenuate within meters beneath saltwater'.",
            sectionRef: "Section C",
          },
          {
            id: "r2-q4",
            number: 4,
            type: "matching_info",
            prompt: "Which section describes the natural materials used to build teaching maps?",
            options: ["A", "B", "C", "D"],
            correctAnswers: ["B"],
            explanation_vi: "Đoạn B liệt kê gân lá dừa, sợi thực vật và vỏ ốc cowrie.",
            explanation_en: "Section B lists coconut palm ribs, plant fiber, and cowrie shells.",
            sectionRef: "Section B",
          },
          {
            id: "r2-q5",
            number: 5,
            type: "flowchart_completion",
            prompt: "Flow-chart (ONE WORD): Pressure arrays detect flow changes → Processors filter out background __________ → Glider adjusts buoyancy.",
            correctAnswers: ["turbulence"],
            explanation_vi: "Đoạn C: 'onboard processors filter background turbulence'.",
            explanation_en: "Section C states 'filter background turbulence'.",
            sectionRef: "Section C",
          },
          {
            id: "r2-q6",
            number: 6,
            type: "table_completion",
            prompt: "Table Completion (ONE WORD): Stick chart feature | Material: Coconut palm ribs & plant fiber | Island markers: Cowrie __________.",
            correctAnswers: ["shells"],
            explanation_vi: "Đoạn B: 'dotted with cowrie shells representing atolls'.",
            explanation_en: "Section B specifies 'cowrie shells'.",
            sectionRef: "Section B",
          },
          {
            id: "r2-q7",
            number: 7,
            type: "sentence_completion",
            prompt: "Sentence Completion (ONE WORD): Robotic gliders ride deep ocean currents in order to conserve their __________ reserves.",
            correctAnswers: ["battery"],
            explanation_vi: "Cuối đoạn C: 'while conserving battery reserves'.",
            explanation_en: "Section C states 'conserving battery reserves'.",
            sectionRef: "Section C",
          },
          {
            id: "r2-q8",
            number: 8,
            type: "mcq",
            prompt: "What biological feature inspired the pressure sensors on modern robotic gliders?",
            options: [
              "A. Whale vocal chords",
              "B. Fish sensory lines",
              "C. Seabird wing feathers",
              "D. Turtle magnetic receptors",
            ],
            correctAnswers: ["B", "B. Fish sensory lines"],
            explanation_vi: "Đoạn C ghi 'lateral pressure arrays modeled on fish sensory lines'.",
            explanation_en: "Section C states 'modeled on fish sensory lines'.",
            sectionRef: "Section C",
          },
        ],
      },
    ],
  },
  {
    id: "test-r-3",
    slug: "general-reading-03-workplace-wellbeing-guide",
    skill: "reading",
    module: "general",
    title_vi: "Reading General 03: Cẩm nang Không gian Làm việc Linh hoạt",
    title_en: "General Reading 03: Flexible Co-Working & Member Handbook",
    description_vi:
      "Đề General Training thực tế với Note Completion, T/F/NG, Map Labelling và Short Answer.",
    description_en:
      "Practical General Training Reading featuring Note Completion, T/F/NG, Map Labelling, and Short Answer.",
    duration_minutes: 60,
    difficulty: "band_5_6",
    questionCount: 6,
    is_published: true,
    is_daily_eligible: true,
    created_at: "2026-11-03T08:00:00.000Z",
    sections: [
      {
        id: "r3-s1",
        title: "Section 1: Riverside Hub Co-Working Member Guide",
        instruction: "Read the member notice below and answer Questions 1–6.",
        passage: `Welcome to Riverside Hub! Our shared workspace operates daily from 7:00 a.m. to 10:00 p.m. All full-time members receive a digital keycard upon completing a five-minute safety briefing at reception.

Workspace Zones:
• Focus Library (North Wing): Strictly silent zone. Phone calls and video meetings are not permitted here.
• Collaboration Lounge (East Wing): Casual seating for group brainstorming and client coffees.
• Soundproof Call Pods (West Wing): Free for 45-minute slots; reserve through the member portal at least 15 minutes ahead.
• Rooftop Pantry (South Balcony): Complimentary Vietnamese drip coffee, herbal tea, and filtered water. Please label personal lunch boxes with your name and date; unlabeled containers are cleared every Friday at 6:00 p.m.

Printing & Locker Policies:
Each member receives 50 free black-and-white prints monthly. Overnight storage lockers require a refundable deposit of 200,000 VND at reception.`,
        questions: [
          {
            id: "r3-q1",
            number: 1,
            type: "note_completion",
            prompt: "Note Completion (ONE WORD AND/OR A NUMBER): Closing time each evening: __________ p.m.",
            correctAnswers: ["10", "10:00"],
            explanation_vi: "Đoạn đầu ghi mở cửa từ 7:00 a.m. đến 10:00 p.m.",
            explanation_en: "The hub operates until 10:00 p.m.",
          },
          {
            id: "r3-q2",
            number: 2,
            type: "tfng",
            prompt: "Members may take brief video calls inside the Focus Library if they wear headphones.",
            options: ["TRUE", "FALSE", "NOT GIVEN"],
            correctAnswers: ["FALSE"],
            explanation_vi: "Focus Library cấm hoàn toàn gọi điện và họp video ('Phone calls and video meetings are not permitted here').",
            explanation_en: "Video meetings are strictly not permitted in the Focus Library.",
          },
          {
            id: "r3-q3",
            number: 3,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Maximum free duration per Soundproof Call Pod booking: __________ minutes.",
            correctAnswers: ["45"],
            explanation_vi: "Call Pods miễn phí theo khung 45 phút.",
            explanation_en: "Call pods are free for 45-minute slots.",
          },
          {
            id: "r3-q4",
            number: 4,
            type: "short_answer",
            prompt: "Short Answer (ONE WORD): On which day of the week are unlabeled food containers removed from the pantry?",
            correctAnswers: ["Friday"],
            explanation_vi: "Hộp thức ăn không dán nhãn sẽ được dọn vào 6 giờ chiều thứ Sáu hàng tuần.",
            explanation_en: "Unlabeled containers are cleared every Friday.",
          },
          {
            id: "r3-q5",
            number: 5,
            type: "map_labelling",
            prompt: "Floor Plan Direction: Which wing contains the Collaboration Lounge?",
            options: ["North Wing", "East Wing", "West Wing", "South Balcony"],
            correctAnswers: ["East Wing"],
            explanation_vi: "Collaboration Lounge nằm tại East Wing.",
            explanation_en: "Collaboration Lounge is located in the East Wing.",
          },
          {
            id: "r3-q6",
            number: 6,
            type: "short_answer",
            prompt: "Short Answer (ONE NUMBER): How many complimentary black-and-white pages can a member print per month?",
            correctAnswers: ["50", "fifty"],
            explanation_vi: "Mỗi thành viên có 50 trang in đen trắng miễn phí hàng tháng.",
            explanation_en: "Each member receives 50 free black-and-white prints monthly.",
          },
        ],
      },
    ],
  },

  // =========================================================================
  // LISTENING TESTS (3 ORIGINAL TESTS WITH AUDIO SCRIPTS & SVG MAPS/DIAGRAMS)
  // =========================================================================
  {
    id: "test-l-1",
    slug: "listening-01-community-heritage-centre",
    skill: "listening",
    module: "academic",
    title_vi: "Listening 01: Trung tâm Di sản Cộng đồng & Nghiên cứu Biển",
    title_en: "Listening 01: Community Heritage Centre & Marine Research",
    description_vi:
      "Đề nghe 4 phần nguyên bản gồm Form Completion, Map Labelling (có bản đồ SVG), MCQ và Note Completion.",
    description_en:
      "Original Listening test featuring Form Completion, SVG Map Labelling, MCQ, and Note Completion.",
    duration_minutes: 30,
    difficulty: "band_6_7",
    questionCount: 8,
    is_published: true,
    is_daily_eligible: true,
    created_at: "2026-11-04T08:00:00.000Z",
    sections: [
      {
        id: "l1-s1",
        title: "Part 1 & 2: Coastal Heritage Centre Tour & Floor Map",
        instruction: "Press Play to listen to the audio briefing, then answer Questions 1–8.",
        diagramLabel: "Coastal Heritage Centre — Ground Floor Map",
        diagramSvgType: "museum_floor",
        audioScript: `Welcome to the Coastal Heritage Centre! Before you explore our exhibitions, let me share a few booking details and help you orient yourself on the ground-floor map.

First, for weekend guided workshops, tickets cost twelve dollars for adults, while university students pay just seven dollars upon showing a valid student card. Please note our traditional boat-building demonstration was recently moved from Tuesday to Thursday afternoon at two-thirty.

Now let's look at the ground floor map in front of you. You are currently standing at the Main Entrance at the bottom center. Directly opposite the entrance across the central courtyard is Zone A, our Wooden Boat Gallery, which houses a restored nineteenth-century fishing vessel.

If you turn left from the entrance and walk into the West Corner, labeled Zone B, you will find the Audio Archive Room where visitors can listen to oral histories from local fishermen.

Turning right from the entrance takes you to Zone C in the East Corner, our Botanical Tea Café overlooking the garden. Finally, located right beside the North Exit in Zone D is the Museum Bookshop, where you can pick up bilingual maps and postcards.

In the second half of our talk on marine research, Dr. Minh reminds students that coral nurseries thrive best when ocean temperatures stay below twenty-nine degrees and water clarity remains high. Volunteers monitor reef recovery every month using waterproof slates rather than fragile tablets.`,
        questions: [
          {
            id: "l1-q1",
            number: 1,
            type: "note_completion",
            prompt: "Form Completion (ONE NUMBER): Discounted workshop ticket price for university students: $__________.",
            correctAnswers: ["7", "seven"],
            explanation_vi: "Người hướng dẫn nói vé người lớn 12 đô, còn sinh viên đại học chỉ 7 đô ('university students pay just seven dollars').",
            explanation_en: "University students pay seven dollars with a valid student card.",
          },
          {
            id: "l1-q2",
            number: 2,
            type: "note_completion",
            prompt: "Form Completion (ONE WORD): New day for the traditional boat-building demonstration: __________.",
            correctAnswers: ["Thursday"],
            explanation_vi: "Chú ý bẫy tự sửa (distractor): đã chuyển từ thứ Ba sang chiều thứ Năm ('moved from Tuesday to Thursday').",
            explanation_en: "Watch the distractor: it moved from Tuesday to Thursday.",
          },
          {
            id: "l1-q3",
            number: 3,
            type: "map_labelling",
            prompt: "Map Labelling: Which zone on the map is the Wooden Boat Gallery?",
            options: ["Zone A", "Zone B", "Zone C", "Zone D"],
            correctAnswers: ["Zone A", "A"],
            explanation_vi: "Đối diện trực tiếp lối vào chính là Zone A — Wooden Boat Gallery.",
            explanation_en: "Directly opposite the entrance is Zone A, the Wooden Boat Gallery.",
          },
          {
            id: "l1-q4",
            number: 4,
            type: "map_labelling",
            prompt: "Map Labelling: Which zone on the map is the Audio Archive Room?",
            options: ["Zone A", "Zone B", "Zone C", "Zone D"],
            correctAnswers: ["Zone B", "B"],
            explanation_vi: "Rẽ trái từ lối vào sang góc Tây là Zone B — Audio Archive Room.",
            explanation_en: "Left from the entrance in the West Corner is Zone B.",
          },
          {
            id: "l1-q5",
            number: 5,
            type: "map_labelling",
            prompt: "Map Labelling: Which zone on the map is the Botanical Tea Café?",
            options: ["Zone A", "Zone B", "Zone C", "Zone D"],
            correctAnswers: ["Zone C", "C"],
            explanation_vi: "Rẽ phải từ lối vào sang góc Đông là Zone C — Botanical Tea Café.",
            explanation_en: "Right from the entrance in the East Corner is Zone C.",
          },
          {
            id: "l1-q6",
            number: 6,
            type: "map_labelling",
            prompt: "Map Labelling: Which zone on the map is the Museum Bookshop?",
            options: ["Zone A", "Zone B", "Zone C", "Zone D"],
            correctAnswers: ["Zone D", "D"],
            explanation_vi: "Ngay cạnh cổng Bắc là Zone D — Museum Bookshop.",
            explanation_en: "Beside the North Exit in Zone D is the Museum Bookshop.",
          },
          {
            id: "l1-q7",
            number: 7,
            type: "sentence_completion",
            prompt: "Sentence Completion (ONE NUMBER): Coral nurseries grow best when water stays below __________ degrees Celsius.",
            correctAnswers: ["29", "twenty-nine"],
            explanation_vi: "Bản ghi nêu rõ 'stay below twenty-nine degrees'.",
            explanation_en: "The speaker specifies below twenty-nine degrees.",
          },
          {
            id: "l1-q8",
            number: 8,
            type: "mcq",
            prompt: "Why do reef volunteers record data on waterproof slates?",
            options: [
              "A. Tablets are too fragile for underwater fieldwork.",
              "B. Slates transmit live data by satellite.",
              "C. The museum ran out of paper notebooks.",
            ],
            correctAnswers: ["A", "A. Tablets are too fragile for underwater fieldwork."],
            explanation_vi: "Người nói giải thích dùng bảng chống nước thay vì máy tính bảng dễ hỏng ('rather than fragile tablets').",
            explanation_en: "Volunteers use waterproof slates instead of fragile tablets.",
          },
        ],
      },
    ],
  },
  {
    id: "test-l-2",
    slug: "listening-02-coastal-botanical-garden",
    skill: "listening",
    module: "academic",
    title_vi: "Listening 02: Vườn Thực vật & Chu trình Tái chế Nước mưa",
    title_en: "Listening 02: Botanical Garden & Rainwater Recycling Cycle",
    description_vi:
      "Luyện nghe Diagram Labelling (biểu đồ chu trình nước mưa), Matching và Summary Completion.",
    description_en:
      "Listening practice featuring Diagram Labelling, Matching, and Summary Completion.",
    duration_minutes: 30,
    difficulty: "band_6_7",
    questionCount: 6,
    is_published: true,
    is_daily_eligible: true,
    created_at: "2026-11-05T08:00:00.000Z",
    sections: [
      {
        id: "l2-s1",
        title: "Part 3 & 4: Rainwater Harvesting in Botanical Conservatories",
        instruction: "Listen to the lecture excerpt and answer Questions 1–6.",
        diagramLabel: "Conservatory Rainwater Cycle Diagram",
        diagramSvgType: "water_cycle",
        audioScript: `Today we are reviewing how our city's new Glass Conservatory irrigates three thousand rare orchids without drawing heavily from municipal tap water.

Step one begins on the curved roof panels, where rainwater flows into wide copper gutters designed to block falling leaves. Next, at Stage 2, runoff drops into an underground gravel filter that removes fine silt and organic debris.

Once filtered, the clean water collects in Stage 3 inside a buried concrete cistern holding up to eighty thousand liters. Keeping the cistern underground prevents algae growth because sunlight cannot reach the stored water.

Finally, at Stage 4, solar-powered drip pumps deliver gentle mist across the orchid terraces at dawn and dusk. According to our head botanist, switching to rainwater cut annual water bills by sixty-two percent while improving leaf health because rainwater contains no chlorine.`,
        questions: [
          {
            id: "l2-q1",
            number: 1,
            type: "note_completion",
            prompt: "Diagram Stage 1 (ONE WORD): Roof panels direct rainwater into wide __________ gutters.",
            correctAnswers: ["copper"],
            explanation_vi: "Bài nghe nói rõ 'wide copper gutters'.",
            explanation_en: "Rainwater flows into wide copper gutters.",
          },
          {
            id: "l2-q2",
            number: 2,
            type: "flowchart_completion",
            prompt: "Diagram Stage 2 (ONE WORD): An underground __________ filter removes fine silt.",
            correctAnswers: ["gravel"],
            explanation_vi: "Giai đoạn 2 đi qua lớp lọc sỏi ngầm ('underground gravel filter').",
            explanation_en: "An underground gravel filter traps silt and debris.",
          },
          {
            id: "l2-q3",
            number: 3,
            type: "note_completion",
            prompt: "Diagram Stage 3 (ONE NUMBER): Maximum cistern capacity: __________ thousand liters.",
            correctAnswers: ["80", "eighty"],
            explanation_vi: "Bể ngầm chứa tối đa 80.000 lít ('eighty thousand liters').",
            explanation_en: "The cistern holds up to eighty thousand liters.",
          },
          {
            id: "l2-q4",
            number: 4,
            type: "mcq",
            prompt: "Why is the concrete cistern buried underground?",
            options: [
              "A. To stop algae from growing by blocking sunlight.",
              "B. To warm the water during winter months.",
              "C. To leave extra space for visitor parking.",
            ],
            correctAnswers: ["A", "A. To stop algae from growing by blocking sunlight."],
            explanation_vi: "Đặt bể ngầm ngăn ánh nắng chiếu vào, tránh rêu tảo phát triển ('prevents algae growth').",
            explanation_en: "Keeping the cistern dark underground prevents algae growth.",
          },
          {
            id: "l2-q5",
            number: 5,
            type: "summary_completion",
            prompt: "Summary Completion (ONE NUMBER): Switching to rainwater reduced yearly water costs by __________ percent.",
            correctAnswers: ["62", "sixty-two", "62%"],
            explanation_vi: "Bài nghe nêu rõ 'cut annual water bills by sixty-two percent'.",
            explanation_en: "Annual water bills dropped by sixty-two percent.",
          },
          {
            id: "l2-q6",
            number: 6,
            type: "short_answer",
            prompt: "Short Answer (ONE WORD): Which chemical absent in rainwater makes it healthier for orchid leaves?",
            correctAnswers: ["chlorine"],
            explanation_vi: "Nước mưa không chứa clo ('contains no chlorine').",
            explanation_en: "Rainwater contains no chlorine.",
          },
        ],
      },
    ],
  },
  {
    id: "test-l-3",
    slug: "listening-03-university-podcast-project",
    skill: "listening",
    module: "academic",
    title_vi: "Listening 03: Dự án Podcast Sinh viên & Sơ đồ Khuôn viên",
    title_en: "Listening 03: Student Podcast Project & Campus Map",
    description_vi:
      "Hội thoại học thuật Part 3 giữa hai sinh viên và giảng viên với MCQ, Table Completion và Map Labelling.",
    description_en:
      "Academic Part 3 dialogue with MCQ, Table Completion, and Campus Map Labelling.",
    duration_minutes: 30,
    difficulty: "band_7_plus",
    questionCount: 6,
    is_published: true,
    is_daily_eligible: false,
    created_at: "2026-11-06T08:00:00.000Z",
    sections: [
      {
        id: "l3-s1",
        title: "Part 3: Planning a Bilingual Campus Science Podcast",
        instruction: "Listen to the planning discussion and answer Questions 1–6.",
        diagramLabel: "University Media Wing — Studio Layout",
        diagramSvgType: "campus_map",
        audioScript: `Lan: Hi Minh, thanks for meeting to finalize our campus science podcast proposal. Professor Hoa approved our pilot episode on urban acoustics, provided we keep each episode under eighteen minutes so commuters can finish it on one bus ride.

Minh: Great! I checked the recording studios in the Media Wing. Studio A at the north end has the best acoustic foam for two-person interviews, while Studio B in the center is reserved for video editing.

Lan: What about microphone booking? The technician mentioned we need to reserve condenser microphones forty-eight hours in advance, and remember to bring our own memory cards because the department stopped lending them last semester.

Minh: Got it. For our first guest, I originally invited a civil engineer, though she is traveling abroad, so we confirmed Dr. Phong from the Architecture Faculty instead. Also, adding short bilingual transcripts on the website should double our international student listeners.`,
        questions: [
          {
            id: "l3-q1",
            number: 1,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Maximum recommended length per episode: __________ minutes.",
            correctAnswers: ["18", "eighteen"],
            explanation_vi: "Giáo sư Hoa khuyên giữ mỗi tập dưới 18 phút ('under eighteen minutes').",
            explanation_en: "Each episode should stay under eighteen minutes.",
          },
          {
            id: "l3-q2",
            number: 2,
            type: "map_labelling",
            prompt: "Map Labelling: Which studio has acoustic foam best suited for two-person interviews?",
            options: ["Studio A", "Studio B"],
            correctAnswers: ["Studio A", "A"],
            explanation_vi: "Studio A ở đầu phía Bắc có mút tiêu âm tốt nhất cho phỏng vấn 2 người.",
            explanation_en: "Studio A at the north end has the best acoustic foam.",
          },
          {
            id: "l3-q3",
            number: 3,
            type: "table_completion",
            prompt: "Table Completion (ONE NUMBER): Condenser microphones must be booked __________ hours ahead.",
            correctAnswers: ["48", "forty-eight"],
            explanation_vi: "Cần đặt micro trước 48 giờ ('forty-eight hours in advance').",
            explanation_en: "Microphones require booking 48 hours in advance.",
          },
          {
            id: "l3-q4",
            number: 4,
            type: "short_answer",
            prompt: "Short Answer (TWO WORDS): What storage item must students bring themselves?",
            correctAnswers: ["memory cards", "memory card"],
            explanation_vi: "Khoa đã ngừng cho mượn thẻ nhớ nên sinh viên phải tự mang ('bring our own memory cards').",
            explanation_en: "Students must bring their own memory cards.",
          },
          {
            id: "l3-q5",
            number: 5,
            type: "mcq",
            prompt: "Who is confirmed as the guest for the pilot episode?",
            options: [
              "A. A visiting civil engineer",
              "B. Dr. Phong from the Architecture Faculty",
              "C. Professor Hoa",
            ],
            correctAnswers: ["B", "B. Dr. Phong from the Architecture Faculty"],
            explanation_vi: "Kỹ sư dân dụng đi công tác nước ngoài nên khách mời chốt là TS. Phong khoa Kiến trúc.",
            explanation_en: "The civil engineer is traveling, so Dr. Phong from Architecture is confirmed.",
          },
          {
            id: "l3-q6",
            number: 6,
            type: "sentence_completion",
            prompt: "Sentence Completion (ONE WORD): Publishing bilingual __________ online is expected to attract more international listeners.",
            correctAnswers: ["transcripts", "transcript"],
            explanation_vi: "Cuối bài nghe: 'adding short bilingual transcripts on the website'.",
            explanation_en: "Minh suggests adding short bilingual transcripts.",
          },
        ],
      },
    ],
  },

  // =========================================================================
  // WRITING TESTS (3 ORIGINAL TESTS)
  // =========================================================================
  {
    id: "test-w-1",
    slug: "writing-academic-01-renewable-energy-remote-work",
    skill: "writing",
    module: "academic",
    title_vi: "Writing Academic 01: Biểu đồ Năng lượng tái tạo & Làm việc từ xa",
    title_en: "Academic Writing 01: Renewable Energy Chart & Remote Work Essay",
    description_vi: "Đề viết Academic gồm Task 1 mô tả chuyển dịch điện sạch và Task 2 thảo luận về AI trong trường học.",
    description_en: "Academic Writing test featuring clean energy chart analysis and an essay on AI in schools.",
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
    description_vi: "Đề luyện viết dạng Problem–Solution về ùn tắc đô thị và đầu tư tàu điện công cộng.",
    description_en: "Problem–Solution Academic Writing prompt exploring metro investment and urban congestion.",
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
    description_vi: "Đề General Training Task 1 viết thư bán trang trọng gửi ban tổ chức trung tâm văn hóa.",
    description_en: "General Training Task 1 semi-formal letter to a community cultural centre coordinator.",
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
    description_vi: "Đề Speaking trọn bộ 3 phần với câu hỏi quen thuộc về quê hương và thảo luận học tập hiện đại.",
    description_en: "Full 3-part Speaking test covering hometown, a practical skill cue card, and lifelong learning.",
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
    description_vi: "Luyện miêu tả địa điểm ngoài trời Part 2 và thảo luận quy hoạch đô thị xanh Part 3.",
    description_en: "Describe an outdoor sanctuary in Part 2 and debate green city planning in Part 3.",
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
    description_vi: "Chủ đề truyền thông và đọc sách xuất hiện thường xuyên trong IELTS Speaking.",
    description_en: "High-frequency IELTS Speaking test focused on reading habits, audio media, and critical literacy.",
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
        topic: "Describe an informative article, book, or podcast that taught you something surprising.",
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
