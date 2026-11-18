/* ---------- Reusing drawings in animation ----------
   - Copy / paste the drawing of the active layer between frames, layers and documents (keeps its motion transform).
   - Repeat frames: repeat a frame range N times (walk / run cycles), on all layers or only the active one.
   - Drawing library: save drawings or selections once and stamp them anywhere later. Stored in IndexedDB,
     so the library is shared by every document and survives restarts. */
let celClip = null;
function copyDrawing() {
  const l = activeLayer(), c = l && !l.vref ? celCanvas(l, state.frame) : null;
  if (!c || c._ink === false) { toast('Nothing drawn on this layer at this frame'); return; }
  celClip = { c: copyCel(c, true), name: l.name };
  toast('Drawing copied — go to another frame or layer and use Paste drawing');
}
function pasteDrawing() {
  if (!celClip) { toast('Copy a drawing first (Animation › Copy drawing)'); return; }
  const l = canPaint(); if (!l || l.isMask) return;
  const f = state.frame;
  timelineOp(() => {
    const c = makeCel(true);
    c.getContext('2d').drawImage(celClip.c, 0, 0);
    c._ink = true;
    if (celClip.c._xf) c._xf = { ...celClip.c._xf, tween: false, ease: 0 };
    l.cels.set(f, c);
    bindAll(f);
  });
  toast('Drawing pasted as a new keyframe');
}
function repeatFrames(p) {
  const a = p.from - 1, b = p.to - 1, n = p.times, len = b - a + 1;
  if (a < 0 || b >= state.frameCount || b < a) { toast('Check the frame range'); return; }
  const add = len * n;
  if (p.scope === 'all' && state.frameCount + add > MAX_FRAMES) { toast('That would be more than ' + MAX_FRAMES + ' frames'); return; }
  timelineOp(() => {
    const layers = p.scope === 'all' ? state.layers.filter(l => !l.vref) : [activeLayer()].filter(Boolean);
    for (const l of layers) {
      const src = []; for (let f = a; f <= b; f++) { const k = keyAt(l, f); src.push(k === null ? null : { key: k === f || f === a, c: l.cels.get(k) }); }
      const m = new Map();
      if (p.scope === 'all') { for (const [k, c] of l.cels) m.set(k > b ? k + add : k, c); }
      else for (const [k, c] of l.cels) m.set(k, c);
      for (let r = 1; r <= n; r++) {
        for (let i = 0; i < len; i++) {
          const s = src[i], at = b + 1 + (r - 1) * len + i;
          if (!s || !s.key) continue;
          if (p.scope !== 'all' && at >= state.frameCount) continue;
          m.set(at, copyCel(s.c, true));
        }
      }
      // keep what followed the range: the frame after the repeats shows the original next drawing
      if (p.scope !== 'all') { const after = b + 1 + add; if (after < state.frameCount && !m.has(after)) { const k = keyAt(l, b + 1); if (k !== null && k > b) m.set(after, copyCel(l.cels.get(k), true)); } }
      l.cels = m;
    }
    if (p.scope === 'all') state.frameCount += add;
  });
  toast(`Frames ${p.from}–${p.to} repeated ${n}×`);
}

