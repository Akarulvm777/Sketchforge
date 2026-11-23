/* ---------- Animation plus ----------
   - One layer can hold a whole animation: drawing on a held / empty frame makes a NEW BLANK drawing there
     (ANP.newKey = 'blank'; 'copy' = start from a copy of the previous drawing; 'off' = draw on the held drawing).
     Onion skin turns on by itself the first time, so the previous drawing shows faintly.
   - "＋ New drawing" (Shift+→): next frame (on 1s / 2s / 3s), adds frames at the end when needed, blank drawing.
   - Timeline: right-click menu on any cell, double-click an empty cell = new drawing, drag the selected
     keyframe to move it (Alt = copy), play range (in / out) shown on the ruler.
   - Onion skin options (drawings or frames, this layer or all, colours, strength), ping-pong playback.
   - Export: play range, transparent background, sprite sheet.                                             */
let anOnionTouched = false;
function animNewBlank(src) {
  if (state.mode !== 'anim' || ANP.newKey !== 'blank') return false;
  return !xfOf(src).tween && !src._pup; // tweens and puppet poses continue from a copy
}
function animAfterBlank() {
  if (state.onion.on || anOnionTouched) return;
  state.onion.on = true; anOnionTouched = true;
  syncTimelineFields(); setTimeout(updateOnion, 0);
  toast('New drawing on this frame — onion skin is on so you can see the previous one (O to hide it)', 4500);
}
function anApplyNewKey() { state.autoKey = ANP.newKey !== 'off'; const s = $('#anNewKey'); if (s) s.value = ANP.newKey; }

/* next frame (+ exposure) with a new blank drawing on the active layer */
function newDrawing() {
  const l = activeLayer(); if (!l) return;
  if (l.locked) { toast('Layer is locked'); return; }
  if (l.vref) { toast('Choose a drawing layer first'); return; }
  const t = state.frame + Math.max(1, ANP.expose | 0);
  if (t >= MAX_FRAMES) { toast('Maximum frames reached'); return; }
  const k = keyAt(l, state.frame), src = k !== null ? l.cels.get(k) : null;
  timelineOp(() => {
    if (t >= state.frameCount) state.frameCount = t + 1;
    const c = makeCel(false);
    if (src && src._xf) c._xf = { ...src._xf, tween: false, ease: 0 };
    l.cels.set(t, c);
  });
  gotoFrame(t);
  if (!state.onion.on && !anOnionTouched) animAfterBlank();
}

