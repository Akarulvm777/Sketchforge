#!/usr/bin/env python3
"""Smoke test: serves the repo, loads index.html in headless Chromium, draws a stroke,
opens the 3D panel, fails on any uncaught page error or if three.js / the rigged models do not load.
Usage: pip install playwright && playwright install chromium && python3 tools/smoke.py"""
import asyncio, functools, http.server, os, sys, threading
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get('SMOKE_PORT', 8765))

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    h.log_message = lambda *a: None
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), h).serve_forever()

async def main():
    threading.Thread(target=serve, daemon=True).start()
    errors = []
    async with async_playwright() as p:
        exe = os.environ.get('CHROME_PATH')
        b = await p.chromium.launch(executable_path=exe, args=['--no-sandbox']) if exe else await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1500, 'height': 950})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{PORT}/index.html'); await pg.wait_for_timeout(2500)
        await pg.mouse.move(600, 400); await pg.mouse.down()
        for i in range(40): await pg.mouse.move(600 + i * 8, 400 + i * 4)
        await pg.mouse.up(); await pg.wait_for_timeout(300)
        await pg.click('#btn3d'); await pg.wait_for_timeout(3000)
        three = await pg.evaluate('typeof SF3D')
        models = await pg.evaluate('typeof SF_MODELS')
        await pg.screenshot(path=os.path.join(ROOT, 'tools', 'smoke.png'))
        await b.close()
    ok = not errors and three == 'object' and models == 'object'
    print('three.js loaded:', three); print('rigged models loaded:', models); print('page errors:', errors or 'none'); print('PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)

asyncio.run(main())
