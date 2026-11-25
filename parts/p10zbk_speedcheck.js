/* ---------- Speed check (3.10, Help › ⏱ Speed check) ----------
   Records the user's own strokes on their own device (the iPad lag cannot be reproduced in desktop Chrome), per tool:
   dabs per stroke and time per dab (stampAt1), time spent in each pen movement (moveStroke: drawing + texture +
   screen copy), screen frames per second while drawing (requestAnimationFrame gaps), time at pen lift (endStroke),
   and the device / page / graphics details. "Show results" opens a table to screenshot and send.
   Nothing is changed in the drawing; when it is off, nothing is measured. */
const SPEED = { on: false, rows: new Map(), cur: null, raf: 0, last: 0 };
/* pure: summary of one tool's numbers */
function speedSummary(r) {
  const avg = (a, b) => b ? a / b : 0, med = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const fps = r.frames.length ? 1000 / med(r.frames) : 0;
  return { strokes: r.strokes, dabMs: +avg(r.dabMs, r.dabs).toFixed(3), dabsPerMove: +avg(r.dabs, r.moves).toFixed(1), moveMs: +avg(r.moveMs, r.moves).toFixed(1), moveMax: +r.moveMax.toFixed(0), fps: Math.round(fps), slowFrames: r.frames.filter(f => f > 50).length, upMs: Math.round(avg(r.upMs, r.strokes)) };
}
function speedRow(tool) {
  let r = SPEED.rows.get(tool);
  if (!r) SPEED.rows.set(tool, r = { strokes: 0, dabs: 0, dabMs: 0, moves: 0, moveMs: 0, moveMax: 0, frames: [], upMs: 0 });
  return r;
}
function speedTick(t) { if (!SPEED.cur) { SPEED.raf = 0; return; } if (SPEED.last) SPEED.cur.frames.push(t - SPEED.last); SPEED.last = t; SPEED.raf = requestAnimationFrame(speedTick); }
function speedBadge() {
  let b = $('#speedBadge');
  if (!SPEED.on) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('div'); b.id = 'speedBadge';
    b.innerHTML = '<span>⏱ Speed check: draw a few strokes with each brush</span><button type="button" data-a="show">Show results</button><button type="button" data-a="stop">✕</button>';
    document.body.appendChild(b);
    b.querySelector('[data-a=show]').onclick = speedReport;
    b.querySelector('[data-a=stop]').onclick = () => { SPEED.on = false; speedBadge(); };
  }
}
function speedDevice() {
  let gl = 'no'; try { const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); if (g) { const d = g.getExtension('WEBGL_debug_renderer_info'); gl = (g instanceof (window.WebGL2RenderingContext || Object) ? 'WebGL2 ' : 'WebGL1 ') + (d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : ''); } } catch (e) {}
  return [`Inkvessa Draw ${APP_VERSION} · ${typeof shellInfo === 'function' ? shellInfo().platform : ''}`, navigator.userAgent, `Screen ${screen.width}×${screen.height} @${devicePixelRatio}x · page ${state.w}×${state.h} · zoom ${Math.round(view.scale * 100)}% · layers ${state.layers.length}`, `Graphics: ${gl} · cores ${navigator.hardwareConcurrency || '?'} · memory ${navigator.deviceMemory || '?'} GB`, `Big-page tiles ${typeof BUFT !== 'undefined' && BUFT.on ? 'on' : 'off'} · GPU mixing ${typeof GPUMIX !== 'undefined' && GPUMIX.ok ? 'on' : 'off'} · quality ${typeof QUALITY !== 'undefined' ? QUALITY.mode || '' : ''}`];
}
function speedReport() {
  const d = document.createElement('dialog'); d.className = 'csdlg'; d.id = 'speedDlg';
  const rows = [...SPEED.rows].map(([t, r]) => [t, speedSummary(r)]).filter(([, s]) => s.strokes);
  const name = t => (TOOLDEF[t] && TOOLDEF[t].name) || t;
  d.innerHTML = `<form method="dialog"><h2>⏱ Speed check</h2>
    ${rows.length ? `<table class="speedtab"><tr><th>Tool</th><th>Strokes</th><th>Screen FPS</th><th>Slow frames</th><th>ms / move</th><th>worst</th><th>dabs / move</th><th>ms / dab</th><th>pen lift ms</th></tr>
    ${rows.map(([t, s]) => `<tr><td>${escHtml(name(t))}</td><td>${s.strokes}</td><td${s.fps < 40 ? ' class="bad"' : ''}>${s.fps}</td><td>${s.slowFrames}</td><td${s.moveMs > 12 ? ' class="bad"' : ''}>${s.moveMs}</td><td>${s.moveMax}</td><td>${s.dabsPerMove}</td><td${s.dabMs > 0.3 ? ' class="bad"' : ''}>${s.dabMs}</td><td${s.upMs > 300 ? ' class="bad"' : ''}>${s.upMs}</td></tr>`).join('')}</table>`
      : '<p>No strokes recorded yet: close this, draw a few strokes with the brushes that feel slow, then press Show results again.</p>'}
    <pre class="speeddev">${escHtml(speedDevice().join('\n'))}</pre>
    <p class="muted small">Take a screenshot of this window and send it: it shows which part of drawing is slow on this device.</p>
    <div class="dialog-actions"><button type="button" data-a="clear">Clear</button><button type="button" data-a="close" class="primary">Close</button></div></form>`;
  document.body.appendChild(d);
  d.querySelector('[data-a=close]').onclick = () => d.remove();
  d.querySelector('[data-a=clear]').onclick = () => { SPEED.rows.clear(); d.remove(); };
  d.showModal();
}
function installSpeedCheck() {
  const bs0 = beginStroke; beginStroke = function () {
    const out = bs0.apply(this, arguments);
    if (SPEED.on && stroke) { SPEED.cur = speedRow(state.tool); SPEED.cur.strokes++; SPEED.last = 0; if (!SPEED.raf) SPEED.raf = requestAnimationFrame(speedTick); }
    return out;
  };
  const ms0 = moveStroke; moveStroke = function () {
    if (!SPEED.cur) return ms0.apply(this, arguments);
    const a = performance.now(); try { return ms0.apply(this, arguments); } finally { const t = performance.now() - a, r = SPEED.cur; if (r) { r.moves++; r.moveMs += t; if (t > r.moveMax) r.moveMax = t; } }
  };
  const sa0 = stampAt1; stampAt1 = function () {
    if (!SPEED.cur) return sa0.apply(this, arguments);
    const a = performance.now(); try { return sa0.apply(this, arguments); } finally { SPEED.cur.dabs++; SPEED.cur.dabMs += performance.now() - a; }
  };
  const es0 = endStroke; endStroke = function () {
    const r = SPEED.cur; if (!r) return es0.apply(this, arguments);
    const a = performance.now(); try { return es0.apply(this, arguments); } finally { r.upMs += performance.now() - a; SPEED.cur = null; }
  };
  CMD.speedCheck = () => { SPEED.on = true; speedBadge(); toast('Speed check on: draw a few strokes with each brush, then press Show results'); };
  const H = MENUS.find(m => m[0] === 'Help');
  if (H && !H[1].some(x => Array.isArray(x) && x[1] === 'speedCheck')) H[1].push(['⏱ Speed check (find what is slow)', 'speedCheck']);
}
