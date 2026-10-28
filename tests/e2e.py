from pathlib import Path
import os
import subprocess
import sys
import tempfile
import time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8765"
ROOT = Path(__file__).resolve().parent.parent
OUT = Path(os.environ.get("WTWM_TEST_OUTPUT", Path(tempfile.gettempdir()) / "wtwm-test-output"))
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("WTWM_CHROME", "/opt/pw-browsers/chromium-1228/chrome-linux64/chrome")


def assert_true(value, message):
    if not value:
        raise AssertionError(message)


def desktop_suite(browser):
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    page = context.new_page()
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda error: console_errors.append(str(error)))
    page.route("**/locations?**", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='[{"id":"mock-stop","name":"Test Haltestelle","location":{"latitude":51.2,"longitude":7.1}}]'
    ))

    page.goto(BASE, wait_until="networkidle")
    assert page.locator("#marketCount").inner_text() == "39"
    assert page.locator("#topMarkets .market-card").count() == 3
    assert page.locator("details.compact-section").count() >= 7

    page.locator('[data-view="markets"]').click()
    page.wait_for_selector("#markets.active")
    assert "39 von 39" in page.locator("#filterSummary").inner_text()
    assert page.locator("#marketList .market-card").count() == 39

    heights = page.locator("#marketList .market-card").evaluate_all(
        "els => els.slice(0, 4).map(el => Math.round(el.getBoundingClientRect().height))"
    )
    assert_true(max(heights) - min(heights) <= 1, f"Karten einer Zeile sind nicht gleich hoch: {heights}")

    page.locator("#listViewBtn").click()
    assert_true(page.locator("#marketList").evaluate("el => el.classList.contains('list-view')"), "Listenansicht nicht aktiv")
    assert page.locator("#listViewBtn").get_attribute("aria-pressed") == "true"
    page.reload(wait_until="networkidle")
    page.locator('[data-view="markets"]').click()
    assert_true(page.locator("#marketList").evaluate("el => el.classList.contains('list-view')"), "Listenansicht nicht gespeichert")

    page.locator("#marketSearch").fill("Hattingen")
    assert "1 von 39" in page.locator("#filterSummary").inner_text()
    assert page.locator("#marketList .market-card").count() == 1
    page.locator("#resetFilters").click()
    assert page.locator("#marketList .market-card").count() == 39

    page.locator("#cityFilter").select_option(label="Essen")
    assert_true(0 < page.locator("#marketList .market-card").count() < 39, "Stadtfilter ohne Wirkung")
    page.locator("#resetFilters").click()
    page.locator("#travelFilter").select_option("60")
    assert_true(0 < page.locator("#marketList .market-card").count() < 39, "Fahrzeitfilter ohne Wirkung")
    page.locator("#resetFilters").click()
    page.locator("#distanceFilter").select_option("15")
    assert_true(0 < page.locator("#marketList .market-card").count() < 39, "Distanzfilter ohne Wirkung")
    page.locator("#resetFilters").click()
    page.locator("#dateFilter").fill("2026-12-05")
    page.locator("#dateFilter").dispatch_event("change")
    assert_true(0 < page.locator("#marketList .market-card").count() < 39, "Datumsfilter ohne Wirkung")
    page.locator("#resetFilters").click()
    page.locator("#featureFilter").select_option("free")
    assert_true(0 < page.locator("#marketList .market-card").count() < 39, "Wunschfilter ohne Wirkung")
    page.locator("#resetFilters").click()
    page.locator("#sortFilter").select_option("city")
    names = page.locator("#marketList .market-card h3").all_inner_texts()
    assert_true(len(names) == 39, "Sortierung verlor Märkte")
    page.locator("#resetFilters").click()

    first_card = page.locator("#marketList .market-card").first
    assert_true("G " in first_card.locator(".rating-parts").inner_text(), "Kurzbewertung fehlt")
    first_card.locator("[data-detail]").click()
    page.wait_for_selector("#marketDialog[open]")
    assert page.locator("#marketDetail .detail-box").count() == 4
    assert page.locator("#marketDetail .detail-section").count() == 3
    page.locator("#marketDetail .detail-section").nth(1).locator("summary").click()
    assert_true(page.locator("#marketDetail .detail-section").nth(1).get_attribute("open") is not None, "Detailbereich nicht aufklappbar")
    page.locator("#marketDialog .close").click()

    fav_before = int(page.locator("#favCount").inner_text())
    page.locator("#marketList [data-fav]").first.click()
    assert int(page.locator("#favCount").inner_text()) == fav_before + 1

    planned_name = page.locator("#marketList .market-card h3").first.inner_text()
    page.locator("#marketList [data-plan]").first.click()
    page.wait_for_selector("#trip.active")
    assert planned_name in page.locator("#tripMarket option:checked").inner_text()
    page.locator("#tripActivity").fill("Altstadtrundgang")
    page.locator("#tripNotes").fill("Testnotiz")
    page.locator("#saveTrip").click()
    assert "Trip gespeichert" in page.locator("#tripMessage").inner_text()
    assert page.locator("#savedTrips .card").count() == 1
    with page.expect_download() as download_info:
        page.locator("#exportIcs").click()
    download = download_info.value
    assert_true(download.suggested_filename.endswith(".ics"), "ICS-Download fehlt")
    page.locator("#savedTrips [data-deltrip]").click()
    assert page.locator("#savedTrips .card").count() == 0

    page.locator('[data-view="timeline"]').click()
    page.locator("#timelineFrom").fill("2026-12-05")
    page.locator("#timelineFrom").dispatch_event("change")
    page.locator("#timelineTo").fill("2026-12-05")
    page.locator("#timelineTo").dispatch_event("change")
    assert page.locator("#timelineBody tr").count() == 1
    selects = page.locator("#timelineBody [data-avail]")
    assert selects.count() == 2
    for i in range(selects.count()):
        selects.nth(i).select_option(label="Ja")
    assert "✅ Ja" in page.locator("#timelineBody tr").inner_text()
    page.locator("#onlyCommon").check()
    assert page.locator("#timelineBody tr.common").count() == 1

    page.locator('[data-view="settings"]').click()
    page.locator("#settings details").nth(1).locator("summary").click()
    page.locator("#stopQuery").fill("Test Haltestelle")
    page.locator("#searchStop").click()
    page.wait_for_selector("[data-stop]")
    page.locator("[data-stop]").click()
    assert page.locator("#savedStop").inner_text() == "Test Haltestelle"

    people_before = page.locator("[data-person]").count()
    page.locator("#addPerson").click()
    assert page.locator("[data-person]").count() == people_before + 1
    page.locator("[data-remove]").last.click()
    assert page.locator("[data-person]").count() == people_before

    with page.expect_download() as backup_info:
        page.locator("#settings details").nth(2).locator("summary").click()
        page.locator("#exportData").click()
    assert backup_info.value.suggested_filename == "wtwm-sicherung.json"

    page.once("dialog", lambda dialog: dialog.accept())
    page.locator("#importData").set_input_files({
        "name": "test-sicherung.json",
        "mimeType": "application/json",
        "buffer": b'{"app":"Way to Winter Magic","version":"2.1.0","state":{"people":[{"id":"import-1","name":"Import Person"}],"availability":{},"favorites":["hattingen"],"trips":[],"stop":null,"filters":{"view":"card"}}}'
    })
    page.wait_for_function("document.querySelectorAll('[data-person]').length === 1")
    assert page.locator("[data-person]").count() == 1
    assert page.locator("[data-person]").input_value() == "Import Person"
    assert page.locator("#favCount").inner_text() == "1"

    sw_count = page.evaluate("navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r => r.length) : 0")
    assert_true(sw_count >= 1, "Service Worker nicht registriert")
    page.evaluate("navigator.serviceWorker.ready")
    context.set_offline(True)
    page.reload(wait_until="domcontentloaded")
    assert page.locator("#marketCount").inner_text() == "39"
    context.set_offline(False)
    page.screenshot(path=str(OUT / "desktop.png"), full_page=True)
    assert_true(not console_errors, f"Browserfehler: {console_errors}")
    context.close()