/* shift this layer's drawings after frame f by d frames (hold longer / shorter) */
function anHold(l, f, d) {
  const k = keyAt(l, f); if (k === null) return;
  const nk = nextKey(l, k);
  if (d < 0 && (nk === null ? state.frameCount - 1 : nk - 1) <= k) { toast('This drawing is already only 1 frame long'); return; }
  if (d > 0 && state.frameCount >= MAX_FRAMES) { toast('Maximum frames reached'); return; }
  timelineOp(() => {
    const m = new Map();
    for (const [x, c] of l.cels) m.set(x > k ? x + d : x, c);
    l.cels = m;
    if (d > 0) { const last = Math.max(...l.cels.keys()); if (last >= state.frameCount || nk === null) state.frameCount = Math.min(MAX_FRAMES, Math.max(state.frameCount + (nk === null ? 1 : 0), last + 1)); }
    else if (nk === null) state.frameCount = Math.max(1, state.frameCount - 1);
  });
}
function anMoveKey(l, from, to, copy) {
  if (from === to || to < 0) return;
  if (l.cels.has(to)) { toast('There is already a drawing on frame ' + (to + 1)); return; }
  if (to >= MAX_FRAMES) return;
  timelineOp(() => {
    const c = l.cels.get(from);
    if (copy) l.cels.set(to, copyCel(c, true)); else { l.cels.delete(from); l.cels.set(to, c); if (!l.cels.size) l.cels.set(0, makeCel(false)); }
    if (to >= state.frameCount) state.frameCount = to + 1;
  });
  gotoFrame(to);
}
function anReverse(l) { // reverse the order of this layer's drawings inside the play range (or everywhere)
  const [lo, hi] = playRange();
  const ks = Array.from(l.cels.keys()).filter(k => k >= lo && k <= hi).sort((a, b) => a - b);
  if (ks.length < 2) { toast('Need at least two drawings'); return; }
  timelineOp(() => {
    const ends = ks.map((k, i) => (i + 1 < ks.length ? ks[i + 1] : Math.min(hi + 1, nextKey(l, k) ?? hi + 1)) - k);
    const cels = ks.map(k => l.cels.get(k)); ks.forEach(k => l.cels.delete(k));
    let f = ks[0];
    for (let i = ks.length - 1; i >= 0; i--) { l.cels.set(f, cels[i]); f += ends[i]; }
  });
}
function anSetRange(which, f) {
  if (which === 'clear') { state.playIn = state.playOut = null; }
  else if (which === 'in') { state.playIn = f; if (state.playOut != null && state.playOut < f) state.playOut = null; }
  else { state.playOut = f; if (state.playIn != null && state.playIn > f) state.playIn = null; }
  renderTimeline(); markDirty();
  const [lo, hi] = playRange();
  toast(state.playIn == null && state.playOut == null ? 'Plays all frames' : `Plays frames ${lo + 1}–${hi + 1}`);
}
function anEase(v) { const l = activeLayer(); const k = l && keyAt(l, state.frame); if (k === null || !l) return; if (!xfOf(l.cels.get(k)).tween) { toast('No tween here — press Tween first'); return; } timelineOp(() => { ensureXf(l.cels.get(k)).ease = v; }); }

/* ---- timeline context menu ---- */
function anMenu(x, y, items) {
  let m = $('#anMenu');
  if (!m) { m = document.createElement('div'); m.id = 'anMenu'; m.className = 'popover tabmenu'; document.body.appendChild(m); document.addEventListener('pointerdown', e => { if (!m.contains(e.target)) m.hidden = true; }, true); }
  m.innerHTML = '';
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { m.appendChild(document.createElement('hr')); continue; }
    const b = document.createElement('button'); b.textContent = it[0]; b.disabled = !!it[2]; b.onclick = () => { m.hidden = true; it[1](); }; m.appendChild(b);
  }
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px'; m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
}
function anCellAt(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY); // the timeline captures the pointer, so e.target can be the whole timeline
  const row = el && el.closest && el.closest('#tlInner .tl-row'); if (!row) return null;
  const r = tlInner.getBoundingClientRect(), f = Math.floor((e.clientX - r.left - nameW()) / CELL_W);
  if (e.clientX - r.left < nameW() || f < 0) return null;
  return { row, f, l: row.dataset.id ? state.layers.find(x => x.id === +row.dataset.id) : null, ruler: row.classList.contains('tl-ruler') };
}
function anCellMenu(e) {
  const c = anCellAt(e); if (!c) return;
  e.preventDefault();
  if (c.l) selectLayer(c.l.id);
  if (c.f < state.frameCount) gotoFrame(c.f);
  const f = c.f, l = activeLayer(), key = l && keyAt(l, f) === f, has = l && keyAt(l, f) !== null;
  const tw = has && xfOf(l.cels.get(keyAt(l, f))).tween;
  const items = c.ruler ? [] : [
    ['＋ New drawing here', () => { if (f >= state.frameCount) setFrameCount(f + 1); gotoFrame(f); insertKeyframe(true); }],
    ['Copy of the previous drawing here', () => insertKeyframe(false), key || !has],
    ['Delete this drawing', () => removeKeyframe(), !key],
    ['Clear this drawing', () => clearLayerFrame(), !has],
    '-',
    ['Hold longer (+1 frame)', () => anHold(l, f, 1), !has],
    ['Hold shorter (−1 frame)', () => anHold(l, f, -1), !has],
    ['Copy drawing (Alt+C)', () => CMD.copyDrawing && CMD.copyDrawing(), !has],
    ['Paste drawing (Alt+V)', () => CMD.pasteDrawing && CMD.pasteDrawing()],
    ['Reverse the drawings (play range)', () => anReverse(l)],
    '-',
    ['Tween from here', () => createTween(), !has],
    tw ? ['  Ease: linear', () => anEase(0)] : null,
    tw ? ['  Ease in (slow start)', () => anEase(-60)] : null,
    tw ? ['  Ease out (slow end)', () => anEase(60)] : null,
    ['Remove tween', () => removeTween(), !tw],
    '-'];
  items.push(['Insert a frame (all layers)', () => insertFrame()], ['Delete this frame (all layers)', () => removeFrame()], '-',
    ['▶ Play from here (set start)', () => anSetRange('in', f)], ['■ Play until here (set end)', () => anSetRange('out', f)],
    ['Play all frames (clear range)', () => anSetRange('clear'), state.playIn == null && state.playOut == null]);
  anMenu(e.clientX, e.clientY, items);
}

