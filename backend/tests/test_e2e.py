"""Browser end-to-end checks on a phone-sized screen, driven through the installed Microsoft Edge.

Run (PowerShell, from backend/):   $env:AURA_E2E = "1"; uv run pytest tests/test_e2e.py -v
Needs the built frontend (frontend/dist). Starts its own server on a free port with a temporary
data folder. If the local text helper (Llama 3.2 3B in Ollama) is running, it is really called.
"""

import os
import socket
import subprocess
import sys
import time
from urllib.parse import urlparse

import httpx
import pytest

pytestmark = pytest.mark.skipif(os.environ.get("AURA_E2E") != "1", reason="set AURA_E2E=1 to run browser tests")

if os.environ.get("AURA_E2E") == "1":
    from playwright.sync_api import expect, sync_playwright


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def server(tmp_path_factory):
    port = _free_port()
    env = {**os.environ, "AURA_DATA_DIR": str(tmp_path_factory.mktemp("data"))}
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "aurahealth.app:app", "--host", "127.0.0.1", "--port", str(port),
         "--log-level", "warning", "--no-access-log"],
        env=env,
    )
    base = f"http://127.0.0.1:{port}"
    for _ in range(150):
        try:
            httpx.get(base + "/api/health", timeout=1)
            break
        except httpx.HTTPError:
            time.sleep(0.1)
    yield base
    proc.terminate()
    proc.wait(10)


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge", headless=True)
        yield b
        b.close()


@pytest.fixture()
def phone(browser, server):
    ctx = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    requests: list[str] = []
    page.on("request", lambda r: requests.append(r.url))
    yield page, requests, server
    ctx.close()


def _open_sos(page):
    """SOS is always in the bottom bar and not covered; it opens the emergency sheet (a second tap calls)."""
    sos = page.get_by_test_id("sos")
    expect(sos).to_be_visible()
    box = sos.bounding_box()
    on_top = page.evaluate(
        "([x, y]) => !!document.elementFromPoint(x, y)?.closest('[data-testid=sos]')",
        [box["x"] + box["width"] / 2, box["y"] + box["height"] / 2],
    )
    assert on_top, "emergency control is covered"
    sos.click()
    expect(page.get_by_test_id("sos-call")).to_have_attribute("href", "tel:112")


def _check_sos(page):
    _open_sos(page)
    page.keyboard.press("Escape")
    expect(page.get_by_test_id("sos-call")).to_have_count(0)


def _next(page):
    page.get_by_test_id("next").click()


def test_full_handoff_keeps_emergency_reachable_and_stays_local(phone):
    page, requests, base = phone
    page.goto(base + "/")
    _check_sos(page)
    page.get_by_test_id("start").click()

    expect(page.get_by_role("heading", name="Who needs help?")).to_be_visible()
    _check_sos(page)
    page.get_by_role("radio", name="Someone else").click()
    page.get_by_label("Who are they to you? (optional)").fill("neighbour")
    _next(page)

    expect(page.get_by_role("heading", name="About how old are they?")).to_be_visible()
    _check_sos(page)
    page.get_by_role("radio", name="I don't know").click()
    _next(page)

    expect(page.get_by_role("heading", name="What happened? What do you see?")).to_be_visible()
    _check_sos(page)
    description = "She fell in the kitchen about twenty minutes ago. She says her left hip hurts."
    page.locator("#what-text").fill(description)
    if httpx.get(base + "/api/health").json()["models"]["text"]:
        page.get_by_test_id("split").click()
        expect(page.get_by_test_id("points").or_(page.locator(".banner.info"))).to_be_visible(timeout=120_000)
        for quote in page.locator("[data-testid=points] q").all_inner_texts():
            assert quote in description, f"point is not the user's exact words: {quote!r}"
    _next(page)

    expect(page.get_by_role("heading", name="When did it start?")).to_be_visible()
    _check_sos(page)
    page.get_by_role("radio", name="I don't know").click()
    _next(page)

    expect(page.get_by_role("heading", name="Anything you want to include?")).to_be_visible()
    _check_sos(page)
    page.get_by_label("Known allergies").fill("Penicillin")
    _next(page)

    expect(page.get_by_role("heading", name="Add a report or medicine strip (optional)")).to_be_visible()
    _check_sos(page)
    page.get_by_test_id("sample-clear_report").click()
    page.get_by_role("button", name="Type the details myself").click()
    page.locator("#nf-label").fill("Haemoglobin")
    page.locator("#nf-value").fill("11.2 g/dL")
    page.get_by_role("button", name="Add", exact=True).click()
    expect(page.get_by_test_id("field-row")).to_have_count(1)
    page.get_by_role("radio", name="Yes, it is current").click()
    _next(page)

    card = page.get_by_test_id("handoff")
    expect(card).to_be_visible()
    _check_sos(page)
    text = card.inner_text()
    assert "Someone else (neighbour)" in text
    assert "Known allergies: Penicillin" in text
    assert "Haemoglobin: 11.2 g/dL" in text
    assert "has not examined this person" in text
    unknowns = page.get_by_test_id("unknowns").inner_text()
    for label in ("Approximate age", "Started", "Regular medicines", "Known health conditions"):
        assert label in unknowns
    lowered = text.lower()
    for phrase in ("safe to wait", "low risk", "nothing serious", "no need to call", "probably"):
        assert phrase not in lowered

    page.get_by_test_id("item-person").click()
    expect(page.get_by_test_id("evidence")).to_be_visible()
    _check_sos(page)  # still reachable while the evidence sheet is open
    page.keyboard.press("Escape")

    page.once("dialog", lambda d: d.accept())
    page.get_by_test_id("delete-session").click()
    expect(page.get_by_text("Session deleted.")).to_be_visible()
    assert httpx.get(base + "/api/session").json()["session"] is None

    hosts = {urlparse(u).netloc for u in requests}
    assert hosts == {urlparse(base).netloc}, f"requests left the laptop: {hosts}"


