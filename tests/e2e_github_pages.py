#!/usr/bin/env python3
"""Vollständiger mobiler Planungsablauf unter einem GitHub-Pages-Unterpfad."""

import asyncio
import functools
import http.server
import json
import pathlib
import socketserver
import tempfile
import threading
from urllib.parse import parse_qs, urlparse

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
PREFIX = "/way-to-winter-magic/"


def installed_chromium():
    candidates = sorted(pathlib.Path("/opt/pw-browsers").glob("chromium-*/chrome-linux64/chrome"), reverse=True)
    return str(candidates[0]) if candidates else None


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith(PREFIX):
            self.send_error(404)
            return
        relative = parsed.path[len(PREFIX):] or "index.html"
        self.path = "/" + relative + (("?" + parsed.query) if parsed.query else "")
        super().do_GET()


class ReuseServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


def geocode_result(text):
    if "wuppertal" in text.lower():
        return [{"name": "Wuppertal Hbf", "stopId": "de:05124:01133", "lat": 51.254, "lon": 7.150}]
    return [{"name": "Essen Steele S", "stopId": "de:05113:2001", "lat": 51.450, "lon": 7.076}]


def iso_at(hour, minute):
    return f"2026-12-05T{hour:02d}:{minute:02d}:00+01:00"


def direct_journey(start, end, route, origin, destination):
    return {
        "duration": (end[0] * 60 + end[1] - start[0] * 60 - start[1]) * 60,
        "transfers": 0,
        "startTime": iso_at(*start),
        "endTime": iso_at(*end),
        "legs": [{
            "from": {"name": origin, "track": "1"},
            "to": {"name": destination},
            "mode": "RAIL", "routeShortName": route, "headsign": destination,
            "scheduledStartTime": iso_at(*start), "startTime": iso_at(*start),
            "scheduledEndTime": iso_at(*end), "endTime": iso_at(*end),
        }],
    }


def transfer_journey(start, change_arrival, change_departure, end, origin, destination):
    return {
        "duration": (end[0] * 60 + end[1] - start[0] * 60 - start[1]) * 60,
        "transfers": 1,
        "startTime": iso_at(*start), "endTime": iso_at(*end),
        "legs": [
            {
                "from": {"name": origin, "track": "1"}, "to": {"name": "Essen Hbf"},
                "mode": "RAIL", "routeShortName": "RE 49", "headsign": "Essen Hbf",
                "scheduledStartTime": iso_at(*start), "startTime": iso_at(*start),
                "scheduledEndTime": iso_at(*change_arrival), "endTime": iso_at(*change_arrival),
            },
            {
                "from": {"name": "Essen Hbf", "track": "4"}, "to": {"name": destination},
                "mode": "TRAM", "routeShortName": "S 9", "headsign": destination,
                "scheduledStartTime": iso_at(*change_departure), "startTime": iso_at(*change_departure),
                "scheduledEndTime": iso_at(*end), "endTime": iso_at(*end),
            },
        ],
    }


def plan_result(arrive_by):
    if arrive_by:
        origin, destination = "Wuppertal Hbf", "Essen Steele S"
        journeys = [
            direct_journey((12, 50), (13, 40), "RE 49", origin, destination),
            direct_journey((13, 30), (14, 20), "RE 49", origin, destination),
            direct_journey((13, 50), (14, 30), "RE 7", origin, destination),
            transfer_journey((14, 0), (14, 15), (14, 20), (14, 30), origin, destination),
            direct_journey((14, 10), (14, 50), "RE 49", origin, destination),
            direct_journey((14, 15), (15, 0), "S 9", origin, destination),
        ]
    else:
        origin, destination = "Essen Steele S", "Wuppertal Hbf"
        journeys = [
            direct_journey((20, 0), (20, 45), "RE 49", origin, destination),
            direct_journey((20, 15), (21, 0), "S 9", origin, destination),
            direct_journey((20, 30), (21, 10), "RE 7", origin, destination),
            transfer_journey((21, 0), (21, 20), (21, 25), (21, 50), origin, destination),
            direct_journey((21, 30), (22, 20), "RE 49", origin, destination),
            direct_journey((22, 0), (22, 45), "S 9", origin, destination),
        ]
    return {"itineraries": journeys}


