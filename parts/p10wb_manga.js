/* ---------- Manga tone & shading pens ----------
   Tone brushes paint a screen-tone pattern (dots, lines, cross-hatch, sand) where you brush. The pattern is fixed to
   the page like a real tone sheet (it uses the stroke texture system: stroke × pattern, see texSync in p04), so
   strokes that overlap never double the dots. Shading pens: shadow pen (solid blacks), hatching / cross-hatching
   brushes and a stipple pen. Patterns are tiles of TEX_N px (256), so every period divides 256. */
const TONES = {
  tone_dot10: { kind: 'dot', s: 8, c: 0.10 }, tone_dot20: { kind: 'dot', s: 8, c: 0.20 }, tone_dot30: { kind: 'dot', s: 8, c: 0.30 },
  tone_dot50: { kind: 'dot', s: 8, c: 0.50 }, tone_dotfine: { kind: 'dot', s: 4, c: 0.30 }, tone_dotbig: { kind: 'dot', s: 16, c: 0.35 },
  tone_line: { kind: 'diag', p: 8, c: 0.30 }, tone_hline: { kind: 'hline', p: 8, c: 0.30 }, tone_cross: { kind: 'cross', p: 8, c: 0.22 },
  tone_sand: { kind: 'sand', c: 0.22 }, tone_hatch: { kind: 'diag', p: 4, c: 0.28 }, tone_xhatch: { kind: 'cross', p: 4, c: 0.2 }
};
/* fills v (TEX_N × TEX_N, 0..1 = how much paint shows) for a tone id; called by texBaseFor in p04 */
function toneTexture(id, v, N) {
  const t = TONES[id]; if (!t) return false;
  const band = (u, w) => clamp(w / 2 - Math.abs(u) + 0.5, 0, 1); // anti-aliased stripe of width w around u = 0
  let sd = 987654321; const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 0;
    if (t.kind === 'dot') { // 45° dot screen: a square lattice plus the centres between them
      const s = t.s, r = s * Math.sqrt(t.c / (2 * Math.PI));
      const d1 = Math.hypot(((x + s / 2) % s) - s / 2, ((y + s / 2) % s) - s / 2), d2 = Math.hypot((x % s) - s / 2, (y % s) - s / 2);
      a = clamp(r - Math.min(d1, d2) + 0.5, 0, 1);
    } else if (t.kind === 'diag' || t.kind === 'cross') {
      const p = t.p, w = Math.max(0.8, t.c * p), u1 = ((x + y) % p + p) % p, u2 = ((x - y) % p + p) % p;
      a = band(Math.min(u1, p - u1), w);
      if (t.kind === 'cross') a = Math.max(a, band(Math.min(u2, p - u2), w));
    } else if (t.kind === 'hline') {
      const p = t.p, u = y % p; a = band(Math.min(u, p - u), Math.max(0.8, t.c * p));
    } else if (t.kind === 'sand') a = rnd() < t.c ? 1 : 0;
    v[y * N + x] = a;
  }
  return true;
}
function registerManga() {
  IC.tone = '<circle cx="6" cy="6" r="1.4"/><circle cx="12" cy="6" r="1.4"/><circle cx="18" cy="6" r="1.4"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="6" cy="18" r="2.6"/><circle cx="12" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/>';
  IC.shade = '<path d="M4 20L20 4"/><path d="M4 14L14 4M10 20L20 10"/><path d="M4 8l4-4M16 20l4-4"/>';
  const tone = (name, tex, size) => ({ name, kind: 'brush', icon: 'tone', preset: P(size || 60, 1, 1, 1, false, false, 0.1, { tex, texAmt: 1 }) });
  Object.assign(TOOLDEF, {
    tone10: tone('Dot tone 10%', 'tone_dot10'), tone20: tone('Dot tone 20%', 'tone_dot20'), tone30: tone('Dot tone 30%', 'tone_dot30'),
    tone50: tone('Dot tone 50%', 'tone_dot50'), tonefine: tone('Fine dot tone', 'tone_dotfine'), tonebig: tone('Big dot tone', 'tone_dotbig'),
    toneline: tone('Line tone', 'tone_line'), tonehline: tone('Horizontal line tone', 'tone_hline'), tonecross: tone('Cross-hatch tone', 'tone_cross'),
    tonesand: tone('Sand tone', 'tone_sand'),
    toneera: { name: 'Tone eraser', kind: 'brush', icon: 'eraser', erase: true, preset: P(60, 0.95, 1, 1, false, false, 0.1) },
    shadowpen: { name: 'Shadow pen (solid black)', kind: 'brush', icon: 'shade', preset: P(28, 1, 1, 1, true, false, 0.25) },
    hatchbrush: tone('Hatching brush', 'tone_hatch', 36),
    xhatchbrush: tone('Cross-hatching brush', 'tone_xhatch', 36),
    stipple: { name: 'Stipple pen', kind: 'brush', icon: 'shade', preset: P(3, 1, 1, 1, false, false, 0, { scatter: 5, count: 2, jitter: 0.5 }) }
  });
  for (const k of ['hatchbrush', 'xhatchbrush']) TOOLDEF[k].icon = 'shade';
  for (const k of ['tone10', 'tone20', 'tone30', 'tone50', 'tonefine', 'tonebig', 'toneline', 'tonehline', 'tonecross', 'tonesand', 'toneera', 'shadowpen', 'hatchbrush', 'xhatchbrush', 'stipple'])
    settings[k] = { ...TOOLDEF[k].preset };
  const dots = ['tone10', 'tone20', 'tone30', 'tone50', 'tonefine', 'tonebig'], lines = ['toneline', 'tonehline', 'tonecross'], other = ['tonesand', 'toneera'];
  const shade = ['shadowpen', 'hatchbrush', 'xhatchbrush', 'stipple'];
  const at = GROUPS.findIndex(g => g.id === 'decor') + 1;
  GROUPS.splice(at, 0,
    { id: 'tone', name: 'Manga tone', key: '', icon: 'tone', subs: [...dots, ...lines, ...other], tabs: [['Dots', dots], ['Lines', lines], ['Other', other]] },
    { id: 'shade', name: 'Shading pens', key: '', icon: 'shade', subs: shade });
}
