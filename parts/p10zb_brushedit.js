/* ---------- Brush editor: make your own brush or change any brush, with every setting the engine has ----------
   Sub Tool ⚙ (or Add-ons › Create a new brush…, or "All brush settings…" in Tool Property). Built-in tools are edited as
   a copy ("… (mine)"). Live preview; Save keeps it (IndexedDB, with the imported tools); .sfbrush files share brushes. */
const BE_GROUPS = [['pen', 'Pen'], ['pencil', 'Pencil'], ['brush', 'Brush'], ['airbrush', 'Airbrush'], ['decor', 'Decoration'], ['shade', 'Shading pens'], ['eraser', 'Eraser'], ['blend', 'Blend']];
const BE_TEX = [['', 'None'], ['paper', 'Watercolour paper'], ['grain', 'Pencil grain'], ['canvas', 'Canvas weave'], ['rough', 'Rough'], ['bristle', 'Bristle'], ['charcoal', 'Charcoal'], ['image', 'My picture…']];
const BE_BLEND = [['', 'Normal'], ['multiply', 'Multiply'], ['darken', 'Darken'], ['color-burn', 'Color burn'], ['screen', 'Screen'], ['lighten', 'Lighten'], ['color-dodge', 'Color dodge'], ['lighter', 'Add (glow)'],
  ['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['hard-light', 'Hard light'], ['difference', 'Difference'], ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Brightness']];
