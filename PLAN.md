# Kế hoạch triển khai — Ôn IELTS (onielts.vn)

> Nền tảng luyện thi IELTS toàn diện cho người học Việt Nam với thương hiệu, thiết kế và nội dung 100% nguyên bản. Không liên kết với British Council, IDP hay Cambridge Assessment English.

---

## 1. Quyết định kiến trúc & thiết kế

1. **Thư mục dự án**: `/home/antigravity/on-ielts` (Next.js App Router + TypeScript + Tailwind CSS v4 + các UI primitive chuẩn shadcn/ui + Radix/Lucide).
2. **Nhận diện thương hiệu**:
   - Tên: **Ôn IELTS** (`onielts.vn` placeholder)
   - Khẩu hiệu VI: *"Ôn luyện IELTS thông minh cùng AI"* | EN: *"Smarter IELTS prep with AI"*
   - Màu chủ đạo duy nhất: **Xanh ngọc lục bảo tươi (Emerald `#059669` / hover `#047857`)** kết hợp nền trắng/xám trung tính hiện đại (`slate`/`stone`), hỗ trợ đầy đủ Light & Dark mode.
   - Font chữ: **Be Vietnam Pro** (hỗ trợ hoàn hảo dấu tiếng Việt).
   - Logo SVG wordmark tự thiết kế + favicon `icon.svg`.
3. **Đa ngôn ngữ (i18n)**:
   - Dùng `next-intl` với chế độ cookie/header locale (`vi` mặc định, `en` phụ) để URL luôn gọn đẹp thân thiện SEO tiếng Việt và có nút chuyển đổi VI/EN ngay trên header không cần tải lại phức tạp (tất cả chuỗi UI nằm trong `messages/vi.json` và `messages/en.json`).
