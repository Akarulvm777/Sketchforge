/* ---------- Face sliders (Live2D-style): blink, open the mouth, smile, raise the brows ----------
   Draw a face as usual, then mark its parts (a box around each eye, the mouth, a brow): l.faceParts =
   [{ id, kind: 'eye'|'mouth'|'brow', name, x, y, w, h }] (layer pixels). Each part has a slider; moving it on a frame
   makes a "face key": the keyframe cel keeps its original drawing and the slider values (cel._face = { rest, v, sv })
   and its pixels are the drawing deformed by the sliders (faceRender). Between two face keys of the same drawing the
   frames are filled with smooth in-betweens (cel._face.auto, made again whenever a key changes: faceTweens).
   Everything ends up as ordinary pixels, so playback, exports, onion skin and PSD just work. Saved in the .sketchforge
   file (layers[].faceParts, cels[].face, doc.faceRests). Drawing on a face key makes what you drew the new original. */
const FACE_KINDS = {
  eye: { name: 'Eye', label: 'Open', min: 0, max: 1, def: 1, tip: '1 = open as drawn, 0 = closed' },
  mouth: { name: 'Mouth', label: 'Open', min: 0, max: 1, def: 0, tip: 'draw the mouth closed (a line); 1 = wide open' },
  smile: { name: 'Smile', label: 'Smile', min: -1, max: 1, def: 0, tip: '+ corners up, − corners down' },
  brow: { name: 'Brow', label: 'Raise', min: -1, max: 1, def: 0, tip: '+ up (surprised), − down (angry)' }
};
let faceSeq = 1;
const FACE = { mouthColor: '#6b2230', smooth: true };
const facePartsOf = l => (l && !l.vref ? (l.faceParts || (l.faceParts = [])) : []);
const faceDefaults = l => Object.fromEntries(facePartsOf(l).map(p => [p.id, FACE_KINDS[p.kind].def]));
function faceVal(cel, p) { const v = cel && cel._face ? cel._face.v[p.id] : undefined; return typeof v === 'number' ? v : FACE_KINDS[p.kind].def; }
function faceCopyCanvas(src) { const c = makeCel(true); c.getContext('2d').drawImage(src, 0, 0); return c; }

/* ---- the deformations: each works on the part's box (plus room around it). The face may be drawn on the same layer
   as the skin: the colour around the box (bg) fills what opens up, and only pixels that differ from it count as ink. ---- */
