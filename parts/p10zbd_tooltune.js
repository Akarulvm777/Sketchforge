/* ---------- Tool tuner: imported tools are studied and made smooth by themselves ----------
   After an import (and after every app update, for every imported tool), each tool draws a test stroke off screen at
   a few sizes. If it is slower than the budget (TUNE.budget ms per 100 px of stroke), the tuner tries engine-side
   changes only — fewer dabs (perfSpacing, with the same build-up of ink) and fewer spray particles per step
   (perfCount) — and keeps the fastest one whose test stroke still looks the same (tuneDiff below TUNE.maxDiff on a
   reduced copy, so random spray does not count). The tool's own settings (what came from the .sut) never change.
   Result in def.perf = { ver, before, after, changes }, shown first in the ⓘ report ("⚡ …"). Colour-mixing tools
   are fast by design (they paint on a copy in memory, mirCopy) and are not tuned. */
const TUNE = { budget: 5, maxDiff: 0.045, sizes: [12, 40, 110], busy: false };
const TUNE_W = 720, TUNE_H = 220;
function tuneCanvas() { const c = makeCanvas(TUNE_W, TUNE_H); c.getContext('2d', { willReadFrequently: true }); return c; }
/* the standard test stroke (a wave, rising pressure then falling) with settings s at diameter size: returns ms */
function tuneDraw(cv, s, size, seed = 7) {
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, TUNE_W, TUNE_H);
  // (paper textures are applied once to the whole stroke in real drawing, texSync: not per dab, so not here)
  const ss = { ...s, size, smudge: undefined, paint: undefined, tex: undefined, taperIn: Math.min(s.taperIn || 0, 60), taperOut: 0 };
  const st = { s: ss, color: '#000000', ctx: g, erase: false, box: newBox(), mbox: newBox(), travel: 0, tex: false };
  // a repeatable random (spray, jitter) so two runs can be compared
  let r = seed; const R0 = Math.random; Math.random = () => { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; };
  const t0 = performance.now();
  try {
    let next = 0, trav = 0, px = 30, py = TUNE_H / 2, pp = 0.1;
    for (let i = 1; i <= 160; i++) {
      const t = i / 160, x = 30 + t * (TUNE_W - 60), y = TUNE_H / 2 + Math.sin(t * Math.PI * 3) * TUNE_H * 0.22, p = 0.15 + Math.sin(Math.PI * t) * 0.85, d = Math.hypot(x - px, y - py);
      while (next <= d) { const k = next / d; st.travel = trav + next; stampAt1(st, px + (x - px) * k, py + (y - py) * k, pp + (p - pp) * k); next += stepAt(st, pp + (p - pp) * k); }
      next -= d; trav += d; px = x; py = y; pp = p;
    }
  } finally { Math.random = R0; }
  return performance.now() - t0;
}
const TUNE_LEN = (() => { let L = 0, px = 30, py = TUNE_H / 2; for (let i = 1; i <= 160; i++) { const t = i / 160, x = 30 + t * (TUNE_W - 60), y = TUNE_H / 2 + Math.sin(t * Math.PI * 3) * TUNE_H * 0.22; L += Math.hypot(x - px, y - py); px = x; py = y; } return L; })();
/* how different two test strokes look (pure on the pixel arrays): mean alpha difference on 6× reduced copies, 0..1 */
function tuneDiffData(a, b, w, h, k = 6) {
  const W = Math.ceil(w / k), H = Math.ceil(h / k), A = new Float32Array(W * H), B = new Float32Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4 + 3, j = Math.floor(y / k) * W + Math.floor(x / k); A[j] += a[i]; B[j] += b[i]; }
  let s = 0, n = 0; for (let j = 0; j < A.length; j++) { if (A[j] > 0 || B[j] > 0) { s += Math.abs(A[j] - B[j]); n += Math.max(A[j], B[j]); } }
  return n ? s / n : 0;
}
function tuneDiff(c1, c2) { return tuneDiffData(c1.getContext('2d').getImageData(0, 0, TUNE_W, TUNE_H).data, c2.getContext('2d').getImageData(0, 0, TUNE_W, TUNE_H).data, TUNE_W, TUNE_H); }
/* ms per 100 px of stroke over the test sizes (best of 2 runs each) */
function tuneSpeed(s, cv) { let worst = 0; for (const z of TUNE.sizes) { const ms = Math.min(tuneDraw(cv, s, z), tuneDraw(cv, s, z)); worst = Math.max(worst, ms / (TUNE_LEN / 100)); } return worst; }
/* study one tool: returns { before, after, changes, perf } (perf = engine settings to add) */
function tuneTool(s) {
  if (s.smudge != null || s.paint != null) return { before: 0, after: 0, changes: ['colour mixing: paints on a fast copy in memory'], perf: {} };
  const base = { ...s }; delete base.perfSpacing; delete base.perfCount; delete base.perfDefer;
  const cv = tuneCanvas(), ref = tuneCanvas(), before = tuneSpeed(base, cv);
  if (before <= TUNE.budget) return { before, after: before, changes: [], perf: {} };
  // how much the tool differs from itself (random spray, jitter): a change may differ a little more than that
  const noise = TUNE.sizes.map(z => { tuneDraw(ref, base, z); tuneDraw(cv, base, z, 99); return tuneDiff(ref, cv); });
  const looksSame = (cand) => TUNE.sizes.every((z, i) => { tuneDraw(ref, base, z); tuneDraw(cv, cand, z); return tuneDiff(ref, cv) <= Math.max(TUNE.maxDiff, noise[i] * 1.5 + 0.01); });
  let best = {}, bestMs = before;
  const sp0 = base.tipId ? (base.spacing || 0.15) : base.hardness >= 0.97 ? 0.08 : 0.1;
  for (const k of [1.5, 2, 3, 4]) { // fewer dabs, same ink
    const cand = { ...base, perfSpacing: Math.min(0.35, sp0 * k) }; if (cand.perfSpacing <= sp0) continue;
    if (!looksSame(cand)) break;
    const ms = tuneSpeed(cand, cv); if (ms < bestMs) { best = { perfSpacing: cand.perfSpacing }; bestMs = ms; }
    if (ms <= TUNE.budget) break;
  }
  if (bestMs > TUNE.budget && (base.count || 1) > 2) for (const n of [Math.ceil(base.count * 0.66), Math.ceil(base.count / 2), 2]) { // fewer spray particles per step
    const cand = { ...base, ...best, perfCount: n };
    if (!looksSame(cand)) break;
    const ms = tuneSpeed(cand, cv); if (ms < bestMs) { best = { ...best, perfCount: n }; bestMs = ms; }
    if (ms <= TUNE.budget) break;
  }
  // still too slow for smooth drawing even with every change that keeps the look: a fast stand-in while drawing
  // (perfDefer), and the stroke is drawn again at full quality, from the exact same path and pressure, when the pen
  // lifts (replayFull) — so the pen never lags and the finished stroke looks exactly like the tool
  if (bestMs > TUNE.budget) {
    const pre = { ...base, ...best, perfSpacing: Math.min(0.5, Math.max(best.perfSpacing || sp0, sp0) * 3), perfCount: (base.count || 1) > 1 ? Math.max(1, Math.ceil((base.count || 1) / 3)) : undefined };
    const ms = tuneSpeed(pre, cv);
    if (ms < bestMs * 0.8) { best = { ...best, perfDefer: { spacing: pre.perfSpacing, count: pre.perfCount } }; bestMs = ms; }
  }
  const changes = [];
  if (best.perfDefer) changes.push('a light stand-in while you draw, the full-quality stroke as soon as you lift the pen');
  if (best.perfSpacing) changes.push(`dabs ${(best.perfSpacing / sp0).toFixed(1)}× further apart (same ink)`);
  if (best.perfCount) changes.push(`${best.perfCount} spray particles per step instead of ${base.count}`);
  return { before, after: bestMs, changes, perf: best };
}
function tuneApply(id, res) {
  const T = TOOLDEF[id]; if (!T) return;
  for (const o of [T.preset, settings[id]]) { if (!o) continue; delete o.perfSpacing; delete o.perfCount; delete o.perfDefer; Object.assign(o, res.perf); }
  const x = res.before && res.after < res.before * 0.95 ? (res.before / res.after).toFixed(1) : null;
  const line = x ? `⚡ Tuned for smooth drawing: ${x}× faster (${res.changes.join(', ')}). The tool's own settings are unchanged.`
    : res.changes.length ? `⚡ ${res.changes[0]}` : '⚡ Checked: already smooth, nothing to change.';
  T.report = [[x ? 'ok' : 'ok', line], ...(T.report || []).filter(r => !String(r[1]).startsWith('⚡'))];
}
/* tune imported tools (ids), one per idle moment; record the result in the saved definition */
/* opts.now: the import window is showing the study, so do not wait for the user to be idle (still never during a
   stroke); opts.onTool(id, result) reports each tool to the window */
