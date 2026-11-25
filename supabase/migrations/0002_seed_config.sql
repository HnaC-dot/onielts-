-- =============================================================================
-- Ôn IELTS — Initial Seed Configuration
-- Band conversion tables (editable in Admin), Pricing plans, Promo banner & codes
-- =============================================================================

-- Listening raw score (0-40) -> Band
INSERT INTO public.band_conversion_tables (skill, min_raw, max_raw, band_score) VALUES
  ('listening', 39, 40, 9.0),
  ('listening', 37, 38, 8.5),
  ('listening', 35, 36, 8.0),
  ('listening', 32, 34, 7.5),
  ('listening', 30, 31, 7.0),
  ('listening', 26, 29, 6.5),
  ('listening', 23, 25, 6.0),
  ('listening', 18, 22, 5.5),
  ('listening', 16, 17, 5.0),
  ('listening', 13, 15, 4.5),
  ('listening', 11, 12, 4.0),
  ('listening', 8, 10, 3.5),
  ('listening', 6, 7, 3.0),
  ('listening', 4, 5, 2.5),
  ('listening', 0, 3, 2.0);

-- Academic Reading raw score (0-40) -> Band
INSERT INTO public.band_conversion_tables (skill, min_raw, max_raw, band_score) VALUES
  ('reading_academic', 39, 40, 9.0),
  ('reading_academic', 37, 38, 8.5),
  ('reading_academic', 35, 36, 8.0),
  ('reading_academic', 33, 34, 7.5),
  ('reading_academic', 30, 32, 7.0),
  ('reading_academic', 27, 29, 6.5),
  ('reading_academic', 23, 26, 6.0),
  ('reading_academic', 19, 22, 5.5),
  ('reading_academic', 15, 18, 5.0),
  ('reading_academic', 13, 14, 4.5),
  ('reading_academic', 10, 12, 4.0),
  ('reading_academic', 8, 9, 3.5),
  ('reading_academic', 6, 7, 3.0),
  ('reading_academic', 4, 5, 2.5),
  ('reading_academic', 0, 3, 2.0);

-- General Training Reading raw score (0-40) -> Band
INSERT INTO public.band_conversion_tables (skill, min_raw, max_raw, band_score) VALUES
  ('reading_general', 40, 40, 9.0),
  ('reading_general', 39, 39, 8.5),
  ('reading_general', 37, 38, 8.0),
  ('reading_general', 36, 36, 7.5),
  ('reading_general', 34, 35, 7.0),
  ('reading_general', 32, 33, 6.5),
  ('reading_general', 30, 31, 6.0),
  ('reading_general', 27, 29, 5.5),
  ('reading_general', 23, 26, 5.0),
  ('reading_general', 19, 22, 4.5),
  ('reading_general', 15, 18, 4.0),
  ('reading_general', 12, 14, 3.5),
  ('reading_general', 9, 11, 3.0),
  ('reading_general', 6, 8, 2.5),
  ('reading_general', 0, 5, 2.0);

-- Default Pricing Plans (1, 3, 6, 12 months one-time VND, editable in Admin)
INSERT INTO public.pricing_plans (slug, name_vi, name_en, duration_months, price_vnd, original_price_vnd, is_popular, features_vi, features_en, sort_order) VALUES
  ('premium-1m', 'Gói 1 Tháng', '1-Month Plan', 1, 199000, 299000, FALSE,
   '["Chấm AI Writing & Speaking không giới hạn", "Tất cả trình tạo bài mẫu Band 9", "Hội thoại AI đa chủ đề không giới hạn", "Phân tích lỗi sai theo dạng câu hỏi", "Bài nộp ở chế độ riêng tư mặc định"]'::jsonb,
   '["Unlimited AI Writing & Speaking scoring", "All Band 9 sample generators", "Unlimited AI Role-play Conversations", "Mistake analytics by question type", "Private-by-default submissions"]'::jsonb, 1),
  ('premium-3m', 'Gói 3 Tháng', '3-Month Plan', 3, 499000, 897000, FALSE,
   '["Mọi quyền lợi Gói 1 Tháng", "Tiết kiệm 44% so với gia hạn lẻ", "Lộ trình cá nhân hóa từ Mentor Ôn IELTS", "Đồng bộ Flashcard & tiến độ đa thiết bị", "Hỗ trợ học thuật ưu tiên"]'::jsonb,
   '["Everything in 1-Month Plan", "Save 44% vs monthly renewal", "Personalized Mentor Ôn IELTS roadmap", "Multi-device Flashcard & progress sync", "Priority learner support"]'::jsonb, 2),
  ('premium-6m', 'Gói 6 Tháng', '6-Month Plan', 6, 799000, 1794000, TRUE,
   '["Mọi quyền lợi Gói 3 Tháng", "Tiết kiệm 55% — Lựa chọn tốt nhất cho lộ trình 1.0–1.5 Band", "Không giới hạn công cụ AI & Chép chính tả", "Báo cáo tiến độ chuyên sâu theo từng kỹ năng", "Ưu tiên trải nghiệm tính năng AI mới"]'::jsonb,
   '["Everything in 3-Month Plan", "Save 55% — Best for +1.0 to +1.5 Band jump", "Unlimited AI tools & Dictation/Shadowing", "Deep skill-by-skill analytics report", "Early access to new AI features"]'::jsonb, 3),
  ('premium-12m', 'Gói 12 Tháng', '12-Month Plan', 12, 1299000, 3588000, FALSE,
   '["Mọi quyền lợi Gói 6 Tháng", "Tiết kiệm 64% — Chỉ ~108.000đ/tháng", "Trọn bộ khóa học, đề thi và bài luyện mới cả năm", "Hỗ trợ giải đáp lộ trình 1-1 qua Mentor AI", "Thanh toán 1 lần, không tự động gia hạn"]'::jsonb,
   '["Everything in 6-Month Plan", "Save 64% — Only ~108k VND/month", "All new courses, tests & lessons all year", "1-on-1 AI Mentor roadmap guidance", "One-time payment, no auto-renewal"]'::jsonb, 4)
ON CONFLICT (slug) DO NOTHING;

-- Configurable Countdown Promo Banner
INSERT INTO public.promo_banners (key, title_vi, title_en, badge_vi, badge_en, ends_at, cta_vi, cta_en, is_active) VALUES
  ('main_pricing_promo',
   'Ưu đãi mùa thi IELTS — Giảm thêm 15% khi nhập mã ONIELTS15',
   'IELTS Exam Season Offer — Extra 15% off with code ONIELTS15',
   'ƯU ĐÃI CÓ HẠN',
   'LIMITED OFFER',
   NOW() + INTERVAL '14 days',
   'Nâng cấp ngay',
   'Upgrade now',
   TRUE)
ON CONFLICT (key) DO NOTHING;

-- Sample Promo Code
INSERT INTO public.promo_codes (code, discount_percent, max_discount_vnd, max_uses, expires_at, is_active) VALUES
  ('ONIELTS15', 15, 250000, 500, NOW() + INTERVAL '60 days', TRUE)
ON CONFLICT (code) DO NOTHING;
