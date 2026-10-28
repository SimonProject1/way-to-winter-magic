#!/usr/bin/env python3
"""Responsive Sticker-Detailprüfung für alle Motive, Zustände und Zielgrößen."""

import asyncio
import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
PREFIX = "/way-to-winter-magic/"
VIEWPORTS = [
    (320, 568, "kleines Smartphone"),
    (390, 844, "Smartphone"),
    (768, 1024, "Tablet"),
    (1024, 600, "flacher Desktop"),
    (1440, 900, "Desktop"),
]


def installed_chromium():
    candidates = sorted(pathlib.Path("/opt/pw-browsers").glob("chromium-*/chrome-linux64/chrome"), reverse=True)
    return str(candidates[0]) if candidates else None


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if not path.startswith(PREFIX):
            self.send_error(404)
            return
        relative = path[len(PREFIX):] or "index.html"
        self.path = "/" + relative
        super().do_GET()


class ReuseServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


def overlaps(a, b, tolerance=1.0):
    width = min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"])
    height = min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"])
    return width > tolerance and height > tolerance


async def assert_dialog(page, sticker_id, sticker_name, unlocked, viewport):
    await page.locator(f'[data-sticker="{sticker_id}"]').first.click()
    dialog = page.locator("#stickerDialog")
    await dialog.wait_for(state="visible")
    await page.locator("#stickerDialog .sticker-art.base-art").wait_for(state="visible")
    await page.wait_for_function("document.querySelector('#stickerDialog .sticker-art.base-art')?.complete")

    expected_status = "Freigeschaltet" if unlocked else "Noch gesperrt"
    expected_button = "Sticker teilen" if unlocked else "Nach Freischaltung teilbar"
    expected_image = "-large.webp" if unlocked else "-locked.webp"

    assert await page.locator("#stickerDetailTitle").inner_text() == sticker_name
    actual_status = await page.locator("#stickerDetailStatus").inner_text()
    assert actual_status.casefold() == expected_status.casefold(), f"Status falsch: {sticker_name}, erwartet {expected_status}, erhalten {actual_status}, Viewport {viewport}"
    description = await page.locator("#stickerDetailDescription").inner_text()
    assert description.strip(), f"Leere Beschreibung: {sticker_name}"
    share = page.locator("[data-share-sticker]")
    assert await share.inner_text() == expected_button
    assert await share.is_enabled() is unlocked
    assert expected_image in (await page.locator("#stickerDialog .sticker-art.base-art").get_attribute("src"))

    progress_text = await page.locator(".sticker-progress-detail").inner_text()
    assert "/" in progress_text and progress_text.strip(), f"Fortschritt fehlt: {sticker_name}"
    assert await page.locator(".sticker-progress-detail .mini-progress i").count() == 1

    boxes = {}
    for key, selector in {
        "dialog": "#stickerDialog",
        "art": ".sticker-detail-art",
        "copy": ".sticker-detail-copy",
        "status": "#stickerDetailStatus",
        "title": "#stickerDetailTitle",
        "description": "#stickerDetailDescription",
        "close": "#stickerDialog .close",
    }.items():
        box = await page.locator(selector).bounding_box()
        assert box and box["width"] > 0 and box["height"] > 0, f"Unsichtbar: {key} / {sticker_name}"
        boxes[key] = box

    assert not overlaps(boxes["art"], boxes["copy"]), f"Artwork/Text überlappt: {sticker_name} bei {viewport}"
    for key in ("status", "title", "description"):
        box = boxes[key]
        copy = boxes["copy"]
        assert box["x"] >= copy["x"] - 1 and box["x"] + box["width"] <= copy["x"] + copy["width"] + 1, f"Text horizontal abgeschnitten: {key} / {sticker_name}"

    width, height = viewport
    dialog_box = boxes["dialog"]
    close_box = boxes["close"]
    assert dialog_box["x"] >= -1 and dialog_box["x"] + dialog_box["width"] <= width + 1
    assert dialog_box["y"] >= -1 and dialog_box["y"] + dialog_box["height"] <= height + 1
    assert close_box["x"] >= dialog_box["x"] and close_box["x"] + close_box["width"] <= dialog_box["x"] + dialog_box["width"]
    assert close_box["y"] >= dialog_box["y"] and close_box["y"] + close_box["height"] <= dialog_box["y"] + dialog_box["height"]

    overflow = await page.locator("#stickerDetail").evaluate("el => ({x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight, top: el.scrollTop})")
    assert overflow["x"] <= 1, f"Horizontaler Dialogüberlauf: {sticker_name} bei {viewport}: {overflow['x']} px"
    assert overflow["top"] == 0, f"Dialog startet nicht oben: {sticker_name}"
    if overflow["y"] > 2:
        close_y = close_box["y"]
        await page.locator("#stickerDetail").evaluate("el => { el.scrollTop = el.scrollHeight; }")
        await page.wait_for_timeout(20)
        scrolled = await page.locator("#stickerDetail").evaluate("el => el.scrollTop")
        assert scrolled > 0, f"Dialog nicht scrollbar: {sticker_name} bei {viewport}"
        close_after = await page.locator("#stickerDialog .close").bounding_box()
        assert close_after and abs(close_after["y"] - close_y) <= 1, f"Schließen-Button scrollt weg: {sticker_name}"

    await page.locator("#stickerDialog .close").click()
    await dialog.wait_for(state="hidden")


async def check_state(page, unlocked, viewport):
    if unlocked:
        await page.evaluate("""() => {
          const meta = Object.fromEntries(WTWM_REWARDS.STICKERS.map(sticker => [sticker.id, { unlockedAt:'2026-10-28T20:00:00.000Z', seen:true }]));
          localStorage.setItem('wtwm:v2:rewardMeta', JSON.stringify(meta));
        }""")
    else:
        await page.evaluate("""() => {
          localStorage.setItem('wtwm:v2:trips', '[]');
          localStorage.setItem('wtwm:v2:journal', '[]');
          localStorage.setItem('wtwm:v2:rewardMeta', '{}');
        }""")
    await page.reload(wait_until="networkidle")
    await page.click('[data-view="wintermagic"]')
    assert await page.locator(".sticker-card").count() == 16
    expected_class = ".sticker-card.unlocked" if unlocked else ".sticker-card.locked"
    assert await page.locator(expected_class).count() == 16
    stickers = await page.evaluate("WTWM_REWARDS.STICKERS.map(({id,name}) => ({id,name}))")
    for sticker in stickers:
        await assert_dialog(page, sticker["id"], sticker["name"], unlocked, viewport)


async def main():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = ReuseServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}{PREFIX}"
    checked = 0
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, executable_path=installed_chromium())
            for width, height, label in VIEWPORTS:
                context = await browser.new_context(viewport={"width": width, "height": height})
                page = await context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                await page.goto(base, wait_until="networkidle")
                for unlocked in (False, True):
                    await check_state(page, unlocked, (width, height))
                    checked += 16
                assert not errors, f"Browserfehler bei {label}: {' | '.join(errors)}"
                await context.close()
            await browser.close()
    finally:
        server.shutdown()
        server.server_close()

    print(f"V4.0.1 Sticker-Dialogtest bestanden: {checked} Dialogöffnungen, 16 Sticker, gesperrt/freigeschaltet, {len(VIEWPORTS)} Bildschirmgrößen, Fortschritt, Teilen-Hinweis, Scrollen und Schließen geprüft.")


if __name__ == "__main__":
    asyncio.run(main())
