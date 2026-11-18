/* ---------- Opening Photoshop (.psd / .psb) and Clip Studio (.clip) files ----------
   PSD/PSB: RGB, grayscale or CMYK, 8 or 16 bit; raw, RLE and ZIP channels; layers with position, opacity,
   fill, visibility, blend mode, clipping; layer masks are baked into the pixels; groups are flattened
   (their visibility / opacity are applied to their layers, their name is prefixed). No layers → merged image.
   .clip: the format is undocumented. It embeds an SQLite database; we read it with a tiny read-only SQLite
   reader and open the full-canvas preview picture it stores (a flattened image, no separate layers). */

class SFReader {
  constructor(buf) { this.buf = buf; this.d = new DataView(buf); this.u = new Uint8Array(buf); this.p = 0; }
  u8() { return this.u[this.p++]; }
  i8() { const v = this.d.getInt8(this.p); this.p += 1; return v; }
  u16() { const v = this.d.getUint16(this.p); this.p += 2; return v; }
  i16() { const v = this.d.getInt16(this.p); this.p += 2; return v; }
  u32() { const v = this.d.getUint32(this.p); this.p += 4; return v; }
  i32() { const v = this.d.getInt32(this.p); this.p += 4; return v; }
  u64() { const hi = this.d.getUint32(this.p), lo = this.d.getUint32(this.p + 4); this.p += 8; return hi * 4294967296 + lo; }
  str(n) { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(this.u[this.p + i]); this.p += n; return s; }
  bytes(n) { const b = this.u.subarray(this.p, this.p + n); this.p += n; return b; }
}
async function sfInflate(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress ZIP-compressed PSD layers');
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
/* PackBits-decode one row; returns how many bytes it produced */
function packBitsRow(src, sp, len, dst, dp, outLen) {
  const end = sp + len, d0 = dp, stop = dp + outLen;
  while (sp < end && dp < stop) {
    let n = src[sp++]; if (n > 127) n -= 256;
    if (n >= 0) { for (let i = 0; i <= n && dp < stop; i++) dst[dp++] = src[sp++]; }
    else if (n !== -128) { const v = src[sp++]; for (let i = 0; i < 1 - n && dp < stop; i++) dst[dp++] = v; }
  }
  return dp - d0;
}
/* One channel of w×h samples → 8-bit plane. */
async function psdChannel(r, comp, dataLen, w, h, depth, ver) {
  let bpc = depth / 8;
  const n = w * h, start = r.p;
  let raw, rowBytes = w * bpc;
  if (!n) { r.p = start + dataLen; return new Uint8Array(0); }
  // Some writers (e.g. ImageMagick 6) put 8-bit layer data in a 16-bit file: trust the data size, not the header.
  if (comp === 0) { if (bpc === 2 && dataLen < n * 2) { bpc = 1; rowBytes = w; } raw = r.u.subarray(r.p, r.p + n * bpc); }
  else if (comp === 1) {
    raw = new Uint8Array(n * bpc);
    const counts = []; for (let y = 0; y < h; y++) counts.push(ver === 2 ? r.u32() : r.u16());
    let sp = r.p, got = 0; for (let y = 0; y < h; y++) { got += packBitsRow(r.u, sp, counts[y], raw, y * rowBytes, rowBytes); sp += counts[y]; }
    if (bpc === 2 && got <= n) { bpc = 1; rowBytes = w; raw = new Uint8Array(n); sp = r.p; for (let y = 0; y < h; y++) { packBitsRow(r.u, sp, counts[y], raw, y * w, w); sp += counts[y]; } }
  } else if (comp === 2 || comp === 3) {
    raw = await sfInflate(r.u.subarray(r.p, r.p + dataLen));
    if (bpc === 2 && raw.length < n * 2) { bpc = 1; rowBytes = w; }
    if (comp === 3) {
      if (bpc === 1) { for (let y = 0; y < h; y++) for (let x = 1, o = y * w; x < w; x++) raw[o + x] = (raw[o + x] + raw[o + x - 1]) & 255; }
      else if (bpc === 2) { for (let y = 0; y < h; y++) { const o = y * rowBytes; for (let x = 1; x < w; x++) { const v = ((raw[o + x * 2] << 8 | raw[o + x * 2 + 1]) + (raw[o + x * 2 - 2] << 8 | raw[o + x * 2 - 1])) & 65535; raw[o + x * 2] = v >> 8; raw[o + x * 2 + 1] = v & 255; } } }
    }
  } else throw new Error('Unknown PSD compression ' + comp);
  r.p = start + dataLen;
  if (bpc === 1) return raw.slice ? raw.slice(0, n) : raw;
  const out = new Uint8Array(n); for (let i = 0; i < n; i++) out[i] = raw[i * bpc]; // 16 bit → high byte
  return out;
}
/* planes {id: Uint8Array} → RGBA ImageData-sized array */
function psdToRGBA(planes, w, h, mode, alphaId) {
  const n = w * h, out = new Uint8ClampedArray(n * 4), A = planes[alphaId];
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    if (mode === 3) { out[j] = planes[0] ? planes[0][i] : 0; out[j + 1] = planes[1] ? planes[1][i] : 0; out[j + 2] = planes[2] ? planes[2][i] : 0; }
    else if (mode === 1) { const v = planes[0] ? planes[0][i] : 0; out[j] = out[j + 1] = out[j + 2] = v; }
    else if (mode === 4) { // CMYK is stored inverted (255 = no ink)
      const k = (planes[3] ? planes[3][i] : 255) / 255; out[j] = (planes[0] ? planes[0][i] : 255) * k; out[j + 1] = (planes[1] ? planes[1][i] : 255) * k; out[j + 2] = (planes[2] ? planes[2][i] : 255) * k;
    }
    out[j + 3] = A ? A[i] : 255;
  }
  return out;
}
const PSD_LONG_KEYS = new Set(['LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD']);
async function psdLayerInfo(r, ver, depth, mode, end) {
  let count = r.i16(); count = Math.abs(count);
  const recs = [];
  for (let i = 0; i < count; i++) {
    const L = { top: r.i32(), left: r.i32(), bottom: r.i32(), right: r.i32(), chans: [] };
    const nch = r.u16();
    for (let c = 0; c < nch; c++) L.chans.push({ id: r.i16(), len: ver === 2 ? r.u64() : r.u32() });
    r.str(4); L.blend = r.str(4); L.opacity = r.u8() / 255; L.clip = r.u8() === 1; L.flags = r.u8(); r.u8();
    const extraLen = r.u32(), extraEnd = r.p + extraLen;
    const maskLen = r.u32(), maskStart = r.p;
    if (maskLen >= 18) { L.mask = { top: r.i32(), left: r.i32(), bottom: r.i32(), right: r.i32(), def: r.u8(), flags: r.u8() }; }
    r.p = maskStart + maskLen;
    { const n = r.u32(); r.p += n; } // blending ranges
    const nl = r.u8(); L.name = r.str(nl); r.p += (4 - ((nl + 1) % 4)) % 4;
    L.fill = 1;
    while (r.p + 12 <= extraEnd) {
      const sig = r.str(4); if (sig !== '8BIM' && sig !== '8B64') break;
      const key = r.str(4), len = ver === 2 && PSD_LONG_KEYS.has(key) ? r.u64() : r.u32(), s = r.p;
      if (key === 'luni') { const nc = r.u32(); let t = ''; for (let k = 0; k < nc; k++) t += String.fromCharCode(r.u16()); L.name = t.replace(/\0+$/, ''); }
      else if (key === 'lsct' || key === 'lsdk') { L.section = r.u32(); }
      else if (key === 'iOpa') { L.fill = r.u8() / 255; }
      r.p = s + len;
    }
    r.p = extraEnd;
    recs.push(L);
  }
  for (const L of recs) {
    const w = L.right - L.left, h = L.bottom - L.top, planes = {};
    for (const ch of L.chans) {
      const comp = r.u16();
      let cw = w, chh = h;
      if (ch.id === -2 && L.mask) { cw = L.mask.right - L.mask.left; chh = L.mask.bottom - L.mask.top; }
      if (ch.id < -2) { r.p += ch.len - 2; continue; } // real user mask / vector mask: ignored
      planes[ch.id] = await psdChannel(r, comp, ch.len - 2, Math.max(0, cw), Math.max(0, chh), depth, ver);
    }
    L.w = w; L.h = h;
    L.rgba = w > 0 && h > 0 ? psdToRGBA(planes, w, h, mode, -1) : null;
    if (L.rgba && L.mask && planes[-2] && !(L.mask.flags & 2)) { // bake the layer mask into alpha
      const m = planes[-2], mw = L.mask.right - L.mask.left;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const mx = x + L.left - L.mask.left, my = y + L.top - L.mask.top;
        const mv = mx >= 0 && my >= 0 && mx < mw && my < L.mask.bottom - L.mask.top ? m[my * mw + mx] : L.mask.def;
        const j = (y * w + x) * 4 + 3; L.rgba[j] = L.rgba[j] * mv / 255;
      }
    }
  }
  r.p = end;
  return recs;
}
async function readPSD(buf) {
  const r = new SFReader(buf);
  if (r.str(4) !== '8BPS') throw new Error('Not a Photoshop file');
  const ver = r.u16(); if (ver !== 1 && ver !== 2) throw new Error('Unknown PSD version ' + ver);
  r.p += 6;
  const nch = r.u16(), H = r.u32(), W = r.u32(), depth = r.u16(), mode = r.u16();
  if (![1, 3, 4].includes(mode)) throw new Error('This PSD uses a colour mode Sketchforge cannot read (' + ({ 0: 'bitmap', 2: 'indexed', 7: 'multichannel', 8: 'duotone', 9: 'Lab' }[mode] || mode) + '). Convert it to RGB in Photoshop first.');
  if (depth !== 8 && depth !== 16) throw new Error('Only 8-bit and 16-bit PSD files can be opened (this one is ' + depth + '-bit)');
  { const n = r.u32(); r.p += n; } // colour mode data
  { const n = r.u32(); r.p += n; } // image resources
  const lmLen = ver === 2 ? r.u64() : r.u32(), lmEnd = r.p + lmLen;
  let layers = [];
  if (lmLen) {
    const liLen = ver === 2 ? r.u64() : r.u32(), liEnd = r.p + liLen;
    if (liLen) layers = await psdLayerInfo(r, ver, depth, mode, liEnd);
    r.p = liEnd;
    if (r.p + 4 <= lmEnd) { const n = r.u32(); r.p += n; } // global layer mask
    while (r.p + 12 <= lmEnd) { // 16 / 32-bit documents keep their layers in Lr16 / Lr32 blocks
      const sig = r.str(4); if (sig !== '8BIM' && sig !== '8B64') break;
      const key = r.str(4), len = ver === 2 && PSD_LONG_KEYS.has(key) ? r.u64() : r.u32(), s = r.p;
      if (!layers.length && (key === 'Lr16' || key === 'Lr32' || key === 'Layr') && len) layers = await psdLayerInfo(r, ver, depth, mode, s + len);
      r.p = s + len;
    }
  }
  r.p = lmEnd;
  let merged = null;
  if (r.p + 2 <= r.u.length) {
    try {
      const comp = r.u16(), planes = {}, nPl = Math.min(nch, mode === 4 ? 5 : mode === 1 ? 2 : 4), alphaIdx = mode === 4 ? 4 : mode === 1 ? 1 : 3;
      if (comp === 1) {
        const counts = []; for (let i = 0; i < nch * H; i++) counts.push(ver === 2 ? r.u32() : r.u16());
        let sp = r.p;
        for (let c = 0; c < nPl; c++) { const pl = new Uint8Array(W * H * depth / 8); for (let y = 0; y < H; y++) { const k = c * H + y; packBitsRow(r.u, sp, counts[k], pl, y * W * depth / 8, W * depth / 8); sp += counts[k]; } planes[c === alphaIdx ? -1 : c] = depth === 16 ? pl.filter((_, i) => i % 2 === 0) : pl; }
      } else if (comp === 0) {
        const sz = W * H * depth / 8;
        for (let c = 0; c < nPl; c++) { const pl = r.u.subarray(r.p + c * sz, r.p + (c + 1) * sz); planes[c === alphaIdx ? -1 : c] = depth === 16 ? pl.filter((_, i) => i % 2 === 0) : pl; }
      }
      if (planes[0]) merged = psdToRGBA(planes, W, H, mode, layers.length ? -9 : -1);
    } catch (e) { merged = null; }
  }
  return { W, H, depth, mode, layers, merged };
}
const PSD_BLEND_IN = Object.fromEntries(Object.entries(PSD_BLEND).map(([k, v]) => [v, k]));
/* bottom-to-top records → flat list of drawable layers, with groups applied */
function psdFlattenGroups(recs) {
  const root = { layers: [] }, stack = [root];
  for (const L of recs) {
    if (L.section === 3) { stack.push({ layers: [] }); continue; } // end-of-group marker (comes before the group's children)
    if (L.section === 1 || L.section === 2) {                       // the group itself (comes after its children)
      const g = stack.length > 1 ? stack.pop() : { layers: [] };
      const vis = !(L.flags & 2), op = L.opacity * (L.fill || 1);
      for (const c of g.layers) { c.hidden = c.hidden || !vis; c.opacity *= op; c.name = (L.name || 'Group') + ' / ' + c.name; }
      stack[stack.length - 1].layers.push(...g.layers);
      continue;
    }
    stack[stack.length - 1].layers.push({ name: L.name || 'Layer', hidden: !!(L.flags & 2), opacity: L.opacity * L.fill, blend: PSD_BLEND_IN[L.blend] || 'normal', clip: L.clip, rec: L });
  }
  while (stack.length > 1) { const g = stack.pop(); stack[stack.length - 1].layers.push(...g.layers); }
  return root.layers;
}

