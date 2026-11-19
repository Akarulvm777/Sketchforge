/* ---------- documents ---------- */
function resizeDocCanvases() {
  for (const c of DOC_CANVASES) { c.width = state.w; c.height = state.h; }
  sel.mask.width = state.w; sel.mask.height = state.h;
}
function resetSelection() {
  selCtx().clearRect(0, 0, state.w, state.h);
  sel.active = false; sel.bb = null; antsEdge = null; antsDirty = true; startAnts();
}
function newDocument(w, h, frames, fps, transparent, name) {
  if (typeof docPrepareNew === 'function') docPrepareNew(); // opens a new tab (p10o_multidoc)
  stop();
  stroke = null; active = null;
  Object.assign(state, { name: name || 'Untitled', w, h, frameCount: frames, fps, frame: 0, layers: [] });
  state.onion = { on: false, before: 2, after: 1 };
  resizeDocCanvases();
  layerSeq = 1; layerCounter = 1;
  if (!transparent) { const p = createLayer('Paper', '#ffffff'); p.paper = true; state.layers.push(p); }
  const l = createLayer('Layer 1');
  state.layers.push(l); state.activeId = l.id;
  history.undo.length = 0; history.redo.length = 0;
  resetSelection();
  dirty = false;
  refreshAll(); syncTab(); fit();
  if (typeof tlReset === 'function') { tlReset(); setTimeout(() => tlCapture(true), 100); }
}
const NEWP = {
  illust: [['A4 portrait 210×297 mm @350','mm',210,297,350],['A4 landscape 297×210 mm @350','mm',297,210,350],['Square 2000×2000 px','px',2000,2000,72],['HD 1920×1080 px','px',1920,1080,72],['Portrait 1200×1600 px','px',1200,1600,72],['Postcard 148×100 mm @350','mm',148,100,350],['Custom','px',1280,720,72]],
  webtoon: [['Webtoon 800×1280 px','px',800,1280,72],['Webtoon 720×1280 px','px',720,1280,72],['Long strip 800×4000 px','px',800,4000,72],['Custom','px',800,1280,72]],
  comic: [['B5 comic 182×257 mm @600','mm',182,257,600],['A4 comic 210×297 mm @600','mm',210,297,600],['Custom (use trim size)','mm',182,257,600]],
  anim: [['720×540 @144','px',720,540,144],['1280×720 HD','px',1280,720,72],['1920×1080 Full HD','px',1920,1080,72],['1080×1920 vertical','px',1080,1920,72],['1080×1080 square','px',1080,1080,72],['Custom','px',1280,720,72]]
};
let newType = 'illust';
const U2PX = { px: (v) => v, mm: (v, d) => v / 25.4 * d, cm: (v, d) => v / 2.54 * d, in: (v, d) => v * d };
function newPixels() {
  const u = $('#newUnit').value, d = +$('#newDpi').value || 72;
  let w = U2PX[u](+$('#newW').value || 1, d), h = U2PX[u](+$('#newH').value || 1, d);
  if (newType === 'comic') {
    const [tw, th] = $('#newTrim').value.split('x').map(Number), bl = +$('#newBleed').value || 0;
    if ($('#newPreset').selectedIndex === NEWP.comic.length - 1) { w = U2PX.mm(tw + 2 * bl, d); h = U2PX.mm(th + 2 * bl, d); }
  }
  return [Math.round(w), Math.round(h)];
}
function newUpdateInfo() {
  let [w, h] = newPixels();
  let fr = newType === 'anim' ? (+$('#newFrames').value || 1) : newType === 'comic' ? (+$('#newPages').value || 1) : 1;
  const scale = Math.min(1, 8192 / Math.max(w, h));
  $('#newInfo').textContent = `${w} × ${h} px` + (scale < 1 ? ' (will be capped to 8192 px)' : '') + (fr > 1 ? ` · ${fr} ${newType === 'comic' ? 'pages' : 'frames'}` : '') + ` · ≈ ${Math.round(w * h * 4 * fr / 1048576)} MB if fully drawn`;
}
function newSetType(t) {
  newType = t;
  document.querySelectorAll('#newTypes button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $('#nwComic').hidden = t !== 'comic'; $('#nwAnim').hidden = t !== 'anim';
  $('#newPreset').innerHTML = NEWP[t].map((p, i) => `<option value="${i}">${p[0]}</option>`).join('');
  $('#newMode').value = t === 'comic' ? 'mono' : 'color';
  $('#newFps').value = t === 'anim' ? 24 : 12;
  newApplyPreset();
}
function newApplyPreset() {
  const p = NEWP[newType][+$('#newPreset').value || 0];
  $('#newUnit').value = p[1]; $('#newW').value = p[2]; $('#newH').value = p[3]; $('#newDpi').value = String(p[4]);
  newUpdateInfo();
}
function openNewDialog() { newSetType(newType); $('#newDialog').showModal(); }
$('#newTypes').onclick = e => { const b = e.target.closest('button'); if (b) newSetType(b.dataset.t); };
$('#newPreset').onchange = newApplyPreset;
$('#newOrient').onclick = () => { const w = $('#newW').value; $('#newW').value = $('#newH').value; $('#newH').value = w; newUpdateInfo(); };
$('#newUnit').onchange = () => {
  // keep physical size when changing unit
  newUpdateInfo();
};
['#newW', '#newH', '#newDpi', '#newTrim', '#newBleed', '#newPages', '#newFrames'].forEach(s => $(s).oninput = () => {
  if (s === '#newW' || s === '#newH') $('#newPreset').value = String(NEWP[newType].length - 1);
  if (s === '#newTrim' || s === '#newBleed') $('#newPreset').value = String(NEWP.comic.length - 1);
  newUpdateInfo();
});
$('#newSecs').oninput = $('#newFps').oninput = () => { $('#newFrames').value = clamp(Math.round(+$('#newSecs').value * +$('#newFps').value) || 1, 1, MAX_FRAMES); newUpdateInfo(); };
$('#newCancel').onclick = () => $('#newDialog').close();
function drawGuides(layer, w, h, type, dpi) {
  const c = layer.cels.get(0).getContext('2d');
  c.lineWidth = Math.max(1, Math.round(w / 800));
  if (type === 'comic') {
    const bl = Math.round((+$('#newBleed').value || 0) / 25.4 * dpi);
    c.strokeStyle = '#2aa6ff'; c.strokeRect(bl, bl, w - 2 * bl, h - 2 * bl);          // trim
    const sf = Math.round(10 / 25.4 * dpi);
    c.strokeStyle = '#ff5a5a'; c.setLineDash([12, 8]); c.strokeRect(bl + sf, bl + sf, w - 2 * (bl + sf), h - 2 * (bl + sf)); // safe area
  } else {
    const m = 0.05; c.strokeStyle = '#ffb23c'; c.setLineDash([12, 8]);
    c.strokeRect(w * m, h * m, w * (1 - 2 * m), h * (1 - 2 * m));
  }
  c.setLineDash([]); layer.cels.get(0)._ink = true;
}
$('#newCreate').onclick = () => {
  let [w, h] = newPixels();
  const k = Math.min(1, 8192 / Math.max(w, h)); w = clamp(Math.round(w * k), 16, 8192); h = clamp(Math.round(h * k), 16, 8192);
  const dpi = +$('#newDpi').value || 72;
  let fr = 1, fps = 12;
  if (newType === 'anim') { fr = clamp(Math.round(+$('#newFrames').value) || 1, 1, MAX_FRAMES); fps = clamp(Math.round(+$('#newFps').value) || 24, 1, 60); }
  if (newType === 'comic') fr = clamp(Math.round(+$('#newPages').value) || 1, 1, MAX_FRAMES);
  const mem = w * h * 4 * fr / 1048576;
  if (mem > 1500 && !confirm(`This canvas could need over ${Math.round(mem)} MB if every frame has a drawing. Continue?`)) return;
  $('#newDialog').close();
  const tr = $('#newTransparent').checked;
  newDocument(w, h, fr, fps, tr, ($('#newName').value || 'Untitled').trim());
  const paper = state.layers.find(l => l.paper);
  if (paper) { const g = paper.cels.get(0).getContext('2d'); g.fillStyle = $('#newPaper').value; g.fillRect(0, 0, w, h); paper.cels.get(0)._ink = true; if (typeof paperFromDialog === 'function') paperFromDialog(paper); }
  if ((newType === 'comic' && $('#newGuide').checked) || (newType === 'anim' && $('#newSafe').checked)) {
    const g = createLayer('Guides'); g.cels.set(0, makeCel(false)); g.draft = true;
    drawGuides(g, w, h, newType, dpi);
    state.layers.splice(1, 0, g); bindAll(0);
    state.activeId = state.layers[state.layers.length - 1].id;
  }
  if (newType === 'comic' && fr > 1) { for (let f = 1; f < fr; f++) for (const l of state.layers) l.cels.set(f, l.paper ? copyCel(l.cels.get(0), false) : (l.draft ? copyCel(l.cels.get(0), false) : makeCel(false))); }
  state.projectType = newType; state.dpi = dpi; setMode(newType === 'anim' ? 'anim' : 'draw', true);
  if (newType === 'comic') state.name += ' (' + fr + ' p)';
  refreshAll(); syncTab(); fit(); dirty = false;
};

/* ---------- save / open (.sketchforge, JSON, v2) ---------- */
/* The .sketchforge document as a plain object (also used to hand a document to another window). */
/* src: which document ({ st: state fields, lc: layerCounter, aud, tl: time-lapse frames }); default = the open tab.
   opts.cache: reuse each cel's last PNG while it is unchanged (session autosave); opts.quiet: no size warnings. */
function docSource() { return { st: state, lc: layerCounter, aud, tl: null }; }
function celURL(c, cache) {
  if (!cache) return c.toDataURL('image/png');
  if (c._su && c._suv === (c._sv || 0)) return c._su;
  c._su = c.toDataURL('image/png'); c._suv = c._sv || 0; return c._su;
}
/* PNG encoding off the main thread (toBlob), so saving / remembering work does not freeze drawing */
function celURLAsync(c, cache) {
  const v = c._sv || 0;
  if (cache && c._su && c._suv === v) return Promise.resolve(c._su);
  return new Promise(res => {
    if (!c.toBlob) { res(celURL(c, cache)); return; }
    c.toBlob(b => {
      if (!b) { res(celURL(c, cache)); return; }
      const fr = new FileReader();
      fr.onload = () => { if (cache) { c._su = fr.result; c._suv = v; } res(fr.result); };
      fr.onerror = () => res(celURL(c, cache));
      fr.readAsDataURL(b);
    }, 'image/png');
  });
}
async function buildDocObject(src, opts = {}) {
  src = src || docSource();
  const st = src.st, enc = c => celURLAsync(c, opts.cache);
  const folderList = []; for (const l of st.layers) if (l.folder && !folderList.includes(l.folder)) folderList.push(l.folder);
  const doc = {
    format: 'sketchforge', version: 2, name: st.name, w: st.w, h: st.h,
    frameCount: st.frameCount, fps: st.fps, loop: st.loop, mode: st.mode,
    layerCounter: src.lc,
    layers: st.layers.map(l => ({
      name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked, paper: l.paper, px: l.px, py: l.py, clip: l.clip, alock: l.alock, ref: l.ref, draft: l.draft,
      paperTex: l.paperTex || null, active: l.id === st.activeId,
      parent: l.parent ? st.layers.findIndex(x => x.id === l.parent) : -1,
      tag: l.tag || null, folder: l.folder ? folderList.indexOf(l.folder) : -1,
      mask: l.mask ? { cels: Array.from(l.mask.cels.entries()).sort((a, b) => a[0] - b[0]).map(([k, c]) => ({ k, ink: c._ink !== false, data: c._ink === false ? null : enc(c) })) } : null,
      cels: Array.from(l.cels.entries()).sort((a, b) => a[0] - b[0]).map(([k, c]) => ({
        k, ink: c._ink !== false, xf: c._xf || null,
        data: c._ink === false ? null : enc(c)
      }))
    }))
  };
  if (folderList.length) doc.folders = folderList.map(f => ({ name: f.name, open: f.open !== false, visible: f.visible !== false, color: f.color || null }));
  for (let i = 0; i < st.layers.length; i++) if (st.layers[i].vref) doc.layers[i].vref = await vrefSerialize(st.layers[i], opts.quiet);
  // puppet warp pins: each keyframe keeps its pins; the original drawings are stored once (shared by keys)
  const rests = new Map(), pupRests = [];
  st.layers.forEach((l, i) => Array.from(l.cels.entries()).sort((a, b) => a[0] - b[0]).forEach(([, c], j) => {
    if (!c._pup) return;
    let r = rests.get(c._pup.rest);
    if (r === undefined) { r = pupRests.length; rests.set(c._pup.rest, r); pupRests.push(enc(c._pup.rest)); }
    doc.layers[i].cels[j].pup = { r, pins: c._pup.pins, cur: c._pup.cur };
  }));
  if (pupRests.length) doc.pupRests = await Promise.all(pupRests);
  // the cel images were encoded in the background: wait for them
  await Promise.all(doc.layers.flatMap(l => [...l.cels, ...(l.mask ? l.mask.cels : [])].map(async cd => { if (cd.data && cd.data.then) cd.data = await cd.data; })));
  const au = typeof audioSerialize === 'function' ? await audioSerialize(src.aud, opts.quiet) : null;
  if (au) doc.audio = au;
  const tl = typeof tlSerialize === 'function' ? await tlSerialize(src.tl) : null;
  if (tl) doc.timelapse = tl;
  return doc;
}
async function saveDocument() {
  const doc = await buildDocObject();
  const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
  download(blob, (state.name || 'Untitled').replace(/[^\w\- ]+/g, '_') + '.sketchforge');
  dirty = false; syncTab();
}
async function openDocumentFile(file) {
  try {
    const doc = JSON.parse(await file.text());
    if (doc.format !== 'sketchforge') throw new Error('Not a Sketchforge file');
    if (typeof docPrepareNew === 'function') docPrepareNew(); // opens in a new tab (p10o_multidoc)
    stop();
    const w = doc.w, h = doc.h;
    Object.assign(state, { name: doc.name || file.name.replace(/\.[^.]+$/, ''), w, h, frameCount: doc.frameCount || 1, fps: doc.fps || 12, frame: 0, loop: doc.loop !== false, layers: [] });
    resizeDocCanvases();
    layerSeq = 1; layerCounter = doc.layerCounter || doc.layers.length;
    const pupRests = doc.pupRests ? await Promise.all(doc.pupRests.map(async u => { const c = makeCanvas(w, h); c.getContext('2d').drawImage(await loadImage(u), 0, 0); c._ink = true; return c; })) : [];
    for (const ld of doc.layers) {
      const l = createLayer(ld.name);
      l.cels = new Map();
      const list = ld.cels || (ld.data ? [{ k: 0, ink: true, data: ld.data, xf: null }] : []);
      for (const cd of list) {
        const c = makeCel(cd.ink);
        if (cd.data) c.getContext('2d').drawImage(await loadImage(cd.data), 0, 0);
        if (cd.xf) c._xf = { ...IDENT, ...cd.xf };
        if (cd.pup && pupRests[cd.pup.r]) c._pup = { rest: pupRests[cd.pup.r], pins: cd.pup.pins, cur: cd.pup.cur };
        l.cels.set(cd.k, c);
      }
      if (!l.cels.size) l.cels.set(0, makeCel(false));
      Object.assign(l, { visible: ld.visible !== false, opacity: ld.opacity ?? 1, blend: ld.blend || 'normal', locked: !!ld.locked, paper: !!ld.paper, px: ld.px ?? null, py: ld.py ?? null, clip: !!ld.clip, alock: !!ld.alock, ref: !!ld.ref, draft: !!ld.draft });
      if (ld.mask) {
        const m = newMaskLayer(); m.cels = new Map();
        for (const cd of ld.mask.cels) { const c = makeCel(cd.ink); if (cd.data) c.getContext('2d').drawImage(await loadImage(cd.data), 0, 0); m.cels.set(cd.k, c); }
        if (!m.cels.size) m.cels.set(0, makeCel(false));
        l.mask = m;
      }
      if (ld.vref && typeof vrefRestore === 'function') { await vrefRestore(l, ld.vref); bindLayer(l, 0); }
      state.layers.push(l);
      if (ld.active) state.activeId = l.id;
    }
    doc.layers.forEach((ld, i) => { if (ld.parent >= 0 && state.layers[ld.parent] && ld.parent !== i) state.layers[i].parent = state.layers[ld.parent].id; });
    const folders = (doc.folders || []).map(fd => (typeof newFolder === 'function' ? Object.assign(newFolder(fd.name), { open: fd.open !== false, visible: fd.visible !== false, color: fd.color || null }) : null));
    doc.layers.forEach((ld, i) => { if (ld.paperTex) state.layers[i].paperTex = ld.paperTex; });
    doc.layers.forEach((ld, i) => { state.layers[i].tag = ld.tag || null; if (ld.folder >= 0 && folders[ld.folder]) state.layers[i].folder = folders[ld.folder]; });
    if (!state.layers.find(l => l.id === state.activeId)) state.activeId = state.layers[state.layers.length - 1].id;
    history.undo.length = 0; history.redo.length = 0;
    resetSelection();
    dirty = false;
    if (doc.audio && typeof audioRestore === 'function') await audioRestore(doc.audio);
    if (typeof tlRestore === 'function') TL.restoring = true;
    setMode(doc.mode || (state.frameCount > 1 ? 'anim' : 'draw'), true);
    refreshAll(); syncTab(); fit();
    if (typeof tlRestore === 'function') { await tlRestore(doc.timelapse); TL.restoring = false; if (!TL.frames.length) setTimeout(() => tlCapture(true), 100); }
    toast('Opened ' + state.name);
  } catch (err) {
    toast('Could not open file: ' + err.message);
  }
}
$('#fileOpen').onchange = e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  openDocumentFile(f);
};
function exportPNG() {
  canvasToBlob(compositeFrame(state.frame)).then(b => download(b, state.name + '_f' + (state.frame + 1) + '.png'));
}

