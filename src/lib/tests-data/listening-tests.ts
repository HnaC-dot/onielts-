import type { IeltsTest } from "../types";

/**
 * 3 Full-length 100% ORIGINAL IELTS Listening Tests (40 questions each, 4 Parts each = 120 questions total).
 * Every section includes:
 * - Real pre-generated multi-speaker neural English MP3 audio (`audioUrl`)
 * - Full synchronized transcript (`audioScript`)
 * - Authentic IELTS Part 1–4 progression (Everyday dialogue -> Tour/Map monologue -> Academic discussion -> University lecture)
 */
export const FULL_LISTENING_TESTS: IeltsTest[] = [
  // =========================================================================
  // LISTENING 01 — 40 QUESTIONS, 4 PARTS + 4 REAL MP3 FILES
  // =========================================================================
  {
    id: "test-l-1",
    slug: "listening-01-community-heritage-centre",
    skill: "listening",
    module: "academic",
    title_vi: "Listening 01 (Full 40 câu + Audio thật): Trung tâm Di sản, Bản đồ & Nghiên cứu Biển",
    title_en: "Listening 01 (Full 40Q + Real Audio): Heritage Centre, Floor Map & Marine Research",
    description_vi:
      "Đề nghe trọn bộ 4 Part – 40 câu kèm file âm thanh MP3 đa giọng Anh/Úc thật: đặt lịch hội thảo (Part 1), sơ đồ bảo tàng SVG (Part 2), thảo luận san hô (Part 3) và bài giảng thảm cỏ biển (Part 4).",
    description_en:
      "Full 4-part, 40-question Listening test with real multi-accent MP3 audio: workshop booking, SVG floor map, coral research dialogue, and seagrass blue-carbon lecture.",
    duration_minutes: 30,
    difficulty: "band_6_7",
    questionCount: 40,
    is_published: true,
    is_daily_eligible: true,
    created_at: "2026-11-04T08:00:00.000Z",
    sections: [
      {
        id: "l1-s1",
        title: "Part 1: Booking a Guided Heritage Workshop (Questions 1–10)",
        instruction: "Listen to a telephone conversation between a visitor and a receptionist at the Coastal Heritage Centre. Answer Questions 1–10.",
        audioUrl: "/audio/listening/l1-part1.mp3",
        audioScript: `Receptionist: Good morning, Coastal Heritage Centre, Hannah speaking. How can I help you today?

Visitor: Hello Hannah. I'm calling to book places for your weekend guided workshops. Could you confirm the ticket prices first?

Receptionist: Of course! Standard adult tickets are twelve dollars, while university students pay just seven dollars when they show a valid student card at the desk.

Visitor: Great, I'm a university student, so seven dollars works well. I wanted to join the traditional boat-building demonstration—is that still on Tuesday afternoon?

Receptionist: Actually, we recently moved the boat-building demonstration from Tuesday to Thursday afternoon at two-thirty, because our master carpenter teaches school groups on Tuesdays now.

Visitor: Thursday at two-thirty is even better! Can I register my name right now? It's Daniel Foster—that's F-O-S-T-E-R.

Receptionist: Got it, Daniel Foster. And what is the best contact phone number for you?

Visitor: Sure, it's 0419 882 350.

Receptionist: Lovely. Let me double-check: zero-four-one-nine, double-eight-two, three-five-zero. Do you have any dietary requests? The workshop includes a short afternoon tea break.

Visitor: Yes, I'm allergic to peanuts, so a nut-free snack would be appreciated. Also, is there bicycle parking near the entrance?

Receptionist: Yes, we have covered racks right beside the South Gate, free for all visitors. Just remember to bring your own lock.

Visitor: Wonderful. Should I arrive early to check in?

Receptionist: Please arrive fifteen minutes before the session starts so we can hand out safety aprons. And since we work with wood shavings, closed-toe shoes are mandatory—sandals aren't permitted in the workshop yard.

Visitor: Understood. And if it rains, does the session get canceled?

Receptionist: Never! In wet weather we simply shift from the courtyard into the Timber Hall upstairs. Your booking reference number is CH409.

Visitor: CH409. Thanks very much, Hannah!`,
        questions: [
          {
            id: "l1-q1",
            number: 1,
            type: "note_completion",
            prompt: "Form Completion (ONE NUMBER): Discounted workshop ticket price for university students: $__________.",
            correctAnswers: ["7", "seven"],
            explanation_vi: "Vé người lớn 12 đô, sinh viên đại học chỉ 7 đô ('university students pay just seven dollars').",
            explanation_en: "University students pay seven dollars with a valid student card.",
          },
          {
            id: "l1-q2",
            number: 2,
            type: "note_completion",
            prompt: "Form Completion (ONE WORD): New day for the traditional boat-building demonstration: __________.",
            correctAnswers: ["Thursday"],
            explanation_vi: "Chú ý bẫy tự sửa: đã chuyển từ Tuesday sang Thursday.",
            explanation_en: "Watch the distractor: it moved from Tuesday to Thursday.",
          },
          {
            id: "l1-q3",
            number: 3,
            type: "note_completion",
            prompt: "Form Completion (ONE TIME): Afternoon start time of the demonstration: __________ p.m.",
            correctAnswers: ["2:30", "2.30", "two-thirty", "two thirty"],
            explanation_vi: "Bắt đầu vào hai giờ rưỡi chiều ('at two-thirty').",
            explanation_en: "The demonstration starts at 2:30 p.m.",
          },
          {
            id: "l1-q4",
            number: 4,
            type: "note_completion",
            prompt: "Form Completion (ONE WORD): Visitor's surname: Daniel __________.",
            correctAnswers: ["Foster"],
            explanation_vi: "Người gọi đánh vần họ là F-O-S-T-E-R.",
            explanation_en: "The caller spells his surname F-O-S-T-E-R.",
          },
          {
            id: "l1-q5",
            number: 5,
            type: "note_completion",
            prompt: "Form Completion (NUMBER): Visitor's mobile phone number: 0419 __________.",
            correctAnswers: ["882350", "882 350"],
            explanation_vi: "Số điện thoại được nhắc lại: 0419 882 350.",
            explanation_en: "The phone number confirmed is 0419 882 350.",
          },
          {
            id: "l1-q6",
            number: 6,
            type: "note_completion",
            prompt: "Form Completion (ONE WORD): Food allergy noted for afternoon tea: __________.",
            correctAnswers: ["peanuts", "peanut"],
            explanation_vi: "Daniel nói anh bị dị ứng đậu phộng ('allergic to peanuts').",
            explanation_en: "Daniel states he is allergic to peanuts.",
          },
          {
            id: "l1-q7",
            number: 7,
            type: "note_completion",
            prompt: "Form Completion (TWO WORDS): Location of free covered bicycle racks: beside the __________.",
            correctAnswers: ["South Gate"],
            explanation_vi: "Giá để xe đạp có mái che nằm ngay cạnh South Gate.",
            explanation_en: "Covered bicycle racks are right beside the South Gate.",
          },
          {
            id: "l1-q8",
            number: 8,
            type: "note_completion",
            prompt: "Form Completion (ONE NUMBER): Recommended arrival time before workshop starts: __________ minutes early.",
            correctAnswers: ["15", "fifteen"],
            explanation_vi: "Lễ tân dặn đến trước 15 phút để nhận tạp dề bảo hộ.",
            explanation_en: "Visitors are asked to arrive fifteen minutes early.",
          },
          {
            id: "l1-q9",
            number: 9,
            type: "short_answer",
            prompt: "Short Answer (NO MORE THAN TWO WORDS): What type of footwear is required inside the workshop yard?",
            correctAnswers: ["closed-toe shoes", "closed toe shoes", "closed-toe"],
            explanation_vi: "Bắt buộc đi giày bít mũi ('closed-toe shoes are mandatory'), không cho đi dép xăng-đan.",
            explanation_en: "Closed-toe shoes are mandatory in the workshop yard.",
          },
          {
            id: "l1-q10",
            number: 10,
            type: "note_completion",
            prompt: "Form Completion (CODE): Visitor's booking reference code: __________.",
            correctAnswers: ["CH409"],
            explanation_vi: "Mã đặt chỗ được đọc hai lần là CH409.",
            explanation_en: "The booking reference number is CH409.",
          },
        ],
      },
      {
        id: "l1-s2",
        title: "Part 2: Coastal Heritage Centre Tour & Ground-Floor Map (Questions 11–20)",
        instruction: "Listen to a tour guide orienting visitors using the ground-floor map. Answer Questions 11–20.",
        diagramLabel: "Coastal Heritage Centre — Ground Floor Map",
        diagramSvgType: "museum_floor",
        audioUrl: "/audio/listening/l1-part2.mp3",
        audioScript: `Guide: Welcome everyone to the Coastal Heritage Centre! Before you explore our exhibitions, let me help you orient yourself on the ground-floor map in your brochure.

You are currently standing at the Main Entrance at the bottom center of the map. Directly opposite the entrance across the central courtyard is Zone A, our Wooden Boat Gallery, which houses a restored nineteenth-century fishing vessel crafted from local ironwood.

If you turn left from the entrance and walk into the West Corner, labeled Zone B, you will find the Audio Archive Room where visitors can put on headphones and listen to oral histories recorded by retired coastal fishermen.

Turning right from the entrance takes you to Zone C in the East Corner, our Botanical Tea Café overlooking the herb garden. They serve locally roasted coffee and ginger biscuits baked fresh every morning.

Finally, located right beside the North Exit in Zone D is the Museum Bookshop, where you can pick up bilingual maps, maritime history volumes, and handmade postcards.

Now, a quick update on our special events this month. Starting this Saturday, our Lighthouse Photography Exhibition opens on the upper gallery. Entry is included in your general ticket, though flash photography is prohibited to protect the delicate vintage silver prints.

For families visiting with young children, we offer free Explorer Backpacks at the reception desk—each bag contains a magnifying glass, a sketching pad, and a maritime scavenger hunt card. Simply leave a photo ID as a deposit and return the kit before closing time at five-thirty.

Lastly, please note that our harbor shuttle ferry runs every forty minutes from the pier just outside the North Exit. Today's final boat departs promptly at five-fifteen, so allow yourself enough time if you plan to take the scenic ride back to the city quay.`,
        questions: [
          {
            id: "l1-q11",
            number: 11,
            type: "map_labelling",
            prompt: "Map Labelling: Which zone on the map is the Wooden Boat Gallery?",
            options: ["Zone A", "Zone B", "Zone C", "Zone D"],
            correctAnswers: ["Zone A", "A"],
            explanation_vi: "Đối diện trực tiếp cổng chính qua sân trung tâm là Zone A — Wooden Boat Gallery.",
            explanation_en: "Directly opposite the entrance is Zone A, the Wooden Boat Gallery.",
          },
          {
            id: "l1-q12",
            number: 12,
            type: "map_labelling",
            prompt: "Map Labelling: Which zone on the map is the Audio Archive Room?",
            options: ["Zone A", "Zone B", "Zone C", "Zone D"],
            correctAnswers: ["Zone B", "B"],
            explanation_vi: "Rẽ trái sang góc Tây là Zone B — Audio Archive Room.",
            explanation_en: "Left from the entrance in the West Corner is Zone B.",
          },
          {
            id: "l1-q13",
            number: 13,
            type: "map_labelling",
            prompt: "Map Labelling: Which zone on the map is the Botanical Tea Café?",
            options: ["Zone A", "Zone B", "Zone C", "Zone D"],
            correctAnswers: ["Zone C", "C"],
            explanation_vi: "Rẽ phải sang góc Đông là Zone C — Botanical Tea Café.",
            explanation_en: "Right from the entrance in the East Corner is Zone C.",
          },
          {
            id: "l1-q14",
            number: 14,
            type: "map_labelling",
            prompt: "Map Labelling: Which zone on the map is the Museum Bookshop?",
            options: ["Zone A", "Zone B", "Zone C", "Zone D"],
            correctAnswers: ["Zone D", "D"],
            explanation_vi: "Ngay cạnh cổng Bắc (North Exit) là Zone D — Museum Bookshop.",
            explanation_en: "Beside the North Exit in Zone D is the Museum Bookshop.",
          },
          {
            id: "l1-q15",
            number: 15,
            type: "mcq",
            prompt: "What type of wood was used to build the nineteenth-century fishing vessel in Zone A?",
            options: [
              "A. Imported oak",
              "B. Local ironwood",
              "C. Recycled bamboo",
            ],
            correctAnswers: ["B", "B. Local ironwood"],
            explanation_vi: "Hướng dẫn viên nói chiếc thuyền được đóng từ gỗ lim địa phương ('local ironwood').",
            explanation_en: "The guide says the vessel was crafted from local ironwood.",
          },
          {
            id: "l1-q16",
            number: 16,
            type: "mcq",
            prompt: "Why is flash photography prohibited in the Lighthouse Photography Exhibition?",
            options: [
              "A. It disturbs the tour guides speaking nearby.",
              "B. It can damage delicate vintage silver prints.",
              "C. The gallery uses low-voltage solar lighting.",
            ],
            correctAnswers: ["B", "B. It can damage delicate vintage silver prints."],
            explanation_vi: "Cấm đèn flash để bảo vệ các bản in bạc cổ nhạy sáng ('protect the delicate vintage silver prints').",
            explanation_en: "Flash is prohibited to protect the delicate vintage silver prints.",
          },
          {
            id: "l1-q17",
            number: 17,
            type: "note_completion",
            prompt: "Note Completion (TWO WORDS): Families with young children can borrow free __________ at reception.",
            correctAnswers: ["Explorer Backpacks", "explorer backpack"],
            explanation_vi: "Bàn lễ tân cho mượn miễn phí ba lô 'Explorer Backpacks'.",
            explanation_en: "Reception lends free Explorer Backpacks to families.",
          },
          {
            id: "l1-q18",
            number: 18,
            type: "note_completion",
            prompt: "Note Completion (TWO WORDS): Item required as a deposit when borrowing a children's kit: a __________.",
            correctAnswers: ["photo ID"],
            explanation_vi: "Khách chỉ cần để lại giấy tờ tùy thân có ảnh ('leave a photo ID as a deposit').",
            explanation_en: "Visitors leave a photo ID as a deposit.",
          },
          {
            id: "l1-q19",
            number: 19,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Frequency of the harbor shuttle ferry: every __________ minutes.",
            correctAnswers: ["40", "forty"],
            explanation_vi: "Phà chạy mỗi 40 phút ('every forty minutes').",
            explanation_en: "The shuttle ferry runs every forty minutes.",
          },
          {
            id: "l1-q20",
            number: 20,
            type: "note_completion",
            prompt: "Note Completion (TIME): Departure time of the final shuttle ferry today: __________ p.m.",
            correctAnswers: ["5:15", "5.15", "five-fifteen", "five fifteen"],
            explanation_vi: "Chú ý bẫy: trung tâm đóng cửa lúc 5:30 nhưng chuyến phà cuối rời bến lúc 5:15.",
            explanation_en: "Closing time is 5:30, while the final ferry leaves promptly at 5:15.",
          },
        ],
      },
      {
        id: "l1-s3",
        title: "Part 3: Marine Fieldwork Tutorial on Coral Nurseries (Questions 21–30)",
        instruction: "Listen to a marine biology tutor and a student discussing a coral nursery fieldwork project. Answer Questions 21–30.",
        audioUrl: "/audio/listening/l1-part3.mp3",
        audioScript: `Tutor: Come in, Minh! Let's review your draft fieldwork proposal on coastal coral nurseries before next week's ethics submission. How is the literature review going?

Student: Thanks, Dr. Claire. It's coming together well. One key finding from our regional reef data is that coral nurseries thrive best when summer sea temperatures stay below twenty-nine degrees Celsius and water clarity remains high.

Tutor: Right—thermal stress above twenty-nine degrees triggers bleaching remarkably quickly. What equipment will your volunteer divers use to log monthly growth measurements?

Student: Originally I thought about underwater tablets, but they're too fragile for rough currents and expensive to replace, so we're switching to waterproof slates with ordinary graphite pencils.

Tutor: Very practical choice. Now, what about the nursery frame structure? Are you testing rope lines or concrete tables?

Student: We're comparing two frame types across two bays. In Bay One, which has calm sandy bottoms, we'll suspend horizontal fiberglass ropes about two meters above the seabed so sediment doesn't smother young fragments. In Bay Two, where currents are stronger, we'll anchor steel mesh tables.

Tutor: Smart comparison. How many coral fragments will you attach to each frame?

Student: I was planning sixty per frame, though the marine park officer advised limiting it to forty-five so water circulates evenly between branches and reduces disease transfer.

Tutor: Good that you listened to the park officer. Let's talk about your data analysis plan. Which indicator will you prioritize first: branch length or color chart scores?

Student: Color chart scores first, because fading pigment warns us of heat stress weeks before growth actually slows down. Then we'll measure branch length with plastic calipers every thirty days.

Tutor: Excellent. And how do you plan to involve local fishing communities?

Student: We're training twelve local boat captains to spot crown-of-thorns starfish outbreaks during their regular trips and send GPS pins through a simple messaging group.

Tutor: I love that citizen-science angle. Just make sure you add a clear safety protocol section covering buddy checks and emergency oxygen kits before Friday's deadline.

Student: Will do—I'll email the revised draft by Thursday evening.`,
        questions: [
          {
            id: "l1-q21",
            number: 21,
            type: "sentence_completion",
            prompt: "Sentence Completion (ONE NUMBER): Coral nurseries grow best when ocean temperatures stay below __________ degrees Celsius.",
            correctAnswers: ["29", "twenty-nine"],
            explanation_vi: "Minh nêu rõ nhiệt độ biển mùa hè cần dưới 29 độ C ('below twenty-nine degrees Celsius').",
            explanation_en: "Minh states coral nurseries thrive below twenty-nine degrees Celsius.",
          },
          {
            id: "l1-q22",
            number: 22,
            type: "mcq",
            prompt: "Why do the volunteers record underwater measurements on waterproof slates?",
            options: [
              "A. Tablets are too fragile and costly for rough currents.",
              "B. Slates transmit live GPS data by satellite.",
              "C. The university banned electronic devices in boats.",
            ],
            correctAnswers: ["A", "A. Tablets are too fragile and costly for rough currents."],
            explanation_vi: "Minh giải thích máy tính bảng dưới nước quá dễ hỏng và đắt để thay thế nên chuyển sang bảng chống nước.",
            explanation_en: "Minh says tablets are too fragile for rough currents and expensive to replace.",
          },
          {
            id: "l1-q23",
            number: 23,
            type: "table_completion",
            prompt: "Table Completion (ONE WORD): Bay One frame design | Material: horizontal __________ ropes suspended 2m above seabed.",
            correctAnswers: ["fiberglass", "fibreglass"],
            explanation_vi: "Ở Vịnh 1 dùng dây sợi thủy tinh nằm ngang ('horizontal fiberglass ropes').",
            explanation_en: "Bay One uses horizontal fiberglass ropes.",
          },
          {
            id: "l1-q24",
            number: 24,
            type: "table_completion",
            prompt: "Table Completion (TWO WORDS): Bay Two frame design | Anchored __________ tables to resist stronger currents.",
            correctAnswers: ["steel mesh", "steel"],
            explanation_vi: "Ở Vịnh 2 có dòng chảy mạnh nên neo bàn lưới thép ('steel mesh tables').",
            explanation_en: "Bay Two uses anchored steel mesh tables.",
          },
          {
            id: "l1-q25",
            number: 25,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Final number of coral fragments attached per frame (after park officer's advice): __________.",
            correctAnswers: ["45", "forty-five"],
            explanation_vi: "Chú ý bẫy: ban đầu định 60 nhưng cán bộ vườn biển khuyên giới hạn ở 45 nhánh để nước lưu thông đều.",
            explanation_en: "Originally planned 60, revised down to 45 per frame.",
          },
          {
            id: "l1-q26",
            number: 26,
            type: "mcq",
            prompt: "Why does Minh prioritize color chart scores over branch length?",
            options: [
              "A. Plastic calipers are too difficult to read underwater.",
              "B. Pigment loss reveals heat stress earlier than slower growth does.",
              "C. Color charts are required by the university ethics committee.",
            ],
            correctAnswers: ["B", "B. Pigment loss reveals heat stress earlier than slower growth does."],
            explanation_vi: "Minh giải thích phai màu cảnh báo stress nhiệt hàng tuần trước khi tốc độ mọc chậm lại.",
            explanation_en: "Fading pigment warns of heat stress weeks before growth slows down.",
          },
          {
            id: "l1-q27",
            number: 27,
            type: "note_completion",
            prompt: "Note Completion (ONE WORD): Measuring tool used every 30 days to check branch length: plastic __________.",
            correctAnswers: ["calipers", "callipers"],
            explanation_vi: "Dùng thước kẹp nhựa ('plastic calipers') mỗi 30 ngày.",
            explanation_en: "Branch length is measured with plastic calipers.",
          },
          {
            id: "l1-q28",
            number: 28,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Number of local boat captains trained to report starfish outbreaks: __________.",
            correctAnswers: ["12", "twelve"],
            explanation_vi: "Đào tạo 12 thuyền trưởng địa phương ('twelve local boat captains').",
            explanation_en: "Twelve local boat captains are being trained.",
          },
          {
            id: "l1-q29",
            number: 29,
            type: "note_completion",
            prompt: "Note Completion (ONE WORD): Safety protocol must include buddy checks and emergency __________ kits.",
            correctAnswers: ["oxygen"],
            explanation_vi: "Tiến sĩ Claire nhắc bổ sung quy trình kiểm tra cặp lặn và bộ bình oxy khẩn cấp ('emergency oxygen kits').",
            explanation_en: "The safety protocol must cover buddy checks and emergency oxygen kits.",
          },
          {
            id: "l1-q30",
            number: 30,
            type: "short_answer",
            prompt: "Short Answer (ONE WORD): On which evening does Minh promise to email the revised proposal?",
            correctAnswers: ["Thursday"],
            explanation_vi: "Hạn chót là thứ Sáu nhưng Minh hứa gửi bản sửa vào tối thứ Năm ('Thursday evening').",
            explanation_en: "The deadline is Friday, and Minh promises to email it Thursday evening.",
          },
        ],
      },
      {
        id: "l1-s4",
        title: "Part 4: University Lecture — Seagrass Meadows & Blue Carbon (Questions 31–40)",
        instruction: "Listen to a marine science lecture about seagrass meadows and complete the lecture notes. Answer Questions 31–40.",
        audioUrl: "/audio/listening/l1-part4.mp3",
        audioScript: `Lecturer: Good afternoon, everyone. In today's oceanography lecture, we turn our attention to an ecosystem often overshadowed by coral reefs and tropical rainforests: underwater seagrass meadows.

First, let's clarify a common botanical misconception. Unlike kelp or seaweed, seagrasses are not algae—they are true flowering plants that evolved from land ancestors roughly one hundred million years ago and returned to shallow coastal seas. Because they possess true roots, rhizomes, and ribbon-like leaves, they anchor shifting sandbanks much like prairie grasses stabilize inland soil.

Seagrass meadows cover less than zero point two percent of the world's ocean floor, yet they play an outsized role in climate regulation. Scientists estimate they account for approximately ten percent of all organic carbon buried annually in marine sediments. Because seagrass leaves slow down water currents, floating organic particles settle rapidly into oxygen-poor mud where decay proceeds very slowly—a storage process commonly labeled "blue carbon."

Beyond carbon capture, seagrass beds serve as vital nurseries for commercial fisheries. Juvenile prawns, crabs, and reef fish shelter among the swaying blades to evade larger open-water predators. In Southeast Asia, healthy meadows also sustain endangered dugongs, large gentle marine mammals that graze exclusively on tender seagrass shoots.

Another surprising benefit was documented by marine microbiologists in Indonesia. When researchers sampled seawater near densely populated islands, they found that bacterial pathogens harmful to humans and corals were fifty percent lower inside seagrass meadows than in adjacent bare sandy zones, likely due to natural antimicrobial compounds released by the leaves.

Unfortunately, global seagrass area has declined by nearly thirty percent since the late nineteenth century. The primary culprit is coastal runoff carrying excess agricultural fertilizer and untreated sewage, which triggers murky algal blooms that block the sunlight seagrass needs for photosynthesis. Anchor chains dragged by recreational boats also carve deep scars through root mats that can take decades to heal.

Encouragingly, large-scale restoration is proving viable. In Virginia's coastal bays, scientists scattered more than seventy million harvested seagrass seeds from small boats, successfully reviving over three thousand hectares of meadow within twenty years. Combining strict wastewater treatment with eco-friendly boat moorings offers the strongest blueprint for protecting these underwater grasslands worldwide.`,
        questions: [
          {
            id: "l1-q31",
            number: 31,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Unlike seaweed, seagrasses are true __________ plants that returned to coastal seas.",
            correctAnswers: ["flowering"],
            explanation_vi: "Bài giảng nhấn mạnh cỏ biển không phải tảo mà là thực vật có hoa thực thụ ('true flowering plants').",
            explanation_en: "Seagrasses are true flowering plants, not algae.",
          },
          {
            id: "l1-q32",
            number: 32,
            type: "note_completion",
            prompt: "Lecture Notes (ONE NUMBER): Seagrass meadows store around __________ percent of organic carbon buried yearly in marine sediments.",
            correctAnswers: ["10", "ten", "10%"],
            explanation_vi: "Dù chiếm dưới 0,2% đáy biển nhưng lưu trữ khoảng 10% tổng carbon hữu cơ hàng năm.",
            explanation_en: "They account for roughly ten percent of organic carbon buried annually.",
          },
          {
            id: "l1-q33",
            number: 33,
            type: "note_completion",
            prompt: "Lecture Notes (TWO WORDS): Long-term carbon storage in coastal marine mud is widely known as __________.",
            correctAnswers: ["blue carbon"],
            explanation_vi: "Quá trình tích trữ carbon ven biển này được gọi là 'blue carbon'.",
            explanation_en: "This coastal carbon storage process is termed 'blue carbon'.",
          },
          {
            id: "l1-q34",
            number: 34,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): In Southeast Asia, healthy seagrass shoots are the sole food source of endangered __________.",
            correctAnswers: ["dugongs", "dugong"],
            explanation_vi: "Bò biển (dugongs) ăn hoàn toàn chồi cỏ biển non.",
            explanation_en: "Endangered dugongs graze exclusively on tender seagrass shoots.",
          },
          {
            id: "l1-q35",
            number: 35,
            type: "note_completion",
            prompt: "Lecture Notes (ONE NUMBER): An Indonesian study found harmful bacterial pathogens were __________ percent lower inside seagrass meadows.",
            correctAnswers: ["50", "fifty", "50%"],
            explanation_vi: "Vi khuẩn gây bệnh giảm 50% bên trong thảm cỏ biển so với vùng cát trống kế bên.",
            explanation_en: "Harmful bacterial pathogens were fifty percent lower inside seagrass meadows.",
          },
          {
            id: "l1-q36",
            number: 36,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Excess agricultural __________ in coastal runoff fuels algal blooms that block sunlight.",
            correctAnswers: ["fertilizer", "fertiliser", "fertilizers"],
            explanation_vi: "Nước chảy tràn ven bờ mang theo phân bón nông nghiệp dư thừa ('excess agricultural fertilizer').",
            explanation_en: "Coastal runoff carries excess agricultural fertilizer.",
          },
          {
            id: "l1-q37",
            number: 37,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Dragged boat __________ chains carve scars into root mats that take decades to recover.",
            correctAnswers: ["anchor"],
            explanation_vi: "Dây xích mỏ neo tàu giải trí ('anchor chains') cày nát thảm rễ.",
            explanation_en: "Anchor chains dragged by boats scar the root mats.",
          },
          {
            id: "l1-q38",
            number: 38,
            type: "note_completion",
            prompt: "Lecture Notes (ONE NUMBER): In Virginia's coastal bays, scientists scattered over __________ million harvested seeds.",
            correctAnswers: ["70", "seventy"],
            explanation_vi: "Các nhà khoa học rải hơn 70 triệu hạt cỏ biển thu hoạch ('seventy million harvested seagrass seeds').",
            explanation_en: "Scientists scattered more than seventy million harvested seeds.",
          },
          {
            id: "l1-q39",
            number: 39,
            type: "summary_completion",
            prompt: "Summary Completion (ONE NUMBER): Within twenty years, the Virginia seeding project restored over __________ hectares of seagrass.",
            correctAnswers: ["3000", "3,000", "three thousand"],
            explanation_vi: "Phục hồi hơn 3.000 héc-ta trong vòng 20 năm ('over three thousand hectares').",
            explanation_en: "Over three thousand hectares were revived within twenty years.",
          },
          {
            id: "l1-q40",
            number: 40,
            type: "summary_completion",
            prompt: "Summary Completion (ONE WORD): Long-term protection requires stricter __________ treatment alongside eco-friendly moorings.",
            correctAnswers: ["wastewater"],
            explanation_vi: "Câu kết bài giảng nêu 'Combining strict wastewater treatment with eco-friendly boat moorings'.",
            explanation_en: "The lecturer highlights strict wastewater treatment plus eco-friendly moorings.",
          },
        ],
      },
    ],
  },

  // =========================================================================
  // LISTENING 02 — 40 QUESTIONS, 4 PARTS + 4 REAL MP3 FILES
  // =========================================================================
  {
    id: "test-l-2",
    slug: "listening-02-coastal-botanical-garden",
    skill: "listening",
    module: "academic",
    title_vi: "Listening 02 (Full 40 câu + Audio thật): Vườn Thực vật, Tái chế Nước mưa & Ngân hàng Hạt giống",
    title_en: "Listening 02 (Full 40Q + Real Audio): Botanical Garden, Rainwater Cycle & Seed Vaults",
    description_vi:
      "Đề nghe trọn bộ 4 Part – 40 câu kèm file âm thanh MP3 đa giọng thật: đăng ký tình nguyện viên (Part 1), biểu đồ nước mưa SVG (Part 2), khảo sát côn trùng thụ phấn (Part 3) và bài giảng kho hạt giống (Part 4).",
    description_en:
      "Full 4-part, 40-question Listening test with real MP3 audio: botanical volunteer signup, SVG rainwater diagram, pollinator survey dialogue, and seed vault lecture.",
    duration_minutes: 30,
    difficulty: "band_6_7",
    questionCount: 40,
    is_published: true,
    is_daily_eligible: true,
    created_at: "2026-11-05T08:00:00.000Z",
    sections: [
      {
        id: "l2-s1",
        title: "Part 1: Botanical Garden Volunteer Registration (Questions 1–10)",
        instruction: "Listen to a conversation between a volunteer coordinator and an applicant at the City Botanical Garden. Answer Questions 1–10.",
        audioUrl: "/audio/listening/l2-part1.mp3",
        audioScript: `Coordinator: Hello! Thanks for coming by the City Botanical Garden volunteer office. Are you interested in joining our autumn intake?

Applicant: Yes, I saw your poster at the library. My name is Kevin Tran, and I'd love to help out on weekends.

Coordinator: Wonderful, Kevin. Let me open a registration form for you. Could I get your street address first?

Applicant: Sure, I live at 48 Maple Avenue, Flat 3B.

Coordinator: Forty-eight Maple Avenue. And your postcode?

Applicant: It's 2084.

Coordinator: Great. Now, we have three main weekend volunteer teams: the Nursery Greenhouse Team, the Visitor Welcome Desk, and the Composting Crew. Which area appeals to you most?

Applicant: I thought about the Welcome Desk at first, but I really enjoy hands-on plant care, so I'd prefer the Nursery Greenhouse Team.

Coordinator: Brilliant—our head gardener always needs extra hands repotting seedlings! What shift works best: Saturday morning from eight-thirty to twelve, or Sunday afternoon from one to four-thirty?

Applicant: Saturday morning suits my schedule much better.

Coordinator: Noted: Saturday morning shift. We ask new volunteers to commit for at least three months so you can see a full growing cycle. Does that work for you?

Applicant: Definitely, I'm staying in the city all year. Do I need to bring gardening gloves or tools?

Coordinator: We supply trowels, secateurs, and heavy gloves, though you should bring a refillable water bottle and a wide-brimmed hat because the glasshouse gets warm by ten o'clock.

Applicant: Good to know. Is there an orientation session before I start?

Applicant: Wait—sorry, I should ask when orientation takes place!

Coordinator: Yes! Orientation is held next Wednesday evening at six o'clock in the Pavilion Room. Oh, and as a perk, active volunteers receive a twenty percent discount at our Garden Café and free entry for two guests each month.

Applicant: That sounds fantastic. See you next Wednesday!`,
        questions: [
          {
            id: "l2-q1",
            number: 1,
            type: "note_completion",
            prompt: "Form Completion (TWO WORDS): Applicant's street name: 48 __________.",
            correctAnswers: ["Maple Avenue"],
            explanation_vi: "Kevin cho địa chỉ là 48 Maple Avenue.",
            explanation_en: "Kevin gives his address as 48 Maple Avenue.",
          },
          {
            id: "l2-q2",
            number: 2,
            type: "note_completion",
            prompt: "Form Completion (NUMBER): Applicant's postcode: __________.",
            correctAnswers: ["2084"],
            explanation_vi: "Mã bưu điện là 2084.",
            explanation_en: "His postcode is 2084.",
          },
          {
            id: "l2-q3",
            number: 3,
            type: "note_completion",
            prompt: "Form Completion (TWO WORDS): Preferred volunteer team: Nursery __________ Team.",
            correctAnswers: ["Greenhouse", "Nursery Greenhouse"],
            explanation_vi: "Chú ý bẫy: ban đầu nghĩ tới Welcome Desk nhưng chọn Nursery Greenhouse Team.",
            explanation_en: "He considered the Welcome Desk but chose the Nursery Greenhouse Team.",
          },
          {
            id: "l2-q4",
            number: 4,
            type: "note_completion",
            prompt: "Form Completion (ONE WORD): Main task in the greenhouse: repotting __________.",
            correctAnswers: ["seedlings"],
            explanation_vi: "Người làm vườn trưởng cần hỗ trợ sang chậu cây giống ('repotting seedlings').",
            explanation_en: "The head gardener needs help repotting seedlings.",
          },
          {
            id: "l2-q5",
            number: 5,
            type: "note_completion",
            prompt: "Form Completion (TWO WORDS): Chosen weekend shift: __________ morning.",
            correctAnswers: ["Saturday", "Saturday morning"],
            explanation_vi: "Kevin chọn ca sáng thứ Bảy ('Saturday morning').",
            explanation_en: "Kevin chooses the Saturday morning shift.",
          },
          {
            id: "l2-q6",
            number: 6,
            type: "note_completion",
            prompt: "Form Completion (ONE NUMBER): Minimum volunteer commitment period: __________ months.",
            correctAnswers: ["3", "three"],
            explanation_vi: "Yêu cầu cam kết tối thiểu 3 tháng ('at least three months').",
            explanation_en: "New volunteers commit for at least three months.",
          },
          {
            id: "l2-q7",
            number: 7,
            type: "note_completion",
            prompt: "Form Completion (TWO WORDS): Personal items to bring: a wide-brimmed hat and a refillable __________.",
            correctAnswers: ["water bottle"],
            explanation_vi: "Cần tự mang bình nước dùng lại nhiều lần ('refillable water bottle') và mũ rộng vành.",
            explanation_en: "Bring a refillable water bottle and a wide-brimmed hat.",
          },
          {
            id: "l2-q8",
            number: 8,
            type: "note_completion",
            prompt: "Form Completion (ONE WORD): Orientation session day: next __________ evening at 6:00 p.m.",
            correctAnswers: ["Wednesday"],
            explanation_vi: "Buổi định hướng diễn ra vào tối thứ Tư tuần tới.",
            explanation_en: "Orientation takes place next Wednesday evening.",
          },
          {
            id: "l2-q9",
            number: 9,
            type: "note_completion",
            prompt: "Form Completion (ONE WORD): Orientation room name: the __________ Room.",
            correctAnswers: ["Pavilion"],
            explanation_vi: "Tổ chức tại phòng Pavilion ('in the Pavilion Room').",
            explanation_en: "It is held in the Pavilion Room.",
          },
          {
            id: "l2-q10",
            number: 10,
            type: "note_completion",
            prompt: "Form Completion (ONE NUMBER): Volunteer café discount: __________ percent.",
            correctAnswers: ["20", "twenty", "20%"],
            explanation_vi: "Tình nguyện viên được giảm 20% tại Garden Café.",
            explanation_en: "Active volunteers receive a twenty percent café discount.",
          },
        ],
      },
      {
        id: "l2-s2",
        title: "Part 2: Rainwater Harvesting in the Glass Conservatory (Questions 11–20)",
        instruction: "Listen to a botanical engineer explaining the Glass Conservatory rainwater cycle diagram and visitor rules. Answer Questions 11–20.",
        diagramLabel: "Conservatory Rainwater Cycle Diagram",
        diagramSvgType: "water_cycle",
        audioUrl: "/audio/listening/l2-part2.mp3",
        audioScript: `Engineer: Welcome inside our new Glass Conservatory! Today I'll walk you through how this dome irrigates three thousand rare orchids without drawing heavily from municipal tap water.

Please look at the four-stage cycle diagram displayed on the wall. Step one begins on the curved glass roof panels, where tropical rainwater channels smoothly into wide copper gutters fitted with fine mesh screens designed to block falling leaves.

Next, at Stage 2, roof runoff drops down vertical pipes into an underground gravel filter that removes fine silt, dust, and organic debris before the water travels any further.

Once filtered, the clean water collects in Stage 3 inside a buried concrete cistern holding up to eighty thousand liters. Keeping the cistern completely underground prevents algae growth because sunlight cannot reach the stored water, and cool soil keeps the water temperature steady.

Finally, at Stage 4, solar-powered drip pumps deliver gentle mist across the orchid terraces at dawn and dusk. According to our head botanist, switching to harvested rainwater cut annual water bills by sixty-two percent while noticeably improving leaf health because rainwater contains no chlorine.

Now let me highlight three walkways you can explore after this briefing. The Cloud Forest Walkway rises twelve meters above the floor and stays misted every twenty minutes—watch your footing on the timber planks when they're damp.

Below it sits the Medicinal Herbs Terrace, which features over ninety Southeast Asian botanical species labeled with both Latin names and traditional household uses.

Finally, please note that during July our Fern Grotto undergoes roof-seal maintenance on Mondays, though it remains fully open Tuesday through Sunday. Audio guides in English, Vietnamese, and Japanese are available free at the conservatory kiosk.`,
        questions: [
          {
            id: "l2-q11",
            number: 11,
            type: "note_completion",
            prompt: "Diagram Stage 1 (ONE WORD): Roof panels direct rainwater into wide __________ gutters.",
            correctAnswers: ["copper"],
            explanation_vi: "Giai đoạn 1: nước mưa chảy vào máng xối bằng đồng rộng ('wide copper gutters').",
            explanation_en: "Rainwater flows into wide copper gutters.",
          },
          {
            id: "l2-q12",
            number: 12,
            type: "flowchart_completion",
            prompt: "Diagram Stage 2 (ONE WORD): An underground __________ filter removes fine silt and debris.",
            correctAnswers: ["gravel"],
            explanation_vi: "Giai đoạn 2 đi qua bể lọc sỏi ngầm ('underground gravel filter').",
            explanation_en: "An underground gravel filter removes fine silt.",
          },
          {
            id: "l2-q13",
            number: 13,
            type: "note_completion",
            prompt: "Diagram Stage 3 (ONE NUMBER): Maximum buried cistern capacity: __________ thousand liters.",
            correctAnswers: ["80", "eighty"],
            explanation_vi: "Bể ngầm chứa tối đa 80.000 lít ('eighty thousand liters').",
            explanation_en: "The cistern holds up to eighty thousand liters.",
          },
          {
            id: "l2-q14",
            number: 14,
            type: "mcq",
            prompt: "Why is the concrete cistern buried underground?",
            options: [
              "A. To stop algae from growing by blocking sunlight.",
              "B. To warm the water during winter months.",
              "C. To leave extra space for visitor parking.",
            ],
            correctAnswers: ["A", "A. To stop algae from growing by blocking sunlight."],
            explanation_vi: "Chôn ngầm ngăn ánh nắng chiếu vào, không cho rêu tảo phát triển ('prevents algae growth').",
            explanation_en: "Keeping the cistern underground blocks sunlight and prevents algae growth.",
          },
          {
            id: "l2-q15",
            number: 15,
            type: "summary_completion",
            prompt: "Summary Completion (ONE NUMBER): Switching to rainwater reduced yearly water costs by __________ percent.",
            correctAnswers: ["62", "sixty-two", "62%"],
            explanation_vi: "Giảm hóa đơn tiền nước hằng năm tới 62% ('sixty-two percent').",
            explanation_en: "Annual water bills dropped by sixty-two percent.",
          },
          {
            id: "l2-q16",
            number: 16,
            type: "short_answer",
            prompt: "Short Answer (ONE WORD): Which chemical absent in rainwater makes it healthier for orchid leaves?",
            correctAnswers: ["chlorine"],
            explanation_vi: "Nước mưa không chứa clo ('contains no chlorine').",
            explanation_en: "Rainwater contains no chlorine.",
          },
          {
            id: "l2-q17",
            number: 17,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Height of the Cloud Forest Walkway above the floor: __________ meters.",
            correctAnswers: ["12", "twelve"],
            explanation_vi: "Lối đi Cloud Forest cao 12 mét so với mặt sàn.",
            explanation_en: "The Cloud Forest Walkway rises twelve meters above the floor.",
          },
          {
            id: "l2-q18",
            number: 18,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Number of Southeast Asian plant species on the Medicinal Herbs Terrace: over __________.",
            correctAnswers: ["90", "ninety"],
            explanation_vi: "Khu thảo dược trưng bày hơn 90 loài Đông Nam Á ('over ninety').",
            explanation_en: "Over ninety Southeast Asian botanical species are featured.",
          },
          {
            id: "l2-q19",
            number: 19,
            type: "note_completion",
            prompt: "Note Completion (ONE WORD): Day when the Fern Grotto is closed for maintenance in July: __________.",
            correctAnswers: ["Monday", "Mondays"],
            explanation_vi: "Động dương xỉ bảo trì mái vào các ngày thứ Hai trong tháng 7.",
            explanation_en: "The Fern Grotto undergoes maintenance on Mondays in July.",
          },
          {
            id: "l2-q20",
            number: 20,
            type: "mcq",
            prompt: "Which three languages are offered on the free conservatory audio guides?",
            options: [
              "A. English, French, and Korean",
              "B. English, Vietnamese, and Japanese",
              "C. English, Mandarin, and Thai",
            ],
            correctAnswers: ["B", "B. English, Vietnamese, and Japanese"],
            explanation_vi: "Cuối bài nói ghi rõ có tiếng Anh, tiếng Việt và tiếng Nhật.",
            explanation_en: "Audio guides are free in English, Vietnamese, and Japanese.",
          },
        ],
      },
      {
        id: "l2-s3",
        title: "Part 3: Planning an Urban Pollinator Survey (Questions 21–30)",
        instruction: "Listen to two environmental science students discussing their research project on urban bees and butterflies. Answer Questions 21–30.",
        audioUrl: "/audio/listening/l2-part3.mp3",
        audioScript: `Maya: Hi Liam, ready to finalize the methodology for our urban pollinator survey? Professor Patel wants our site list by noon tomorrow.

Liam: Definitely. I surveyed six candidate rooftops and parks last week. We need sites across three contrasting habitats: dense downtown rooftops, suburban community gardens, and riverside linear parks.

Maya: Should we include all six sites? That might stretch our observation hours too thin.

Liam: Good point. Let's narrow it to four sites—two downtown green roofs, one community garden, and one riverside park—so we can visit every site twice a week for six weeks.

Maya: Sounds manageable. What time window should we standardize for insect counts? Early morning before eight?

Liam: Actually, native stingless bees and butterflies barely fly before nine when dew is still heavy. Most published protocols recommend observing between ten a.m. and two p.m. on calm sunny days when wind speeds stay below fifteen kilometers per hour.

Maya: Makes total sense. For counting method, are we using sweep nets to catch insects?

Liam: Professor Patel strongly discouraged sweep nets because beginners can injure delicate butterfly wings. Instead, we'll walk slow fifty-meter transects and photograph every flower visitor with macro phone lenses so we can double-check species IDs back in the lab.

Maya: Much kinder and easier to verify! Speaking of identification, I'm worried I'll confuse hoverflies with true honeybees.

Liam: Don't worry—the Entomology Department just published a pocket field guide with side-by-side wing charts. Remember the quick rule: flies only have one pair of wings and huge eyes, whereas bees have two pairs.

Maya: Helpful tip! What floral traits should we log alongside insect counts?

Liam: Let's record blossom color, whether the plant is native or ornamental, and the distance to the nearest fresh water source. Oh—and let's ask building managers if any chemical pesticides were sprayed within the past thirty days, because residual sprays could completely skew our data.

Maya: Great catch! I'll draft the data spreadsheet tonight and share it before class.`,
        questions: [
          {
            id: "l2-q21",
            number: 21,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Final number of study sites selected by Maya and Liam: __________.",
            correctAnswers: ["4", "four"],
            explanation_vi: "Chú ý bẫy: Liam khảo sát 6 nơi nhưng hai bạn thu gọn còn 4 điểm để kịp lịch quan sát.",
            explanation_en: "Liam surveyed six sites, then they narrowed it to four sites.",
          },
          {
            id: "l2-q22",
            number: 22,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Total duration of the field survey: __________ weeks.",
            correctAnswers: ["6", "six"],
            explanation_vi: "Khảo sát mỗi điểm 2 lần/tuần trong vòng 6 tuần.",
            explanation_en: "They will visit each site twice weekly for six weeks.",
          },
          {
            id: "l2-q23",
            number: 23,
            type: "mcq",
            prompt: "Why do they avoid counting pollinators before 9:00 a.m.?",
            options: [
              "A. Park gates do not open until ten o'clock.",
              "B. Heavy morning dew keeps bees and butterflies from flying actively.",
              "C. Macro smartphone cameras need overhead midday shadows.",
            ],
            correctAnswers: ["B", "B. Heavy morning dew keeps bees and butterflies from flying actively."],
            explanation_vi: "Liam giải thích ong và bướm hầu như chưa bay trước 9 giờ khi sương còn dày.",
            explanation_en: "Bees and butterflies barely fly before nine when dew is still heavy.",
          },
          {
            id: "l2-q24",
            number: 24,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Maximum allowable wind speed during observations: __________ km/h.",
            correctAnswers: ["15", "fifteen"],
            explanation_vi: "Tốc độ gió phải dưới 15 km/giờ.",
            explanation_en: "Wind speeds must stay below fifteen kilometers per hour.",
          },
          {
            id: "l2-q25",
            number: 25,
            type: "mcq",
            prompt: "Why did Professor Patel advise against using sweep nets?",
            options: [
              "A. Inexperienced students might damage butterfly wings.",
              "B. The department ran out of nylon mesh nets.",
              "C. Sweep nets frighten rooftop visitors.",
            ],
            correctAnswers: ["A", "A. Inexperienced students might damage butterfly wings."],
            explanation_vi: "Giáo sư không khuyến khích vợt vì người mới dễ làm rách cánh bướm mỏng manh.",
            explanation_en: "Beginners can injure delicate butterfly wings with sweep nets.",
          },
          {
            id: "l2-q26",
            number: 26,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Length of each walking transect used for photography: __________ meters.",
            correctAnswers: ["50", "fifty"],
            explanation_vi: "Họ đi chậm dọc tuyến khảo sát dài 50 mét ('fifty-meter transects').",
            explanation_en: "They will walk fifty-meter transects.",
          },
          {
            id: "l2-q27",
            number: 27,
            type: "note_completion",
            prompt: "Note Completion (ONE WORD): Camera attachment used on phones to photograph insects clearly: __________ lenses.",
            correctAnswers: ["macro"],
            explanation_vi: "Chụp bằng ống kính cận cảnh macro trên điện thoại ('macro phone lenses').",
            explanation_en: "They use macro phone lenses.",
          },
          {
            id: "l2-q28",
            number: 28,
            type: "table_completion",
            prompt: "Table Completion (ONE NUMBER): Species ID rule | Hoverflies have 1 pair of wings; bees have __________ pairs.",
            correctAnswers: ["2", "two"],
            explanation_vi: "Ruồi giả ong chỉ có 1 đôi cánh, còn ong thật có 2 đôi cánh ('bees have two pairs').",
            explanation_en: "Flies have one pair of wings whereas bees have two pairs.",
          },
          {
            id: "l2-q29",
            number: 29,
            type: "note_completion",
            prompt: "Note Completion (ONE WORD): Plant traits to record: blossom color, native vs ornamental, and distance to fresh __________.",
            correctAnswers: ["water"],
            explanation_vi: "Ghi nhận thêm khoảng cách tới nguồn nước ngọt gần nhất ('nearest fresh water source').",
            explanation_en: "They log the distance to the nearest fresh water source.",
          },
          {
            id: "l2-q30",
            number: 30,
            type: "note_completion",
            prompt: "Note Completion (ONE WORD): Building managers must be asked whether chemical __________ were applied in the past 30 days.",
            correctAnswers: ["pesticides", "pesticide"],
            explanation_vi: "Kiểm tra xem có phun thuốc trừ sâu hóa học ('chemical pesticides') trong 30 ngày gần đây không.",
            explanation_en: "They must check if chemical pesticides were sprayed within 30 days.",
          },
        ],
      },
      {
        id: "l2-s4",
        title: "Part 4: Academic Lecture — Seed Vaults & Global Crop Resilience (Questions 31–40)",
        instruction: "Listen to an agricultural science lecture on global seed banks and complete the notes. Answer Questions 31–40.",
        audioUrl: "/audio/listening/l2-part4.mp3",
        audioScript: `Lecturer: Today we examine one of humanity's quietest insurance policies: international seed banks and the preservation of crop genetic diversity.

Over the last century, modern commercial farming achieved extraordinary harvests by focusing on a tiny handful of uniform, high-yielding plant varieties. Today, roughly seventy-five percent of global food calories derive from just twelve plant species and five animal species. While uniform crops simplify mechanical harvesting, narrowing the genetic pool leaves entire regions vulnerable to sudden droughts, rising soil salinity, or newly mutated plant fungi.

To guard against irreversible extinction, botanists collect wild relatives and heirloom farm varieties in specialized conservation facilities known as genebanks. Before storage, orthodox seeds—such as rice, wheat, and beans—are cleaned, X-rayed for insect damage, and dried slowly in low-humidity chambers until internal moisture drops to around five percent. Sealed inside airtight aluminum foil packets, they are stored at minus eighteen degrees Celsius, allowing many grain varieties to remain viable for centuries.

Because national genebanks face real-world risks from power blackouts, floods, or regional conflicts, an international backup repository was built deep inside a sandstone mountain on the Arctic island of Svalbard in Norway. Opened in 2008, the Svalbard Global Seed Vault operates like a safety-deposit box: each contributing country retains full ownership of its duplicate seeds, and the surrounding frozen permafrost keeps chambers cold even if mechanical refrigeration temporarily fails.

However, freezing is not a universal solution. Roughly eight percent of flowering plant species—including tropical staples such as cacao, mango, avocado, and rubber—produce "recalcitrant" seeds that die immediately if dried or frozen. Conserving these tropical treasures requires living field orchards or ultra-cold cryopreservation of microscopic shoot tips inside liquid nitrogen at minus one hundred ninety-six degrees.

Ultimately, a vault only protects food security when breeders actively withdraw samples to develop resilient crops. In 2015, Syrian agricultural researchers made the first historic withdrawal from Svalbard after war disrupted their Aleppo collection, successfully multiplying drought-tolerant barley and wheat lines in Lebanon and Morocco. Seed conservation, then, is not a museum frozen in time—it is a living toolkit for feeding a warmer planet.`,
        questions: [
          {
            id: "l2-q31",
            number: 31,
            type: "note_completion",
            prompt: "Lecture Notes (ONE NUMBER): Around __________ percent of global food calories come from just 12 plant and 5 animal species.",
            correctAnswers: ["75", "seventy-five", "75%"],
            explanation_vi: "Khoảng 75% calo thực phẩm toàn cầu chỉ đến từ 12 loài thực vật và 5 loài động vật.",
            explanation_en: "Roughly seventy-five percent of global food calories derive from those species.",
          },
          {
            id: "l2-q32",
            number: 32,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Uniform crops are vulnerable to drought, soil salinity, and mutated plant __________.",
            correctAnswers: ["fungi", "fungus"],
            explanation_vi: "Dễ tổn thương trước nấm bệnh thực vật đột biến ('newly mutated plant fungi').",
            explanation_en: "Narrow gene pools leave crops vulnerable to newly mutated plant fungi.",
          },
          {
            id: "l2-q33",
            number: 33,
            type: "note_completion",
            prompt: "Lecture Notes (ONE NUMBER): Orthodox seeds are dried until their internal moisture reaches roughly __________ percent.",
            correctAnswers: ["5", "five", "5%"],
            explanation_vi: "Hạt được sấy chậm đến khi độ ẩm bên trong còn khoảng 5%.",
            explanation_en: "Internal moisture is lowered to around five percent.",
          },
          {
            id: "l2-q34",
            number: 34,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Dried seeds are sealed inside airtight __________ foil packets before freezing.",
            correctAnswers: ["aluminum", "aluminium"],
            explanation_vi: "Đóng gói trong túi màng nhôm kín khí ('airtight aluminum foil packets').",
            explanation_en: "Seeds are sealed inside airtight aluminum foil packets.",
          },
          {
            id: "l2-q35",
            number: 35,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): The Svalbard Vault is carved deep inside a __________ mountain in Arctic Norway.",
            correctAnswers: ["sandstone"],
            explanation_vi: "Kho hạt giống Svalbard nằm sâu trong ngọn núi đá sa thạch ('sandstone mountain').",
            explanation_en: "The vault is built inside a sandstone mountain.",
          },
          {
            id: "l2-q36",
            number: 36,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Surrounding frozen __________ keeps Svalbard chambers cold even if power fails.",
            correctAnswers: ["permafrost"],
            explanation_vi: "Tầng đất đóng băng vĩnh cửu ('permafrost') giữ lạnh tự nhiên ngay cả khi mất điện.",
            explanation_en: "Surrounding frozen permafrost keeps the chambers cold.",
          },
          {
            id: "l2-q37",
            number: 37,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Tropical crops like cacao and mango produce __________ seeds that cannot survive drying or freezing.",
            correctAnswers: ["recalcitrant"],
            explanation_vi: "Hạt khó bảo quản lạnh/khô được gọi là 'recalcitrant' seeds.",
            explanation_en: "Tropical staples produce 'recalcitrant' seeds.",
          },
          {
            id: "l2-q38",
            number: 38,
            type: "note_completion",
            prompt: "Lecture Notes (TWO WORDS): Microscopic shoot tips of tropical plants can be preserved inside __________ at -196°C.",
            correctAnswers: ["liquid nitrogen"],
            explanation_vi: "Bảo quản lạnh sâu bằng nitơ lỏng ('liquid nitrogen') ở âm 196 độ C.",
            explanation_en: "Cryopreservation stores shoot tips in liquid nitrogen.",
          },
          {
            id: "l2-q39",
            number: 39,
            type: "note_completion",
            prompt: "Lecture Notes (YEAR): Year of the first historic seed withdrawal from Svalbard: __________.",
            correctAnswers: ["2015"],
            explanation_vi: "Lần rút hạt lịch sử đầu tiên diễn ra vào năm 2015.",
            explanation_en: "The first withdrawal took place in 2015.",
          },
          {
            id: "l2-q40",
            number: 40,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Syrian researchers regrew drought-tolerant wheat and __________ lines in Lebanon and Morocco.",
            correctAnswers: ["barley"],
            explanation_vi: "Họ nhân giống thành công lúa mì và lúa mạch ('barley') chịu hạn.",
            explanation_en: "They multiplied drought-tolerant barley and wheat lines.",
          },
        ],
      },
    ],
  },

  // =========================================================================
  // LISTENING 03 — 40 QUESTIONS, 4 PARTS + 4 REAL MP3 FILES
  // =========================================================================
  {
    id: "test-l-3",
    slug: "listening-03-university-podcast-project",
    skill: "listening",
    module: "academic",
    title_vi: "Listening 03 (Full 40 câu + Audio thật): Phòng Thu Khuôn viên, Podcast Sinh viên & Âm học Lớp học",
    title_en: "Listening 03 (Full 40Q + Real Audio): Campus Media Wing, Student Podcast & Classroom Acoustics",
    description_vi:
      "Đề nghe trọn bộ 4 Part – 40 câu kèm file âm thanh MP3 đa giọng thật: đăng ký mượn thiết bị (Part 1), sơ đồ khu truyền thông SVG (Part 2), họp dự án podcast song ngữ (Part 3) và bài giảng âm học lớp học (Part 4).",
    description_en:
      "Full 4-part, 40-question Listening test with real MP3 audio: equipment rental, SVG campus studio map, student podcast planning, and classroom acoustics lecture.",
    duration_minutes: 30,
    difficulty: "band_7_plus",
    questionCount: 40,
    is_published: true,
    is_daily_eligible: false,
    created_at: "2026-11-06T08:00:00.000Z",
    sections: [
      {
        id: "l3-s1",
        title: "Part 1: Campus Media Library Membership & Gear Loan (Questions 1–10)",
        instruction: "Listen to a student registering for a Media Equipment Card at a university library. Answer Questions 1–10.",
        audioUrl: "/audio/listening/l3-part1.mp3",
        audioScript: `Librarian: Hi there, welcome to the Media Equipment Desk. How can I help you?

Student: Hi! I'd like to register for an audio-gear borrowing pass for my journalism module this semester.

Librarian: Certainly! Let's fill out your borrower profile. What's your full name?

Student: Sophia Nguyen—N-G-U-Y-E-N.

Librarian: Thanks, Sophia. And your student ID number?

Student: It's ST94218.

Librarian: S-T-9-4-2-1-8. Which faculty are you enrolled in?

Student: Communications and Media Studies.

Librarian: Great. Because you're borrowing sensitive audio kits, we require a one-time refundable security deposit. It used to be fifty dollars last year, but the student council lowered it to thirty-five dollars this term.

Student: Thirty-five dollars—that's much fairer! How long can I keep a portable voice recorder?

Librarian: Standard loans last three days, and you can renew online once for an extra two days as long as nobody else has placed a hold. If an item is returned late, the overdue fine is six dollars per day.

Student: Got it—no late returns! Do kits come with batteries and cables?

Librarian: Every kit includes a USB-C cable, a foam windshield, and a carrying pouch, though you need to supply your own AA batteries and SD memory cards.

Student: No problem. Before I can borrow studio microphones, do I need to attend an induction?

Librarian: Yes, a twenty-minute hands-on induction runs every Tuesday and Friday at eleven a.m. in Lab 204. Once your card is activated, you can reserve gear directly through the campus portal.`,
        questions: [
          {
            id: "l3-q1",
            number: 1,
            type: "note_completion",
            prompt: "Form Completion (CODE): Student ID number: __________.",
            correctAnswers: ["ST94218"],
            explanation_vi: "Mã số sinh viên là ST94218.",
            explanation_en: "Her student ID number is ST94218.",
          },
          {
            id: "l3-q2",
            number: 2,
            type: "note_completion",
            prompt: "Form Completion (TWO WORDS): Faculty name: __________ and Media Studies.",
            correctAnswers: ["Communications"],
            explanation_vi: "Khoa Truyền thông và Nghiên cứu Báo chí ('Communications and Media Studies').",
            explanation_en: "She is in Communications and Media Studies.",
          },
          {
            id: "l3-q3",
            number: 3,
            type: "note_completion",
            prompt: "Form Completion (ONE NUMBER): Current refundable security deposit: $__________.",
            correctAnswers: ["35", "thirty-five"],
            explanation_vi: "Chú ý bẫy: năm ngoái là 50 đô nhưng kỳ này giảm còn 35 đô.",
            explanation_en: "It used to be $50, lowered to $35 this term.",
          },
          {
            id: "l3-q4",
            number: 4,
            type: "note_completion",
            prompt: "Form Completion (ONE NUMBER): Standard loan period for a portable voice recorder: __________ days.",
            correctAnswers: ["3", "three"],
            explanation_vi: "Thời hạn mượn tiêu chuẩn là 3 ngày.",
            explanation_en: "Standard loans last three days.",
          },
          {
            id: "l3-q5",
            number: 5,
            type: "note_completion",
            prompt: "Form Completion (ONE NUMBER): Extra days granted with one online renewal: __________ days.",
            correctAnswers: ["2", "two"],
            explanation_vi: "Gia hạn trực tuyến 1 lần được thêm 2 ngày.",
            explanation_en: "Online renewal adds an extra two days.",
          },
          {
            id: "l3-q6",
            number: 6,
            type: "note_completion",
            prompt: "Form Completion (ONE NUMBER): Late return fine per day: $__________.",
            correctAnswers: ["6", "six"],
            explanation_vi: "Phí trễ hạn là 6 đô la mỗi ngày.",
            explanation_en: "The overdue fine is six dollars per day.",
          },
          {
            id: "l3-q7",
            number: 7,
            type: "note_completion",
            prompt: "Form Completion (ONE WORD): Accessories included in every kit: USB-C cable, carrying pouch, and a foam __________.",
            correctAnswers: ["windshield"],
            explanation_vi: "Mỗi bộ gồm cáp USB-C, túi đựng và bông lọc gió ('foam windshield').",
            explanation_en: "Each kit includes a foam windshield.",
          },
          {
            id: "l3-q8",
            number: 8,
            type: "note_completion",
            prompt: "Form Completion (ONE WORD): Consumable power item students must provide themselves: AA __________.",
            correctAnswers: ["batteries"],
            explanation_vi: "Sinh viên tự chuẩn bị pin AA ('AA batteries') và thẻ nhớ SD.",
            explanation_en: "Students supply their own AA batteries.",
          },
          {
            id: "l3-q9",
            number: 9,
            type: "note_completion",
            prompt: "Form Completion (ONE NUMBER): Duration of the required equipment induction: __________ minutes.",
            correctAnswers: ["20", "twenty"],
            explanation_vi: "Buổi hướng dẫn thực hành kéo dài 20 phút.",
            explanation_en: "The hands-on induction lasts twenty minutes.",
          },
          {
            id: "l3-q10",
            number: 10,
            type: "note_completion",
            prompt: "Form Completion (NUMBER): Room where inductions take place: Lab __________.",
            correctAnswers: ["204"],
            explanation_vi: "Tổ chức tại phòng Lab 204 vào thứ Ba và thứ Sáu lúc 11 giờ sáng.",
            explanation_en: "Inductions run in Lab 204.",
          },
        ],
      },
      {
        id: "l3-s2",
        title: "Part 2: University Media Wing Orientation & Studio Layout (Questions 11–20)",
        instruction: "Listen to a studio technician introducing the University Media Wing layout and policies. Answer Questions 11–20.",
        diagramLabel: "University Media Wing — Studio Layout",
        diagramSvgType: "campus_map",
        audioUrl: "/audio/listening/l3-part2.mp3",
        audioScript: `Technician: Welcome to the University Media Wing! Before I hand out your access wristbands, let's review the studio floor plan and essential safety rules.

Looking at the Media Wing map, Studio A at the north end has our thickest acoustic foam paneling, making it ideal for quiet two-person podcast interviews and voiceover tracks.

Studio B in the center of the corridor is equipped with dual color-calibrated monitors and is reserved strictly for video editing and color grading—please don't eat or bring open drinks inside either studio.

Down at the south end, adjacent to the main stairwell, is the Equipment Locker Room, where booked microphones and tripods can be collected even after five p.m. using your PIN code.

Right across the hallway from Studio B sits the Green Screen Corner, which students can reserve for short presentation demos or news broadcasts.

Now regarding booking rules: peak hours run from one p.m. to six p.m. on weekdays, during which each student group may book a maximum of two consecutive hours. Overnight access until eleven p.m. is available during exam revision weeks if at least two students sign in together for safety.

One common mistake students make is saving raw audio tracks onto the local desktop computers. Remember our IT script wipes all local drives automatically every Sunday at midnight, so always copy your project onto an external drive or university cloud storage before logging off.

Finally, our Sound Engineering Drop-in Clinic runs every Wednesday afternoon from two to four o'clock—just bring your headphones if you need help cleaning background hum or balancing vocal volume.`,
        questions: [
          {
            id: "l3-q11",
            number: 11,
            type: "map_labelling",
            prompt: "Map Labelling: Which studio has thick acoustic foam best suited for two-person podcast interviews?",
            options: ["Studio A", "Studio B"],
            correctAnswers: ["Studio A", "A"],
            explanation_vi: "Studio A ở đầu phía Bắc có mút tiêu âm dày nhất, lý tưởng cho phỏng vấn podcast 2 người.",
            explanation_en: "Studio A at the north end has the thickest acoustic foam.",
          },
          {
            id: "l3-q12",
            number: 12,
            type: "map_labelling",
            prompt: "Map Labelling: Which room in the center of the corridor is reserved for video editing and color grading?",
            options: ["Studio A", "Studio B"],
            correctAnswers: ["Studio B", "B"],
            explanation_vi: "Studio B ở giữa hành lang dành riêng cho dựng phim và chỉnh màu.",
            explanation_en: "Studio B in the center is reserved for video editing.",
          },
          {
            id: "l3-q13",
            number: 13,
            type: "note_completion",
            prompt: "Note Completion (TWO WORDS): Room at the south end near the stairwell where gear is collected after 5 p.m.: Equipment __________.",
            correctAnswers: ["Locker Room"],
            explanation_vi: "Cuối hành lang phía Nam là 'Equipment Locker Room'.",
            explanation_en: "The Equipment Locker Room is at the south end.",
          },
          {
            id: "l3-q14",
            number: 14,
            type: "note_completion",
            prompt: "Note Completion (TWO WORDS): Facility located across the hallway from Studio B: the __________ Corner.",
            correctAnswers: ["Green Screen"],
            explanation_vi: "Đối diện Studio B là góc phông xanh ('Green Screen Corner').",
            explanation_en: "Across from Studio B is the Green Screen Corner.",
          },
          {
            id: "l3-q15",
            number: 15,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Maximum booking length per group during weekday peak hours: __________ hours.",
            correctAnswers: ["2", "two"],
            explanation_vi: "Giờ cao điểm từ 13h–18h chỉ được đặt tối đa 2 giờ liên tiếp.",
            explanation_en: "Groups may book a maximum of two consecutive hours during peak times.",
          },
          {
            id: "l3-q16",
            number: 16,
            type: "note_completion",
            prompt: "Note Completion (TIME): Late evening closing time during exam revision weeks: __________ p.m.",
            correctAnswers: ["11", "11:00", "eleven"],
            explanation_vi: "Tuần ôn thi mở cửa muộn đến 11 giờ đêm.",
            explanation_en: "Late access runs until 11 p.m. during exam weeks.",
          },
          {
            id: "l3-q17",
            number: 17,
            type: "mcq",
            prompt: "What safety rule applies to late evening studio access?",
            options: [
              "A. A professor must remain inside the studio.",
              "B. At least two students must sign in together.",
              "C. Security guards lock the stairwell at nine p.m.",
            ],
            correctAnswers: ["B", "B. At least two students must sign in together."],
            explanation_vi: "Phải có ít nhất 2 sinh viên ký tên vào cùng nhau vì lý do an toàn.",
            explanation_en: "At least two students must sign in together for safety.",
          },
          {
            id: "l3-q18",
            number: 18,
            type: "note_completion",
            prompt: "Note Completion (ONE WORD): Local desktop hard drives are automatically erased every __________ at midnight.",
            correctAnswers: ["Sunday"],
            explanation_vi: "Hệ thống IT tự xóa toàn bộ ổ cứng máy bàn vào nửa đêm Chủ Nhật hàng tuần.",
            explanation_en: "Local drives are wiped automatically every Sunday at midnight.",
          },
          {
            id: "l3-q19",
            number: 19,
            type: "note_completion",
            prompt: "Note Completion (ONE WORD): Day of the weekly Sound Engineering Drop-in Clinic: __________.",
            correctAnswers: ["Wednesday"],
            explanation_vi: "Buổi hỗ trợ kỹ thuật âm thanh diễn ra mỗi chiều thứ Tư.",
            explanation_en: "The Drop-in Clinic runs every Wednesday afternoon.",
          },
          {
            id: "l3-q20",
            number: 20,
            type: "short_answer",
            prompt: "Short Answer (ONE WORD): What personal item should students bring to the Drop-in Clinic?",
            correctAnswers: ["headphones"],
            explanation_vi: "Kỹ thuật viên dặn mang theo tai nghe ('bring your headphones').",
            explanation_en: "Students should bring their headphones.",
          },
        ],
      },
      {
        id: "l3-s3",
        title: "Part 3: Planning a Bilingual Campus Science Podcast (Questions 21–30)",
        instruction: "Listen to two students, Lan and Minh, finalizing their campus science podcast proposal. Answer Questions 21–30.",
        audioUrl: "/audio/listening/l3-part3.mp3",
        audioScript: `Lan: Hi Minh, thanks for meeting to finalize our campus science podcast proposal. Professor Hoa approved our pilot episode on urban acoustics, provided we keep each episode under eighteen minutes so commuters can finish it on one bus ride.

Minh: Eighteen minutes is a smart cap—it keeps our editing tight too. What about microphone booking?

Lan: The technician mentioned we need to reserve condenser microphones forty-eight hours in advance, and remember to bring our own memory cards because the department stopped lending them last semester.

Minh: Got it. For our pilot guest, I originally invited a civil engineer, though she is traveling abroad for a bridge conference, so we confirmed Dr. Phong from the Architecture Faculty instead.

Lan: Dr. Phong is actually a fantastic match for urban acoustics—he designed the quiet courtyard at the Engineering Library! How should we structure the eighteen minutes?

Minh: Let's open with a ninety-second street sound clip recorded near a busy intersection, then move into a twelve-minute interview, and close with three rapid practical takeaways for listeners.

Lan: Love that sound-clip hook. What about intro music? We definitely can't grab commercial pop songs because of copyright rules.

Minh: Already sorted! A student composer from the Music Conservatory offered us an original twenty-second acoustic guitar loop under a Creative Commons license, provided we credit her in the episode description.

Lan: Amazing. One more thing—Professor Hoa suggested publishing short bilingual transcripts in English and Vietnamese on the university website, which should roughly double our international student listeners and make episodes accessible for deaf students.

Minh: Great idea. Let's schedule our test recording for Monday morning at nine-thirty in Studio A so we have plenty of time to edit before launching on the first of next month.`,
        questions: [
          {
            id: "l3-q21",
            number: 21,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Maximum recommended duration per podcast episode: __________ minutes.",
            correctAnswers: ["18", "eighteen"],
            explanation_vi: "Giáo sư Hoa yêu cầu giữ mỗi tập dưới 18 phút ('under eighteen minutes').",
            explanation_en: "Professor Hoa wants each episode under eighteen minutes.",
          },
          {
            id: "l3-q22",
            number: 22,
            type: "table_completion",
            prompt: "Table Completion (ONE NUMBER): Condenser microphones must be booked __________ hours in advance.",
            correctAnswers: ["48", "forty-eight"],
            explanation_vi: "Cần đặt trước micro tụ điện 48 giờ.",
            explanation_en: "Microphones must be reserved 48 hours ahead.",
          },
          {
            id: "l3-q23",
            number: 23,
            type: "short_answer",
            prompt: "Short Answer (TWO WORDS): What storage item must students bring themselves?",
            correctAnswers: ["memory cards", "memory card"],
            explanation_vi: "Khoa đã ngừng cho mượn thẻ nhớ nên sinh viên tự mang ('memory cards').",
            explanation_en: "Students must bring their own memory cards.",
          },
          {
            id: "l3-q24",
            number: 24,
            type: "mcq",
            prompt: "Who is confirmed as the guest for the pilot episode?",
            options: [
              "A. A visiting civil engineer",
              "B. Dr. Phong from the Architecture Faculty",
              "C. Professor Hoa",
            ],
            correctAnswers: ["B", "B. Dr. Phong from the Architecture Faculty"],
            explanation_vi: "Kỹ sư dân dụng đi hội nghị nước ngoài nên khách mời chốt là TS. Phong khoa Kiến trúc.",
            explanation_en: "Dr. Phong from the Architecture Faculty is confirmed.",
          },
          {
            id: "l3-q25",
            number: 25,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Length of the opening street-noise audio hook: __________ seconds.",
            correctAnswers: ["90", "ninety"],
            explanation_vi: "Mở đầu bằng đoạn âm thanh đường phố dài 90 giây ('ninety-second street sound clip').",
            explanation_en: "They plan a ninety-second street sound clip.",
          },
          {
            id: "l3-q26",
            number: 26,
            type: "note_completion",
            prompt: "Note Completion (ONE NUMBER): Length of the main guest interview segment: __________ minutes.",
            correctAnswers: ["12", "twelve"],
            explanation_vi: "Phần phỏng vấn chính dài 12 phút.",
            explanation_en: "The main interview will run twelve minutes.",
          },
          {
            id: "l3-q27",
            number: 27,
            type: "note_completion",
            prompt: "Note Completion (TWO WORDS): Instrument used in the student composer's original intro music: __________.",
            correctAnswers: ["acoustic guitar", "guitar"],
            explanation_vi: "Nhạc mở đầu là đoạn guitar mộc 20 giây ('acoustic guitar loop').",
            explanation_en: "The composer offered a 20-second acoustic guitar loop.",
          },
          {
            id: "l3-q28",
            number: 28,
            type: "mcq",
            prompt: "What condition did the student composer request for using her intro loop?",
            options: [
              "A. Payment of a small student royalty fee",
              "B. Listing her name in the episode description",
              "C. Inviting her onto the second podcast episode",
            ],
            correctAnswers: ["B", "B. Listing her name in the episode description"],
            explanation_vi: "Cô đồng ý theo giấy phép Creative Commons với điều kiện ghi tên cô trong phần mô tả tập.",
            explanation_en: "She only asked to be credited in the episode description.",
          },
          {
            id: "l3-q29",
            number: 29,
            type: "sentence_completion",
            prompt: "Sentence Completion (ONE WORD): Publishing bilingual __________ online will expand international reach and help deaf listeners.",
            correctAnswers: ["transcripts", "transcript"],
            explanation_vi: "Đăng bản ghi song ngữ ('bilingual transcripts') trên web trường.",
            explanation_en: "Publishing bilingual transcripts online expands reach and accessibility.",
          },
          {
            id: "l3-q30",
            number: 30,
            type: "note_completion",
            prompt: "Note Completion (ONE WORD): Day scheduled for the test recording in Studio A: __________ morning.",
            correctAnswers: ["Monday"],
            explanation_vi: "Lịch thu thử vào sáng thứ Hai lúc 9:30 tại Studio A.",
            explanation_en: "The test recording is scheduled for Monday morning.",
          },
        ],
      },
      {
        id: "l3-s4",
        title: "Part 4: Academic Lecture — How Acoustic Design Shapes Classroom Learning (Questions 31–40)",
        instruction: "Listen to an architectural acoustics lecture on classroom sound quality and complete the lecture notes. Answer Questions 31–40.",
        audioUrl: "/audio/listening/l3-part4.mp3",
        audioScript: `Lecturer: Good morning. When architects design a new school or university building, daylighting and ventilation usually receive top billing, while room acoustics are often treated as an afterthought. Yet research in educational psychology demonstrates that poor sound design quietly undermines both comprehension and teacher health.

Two physical measurements govern how clearly students hear speech inside a classroom. The first is reverberation time—how long an echo lingers after a speaker stops talking. Rooms dominated by bare concrete walls, tiled floors, and wide glass windows can exhibit reverberation times exceeding one point two seconds, causing consecutive syllables to blur together like words spoken inside a swimming pool. For clear instruction, international guidelines recommend keeping classroom reverberation below zero point six seconds.

The second crucial factor is the signal-to-noise ratio—the decibel gap between the teacher's voice and background sounds such as traffic outside, ceiling fans, or scraping chairs. While adult native listeners can mentally fill in missing syllables even in noisy rooms, young children and second-language learners lack the same predictive vocabulary buffer. Studies show that second-language students lose up to twenty-five percent of spoken word accuracy when sitting in the back row of an untreated hall.

Poor acoustics also take a heavy physical toll on educators. Teachers working in echoey classrooms instinctively raise their voices by eight to ten decibels all day—an effect known in psychoacoustics as the Lombard effect. Over several semesters, chronic vocal strain accounts for a remarkably high share of teacher sick leave worldwide.

Fortunately, acoustic retrofits do not require tearing down walls. Hanging lightweight mineral-wool baffles from ceilings, installing fabric pinboards along rear walls, and attaching felt pads beneath metal chair legs can cut background clatter dramatically at modest cost. In an urban primary school trial in Singapore, simple ceiling panels and felt chair glides reduced ambient classroom noise by seven decibels within a single weekend—improving student reading-aloud scores and leaving teachers noticeably less fatigued by Friday afternoon.`,
        questions: [
          {
            id: "l3-q31",
            number: 31,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Architectural school plans prioritize daylighting and __________, often neglecting acoustics.",
            correctAnswers: ["ventilation"],
            explanation_vi: "Ánh sáng tự nhiên và thông gió ('ventilation') thường được ưu tiên hơn âm học.",
            explanation_en: "Daylighting and ventilation usually receive top priority.",
          },
          {
            id: "l3-q32",
            number: 32,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): The duration an echo lingers after speech stops is called __________ time.",
            correctAnswers: ["reverberation"],
            explanation_vi: "Thời gian vang vọng sau khi ngừng nói gọi là 'reverberation time'.",
            explanation_en: "This measurement is called reverberation time.",
          },
          {
            id: "l3-q33",
            number: 33,
            type: "note_completion",
            prompt: "Lecture Notes (DECIMAL NUMBER): Recommended maximum classroom reverberation time: __________ seconds.",
            correctAnswers: ["0.6", "zero point six"],
            explanation_vi: "Tiêu chuẩn quốc tế khuyến nghị giữ dưới 0,6 giây ('below zero point six seconds').",
            explanation_en: "Guidelines recommend keeping reverberation below 0.6 seconds.",
          },
          {
            id: "l3-q34",
            number: 34,
            type: "note_completion",
            prompt: "Lecture Notes (ONE NUMBER): Second-language learners in the back row of untreated rooms can lose up to __________ percent of spoken word accuracy.",
            correctAnswers: ["25", "twenty-five", "25%"],
            explanation_vi: "Người học ngoại ngữ ngồi hàng cuối có thể mất tới 25% độ chính xác khi nghe từ.",
            explanation_en: "Second-language students lose up to twenty-five percent of spoken word accuracy.",
          },
          {
            id: "l3-q35",
            number: 35,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Instinctively speaking louder in noisy rooms is known as the __________ effect.",
            correctAnswers: ["Lombard"],
            explanation_vi: "Hiện tượng vô thức nói to hơn trong phòng ồn gọi là hiệu ứng Lombard ('Lombard effect').",
            explanation_en: "Psychoacoustics calls this the Lombard effect.",
          },
          {
            id: "l3-q36",
            number: 36,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Chronic __________ strain is a leading cause of teacher sick leave globally.",
            correctAnswers: ["vocal"],
            explanation_vi: "Căng dây thanh quản mạn tính ('chronic vocal strain') khiến nhiều giáo viên phải nghỉ ốm.",
            explanation_en: "Chronic vocal strain accounts for a high share of teacher sick leave.",
          },
          {
            id: "l3-q37",
            number: 37,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Acoustic retrofit option 1: hang lightweight mineral-wool __________ from ceilings.",
            correctAnswers: ["baffles"],
            explanation_vi: "Treo các tấm tiêu âm bông khoáng ('mineral-wool baffles') trên trần.",
            explanation_en: "Hang lightweight mineral-wool baffles from ceilings.",
          },
          {
            id: "l3-q38",
            number: 38,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Acoustic retrofit option 2: mount fabric __________ along rear walls.",
            correctAnswers: ["pinboards", "pinboard"],
            explanation_vi: "Lắp bảng ghim bọc vải ('fabric pinboards') ở tường phía sau.",
            explanation_en: "Install fabric pinboards along rear walls.",
          },
          {
            id: "l3-q39",
            number: 39,
            type: "note_completion",
            prompt: "Lecture Notes (ONE WORD): Acoustic retrofit option 3: attach __________ pads underneath metal chair legs.",
            correctAnswers: ["felt"],
            explanation_vi: "Dán đệm nỉ ('felt pads') dưới chân ghế kim loại để giảm tiếng cọ xát.",
            explanation_en: "Attach felt pads beneath metal chair legs.",
          },
          {
            id: "l3-q40",
            number: 40,
            type: "note_completion",
            prompt: "Lecture Notes (ONE NUMBER): In the Singapore school trial, simple acoustic upgrades cut ambient noise by __________ decibels.",
            correctAnswers: ["7", "seven"],
            explanation_vi: "Thử nghiệm tại trường tiểu học Singapore giảm tiếng ồn nền tới 7 decibel chỉ sau một cuối tuần.",
            explanation_en: "Ambient classroom noise dropped by seven decibels.",
          },
        ],
      },
    ],
  },
];
