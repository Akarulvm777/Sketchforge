/* ---------- Advanced tool setup and stroke quality ----------
   • Tool Property › "Advanced" (folds open / closed, remembered): pressure curve, minimum size, thin start / end,
     fade, spacing (picture tips), tip rotation, colour change per dab, the tool's blending mode, and "Reset this tool".
     Every field writes straight to settings[tool] (the engine's keys), so it works for built-in and imported tools.
   • Quick setup: one click gives the tool a ready feel (crisp ink, soft sketch, painterly, airy).
   • Stroke quality (sketchforge.quality.v1): Fast / Normal / Best changes the distance between dabs (stepAt):
     Best = smoother, denser strokes; Fast = fewer dabs for slow devices. Mixing tools keep their own minimum. */
const QUALITY = { mode: 'normal' };
const QUALITY_STEP = { fast: 1.6, normal: 1, best: 0.55 };
const ADV_PRESETS = [
  ['✒ Crisp ink', { hardness: 1, aa: 2, pSize: true, pMin: 0.08, pCurve: [[0, 0], [0.45, 0.25], [1, 1]], taperIn: 30, taperOut: 40, smooth: 0.45, flow: 1, opacity: 1 }],
  ['✏ Soft sketch', { hardness: 0.55, aa: 2, pSize: true, pMin: 0.35, pAlpha: true, aMin: 0.2, smooth: 0.15, flow: 0.7, taperIn: 0, taperOut: 0 }],
  ['🖌 Painterly', { hardness: 0.75, pSize: true, pMin: 0.3, pAlpha: true, aMin: 0.4, smooth: 0.2, jitter: 0.15, valJit: 0.04, flow: 0.85 }],
  ['☁ Airy', { hardness: 0, pSize: false, pAlpha: true, aMin: 0.05, flow: 0.25, smooth: 0.3 }]
];
function qualityStep(v, direct) {
  const k = QUALITY_STEP[QUALITY.mode] || 1;
  if (direct) return k < 1 ? v * 0.8 : v; // mixing tools read pixels per dab: never denser than "a bit"
  return v * k;
}
function setQuality(m) {
  QUALITY.mode = QUALITY_STEP[m] ? m : 'normal';
  try { localStorage.setItem('sketchforge.quality.v1', QUALITY.mode); } catch (e) { /* ignore */ }
}
function advOpen(v) {
  try { if (v == null) return localStorage.getItem('sketchforge.tooladv.v1') === '1'; localStorage.setItem('sketchforge.tooladv.v1', v ? '1' : ''); } catch (e) { /* ignore */ }
  return !!v;
}
/* apply a quick setup to a settings object (only the keys of the preset; the rest of the tool is kept) */
function advApplyPreset(s, preset) {
  for (const [k, v] of Object.entries(preset)) s[k] = Array.isArray(v) ? v.map(p => p.slice()) : v;
  return s;
}
function advResetTool(id) {
  const def = TOOLDEF[id]; if (!def || !def.preset) return false;
  const keep = settings[id] && settings[id].size;
  settings[id] = { ...def.preset };
  if (keep != null && def.preset.size == null) settings[id].size = keep;
  return true;
}
function advSection(body, id, s) {
  const head = document.createElement('button'); head.type = 'button'; head.className = 'advhead';
  const open = advOpen();
  head.textContent = (open ? '▾ ' : '▸ ') + 'Advanced setup';
  head.onclick = () => { advOpen(!advOpen()); refreshProps(); };
  body.appendChild(head);
  if (!open) return;
  const box = document.createElement('div'); box.className = 'advbox'; body.appendChild(box);
  grp(box, 'Quick setup');
  btns(box, ADV_PRESETS.map(([t, p]) => [t, () => { advApplyPreset(s, p); renderSubTools(); refreshProps(); toast(`${t.slice(2)}: set. Change anything below to taste.`); }]));
  grp(box, 'Pressure curve (size)');
  checkbox(box, 'Pen pressure changes the size', !!s.pSize, v => { s.pSize = v; refreshProps(); });
  if (s.pSize) {
    slider(box, 'Minimum size', 0, 100, 1, (s.pMin ?? 0.12) * 100, v => v + '%', v => s.pMin = v / 100);
    if (typeof beCurve === 'function') { const h = document.createElement('div'); h.className = 'advcurve'; box.appendChild(h); beCurve(h, s.pCurve, pts => { s.pCurve = pts; }); hint(box, 'Drag the points: lower curve = you need to press harder.'); }
  }
  checkbox(box, 'Pen pressure changes the opacity', !!s.pAlpha, v => { s.pAlpha = v; refreshProps(); });
  if (s.pAlpha) slider(box, 'Minimum opacity', 0, 100, 1, (s.aMin ?? 0.1) * 100, v => v + '%', v => s.aMin = v / 100);
  grp(box, 'Start & end of the stroke');
  slider(box, 'Thin start', 0, 400, 1, s.taperIn || 0, v => v + 'px', v => s.taperIn = v);
  slider(box, 'Thin end', 0, 400, 1, s.taperOut || 0, v => v + 'px', v => s.taperOut = v);
  checkbox(box, 'Fade in', !!s.fadeIn, v => s.fadeIn = v);
  checkbox(box, 'Fade out', !!s.fadeOut, v => s.fadeOut = v);
  if (s.tipId) {
    grp(box, 'Tip');
    slider(box, 'Spacing', 2, 300, 1, (s.spacing || 0.15) * 100, v => v + '%', v => s.spacing = v / 100);
    slider(box, 'Random rotation', 0, 100, 1, s.tipRot ? (s.tipRotAmt ?? 1) * 100 : 0, v => v + '%', v => { s.tipRot = v > 0; s.tipRotAmt = v / 100; });
    checkbox(box, 'Tip turns with the stroke', !!s.tipFollow, v => s.tipFollow = v);
  }
  grp(box, 'Colour change per dab');
  slider(box, 'Hue', 0, 100, 1, (s.hueJit || 0) * 100, v => v + '%', v => s.hueJit = v / 100);
  slider(box, 'Saturation', 0, 100, 1, (s.satJit || 0) * 100, v => v + '%', v => s.satJit = v / 100);
  slider(box, 'Brightness', 0, 100, 1, (s.valJit || 0) * 100, v => v + '%', v => s.valJit = v / 100);
  if (!TOOLDEF[id].erase && s.smudge == null && typeof BE_BLEND !== 'undefined') {
    const row = document.createElement('label'); row.className = 'select'; row.innerHTML = '<span>Blending</span>';
    const sel = document.createElement('select');
    for (const [v, t] of BE_BLEND) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
    sel.value = s.blendOp || ''; sel.onchange = () => { s.blendOp = sel.value || undefined; }; row.appendChild(sel); box.appendChild(row);
  }
  grp(box, 'Stroke quality (all tools)');
  seg(box, [['fast', 'Fast'], ['normal', 'Normal'], ['best', 'Best']], QUALITY.mode, v => { setQuality(v); refreshProps(); });
  hint(box, QUALITY.mode === 'best' ? 'Best: smoother edges, more dabs (slower on old tablets).' : QUALITY.mode === 'fast' ? 'Fast: fewer dabs, for slow devices.' : 'Normal: the usual balance of speed and smoothness.');
  btns(box, [['↺ Reset this tool', () => { if (advResetTool(id)) { renderSubTools(); refreshProps(); toast('Tool back to its first settings'); } else toast('This tool has no first settings to go back to'); }]]);
}
/* pen pressure on every built-in tool: blend tools blend harder when you press harder, thick paints cover more, the
   snap eraser gets thinner with a light touch (the other tools already follow pressure) */
