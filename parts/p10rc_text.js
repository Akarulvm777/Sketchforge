/* ---------- Text & balloons for comics ----------
   Text tool, Tool Property: direction (horizontal / vertical — vertical = manga style, characters top to bottom,
   lines from right to left), a balloon that fits the text by itself (state.textBalloon: '' | ellipse | round |
   cloud | spike | thought, tail direction state.textTail°, drawn with the balloon drawing of the Manga tools under the
   text), line spacing, and comic font families (COMIC_FONTS: system font stacks, nothing to download).
   The text form submit is handled here (drawText); one undo step. */
const COMIC_FONTS = [
  ['sans-serif', 'Sans'], ['serif', 'Serif'], ['monospace', 'Mono'],
  ['"Comic Sans MS", "Comic Neue", "Chalkboard SE", "Comic Relief", cursive', 'Comic (speech)'],
  ['"Bradley Hand", "Segoe Print", "Marker Felt", "Ink Free", cursive', 'Handwritten'],
  ['Impact, "Haettenschweiler", "Arial Black", "Franklin Gothic Heavy", sans-serif', 'Shout / sound effects'],
  ['"Trebuchet MS", "Verdana", sans-serif', 'Rounded'],
  ['Georgia, "Times New Roman", serif', 'Narration'],
  ['"Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif', 'Japanese gothic'],
  ['"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif', 'Japanese mincho']
];
/* where each character / line goes: [{ ch, x, y }] relative to the anchor, and the text box (pure; measure(s) → px) */
function textLayout(lines, size, dir, spacing, align, measure) {
  const out = [], lh = size * spacing;
  if (dir === 'v') { // columns right → left, characters top → bottom, each centred in its column
    let maxLen = 0;
    lines.forEach((ln, c) => { const chars = [...ln]; maxLen = Math.max(maxLen, chars.length); chars.forEach((ch, i) => out.push({ ch, x: -c * lh - lh / 2, y: i * size * 1.05, center: true })); });
    return { items: out, box: { x: -lines.length * lh, y: 0, w: lines.length * lh, h: Math.max(1, maxLen) * size * 1.05 } };
  }
  let maxW = 0; const ws = lines.map(ln => { const w = measure(ln); maxW = Math.max(maxW, w); return w; });
  lines.forEach((ln, i) => { const off = align === 'center' ? -ws[i] / 2 : align === 'right' ? -ws[i] : 0; out.push({ ch: ln, x: off, y: i * lh }); });
  const x0 = align === 'center' ? -maxW / 2 : align === 'right' ? -maxW : 0;
  return { items: out, box: { x: x0, y: 0, w: maxW, h: lines.length * lh - (lh - size) } };
}
/* the balloon box around a text box (ellipses need more room than rectangles) (pure) */
function balloonAround(box, kind, size) {
  const pad = size * 0.7, k = kind === 'ellipse' || kind === 'cloud' || kind === 'thought' ? 1.42 : kind === 'spike' ? 1.55 : 1;
  let w = box.w * k + pad * 2, h = box.h * k + pad * 2;
  if (kind !== 'round') { h = Math.max(h, w * (kind === 'spike' ? 0.62 : 0.45)); w = Math.max(w, h * 0.9); } // never a thin flat balloon
  return { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h };
}
/* everything needed to draw a text again later (editable text layers, p10rd): position in layer pixels + style */
function textSpecFrom(txt, x, y) {
  return { txt, x, y, size: state.fontSize, font: state.font, bold: !!state.bold, italic: !!state.italic, color: state.color, dir: state.textDir || 'h',
    spacing: state.textSpacing || 1.25, align: state.align, balloon: state.textBalloon || '', tail: state.textTail ?? 120, lw: Math.max(1, pro.lw * 0.6) };
}
/* draws a text spec on g; returns the box it covers (text, balloon and tail) */
function paintText(g, S) {
  const font = `${S.italic ? 'italic ' : ''}${S.bold ? 'bold ' : ''}${S.size}px ${S.font}`;
  g.save(); g.font = font;
  const L = textLayout(S.txt.split('\n'), S.size, S.dir, S.spacing, S.align, s => g.measureText(s).width);
  const box = { x: L.box.x + S.x, y: L.box.y + S.y, w: L.box.w, h: L.box.h };
  let bb = { ...box };
  if (S.balloon) {
    const b = balloonAround(box, S.balloon, S.size);
    drawBalloon(g, S.balloon, b, { lw: S.lw || 3, tail: true, tailAng: S.tail ?? 120, tailLen: 0.45, fillColor: '#ffffff' });
    const reach = Math.max(b.w, b.h) * 0.8; bb = { x: b.x - reach * 0.5, y: b.y - reach * 0.5, w: b.w + reach, h: b.h + reach };
  }
  g.font = font; g.fillStyle = S.color; g.textBaseline = 'top';
  for (const it of L.items) { g.textAlign = it.center ? 'center' : 'left'; g.fillText(it.ch, S.x + it.x, S.y + it.y); }
  g.restore();
  return { bb, box };
}
function drawText(txt, at) {
  if (state.textLayer !== false && typeof textLayerPlace === 'function') return textLayerPlace(txt, at); // editable text layer (p10rd)
  const layer = canPaint(); if (!layer || !txt.trim()) return;
  const t = acquireCel(layer), lm = localMapper(layer), [x, y] = lm.map(at.x, at.y);
  const tc = makeCanvas(state.w, state.h), tg = tc.getContext('2d');
  const { bb } = paintText(tg, textSpecFrom(txt, x, y));
  const b = clampBox(bb.x - 6, bb.y - 6, bb.x + bb.w + 6, bb.y + bb.h + 6);
  if (!b) { releaseCel(t); return; }
  const before = crop(t.cel, b);
  if (sel.active && lm.ident) { tg.globalCompositeOperation = 'destination-in'; tg.drawImage(sel.mask, 0, 0); }
  t.ctx.drawImage(tc, 0, 0); t.cel._ink = true;
  pushHistory(celEntry(t, b, before, crop(t.cel, b)));
  addRecent(state.color); afterEdit();
}
function installText() {
  if (!state.textDir) state.textDir = 'h'; if (state.textBalloon == null) state.textBalloon = ''; if (state.textSpacing == null) state.textSpacing = 1.25; if (state.textTail == null) state.textTail = 120;
  // the form: this module draws the text (vertical, balloon); the old handler is skipped
  $('#textForm').addEventListener('submit', e => {
    e.preventDefault(); e.stopImmediatePropagation();
    const txt = $('#textInput').value; $('#textDialog').close();
    if (typeof textEditing !== 'undefined' && textEditing) drawText(txt, textPos); // editing a text layer (p10rd): empty = delete it
    else if (txt.trim() && textPos) drawText(txt, textPos);
  }, true);
  hookAfter('refreshProps', () => {
    if (kindOf(state.tool) !== 'text') return;
    const body = $('#propBody'); if (!body) return;
    const sel0 = body.querySelector('select'); // the old font list → the comic font families
    if (sel0) { sel0.innerHTML = COMIC_FONTS.map(([v, n]) => `<option value='${v.replace(/'/g, '&#39;')}'>${n}</option>`).join(''); if (!COMIC_FONTS.some(f => f[0] === state.font)) state.font = COMIC_FONTS[0][0]; sel0.value = state.font; sel0.onchange = () => { state.font = sel0.value; }; }
    grp(body, 'Comic text');
    seg(body, [['h', 'Horizontal'], ['v', 'Vertical']], state.textDir, v => { state.textDir = v; refreshProps(); });
    slider(body, 'Line spacing', 90, 200, 5, state.textSpacing * 100, v => v + '%', v => state.textSpacing = v / 100);
    const row = document.createElement('label'); row.className = 'select'; row.innerHTML = '<span>Balloon</span>';
    const sb = document.createElement('select');
    [['', 'None'], ['ellipse', 'Speech (oval)'], ['round', 'Speech (rounded box)'], ['cloud', 'Soft cloud'], ['thought', 'Thought'], ['spike', 'Shout (spiky)']].forEach(([v, n]) => { const o = document.createElement('option'); o.value = v; o.textContent = n; sb.appendChild(o); });
    sb.value = state.textBalloon; sb.onchange = () => { state.textBalloon = sb.value; refreshProps(); }; row.appendChild(sb); body.appendChild(row);
    if (state.textBalloon) slider(body, 'Tail direction', 0, 359, 5, state.textTail, v => v + '°', v => state.textTail = v);
    hint(body, state.textBalloon ? 'The balloon fits the text by itself, drawn under it on the same layer.' : 'Choose a balloon to put one around the text automatically.');
  });
}