/* short text for the import window */
function impwTestNote(res) {
  const p = res.perf || {};
  if (p.perfDefer) return 'heavy tool: a light stand-in draws while you move, the full stroke appears when you lift the pen';
  if (p.perfSpacing || p.perfCount) return `tuned for smooth drawing (${res.before.toFixed(1)} → ${res.after.toFixed(1)} ms per 100 px, same look)`;
  return 'draws smoothly';
}
async function tuneTools(ids, quiet, opts = {}) {
  if (!ids.length) return;
  const own = !opts.now; // the import window's study runs even while a background study waits for the user to be idle
  if (own) { if (TUNE.busy) return; TUNE.busy = true; }
  let faster = 0;
  try {
    for (const id of ids) {
      if (opts.now) await impwTick();
      else await new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 30)));
      while ((typeof stroke !== 'undefined' && stroke) || (!opts.now && !inputQuiet(4000))) await new Promise(r => setTimeout(r, 400)); // never while drawing
      const s = settings[id]; if (!s) continue;
      let res; try { res = tuneTool(s); } catch (e) { if (opts.onTool) opts.onTool(id, null); continue; }
      if (opts.onTool) opts.onTool(id, res);
      tuneApply(id, res);
      if (res.perf.perfSpacing || res.perf.perfCount || res.perf.perfDefer) faster++;
      const rec = (addons.brushes || []).find(b => b.id === id);
      if (rec) { rec.perf = { ver: APP_VERSION, before: +res.before.toFixed(2), after: +res.after.toFixed(2), changes: res.changes, ...res.perf }; rec.perfSpacing = res.perf.perfSpacing; rec.perfCount = res.perf.perfCount; rec.perfDefer = res.perf.perfDefer; }
    }
    if (typeof saveAddons === 'function') saveAddons();
    if (!quiet) toast(faster ? `⚡ ${faster} imported tool${faster > 1 ? 's were' : ' was'} tuned for smooth drawing (ⓘ shows what changed).` : `⚡ Imported tools checked: they draw smoothly.`, 4500);
    if (typeof renderSubTools === 'function') renderSubTools();
  } finally { if (own) TUNE.busy = false; }
}
/* very heavy tools: draw the stroke again with the full settings from the recorded path (called by endStroke) */
function replayFull(st) {
  const pts = st.rec; if (!pts || !pts.length || !st.rec0) return;
  clearBuffers(st); st.box = newBox(); st.mbox = newBox();
  st.s = st.sFull; st.sFull = null;
  st.lx = st.rec0[0]; st.ly = st.rec0[1]; st.lp = st.rec0[2]; st.next = 0; st.travel = 0; st.outK = null; st.dlx = st.dly = null;
  st.tq = st.s.taperOut ? [] : null;
  st.replaying = true;
  try {
    stampAt(st, st.lx, st.ly, st.lp); st.next = stepAt(st, st.lp); // the first dab, where the pen came down
    for (const p of pts) segment(st, p[0], p[1], p[2]);
    if (st.tq) flushTaper(st);
  } finally { st.replaying = false; }
  afterMove(st);
}
function installToolTune() {
  // a heavy tool draws with its light stand-in while the pen moves, and records the path for replayFull
  const b0 = beginStroke; beginStroke = function () {
    const out = b0.apply(this, arguments), st = stroke;
    if (st && st.s && st.s.perfDefer && !st.direct && !st.erase && !st.isShape) {
      const full = { ...st.s }; delete full.perfDefer;
      st.sFull = full; st.s = { ...full, perfSpacing: st.s.perfDefer.spacing, ...(st.s.perfDefer.count ? { perfCount: st.s.perfDefer.count } : {}) };
      st.rec = []; st.rec0 = null;
    }
    return out;
  };
  const sg0 = segment; segment = function (st, x, y, pr) {
    if (st && st.rec && !st.replaying) { if (!st.rec0) st.rec0 = [st.lx, st.ly, st.lp]; st.rec.push([x, y, pr]); }
    return sg0.apply(this, arguments);
  };
  // a new import is studied by importTools itself (test stroke step of the import window, p10zbf)
  // after an update (or the first time): every imported tool whose study is older than this version
  const l0 = loadAddons; loadAddons = async function () {
    const out = await l0.apply(this, arguments);
    const old = (addons.brushes || []).filter(b => b.id && TOOLDEF[b.id] && kindOf(b.id) === 'brush' && (!b.perf || b.perf.ver !== APP_VERSION)).map(b => b.id);
    for (const b of addons.brushes || []) if (b.perf && TOOLDEF[b.id]) tuneApply(b.id, { before: b.perf.before, after: b.perf.after, changes: b.perf.changes || [], perf: { ...(b.perf.perfSpacing ? { perfSpacing: b.perf.perfSpacing } : {}), ...(b.perf.perfCount ? { perfCount: b.perf.perfCount } : {}), ...(b.perf.perfDefer ? { perfDefer: b.perf.perfDefer } : {}) } });
    if (old.length) setTimeout(() => tuneTools(old, true), 4000);
    return out;
  };
  CMD.tuneTools = () => { const ids = (addons.brushes || []).map(b => b.id).filter(id => TOOLDEF[id] && kindOf(id) === 'brush'); if (!ids.length) { toast('No imported tools to tune'); return; } toast(`⚡ Studying ${ids.length} imported tool${ids.length > 1 ? 's' : ''}…`); tuneTools(ids, false); };
  const A = MENUS.find(m => m[0] === 'Add-ons'); if (A) A[1].push('-', ['⚡ Tune imported tools for smooth drawing', 'tuneTools']);
}
