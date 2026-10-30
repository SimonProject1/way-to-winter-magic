#!/usr/bin/env python3
"""Responsive Artwork-, Zuschnitt- und Überlaufprüfung für V5.1.0."""

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
    (320, 740),
    (360, 800),
    (390, 844),
    (430, 900),
    (700, 900),
    (768, 900),
    (1024, 900),
    (1280, 900),
    (1440, 960),
]
SCREENSHOT_DIR = ROOT.parent / "wtwm-v5.1-qa"


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
        relative = self.path[len(PREFIX):] or "index.html"
        self.path = "/" + relative
        super().do_GET()


class ReuseServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


async def numeric_style(locator, prop):
    value = await locator.evaluate("(el, prop) => getComputedStyle(el)[prop]", prop)
    return float(value.replace("px", "") or 0)


async def assert_no_horizontal_overflow(page, label):
    metrics = await page.evaluate(
        """() => ({
          doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.body.clientWidth,
          viewport: innerWidth
        })"""
    )
    offenders = await page.evaluate(
        """() => [...document.querySelectorAll('body *')]
          .filter(el => {
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden') return false;
            if (el.closest('.table-wrap, .planner-progress, .journal-stickers')) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
          })
          .slice(0, 8)
          .map(el => ({tag: el.tagName, id: el.id, cls: el.className, rect: el.getBoundingClientRect().toJSON()}))"""
    )
    rightmost = await page.evaluate(
        """() => [...document.querySelectorAll('body *')]
          .filter(el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; })
          .map(el => { const r = el.getBoundingClientRect(); return {tag:el.tagName,id:el.id,cls:el.className,right:r.right,left:r.left,width:r.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}; })
          .sort((a,b) => b.right-a.right).slice(0,8)"""
    )
    widest = await page.evaluate(
        """() => [...document.querySelectorAll('body *')]
          .filter(el => el.scrollWidth - el.clientWidth > 1)
          .map(el => ({tag:el.tagName,id:el.id,cls:el.className,delta:el.scrollWidth-el.clientWidth,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}))
          .sort((a,b) => b.delta-a.delta).slice(0,12)"""
    )
    assert metrics["doc"] <= 1 and metrics["body"] <= 1, f"{label}: horizontaler Überlauf {metrics}; Elemente: {offenders}; rechts: {rightmost}; breit: {widest}"
    assert not offenders, f"{label}: Elemente außerhalb des Viewports: {offenders}"