/* the form: [section, fields]; field = [key, label, type, …] — range: min, max, step, unit ('%' shows ×100) */
const BE_FORM = [
  ['Brush', [['name', 'Name', 'text'], ['group', 'Sub tool group', 'select', BE_GROUPS], ['mode', 'Works as', 'select', [['paint', 'Paint'], ['erase', 'Eraser'], ['smudge', 'Smudge / blend'], ['blur', 'Blur']]]]],
  ['Size & ink', [['size', 'Size', 'range', 0.5, 1000, 0.5, 'px'], ['opacity', 'Opacity', 'range', 0.01, 1, 0.01, '%'], ['flow', 'Density (flow)', 'range', 0.01, 1, 0.01, '%'],
    ['hardness', 'Hardness (round tip)', 'range', 0, 1, 0.01, '%'], ['spacing', 'Spacing', 'range', 0.02, 3, 0.01, '%'], ['flowSp', 'Density follows spacing', 'check'], ['smooth', 'Stabiliser', 'range', 0, 0.9, 0.01, '%'],
    ['aa', 'Anti-aliasing', 'select', [[0, 'None'], [1, 'Weak'], [2, 'Medium'], [3, 'Strong']]], ['blendOp', 'Blending mode', 'select', BE_BLEND], ['min1', 'At least 1 px', 'check']]],
  ['Tip shape', [['tipimg', 'Tip pictures', 'tipimg'], ['tipDensity', 'Picture: dark = ink (off: use its transparency)', 'check'], ['tipOrder', 'Several pictures', 'select', [['random', 'Random'], ['seq', 'One after the other']]],
    ['thick', 'Thickness (flat tip)', 'range', 0.05, 1, 0.01, '%'], ['angle', 'Angle', 'range', 0, 360, 1, '°'], ['rotP', 'Angle follows pen pressure', 'check'],
    ['tipRotAmt', 'Random rotation', 'range', 0, 1, 0.01, '%'], ['tipFollow', 'Tip turns with the stroke direction', 'check']]],
  ['Pen pressure', [['pSize', 'Pressure → size', 'check'], ['pMin', 'Minimum size', 'range', 0, 1, 0.01, '%'], ['pCurve', 'Size pressure curve', 'curve'],
    ['pAlpha', 'Pressure → opacity', 'check'], ['aMin', 'Minimum opacity', 'range', 0, 1, 0.01, '%'], ['aCurve', 'Opacity pressure curve', 'curve'],
    ['speed', 'Faster = thinner', 'range', 0, 1, 0.01, '%'], ['vOn', 'Drawing speed → size (own curve)', 'check'], ['vMin', 'Speed: minimum size', 'range', 0, 1, 0.01, '%'], ['vCurve', 'Speed curve (slow → fast)', 'curve'],
    ['tOn', 'Pen tilt → size', 'check'], ['tMin', 'Tilt: minimum size', 'range', 0, 1, 0.01, '%'], ['tCurve', 'Tilt curve (upright → flat)', 'curve'],
    ['atOn', 'Pen tilt → opacity', 'check'], ['atMin', 'Tilt: minimum opacity', 'range', 0, 1, 0.01, '%'], ['atCurve', 'Tilt → opacity curve', 'curve'], ['sRandOn', 'Random size per dab', 'check'], ['sRand', 'Random size: minimum', 'range', 0, 1, 0.01, '%'],
    ['aRandOn', 'Random opacity per dab', 'check'], ['aRand', 'Random opacity: minimum', 'range', 0, 1, 0.01, '%']]],
  ['Start & end', [['taperIn', 'Thin start (length)', 'range', 0, 400, 1, 'px'], ['taperRatio', 'Start from', 'range', 0, 1, 0.01, '%'], ['taperOut', 'Thin end (length)', 'range', 0, 400, 1, 'px'],
    ['taperOutRatio', 'End at', 'range', 0, 1, 0.01, '%'], ['fadeIn', 'Fade in (opacity) at the start', 'check'], ['fadeOut', 'Fade out (opacity) at the end', 'check']]],
  ['Spray & scatter', [['scatter', 'Scatter (× size)', 'range', 0, 3, 0.01, '×'], ['count', 'Dabs each time', 'range', 1, 12, 1, ''], ['sprayBias', 'Spread: rim ← → middle', 'range', -1, 1, 0.05, ''],
    ['jitter', 'Smaller dabs at random', 'range', 0, 1, 0.01, '%']]],
  ['Colour', [['hueJit', 'Hue change per dab', 'range', 0, 1, 0.01, '%'], ['satJit', 'Saturation change per dab', 'range', 0, 1, 0.01, '%'], ['valJit', 'Brightness change per dab', 'range', 0, 1, 0.01, '%'],
    ['mixOn', 'Colour mixing (picks up the colour under the brush)', 'check'], ['paint', 'Amount of paint', 'range', 0, 1, 0.01, '%'], ['paintDensity', 'Density of paint', 'range', 0.01, 1, 0.01, '%'],
    ['smudgeAmt', 'Colour stretch (smudge / mixing)', 'range', 0, 0.95, 0.01, '%'], ['wet', 'Watercolour edge', 'range', 0, 1, 0.01, '%']]],
  ['Texture', [['texSel', 'Paper texture', 'select', BE_TEX], ['teximg', 'Texture picture', 'teximg'], ['texAmt', 'Texture strength', 'range', 0, 1, 0.01, '%'], ['texScale', 'Texture scale', 'range', 0.1, 8, 0.05, '×'],
    ['texRot', 'Texture angle', 'range', 0, 360, 1, '°'], ['texInv', 'Invert the texture', 'check'], ['texBright', 'Texture brightness', 'range', -100, 100, 1, ''], ['texContrast', 'Texture contrast', 'range', -100, 100, 1, '']]]
];
const BE_DEFAULT = { name: 'My brush', group: 'brush', size: 24, opacity: 1, flow: 1, hardness: 0.85, spacing: 0.1, smooth: 0.2, aa: 2, pSize: true, pMin: 0.12, pAlpha: false, aMin: 0.1, taperRatio: 0.3 };
/* form values ← definition (derived fields: mode, thickness / angle, on/off switches, texture choice) */
function beFromDef(def) {
  const d = { ...BE_DEFAULT, ...def };
  d.mode = d.erase || d.group === 'eraser' ? 'erase' : d.blurTool ? 'blur' : d.smudge != null && d.paint == null ? 'smudge' : 'paint';
  d.thick = d.nibRatio ?? d.tipThick ?? 1; d.angle = d.nibAngle ?? d.tipAngle ?? 0;
  d.tipRotAmt = d.tipRot ? (d.tipRotAmt ?? 1) : 0;
  d.sRandOn = d.sRand != null; d.sRand = d.sRand ?? 0.5; d.aRandOn = d.aRand != null; d.aRand = d.aRand ?? 0.5;
  d.mixOn = d.paint != null; d.paint = d.paint ?? 0.5; d.paintDensity = d.paintDensity ?? 0.6; d.smudgeAmt = d.smudge ?? 0.6;
  d.texSel = d.texImg ? 'image' : (d.tex || ''); d.texAmt = d.texAmt ?? 0.6; d.texScale = d.texScale ?? 1;
  d.tipDensity = !!d.tipDensity; d.tipOrder = d.tipOrder || 'random';
  d.vOn = d.vCurve != null; d.vMin = d.vMin ?? 0.3; d.tOn = d.tCurve != null; d.tMin = d.tMin ?? 0.3; d.atOn = d.atCurve != null; d.atMin = d.atMin ?? 0.3;
  return d;
}
/* form values → definition */
function beToDef(f) {
  const def = {};
  for (const k of ['name', 'group', 'size', 'opacity', 'flow', 'hardness', 'spacing', 'smooth', 'aa', 'min1', 'tipDensity', 'tipOrder', 'rotP', 'tipFollow', 'pSize', 'pMin', 'pCurve', 'pAlpha', 'aMin', 'aCurve',
    'taperIn', 'taperRatio', 'taperOut', 'taperOutRatio', 'fadeIn', 'fadeOut', 'scatter', 'count', 'sprayBias', 'jitter', 'hueJit', 'satJit', 'valJit', 'wet', 'texAmt', 'texScale', 'texRot', 'texInv', 'texBright', 'texContrast', 'tip', 'tips', 'texImg'])
    if (f[k] != null && f[k] !== '' && f[k] !== false && !(typeof f[k] === 'number' && f[k] === 0 && !['pMin', 'aMin', 'taperRatio', 'taperOutRatio', 'hardness', 'aa'].includes(k))) def[k] = f[k];
  def.pSize = !!f.pSize; def.pAlpha = !!f.pAlpha; def.aa = +f.aa;
  if (f.blendOp) def.blendOp = f.blendOp;
  def.nibRatio = def.tipThick = f.thick; def.nibAngle = def.tipAngle = f.angle;
  if (f.tipRotAmt > 0) { def.tipRot = true; def.tipRotAmt = f.tipRotAmt; }
  if (f.sRandOn) def.sRand = f.sRand; if (f.aRandOn) def.aRand = f.aRand;
  if (f.vOn) { def.vMin = f.vMin; def.vCurve = f.vCurve || [[0, 1], [1, 0]]; }
  if (f.tOn) { def.tMin = f.tMin; def.tCurve = f.tCurve || [[0, 0], [1, 1]]; }
  if (f.atOn) { def.atMin = f.atMin; def.atCurve = f.atCurve || [[0, 0], [1, 1]]; }
  if (f.flowSp) def.flowSp = true;
  if (f.scatter > 0) def.sprayFix = true;
  if (f.speed > 0) def.speed = f.speed;
  if (f.mode === 'erase') { def.erase = true; if (def.group !== 'eraser' && def.group !== 'blend') def.group = def.group || 'eraser'; }
  else if (f.mode === 'blur') { def.smudge = 0; def.blurTool = true; }
  else if (f.mode === 'smudge') def.smudge = f.smudgeAmt;
  else if (f.mixOn) { def.paint = f.paint; def.paintDensity = f.paintDensity; def.smudge = f.smudgeAmt; }
  if (f.texSel === 'image' && f.texImg) def.tex = 'paper'; else if (f.texSel && f.texSel !== 'image') { def.tex = f.texSel; delete def.texImg; } else { delete def.tex; delete def.texImg; }
  if (!def.tips || def.tips.length < 2) delete def.tips;
  return def;
}
/* keys the form manages; anything else of the original definition is kept as it was */
const BE_MANAGED = new Set(('name group size opacity flow hardness spacing smooth aa min1 tipDensity tipOrder rotP tipFollow pSize pMin pCurve pAlpha aMin aCurve taperIn taperRatio taperOut taperOutRatio ' +
  'fadeIn fadeOut scatter count sprayBias jitter hueJit satJit valJit wet texAmt texScale texRot texInv texBright texContrast tip tips texImg blendOp nibRatio tipThick nibAngle tipAngle tipRot ' +
  'tipRotAmt sRand aRand sprayFix speed erase smudge blurTool paint paintDensity tex vMin vCurve tMin tCurve atMin atCurve flowSp').split(' '));