/* ---- drawing library (IndexedDB) ---- */
const LIB = { db: null, items: [], mem: false };
function libOpen() {
  if (LIB.db || LIB.mem) return Promise.resolve();
  return new Promise(res => {
    try {
      const rq = indexedDB.open('sketchforge-library', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('items', { keyPath: 'id' });
      rq.onsuccess = () => { LIB.db = rq.result; res(); };
      rq.onerror = () => { LIB.mem = true; res(); };
    } catch (e) { LIB.mem = true; res(); }
  });
}
function libTx(mode, fn) {
  return new Promise((res, rej) => {
    if (!LIB.db) { res(fn(null)); return; }
    const tx = LIB.db.transaction('items', mode), st = tx.objectStore('items'), out = fn(st);
    tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out); tx.onerror = () => rej(tx.error);
  });
}
async function libLoad() {
  await libOpen();
  if (LIB.db) LIB.items = (await libTx('readonly', st => st.getAll())) || [];
  LIB.items.sort((a, b) => a.t - b.t);
}
async function libAdd(canvas, x, y, name) {
  await libOpen();
  const blob = await canvasToBlob(canvas);
  const it = { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, blob, w: canvas.width, h: canvas.height, x, y, t: Date.now() };
  LIB.items.push(it);
  if (LIB.db) await libTx('readwrite', st => st.put(it));
  libRender();
  toast('Saved to the drawing library');
}
async function libDelete(id) {
  LIB.items = LIB.items.filter(i => i.id !== id);
  if (LIB.db) await libTx('readwrite', st => st.delete(id));
  libRender();
}
async function libRename(id, name) {
  const it = LIB.items.find(i => i.id === id); if (!it) return;
  it.name = name; if (LIB.db) await libTx('readwrite', st => st.put(it));
  libRender();
}
/* the current drawing (cropped to its content) or the selected part of it */
function libAddCurrent(selOnly) {
  const l = activeLayer(), c = l && !l.vref ? celCanvas(l, state.frame) : null;
  if (!c) { toast('Nothing drawn on this layer at this frame'); return; }
  let b;
  if (selOnly) { if (!sel.active) { toast('Make a selection first'); return; } b = sel.bb; }
  else { c._bb = undefined; b = celBBox(c); if (!b) { toast('Nothing drawn on this layer at this frame'); return; } }
  const out = makeCanvas(b.w, b.h), g = out.getContext('2d');
  g.drawImage(c, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  if (selOnly) { g.globalCompositeOperation = 'destination-in'; g.drawImage(sel.mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h); }
  libAdd(out, b.x, b.y, l.name + (state.frameCount > 1 ? ' · f' + (state.frame + 1) : ''));
}
/* Stamp a library drawing on the active layer, then select it so the Move tool can place it. */
async function libUse(it, at) {
  const l = canPaint(); if (!l || l.isMask) return;
  const img = await createImageBitmap(it.blob), c = makeCanvas(it.w, it.h); c.getContext('2d').drawImage(img, 0, 0);
  let x = it.x, y = it.y;
  if (at) { x = Math.round(at.x - it.w / 2); y = Math.round(at.y - it.h / 2); }
  if (x + it.w < 1 || y + it.h < 1 || x > state.w - 1 || y > state.h - 1) { x = Math.round((state.w - it.w) / 2); y = Math.round((state.h - it.h) / 2); }
  const prevClip = clipboard;
  clipboard = { canvas: c, x, y };
  pasteClipboard();
  clipboard = prevClip;
  // select the stamped pixels so they can be moved right away
  const g = selCtx(); g.clearRect(0, 0, state.w, state.h); g.globalCompositeOperation = 'source-over'; g.drawImage(c, x, y);
  sel.bb = computeBB(); sel.active = !!sel.bb; antsDirty = true; startAnts();
  selectTool('move');
  toast('Placed — drag to move it, Ctrl+D when done');
}
function libRender() {
  const p = $('#libPanel'); if (!p || p.hidden) return;
  const grid = p.querySelector('.libgrid'); grid.innerHTML = '';
  if (!LIB.items.length) grid.innerHTML = '<p class="muted small" style="grid-column:1/-1;margin:8px">Empty. Draw something, then "+ Drawing" (or select part of it and "+ Selection"). Saved drawings stay here for every file.</p>';
  for (const it of LIB.items) {
    const cell = document.createElement('div'); cell.className = 'libitem'; cell.draggable = true; cell.title = it.name + ' — click to place on this frame, drag onto the canvas to place it there';
    const img = document.createElement('img'); img.src = URL.createObjectURL(it.blob); img.onload = () => URL.revokeObjectURL(img.src);
    const nm = document.createElement('span'); nm.textContent = it.name;
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '×'; x.title = 'Delete';
    x.onclick = e => { e.stopPropagation(); if (confirm('Delete "' + it.name + '" from the library?')) libDelete(it.id); };
    nm.ondblclick = e => { e.stopPropagation(); const n = prompt('Name', it.name); if (n) libRename(it.id, n); };
    cell.onclick = () => libUse(it);
    cell.ondragstart = e => { e.dataTransfer.setData('text/x-sf-lib', it.id); e.dataTransfer.effectAllowed = 'copy'; };
    cell.append(img, nm, x); grid.appendChild(cell);
  }
}
async function libShow(on) {
  let p = $('#libPanel');
  if (!p) {
    p = document.createElement('div'); p.id = 'libPanel'; p.className = 'subview libpanel'; p.hidden = true;
    p.innerHTML = `<div class="svhead"><b>Drawing library</b><span style="flex:1"></span><button data-a="draw" title="Save the drawing of the active layer on this frame">+ Drawing</button><button data-a="sel" title="Save only the selected part">+ Selection</button><button data-a="close" title="Close">×</button></div><div class="libgrid"></div>`;
    document.body.appendChild(p);
    p.querySelector('[data-a=draw]').onclick = () => libAddCurrent(false);
    p.querySelector('[data-a=sel]').onclick = () => libAddCurrent(true);
    p.querySelector('[data-a=close]').onclick = () => libShow(false);
    const head = p.querySelector('.svhead');
    head.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const r = p.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top; head.setPointerCapture(e.pointerId);
      const mv = ev => { p.style.left = clamp(ev.clientX - ox, 0, innerWidth - 60) + 'px'; p.style.top = clamp(ev.clientY - oy, 0, innerHeight - 30) + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto'; };
      const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); };
      head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
    });
    viewport.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/x-sf-lib')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    viewport.addEventListener('drop', e => {
      const id = e.dataTransfer.getData('text/x-sf-lib'); if (!id) return;
      e.preventDefault(); e.stopPropagation();
      const it = LIB.items.find(i => i.id === id); if (it) libUse(it, toDoc(e));
    }, true);
  }
  p.hidden = on === undefined ? !p.hidden : !on;
  if (!p.hidden) { await libLoad(); libRender(); }
}