/* ---------- export: ZIP / GIF / WebM ---------- */
class ByteBuf {
  constructor() { this.a = new Uint8Array(1 << 16); this.n = 0; }
  need(k) { if (this.n + k > this.a.length) { const b = new Uint8Array(Math.max(this.a.length * 2, this.n + k)); b.set(this.a); this.a = b; } }
  u8(v) { this.need(1); this.a[this.n++] = v; }
  u16(v) { this.u8(v & 255); this.u8(v >> 8 & 255); }
  u32(v) { this.u16(v & 65535); this.u16(v >>> 16); }
  bytes(arr) { this.need(arr.length); this.a.set(arr, this.n); this.n += arr.length; }
  str(s) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i) & 255); }
  out() { return this.a.subarray(0, this.n); }
}
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const out = new ByteBuf(), cen = [];
  const enc = new TextEncoder();
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), off = out.n;
    out.u32(0x04034b50); out.u16(20); out.u16(0x0800); out.u16(0); out.u16(0); out.u16(0x21);
    out.u32(crc); out.u32(f.data.length); out.u32(f.data.length); out.u16(name.length); out.u16(0);
    out.bytes(name); out.bytes(f.data);
    cen.push({ name, crc, size: f.data.length, off });
  }
  const cs = out.n;
  for (const c of cen) {
    out.u32(0x02014b50); out.u16(20); out.u16(20); out.u16(0x0800); out.u16(0); out.u16(0); out.u16(0x21);
    out.u32(c.crc); out.u32(c.size); out.u32(c.size); out.u16(c.name.length); out.u16(0); out.u16(0); out.u16(0); out.u16(0);
    out.u32(0); out.u32(c.off); out.bytes(c.name);
  }
  const ce = out.n - cs;
  out.u32(0x06054b50); out.u16(0); out.u16(0); out.u16(cen.length); out.u16(cen.length); out.u32(ce); out.u32(cs); out.u16(0);
  return new Blob([out.out()], { type: 'application/zip' });
}