4. **Cơ sở dữ liệu & Auth (Supabase + Mock Adapter)**:
   - Toàn bộ lược đồ SQL nằm trong `supabase/migrations/0001_initial_schema.sql` và `0002_seed_config.sql`, bật **Row Level Security (RLS)** trên MỌI bảng.
   - Hỗ trợ Google OAuth + Email OTP qua Supabase Auth (`@supabase/ssr`).
   - Khi chưa có biến môi trường `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, hệ thống tự động dùng **Local Store Adapter** lưu bền vững tại `.local-data/store.json` (có sẵn 3 tài khoản demo: Free, Premium, Admin để kiểm thử mọi luồng ngay lập tức) — đánh dấu `MOCKED` trong mục Status.
5. **AI Wrapper duy nhất (`src/lib/ai.ts`)**:
   - Toàn bộ tính năng AI (chấm Writing, chấm Speaking + nhận dạng giọng nói, Hội thoại AI, 8 công cụ AI, Flashcard auto-fill, Mentor Ôn IELTS) đi qua duy nhất `src/lib/ai.ts`.
   - Đọc `GEMINI_API_KEY` và `GEMINI_MODEL` (mặc định `gemini-2.5-flash`) trên server-only.
   - Mọi đầu ra có cấu trúc đều được kiểm tra bằng **Zod** và tự động **retry 1 lần** nếu JSON lỗi.
   - Phòng chống prompt-injection bằng thẻ phân tách dữ liệu `<user_submission_data>...</user_submission_data>`.
   - Giới hạn tốc độ (`src/lib/rate-limit.ts`), bộ nhớ đệm theo hash đầu vào, giới hạn độ dài văn bản & audio (tối đa 3 phút / 10MB), `maxDuration = 60`, và ghi log token + ước tính chi phí vào bảng `ai_usage_logs`.
   - Khi chưa có `GEMINI_API_KEY`, tự động chuyển sang bộ tạo phản hồi AI mô phỏng giàu ngữ cảnh (`MOCKED`) nhưng vẫn chạy đúng quy trình Zod + metering + logging.
6. **Thanh toán (`src/lib/payments/`)**:
   - Kiến trúc adapter (`PaymentProvider`) với **PayOS (VietQR)** là nhà cung cấp chính, sẵn sàng mở rộng VNPay/MoMo/Stripe.
   - Webhook `/api/webhooks/payos` xác thực chữ ký HMAC-SHA256, xử lý idempotent theo `order_code`, gia hạn `premium_expires_at`. Có chế độ sandbox mô phỏng khi chưa cấu hình khóa PayOS.
7. **Kiểm thử & Xác minh**:
   - Unit test (Vitest): công thức làm tròn band điểm IELTS (`6.25 → 6.5`, `6.75 → 7.0`, bảng quy đổi Academic/General/Listening), bộ kiểm tra RLS trên 100% bảng SQL, logic usage metering, webhook PayOS idempotency & chữ ký, auto-grading test engine.
   - Trình duyệt thực tế (Playwright + Google Chrome): kiểm tra từng pha và lưu ảnh chụp màn hình vào `docs/screenshots/phase-N/`.

---

## 2. Danh sách công việc theo từng Pha (Task Checklist)

### Pha 1: Khởi tạo, Thương hiệu, Giao diện khung, Trang chủ, i18n, Auth, DB Schema + RLS
- [x] Khởi tạo dự án Next.js App Router + TypeScript + Tailwind CSS + ESLint + Vitest
- [x] Cấu hình `.env.example`, font Be Vietnam Pro, hệ thống màu Emerald + Dark/Light mode
- [x] Tạo Logo SVG wordmark & Favicon `app/icon.svg`
- [x] Cấu hình `next-intl` (`messages/vi.json`, `messages/en.json`) & bộ chuyển đổi ngôn ngữ VI/EN
- [x] Xây dựng Sticky Header (logo, mega-menu 9 mục, thanh tìm kiếm toàn trang, VI/EN, theme, avatar menu)
- [x] Xây dựng Footer đầy đủ (Resources, Legal, Company, mạng xã hội, tuyên bố miễn trừ trách nhiệm không liên kết IELTS chính thức)
- [x] Xây dựng Trang chủ đúng thứ tự 6 khối: Hero, Carousel Đánh giá, Đề thi IELTS mới nhất, CTA Thi mỗi ngày & Bảng xếp hạng, Lưới Công cụ học tập, 6 Carousel có "Xem tất cả" (Khóa học, Hội thoại AI, Bài tập nâng cấp câu viết, Phát âm IPA, Chép chính tả & Shadowing, Video YouTube)
- [x] Modal "Thêm Flashcard" toàn cục (bôi đen từ bất kỳ trang nào → hiện nút lưu nhanh → mở modal AI gợi ý nghĩa VI, IPA, ví dụ)
- [x] Xác thực (Supabase Auth Google + Email OTP + chế độ Demo cục bộ khi thiếu key) & trang Đăng nhập
- [x] Lược đồ SQL hoàn chỉnh (`supabase/migrations/`) với RLS bật trên 100% bảng + kiểm thử RLS tự động (`tests/rls.test.ts` + `supabase/tests/rls.test.sql`)
- [x] Trang pháp lý & công ty (Privacy, Terms, Disclaimers, Refund, FAQs, About, Contact, Feature Requests, HTML Sitemap)

### Pha 2: Công cụ tính Band điểm + Component AI dùng chung + 8 Công cụ AI tổng quát
- [x] `src/lib/ai.ts`: wrapper Gemini duy nhất, Zod validation + 1 retry, chống prompt-injection, caching, token logging, mock fallback
- [x] `src/lib/rate-limit.ts` & bảng quy đổi điểm Reading/Listening lưu trong DB (có thể sửa trong Admin)
- [x] Bộ tính điểm Band (`/band-calculator`): Overall, Listening, Reading (Academic & General), Writing, Speaking với quy tắc làm tròn chuẩn IELTS + unit test (`6.25 → 6.5`, `6.75 → 7.0`)
- [x] Component dùng chung `<AiToolWorkbench />` (nhập liệu, tùy chọn, kết quả, sao chép, lịch sử)
- [x] 8 công cụ AI tổng quát (`/tools/[slug]`): Paraphraser, Summarizer, Translator (EN⇄VI), Grammar Checker, Grammar Corrector, Text Improver, Complex Sentence Explainer, Text-to-Speech (browser speechSynthesis + chọn giọng/tốc độ)

### Pha 3: AI Writing Checkers & Generators + Writing Improvement Exercises + Usage Metering & Paywall
- [x] API & giao diện chấm Writing (`/writing`): Academic Task 1 (tải ảnh biểu đồ), General Task 1 (viết thư), Task 2 (bài luận)
- [x] Kết quả chấm chi tiết: Overall + 4 tiêu chí (TA/TR, CC, LR, GRA), highlight lỗi trực tiếp kèm sửa lỗi, giải thích tiếng Việt, gợi ý nâng cấp từ vựng, bài viết lại Band 8+, chế độ riêng tư mặc định (`is_public = false`) có công tắc chia sẻ
- [x] Trình tạo bài mẫu Band 9 (`/writing/generator`)
- [x] Bài tập nâng cấp câu viết (`/writing/exercises`): luyện viết lại từng câu có chấm điểm & gợi ý AI
- [x] Hệ thống đếm lượt dùng phía server (`usage_metering`: Free = 2 lượt chấm/kỹ năng/tháng, giới hạn ngày cho công cụ cơ bản) + Modal Paywall khi chạm giới hạn

### Pha 4: AI Speaking Checkers, Generators & Hội thoại AI
- [x] `src/lib/audio-recorder.ts`: MediaRecorder tương thích Safari/iOS (`audio/mp4`) & Chrome/Firefox (`audio/webm`), giới hạn tối đa 3 phút & dung lượng 10MB
- [x] AI Speaking Checkers (`/speaking`): Parts 1–3 (ghi âm trực tiếp hoặc tải file audio → chuyển văn bản → chấm FC, LR, GRA, Pronunciation gắn nhãn rõ `"điểm tham khảo"` + nhận xét tiếng Việt + câu trả lời cải thiện)
- [x] Trình tạo câu hỏi & câu trả lời mẫu Speaking Part 1, Part 2 cue card, Part 3 (`/speaking/generator`)
- [x] Hội thoại AI (`/conversations`): đóng vai đa chủ đề (Giới thiệu bản thân, Gia đình, Quê hương, Sở thích, Công việc, Nhà ở, Sinh nhật, Trường học...) có đầu vào/ra giọng nói và gợi ý câu trả lời cho từng lượt

### Pha 5: Hệ thống làm đề IELTS (4 kỹ năng) + Đề thi mỗi ngày + Bảng xếp hạng
- [x] Giao diện thi trên máy tính chuẩn IELTS (`/tests/[slug]`): chia 2 cột (split-pane), trình phát âm thanh (tích hợp giọng đọc thật qua Web Speech API + thanh tua), đồng hồ đếm ngược, bảng điều hướng câu hỏi, công cụ tô sáng (highlight) & ghi chú (notes)
- [x] Hỗ trợ đầy đủ dạng câu hỏi: Trắc nghiệm (MCQ), T/F/NG, Y/N/NG, Matching Headings, Matching Information, Sentence/Summary/Table/Note/Flow-chart Completion, Map/Diagram Labelling, Short Answer
- [x] Chấm điểm tự động theo bảng quy đổi DB, giải thích song ngữ VI + EN, phân tích lỗi sai theo từng dạng câu hỏi
- [x] Tạo dữ liệu gốc 100%: **3 đề luyện tập cho mỗi kỹ năng** (3 Reading, 3 Listening, 3 Writing, 3 Speaking = 12 đề gốc hoàn chỉnh)
- [x] Đề thi mỗi ngày (`/daily-exam`) theo múi giờ `Asia/Ho_Chi_Minh`, 1 lần làm/người/ngày, tính giờ phía server + Bảng xếp hạng (`/leaderboard`) theo điểm rồi thời gian hoàn thành, có bảng Ngày / Tuần / Tháng / Năm thưởng chuỗi ngày (streak)

### Pha 6: Trang Bảng giá + PayOS (VietQR) + Quản lý hết hạn Premium
- [x] Trang Bảng giá (`/pricing`): gói 1 / 3 / 6 / 12 tháng trả một lần bằng VND, giá gạch ngang, banner đếm ngược khuyến mãi cấu hình được, nhãn `"Phổ biến nhất"`, ô nhập mã giảm giá — toàn bộ dữ liệu đọc từ DB/Admin config
- [x] Adapter thanh toán mở rộng được (`src/lib/payments/`) + triển khai PayOS (VietQR) + chế độ Sandbox mô phỏng QR & thanh toán thử
- [x] Webhook `/api/webhooks/payos`: xác thực chữ ký HMAC-SHA256, chống xử lý trùng (idempotent), kích hoạt & cộng dồn thời hạn Premium, tự động kiểm tra hết hạn

### Pha 7a: Flashcards + Chép chính tả & Shadowing
- [x] Hệ thống Flashcards (`/flashcards`): quản lý bộ thẻ, tạo/sửa/xóa thẻ, học lặp lại ngắt quãng (SM-2 Spaced Repetition), đồng bộ server/local, kết nối trọn vẹn với Modal bôi đen thêm thẻ toàn cục
- [x] Chép chính tả & Shadowing (`/dictation`): bài học IELTS nguyên bản có phát âm thanh chuẩn theo từng câu, kiểm tra sai khác từng từ (word-level diff), chế độ Shadowing điều chỉnh tốc độ + ghi âm tự nghe lại

### Pha 7b: Phát âm IPA + Video học IELTS + Khóa học + Blog + Mentor Ôn IELTS
- [x] Phát âm (`/pronunciation` & `/pronunciation/[slug]`): bảng IPA đầy đủ + trang riêng cho từng âm IPA (khẩu hình, mẹo cho người Việt, từ ví dụ có phát âm, ghi âm + chấm AI gắn nhãn `"điểm tham khảo"`)
- [x] Video học IELTS (`/videos` & `/videos/[slug]`): nhúng YouTube + bản ghi tương tác đồng bộ nguyên bản, bấm từng dòng để tua video, bấm từng từ để mở modal lưu Flashcard
- [x] Khóa học (`/courses` & `/courses/[slug]`): khóa học theo lộ trình có lưu tiến độ từng bài học và câu hỏi kiểm tra
- [x] Blog/CMS (`/blog` & `/blog/[slug]`): bài viết hướng dẫn luyện thi IELTS tiếng Việt nguyên bản
- [x] Chatbot **"Mentor Ôn IELTS"** (widget nổi + trang `/mentor`): trò chuyện tiếng Việt, lập lộ trình học cá nhân hóa

### Pha 8: Hồ sơ & Tiến độ, Mời bạn bè, Chống bot, Trang Quản trị (Admin), SEO & Hoàn thiện
- [x] Hồ sơ & Bảng điều khiển tiến độ (`/profile`, `/progress`): lịch sử band điểm, phân tích điểm yếu theo dạng câu hỏi, quản lý quyền riêng tư bài viết Writing
- [x] Hệ thống Mời bạn bè (`/referral`): mã giới thiệu riêng, link `?ref=...`, theo dõi lượt đăng ký & nâng cấp (chưa tự động trả thưởng)
- [x] Bảo vệ chống bot: giới hạn tốc độ API + xác minh CAPTCHA/honeypot (sẵn sàng cắm Cloudflare Turnstile) + trạng thái xác minh email
- [x] Trang Quản trị (`/admin`): quản lý Đề thi (JSON schema & biểu mẫu trực quan), sửa bảng quy đổi Band Reading/Listening, quản lý nội dung (Khóa học, Blog, Đánh giá trang chủ), quản lý Người dùng & gói Premium, quản lý Bảng giá & Banner đếm ngược & Mã giảm giá, theo dõi Token & Chi phí AI
- [x] SEO & Tối ưu: metadata động SSR/SSG, `sitemap.xml`, `robots.txt`, OpenGraph, JSON-LD `schema.org`, tối ưu lazy-load, rà soát cuối cùng trên trình duyệt

---

## Status
- Phase 0 (plan): **completed** — Đã tạo `PLAN.md` với kiến trúc và danh sách công việc đầy đủ 8 pha.
- Phase 1: **completed** — Khởi tạo Next.js + Tailwind + Be Vietnam Pro, logo SVG, Header mega-menu 9 mục, Footer kèm tuyên bố miễn trừ trách nhiệm, Trang chủ 6 khối chuẩn thứ tự, i18n VI/EN, Light/Dark mode, Global Add Flashcard modal, trang pháp lý/công ty, lược đồ SQL 27 bảng có RLS 100% + 7/7 test RLS đạt, ảnh chụp lưu tại `docs/screenshots/phase-1/`. **MOCKED**: Supabase Auth & DB dùng local JSON store adapter (`.local-data/store.json`) khi chưa cấu hình `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
- Phase 2: **completed** — Đã xây dựng bộ tính điểm Band 5 chế độ đọc từ bảng quy đổi DB + 7 unit test làm tròn chuẩn (`6.25 → 6.5`, `6.75 → 7.0`), `src/lib/ai.ts` duy nhất (Zod + 1 retry + chống prompt-injection + cache + log token), rate limiter, component `<AiToolWorkbench />` dùng chung cho 7 công cụ AI + Text-to-Speech, ảnh chụp tại `docs/screenshots/phase-2/`. **MOCKED**: Gemini AI chạy mock fallback hợp lệ Zod khi chưa cấu hình `GEMINI_API_KEY`.
- Phase 3: **completed** — Hoàn thành AI Writing Checkers (Academic Task 1 kèm tải ảnh biểu đồ, General Task 1, Task 2), highlight lỗi trực tiếp, nâng cấp từ vựng, viết lại Band 8+, quyền riêng tư mặc định có công tắc chia sẻ, Trình tạo bài mẫu Band 9 (`/writing/generator`), Bài tập nâng cấp câu (`/writing/exercises`), đếm lượt dùng phía server (`src/lib/usage-limits.ts`) & Paywall modal, ảnh chụp tại `docs/screenshots/phase-3/`. **MOCKED**: Gemini AI dùng mock fallback hợp lệ Zod khi thiếu `GEMINI_API_KEY`.
- Phase 4: **completed** — Hoàn thành `src/lib/audio-recorder.ts` (hỗ trợ Safari MP4 & Chrome WebM, giới hạn 3 phút / 10MB), AI Speaking Checkers Parts 1–3 (`/speaking`) gắn nhãn `"điểm tham khảo"` cho Phát âm + hạn mức server, Trình tạo câu trả lời mẫu & Cue Card (`/speaking/generator`), Hội thoại AI 8 chủ đề có giọng nói vào/ra & gợi ý Band 8 (`/conversations`), ảnh chụp tại `docs/screenshots/phase-4/`. **MOCKED**: Chuyển âm thanh & chấm Speaking qua `src/lib/ai.ts` chạy mock fallback hợp lệ Zod khi thiếu `GEMINI_API_KEY`.
- Phase 5: **completed** — Hoàn thành phòng thi chuẩn máy tính 2 cột (`/tests`, `/tests/[slug]`) hỗ trợ đủ 12 dạng câu hỏi IELTS, trình phát audio + bản đồ/biểu đồ SVG gốc, tô sáng & ghi chú, chấm tự động từ bảng quy đổi DB + phân tích lỗi theo dạng câu + giải thích VI/EN, 12 đề thi nguyên bản (3 đề/kỹ năng) + 4 test unit grader đạt (18/18 tổng test), Đề thi mỗi ngày múi giờ `Asia/Ho_Chi_Minh` bấm giờ máy chủ (`/daily-exam`) & Bảng xếp hạng Ngày/Tuần/Tháng/Năm thưởng streak (`/leaderboard`), ảnh chụp tại `docs/screenshots/phase-5/`.
- Phase 6: **completed** — Hoàn thành Trang Bảng giá đọc từ DB (`/pricing`) với gói 1/3/6/12 tháng VND, giá gạch ngang, nhãn `"Phổ biến nhất"`, banner đếm ngược cấu hình được, mã giảm giá (`ONIELTS15`, `SINHVIEN20`), adapter thanh toán mở rộng (`src/lib/payments/`) với PayOS VietQR, webhook xác thực HMAC-SHA256 chống trùng (idempotent) + cộng dồn hạn sử dụng Premium + 4 unit test đạt (22/22 tổng test), ảnh chụp tại `docs/screenshots/phase-6/`. **MOCKED**: PayOS chạy chế độ Sandbox mô phỏng VietQR & ký webhook HMAC thật khi chưa cấu hình `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY`.
- Phase 7a: **completed** — Hoàn thành Flashcards (`/flashcards`) với thuật toán SM-2 Spaced Repetition, quản lý bộ thẻ, phát âm mẫu & kết nối Modal lưu nhanh toàn cục; Chép chính tả & Shadowing (`/dictation`) có kiểm tra sai khác từng từ, chỉnh tốc độ & ghi âm nói đuổi + 3 unit test đạt (25/25 tổng test), ảnh chụp tại `docs/screenshots/phase-7a/`.
- Phase 7b: **completed** — Hoàn thành Bảng IPA & trang chi tiết từng âm (`/pronunciation`, `/pronunciation/[slug]`) kèm chấm phát âm AI `"điểm tham khảo"`, Video học IELTS nhúng YouTube kèm phụ đề tương tác bấm tua & bấm từng từ lưu Flashcard (`/videos`, `/videos/[slug]`), Khóa học có tiến độ & bài kiểm tra nhanh (`/courses`, `/courses/[slug]`), Blog IELTS (`/blog`, `/blog/[slug]`) và Chatbot Mentor Ôn IELTS (`/mentor` + nút truy cập nổi), ảnh chụp tại `docs/screenshots/phase-7b/`.
- Phase 8: **completed** — Hoàn thành Hồ sơ & quyền riêng tư bài viết (`/profile`), Bảng Tiến độ & phân tích lỗi sai tổng hợp (`/progress`), Mời bạn bè theo dõi `?ref=` (`/referral`), bảo vệ chống bot (`src/lib/bot-protection.ts`), Trung tâm Quản trị 6 mục (`/admin` — Chi phí AI, Bảng Band, Bảng giá/Banner/Mã giảm giá, Đề thi JSON Schema, Blog, Người dùng & Đơn hàng), SEO (`sitemap.xml`, `robots.txt`, JSON-LD, OpenGraph) + 3 test bảo mật đạt (**28/28 tổng test đạt**, 0 lỗi lint/typecheck/build), ảnh chụp tại `docs/screenshots/phase-8/`. **MOCKED**: Turnstile CAPTCHA dùng honeypot fallback khi chưa cấu hình `TURNSTILE_SECRET_KEY`.

### Known issues / Lưu ý triển khai Production
- Các dịch vụ bên ngoài chưa gắn khóa API đang chạy qua adapter mô phỏng (đều đánh dấu **MOCKED** ở trên): Supabase DB/Auth, Google Gemini AI, PayOS VietQR và Cloudflare Turnstile. Chỉ cần điền khóa vào `.env.local` và chạy migration SQL `supabase/migrations/` để kích hoạt chạy thật 100%.
- Âm thanh Listening & Dictation hiện dùng giọng đọc trình duyệt (`window.speechSynthesis`) — hoạt động ngay trên mọi trình duyệt mà không cần tệp MP3 ngoài; có thể nâng cấp gắn file âm thanh Supabase Storage (`audio_url`) trong Admin khi ra mắt bản chính thức.
