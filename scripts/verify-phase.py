#!/usr/bin/env python3
"""
Automated Playwright browser verification & screenshot runner for Ôn IELTS phases.
Usage: python3 scripts/verify-phase.py <phase_name> [base_url]
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE_URL = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:3000"
PHASE = sys.argv[1] if len(sys.argv) > 1 else "phase-1"
OUT_DIR = os.path.join(os.getcwd(), "docs", "screenshots", PHASE)
os.makedirs(OUT_DIR, exist_ok=True)


def run():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.on("pageerror", lambda err: errors.append(f"PAGEERROR: {err}"))
        page.on(
            "response",
            lambda res: errors.append(f"HTTP_{res.status}: {res.url}")
            if res.status >= 500
            else None,
        )
        page.on(
            "console",
            lambda msg: errors.append(f"CONSOLE_ERR: {msg.text}")
            if msg.type == "error"
            and "404" not in msg.text
            and "youtube" not in msg.text.lower()
            and "ERR_NAME_NOT_RESOLVED" not in msg.text
            and "ERR_CONNECTION" not in msg.text
            else None,
        )

        if PHASE == "phase-1":
            # 1. Homepage Vietnamese (default)
            page.goto(f"{BASE_URL}/", wait_until="load")
            assert "Ôn IELTS" in page.title(), f"Unexpected title: {page.title()}"
            page.screenshot(path=os.path.join(OUT_DIR, "01-homepage-vi.png"), full_page=True)

            # 2. Switch to English & verify translation works
            page.click("#header-locale-btn")
            page.wait_for_timeout(1200)
            body_text = page.inner_text("body")
            assert "Smarter IELTS prep with AI" in body_text, "English switch failed"
            page.screenshot(path=os.path.join(OUT_DIR, "02-homepage-en-hero.png"))

            # Switch back to Vietnamese
            page.click("#header-locale-btn")
            page.wait_for_timeout(900)

            # 3. Open IELTS mega-menu + Dark mode screenshot
            page.click("#header-theme-btn")
            page.wait_for_timeout(400)
            page.click("#nav-ielts-trigger")
            page.wait_for_timeout(300)
            page.screenshot(path=os.path.join(OUT_DIR, "03-dark-megamenu.png"))
            page.click("#header-theme-btn")
            page.wait_for_timeout(300)

            # 4. Test Auth page & demo login
            page.goto(f"{BASE_URL}/auth", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "04-auth-page.png"))
            page.click("#demo-login-free")
            page.wait_for_url(f"{BASE_URL}/", timeout=10000)
            page.wait_for_timeout(600)
            assert page.locator("#header-avatar-btn").is_visible(), "Avatar menu did not appear after login"

            # 5. Test Global Flashcard Modal via custom event
            page.evaluate("window.dispatchEvent(new CustomEvent('onielts:add-flashcard', { detail: { term: 'mitigate' } }))")
            page.wait_for_timeout(800)
            assert page.locator("#flashcard-modal-title").is_visible(), "Flashcard modal failed to open"
            page.screenshot(path=os.path.join(OUT_DIR, "05-flashcard-modal.png"))

            # 6. Mobile responsive view
            page.set_viewport_size({"width": 390, "height": 844})
            page.goto(f"{BASE_URL}/", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "06-mobile-home.png"))

        elif PHASE == "phase-2":
            page.goto(f"{BASE_URL}/band-calculator", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "01-band-calculator.png"), full_page=True)

            page.goto(f"{BASE_URL}/tools", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "02-tools-hub.png"), full_page=True)

            page.goto(f"{BASE_URL}/tools/paraphraser", wait_until="load")
            page.fill("textarea", "Many people think that big cities have too much traffic and pollution.")
            page.click("#ai-tool-submit-btn")
            page.wait_for_timeout(1500)
            page.screenshot(path=os.path.join(OUT_DIR, "03-paraphraser-result.png"), full_page=True)

            page.goto(f"{BASE_URL}/tools/text-to-speech", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "04-text-to-speech.png"))

        elif PHASE == "phase-3":
            # Login as free user to test metering & paywall
            page.goto(f"{BASE_URL}/auth", wait_until="load")
            page.click("#demo-login-free")
            page.wait_for_url(f"{BASE_URL}/", timeout=10000)

            page.goto(f"{BASE_URL}/writing", wait_until="load")
            page.click("#load-sample-essay-btn")
            page.click("#submit-writing-btn")
            page.wait_for_selector("#writing-eval-result", timeout=15000)
            page.screenshot(path=os.path.join(OUT_DIR, "01-writing-checker-result.png"), full_page=True)

            page.goto(f"{BASE_URL}/writing/generator", wait_until="load")
            page.click("#generate-band9-btn")
            page.wait_for_timeout(1200)
            page.screenshot(path=os.path.join(OUT_DIR, "02-writing-generator.png"), full_page=True)

            page.goto(f"{BASE_URL}/writing/exercises", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "03-writing-exercises.png"), full_page=True)

        elif PHASE == "phase-4":
            page.goto(f"{BASE_URL}/auth", wait_until="load")
            page.click("#demo-login-premium")
            page.wait_for_url(f"{BASE_URL}/", timeout=10000)

            page.goto(f"{BASE_URL}/speaking", wait_until="load")
            page.click("#speaking-demo-eval-btn")
            page.wait_for_selector("#speaking-eval-result", timeout=15000)
            page.screenshot(path=os.path.join(OUT_DIR, "01-speaking-checker.png"), full_page=True)

            page.goto(f"{BASE_URL}/speaking/generator", wait_until="load")
            page.click("#generate-speaking-btn")
            page.wait_for_timeout(1200)
            page.screenshot(path=os.path.join(OUT_DIR, "02-speaking-generator.png"), full_page=True)

            page.goto(f"{BASE_URL}/conversations?topic=hometown", wait_until="load")
            page.fill("#conversation-input", "I come from Da Nang, a coastal city in central Vietnam known for its bridges and beaches.")
            page.click("#conversation-send-btn")
            page.wait_for_timeout(1200)
            page.screenshot(path=os.path.join(OUT_DIR, "03-ai-conversations.png"), full_page=True)

        elif PHASE == "phase-5":
            page.goto(f"{BASE_URL}/auth", wait_until="load")
            page.click("#demo-login-free")
            page.wait_for_url(f"{BASE_URL}/", timeout=10000)

            page.goto(f"{BASE_URL}/tests", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "01-tests-catalog.png"), full_page=True)

            page.goto(f"{BASE_URL}/tests/academic-reading-01-urban-microclimates", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "02-reading-computer-ui.png"))
            page.click("#submit-test-btn")
            page.wait_for_selector("#test-result-summary", timeout=10000)
            page.screenshot(path=os.path.join(OUT_DIR, "03-reading-graded-analytics.png"), full_page=True)

            page.goto(f"{BASE_URL}/tests/listening-01-community-heritage-centre", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "04-listening-computer-ui.png"))

            page.goto(f"{BASE_URL}/daily-exam", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "05-daily-exam.png"), full_page=True)

            page.goto(f"{BASE_URL}/leaderboard", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "06-leaderboard.png"), full_page=True)

        elif PHASE == "phase-6":
            page.goto(f"{BASE_URL}/auth", wait_until="load")
            page.click("#demo-login-free")
            page.wait_for_url(f"{BASE_URL}/", timeout=10000)

            page.goto(f"{BASE_URL}/pricing", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "01-pricing-page.png"), full_page=True)
            page.fill("#promo-code-input", "ONIELTS15")
            page.click("#apply-promo-btn")
            page.wait_for_timeout(700)
            page.click("#buy-plan-premium-6m")
            page.wait_for_selector("#checkout-qr-modal", timeout=10000)
            page.screenshot(path=os.path.join(OUT_DIR, "02-payos-vietqr-checkout.png"))
            page.click("#simulate-payos-webhook-btn")
            page.wait_for_timeout(1200)
            page.screenshot(path=os.path.join(OUT_DIR, "03-premium-activated.png"))

        elif PHASE == "phase-7a":
            page.goto(f"{BASE_URL}/flashcards", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "01-flashcards-sets.png"), full_page=True)
            page.click("#start-srs-review-btn")
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(OUT_DIR, "02-flashcards-srs-review.png"))

            page.goto(f"{BASE_URL}/dictation", wait_until="load")
            page.fill("#dictation-input", "Welcome to the central campus library orientation for new students.")
            page.click("#dictation-check-btn")
            page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(OUT_DIR, "03-dictation-diff.png"), full_page=True)

        elif PHASE == "phase-7b":
            page.goto(f"{BASE_URL}/pronunciation", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "01-pronunciation-ipa-chart.png"), full_page=True)

            page.goto(f"{BASE_URL}/pronunciation/th-voiceless", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "02-pronunciation-sound-detail.png"), full_page=True)

            page.goto(f"{BASE_URL}/videos/ky-thuat-paraphrase-trong-ielts-writing", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "03-video-synced-transcript.png"), full_page=True)

            page.goto(f"{BASE_URL}/courses/nen-tang-ielts-5-0-den-6-5", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "04-course-detail.png"), full_page=True)

            page.goto(f"{BASE_URL}/mentor", wait_until="load")
            page.fill("#mentor-input", "Mình đang ở Band 5.5 và muốn lên 7.0 trong 3 tháng, học mỗi ngày 1.5 tiếng.")
            page.click("#mentor-send-btn")
            page.wait_for_timeout(1200)
            page.screenshot(path=os.path.join(OUT_DIR, "05-mentor-chatbot.png"), full_page=True)

        elif PHASE == "phase-8":
            page.goto(f"{BASE_URL}/auth", wait_until="load")
            page.click("#demo-login-admin")
            page.wait_for_url(f"{BASE_URL}/", timeout=10000)

            page.goto(f"{BASE_URL}/profile", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "01-profile-page.png"), full_page=True)

            page.goto(f"{BASE_URL}/progress", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "02-progress-dashboard.png"), full_page=True)

            page.goto(f"{BASE_URL}/referral", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "03-referral-page.png"), full_page=True)

            page.goto(f"{BASE_URL}/admin", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "04-admin-panel.png"), full_page=True)

            page.goto(f"{BASE_URL}/blog", wait_until="load")
            page.screenshot(path=os.path.join(OUT_DIR, "05-blog-index.png"), full_page=True)

        browser.close()

    if errors:
        print("ERRORS FOUND:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print(f"OK: {PHASE} verified and screenshots saved to {OUT_DIR}")


if __name__ == "__main__":
    run()