def test_emergency_answer_shows_its_call_button_above_the_typing_box(phone):
    page, _, base = phone
    page.goto(base)
    page.get_by_test_id("nav-chat").click()
    page.get_by_test_id("chat-text").fill("my mother is not breathing")
    page.get_by_test_id("chat-send").click()
    call = page.get_by_test_id("chat-call")
    expect(call).to_be_visible()
    page.wait_for_timeout(300)  # the scroll to the newest answer runs on the next frame
    box = call.bounding_box()
    typing = page.locator(".chat-input").bounding_box()
    assert box["y"] >= 0 and box["y"] + box["height"] <= typing["y"], (box, typing)


def test_phone_back_key_closes_the_menu_and_the_sheet_first(phone):
    page, _, base = phone
    page.goto(base)
    back = "window.auraBack()"
    assert page.evaluate(back) is False  # nothing open: Android goes back a screen
    page.get_by_test_id("menu-button").click()
    expect(page.get_by_test_id("drawer")).to_be_visible()
    assert page.evaluate(back) is True
    expect(page.get_by_test_id("drawer")).to_have_count(0)
    page.get_by_test_id("sos").click()
    expect(page.get_by_test_id("sos-call")).to_be_visible()
    assert page.evaluate(back) is True
    expect(page.get_by_test_id("sos-call")).to_have_count(0)


def test_home_question_is_answered_at_once_with_no_ai(phone):
    page, _, base = phone
    page.route("**/api/chat", lambda route: route.abort())
    page.goto(base)
    page.get_by_test_id("home-ask").fill("What does HbA1c mean?")
    page.get_by_test_id("home-send").click()
    answer = page.get_by_test_id("bubble-aura").first
    expect(answer).to_contain_text("average blood", timeout=5000)
    expect(answer).to_contain_text("Written in advance")
    answer.locator("summary").click()
    link = answer.get_by_role("link", name="A1C")
    assert link.get_attribute("href").startswith("https://medlineplus.gov/")


def test_call_now_answers_are_only_for_what_is_happening_now(phone):
    page, _, base = phone
    page.route("**/api/chat", lambda route: route.abort())
    page.goto(base + "#chat")
    page.get_by_test_id("chat-text").fill("my mother had a stroke two years ago, what diet is good")
    page.get_by_test_id("chat-send").click()
    expect(page.get_by_test_id("bubble-aura").first).to_contain_text("Written in advance", timeout=5000)
    expect(page.get_by_test_id("chat-call")).to_have_count(0)
    page.get_by_test_id("chat-text").fill("my uncle has tetanus and his jaw is locked")
    page.get_by_test_id("chat-send").click()
    expect(page.get_by_test_id("chat-call")).to_have_count(1, timeout=5000)


