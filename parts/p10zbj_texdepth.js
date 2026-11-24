/* ---------- brush textures, more control (3.7) ----------
   - Press harder = less grain now works on whole-stroke textures too (before: only "on each dab"). While drawing, a
     small pressure map (TD_CELL px per cell) keeps the strongest pressure that touched each spot (tdStamp, pure);
     texSync then shows texture + (1 − texture) × pressure × texPress (tdAlpha, pure), so light touches keep the grain
     and heavy ones fill it in.
   - Grows with the brush size (texSizeLink): the texture scale follows the size, compared with the size it had when
     the box was ticked (texRefSize) — a big brush gets a big grain (tdLinkScale, pure).
   - Second texture (tex2, tex2Amt, tex2Scale): another texture multiplied on the whole stroke (e.g. canvas weave +
     fine noise). Also with "on each dab": then the first one is per dab and the second on the stroke.
   - Live preview: Tool Property › Texture shows a sample stroke drawn with the real brush and the texture settings
     (texPreview), redrawn when a setting moves.
   texSync is wrapped: the original stays for erasers and plain textures; the new path composes the textures in a
   small canvas the size of the changed area (tdCompose), never a full page. */
const TD_CELL = 4;
/* pure: the visible amount of paint for texture value t (0..1), pressure p and "press harder" k */
const tdAlpha = (t, p, k) => t + (1 - t) * clamp(p, 0, 1) * clamp(k, 0, 1);
/* pure: keep the highest pressure v inside a circle (cx, cy, r in cells) of the W × H map */
function tdStamp(map, W, H, cx, cy, r, v) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r)), r2 = r * r;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r2 + 0.5) { const i = y * W + x; if (map[i] < v) map[i] = v; } }
}
/* pure: texture scale when it grows with the brush */
const tdLinkScale = (scale, size, ref) => (scale || 1) * (ref > 0 && size > 0 ? clamp(size / ref, 0.1, 20) : 1);
let tdTmp = null, tdPm = null;
const tdCanvas = (c, w, h) => { if (!c || c.width < w || c.height < h) return makeCanvas(Math.max(w, c ? c.width : 0), Math.max(h, c ? c.height : 0)); return c; };
/* a pattern for texture id with its scale / rotation, placed for a canvas whose (0, 0) is page point (ox, oy) */
function tdPattern(g, cv, scale, rot, ox, oy) {
  const p = g.createPattern(cv, 'repeat');
  if (p.setTransform) { let m = new DOMMatrix().translateSelf(-ox, -oy); if (rot) m = m.rotateSelf(rot); p.setTransform(m.scaleSelf(scale || 1, scale || 1)); }
  return p;
}
/* the mask of the textures for the page area b (alpha = how much paint shows), in tdTmp */
function tdCompose(b, s, pm) {
  tdTmp = tdCanvas(tdTmp, b.w, b.h);
  const g = tdTmp.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'copy';
  if (s.tex && !s._tex2Only) { g.fillStyle = tdPattern(g, texFor(s.tex, s.texAmt == null ? 0.6 : s.texAmt), s.texScale, s.texRot, b.x, b.y); g.fillRect(0, 0, b.w, b.h); }
  else { g.fillStyle = '#000'; g.fillRect(0, 0, b.w, b.h); }
  g.globalCompositeOperation = 'source-over';
  if (pm && s.texPress > 0 && !s.texDab) { // pressure fills the grain in: alpha = t + (1 − t) × p × k
    const cx0 = Math.floor(b.x / TD_CELL), cy0 = Math.floor(b.y / TD_CELL), cx1 = Math.min(pm.W, Math.ceil((b.x + b.w) / TD_CELL) + 1), cy1 = Math.min(pm.H, Math.ceil((b.y + b.h) / TD_CELL) + 1), cw = cx1 - cx0, ch = cy1 - cy0;
    if (cw > 0 && ch > 0) {
      tdPm = tdCanvas(tdPm, cw, ch);
      const pg = tdPm.getContext('2d'), im = pg.createImageData(cw, ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) im.data[(y * cw + x) * 4 + 3] = pm.map[(cy0 + y) * pm.W + cx0 + x] * 255;
      pg.putImageData(im, 0, 0);
      g.globalAlpha = clamp(s.texPress, 0, 1); g.imageSmoothingEnabled = true;
      g.drawImage(tdPm, 0, 0, cw, ch, cx0 * TD_CELL - b.x, cy0 * TD_CELL - b.y, cw * TD_CELL, ch * TD_CELL);
      g.globalAlpha = 1;
    }
  }
  if (s.tex2) { g.globalCompositeOperation = 'destination-in'; g.fillStyle = tdPattern(g, texFor(s.tex2, s.tex2Amt == null ? 0.6 : s.tex2Amt), s.tex2Scale, 0, b.x, b.y); g.fillRect(0, 0, b.w, b.h); g.globalCompositeOperation = 'source-over'; }
  return tdTmp;
}
const tdNeeded = (st) => !st.erase && (st.s.tex2 || (st.s.texPress > 0 && !st.s.texDab));
/* a sample stroke with the brush and its texture settings (Tool Property) */
function texPreview(cv, s0) {
  const s = { ...s0 }; paperGrain(s, false, false, false);
  const W = cv.width, H = cv.height, g = cv.getContext('2d');
  const raw = makeCanvas(W, H), plain = { ...s, tex: undefined, tex2: undefined, _tex2Only: undefined }; // a dab texture (texDab) is drawn by the dabs themselves
  bePreview(raw, plain, '#222');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  if (!(s.tex && !s._tex2Only && !s.texDab) && !s.tex2) { g.drawImage(raw, 0, 0); return cv; }
  // the pressure along bePreview's path (it presses in the middle of the wave)
  const pm = { W: Math.ceil(W / TD_CELL) + 1, H: Math.ceil(H / TD_CELL) + 1 }; pm.map = new Float32Array(pm.W * pm.H);
  for (let i = 0; i <= 200; i++) { const t = i / 200, x = 20 + t * (W - 40), y = H / 2 + Math.sin(t * Math.PI * 2) * H * 0.2; tdStamp(pm.map, pm.W, pm.H, x / TD_CELL, y / TD_CELL, H * 0.3 / TD_CELL, Math.sin(Math.PI * t) * 0.9 + 0.1); }
  const m = tdCompose({ x: 0, y: 0, w: W, h: H }, s, pm), o = makeCanvas(W, H), og = o.getContext('2d');
  og.drawImage(raw, 0, 0); og.globalCompositeOperation = 'destination-in'; og.drawImage(m, 0, 0, W, H, 0, 0, W, H);
  g.drawImage(o, 0, 0); return cv;
}
function installTexDepth() {
  for (const k of ['texSizeLink', 'texRefSize', 'tex2', 'tex2Amt', 'tex2Scale']) if (!BRUSH_KEYS.includes(k)) BRUSH_KEYS.push(k);
  const sec = BE_FORM.find(x => x[0] === 'Texture');
  if (sec && !sec[1].some(f => f[0] === 'tex2')) {
    const pf = sec[1].find(f => f[0] === 'texPress'); if (pf) pf[1] = 'Press harder = less grain';
    sec[1].push(['texSizeLink', 'Texture grows with the brush size', 'check'], ['tex2', 'Second texture', 'select', [['', 'None'], ...TEX_ALL]], ['tex2Amt', 'Second texture strength', 'range', 0, 1, 0.01, '%'], ['tex2Scale', 'Second texture scale', 'range', 0.1, 8, 0.05, '×']);
  }
  for (const k of ['texSizeLink', 'tex2', 'tex2Amt', 'tex2Scale']) BE_MANAGED.add(k);
  // each stroke's own copy of the settings
  const pg0 = paperGrain; paperGrain = function (s) {
    const out = pg0.apply(this, arguments);
    if (s.texSizeLink && (s.tex || s.texDab)) s.texScale = tdLinkScale(s.texScale, s.size, s.texRefSize || s.size);
    if (s.tex2 && s.texSizeLink) s.tex2Scale = tdLinkScale(s.tex2Scale, s.size, s.texRefSize || s.size);
    if (s.tex2 && !s.tex) { s.tex = s.tex2; s._tex2Only = true; } // dab texture (or none) + a second one on the whole stroke
    return out;
  };
  // the pressure map of a stroke (whole-stroke texture + "press harder")
  const d0 = drawOne; drawOne = function (st, x, y, d) {
    const out = d0.apply(this, arguments);
    if (st.tex && !st.erase && st.s.texPress > 0 && !st.s.texDab && st.t) {
      if (!st.pm) { const W = Math.ceil(state.w / TD_CELL) + 1, H = Math.ceil(state.h / TD_CELL) + 1; st.pm = { W, H, map: new Float32Array(W * H) }; }
      const m = st.ctx.getTransform(), px = m.a * x + m.c * y + m.e, py = m.b * x + m.d * y + m.f; // symmetry draws through the context
      tdStamp(st.pm.map, st.pm.W, st.pm.H, px / TD_CELL, py / TD_CELL, Math.max(0.5, d / 2 / TD_CELL), st.lastPr ?? st.lp ?? 0.5);
    }
    return out;
  };
  const ts0 = texSync; texSync = function (st, b) {
    if (!tdNeeded(st)) return ts0.apply(this, arguments);
    const m = tdCompose(b, st.s, st.pm);
    bufCtx.save();
    bufCtx.beginPath(); bufCtx.rect(b.x, b.y, b.w, b.h); bufCtx.clip(); // destination-in would clear the rest of the stroke
    bufCtx.globalCompositeOperation = 'source-over'; bufCtx.clearRect(b.x, b.y, b.w, b.h);
    bufCtx.drawImage(rawCanvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    bufCtx.globalCompositeOperation = 'destination-in'; bufCtx.drawImage(m, 0, 0, b.w, b.h, b.x, b.y, b.w, b.h);
    if (st.clip) bufCtx.drawImage(st.clip, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    bufCtx.restore();
  };
  // Tool Property › Texture: live preview, size link, second texture
  hookAfter('refreshProps', () => {
    if (kindOf(state.tool) !== 'brush') return;
    const body = $('#propBody'), s = settings[state.tool], box = body && body.querySelector('.texplus'); if (!box || !s) return;
    const pv = document.createElement('canvas'); pv.width = 240; pv.height = 56; pv.className = 'texpreview'; pv.title = 'Preview: a stroke with this brush, light → hard → light';
    box.insertBefore(pv, box.firstChild);
    let tm = 0; const redraw = () => { clearTimeout(tm); tm = setTimeout(() => { try { texPreview(pv, s); } catch (e) { console.warn('texture preview', e); } }, 60); };
    const more = document.createElement('div'); box.appendChild(more);
    checkbox(more, 'Grows with the brush size', !!s.texSizeLink, v => { s.texSizeLink = v; s.texRefSize = v ? s.size : undefined; redraw(); });
    const lab = document.createElement('label'); lab.className = 'select'; lab.innerHTML = '<span>Second texture</span>';
    const sel = document.createElement('select'); sel.innerHTML = `<option value="">None</option>` + TEX_ALL.map(([v, t]) => `<option value="${v}">${escHtml(t)}</option>`).join('');
    sel.value = s.tex2 || ''; sel.onchange = () => { s.tex2 = sel.value || undefined; refreshProps(); };
    lab.appendChild(sel); more.appendChild(lab);
    if (s.tex2) {
      slider(more, 'Second strength', 0, 100, 1, Math.round((s.tex2Amt ?? 0.6) * 100), v => v + '%', v => { s.tex2Amt = v / 100; redraw(); });
      slider(more, 'Second scale', 10, 800, 5, Math.round((s.tex2Scale || 1) * 100), v => v + '%', v => { s.tex2Scale = v / 100; redraw(); });
    }
    body.addEventListener('input', redraw); body.addEventListener('change', redraw);
    redraw();
  }, 16);
}