/* ---- keyframe drag: press on the selected keyframe and drag it (Alt = copy) ---- */
let anDrag = null;
function anDown(e) {
  if (e.button !== 0) return;
  const c = anCellAt(e); if (!c || !c.l || c.ruler) return;
  const l = c.l, now = performance.now(), last = anDown.last;
  anDown.last = { f: c.f, id: l.id, t: now };
  // double-click (the timeline is redrawn between the clicks, so the browser's dblclick doesn't fire)
  if (last && last.f === c.f && last.id === l.id && now - last.t < 400) { anDown.last = null; anDbl(e); e.stopImmediatePropagation(); return; }
  if (c.f !== state.frame || l.id !== state.activeId || keyAt(l, c.f) !== c.f || l.locked) return;
  anDrag = { l, from: c.f, to: c.f, copy: e.altKey, x: e.clientX, on: false };
  e.stopImmediatePropagation(); e.preventDefault();
  tlInner.setPointerCapture(e.pointerId);
}
function anMove(e) {
  if (!anDrag) return;
  const r = tlInner.getBoundingClientRect();
  const f = Math.max(0, Math.floor((e.clientX - r.left - nameW()) / CELL_W));
  if (!anDrag.on && Math.abs(e.clientX - anDrag.x) < 5) return;
  anDrag.on = true; anDrag.to = f;
  let g = $('#anGhost');
  if (!g) { g = document.createElement('div'); g.id = 'anGhost'; tlInner.appendChild(g); }
  const row = tlInner.querySelector(`.tl-row[data-id="${anDrag.l.id}"]`);
  g.style.left = nameW() + f * CELL_W + 'px'; g.style.top = (row ? row.offsetTop : 0) + 'px'; g.style.height = (row ? row.offsetHeight : 20) + 'px';
  g.classList.toggle('bad', f !== anDrag.from && anDrag.l.cels.has(f));
  e.stopImmediatePropagation();
}
function anUp(e) {
  if (!anDrag) return;
  const d = anDrag; anDrag = null;
  const g = $('#anGhost'); if (g) g.remove();
  e.stopImmediatePropagation();
  if (d.on && d.to !== d.from) anMoveKey(d.l, d.from, d.to, d.copy || e.altKey);
}
function anDbl(e) {
  const c = anCellAt(e); if (!c || !c.l || c.ruler) return;
  selectLayer(c.l.id);
  if (keyAt(c.l, c.f) === c.f) return;
  if (c.f >= state.frameCount) setFrameCount(c.f + 1);
  gotoFrame(c.f); insertKeyframe(true);
}

