/* ---------- Smart colouring: close gaps, and auto-flat colours ----------
   • Close gaps (state.fillGap, px; Fill › Tool Property): the fill stops at small gaps in the line art. The lines are
     thickened by half the gap only to find the area (floodGapMask), then the fill grows back up to the real lines,
     so it touches them with no white halo.
   • Auto-flat colours (Edit / Layer / Fill tool): every closed area of the line art gets its own flat colour on a new
     "Flats" layer under the lines (flatLabels: areas found with the same gap closing, then each colour grows under the
     line edges so no white seams remain). The outside of the drawing (areas touching the page border) is skipped.
   The lines come from the reference layers when there are any (Layer › Reference layer), else from the active layer. */
/* distance (in px, chamfer 3-4) from every pixel to the nearest wall pixel, capped at cap (pure) */
function wallDistance(wall, w, h, cap = 250) {
  const D = new Uint16Array(w * h), C = cap * 3;
  for (let i = 0; i < D.length; i++) D[i] = wall[i] ? 0 : C;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let d = D[i]; if (!d) continue;
    if (x > 0) d = Math.min(d, D[i - 1] + 3);
    if (y > 0) { d = Math.min(d, D[i - w] + 3); if (x > 0) d = Math.min(d, D[i - w - 1] + 4); if (x < w - 1) d = Math.min(d, D[i - w + 1] + 4); }
    D[i] = d;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let d = D[i]; if (!d) continue;
    if (x < w - 1) d = Math.min(d, D[i + 1] + 3);
    if (y < h - 1) { d = Math.min(d, D[i + w] + 3); if (x < w - 1) d = Math.min(d, D[i + w + 1] + 4); if (x > 0) d = Math.min(d, D[i + w - 1] + 4); }
    D[i] = d;
  }
  const out = new Uint8Array(w * h); for (let i = 0; i < D.length; i++) out[i] = Math.min(255, Math.round(D[i] / 3));
  return out;
}
/* grow labels (or a 0/1 mask) by up to `steps` px into pixels where ok(i) is true (4-neighbour BFS, pure) */
function growLabels(lab, w, h, steps, ok) {
  let front = []; for (let i = 0; i < lab.length; i++) if (lab[i]) { const x = i % w; if ((x > 0 && !lab[i - 1]) || (x < w - 1 && !lab[i + 1]) || (i >= w && !lab[i - w]) || (i < lab.length - w && !lab[i + w])) front.push(i); }
  for (let s = 0; s < steps && front.length; s++) {
    const nx = [];
    for (const i of front) { const x = i % w, v = lab[i];
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < lab.length && !lab[j] && ok(j)) { lab[j] = v; nx.push(j); } }
    front = nx;
  }
  return lab;
}
/* flood fill that stops at gaps up to `gap` px wide (same result as floodMask when gap = 0) */
function floodGapMask(data, w, h, sx, sy, tolPct, gap) {
  const i0 = (sy * w + sx) * 4, tr = data[i0], tg = data[i0 + 1], tb = data[i0 + 2], ta = data[i0 + 3], tol = tolPct * 2.55;
  const wall = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < wall.length; i++, j += 4) wall[i] = (Math.abs(data[j] - tr) > tol || Math.abs(data[j + 1] - tg) > tol || Math.abs(data[j + 2] - tb) > tol || Math.abs(data[j + 3] - ta) > tol) ? 1 : 0;
  const r = Math.ceil(gap / 2), dist = wallDistance(wall, w, h, r + 2);
  if (dist[sy * w + sx] <= r) return null; // clicked inside a gap: the plain fill decides
  // the area with the gaps closed
  const mask = new Uint8Array(w * h), st = [sy * w + sx]; mask[st[0]] = 1;
  while (st.length) { const i = st.pop(), x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < mask.length && !mask[j] && dist[j] > r) { mask[j] = 1; st.push(j); } }
  // back out to the real lines (not through them)
  growLabels(mask, w, h, r + 1, j => !wall[j]);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { const x = i % w, y = (i - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { mask, bb: { x0, y0, x1, y1 } };
}
/* every closed area of the lines (isLine: 0/1 per pixel) → a label per pixel; areas touching the border are 0
   when skipOutside; tiny areas (< minArea) are 0; labels then grow under the line edges (pure) */
function flatLabels(isLine, w, h, gap = 4, minArea = 30, skipOutside = true, under = 3) {
  const r = Math.ceil(gap / 2), dist = wallDistance(isLine, w, h, r + 2), lab = new Int32Array(w * h);
  let n = 0;
  for (let s = 0; s < lab.length; s++) {
    if (lab[s] || dist[s] <= r) continue;
    n++; const st = [s], px = []; lab[s] = n; let border = false;
    while (st.length) { const i = st.pop(), x = i % w; px.push(i); if (x === 0 || x === w - 1 || i < w || i >= lab.length - w) border = true;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < lab.length && !lab[j] && dist[j] > r) { lab[j] = n; st.push(j); } }
    if ((skipOutside && border) || px.length < minArea) { for (const i of px) lab[i] = -1; }
  }
  for (let i = 0; i < lab.length; i++) if (lab[i] < 0) lab[i] = 0;
  growLabels(lab, w, h, r + 1, j => !isLine[j] && dist[j] <= r);  // into the closed gaps' margin
  growLabels(lab, w, h, under, () => true);                          // a little under the lines: no white seams
  return { labels: lab, n };
}
const flatColour = k => { const hue = (k * 137.508) % 360; return hslToHex(hue, 55, 72); };
function hslToHex(hh, ss, ll) {
  const s = ss / 100, l = ll / 100, k = n => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
/* the line art as 0/1 per pixel: reference layers if any, else the active layer */
function lineArtMask() {
  const w = state.w, h = state.h;
  const hasRef = state.layers.some(l => l.ref && l.visible);
  let src;
  if (hasRef) src = compositeFrame(state.frame, { onlyRef: true });
  else { const l = activeLayer(); const c = l && celCanvas(l, state.frame); if (!c || l.paper) return null; src = c; }
  const d = src.getContext('2d').getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < m.length; i++, j += 4) { const a = d[j + 3], lum = d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11; m[i] = a > 96 && lum < 200 ? 1 : 0; }
  return m;
}
function autoFlat() {
  const lineL = activeLayer();
  const m = lineArtMask();
  if (!m || !m.some(v => v)) { toast('Pick the layer with your line art first (or make it a reference layer)'); return; }
  toast('Finding the closed areas…', 1500);
  setTimeout(() => {
    const w = state.w, h = state.h, { labels, n } = flatLabels(m, w, h, state.fillGap || 4, Math.max(30, Math.round(w * h / 200000)));
    if (!n) { toast('No closed area found: close the lines or raise "Close gaps"'); return; }
    const c = makeCel(true), g = c.getContext('2d'), im = g.createImageData(w, h), D = im.data, cols = [];
    for (let i = 0, j = 0; i < labels.length; i++, j += 4) { const k = labels[i]; if (!k) continue; const col = cols[k] || (cols[k] = hexToRgb(flatColour(k))); D[j] = col[0]; D[j + 1] = col[1]; D[j + 2] = col[2]; D[j + 3] = 255; }
    g.putImageData(im, 0, 0); c._sv = 1;
    timelineOp(() => {
      const l = createLayer('Flats'); l.cels = new Map([[state.frame, c]]);
      const at = Math.max(1, state.layers.indexOf(lineL)); // under the lines (above the paper)
      insertLayerAt(l, at); state.activeId = l.id;
    });
    refreshAll();
    const used = cols.filter(Boolean).length;
    toast(`Auto-flat: ${used} areas, each with its own colour, on the "Flats" layer under your lines. Fill over them with your real colours (Fill: this layer).`, 6000);
  }, 30);
}
function installSmartFill() {
  if (state.fillGap == null) state.fillGap = 3;
  const fm0 = floodMask;
  floodMask = function (data, w, h, sx, sy, tol) { if (state.fillGap > 0) { const r = floodGapMask(data, w, h, sx, sy, tol, state.fillGap); if (r) return r; } return fm0.apply(this, arguments); };
  CMD.autoFlat = autoFlat;
  const E = MENUS.find(m => m[0] === 'Edit'); if (E) E[1].push('-', ['🎨 Auto-flat colours (one colour per area)', 'autoFlat']);
  const L = MENUS.find(m => m[0] === 'Layer'); if (L) L[1].push('-', ['🎨 Auto-flat colours…', 'autoFlat']);
  hookAfter('refreshProps', () => {
    if (kindOf(state.tool) !== 'fill') return;
    const body = $('#propBody'); if (!body) return;
    grp(body, 'Smart colouring');
    slider(body, 'Close gaps', 0, 20, 1, state.fillGap || 0, v => v ? v + 'px' : 'off', v => state.fillGap = v);
    hint(body, 'The fill stops at gaps up to this size in your lines.');
    btns(body, [['🎨 Auto-flat colours', autoFlat]]);
    hint(body, 'One flat colour per closed area, on a new layer under your lines. Uses the reference layers, or the active layer.');
  });
}