function beMerge(base, def) { const out = {}; for (const [k, v] of Object.entries(base || {})) if (!BE_MANAGED.has(k) && k !== 'id') out[k] = v; return Object.assign(out, def); }
/* a definition from any tool (built-in tools: from their current settings) */
function beDefOf(id) {
  const rec = addons.brushes.find(b => b.id === id);
  if (rec) return JSON.parse(JSON.stringify(rec));
  const s = settings[id] || (TOOLDEF[id] && TOOLDEF[id].preset) || {}, def = { name: (TOOLDEF[id] ? TOOLDEF[id].name : 'Brush') + ' (mine)', group: (groupOf(id) || {}).id || 'brush' };
  for (const k of ['size', 'opacity', 'flow', 'hardness', 'spacing', 'smooth', 'aa', 'pSize', 'pAlpha', 'taperIn', 'taperRatio', ...BRUSH_KEYS]) if (s[k] != null) def[k] = s[k];
  if (s.tex && !/^tex_/.test(s.tex)) { def.tex = s.tex; def.texAmt = s.texAmt; def.texScale = s.texScale; }
  if (TOOLDEF[id] && TOOLDEF[id].erase) def.erase = true;
  if (s.tipId && customTips.has(s.tipId)) def.tip = customTips.get(s.tipId).toDataURL(); // built-in picture tips
  return def;
}
/* draws a sample stroke with the real brush engine (dabs, tips, textures, tapers) */
function bePreview(cv, s, color) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  const mix = s.paint != null || s.smudge != null;
  if (mix) { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#f2c14e'); gr.addColorStop(1, '#5aa9e6'); g.fillStyle = gr; g.globalAlpha = 0.85; g.fillRect(W * 0.3, 8, W * 0.4, H - 16); g.globalAlpha = 1; }
  const k = Math.min(1, (H * 0.55) / Math.max(1, s.size * (1 + 2 * (s.scatter || 0))));
  const ss = { ...s, size: Math.max(1, s.size * k), taperIn: (s.taperIn || 0) * k, taperOut: (s.taperOut || 0) * k, smudge: undefined, paint: undefined };
  const st = { s: ss, color, ctx: g, erase: false, box: newBox(), mbox: newBox(), travel: 0, tex: false };
  const pts = []; for (let i = 0; i <= 200; i++) { const t = i / 200; pts.push([20 + t * (W - 40), H / 2 + Math.sin(t * Math.PI * 2) * H * 0.2, Math.sin(Math.PI * t) * 0.9 + 0.1]); }
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let trav = 0, next = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0, p0] = pts[i - 1], [x1, y1, p1] = pts[i], d = Math.hypot(x1 - x0, y1 - y0);
    while (next <= d) {
      const t = next / d, pr = p0 + (p1 - p0) * t; st.travel = trav + next;
      st.outK = ss.taperOut && len - st.travel < ss.taperOut ? clamp((len - st.travel) / ss.taperOut, 0, 1) : null;
      try { stampAt1(st, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, pr); } catch (e) { return; }
      next += stepAt(st, pr);
    }
    next -= d; trav += d;
  }
}
/* small curve editor: drag points, click to add, double-click to remove */
function beCurve(host, pts, onChange) {
  const cv = document.createElement('canvas'); cv.width = 132; cv.height = 132; cv.className = 'becurve'; host.appendChild(cv);
  let P = (pts && pts.length >= 2 ? pts : [[0, 0], [1, 1]]).map(p => p.slice()), drag = -1;
  const g = cv.getContext('2d'), m = 8, S = 116;
  const draw = () => {
    g.clearRect(0, 0, 132, 132); g.strokeStyle = 'rgba(128,128,128,.35)'; g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(m + i * S / 4, m); g.lineTo(m + i * S / 4, m + S); g.moveTo(m, m + i * S / 4); g.lineTo(m + S, m + i * S / 4); g.stroke(); }
    g.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent') || '#3d8bfd'; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 60; i++) { const x = i / 60, y = prCurve(P, x); i ? g.lineTo(m + x * S, m + (1 - y) * S) : g.moveTo(m + x * S, m + (1 - y) * S); } g.stroke();
    g.fillStyle = '#fff'; g.strokeStyle = '#333'; for (const [x, y] of P) { g.beginPath(); g.arc(m + x * S, m + (1 - y) * S, 4, 0, 7); g.fill(); g.stroke(); }
  };
  const at = e => { const r = cv.getBoundingClientRect(); return [clamp(((e.clientX - r.left) * 132 / r.width - m) / S, 0, 1), clamp(1 - ((e.clientY - r.top) * 132 / r.height - m) / S, 0, 1)]; };
  const near = ([x, y]) => P.findIndex(p => Math.hypot(p[0] - x, p[1] - y) < 0.07);
  const emit = () => { const straight = P.length === 2 && P[0][0] === 0 && P[0][1] === 0 && P[1][0] === 1 && P[1][1] === 1; onChange(straight ? null : P.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)])); };
  cv.onpointerdown = e => { const q = at(e); drag = near(q); if (drag < 0) { P.push(q); P.sort((a, b) => a[0] - b[0]); drag = P.indexOf(q); } cv.setPointerCapture(e.pointerId); draw(); };
  cv.onpointermove = e => { if (drag < 0) return; const q = at(e), lo = drag > 0 ? P[drag - 1][0] : 0, hi = drag < P.length - 1 ? P[drag + 1][0] : 1;
    P[drag] = [drag === 0 ? 0 : drag === P.length - 1 ? 1 : clamp(q[0], lo + 0.01, hi - 0.01), q[1]]; draw(); };
  cv.onpointerup = () => { if (drag >= 0) emit(); drag = -1; };
  cv.ondblclick = e => { const i = near(at(e)); if (i > 0 && i < P.length - 1) { P.splice(i, 1); draw(); emit(); } };
  const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Straight'; reset.onclick = () => { P = [[0, 0], [1, 1]]; draw(); emit(); }; host.appendChild(reset);
  draw();
}
let beOpen = null;
async function openBrushEditor(id) {
  if (beOpen) return;
  const editing = id && TOOLDEF[id] && TOOLDEF[id].custom && kindOf(id) === 'brush' ? id : null;
  const base = id && TOOLDEF[id] && kindOf(id) === 'brush' ? beDefOf(id) : { ...BE_DEFAULT, group: ['pen', 'pencil', 'brush', 'airbrush', 'decor', 'shade', 'eraser', 'blend'].includes(state.group) ? state.group : 'brush' };
  const f = beFromDef(base), orig = editing ? JSON.parse(JSON.stringify(addons.brushes.find(b => b.id === editing) || {})) : null;
  const dlg = document.createElement('dialog'); dlg.className = 'brushedit'; beOpen = dlg;
  dlg.innerHTML = `<form method="dialog"><div class="behead"><h3>${editing ? 'Edit brush' : id && TOOLDEF[id] && kindOf(id) === 'brush' ? 'New brush from "' + TOOLDEF[id].name.replace(/[<&]/g, '') + '"' : 'Create a brush'}</h3>
    <canvas class="beprev" width="520" height="110"></canvas></div><div class="bebody"></div>
    <div class="dialog-actions"><button type="button" data-a="import">Open .sfbrush…</button><button type="button" data-a="export">Export .sfbrush</button><span style="flex:1"></span>
    <button type="button" data-a="cancel">Cancel</button>${editing ? '<button type="button" data-a="copy">Save as new</button>' : ''}<button type="button" data-a="save" class="primary">${editing ? 'Save' : 'Create brush'}</button></div></form>`;
  const body = dlg.querySelector('.bebody'), prev = dlg.querySelector('.beprev');
  const rep = (editing && TOOLDEF[editing].report) || base.report;
  if (rep && rep.length) { // an imported Clip Studio tool: show what it does differently, to tune it by eye
    const diff = rep.filter(r => r[0] !== 'ok'), n = { ok: 0, approx: 0, no: 0 }; rep.forEach(r => n[r[0]]++);
    const note = document.createElement('details'); note.className = 'bemsg'; note.open = diff.length > 0;
    note.innerHTML = `<summary>Imported from Clip Studio — ✓ ${n.ok} same · ≈ ${n.approx} close · ✗ ${n.no} not in Sketchforge yet</summary>` +
      (diff.length ? `<p>To make it look like in Clip Studio, compare with a stroke you made there and tune the settings below (the preview updates live). What is different:</p><ul>${diff.map(r => `<li>${r[0] === 'no' ? '✗' : '≈'} ${r[1].replace(/[<&]/g, '')}</li>`).join('')}</ul>` : '<p>Everything was translated. You can still change any setting.</p>');
    body.appendChild(note);
  }
  let tipIds = [], texId = null, gen = 0;
  const loadTips = async () => { // preview tips / texture under temporary ids
    const my = ++gen, srcs = f.tips && f.tips.length ? f.tips : f.tip ? [f.tip] : [], ids = [];
    for (let i = 0; i < srcs.length; i++) { try { const { tip, colour } = await makeTip(srcs[i], f.tipDensity); if (colour) tip._colour = true; customTips.set('__be' + i, tip); ids.push('__be' + i); } catch (e) { /* broken picture */ } }
    let tx = null; if (f.texSel === 'image' && f.texImg) { try { tx = registerTexture('__betex', await texImage(f), f.texInv); } catch (e) { /* broken picture */ } }
    if (my === gen) { tipIds = ids; texId = tx; redraw(); }
  };
  const redraw = () => { const def = beMerge(base, beToDef(f)); bePreview(prev, brushPreset(def, tipIds, texId), state.color === '#ffffff' ? '#202430' : state.color); };
  const fields = {};
  for (const [sec, list] of BE_FORM) {
    const box = document.createElement('details'); box.open = ['Brush', 'Size & ink', 'Tip shape', 'Pen pressure'].includes(sec);
    box.innerHTML = `<summary>${sec}</summary>`; const grid = document.createElement('div'); grid.className = 'begrid'; box.appendChild(grid); body.appendChild(box);
    for (const [key, label, type, ...o] of list) {
      const row = document.createElement('label'); row.className = 'berow be-' + type; row.dataset.k = key;
      row.innerHTML = `<span>${label}</span>`; grid.appendChild(row); fields[key] = row;
      if (type === 'text') { const i = document.createElement('input'); i.value = f[key] || ''; i.oninput = () => { f[key] = i.value; }; row.appendChild(i); }
      else if (type === 'check') { const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!f[key]; i.onchange = () => { f[key] = i.checked; if (key === 'tipDensity') loadTips(); else redraw(); }; row.prepend(i); }
      else if (type === 'select') { const sl = document.createElement('select'); sl.innerHTML = o[0].map(([v, n]) => `<option value="${v}">${n}</option>`).join(''); sl.value = String(f[key] ?? ''); sl.onchange = () => { f[key] = /^-?\d+$/.test(sl.value) && key === 'aa' ? +sl.value : sl.value; if (key === 'texSel') { if (sl.value === 'image' && !f.texImg) pickTex(); else loadTips(); } else redraw(); }; row.appendChild(sl); }
      else if (type === 'range') {
        const [mn, mx, step, unit] = o, i = document.createElement('input'), out = document.createElement('output'); i.type = 'range'; i.min = mn; i.max = mx; i.step = step;
        const val = f[key] ?? (key === 'count' ? 1 : 0); i.value = val; f[key] = +val;
        const show = v => { out.textContent = unit === '%' ? Math.round(v * 100) + '%' : unit === '×' ? (+v).toFixed(2) + '×' : (Math.round(v * 10) / 10) + (unit || ''); };
        show(i.value); i.oninput = () => { f[key] = +i.value; show(i.value); redraw(); };
        if (key === 'size') { i.max = Math.max(mx, Math.ceil(val)); }
        row.append(i, out);
      } else if (type === 'curve') { const h = document.createElement('div'); h.className = 'becurvebox'; row.appendChild(h); beCurve(h, f[key], c => { f[key] = c; redraw(); }); }
      else if (type === 'tipimg') {
        const h = document.createElement('div'); h.className = 'betips'; row.appendChild(h);
        const show = () => { const srcs = f.tips && f.tips.length ? f.tips : f.tip ? [f.tip] : []; h.innerHTML = srcs.map(s => `<img src="${s}">`).join('') || '<em>Round tip</em>'; };
        const add = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; row.appendChild(b); };
        add('Pictures…', () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
          inp.onchange = async () => { const urls = []; for (const fl of inp.files) urls.push(await readFile(fl)); if (urls.length) { f.tip = urls[0]; f.tips = urls.length > 1 ? urls : null; show(); loadTips(); } }; inp.click(); });
        add('From the layer', () => { const l = activeLayer(), c = l && celCanvas(l, state.frame), bb = c && celBBox(c); if (!bb) { toast('Draw the tip on the current layer first'); return; }
          const s = Math.max(bb.w, bb.h), t = makeCanvas(s, s); t.getContext('2d').drawImage(c, bb.x, bb.y, bb.w, bb.h, (s - bb.w) / 2, (s - bb.h) / 2, bb.w, bb.h);
          f.tip = t.toDataURL(); f.tips = null; f.tipDensity = false; fields.tipDensity.querySelector('input').checked = false; show(); loadTips(); });
        add('Round', () => { f.tip = null; f.tips = null; show(); loadTips(); });
        show();
      } else if (type === 'teximg') {
        const img = document.createElement('img'); img.className = 'betex'; const upd = () => { img.src = f.texImg || ''; img.hidden = !f.texImg; }; row.appendChild(img);
        const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Picture…'; b.onclick = () => pickTex(); row.appendChild(b); upd(); row._upd = upd;
      }
    }
  }
  const pickTex = () => pickFile('image/*', async fl => { f.texImg = await readFile(fl); f.texSel = 'image'; fields.texSel.querySelector('select').value = 'image'; fields.teximg._upd(); loadTips(); });
  const finish = () => { dlg.close(); dlg.remove(); beOpen = null; for (const k of [...customTips.keys()]) if (k.startsWith('__be')) customTips.delete(k); };
  const save = async asNew => {
    const def = beMerge(base, beToDef(f)); if (!def.name) def.name = 'My brush';
    if (editing && !asNew) def.id = editing; else delete def.report;
    const nid = await registerBrush(def, true);
    finish(); const g = groupOf(nid); if (g && g.id !== state.group) selectGroup(g.id); selectTool(nid); toast((editing && !asNew ? 'Saved ' : 'Created ') + def.name);
  };
  dlg.querySelector('[data-a=save]').onclick = () => save(false);
  if (editing) dlg.querySelector('[data-a=copy]').onclick = () => { f.name = (f.name || 'My brush') + ' copy'; save(true); };
  dlg.querySelector('[data-a=cancel]').onclick = finish;
  dlg.querySelector('[data-a=export]').onclick = () => { const { report, ...def } = beMerge(base, beToDef(f)); download(new Blob([JSON.stringify({ format: 'sketchforge-brush', version: 1, def })], { type: 'application/json' }), (def.name || 'brush').replace(/[^\w-]+/g, '_') + '.sfbrush'); };
  dlg.querySelector('[data-a=import]').onclick = () => pickFile('.sfbrush,.json', async fl => { try { const j = JSON.parse(await readFile(fl, true)); if (!j.def) throw 0; finish(); await importSfBrush(j.def); } catch (e) { toast('Not a Sketchforge brush file'); } });
  dlg.addEventListener('cancel', e => { e.preventDefault(); finish(); });
  document.body.appendChild(dlg); dlg.showModal();
  await loadTips();
}
async function importSfBrush(def) {
  const { id, report, ...d } = def;
  const nid = await registerBrush(d, true); const g = groupOf(nid); if (g) selectGroup(g.id); selectTool(nid); toast('Added the brush "' + (d.name || 'Brush') + '"');
  return nid;
}
function installBrushEditor() {
  IC.sliders = IC.sliders || '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>';
  Object.assign(CMD, { brushNew: () => openBrushEditor(null), brushEdit: () => openBrushEditor(state.tool) });
  const A = MENUS.find(m => m[0] === 'Add-ons');
  if (A && !A[1].some(x => Array.isArray(x) && x[1] === 'brushNew')) A[1].unshift(['Create a new brush…', 'brushNew'], ['Edit this brush (all settings)…', 'brushEdit'], '-');
  const bar = $('#subtoolBar');
  if (bar && !bar.querySelector('[data-ic=sliders]')) {
    const b = document.createElement('button'); b.dataset.ic = 'sliders'; b.innerHTML = icon('sliders'); b.title = 'Brush editor: create a brush, or change every setting of this one';
    b.onclick = () => popMenu(b.getBoundingClientRect().left, b.getBoundingClientRect().top - 90, [['Edit this brush (all settings)…', () => openBrushEditor(state.tool), kindOf(state.tool) !== 'brush'], ['Create a new brush…', () => openBrushEditor(null)], ['Open a brush file (.sfbrush)…', () => pickFile('.sfbrush,.json', async fl => { try { const j = JSON.parse(await readFile(fl, true)); await importSfBrush(j.def); } catch (e) { toast('Not a Sketchforge brush file'); } })]]);
    const ref = bar.querySelector('[data-ic=copy]'); bar.insertBefore(b, ref || bar.firstChild);
  }
  // Tool Property: a button to every setting of the current brush
  const rp = refreshProps;
  refreshProps = function () {
    rp.apply(this, arguments);
    if (kindOf(state.tool) !== 'brush') return;
    const body = $('#propBody');
    if (!body || body.querySelector('.beopen')) return;
    const b = document.createElement('button'); b.className = 'beopen'; b.type = 'button'; b.textContent = '⚙ All brush settings…'; b.onclick = () => openBrushEditor(state.tool); body.appendChild(b);
  };
}