async def main():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = ReuseServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}{PREFIX}"
    console_errors = []
    api_state = {"plan_calls": 0}

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, executable_path=installed_chromium())
            context = await browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
            page = await context.new_page()
            page.on("pageerror", lambda error: console_errors.append(str(error)))
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" and not msg.text.startswith("Failed to load resource:") else None)

            async def api(route):
                url = urlparse(route.request.url)
                query = parse_qs(url.query)
                if url.path.endswith("/v1/geocode"):
                    await route.fulfill(status=200, content_type="application/json", body=json.dumps(geocode_result(query.get("text", [""])[0])))
                    return
                if url.path.endswith("/v6/plan"):
                    api_state["plan_calls"] += 1
                    arrive_by = query.get("arriveBy", ["false"])[0] == "true"
                    await route.fulfill(status=200, content_type="application/json", body=json.dumps(plan_result(arrive_by)))
                    return
                await route.abort()

            await page.route("https://api.transitous.org/**", api)
            await page.goto(base, wait_until="networkidle")
            assert await page.locator("text=Way to Winter Magic").count() >= 1
            assert await page.locator("text=Way to Winter Magic").count() >= 1
            assert await page.locator("#marketCount").inner_text() == "39"
            assert await page.locator('.tabs button').count() == 5
            assert await page.locator('.tabs button').nth(2).get_attribute('data-view') == 'trip'
            assert await page.locator('.tabs [data-view="timeline"]').count() == 0
            assert await page.locator('.tabs [data-view="connections"]').count() == 0
            assert await page.locator('.tabs img').evaluate_all("els => els.length === 5 && els.every(img => img.complete && img.naturalWidth > 0)")
            assert await page.locator('.hero-art img').evaluate("img => img.complete && img.naturalWidth > 0")
            overflow = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            assert overflow <= 1, f"Mobiles horizontales Überlaufen: {overflow}px"

            # 1: Personen lokal anlegen.
            await page.click('[data-view="trip"]')
            await page.fill("#plannerPersonCount", "3")
            await page.locator("#plannerPersonCount").press("Tab")
            assert await page.locator("[data-planner-person]").count() == 3
            for index, name in enumerate(["Simon", "Anna", "Chris"]):
                field = page.locator("[data-planner-person]").nth(index)
                await field.fill(name)
                await field.press("Tab")
            await page.click("#plannerNext")

            # 2: Datum und Status für jede Person.
            await page.fill("#plannerDate", "2026-12-05")
            await page.locator("#plannerDate").press("Tab")
            await page.locator('[data-planner-avail][data-value="Ja"]').nth(0).click()
            await page.locator('[data-planner-avail][data-value="Vielleicht"]').nth(1).click()
            await page.locator('[data-planner-avail][data-value="Nein"]').nth(2).click()
            assert "Weihnachtsmärkte" in await page.locator("#plannerDateHint").inner_text()
            await page.click("#plannerNext")

            # 3: Nur geöffnete Märkte, exakt drei Kerndaten, vollständige Details und abwählbare Auswahl.
            assert await page.locator("#plannerMarkets .planner-market").count() > 0
            await page.locator(".planner-filter summary").click()
            await page.fill("#plannerMarketSearch", "Steeler")
            assert await page.locator("#plannerMarkets .planner-market").count() == 1
            assert "1 von" in await page.locator("#plannerFilterSummary").inner_text()
            compact_locator = page.locator("#plannerMarkets .planner-market")
            compact_lines = [line.strip().casefold() for line in (await compact_locator.inner_text()).splitlines() if line.strip()]
            assert compact_lines == [
                "steeler weihnachtsmarkt", "deine bewertung", "⭐ 3.8 / 5", "fahrzeit", "🚆 ca. 55 min.",
                "ticket für den weihnachtsmarkt", "🎟 keine ticketpflicht", "verbindlich auswählen", "details"
            ], f"Kompaktkarte enthält unerwartete Angaben: {compact_lines}"
            compact_box = await compact_locator.bounding_box()
            assert compact_box and compact_box["height"] <= 410, f"Kompaktkarte ist zu hoch: {compact_box}"
            assert await compact_locator.locator('.planner-market-art img').count() == 1
            await page.locator('#plannerMarkets [data-detail="steele"]').click()
            detail_text = await page.locator("#marketDetail").inner_text()
            for expected in ["Kaiser-Otto-Platz", "Öffnungszeiten am 05.12.2026", "Noch nicht veröffentlicht", "Eintritt", "Kostenlos", "Ticket für den Weihnachtsmarkt", "Keine Ticketpflicht", "Licht", "Trip-Tipp"]:
                assert expected in detail_text, f"Detaildialog fehlt: {expected}"
            await page.locator("#marketDialog .close").click()
            await page.click('[data-planner-market="steele"]')
            assert await page.locator('[data-planner-market="steele"]').inner_text() == "Auswahl aufheben"
            assert "Steeler Weihnachtsmarkt" in await page.locator("#plannerSelectedMarket").inner_text()
            await page.click('[data-planner-market="steele"]')
            assert await page.locator("#plannerMarkets .planner-market.selected").count() == 0
            assert await page.locator("#plannerSelectedMarket").is_hidden()
            assert "Marktauswahl aufgehoben" in await page.locator("#plannerMessage").inner_text()
            await page.click('[data-planner-market="steele"]')
            selected_text = await page.locator("#plannerMarkets .planner-market.selected").inner_text()
            assert "ticket" in selected_text.casefold() and "tagestrip-tipp" not in selected_text.casefold()
            await page.click("#resetPlannerFilters")
            assert await page.locator("#plannerMarkets .planner-market").count() > 1
            await page.click("#plannerNext")

            # 4: Konfiguration mit Rückfahrt und Budget.
            await page.fill("#plannerArrival", "15:00")
            await page.check("#plannerReturnEnabled")
            await page.fill("#plannerReturnTime", "20:00")
            await page.select_option("#plannerBudgetLevel", "normal")
            await page.select_option("#plannerActivityType", "Aktivität")
            await page.fill("#plannerActivity", "Altstadtrunde")
            await page.select_option("#plannerTicketStatus", "Nicht nötig")
            await page.fill("#plannerMeetingPoint", "Wuppertal Hbf, Eingang")
            await page.select_option("#plannerStatus", "In Planung")
            await page.fill("#plannerNotes", "Warme Schuhe mitnehmen")
            await page.click("#plannerNext")

            # 5: Je drei Transitous-Optionen, Sicherheit, letzte Rückfahrt, knapper Umstieg.
            await page.click("#loadPlannerConnections")
            await page.locator("#plannerOutbound .connection-card").first.wait_for()
            assert api_state["plan_calls"] == 2
            assert await page.locator("#plannerOutbound .connection-card").count() == 3
            assert await page.locator("#plannerReturn .connection-card").count() == 3
            assert await page.locator("#plannerOutbound", has_text="Sicherheitsverbindung").count() == 1
            assert await page.locator("#plannerReturn", has_text="Letzte sinnvolle Rückfahrt").count() == 1
            assert await page.locator(".badge.warning").count() >= 1
            await page.locator('[data-select-planner-connection^="outbound|"]').nth(1).click()
            await page.locator('[data-select-planner-connection^="return|"]').nth(1).click()
            assert await page.locator("#plannerOutbound .connection-card.selected").count() == 1
            assert await page.locator("#plannerReturn .connection-card.selected").count() == 1
            await page.click("#plannerNext")

            # 6: Zusammenfassung, lokale Speicherung und vollständige ICS.
            summary = await page.locator("#plannerSummary").inner_text()
            for expected in ["05.12.2026", "Simon (Ja)", "Anna (Vielleicht)", "Steeler Weihnachtsmarkt", "Altstadtrunde", "35 € p. P.", "70 € gesamt", "HINFAHRT", "RÜCKFAHRT", "Nicht nötig"]:
                assert expected in summary, f"Zusammenfassung fehlt: {expected}"
            await page.click("#savePlannedTrip")
            assert "Trip lokal gespeichert" in await page.locator("#plannerSaveMessage").inner_text()
            assert await page.locator("#savedTrips .saved-trip").count() == 1

            with tempfile.TemporaryDirectory() as tmp:
                async with page.expect_download() as download_info:
                    await page.click("#previewIcs")
                download = await download_info.value
                path = pathlib.Path(tmp) / download.suggested_filename
                await download.save_as(path)
                ics = path.read_text(encoding="utf-8")
                unfolded_ics = ics.replace("\n ", "")
                for expected in ["Steeler Weihnachtsmarkt", "Simon (Ja)", "Altstadtrunde", "Wuppertal Hbf\\, Eingang", "Budget: 35 € pro Person", "Ticketstatus: Nicht nötig", "Warme Schuhe mitnehmen", "DB Navigator Hinfahrt", "DB Navigator Rückfahrt"]:
                    assert expected in unfolded_ics, f"ICS fehlt: {expected}"

            # Gespeicherten Trip bearbeiten und Status ändern.
            await page.click('[data-edit-trip]')
            await page.select_option("#plannerStatus", "Geplant")
            await page.click("#plannerNext")
            await page.click("#plannerNext")
            await page.click("#savePlannedTrip")
            assert "Änderungen lokal gespeichert" in await page.locator("#plannerSaveMessage").inner_text()
            assert "Geplant" in await page.locator("#savedTrips .saved-trip").inner_text()

            # Besuch abschließen, Wintertagebuch speichern und individuelle Sticker freischalten.
            await page.click('[data-visit-trip]')
            assert await page.locator("#completionDialog").is_visible()
            assert "Steeler Weihnachtsmarkt" in await page.locator("#completionMarket").inner_text()
            await page.fill("#diaryMoment", "Goldene Lichter, gute Gespräche und ein perfekter Winterabend.")
            await page.fill("#diaryTreat", "Kakao und Reibekuchen")
            await page.check("#diaryNight")
            await page.click('#completionForm button[type="submit"]')
            unlocked_titles = []
            for _ in range(2):
                await page.locator("#unlockCelebration").wait_for(state="visible")
                unlocked_titles.append(await page.locator("#unlockTitle").inner_text())
                assert await page.locator('#unlockMedal img[src*="-new.webp"]').count() == 1
                assert await page.locator('#unlockEffectScene .effect-particle').count() > 0
                assert await page.locator('#unlockEffectScene .unlock-depth-shadow').count() == 1
                assert await page.locator('#unlockEffectScene .unlock-light-bloom').count() == 1
                assert await page.locator('#unlockEffectScene .unlock-material-sweep').count() == 1
                await page.click("#closeUnlock")
                await page.wait_for_timeout(250)
            assert set(unlocked_titles) == {"Der erste Zauber", "Night Magic"}, unlocked_titles
            await page.click('[data-view="wintermagic"]')
            assert await page.locator(".album-area").count() == 4
            assert await page.locator(".sticker-card").count() == 16
            assert await page.locator(".sticker-card.unlocked").count() == 2
            assert await page.locator('.sticker-card img.base-art').count() == 16
            assert await page.locator('.sticker-card.milestone').count() == 6
            assert await page.locator('.sticker-card.theme').count() == 10
            assert await page.locator('.album-area[data-kind="milestone"]').count() == 1
            assert await page.locator('.album-area[data-kind="theme"]').count() == 3
            artwork_check = await page.evaluate("""async () => {
                const keys = ['image', 'imageLocked', 'imageNew', 'imageSmall', 'imageLarge', 'imageShare'];
                const paths = [...new Set(WTWM_REWARDS.STICKERS.flatMap(sticker => keys.map(key => sticker[key])))];
                const failed = [];
                await Promise.all(paths.map(src => new Promise(resolve => {
                    const image = new Image();
                    image.onload = () => { if (!image.naturalWidth || !image.naturalHeight) failed.push(src); resolve(); };
                    image.onerror = () => { failed.push(src); resolve(); };
                    image.src = src;
                })));
                return { count: paths.length, failed };
            }""")
            assert artwork_check == {"count": 96, "failed": []}, f"Artwork-Pfade fehlerhaft: {artwork_check}"
            assert await page.locator('.sticker-card.unlocked img[src*="-small.webp"]').count() == 2
            assert await page.locator('.sticker-card.locked img[src*="-locked.webp"]').count() == 14
            await page.locator('.sticker-card.unlocked').first.click()
            assert await page.locator('#stickerDialog img[src*="-large.webp"]').count() == 1
            detail_text = await page.locator('#stickerDetail').inner_text()
            for expected in ["Bedeutung", "Freischaltbedingung", "Aktueller Fortschritt", "Freischaltdatum", "Zugehörige Besuche", "Steeler Weihnachtsmarkt"]:
                assert expected.casefold() in detail_text.casefold(), f"Sticker-Detail fehlt: {expected}"
            for forbidden in ["Motiv", "Material", "Band", "Rahmen", "Freischalteffekt"]:
                assert forbidden.casefold() not in detail_text.casefold(), f"Interner Stickertext sichtbar: {forbidden}"
            assert await page.locator('[data-share-sticker]').is_enabled()
            with tempfile.TemporaryDirectory() as tmp:
                async with page.expect_download() as download_info:
                    await page.click('[data-share-sticker]')
                share_download = await download_info.value
                share_path = pathlib.Path(tmp) / share_download.suggested_filename
                await share_download.save_as(share_path)
                assert share_path.suffix == '.png' and share_path.stat().st_size > 50_000
                assert share_path.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n'
            await page.click('#stickerDialog .close')
            await page.click("#showJournal")
            assert await page.locator(".journal-card").count() == 1
            assert await page.locator('.journal-sticker img[src*="-small.webp"]').count() >= 2
            assert await page.locator('[data-share-journal]').count() == 1
            journal_text = await page.locator(".journal-card").inner_text()
            for expected in ["Steeler Weihnachtsmarkt", "Goldene Lichter", "Kakao", "Night Magic"]:
                assert expected in journal_text, f"Tagebuch fehlt: {expected}"
            stored = await page.evaluate("JSON.parse(localStorage.getItem('wtwm:v2:journal'))")
            assert len(stored) == 1 and stored[0]["night"] is True

            # Stickerhaltige Tagebuch-Teilengrafik sowie vollständige Sicherung und Wiederherstellung.
            with tempfile.TemporaryDirectory() as tmp:
                async with page.expect_download() as download_info:
                    await page.click('[data-share-journal]')
                journal_download = await download_info.value
                journal_share_path = pathlib.Path(tmp) / journal_download.suggested_filename
                await journal_download.save_as(journal_share_path)
                assert journal_share_path.suffix == '.png' and journal_share_path.stat().st_size > 50_000
                assert journal_share_path.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n'

                await page.click('[data-view="settings"]')
                async with page.expect_download() as backup_info:
                    await page.click('#exportData')
                backup_download = await backup_info.value
                backup_path = pathlib.Path(tmp) / backup_download.suggested_filename
                await backup_download.save_as(backup_path)
                backup = json.loads(backup_path.read_text(encoding='utf-8'))
                assert backup['version'] == '5.0.0'
                assert len(backup['state']['journal']) == 1 and len(backup['state']['trips']) == 1
                assert len(backup['state']['rewardMeta']) >= 2
                await page.evaluate("localStorage.setItem('wtwm:v2:journal','[]'); localStorage.setItem('wtwm:v2:trips','[]'); localStorage.setItem('wtwm:v2:rewardMeta','{}')")
                await page.reload(wait_until='networkidle')
                await page.click('[data-view="settings"]')
                page.once('dialog', lambda dialog: asyncio.create_task(dialog.accept()))
                await page.set_input_files('#importData', str(backup_path))
                await page.wait_for_timeout(300)
                await page.click('[data-view="wintermagic"]')
                await page.click('#showJournal')
                assert await page.locator('.journal-card').count() == 1
                assert await page.locator('.sticker-card.unlocked').count() == 2

            # Persistenz nach Reload und bestehende Recherchebereiche.
            await page.reload(wait_until="networkidle")
            await page.click('[data-view="trip"]')
            assert await page.locator("#savedTrips .saved-trip").count() == 1
            assert "Besucht" in await page.locator("#savedTrips .saved-trip").inner_text()
            await page.click('[data-view="wintermagic"]')
            assert await page.locator(".sticker-card.unlocked").count() == 2
            await page.click("#showJournal")
            assert await page.locator(".journal-card").count() == 1
            await page.click('[data-view="markets"]')
            assert await page.locator("#marketList .card").count() == 39
            await page.click('[data-view="settings"]')
            await page.click('[data-tool-view="connections"]')
            await page.fill("#connectionFrom", "Wuppertal Hbf")
            await page.fill("#connectionTo", "Essen Steele S")
            await page.fill("#connectionDate", "2026-12-05")
            await page.fill("#connectionTime", "14:00")
            await page.click("#searchConnections")
            await page.locator("#connectionResults .connection-card").first.wait_for()
            assert await page.locator("#connectionResults .connection-card").count() >= 3

            # Desktop auf demselben GitHub-Pages-Unterpfad.
            await page.set_viewport_size({"width": 1280, "height": 900})
            await page.reload(wait_until="networkidle")
            overflow = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            assert overflow <= 1, f"Desktop-Überlaufen: {overflow}px"

            # Installierte PWA muss anschließend ohne Netz aus dem Service-Worker-Cache starten.
            assert await page.evaluate("async () => { await navigator.serviceWorker.ready; return true; }")
            await context.set_offline(True)
            await page.reload(wait_until="domcontentloaded")
            assert await page.locator("text=Way to Winter Magic").count() >= 1
            assert await page.locator("#marketCount").inner_text() == "39"
            await page.click('[data-view="wintermagic"]')
            await page.locator('.sticker-card img.sticker-art').first.wait_for()
            assert await page.locator('.sticker-card img.sticker-art').evaluate_all("els => els.every(img => img.complete && img.naturalWidth > 0)")
            offline_cache_check = await page.evaluate("""async () => {
                const keys = ['image', 'imageLocked', 'imageNew', 'imageSmall', 'imageLarge', 'imageShare'];
                const paths = [...new Set(WTWM_REWARDS.STICKERS.flatMap(sticker => keys.map(key => sticker[key])))];
                const missing = [];
                for (const src of paths) if (!(await caches.match(new URL(src, location.href)))) missing.push(src);
                return { count: paths.length, missing };
            }""")
            assert offline_cache_check == {"count": 96, "missing": []}, f"Sticker-Artwork fehlt offline: {offline_cache_check}"
            general_artwork_cache = await page.evaluate("""async () => {
                const paths = [...document.querySelectorAll('img[src*="assets/artwork"], source[srcset*="assets/artwork"]')]
                  .flatMap(el => (el.getAttribute('src') || el.getAttribute('srcset') || '').split(',').map(part => part.trim().split(' ')[0]))
                  .filter(Boolean);
                const unique = [...new Set(paths)];
                const missing = [];
                for (const src of unique) if (!(await caches.match(new URL(src, location.href)))) missing.push(src);
                return { count: unique.length, missing };
            }""")
            assert general_artwork_cache["count"] >= 20 and general_artwork_cache["missing"] == [], f"Neue Artworks fehlen offline: {general_artwork_cache}"
            await context.set_offline(False)
            assert not console_errors, "Browserfehler: " + " | ".join(console_errors)
            await browser.close()
    finally:
        server.shutdown()
        server.server_close()

    print("V5.0.0 E2E bestanden: kompletter Planer mobil/desktop, sechs Meilenstein-Medaillen, zehn freie Themen-Sticker, individuelle Freischalteffekte, Teilen, Persistenz, Wiederherstellung, Offline-Start und GitHub-Pages-Unterpfad.")


if __name__ == "__main__":
    asyncio.run(main())