async def main():
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = ReuseServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}{PREFIX}"
    console_errors = []

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True, executable_path=installed_chromium())
            context = await browser.new_context(viewport={"width": 390, "height": 844})
            page = await context.new_page()
            page.on("pageerror", lambda error: console_errors.append(str(error)))
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" and not msg.text.startswith("Failed to load resource:") else None)

            for width, height in VIEWPORTS:
                await page.set_viewport_size({"width": width, "height": height})
                await page.goto(base, wait_until="networkidle")
                await page.locator("#marketCount").wait_for()
                assert await page.locator("#marketCount").inner_text() == "39"

                mobile = width <= 700
                hero = page.locator(".hero")
                hero_box = await hero.bounding_box()
                assert hero_box
                if mobile:
                    assert 240 <= hero_box["height"] <= 300, f"{width}px: mobile Hero-Höhe {hero_box['height']}"
                else:
                    assert 300 <= hero_box["height"] <= 360, f"{width}px: Desktop-Hero-Höhe {hero_box['height']}"

                hero_radius = await numeric_style(hero, "borderRadius")
                hero_shadow = await hero.evaluate("el => getComputedStyle(el).boxShadow")
                hero_border = await numeric_style(hero, "borderTopWidth")
                assert hero_radius >= 18 and hero_shadow != "none" and hero_border >= 1
                assert await page.locator(".hero-art img").evaluate("img => getComputedStyle(img).objectFit === 'cover' && getComputedStyle(img).objectPosition.includes('%')")
                assert await page.locator(".hero-cta").is_visible()
                assert await page.locator(".hero-copy", has_text="Way to Winter Magic").count() == 1
                assert await page.locator(".hero-copy", has_text="Trip planen").count() == 1

                nav_images = page.locator(".tabs img")
                assert await nav_images.count() == 5
                sizes = [await nav_images.nth(i).bounding_box() for i in range(5)]
                if mobile:
                    assert all(36 <= size["width"] <= 42 for size in sizes if size), f"{width}px: Navigations-Artworks {sizes}"
                else:
                    assert all(60 <= size["width"] <= 64 for size in sizes if size), f"{width}px: Navigations-Artworks {sizes}"

                buttons = page.locator(".tabs button")
                button_widths = [(await buttons.nth(i).bounding_box())["width"] for i in range(5)]
                assert max(button_widths) - min(button_widths) <= 1.5, f"{width}px: Navigation nicht gleichmäßig {button_widths}"
                nav = page.locator(".tabs")
                if mobile:
                    assert await nav.evaluate("el => getComputedStyle(el).position === 'fixed'")
                    center = await buttons.nth(2).bounding_box()
                    assert abs((center["x"] + center["width"] / 2) - width / 2) <= 2
                else:
                    assert await nav.evaluate("el => el.scrollWidth - el.clientWidth <= 1")

                action_copy = page.locator(".artwork-intro > div")
                action_button = page.locator(".trip-artwork-action")
                action_image = page.locator(".trip-artwork-action img")
                copy_box = await action_copy.bounding_box()
                button_box = await action_button.bounding_box()
                image_box = await action_image.bounding_box()
                assert copy_box and button_box and image_box
                if mobile:
                    assert button_box["x"] > copy_box["x"], f"{width}px: Startaktion nicht horizontal"
                    assert image_box["width"] <= 82.5, f"{width}px: Startaktions-Artwork zu groß"
                else:
                    assert image_box["width"] <= 116.5

                for view in ["home", "markets", "trip", "wintermagic", "settings"]:
                    await page.click(f'.tabs [data-view="{view}"]')
                    await assert_no_horizontal_overflow(page, f"{width}px/{view}")
                    if width in (390, 1280) and view in ("markets", "trip"):
                        await page.screenshot(path=str(SCREENSHOT_DIR / f"{view}-{width}.png"), full_page=False)

                await page.click('.tabs [data-view="markets"]')
                market_art = page.locator(".market-art").first
                await market_art.wait_for()
                assert await numeric_style(market_art, "borderRadius") >= 14
                assert await market_art.evaluate("el => getComputedStyle(el).boxShadow !== 'none'")

                await page.click('.tabs [data-view="trip"]')
                assistant_art = page.locator(".assistant-art").first
                assert await numeric_style(assistant_art, "borderRadius") >= 14
                assert await assistant_art.evaluate("el => getComputedStyle(el).boxShadow !== 'none'")

                await page.click('.tabs [data-view="settings"]')
                for tool in ["timeline", "connections"]:
                    await page.click(f'[data-tool-view="{tool}"]')
                    await assert_no_horizontal_overflow(page, f"{width}px/{tool}")
                    await page.click('.tabs [data-view="settings"]')

                text = (await page.locator("body").inner_text()).casefold()
                for forbidden in ["neu in v", "zentraler bereich", "gestaltungstext", "entwicklungstext", "freischalteffekt"]:
                    assert forbidden not in text, f"Interner Text sichtbar: {forbidden}"
                assert await page.locator('img[src*="assets/stickers/"][src$=".svg"]').count() == 0

                await page.click('.tabs [data-view="home"]')
                if width in (390, 1280):
                    await page.screenshot(path=str(SCREENSHOT_DIR / f"home-{width}.png"), full_page=True)

            assert not console_errors, f"Browserfehler: {console_errors}"
            await browser.close()
    finally:
        server.shutdown()
        server.server_close()

    print(f"V5.1.0 Artwork-Layouttest bestanden: {len(VIEWPORTS)} Breiten von 320 bis 1440 px, alle Hauptansichten, optionale Werkzeuge, Hero, Navigation, Bildrahmen und Überläufe geprüft.")


if __name__ == "__main__":
    asyncio.run(main())
