// Records one of the app's tutorials as a video for the website (needs ffmpeg). The tutorial cards are the captions;
// every "Show me" button is pressed. Usage:
//   node tools/make_tut_video.cjs <tutorial id> <out.mp4> "<title>" "<end text>"
//   e.g. node tools/make_tut_video.cjs swap site/assets/swap-faces.mp4 "🔁 Swap drawings" "Help › Tutorials › Swap drawings"
const H = require('./e2e/harness.cjs');
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const [id, outArg, titleText = 'Sketchforge', endText = ''] = process.argv.slice(2);
if (!id || !outArg) { console.error('usage: node tools/make_tut_video.cjs <tutorial id> <out.mp4> "<title>" "<end text>"'); process.exit(1); }
const OUT = path.resolve(outArg);
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfvid-'));
  const { ctx, errors, done } = await H.open(ROOT, 8821, { width: 1280, height: 720 });
  const vctx = await ctx.browser().newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
  await vctx.addInitScript(() => { try { localStorage.setItem('sketchforge.tutorials.v1', '{"seen":true}'); localStorage.setItem('sketchforge.animintro.v1', 'never'); localStorage.setItem('sketchforge.lastver', '99.0.0'); localStorage.setItem('sketchforge.welcome.v1', 'never'); localStorage.setItem('sketchforge.savepick.v1', 'off'); } catch (e) {} });
  const p = await vctx.newPage(); const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto('http://127.0.0.1:8821/index.html'); await p.waitForTimeout(2500);
  await p.addStyleTag({ content: `#vcur{position:fixed;z-index:999999;width:22px;height:22px;margin:-4px 0 0 -4px;pointer-events:none}
    #vcur:before{content:'';position:absolute;left:0;top:0;border-style:solid;border-width:0 0 20px 12px;border-color:transparent transparent transparent #fff;filter:drop-shadow(0 1px 2px #000);transform:skewY(-30deg)}
    #vcur.down{transform:scale(.8)}
    #vtitle{position:fixed;inset:0;z-index:999998;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0b0d12;color:#e8f4ff;font:600 44px system-ui;gap:14px;text-align:center}
    #vtitle small{font:400 22px system-ui;color:#7fd4ff}` });
  await p.evaluate(() => { const c = document.createElement('div'); c.id = 'vcur'; document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => c.classList.add('down'), true); addEventListener('mouseup', () => c.classList.remove('down'), true); });
  const title = async (html, ms) => { await p.evaluate(h => { const t = document.createElement('div'); t.id = 'vtitle'; t.innerHTML = h; document.body.appendChild(t); }, html); await p.waitForTimeout(ms); await p.evaluate(() => document.getElementById('vtitle').remove()); };
  const press = async (sel, wait) => { const b = await p.locator(sel).first().boundingBox().catch(() => null); if (!b) return false;
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 }); await p.waitForTimeout(250); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); await p.waitForTimeout(wait); return true; };
  await p.mouse.move(1240, 690);
  await title(titleText + '<small>Sketchforge tutorial</small>', 3000);
  await p.evaluate(i => window.__sketchforge.CMD['tut_' + i](), id); await p.waitForTimeout(2500);
  for (let n = 0; n < 30; n++) {
    const info = await p.evaluate(() => { const c = document.querySelector('.tut-card'); return c ? { len: c.textContent.length, demo: !!c.querySelector('.tut-demo'), last: /Finish/.test((c.querySelector('.tut-next') || {}).textContent || '') } : null; });
    if (!info) break;
    await p.waitForTimeout(Math.min(6500, Math.max(2600, info.len * 38)));   // time to read the card
    if (info.demo) { await press('.tut-demo', 2600); }                        // ▶ Show me
    await press('.tut-next', 1200);
    if (info.last) break;
  }
  await p.waitForTimeout(2500);
  await p.mouse.move(1240, 690, { steps: 10 });
  await title('Try it yourself!<small>' + endText + '</small>', 3200);
  const vid = await p.video().path(); await vctx.close(); await done();
  if (errors.length || perr.length) console.warn('JS errors:', errors, perr);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '2.6', '-i', vid, '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', OUT]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('wrote', path.relative(ROOT, OUT), Math.round(fs.statSync(OUT).size / 1024) + ' KB');
})();