function installReuse() {
  Object.assign(CMD, {
    copyDrawing, pasteDrawing, library: () => libShow(),
    repeatFrames: () => proDialog('Repeat frames (cycle)', [
      { k: 'from', label: 'From frame', min: 1, max: state.frameCount, val: 1 },
      { k: 'to', label: 'To frame', min: 1, max: state.frameCount, val: Math.max(1, Math.min(state.frameCount, state.frame + 1)) },
      { k: 'times', label: 'Repeat', min: 1, max: 20, val: 1 },
      { k: 'scope', label: 'Layers', type: 'select', val: 'all', options: [['all', 'All layers (inserts new frames)'], ['one', 'Only the active layer (overwrites the frames after)']] }], repeatFrames, 'Repeat')
  });
  const AN = MENUS.find(m => m[0] === 'Animation')[1], at = AN.findIndex(x => Array.isArray(x) && x[1] === 'pasteFrame');
  AN.splice(at + 1, 0, ['Copy drawing (this layer)', 'copyDrawing', 'Alt+C'], ['Paste drawing here (this layer)', 'pasteDrawing', 'Alt+V'], ['Repeat frames (cycle)…', 'repeatFrames'], ['Drawing library…', 'library']);
  MENUS.find(m => m[0] === 'Window')[1].push(['Drawing library (show / hide)', 'library']);
  document.addEventListener('keydown', e => {
    if (!e.altKey || e.ctrlKey || e.metaKey || (e.target.closest && e.target.closest('input,textarea,select'))) return;
    if (e.code === 'KeyC') { e.preventDefault(); copyDrawing(); }
    else if (e.code === 'KeyV') { e.preventDefault(); pasteDrawing(); }
  });
}