def test_talk_of_suicide_gets_people_to_call_at_once(phone):
    page, requests, base = phone
    page.goto(base)
    page.get_by_test_id("nav-chat").click()
    page.get_by_test_id("chat-text").fill("I want to end my life")
    page.get_by_test_id("chat-send").click()
    expect(page.get_by_test_id("chat-call")).to_have_attribute("href", "tel:112")
    expect(page.get_by_test_id("chat-crisis")).to_have_attribute("href", "tel:14416")
    assert not [r for r in requests if r.endswith("/api/chat")]  # the words were not sent anywhere


def test_phone_rules_answer_without_the_ai_and_ignore_numbers_that_are_not_readings(phone):
    page, _, base = phone
    page.route("**/api/chat", lambda route: route.abort())
    page.goto(base)
    page.get_by_test_id("nav-chat").click()

    def ask(words):
        before = page.get_by_test_id("bubble-aura").count()
        page.get_by_test_id("chat-text").fill(words)
        page.get_by_test_id("chat-send").click()
        page.wait_for_function("n => document.querySelectorAll('[data-testid=bubble-aura]').length > n", arg=before, timeout=15000)
        expect(page.get_by_test_id("chat-busy")).to_have_count(0, timeout=15000)
        return page.get_by_test_id("bubble-aura").nth(before)

    assert ask("there is pain in my chest").get_by_test_id("chat-call").count() == 1
    assert ask("my mother has taken thirty  sleeping tablets").get_by_test_id("chat-call").count() == 1
    assert "mg/dL" not in ask("My mother is 65 and has sugar, what food should she avoid?").inner_text()
    fever = ask("fever 101, should I go to the clinic?").inner_text()
    assert "213" not in fever and "38.3" in fever
    what = ask("what are the signs of a stroke")
    assert what.get_by_test_id("chat-call").count() == 0


def test_phone_record_lists_what_was_done_with_no_laptop(phone):
    page, _, base = phone
    page.route("**/api/**", lambda route: route.abort())
    page.goto(base)
    page.get_by_test_id("menu-button").click()
    page.get_by_test_id("drawer-card").click()
    expect(page.get_by_test_id("phone-card")).to_be_visible(timeout=15000)
    assert "not a diagnosis" in page.get_by_test_id("phone-card").inner_text()


def test_hba1c_reading_is_answered_at_once(phone):
    page, _, base = phone
    page.route("**/api/chat", lambda route: route.abort())
    page.goto(base)
    page.get_by_test_id("home-ex1").click()
    answer = page.get_by_test_id("bubble-aura").first
    expect(answer).to_contain_text("diabetes", timeout=5000)
    assert "7.5%" in answer.inner_text() and page.get_by_test_id("chat-busy").count() == 0


def test_emergency_still_works_when_the_laptop_is_unreachable(phone):
    page, _, base = phone
    page.goto(base + "/")
    expect(page.get_by_test_id("help-now")).to_be_visible()
    page.context.set_offline(True)  # the phone loses its Wi-Fi link to the laptop
    expect(page.get_by_test_id("server-down")).to_be_visible(timeout=20_000)
    _open_sos(page)
    expect(page.get_by_test_id("emergency-card").get_by_role("link")).to_have_attribute("href", "tel:112")
    page.keyboard.press("Escape")
    page.context.set_offline(False)


def test_telugu_is_labelled_unreviewed_with_english_under_safety_lines(phone):
    page, _, base = phone
    page.goto(base + "/")
    page.get_by_test_id("menu-button").click()
    page.get_by_role("button", name="తెలుగు").first.click()
    page.keyboard.press("Escape")
    expect(page.locator(".lang-strip")).to_contain_text("Unreviewed draft translation")
    _open_sos(page)
    card = page.get_by_test_id("emergency-card")
    expect(card).to_contain_text("112 is India's emergency number")  # English baseline kept under the draft
    expect(card).to_contain_text("Nothing is called automatically")
    page.keyboard.press("Escape")
    page.get_by_test_id("menu-button").click()
    page.get_by_role("button", name="English").first.click()
    page.keyboard.press("Escape")
    expect(page.locator(".lang-strip")).to_have_count(0)


