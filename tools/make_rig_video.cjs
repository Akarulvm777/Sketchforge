// Records the "Rig the fox" tutorial as a video for the website: site/assets/rig-fox.mp4 (needs ffmpeg).
// Usage: node tools/make_rig_video.cjs      (Playwright + the app's own tutorial: the cards are the captions)
const H = require('./e2e/harness.cjs');
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'site', 'assets', 'rig-fox.mp4');
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfvid-'));
  const { pg, ctx, errors, done } = await H.open(ROOT, 8820, { width: 1280, height: 720 });
  // record a fresh page with video on (the harness page is closed)
  const vctx = await ctx.browser().newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
  await vctx.addInitScript(() => { try { localStorage.setItem('sketchforge.tutorials.v1', '{"seen":true}'); localStorage.setItem('sketchforge.animintro.v1', 'never'); localStorage.setItem('sketchforge.lastver', '99.0.0'); } catch (e) {} });
  const p = await vctx.newPage();
  await p.goto('http://127.0.0.1:8820/index.html'); await p.waitForTimeout(2500);
  // a visible pointer + title cards
  await p.addStyleTag({ content: `#vcur{position:fixed;z-index:999999;width:22px;height:22px;margin:-4px 0 0 -4px;pointer-events:none;transition:transform .05s}
    #vcur:before{content:'';position:absolute;left:0;top:0;border-style:solid;border-width:0 0 20px 12px;border-color:transparent transparent transparent #fff;filter:drop-shadow(0 1px 2px #000);transform:skewY(-30deg)}
    #vcur.down{transform:scale(.8)}
    #vtitle{position:fixed;inset:0;z-index:999998;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#16171a;color:#eee;font:600 44px system-ui;gap:14px;text-align:center}
    #vtitle small{font:400 22px system-ui;color:#aaa}` });
  await p.evaluate(() => { const c = document.createElement('div'); c.id = 'vcur'; document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => c.classList.add('down'), true); addEventListener('mouseup', () => c.classList.remove('down'), true); });
  const title = async (html, ms) => { await p.evaluate(h => { const t = document.createElement('div'); t.id = 'vtitle'; t.innerHTML = h; document.body.appendChild(t); }, html); await p.waitForTimeout(ms); await p.evaluate(() => document.getElementById('vtitle').remove()); };
  const moveTo = async sel => { const b = await p.locator(sel).first().boundingBox(); if (!b) return; await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 }); await p.waitForTimeout(250); };
  const press = async (sel, wait) => { await moveTo(sel); await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up(); await p.waitForTimeout(wait); }; // one real click
  await p.mouse.move(1240, 690);
  await title('🦊 Rig a character in Sketchforge<small>Cut-out animation with bones — about 1 minute</small>', 3200);
  await p.evaluate(() => window.__sketchforge.CMD.tut_fox()); await p.waitForTimeout(4200); // step 1: the practice file
  for (const [wait, demoWait] of [[3200, 2600], [3600, 1500], [3800, 1600], [3000, 2400], [4200, 1800], [2600, 5200]]) {
    await press('.tut-next', wait);              // next card: time to read it
    await press('.tut-demo', demoWait);          // ▶ Show me
  }
  await press('.tut-next', 300); // Finish ✓ (the fox keeps playing)
  await p.waitForTimeout(4500);                   // the fox keeps waving
  if (!(await p.evaluate(() => window.__sketchforge.state.frame > 0 || true))) {}
  await p.mouse.move(1240, 690, { steps: 10 });
  await title('Now rig your own character!<small>Help › Tutorials › 🦊 Rig the fox · each step has “Show me”<br>Fox art by bluegi</small>', 3500);
  const vid = await p.video().path(); await vctx.close(); await done();
  if (errors.length) console.warn('JS errors:', errors);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '2.6', '-i', vid, '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', OUT]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('wrote', path.relative(ROOT, OUT), Math.round(fs.statSync(OUT).size / 1024) + ' KB');
})();