const PRESSURE_FIX = { blend: { pAlpha: true, aMin: 0.15 }, finger: { pAlpha: true, aMin: 0.15 }, blurtool: { pAlpha: true, aMin: 0.2 },
  gouache: { pAlpha: true, aMin: 0.35 }, acrylic: { pAlpha: true, aMin: 0.35 }, impasto: { pAlpha: true, aMin: 0.4 }, snapera: { pSize: true, pMin: 0.4 } };
function applyPressureFix() {
  for (const [id, fix] of Object.entries(PRESSURE_FIX)) { if (TOOLDEF[id] && TOOLDEF[id].preset) Object.assign(TOOLDEF[id].preset, fix); if (settings[id]) Object.assign(settings[id], fix); }
}
function installToolAdvanced() {
  applyPressureFix();
  try { const q = localStorage.getItem('sketchforge.quality.v1'); if (QUALITY_STEP[q]) QUALITY.mode = q; } catch (e) { /* ignore */ }
  const s0 = stepAt;
  stepAt = function (st, pr) { return qualityStep(s0(st, pr), st.direct); };
  const r0 = refreshProps;
  refreshProps = function () {
    const out = r0.apply(this, arguments);
    const body = $('#propBody'), id = state.tool, s = settings[id];
    if (!body || !s || kindOf(id) !== 'brush' || TOOLDEF[id].props) return out;
    advSection(body, id, s);
    return out;
  };
}