/* Start a fresh document (new tab) of size W×H and fill it with layers [{name, rgba|canvas, left, top, w, h, ...}]. */
function openLayersAsDocument(name, W, H, list) {
  if (typeof docPrepareNew === 'function') docPrepareNew();
  stop();
  const k = Math.min(1, 8192 / Math.max(W, H));
  if (k < 1) toast('Large image: scaled to fit 8192 px');
  W = Math.max(1, Math.round(W * k)); H = Math.max(1, Math.round(H * k));
  Object.assign(state, { name, w: W, h: H, frameCount: 1, fps: 12, frame: 0, loop: true, layers: [] });
  state.onion = { on: false, before: 2, after: 1 };
  resizeDocCanvases();
  layerSeq = 1; layerCounter = list.length;
  for (const it of list) {
    const l = createLayer(it.name), c = makeCel(true), g = c.getContext('2d');
    if (it.rgba && it.w > 0 && it.h > 0) {
      const tmp = makeCanvas(it.w, it.h); tmp.getContext('2d').putImageData(new ImageData(it.rgba, it.w, it.h), 0, 0);
      g.save(); g.scale(k, k); g.drawImage(tmp, it.left, it.top); g.restore();
    } else if (it.canvas) g.drawImage(it.canvas, 0, 0, W, H);
    l.cels = new Map([[0, c]]);
    Object.assign(l, { visible: !it.hidden, opacity: clamp(it.opacity ?? 1, 0, 1), blend: it.blend || 'normal', clip: !!it.clip });
    state.layers.push(l);
  }
  if (!state.layers.length) state.layers.push(createLayer('Layer 1'));
  state.activeId = state.layers[state.layers.length - 1].id;
  bindAll(0);
  history.undo.length = 0; history.redo.length = 0;
  resetSelection();
  dirty = false;
  setMode('draw', true);
  refreshAll(); syncTab(); fit();
  if (typeof tlReset === 'function') { tlReset(); setTimeout(() => tlCapture(true), 100); }
}
async function openPSDFile(file) {
  try {
    toast('Opening ' + file.name + '…');
    const psd = await readPSD(await file.arrayBuffer());
    const flat = psdFlattenGroups(psd.layers).filter(L => L.rec.rgba);
    const list = flat.map(L => ({ name: L.name, rgba: L.rec.rgba, left: L.rec.left, top: L.rec.top, w: L.rec.w, h: L.rec.h, hidden: L.hidden, opacity: L.opacity, blend: L.blend, clip: L.clip }));
    if (!list.length && psd.merged) list.push({ name: 'Background', rgba: psd.merged, left: 0, top: 0, w: psd.W, h: psd.H });
    openLayersAsDocument(file.name.replace(/\.(psd|psb)$/i, ''), psd.W, psd.H, list);
    toast(`Opened ${file.name}: ${list.length} layer${list.length === 1 ? '' : 's'}${psd.depth === 16 ? ' (16-bit converted to 8-bit)' : ''}`);
  } catch (e) { toast('Could not open PSD: ' + e.message); console.error(e); }
}