/* ---- onion skin settings ---- */
function anOnionPop(anchor) {
  let p = $('#anOnionPop');
  if (!p) { p = document.createElement('div'); p.id = 'anOnionPop'; p.className = 'popover'; document.body.appendChild(p); document.addEventListener('pointerdown', e => { if (!p.contains(e.target) && e.target !== anchor) p.hidden = true; }, true); }
  p.innerHTML = `<b>Onion skin</b>
    <label>Show <select data-k="oMode"><option value="drawings">previous / next drawings</option><option value="frames">neighbouring frames</option></select></label>
    <label>Layers <select data-k="oLayers"><option value="active">this layer only</option><option value="all">all layers</option></select></label>
    <label>Before <input type="number" data-o="before" min="0" max="5" value="${state.onion.before}"> colour <input type="color" data-k="oBefore" value="${ANP.oBefore}"></label>
    <label>After <input type="number" data-o="after" min="0" max="5" value="${state.onion.after}"> colour <input type="color" data-k="oAfter" value="${ANP.oAfter}"></label>
    <label>Strength <input type="range" data-k="oAlpha" min="10" max="100" value="${ANP.oAlpha}"></label>
    <button data-reset>Default colours</button>`;
  p.querySelector('[data-k="oMode"]').value = ANP.oMode; p.querySelector('[data-k="oLayers"]').value = ANP.oLayers;
  p.querySelectorAll('[data-k]').forEach(i => i.oninput = () => { ANP[i.dataset.k] = i.type === 'range' ? +i.value : i.value; anpSave(); state.onion.on = true; anOnionTouched = true; syncTimelineFields(); updateOnion(); });
  p.querySelectorAll('[data-o]').forEach(i => i.oninput = () => { state.onion[i.dataset.o] = clamp(+i.value || 0, 0, 5); syncTimelineFields(); updateOnion(); });
  p.querySelector('[data-reset]').onclick = () => { ANP.oBefore = '#ff3b3b'; ANP.oAfter = '#2ecc71'; ANP.oAlpha = 45; anpSave(); anOnionPop(anchor); updateOnion(); };
  const r = anchor.getBoundingClientRect();
  p.hidden = false;
  p.style.left = Math.max(4, Math.min(r.left, innerWidth - p.offsetWidth - 4)) + 'px';
  p.style.top = Math.max(4, r.top - p.offsetHeight - 6) + 'px';
}

/* ---- export: range, transparent background, sprite sheet ---- */
function anExportFrames() { const all = $('#expRange') && $('#expRange').value === 'range'; const [lo, hi] = all ? playRange() : [0, state.frameCount - 1]; const a = []; for (let f = lo; f <= hi; f++) a.push(f); return a; }
async function anSpriteSheet(scale, transparent) {
  const fr = anExportFrames(), n = fr.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  const w = Math.max(1, Math.round(state.w * scale)), h = Math.max(1, Math.round(state.h * scale));
  if (cols * w > 16384 || rows * h > 16384) throw new Error('sprite sheet too big — choose a smaller size');
  const c = makeCanvas(cols * w, rows * h), g = c.getContext('2d');
  fr.forEach((f, i) => g.drawImage(compositeFrame(f, { skipPaper: transparent }), (i % cols) * w, Math.floor(i / cols) * h, w, h));
  download(await canvasToBlob(c), state.name.replace(/[^\w\- ]+/g, '_') + `_sheet_${cols}x${rows}.png`);
}