function faceBox(p, padY) { const x0 = Math.max(0, Math.floor(p.x)), x1 = Math.min(state.w, Math.ceil(p.x + p.w)), y0 = Math.max(0, Math.floor(p.y - padY)), y1 = Math.min(state.h, Math.ceil(p.y + p.h + padY)); return { x0, y0, w: x1 - x0, h: y1 - y0 }; }
function faceWork(g, p, padY) {
  const b = faceBox(p, padY); if (b.w < 2 || b.h < 2) return null;
  const S = g.getImageData(b.x0, b.y0, b.w, b.h).data, out = new ImageData(b.w, b.h), O = out.data;
  // the background: the most common opaque colour on the box's border (none if the border is mostly transparent)
  const hist = new Map(); let n = 0, opaque = 0;
  const look = (x, y) => { const i = (y * b.w + x) * 4; n++; if (S[i + 3] < 200) return; opaque++; const q = (S[i] >> 4) << 8 | (S[i + 1] >> 4) << 4 | S[i + 2] >> 4, e = hist.get(q) || [0, 0, 0, 0]; e[0]++; e[1] += S[i]; e[2] += S[i + 1]; e[3] += S[i + 2]; hist.set(q, e); };
  for (let x = 0; x < b.w; x++) { look(x, 0); look(x, b.h - 1); }
  for (let y = 1; y < b.h - 1; y++) { look(0, y); look(b.w - 1, y); }
  let bg = null;
  if (opaque > n * 0.6) { let best = null; for (const e of hist.values()) if (!best || e[0] > best[0]) best = e; bg = [best[1] / best[0], best[2] / best[0], best[3] / best[0]]; }
  if (bg) for (let i = 0; i < O.length; i += 4) { O[i] = bg[0]; O[i + 1] = bg[1]; O[i + 2] = bg[2]; O[i + 3] = 255; }
  const ink = i => S[i + 3] > 40 && (!bg || Math.abs(S[i] - bg[0]) + Math.abs(S[i + 1] - bg[1]) + Math.abs(S[i + 2] - bg[2]) > 60);
  const put = (o, i, k = 1) => { // copy pixel i of the source to o of the output (k < 1 = faded toward the background)
    if (bg) { const a = S[i + 3] / 255 * k; for (let c = 0; c < 3; c++) O[o + c] = bg[c] + (S[i + c] - bg[c]) * a; O[o + 3] = 255; }
    else { O[o] = S[i]; O[o + 1] = S[i + 1]; O[o + 2] = S[i + 2]; O[o + 3] = S[i + 3] * k; }
  };
  return { b, S, O, out, bg, ink, put, done: () => g.putImageData(out, b.x0, b.y0) };
}
/* eye: squeeze toward the lid line, keeping the darkest ink; near closed only the dark lines stay (a closed-eye line) */
function faceEye(g, p, v) {
  const W = faceWork(g, p, 0); if (!W) return;
  const { b, S, ink, put } = W, s = Math.max(v, 6 / p.h), fade = v < 0.5 ? v * 2 : 1;
  for (let x = 0; x < b.w; x++) {
    const u = (b.x0 + x - (p.x + p.w / 2)) / (p.w / 2), cy = p.y + p.h * (0.52 + 0.1 * u * u) - b.y0;
    for (let y = 0; y < b.h; y++) {
      const a0 = Math.max(0, Math.floor(cy + (y - cy - 0.5) / s)), a1 = Math.min(b.h - 1, Math.ceil(cy + (y - cy + 0.5) / s) - 1);
      let best = -1, bi = -1;
      for (let sy = a0; sy <= a1; sy++) { const i = (sy * b.w + x) * 4; if (!ink(i)) continue; const sc = S[i + 3] * (1.25 - (S[i] + S[i + 1] + S[i + 2]) / 765); if (sc > best) { best = sc; bi = i; } }
      if (bi >= 0) put((y * b.w + x) * 4, bi, fade < 1 && S[bi] + S[bi + 1] + S[bi + 2] > 270 ? fade : 1);
    }
    if (fade < 1) { // almost closed: a solid lash line along the lid, in the column's darkest colour
      let dk = -1, ds = 9999; for (let y = 0; y < b.h; y++) { const i = (y * b.w + x) * 4; if (!ink(i)) continue; const t = S[i] + S[i + 1] + S[i + 2]; if (t < ds) { ds = t; dk = i; } }
      if (dk < 0 || ds > 270) continue;
      const th = Math.max(2, p.h * 0.07), k = 1 - fade, O = W.O;
      for (let y = Math.max(0, Math.floor(cy - th / 2)); y < Math.min(b.h, Math.ceil(cy + th / 2)); y++) { const o = (y * b.w + x) * 4, a = S[dk + 3] / 255 * k; for (let c = 0; c < 3; c++) O[o + c] += (S[dk + c] - O[o + c]) * a; O[o + 3] = Math.max(O[o + 3], S[dk + 3] * k); }
    }
  }
  W.done();
}
/* mouth: the drawn line splits it; the lower lip moves down (most in the middle) and the inside is filled */
function faceMouth(g, p, v) {
  const W = faceWork(g, p, p.h * 1.2); if (!W) return;
  const { b, S, O, ink, put } = W, top = Math.max(0, Math.round(p.y - b.y0)), bot = Math.min(b.h, Math.round(p.y + p.h - b.y0));
  const rowInk = y => { let t = 0; for (let x = 0; x < b.w; x++) { const i = (y * b.w + x) * 4; if (ink(i)) t += S[i + 3]; } return t; };
  let m = top, mx = 0; for (let y = top; y < bot; y++) { const t = rowInk(y); if (t > mx) { mx = t; m = y; } }
  if (mx <= 0) return;
  while (m > top && rowInk(m - 1) > mx * 0.35) m--;   // the top of the line
  let lt = 1; while (m + lt < bot && rowInk(m + lt) > mx * 0.35) lt++;
  let x0 = b.w, x1 = -1;
  for (let x = 0; x < b.w; x++) for (let y = Math.max(0, m - 3); y < Math.min(b.h, m + lt + 3); y++) if (ink((y * b.w + x) * 4)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  if (x1 <= x0) return;
  const d = v * p.h * 1.4, ic = hexRgb(FACE.mouthColor), mid = m + lt / 2;
  for (let x = 0; x < b.w; x++) {
    const t = (x - x0) / (x1 - x0), dy = t <= 0 || t >= 1 ? 0 : Math.round(d * Math.pow(Math.sin(Math.PI * t), 0.75));
    for (let y = 0; y < b.h; y++) {
      const o = (y * b.w + x) * 4;
      if (!dy || y < mid) { put(o, (y * b.w + x) * 4); continue; }            // upper lip and the top half of the line
      if (y < mid + dy) {                                                      // the open part
        const sy = y - dy; // the line's lower half follows the lower lip; the line's upper half stays
        if (y < m + lt && ink((y * b.w + x) * 4)) { put(o, (y * b.w + x) * 4); continue; }
        if (sy >= m && sy < m + lt && ink((sy * b.w + x) * 4)) { put(o, (sy * b.w + x) * 4); continue; }
        O[o] = ic[0]; O[o + 1] = ic[1]; O[o + 2] = ic[2]; O[o + 3] = 255; continue;
      }
      const sy = y - dy; if (sy >= 0 && sy < b.h) put(o, (sy * b.w + x) * 4);  // lower lip, moved down
    }
  }
  W.done();
}
/* smile: each column moves up or down, the corners most (a curve) */
function faceSmile(g, p, v) {
  const W = faceWork(g, p, p.h * 0.6); if (!W) return;
  const { b, S, O, bg } = W, px = (y, x, k) => (y >= 0 && y < b.h ? S[(y * b.w + x) * 4 + k] : bg ? (k < 3 ? bg[k] : 255) : 0);
  for (let x = 0; x < b.w; x++) {
    const u = (b.x0 + x - (p.x + p.w / 2)) / (p.w / 2), dy = -v * p.h * 0.45 * Math.min(1, u * u);
    for (let y = 0; y < b.h; y++) {
      const sy = y - dy, y0 = Math.floor(sy), f = sy - y0, o = (y * b.w + x) * 4;
      for (let k = 0; k < 4; k++) { const a = px(y0, x, k), c = px(y0 + 1, x, k); O[o + k] = a + (c - a) * f; }
    }
  }
  W.done();
}
/* brow: only the brow's own ink (inside its box) moves up or down and tilts a little (the inner end more) */
function faceBrow(g, p, v) {
  const W = faceWork(g, p, p.h * 1.2); if (!W) return;
  const { b, S, O, bg, ink, put } = W, inner = p.inner === 'left' ? -1 : 1, t0 = Math.round(p.y - b.y0), t1 = Math.round(p.y + p.h - b.y0);
  for (let i = 0; i < S.length; i += 4) { const y = (i / 4 / b.w) | 0; if (y >= t0 && y < t1 && ink(i)) { if (bg) { O[i] = bg[0]; O[i + 1] = bg[1]; O[i + 2] = bg[2]; O[i + 3] = 255; } else O[i + 3] = 0; } else put(i, i); }
  for (let x = 0; x < b.w; x++) {
    const u = (b.x0 + x - p.x) / p.w, dy = Math.round(-v * p.h * (0.7 + 0.3 * (inner > 0 ? u : 1 - u)));
    for (let sy = t0; sy < t1; sy++) { const y = sy + dy, i = (sy * b.w + x) * 4; if (y < 0 || y >= b.h || !ink(i)) continue; put((y * b.w + x) * 4, i); }
  }
  W.done();
}
function hexRgb(h) { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
/* the cel's pixels = its original drawing deformed by its slider values */
function faceRender(l, cel) {
  const F = cel._face; if (!F) return;
  const g = cel.getContext('2d'); g.clearRect(0, 0, cel.width, cel.height); g.drawImage(F.rest, 0, 0);
  for (const kind of ['mouth', 'smile', 'eye', 'brow']) for (const p of facePartsOf(l)) {
    if (p.kind !== kind) continue; const v = faceVal(cel, p);
    if (Math.abs(v - FACE_KINDS[kind].def) < 1e-3) continue;
    if (kind === 'eye') faceEye(g, p, v); else if (kind === 'mouth') faceMouth(g, p, v); else if (kind === 'smile') faceSmile(g, p, v); else faceBrow(g, p, v);
  }
  cel._ink = true; cel._sv = (cel._sv || 0) + 1; F.sv = cel._sv;
}
/* ---- keys and in-betweens ---- */
const faceEase = t => t * t * (3 - 2 * t);
function faceTweens(l) {
  // remove the old in-betweens (their transform is the same as the frames they cover, so nothing moves)
  for (const [k, c] of [...l.cels]) if (c._face && c._face.auto) l.cels.delete(k);
  if (!FACE.smooth) return;
  const keys = [...l.cels.keys()].sort((a, b) => a - b);
  const add = [];
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i], b = keys[i + 1], A = l.cels.get(a), B = l.cels.get(b);
    if (!A._face || !B._face || A._face.rest !== B._face.rest || b - a < 2) continue;
    for (let f = a + 1; f < b; f++) {
      const t = faceEase((f - a) / (b - a)), v = {};
      for (const p of facePartsOf(l)) { const va = faceVal(A, p), vb = faceVal(B, p); v[p.id] = va + (vb - va) * t; }
      const c = makeCel(true), fp = frameParams(l, f);
      c._face = { rest: A._face.rest, v, auto: true };
      if (fp) { c._xf = { ...IDENT, x: fp.p.x, y: fp.p.y, rot: fp.p.rot, sx: fp.p.sx, sy: fp.p.sy, alpha: fp.p.alpha }; if (xfOf(A).tween) { c._xf.tween = true; c._xf.ease = xfOf(A).ease; } }
      if (A._swap) c._swap = A._swap;
      add.push([f, c]);
    }
  }
  for (const [f, c] of add) { l.cels.set(f, c); faceRender(l, c); }
}
/* the face key of this frame, made if needed (a new cel object each time a drag starts, so undo keeps the old one) */
function faceKeyHere(l) {
  const f = state.frame, k = keyAt(l, f), cur = k !== null ? l.cels.get(k) : null;
  if (!cur || !celBBox(cur)) { toast('Draw the face on this layer first'); return null; }
  const c = makeCel(true);
  let rest, v;
  if (cur._face && cur._sv === cur._face.sv) { rest = cur._face.rest; v = { ...cur._face.v }; }
  else { rest = faceCopyCanvas(cur); v = faceDefaults(l); if (cur._face) toast('You drew on this frame: that drawing is now the original for the sliders', 3000); }
  if (k === f) { if (cur._xf) c._xf = { ...cur._xf }; }
  else { const fp = frameParams(l, f); c._xf = { ...IDENT, x: fp.p.x, y: fp.p.y, rot: fp.p.rot, sx: fp.p.sx, sy: fp.p.sy, alpha: fp.p.alpha }; if (xfOf(cur).tween) { c._xf.tween = true; c._xf.ease = xfOf(cur).ease; } }
  if (cur._swap) c._swap = cur._swap;
  c._face = { rest, v };
  l.cels.set(f, c);
  return c;
}
/* set a slider: live = while dragging (one undo step for the whole drag) */
let faceDrag = null;
function faceSet(l, part, val, live) {
  if (!faceDrag || faceDrag.l !== l || faceDrag.f !== state.frame) {
    const before = snapshotTimeline(), c = faceKeyHere(l); if (!c) return false;
    faceDrag = { l, f: state.frame, before, c };
  }
  const c = faceDrag.c; c._face.v[part.id] = val; faceRender(l, c);
  if (!live) faceCommit(); else { bindAll(state.frame); refreshStage(); }
  return true;
}
function faceCommit() {
  if (!faceDrag) return; const { l, before } = faceDrag; faceDrag = null;
  faceTweens(l);
  pushHistory(timelineEntry(before, snapshotTimeline()));
  bindAll(state.frame); refreshAll(); markDirty(); renderTimeline(); renderFacePanel();
}
/* every face key of the layer drawn again (after a part box moved or was removed) */
function faceRerenderAll(l) { for (const c of l.cels.values()) if (c._face && !c._face.auto) faceRender(l, c); faceTweens(l); bindAll(state.frame); refreshAll(); }
function faceAddPart(l, kind, box) {
  const list = facePartsOf(l), same = list.filter(p => p.kind === kind).length;
  const name = FACE_KINDS[kind].name + (kind === 'eye' || kind === 'brow' ? (same === 0 ? ' (left)' : same === 1 ? ' (right)' : ' ' + (same + 1)) : same ? ' ' + (same + 1) : '');
  const p = { id: 'fp' + Date.now().toString(36) + (faceSeq++), kind, name, x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) };
  if (kind === 'brow') p.inner = same === 0 ? 'right' : 'left';
  list.push(p);
  pushHistory({ undo() { const i = list.indexOf(p); if (i >= 0) list.splice(i, 1); faceRerenderAll(l); renderFacePanel(); }, redo() { list.push(p); faceRerenderAll(l); renderFacePanel(); } });
  markDirty(); renderFacePanel(); return p;
}
function faceRemovePart(l, p) {
  const list = facePartsOf(l), i = list.indexOf(p); if (i < 0) return;
  list.splice(i, 1); faceRerenderAll(l);
  pushHistory({ undo() { list.splice(i, 0, p); faceRerenderAll(l); renderFacePanel(); }, redo() { const j = list.indexOf(p); if (j >= 0) list.splice(j, 1); faceRerenderAll(l); renderFacePanel(); } });
  markDirty(); renderFacePanel();
}
/* draw a box on the canvas around a part (layer coordinates, transforms included) */
function facePickBox(kind) {
  const l = activeLayer(); if (!l || l.vref) return;
  const ov = document.createElement('div'); ov.id = 'faceBoxPick'; ov.innerHTML = `<div class="fb-tip">Drag a box around the ${FACE_KINDS[kind].name.toLowerCase()}${kind === 'mouth' ? ' (drawn closed, as a line)' : ''} · Esc = cancel</div><div class="fb-rect"></div>`;
  document.body.appendChild(ov);
  const rect = ov.querySelector('.fb-rect'); let a = null;
  const end = () => { ov.remove(); removeEventListener('keydown', key, true); };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); } };
  addEventListener('keydown', key, true);
  ov.onpointerdown = e => { a = [e.clientX, e.clientY]; ov.setPointerCapture(e.pointerId); };
  ov.onpointermove = e => { if (!a) return; Object.assign(rect.style, { display: 'block', left: Math.min(a[0], e.clientX) + 'px', top: Math.min(a[1], e.clientY) + 'px', width: Math.abs(e.clientX - a[0]) + 'px', height: Math.abs(e.clientY - a[1]) + 'px' }); };
  ov.onpointerup = e => {
    if (!a) return; const b = [e.clientX, e.clientY]; end();
    const m = layerMat(l, state.frame), im = m ? invMat(m) : null;
    const pts = [[a[0], a[1]], [b[0], a[1]], [a[0], b[1]], [b[0], b[1]]].map(([X, Y]) => { const d = toDoc({ clientX: X, clientY: Y }); return im ? applyMat(im, d.x, d.y) : [d.x, d.y]; });
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    if (box.w < 4 || box.h < 2) { toast('Drag a bigger box around the part'); return; }
    faceAddPart(l, kind, box);
  };
}
/* show a part's box on the canvas while the pointer is over its row */
function faceShowBox(l, p) {
  let el = $('#faceBoxShow'); if (!p) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'faceBoxShow'; document.body.appendChild(el); }
  const m = layerMat(l, state.frame), r = vpRect();
  const pts = [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]].map(([x, y]) => { const d = m ? applyMat(m, x, y) : [x, y]; const s = docToScreen(d[0], d[1]); return [s[0] + r.left, s[1] + r.top]; });
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  Object.assign(el.style, { left: Math.min(...xs) + 'px', top: Math.min(...ys) + 'px', width: (Math.max(...xs) - Math.min(...xs)) + 'px', height: (Math.max(...ys) - Math.min(...ys)) + 'px' });
}
/* ---- the panel ---- */
function renderFacePanel() {
  const pn = $('#facePanel'); if (!pn || pn.hidden || faceDrag) return;
  const l = activeLayer(), body = pn.querySelector('.fc-body');
  if (!l || l.vref) { body.innerHTML = '<p class="muted">Pick a drawing layer.</p>'; return; }
  const cel = celCanvas(l, state.frame), parts = facePartsOf(l);
  body.innerHTML = `<div class="fc-layer">Layer <b>${esc(l.name)}</b> · frame ${state.frame + 1}${cel && cel._face ? (cel._face.auto ? ' · in-between' : ' · face key') : ''}</div>`;
  if (!parts.length) body.insertAdjacentHTML('beforeend', '<p class="fc-hint">1. Draw a face (eyes open, mouth closed as a line).<br>2. Tap <b>＋ Eye</b> and drag a box around an eye; do the same for the other eye, the mouth and the brows.<br>3. Move the sliders. On another frame move them again: the frames between are made for you.</p>');
  for (const p of parts) {
    const K = FACE_KINDS[p.kind], v = faceVal(cel, p), row = document.createElement('div'); row.className = 'fc-row';
    row.innerHTML = `<span class="fc-name" title="${esc(K.tip)}">${esc(p.name)}</span><input type="range" min="${K.min}" max="${K.max}" step="0.01" value="${v}"><span class="fc-val">${Math.round(v * 100)}</span><button class="fc-x" title="Remove this part">✕</button>`;
    const r = row.querySelector('input'), out = row.querySelector('.fc-val');
    r.oninput = () => { out.textContent = Math.round(r.value * 100); faceSet(l, p, +r.value, true); };
    r.onchange = () => { faceSet(l, p, +r.value, false); };
    row.querySelector('.fc-x').onclick = () => { faceShowBox(l, null); faceRemovePart(l, p); };
    row.onpointerenter = () => faceShowBox(l, p); row.onpointerleave = () => faceShowBox(l, null);
    row.ondblclick = e => { if (e.target === r) { faceSet(l, p, K.def, false); } };
    body.appendChild(row);
  }
  const add = document.createElement('div'); add.className = 'fc-add';
  for (const k of ['eye', 'mouth', 'smile', 'brow']) { const b = document.createElement('button'); b.textContent = '＋ ' + FACE_KINDS[k].name; b.title = k === 'smile' ? 'Drag a box around the mouth for a smile slider' : `Drag a box around the ${FACE_KINDS[k].name.toLowerCase()}`; b.onclick = () => facePickBox(k); add.appendChild(b); }
  body.appendChild(add);
  const opt = document.createElement('div'); opt.className = 'fc-opt';
  opt.innerHTML = `<label title="Fill the frames between two face keys with smooth in-betweens"><input type="checkbox" ${FACE.smooth ? 'checked' : ''}> Smooth in-betweens</label><label title="Colour of the inside of the open mouth">Mouth inside <input type="color" value="${FACE.mouthColor}"></label><button class="fc-blink" title="Make a blink here: open → closed → open over 4 frames">👁 Blink here</button>`;
  const [sm, mc] = opt.querySelectorAll('input');
  sm.onchange = () => { FACE.smooth = sm.checked; const b = snapshotTimeline(); faceTweens(l); pushHistory(timelineEntry(b, snapshotTimeline())); bindAll(state.frame); refreshAll(); renderTimeline(); };
  mc.onchange = () => { FACE.mouthColor = mc.value; faceRerenderAll(l); markDirty(); };
  opt.querySelector('.fc-blink').onclick = () => faceBlink(l);
  body.appendChild(opt);
}
/* 👁 Blink here: eyes open on this frame, closed 2 frames later, open again 4 frames later (one undo step) */
function faceBlink(l) {
  const eyes = facePartsOf(l).filter(p => p.kind === 'eye'); if (!eyes.length) { toast('Mark the eyes first: ＋ Eye'); return; }
  const f0 = state.frame; 
  const before = snapshotTimeline();
  if (state.frameCount < f0 + 5) state.frameCount = f0 + 5;
  const at = (f, v) => { gotoFrame(f, true); const c = faceKeyHere(l); if (!c) return false; for (const p of eyes) c._face.v[p.id] = v; faceRender(l, c); return true; };
  if (!at(f0, 1) || !at(f0 + 2, 0) || !at(f0 + 4, 1)) return;
  faceTweens(l); gotoFrame(f0, true);
  pushHistory(timelineEntry(before, snapshotTimeline()));
  bindAll(state.frame); refreshAll(); markDirty(); renderTimeline(); renderFacePanel(); toast('Blink made: frames ' + (f0 + 1) + '–' + (f0 + 5));
}
function toggleFacePanel(show) {
  let pn = $('#facePanel');
  if (!pn) {
    pn = document.createElement('div'); pn.id = 'facePanel'; pn.hidden = true;
    pn.innerHTML = '<div class="fc-head"><b>🙂 Face sliders</b><button class="fc-help" title="How it works">?</button><button class="fc-close" title="Close">✕</button></div><div class="fc-body"></div>';
    document.body.appendChild(pn);
    pn.querySelector('.fc-close').onclick = () => toggleFacePanel(false);
    pn.querySelector('.fc-help').onclick = () => toast('Mark the eyes, mouth and brows with ＋, then move the sliders. Each frame where you move a slider is a face key; the frames between are made smoothly. Double-click a slider = back to normal.', 7000);
    const hd = pn.querySelector('.fc-head'); let d = null;
    hd.onpointerdown = e => { if (e.target.tagName === 'BUTTON') return; const r = pn.getBoundingClientRect(); d = [e.clientX - r.left, e.clientY - r.top]; hd.setPointerCapture(e.pointerId); };
    hd.onpointermove = e => { if (!d) return; Object.assign(pn.style, { left: Math.max(0, e.clientX - d[0]) + 'px', top: Math.max(0, e.clientY - d[1]) + 'px', right: 'auto' }); };
    hd.onpointerup = () => { d = null; };
  }
  pn.hidden = show === undefined ? !pn.hidden : !show;
  if (!pn.hidden) renderFacePanel(); else faceShowBox(null, null);
}
function installFace() {
  Object.assign(CMD, { faceSliders: () => toggleFacePanel(), faceBlink: () => faceBlink(activeLayer()) });
  const A = MENUS.find(m => m[0] === 'Animation') || MENUS.find(m => m[0] === 'Layer');
  if (A) A[1].push('-', ['🙂 Face sliders (blink, mouth, smile)…', 'faceSliders'], ['👁 Blink here', 'faceBlink']);
  hookAfter('renderTimeline', () => renderFacePanel());
}