/* ---------- minimal read-only SQLite reader (for .clip) ---------- */
function sqliteOpen(u8) {
  const d = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (String.fromCharCode(...u8.subarray(0, 15)) !== 'SQLite format 3') throw new Error('No database found');
  let ps = d.getUint16(16); if (ps === 1) ps = 65536;
  const reserved = u8[20], usable = ps - reserved;
  const page = n => u8.subarray((n - 1) * ps, n * ps);
  const varint = (b, p) => { let v = 0; for (let i = 0; i < 9; i++) { const c = b[p + i]; if (i === 8) { v = v * 256 + c; return [v, p + 9]; } v = v * 128 + (c & 127); if (!(c & 128)) return [v, p + i + 1]; } return [v, p + 9]; };
  /* full payload of a table-leaf cell, following overflow pages */
  const payload = (pg, off, pageNo) => {
    let [len, p] = varint(pg, off); [, p] = varint(pg, p); // rowid
    const X = usable - 35;
    if (len <= X) return pg.subarray(p, p + len);
    const M = ((usable - 12) * 32 / 255 | 0) - 23;
    let K = M + ((len - M) % (usable - 4)); if (K > X) K = M;
    const out = new Uint8Array(len); out.set(pg.subarray(p, p + K), 0);
    let got = K, ov = new DataView(pg.buffer, pg.byteOffset + p + K, 4).getUint32(0);
    while (got < len && ov) { const o = page(ov), n = Math.min(usable - 4, len - got); out.set(o.subarray(4, 4 + n), got); got += n; ov = new DataView(o.buffer, o.byteOffset, 4).getUint32(0); }
    return out;
  };
  const record = buf => {
    let [hl, p] = varint(buf, 0); const types = []; while (p < hl) { let t; [t, p] = varint(buf, p); types.push(t); }
    let q = hl; const vals = [];
    for (const t of types) {
      if (t === 0) vals.push(null);
      else if (t >= 1 && t <= 6) { const n = [0, 1, 2, 3, 4, 6, 8][t]; let v = 0; for (let i = 0; i < n; i++) v = v * 256 + buf[q + i]; if (buf[q] & 128) v -= Math.pow(2, n * 8); vals.push(v); q += n; }
      else if (t === 7) { vals.push(new DataView(buf.buffer, buf.byteOffset + q, 8).getFloat64(0)); q += 8; }
      else if (t === 8) vals.push(0); else if (t === 9) vals.push(1);
      else if (t >= 12) { const n = t % 2 ? (t - 13) / 2 : (t - 12) / 2; const b = buf.subarray(q, q + n); vals.push(t % 2 ? new TextDecoder().decode(b) : b); q += n; }
      else vals.push(null);
    }
    return vals;
  };
  const rows = root => {
    const out = [], walk = n => {
      const pg = page(n), h = n === 1 ? 100 : 0, type = pg[h], nc = new DataView(pg.buffer, pg.byteOffset + h + 3, 2).getUint16(0);
      const cellPtr = i => new DataView(pg.buffer, pg.byteOffset + h + (type === 5 ? 12 : 8) + i * 2, 2).getUint16(0);
      if (type === 13) { for (let i = 0; i < nc; i++) out.push(record(payload(pg, cellPtr(i), n))); }
      else if (type === 5) { for (let i = 0; i < nc; i++) walk(new DataView(pg.buffer, pg.byteOffset + cellPtr(i), 4).getUint32(0)); walk(new DataView(pg.buffer, pg.byteOffset + h + 8, 4).getUint32(0)); }
    };
    walk(root); return out;
  };
  const tables = {};
  for (const r of rows(1)) if (r[0] === 'table') tables[r[1]] = { root: r[3], sql: r[4] || '' };
  const columns = t => { const m = /\(([\s\S]*)\)/.exec(tables[t].sql); return m ? m[1].split(',').map(s => s.trim().split(/\s+/)[0].replace(/["`[\]]/g, '')) : []; };
  return { tables, rows: t => rows(tables[t].root), columns };
}
const isPNG = b => b && b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
async function openClipFile(file) {
  try {
    const u8 = new Uint8Array(await file.arrayBuffer());
    const head = String.fromCharCode(...u8.subarray(0, 8));
    if (head !== 'CSFCHUNK') throw new Error('Not a Clip Studio file');
    // the SQLite database sits inside a chunk; find its header
    const sig = [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0];
    let at = -1; for (let i = 0; i < u8.length - 16 && at < 0; i++) { if (u8[i] === 83) { let k = 0; while (k < 16 && u8[i + k] === sig[k]) k++; if (k === 16) at = i; } }
    if (at < 0) throw new Error('No layer database found in this .clip file');
    const db = sqliteOpen(u8.subarray(at));
    // canvas size
    let W = 0, H = 0;
    if (db.tables.Canvas) { const cols = db.columns('Canvas'), r = db.rows('Canvas')[0] || []; W = Math.round(r[cols.indexOf('CanvasWidth')] || 0); H = Math.round(r[cols.indexOf('CanvasHeight')] || 0); }
    // the largest PNG stored anywhere (CanvasPreview normally)
    let best = null;
    const order = Object.keys(db.tables).sort((a, b) => (b === 'CanvasPreview') - (a === 'CanvasPreview'));
    for (const t of order) { for (const r of db.rows(t)) for (const v of r) if (isPNG(v) && (!best || v.length > best.length)) best = v; if (best && t === 'CanvasPreview') break; }
    if (!best) throw new Error('This .clip file has no preview picture to open');
    const img = await createImageBitmap(new Blob([best], { type: 'image/png' }));
    if (!W || !H) { W = img.width; H = img.height; }
    const cv = makeCanvas(img.width, img.height); cv.getContext('2d').drawImage(img, 0, 0);
    openLayersAsDocument(file.name.replace(/\.clip$/i, ''), W, H, [{ name: 'Clip Studio picture (flattened)', canvas: cv }]);
    toast('Opened as one flattened picture. For separate layers, save as PSD from Clip Studio (File › Export).', 8000);
  } catch (e) { toast('Could not open .clip: ' + e.message); console.error(e); }
}
function openAnyDocument(file) {
  const n = file.name.toLowerCase();
  if (/\.(psd|psb)$/.test(n)) return openPSDFile(file);
  if (/\.clip$/.test(n)) return openClipFile(file);
  return openDocumentFile(file);
}
function installPSD() {
  const inp = $('#fileOpen'); inp.accept = '.sketchforge,application/json,.psd,.psb,.clip';
  inp.onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) openAnyDocument(f); };
  const F = MENUS[0][1], i = F.findIndex(x => Array.isArray(x) && x[1] === 'exportPSD');
  if (i >= 0) F[i] = ['Save as Photoshop PSD…', 'exportPSD'];
  viewport.addEventListener('dragover', e => { if ([...e.dataTransfer.items].some(it => it.kind === 'file')) e.preventDefault(); });
  viewport.addEventListener('drop', e => {
    const f = [...e.dataTransfer.files].find(x => /\.(psd|psb|clip|sketchforge)$/i.test(x.name)); if (!f) return;
    e.preventDefault(); e.stopPropagation(); openAnyDocument(f);
  }, true);
}