def mobile_suite(browser):
    context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE, wait_until="networkidle")
    assert page.locator("#marketCount").inner_text() == "39"
    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    assert_true(overflow <= 1, f"Mobile horizontale Überbreite: {overflow}px")
    nav_position = page.locator(".tabs").evaluate("el => getComputedStyle(el).position")
    assert nav_position == "fixed"

    page.locator('[data-view="markets"]').click()
    page.locator("#listViewBtn").click()
    assert page.locator("#marketList .market-card").count() == 39
    card_width = page.locator("#marketList .market-card").first.evaluate("el => el.getBoundingClientRect().width")
    viewport_width = page.evaluate("window.innerWidth")
    assert_true(card_width < viewport_width, "Mobile Marktkarte passt nicht in den Viewport")
    detail_label = page.locator("#marketList [data-detail]").first.evaluate("el => getComputedStyle(el, '::after').content")
    plan_label = page.locator("#marketList [data-plan]").first.evaluate("el => getComputedStyle(el, '::after').content")
    assert detail_label == '"Info"' and plan_label == '"+"'
    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    assert_true(overflow <= 1, f"Listenansicht erzeugt horizontale Überbreite: {overflow}px")

    page.locator("#marketList [data-detail]").first.click()
    assert page.locator("#marketDialog[open]").count() == 1
    dialog_width = page.locator("#marketDialog").evaluate("el => el.getBoundingClientRect().width")
    assert_true(dialog_width <= viewport_width * .95, "Detaildialog zu breit")
    page.locator("#marketDialog .close").click()

    page.locator('[data-view="timeline"]').click()
    assert page.locator(".inline-details").count() == 1
    page.locator(".inline-details summary").click()
    assert page.locator(".inline-details").get_attribute("open") is None

    page.locator('[data-view="trip"]').click()
    assert page.locator("#trip details.compact-section").count() == 2
    page.screenshot(path=str(OUT / "mobile.png"), full_page=True)
    assert_true(not errors, f"Mobile Browserfehler: {errors}")
    context.close()


server = subprocess.Popen(
    [sys.executable, "-m", "http.server", "8765", "--bind", "127.0.0.1"],
    cwd=ROOT,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
try:
    time.sleep(1)
    if server.poll() is not None:
        raise RuntimeError("Lokaler Testserver konnte nicht gestartet werden")
    with sync_playwright() as p:
        launch_options = {"headless": True, "args": ["--no-sandbox"]}
        if Path(CHROME).exists():
            launch_options["executable_path"] = CHROME
        browser = p.chromium.launch(**launch_options)
        desktop_suite(browser)
        mobile_suite(browser)
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=5)

print("E2E-/Layouttests bestanden: Desktop + Mobil, 39 Märkte, Karten/Liste, Details, Favoriten, Timeline, Trip, ICS, Haltestelle, Sicherung, PWA.")
