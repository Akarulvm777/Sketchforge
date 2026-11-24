/* ---------- big pages: the stroke being drawn is shown in small tiles (3.8) ----------
   The stroke buffer (bufCanvas) is as big as the page. When it is on screen, every pen movement makes the browser
   send the whole buffer to the screen again (2894 × 4093 = 47 MB per frame on phones / software compositing: ~11
   frames per second, the "lag" of big pages). Like the mixing brushes (mirOverlay, p10w), a normal stroke on a big
   page now shows its changed area in 512 px tile canvases laid over the page (same place, transform, opacity and
   blend as the buffer); the buffer itself is hidden while the stroke lasts and the result is the same pixels.
   Only the parts touched since the last frame are copied (BUFT.dirty, from each move's area: afterMove wrapped);
   at the end of the stroke the tiles go away and the stroke is committed as before (endStroke). */
const BUFT_T = 512, BUFT_MIN = 1.5e6;
const BUFT = { st: null, el: null, tiles: new Map(), dirty: null, raf: 0, on: true };
/* pure: the tile keys [tx, ty] covering the rectangle (x, y, w, h) of a W × H page */
function buftTiles(x, y, w, h, W, H, T = BUFT_T) {
  const out = [], x0 = Math.max(0, Math.floor(x / T)), y0 = Math.max(0, Math.floor(y / T)), x1 = Math.min(Math.ceil(W / T) - 1, Math.floor((x + w - 1) / T)), y1 = Math.min(Math.ceil(H / T) - 1, Math.floor((y + h - 1) / T));
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) out.push([tx, ty]);
  return out;
}
const buftWanted = st => BUFT.on && st && !st.isShape && !st.erase && !st.direct && bufCanvas.width * bufCanvas.height >= BUFT_MIN && bufCanvas.parentNode === stage;
function buftStart(st) {
  buftStop();
  const cs = bufCanvas.style, el = document.createElement('div'); el.className = 'buf-tiles';
  el.style.cssText = `position:absolute;left:0;top:0;width:${bufCanvas.width}px;height:${bufCanvas.height}px;pointer-events:none;transform-origin:${cs.transformOrigin || '0 0'};transform:${cs.transform || 'none'};opacity:${cs.opacity || 1};mix-blend-mode:${cs.mixBlendMode || 'normal'};z-index:${cs.zIndex}`;
  bufCanvas.after(el); bufCanvas.style.display = 'none';
  Object.assign(BUFT, { st, el, dirty: null });
}
function buftStop() {
  cancelAnimationFrame(BUFT.raf); BUFT.raf = 0;
  if (BUFT.el) BUFT.el.remove();
  BUFT.el = null; BUFT.st = null; BUFT.dirty = null; BUFT.tiles.clear();
  bufCanvas.style.display = '';
}
function buftMark(b) {
  if (!b || !(b.x1 > b.x0)) return;
  const d = BUFT.dirty; BUFT.dirty = d ? { x0: Math.min(d.x0, b.x0), y0: Math.min(d.y0, b.y0), x1: Math.max(d.x1, b.x1), y1: Math.max(d.y1, b.y1) } : { ...b };
  if (!BUFT.raf) BUFT.raf = requestAnimationFrame(buftFlush);
}
/* copy the changed area of the buffer into its tiles (once per frame) */
function buftFlush() {
  BUFT.raf = 0;
  const d = BUFT.dirty; BUFT.dirty = null;
  if (!d || !BUFT.el) return;
  const W = bufCanvas.width, H = bufCanvas.height, x = Math.max(0, Math.floor(d.x0) - 2), y = Math.max(0, Math.floor(d.y0) - 2), w = Math.min(W, Math.ceil(d.x1) + 2) - x, h = Math.min(H, Math.ceil(d.y1) + 2) - y;
  if (w <= 0 || h <= 0) return;
  for (const [tx, ty] of buftTiles(x, y, w, h, W, H)) {
    const k = tx + ',' + ty; let c = BUFT.tiles.get(k);
    const X = tx * BUFT_T, Y = ty * BUFT_T;
    if (!c) {
      c = makeCanvas(Math.min(BUFT_T, W - X), Math.min(BUFT_T, H - Y));
      c.style.cssText = `position:absolute;left:${X}px;top:${Y}px;width:${c.width}px;height:${c.height}px`;
      BUFT.el.appendChild(c); BUFT.tiles.set(k, c);
    }
    const ax = Math.max(x, X), ay = Math.max(y, Y), bx = Math.min(x + w, X + c.width), by = Math.min(y + h, Y + c.height);
    if (bx <= ax || by <= ay) continue;
    const g = c.getContext('2d'); g.clearRect(ax - X, ay - Y, bx - ax, by - ay);
    g.drawImage(bufCanvas, ax, ay, bx - ax, by - ay, ax - X, ay - Y, bx - ax, by - ay);
  }
}
function installBufTiles() {
  const bs0 = beginStroke; beginStroke = function () {
    const out = bs0.apply(this, arguments);
    if (buftWanted(stroke)) { buftStart(stroke); buftMark(stroke.box); }
    return out;
  };
  const am0 = afterMove; afterMove = function (st) {
    const m = st && st.mbox ? { ...st.mbox } : null, snapped = st && st.snapped;
    const out = am0.apply(this, arguments);
    if (st && st === BUFT.st) {
      buftMark(m);
      if (snapped && !st._buftSnap) { st._buftSnap = true; buftMark(st.box); } // QuickShape redrew the whole stroke
    }
    return out;
  };
  const es0 = endStroke; endStroke = function () {
    const st = stroke;
    try { return es0.apply(this, arguments); } finally { if (st && st === BUFT.st) buftStop(); }
  };
  // the buffer's place / opacity / blend can change during a stroke (prepBuffer): keep the tiles in step
  const pb0 = prepBuffer; prepBuffer = function () {
    const out = pb0.apply(this, arguments);
    if (BUFT.el) { const cs = bufCanvas.style; Object.assign(BUFT.el.style, { transform: cs.transform || 'none', opacity: cs.opacity || 1, mixBlendMode: cs.mixBlendMode || 'normal', zIndex: cs.zIndex }); }
    return out;
  };
  // refreshStage re-appends the stage's canvases: keep the tiles right above the buffer
  hookAfter('refreshStage', () => { if (BUFT.el && BUFT.el.parentNode && bufCanvas.nextSibling !== BUFT.el) bufCanvas.after(BUFT.el); }, 31);
}
