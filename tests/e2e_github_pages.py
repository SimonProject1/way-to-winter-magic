#!/usr/bin/env python3
"""GitHub-Pages-Unterpfadtest mit simulierten Transitous-Antworten."""

import asyncio
import contextlib
import functools
import http.server
import json
import pathlib
import socketserver
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
    low = text.lower()
    if "wuppertal" in low:
        return [{"name": "Wuppertal Hbf", "stopId": "de:05124:01133", "lat": 51.254, "lon": 7.150}]
    if "essen" in low:
        return [{"name": "Essen Hbf", "stopId": "de:05113:8000080", "lat": 51.451, "lon": 7.014}]
    return []


def plan_result(arrive_by):
    if arrive_by:
        start, end = "2026-12-05T18:05:00+01:00", "2026-12-05T18:45:00+01:00"
        origin, destination = "Essen Hbf", "Wuppertal Hbf"
        route = "RE 49"
    else:
        start, end = "2026-12-05T14:05:00+01:00", "2026-12-05T14:45:00+01:00"
        origin, destination = "Wuppertal Hbf", "Essen Hbf"
        route = "RE 49"
    return {
        "itineraries": [{
            "duration": 2400,
            "transfers": 0,
            "startTime": start,
            "endTime": end,
            "legs": [{
                "from": {"name": origin, "track": "1"},
                "to": {"name": destination},
                "mode": "RAIL",
                "routeShortName": route,
                "headsign": destination,
                "scheduledStartTime": start,
                "startTime": start,
                "scheduledEndTime": end,
                "endTime": end,
            }],
        }]
    }


async def main():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = ReuseServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}{PREFIX}"

    api_state = {"plan_calls": 0, "mode": "normal"}
    console_errors = []

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, executable_path=installed_chromium())
            context = await browser.new_context(viewport={"width": 390, "height": 844})
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
                    if api_state["mode"] == "retry" and api_state["plan_calls"] == 1:
                        await route.abort("connectionfailed")
                        return
                    if api_state["mode"] == "timeout":
                        await asyncio.sleep(2)
                        with contextlib.suppress(Exception):
                            await route.abort("timedout")
                        return
                    arrive_by = query.get("arriveBy", ["false"])[0] == "true"
                    await route.fulfill(status=200, content_type="application/json", body=json.dumps(plan_result(arrive_by)))
                    return
                await route.abort()

            await page.route("https://api.transitous.org/**", api)
            await page.goto(base, wait_until="networkidle")
            assert await page.locator("text=Way to Winter Magic").count() >= 1
            assert await page.locator("text=V2.3.0").count() >= 1

            # Mobile layout must not create horizontal page overflow.
            overflow = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            assert overflow <= 1, f"Horizontales Überlaufen: {overflow}px"

            # Haltestellensuche and selection.
            await page.click('[data-view="settings"]')
            await page.fill("#stopQuery", "Essen Hbf")
            await page.click("#searchStop")
            await page.locator('[data-stop="0"]').wait_for()
            await page.click('[data-stop="0"]')
            assert "Essen Hbf" in await page.locator("#savedStop").inner_text()

            # Hinfahrt; the first plan request is dropped to prove the automatic retry.
            await page.click('[data-view="connections"]')
            await page.fill("#connectionFrom", "Wuppertal Hbf")
            await page.fill("#connectionTo", "Essen Hbf")
            await page.fill("#connectionDate", "2026-12-05")
            await page.fill("#connectionTime", "14:00")
            api_state.update(mode="retry", plan_calls=0)
            await page.click("#searchConnections")
            await page.locator(".connection-card").first.wait_for()
            assert api_state["plan_calls"] == 2, "Automatischer Retry wurde nicht ausgeführt"
            assert "14:05" in await page.locator(".connection-time").first.inner_text()
            assert await page.locator("#savedConnections .saved-connection").count() == 1
            db_href = await page.locator(".connection-card .db-link").first.get_attribute("href")
            assert "so=Wuppertal+Hbf" in db_href and "zo=Essen+Hbf" in db_href

            # Rückfahrt via swap + arrival search.
            await page.click("#swapConnection")
            await page.select_option("#connectionMode", "arrival")
            await page.fill("#connectionTime", "19:00")
            api_state.update(mode="normal", plan_calls=0)
            await page.click("#searchConnections")
            await page.locator(".connection-card").first.wait_for()
            assert "18:05" in await page.locator(".connection-time").first.inner_text()
            assert api_state["plan_calls"] == 1

            # Offline display of the exact cached return search.
            await context.set_offline(True)
            await page.click("#searchConnections")
            await page.wait_for_function("document.querySelector('#connectionMessage').textContent.includes('Offline')")
            assert await page.locator(".connection-card").count() >= 1
            cached_text = await page.locator(".connection-card").first.inner_text()
            assert "Essen Hbf" in cached_text and "Wuppertal Hbf" in cached_text
            await context.set_offline(False)

            # The explicit timeout error is tested with shorter timers inside this page.
            await page.evaluate("window.__originalSetTimeout = window.setTimeout; window.setTimeout = (fn, ms, ...args) => window.__originalSetTimeout(fn, ms === 12000 ? 80 : ms, ...args)")
            await page.fill("#connectionTime", "20:00")
            api_state.update(mode="timeout", plan_calls=0)
            await page.click("#searchConnections")
            await page.locator("#retryConnections").wait_for(timeout=5000)
            error_text = await page.locator("#connectionResults").inner_text()
            assert "12 Sekunden" in error_text and "Erneut versuchen" in error_text

            # Desktop layout smoke test on the same GitHub Pages subpath.
            await page.set_viewport_size({"width": 1280, "height": 900})
            await page.reload(wait_until="networkidle")
            overflow = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            assert overflow <= 1, f"Desktop-Überlaufen: {overflow}px"

            assert not console_errors, "Browserfehler: " + " | ".join(console_errors)
            await browser.close()
    finally:
        server.shutdown()
        server.server_close()

    print("V2.3.0 E2E bestanden: GitHub-Pages-Unterpfad, Haltestelle, Hin-/Rückfahrt, Retry, Timeout, Offline und DB Navigator.")


if __name__ == "__main__":
    asyncio.run(main())