def test_first_aid_guide_logs_each_step_with_its_time(phone):
    page, requests, base = phone
    page.goto(base + "/")
    page.get_by_test_id("help-now").click()
    expect(page.get_by_role("heading", name="What is happening?")).to_be_visible()
    _check_sos(page)
    page.get_by_test_id("guide-check").click()
    page.get_by_test_id("step-done").click()  # place is safe
    page.get_by_test_id("choice-no").click()  # no response
    page.get_by_test_id("choice-no").click()  # not breathing normally -> CPR guide
    expect(page.locator("#guide-title")).to_have_text("Not responding and not breathing normally")
    _check_sos(page)
    page.get_by_test_id("step-done").click()  # call
    page.get_by_test_id("step-done").click()  # hands
    page.get_by_test_id("cpr-start").click()
    page.wait_for_timeout(2000)
    expect(page.get_by_test_id("cpr-beat")).not_to_contain_text("0 beats")
    _check_sos(page)  # still reachable while the beat runs
    page.get_by_test_id("cpr-pause").click()
    page.get_by_test_id("step-done").click()  # next
    page.get_by_test_id("step-done").click()  # keep going -> finished
    expect(page.get_by_test_id("guide-finished")).to_be_visible()
    expect(page.get_by_test_id("pending")).to_have_count(0, timeout=30_000)
    page.get_by_test_id("open-card").click()
    log = page.get_by_test_id("item-firstaid")
    expect(log.first).to_be_visible()
    texts = log.all_inner_texts()
    for expected in ("Responds to voice or touch? No response", "Breathing normally? No, or only gasping",
                     "Called or asked someone to call 112", "Chest compressions started", "Chest compressions paused"):
        assert any(expected in t for t in texts), (expected, texts)
    assert all(":" in t.split(" ")[0] or ":" in t[:6] for t in texts)  # every line starts with a time
    expect(page.get_by_test_id("handoff")).to_contain_text("First-aid steps adapted from")
    hosts = {urlparse(u).netloc for u in requests}
    assert hosts == {urlparse(base).netloc}


def test_guide_finder_suggests_with_the_persons_words_and_opens_nothing_by_itself(phone):
    page, requests, base = phone
    page.goto(base + "/")
    page.get_by_test_id("help-now").click()
    expect(page.get_by_role("heading", name="What is happening?")).to_be_visible()
    if not httpx.get(base + "/api/health").json()["models"]["text"]:
        expect(page.get_by_test_id("finder-open")).to_have_count(0)  # no laptop helper: guide list only
        return
    page.get_by_test_id("finder-open").click()
    page.locator("#finder-text").fill("kid choking on a grape")
    page.get_by_test_id("finder-go").click()
    # The app itself waits up to 100 s for the free AI service (frontend/src/api.ts).
    expect(page.get_by_test_id("finder-matches").or_(page.get_by_test_id("finder-message"))).to_be_visible(timeout=105_000)
    _check_sos(page)
    expect(page.locator("#guide-title")).to_have_count(0)  # a suggestion never opens a guide by itself
    suggestion = page.get_by_test_id("finder-choking")
    if suggestion.count():  # real model call: report what it did rather than require it
        expect(suggestion).to_contain_text("choking on a grape")
        suggestion.click()
        expect(page.locator("#guide-title")).to_have_text("Choking")
    hosts = {urlparse(u).netloc for u in requests}
    assert hosts == {urlparse(base).netloc}


def test_first_aid_works_while_the_laptop_is_unreachable_and_syncs_later(phone):
    page, _, base = phone
    page.goto(base + "/")
    expect(page.get_by_test_id("help-now")).to_be_visible()
    page.context.set_offline(True)
    page.get_by_test_id("help-now").click()
    page.get_by_test_id("guide-bleeding").click()
    page.get_by_test_id("step-done").click()  # pressing on the wound
    page.get_by_test_id("step-done").click()  # helped them lie down
    expect(page.get_by_test_id("pending")).to_be_visible()
    _check_sos(page)
    page.context.set_offline(False)
    expect(page.get_by_test_id("pending")).to_have_count(0, timeout=30_000)
    events = [e["text"] for e in httpx.get(base + "/api/session").json()["session"]["events"]]
    assert "Pressing on the wound" in events and "Helped them lie down" in events


def test_night_guard_page_in_a_browser_explains_the_app_and_checkins_work(phone):
    page, _, base = phone
    page.goto(base + "/")
    page.get_by_test_id("tile-guard").click()
    expect(page.get_by_test_id("guard-web-only")).to_be_visible()  # no listening or calls from a web page
    _check_sos(page)
    page.get_by_test_id("checkin-night").click()
    expect(page.get_by_test_id("last-checkin")).to_be_visible()
    for _ in range(30):
        events = (httpx.get(base + "/api/session").json()["session"] or {}).get("events", [])
        if any(e["kind"] == "checkin_night" for e in events):
            break
        page.wait_for_timeout(1000)
    assert any(e["text"] == "Said good night (last seen well)" for e in events)
