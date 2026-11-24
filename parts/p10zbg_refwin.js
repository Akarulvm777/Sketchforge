/* ---------- reference window (3.6) ----------
   Window › Reference window: a floating window that keeps reference pictures next to the canvas (like Clip Studio's
   Sub View). Add pictures (button, drop, paste), switch between them, zoom with the wheel or the buttons, drag to
   look around, flip, and pick colours from them (💧, or Alt+click). Its place / size are remembered
   (prefs refwin.v1); the pictures are kept in IndexedDB sketchforge-refs (kv: 'list' = [{ id, name }], 'img:<id>' =
   the file), shared by all documents. */
const REF = { list: [], cur: null, img: null, z: 1, x: 0, y: 0, flip: false, pick: false, db: null };
const refDB = () => REF.db || (REF.db = new Promise(res => { try { const rq = indexedDB.open('sketchforge-refs', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('kv'); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); } catch (e) { res(null); } }));
const refKV = async (mode, key, val) => { const db = await refDB(); if (!db) return null; return new Promise(res => { try { const tx = db.transaction('kv', mode === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('kv'), rq = mode === 'get' ? st.get(key) : mode === 'del' ? st.delete(key) : st.put(val, key); rq.onsuccess = () => res(rq.result ?? null); rq.onerror = () => res(null); } catch (e) { res(null); } }); };
/* pure: zoom around a point (screen px inside the view) keeping that point still */
function refZoomAt(v, k, px, py) { const z = clamp(v.z * k, 0.05, 32), f = z / v.z; return { ...v, z, x: px - (px - v.x) * f, y: py - (py - v.y) * f }; }
function refEl() {
  let w = $('#refWin'); if (w) return w;
  w = document.createElement('div'); w.id = 'refWin'; w.className = 'refwin'; w.hidden = true;
  w.innerHTML = `<div class="refhead"><b>🖼 Reference</b><span class="reftabs"></span><button type="button" data-a="close" title="Close">✕</button></div>
    <div class="refbar"><button type="button" data-a="add" title="Add pictures">＋ Add</button><button type="button" data-a="paste" title="Paste a picture from the clipboard">📋</button>
      <button type="button" data-a="fit" title="Fit">⤢</button><button type="button" data-a="in" title="Zoom in">＋</button><button type="button" data-a="out" title="Zoom out">−</button>
      <button type="button" data-a="flip" title="Flip">⇋</button><button type="button" data-a="pick" title="Pick a colour from the picture (or Alt+click)">💧</button>
      <span style="flex:1"></span><button type="button" data-a="del" title="Remove this picture">🗑</button></div>
    <canvas class="refview"></canvas><p class="refempty muted small">Add a picture (＋ Add), drop one here, or paste one (📋).</p>`;
  document.body.appendChild(w);
  const cv = w.querySelector('canvas'), $a = a => w.querySelector(`[data-a=${a}]`);
  $a('close').onclick = () => refShow(false);
  $a('add').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.onchange = () => refAddFiles([...i.files]); i.click(); };
  $a('paste').onclick = async () => { try { const items = await navigator.clipboard.read(); for (const it of items) for (const t of it.types) if (t.startsWith('image/')) { await refAddFiles([new File([await it.getType(t)], 'pasted.png', { type: t })]); return; } toast('No picture in the clipboard'); } catch (e) { toast('Copy a picture first, then press 📋 (or drop the picture here)'); } };
  $a('fit').onclick = refFit;
  $a('in').onclick = () => { Object.assign(REF, refZoomAt(REF, 1.25, cv.width / 2, cv.height / 2)); refDraw(); };
  $a('out').onclick = () => { Object.assign(REF, refZoomAt(REF, 0.8, cv.width / 2, cv.height / 2)); refDraw(); };
  $a('flip').onclick = () => { REF.flip = !REF.flip; refDraw(); };
  $a('pick').onclick = () => { REF.pick = !REF.pick; $a('pick').classList.toggle('on', REF.pick); };
  $a('del').onclick = refDelete;
  // move the window by its title
  const head = w.querySelector('.refhead');
  head.onpointerdown = e => { if (e.target.closest('button, .reftabs')) return; const r = w.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top; head.setPointerCapture(e.pointerId);
    head.onpointermove = ev => { w.style.left = clamp(ev.clientX - ox, 0, innerWidth - 80) + 'px'; w.style.top = clamp(ev.clientY - oy, 0, innerHeight - 40) + 'px'; };
    head.onpointerup = () => { head.onpointermove = null; refSaveBox(); }; };
  // look around / pick a colour
  cv.onpointerdown = e => {
    const r = cv.getBoundingClientRect(), k = cv.width / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    if (REF.pick || e.altKey) { const d = cv.getContext('2d').getImageData(Math.floor(px), Math.floor(py), 1, 1).data; if (d[3]) setColor('#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')); return; }
    cv.setPointerCapture(e.pointerId); let lx = px, ly = py;
    cv.onpointermove = ev => { const qx = (ev.clientX - r.left) * k, qy = (ev.clientY - r.top) * k; REF.x += qx - lx; REF.y += qy - ly; lx = qx; ly = qy; refDraw(); };
    cv.onpointerup = () => { cv.onpointermove = null; };
  };
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), k = cv.width / r.width; Object.assign(REF, refZoomAt(REF, e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientX - r.left) * k, (e.clientY - r.top) * k)); refDraw(); }, { passive: false });
  w.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
  w.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); refAddFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))); });
  new ResizeObserver(() => { refDraw(); refSaveBox(); }).observe(w);
  const box = prefs.json('refwin.v1', null);
  if (box) Object.assign(w.style, { left: clamp(box.x, 0, innerWidth - 120) + 'px', top: clamp(box.y, 0, innerHeight - 80) + 'px', width: box.w + 'px', height: box.h + 'px' });
  return w;
}
function refSaveBox() { const w = $('#refWin'); if (!w || w.hidden) return; const r = w.getBoundingClientRect(); prefs.setJson('refwin.v1', { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }); }
function refDraw() {
  const w = $('#refWin'); if (!w || w.hidden) return;
  const cv = w.querySelector('canvas'), r = cv.getBoundingClientRect();
  if (r.width < 2) return;
  if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) { cv.width = Math.round(r.width); cv.height = Math.round(r.height); }
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
  w.querySelector('.refempty').hidden = !!REF.img;
  if (!REF.img) return;
  g.save(); g.imageSmoothingQuality = 'high'; g.translate(REF.x, REF.y); g.scale(REF.z * (REF.flip ? -1 : 1), REF.z);
  g.drawImage(REF.img, REF.flip ? -REF.img.width : 0, 0); g.restore();
}
function refFit() {
  const w = $('#refWin'); if (!w || !REF.img) return; const cv = w.querySelector('canvas');
  const z = Math.min(cv.width / REF.img.width, cv.height / REF.img.height) * 0.96;
  Object.assign(REF, { z, x: (cv.width - REF.img.width * z) / 2, y: (cv.height - REF.img.height * z) / 2 }); refDraw();
}
function refTabs() {
  const w = $('#refWin'); if (!w) return; const t = w.querySelector('.reftabs'); t.innerHTML = '';
  REF.list.forEach((it, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = String(i + 1); b.title = it.name; b.className = it.id === REF.cur ? 'on' : ''; b.onclick = () => refOpen(it.id); t.appendChild(b); });
}
async function refOpen(id) {
  const blob = await refKV('get', 'img:' + id); if (!blob) return;
  try { REF.img = await createImageBitmap(blob); } catch (e) { toast('Could not read that picture'); return; }
  REF.cur = id; REF.flip = false; refTabs(); refFit();
}
async function refAddFiles(files) {
  files = files.filter(f => f && (f.type || '').startsWith('image/')); if (!files.length) return;
  let last = null;
  for (const f of files) { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); await refKV('put', 'img:' + id, f); REF.list.push({ id, name: f.name }); last = id; }
  await refKV('put', 'list', REF.list);
  refShow(true); await refOpen(last);
}
async function refDelete() {
  if (!REF.cur) return;
  await refKV('del', 'img:' + REF.cur); REF.list = REF.list.filter(x => x.id !== REF.cur); await refKV('put', 'list', REF.list);
  REF.cur = null; REF.img = null; refTabs(); refDraw();
  if (REF.list.length) refOpen(REF.list[REF.list.length - 1].id);
}
async function refShow(on) {
  const w = refEl(); w.hidden = !on;
  if (on) { if (!REF.list.length) REF.list = (await refKV('get', 'list')) || []; refTabs(); if (!REF.img && REF.list.length) await refOpen(REF.list[REF.list.length - 1].id); else { refDraw(); refFit(); } }
}
function installRefWin() {
  CMD.refWin = () => refShow($('#refWin') ? $('#refWin').hidden : true);
  const W = MENUS.find(m => m[0] === 'Window');
  if (W && !W[1].some(x => Array.isArray(x) && x[1] === 'refWin')) W[1].splice(1, 0, ['🖼 Reference window (show / hide)', 'refWin']);
}