function installAnimPlus() {
  Object.assign(CMD, {
    newDrawing, holdLonger: () => { const l = activeLayer(); if (l) anHold(l, state.frame, 1); }, holdShorter: () => { const l = activeLayer(); if (l) anHold(l, state.frame, -1); },
    reverseDrawings: () => { const l = activeLayer(); if (l) anReverse(l); },
    playIn: () => anSetRange('in', state.frame), playOut: () => anSetRange('out', state.frame), playAll: () => anSetRange('clear'),
    pingpong: () => { ANP.pingpong = !ANP.pingpong; anpSave(); const c = $('#anPing'); if (c) c.checked = ANP.pingpong; toast(ANP.pingpong ? 'Ping-pong: plays forward then backward' : 'Ping-pong off'); }
  });
  // timeline bar: new drawing + exposure, what drawing on an empty frame does, onion settings, ping-pong
  const head = $('#timeline .tl-head');
  const nd = document.createElement('span'); nd.className = 'an-new';
  nd.innerHTML = `<button data-cmd="newDrawing" id="anNewBtn" class="accent" title="Next frame with a new blank drawing (Shift+→)">＋ New drawing</button><select id="anExpose" title="How many frames each drawing lasts (on 1s / 2s / 3s)"><option value="1">on 1s</option><option value="2">on 2s</option><option value="3">on 3s</option><option value="4">on 4s</option></select>`;
  head.insertBefore(nd, head.querySelector('[data-cmd="keyframe"]'));
  $('#anExpose').value = String(ANP.expose);
  $('#anExpose').onchange = e => { ANP.expose = +e.target.value; anpSave(); };
  const ak = $('#autoKey').closest('label'); ak.hidden = true;
  const nk = document.createElement('label'); nk.className = 'tl-field'; nk.title = 'What happens when you draw on a frame that has no drawing of its own';
  nk.innerHTML = `Empty frame: <select id="anNewKey"><option value="blank">new drawing</option><option value="copy">copy previous</option><option value="off">edit previous</option></select>`;
  ak.after(nk);
  $('#anNewKey').onchange = e => { ANP.newKey = e.target.value; anpSave(); anApplyNewKey(); };
  anApplyNewKey();
  const on = $('#onionOn').closest('label');
  const ob = document.createElement('button'); ob.id = 'anOnionBtn'; ob.type = 'button'; ob.textContent = '▾'; ob.title = 'Onion skin settings: drawings or frames, layers, colours, strength';
  ob.onclick = () => anOnionPop(ob);
  on.after(ob);
  $('#onionOn').addEventListener('change', () => { anOnionTouched = true; });
  const lp = $('#loop').closest('label');
  const pp = document.createElement('label'); pp.className = 'check'; pp.title = 'Play forward then backward';
  pp.innerHTML = `<input type="checkbox" id="anPing"> Ping-pong`; lp.after(pp);
  $('#anPing').checked = ANP.pingpong; $('#anPing').onchange = e => { ANP.pingpong = e.target.checked; anpSave(); };
  // timeline mouse: menu, drag keys, double-click
  tlInner.addEventListener('contextmenu', anCellMenu);
  tlInner.addEventListener('pointerdown', anDown, true);
  tlInner.addEventListener('pointermove', anMove, true);
  tlInner.addEventListener('pointerup', anUp, true);
  // play range shading on the ruler
  hookAfter('renderTimeline', () => {
    if (state.playIn == null && state.playOut == null) return;
    const [lo, hi] = playRange();
    tlInner.querySelectorAll('.tl-ruler .tl-rc').forEach(c => { const f = +c.dataset.f; c.classList.toggle('out-range', f < lo || f > hi); c.classList.toggle('range-in', f === lo); c.classList.toggle('range-out', f === hi); });
  });
  // export dialog: range, background, sprite sheet
  const fmt = $('#expFormat');
  fmt.insertAdjacentHTML('beforeend', '<option value="sheet">Sprite sheet (one PNG)</option>');
  $('#expScale').closest('label').insertAdjacentHTML('afterend', `<label class="select"><span>Frames</span><select id="expRange"><option value="all">All frames</option><option value="range">Play range only</option></select></label>
    <label class="check" title="PNG frames, GIF and sprite sheets: leave out the paper layer"><input type="checkbox" id="expTransp"> Transparent background (no paper)</label>`);
  // Animation menu entries
  const A = MENUS.find(m => m[0] === 'Animation');
  if (A) A[1].push('-', ['＋ New drawing on next frame', 'newDrawing', 'Shift+→'], ['Hold drawing longer (+1)', 'holdLonger'], ['Hold drawing shorter (−1)', 'holdShorter'],
    ['Reverse drawings (play range)', 'reverseDrawings'], ['Play from this frame (set start)', 'playIn'], ['Play until this frame (set end)', 'playOut'], ['Play all frames', 'playAll'], ['Ping-pong playback on / off', 'pingpong']);
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('dialog[open]')) return;
    if (state.mode !== 'anim' || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === '>') { e.preventDefault(); e.stopImmediatePropagation(); newDrawing(); }
  }, true);
}