/* GIF: median-cut palette on a 15-bit histogram, LZW compression */
function quantize(rgba, hasT) {
  const n = rgba.length / 4, hist = new Uint32Array(32768);
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    hist[(rgba[i * 4] >> 3) << 10 | (rgba[i * 4 + 1] >> 3) << 5 | (rgba[i * 4 + 2] >> 3)]++;
  }
  const items = [];
  for (let k = 0; k < 32768; k++) if (hist[k]) items.push(k);
  const maxC = hasT ? 255 : 256;
  const ch = (k, c) => c === 0 ? k >> 10 : c === 1 ? (k >> 5) & 31 : k & 31;
  let boxes = [items];
  while (boxes.length < maxC) {
    let bi = -1, best = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      let sz = 0; for (const k of b) sz += hist[k];
      if (sz > best) { best = sz; bi = i; }
    });
    if (bi < 0) break;
    const b = boxes[bi];
    let ax = 0, bestR = -1;
    for (let c = 0; c < 3; c++) {
      let mn = 31, mx = 0;
      for (const k of b) { const v = ch(k, c); if (v < mn) mn = v; if (v > mx) mx = v; }
      if (mx - mn > bestR) { bestR = mx - mn; ax = c; }
    }
    b.sort((p, q) => ch(p, ax) - ch(q, ax));
    let tot = 0; for (const k of b) tot += hist[k];
    let acc = 0, cut = 1;
    for (let i = 0; i < b.length; i++) { acc += hist[b[i]]; if (acc >= tot / 2) { cut = Math.min(Math.max(i + 1, 1), b.length - 1); break; } }
    boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
  }
  const pal = [], lut = new Uint16Array(32768);
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0, t = 0;
    for (const k of b) { const c = hist[k]; r += (k >> 10) * c; g += ((k >> 5) & 31) * c; bl += (k & 31) * c; t += c; lut[k] = i; }
    const f = t || 1;
    pal.push([Math.round(r / f * 8 + 4), Math.round(g / f * 8 + 4), Math.round(bl / f * 8 + 4)].map(v => Math.min(255, v)));
  });
  return { pal, lut };
}
function lzw(pixels, minCode) {
  const out = [], clear = 1 << minCode, eoi = clear + 1;
  let size = minCode + 1, next = eoi + 1, dict = new Map(), cur = 0, bits = 0;
  const emit = c => { cur |= c << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
  emit(clear);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const c = pixels[i], key = prefix * 256 + c, hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    dict.set(key, next++);
    if (next > (1 << size) && size < 12) size++;
    if (next >= 4096) { emit(clear); dict = new Map(); next = eoi + 1; size = minCode + 1; }
    prefix = c;
  }
  emit(prefix); emit(eoi);
  if (bits) out.push(cur & 255);
  return out;
}
function gifFrame(buf, rgba, w, h, delay) {
  let hasT = false;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 128) { hasT = true; break; }
  const { pal, lut } = quantize(rgba, hasT);
  const tIdx = pal.length;
  let nb = 1; while ((1 << nb) < pal.length + (hasT ? 1 : 0)) nb++;
  nb = Math.max(nb, 2);
  const px = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    px[i] = rgba[i * 4 + 3] < 128 ? tIdx : lut[(rgba[i * 4] >> 3) << 10 | (rgba[i * 4 + 1] >> 3) << 5 | (rgba[i * 4 + 2] >> 3)];
  }
  buf.bytes([0x21, 0xF9, 4, (2 << 2) | (hasT ? 1 : 0), delay & 255, delay >> 8, hasT ? tIdx : 0, 0]);
  buf.u8(0x2C); buf.u16(0); buf.u16(0); buf.u16(w); buf.u16(h);
  buf.u8(0x80 | (nb - 1));
  for (let i = 0; i < (1 << nb); i++) { const c = pal[i] || [0, 0, 0]; buf.u8(c[0]); buf.u8(c[1]); buf.u8(c[2]); }
  const minCode = Math.max(nb, 2);
  buf.u8(minCode);
  const data = lzw(px, minCode);
  for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); buf.u8(n); buf.bytes(data.slice(i, i + n)); }
  buf.u8(0);
}
function renderExportFrame(f, scale, transparent) {
  const full = compositeFrame(f, transparent ? { skipPaper: true } : {});
  if (scale === 1) return full;
  const c = makeCanvas(Math.max(1, Math.round(state.w * scale)), Math.max(1, Math.round(state.h * scale)));
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(full, 0, 0, c.width, c.height);
  return c;
}
async function runExport() {
  const fmt = $('#expFormat').value, scale = +$('#expScale').value, prog = $('#expProgress');
  const fr = typeof anExportFrames === 'function' ? anExportFrames() : Array.from({ length: state.frameCount }, (_, i) => i), n = fr.length;
  const transp = !!($('#expTransp') && $('#expTransp').checked);
  exporting = true; $('#expGo').disabled = true;
  const base = state.name.replace(/[^\w\- ]+/g, '_');
  try {
    if (fmt === 'sheet') {
      prog.textContent = 'Rendering…'; await sleep(0);
      await anSpriteSheet(scale, transp);
    } else if (fmt === 'zip') {
      const files = [];
      for (let i = 0; i < n; i++) {
        const f = fr[i];
        if (!exporting) throw new Error('cancelled');
        const b = await canvasToBlob(renderExportFrame(f, scale, transp));
        files.push({ name: `${base}_${String(f + 1).padStart(4, '0')}.png`, data: new Uint8Array(await b.arrayBuffer()) });
        prog.textContent = `Rendering ${i + 1} / ${n}`; await sleep(0);
      }
      download(makeZip(files), base + '_frames.zip');
    } else if (fmt === 'gif') {
      const buf = new ByteBuf();
      const w = Math.max(1, Math.round(state.w * scale)), h = Math.max(1, Math.round(state.h * scale));
      buf.str('GIF89a'); buf.u16(w); buf.u16(h); buf.u8(0x70); buf.u8(0); buf.u8(0);
      if ($('#expLoop').checked) buf.bytes([0x21, 0xFF, 11, ...'NETSCAPE2.0'.split('').map(c => c.charCodeAt(0)), 3, 1, 0, 0, 0]);
      const delay = Math.max(2, Math.round(100 / state.fps));
      for (let i = 0; i < n; i++) {
        if (!exporting) throw new Error('cancelled');
        const c = renderExportFrame(fr[i], scale, transp);
        gifFrame(buf, c.getContext('2d').getImageData(0, 0, w, h).data, w, h, delay);
        prog.textContent = `Encoding ${i + 1} / ${n}`; await sleep(0);
      }
      buf.u8(0x3B);
      download(new Blob([buf.out()], { type: 'image/gif' }), base + '.gif');
    } else {
      if (!window.MediaRecorder) throw new Error('WebM export is not supported in this browser');
      const w = Math.max(2, Math.round(state.w * scale)), h = Math.max(2, Math.round(state.h * scale));
      const cv = makeCanvas(w, h), g = cv.getContext('2d');
      const stream = cv.captureStream(0), track = stream.getVideoTracks()[0];
      const mime = (fmt === 'mp4' ? ['video/mp4;codecs=avc1.42E01E', 'video/mp4'] : []).concat(['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']).find(m => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 });
      const chunks = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise(r => { rec.onstop = r; });
      rec.start();
      for (let i = 0; i < n; i++) {
        if (!exporting) { rec.stop(); throw new Error('cancelled'); }
        g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
        g.drawImage(compositeFrame(fr[i]), 0, 0, w, h);
        track.requestFrame();
        prog.textContent = `Recording ${i + 1} / ${n}`;
        await sleep(1000 / state.fps);
      }
      rec.stop(); await done;
      download(new Blob(chunks, { type: mime.split(';')[0] }), base + (mime.startsWith('video/mp4') ? '.mp4' : '.webm'));
    }
    prog.textContent = 'Done.';
  } catch (err) {
    prog.textContent = err.message === 'cancelled' ? 'Cancelled.' : 'Export failed: ' + err.message;
  }
  exporting = false; $('#expGo').disabled = false;
}
function openExport() { $('#expProgress').textContent = ''; $('#exportDialog').showModal(); }
$('#expGo').onclick = runExport;
$('#expCancel').onclick = () => { exporting = false; $('#exportDialog').close(); };

