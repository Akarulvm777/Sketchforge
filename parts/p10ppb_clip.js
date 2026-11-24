/* ---------- Clip Studio .clip files with their layers (3.5) ----------
   Read from the user's own files only (File › Open, drag and drop). The format is not published; what is read here
   was checked against real files (an illustration and an animation, 23/11/2026):
   - file = "CSFCHUNK" + chunks [name 8 bytes][size u64 BE]: CHNKHead, CHNKExta (external data: [id length u64]
     [id "extrnlid…"][data length u64][data]), CHNKSQLi (SQLite database), CHNKFoot.
   - database: Canvas (size, root folder), Layer (tree: LayerFirstChildIndex / LayerNextIndex, bottom → top; name,
     LayerFolder bit 1 = folder, LayerVisibility bit 1, LayerOpacity 0..256, LayerComposite, LayerClip, offsets),
     Layer.LayerRenderMipmap → Mipmap.BaseMipmapInfo → MipmapInfo.Offscreen → Offscreen (Attribute: "Parameter" =
     width, height, tiles across, tiles down; BlockData = external id). Mask: LayerLayerMaskMipmap, same path.
   - pixels: external data = records [size u32][name length u32][name UTF-16]; "BlockDataBeginChunk" = tile index,
     raw size, 256, 256, has data, [length u32 BE][length u32 LE][zlib]. A colour tile = 256×256 alpha, then
     256×256 BGRA (colour); a mask tile = 256×256 grey.
   - animation: Track (TrackKind 2000, LayerUuidWithTrack = the animation folder) → TrackActionMixer2 (external
     data: [size u32 LE][zlib] of a small object format: a string table, then records [key u32 LE][type u32 LE]
     [value]). Each clip has Start / End on the timeline, Start / End of its own timing, then Frame (Double[]) and
     Tag (String[] = the name of the cel shown from that frame).
   - sound: an audio layer (LayerType 8720) → CanvasItem (ItemType "Audio") → CanvasItemBinary → the file itself.
   Raster pixels of every layer type are used (vector and text layers come in as pictures); "Layer color" is applied.
   3D and adjustment settings are not read. If anything fails, the flat preview opens instead (openClipPreview, p10pp). */
const CLIP_BLEND = ['normal', 'darken', 'multiply', 'color-burn', 'linear-burn', 'subtract', 'darker-color', 'lighten', 'screen', 'color-dodge',
  'glow-dodge', 'add', 'add-glow', 'lighter-color', 'overlay', 'soft-light', 'hard-light', 'vivid-light', 'linear-light', 'pin-light', 'hard-mix',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity', 'divide'];
const u32be = (u, p) => ((u[p] << 24) | (u[p + 1] << 16) | (u[p + 2] << 8) | u[p + 3]) >>> 0;
const u32le = (u, p) => (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0;
const u64be = (u, p) => u32be(u, p) * 4294967296 + u32be(u, p + 4);
const latin1 = u => { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return s; };
const utf16be = (u, p, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode((u[p + 2 * i] << 8) | u[p + 2 * i + 1]); return s; };

/* pure: the chunks of a .clip file → { ext: Map(id → data), db: SQLite bytes } */
function clipChunks(u) {
  if (latin1(u.subarray(0, 8)) !== 'CSFCHUNK') throw new Error('Not a Clip Studio file');
  const ext = new Map(); let db = null, p = 24;
  while (p + 16 <= u.length) {
    const name = latin1(u.subarray(p, p + 8)), n = u64be(u, p + 8), body = p + 16;
    if (name === 'CHNKExta') {
      const il = u64be(u, body), id = latin1(u.subarray(body + 8, body + 8 + il)), dl = u64be(u, body + 8 + il);
      ext.set(id, u.subarray(body + 16 + il, body + 16 + il + dl));
    } else if (name === 'CHNKSQLi') db = u.subarray(body, body + n);
    if (name === 'CHNKFoot') break;
    p = body + n;
  }
  return { ext, db };
}
/* pure: the tiles stored in one external data block → [{ idx, z (zlib bytes) }] */
function clipBlocks(d) {
  const out = []; let p = 0;
  while (p + 8 <= d.length) {
    const size = u32be(d, p), nl = u32be(d, p + 4);
    if (!(nl > 0 && nl < 64) || utf16be(d, p + 8, nl) !== 'BlockDataBeginChunk') break; // BlockStatus / checksum: the end
    const q = p + 8 + nl * 2, idx = u32be(d, q), has = u32be(d, q + 16);
    if (has) { const len = u32le(d, q + 24); out.push({ idx, z: d.subarray(q + 28, q + 28 + len) }); }
    if (!size) break;
    p += size;
  }
  return out;
}
/* pure: an Offscreen attribute → { W, H, bx, by } (size and tiles across / down) */
function clipAttr(a) {
  const key = 'Parameter'; let at = -1;
  outer: for (let i = 0; i + key.length * 2 <= a.length; i++) { for (let k = 0; k < key.length; k++) if (a[i + 2 * k] !== 0 || a[i + 2 * k + 1] !== key.charCodeAt(k)) continue outer; at = i + key.length * 2; break; }
  if (at < 0) throw new Error('unknown layer layout');
  return { W: u32be(a, at), H: u32be(a, at + 4), bx: u32be(a, at + 8), by: u32be(a, at + 12) };
}
/* pure: Clip Studio's "Layer color": dark pixels take the main colour, light ones the sub colour (alpha kept).
   Colours are stored as 32-bit values per channel (0..4294967295). */
function clipLayerColor(px, main, sub) {
  for (let i = 0; i < px.length; i += 4) {
    const t = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    for (let c = 0; c < 3; c++) px[i + c] = main[c] + (sub[c] - main[c]) * t;
  }
  return px;
}
const clipColor = (r, g, b) => [r, g, b].map(v => Math.round((v || 0) / 4294967295 * 255));
/* pure: one decoded tile → RGBA pixels (colour tiles: alpha plane then BGRA; grey tiles: one plane, used as alpha) */
function clipTileRGBA(raw) {
  const n = 65536, out = new Uint8ClampedArray(n * 4);
  if (raw.length >= n * 5) {
    for (let i = 0; i < n; i++) { const c = n + i * 4; out[i * 4] = raw[c + 2]; out[i * 4 + 1] = raw[c + 1]; out[i * 4 + 2] = raw[c]; out[i * 4 + 3] = raw[i]; }
  } else {
    for (let i = 0; i < n; i++) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = 0; out[i * 4 + 3] = raw[i]; }
  }
  return out;
}
async function clipInflate(z) {
  const s = new Blob([z]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
/* pure: the animation timing object (decompressed TrackActionMixer2) → clips [{ ts, te, ls, le, frames, tags }] */
function clipTiming(d) {
  const n = u32le(d, 16), S = []; let p = 20;
  for (let i = 0; i < n && p < d.length; i++) { const L = d[p]; S.push(latin1(d.subarray(p + 1, p + 1 + L))); p += 1 + L; }
  const K = { Start: S.indexOf('Start'), End: S.indexOf('End'), Frame: S.indexOf('Frame'), Tag: S.indexOf('Tag') };
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength), clips = [], pairs = []; let cur = {};
  for (let i = p; i + 12 <= d.length; i++) {
    const k = u32le(d, i), t = u32le(d, i + 4);
    if ((k === K.Start || k === K.End) && t === 8) { cur[k === K.Start ? 's' : 'e'] = dv.getFloat64(i + 8, true); if ('s' in cur && 'e' in cur) { pairs.push([cur.s, cur.e]); cur = {}; } i += 15; }
    else if (k === K.Frame && t === 14) {
      const m = u32le(d, i + 8); if (m > 100000) continue;
      const frames = []; for (let j = 0; j < m; j++) frames.push(dv.getFloat64(i + 12 + 8 * j, true));
      const [ts, te] = pairs[pairs.length - 2] || [0, 0], [ls, le] = pairs[pairs.length - 1] || [0, 0];
      clips.push({ ts, te, ls, le, frames, tags: [] }); i += 11 + 8 * m;
    } else if (k === K.Tag && t === 17 && clips.length && !clips[clips.length - 1].tags.length) {
      const m = u32le(d, i + 8); if (m > 100000) continue;
      const c = clips[clips.length - 1]; for (let j = 0; j < m; j++) c.tags.push(S[u32le(d, i + 12 + 4 * j)] ?? '');
      i += 11 + 4 * m;
    }
  }
  return clips;
}
/* pure: clips → keyframes [[timeline frame, cel name | null (blank)]], timeline starting at `start`. A clip's own
   timing is fitted to the part of the timeline it covers; a gap after a clip is a blank keyframe. */
function clipKeys(clips, start = 0) {
  const keys = new Map();
  const sorted = clips.slice().sort((a, b) => a.ts - b.ts);
  sorted.forEach((c, n) => {
    const span = c.le - c.ls, k = span > 0 ? (c.te - c.ts) / span : 1;
    c.frames.forEach((f, i) => { const t = Math.max(c.ts, Math.round(c.ts + (f - c.ls) * k)); if (t < c.te) keys.set(t - start, c.tags[i] ?? null); });
    const next = sorted[n + 1];
    if (!next || next.ts > c.te) keys.set(Math.round(c.te) - start, null);
  });
  return [...keys.entries()].filter(([f]) => f >= 0).sort((a, b) => a[0] - b[0]);
}

async function readClip(u8, onStep) {
  const { ext, db: dbBytes } = clipChunks(u8);
  if (!dbBytes) throw new Error('No layer database found');
  const db = sqliteOpen(dbBytes);
  const table = name => { if (!db.tables[name]) return []; const cols = db.columns(name); return db.rows(name).map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]]))); };
  const byId = rows => new Map(rows.map(r => [r.MainId, r]));
  const canvas = table('Canvas')[0]; if (!canvas) throw new Error('No canvas found');
  const W = Math.round(canvas.CanvasWidth), H = Math.round(canvas.CanvasHeight);
  const layers = byId(table('Layer')), mip = byId(table('Mipmap')), mipInfo = byId(table('MipmapInfo')), off = byId(table('Offscreen'));
  const str = v => v == null ? '' : typeof v === 'string' ? v : latin1(v);
  /* the pixels of one mipmap (render or mask) as a canvas the size of its tiles, or null */
  const pixels = async mipId => {
    const m = mip.get(mipId); if (!m) return null;
    const info = mipInfo.get(m.BaseMipmapInfo); if (!info) return null;
    const o = off.get(info.Offscreen); if (!o) return null;
    const data = ext.get(str(o.BlockData)); if (!data) return null;
    const a = clipAttr(o.Attribute), cv = makeCanvas(a.bx * 256, a.by * 256), g = cv.getContext('2d');
    const tiles = clipBlocks(data), raws = await Promise.all(tiles.map(b => clipInflate(b.z))); // unpacked side by side: much faster than one by one
    tiles.forEach((b, i) => g.putImageData(new ImageData(clipTileRGBA(raws[i]), 256, 256), (b.idx % a.bx) * 256, Math.floor(b.idx / a.bx) * 256));
    return cv;
  };
  const report = { layers: 0, skipped: [], frames: 0 };
  /* one layer drawn on a full canvas (mask applied), or null */
  const rendered = new Map();
  const render = L => { if (!rendered.has(L.MainId)) rendered.set(L.MainId, renderNow(L)); return rendered.get(L.MainId); };
  const renderNow = async L => {
    const cv = await pixels(L.LayerRenderMipmap); if (!cv) return null;
    const out = makeCanvas(W, H), g = out.getContext('2d');
    g.drawImage(cv, (L.LayerRenderOffscrOffsetX || 0) + (L.LayerOffsetX || 0), (L.LayerRenderOffscrOffsetY || 0) + (L.LayerOffsetY || 0));
    if (L.LayerLayerMaskMipmap && L.LayerMasking) {
      const mk = await pixels(L.LayerLayerMaskMipmap);
      if (mk) { g.globalCompositeOperation = 'destination-in'; g.drawImage(mk, (L.LayerMaskOffscrOffsetX || 0) + (L.LayerMaskOffsetX || 0), (L.LayerMaskOffscrOffsetY || 0) + (L.LayerMaskOffsetY || 0)); g.globalCompositeOperation = 'source-over'; }
    }
    if (L.DrawColorEnable) { // "Layer color" (sketch lines shown in blue…)
      const im = g.getImageData(0, 0, W, H);
      clipLayerColor(im.data, clipColor(L.DrawColorMainRed, L.DrawColorMainGreen, L.DrawColorMainBlue),
        L.DrawColorSubRed == null ? [255, 255, 255] : clipColor(L.DrawColorSubRed, L.DrawColorSubGreen, L.DrawColorSubBlue));
      g.putImageData(im, 0, 0);
    }
    return out;
  };
  const children = id => { const out = []; let c = (layers.get(id) || {}).LayerFirstChildIndex; const seen = new Set(); while (c && layers.has(c) && !seen.has(c)) { seen.add(c); out.push(layers.get(c)); c = layers.get(c).LayerNextIndex; } return out; };
  const isFolder = L => !!(L.LayerFolder & 1);
  const visible = L => !!(L.LayerVisibility & 1);
  const blendOf = L => CLIP_BLEND[L.LayerComposite] || 'normal';
  /* a folder used as one cel: its visible layers merged */
  const flatten = async F => {
    const out = makeCanvas(W, H), g = out.getContext('2d');
    for (const L of children(F.MainId)) {
      if (!visible(L)) continue;
      const c = isFolder(L) ? await flatten(L) : await render(L); if (!c) continue;
      g.globalAlpha = (L.LayerOpacity ?? 256) / 256; g.globalCompositeOperation = canvasBlend(blendOf(L)); g.drawImage(c, 0, 0);
    }
    return out;
  };
  // animation folders: track → its keyframes
  const anim = new Map();
  const tl = table('TimeLine')[0], fps = tl ? Math.round(tl.FrameRate || 12) : 12, start = tl ? Math.round(tl.StartFrame || 0) : 0;
  const frames = tl ? Math.max(1, Math.round((tl.EndFrame || 1) - start)) : 1;
  const uuidOf = new Map([...layers.values()].map(L => [str(L.LayerUuid).replace(/-/g, '').toLowerCase(), L.MainId]));
  for (const t of table('Track')) {
    if (t.TrackKind !== 2000 || !t.LayerUuidWithTrack || !t.TrackActionMixer2) continue;
    const id = uuidOf.get([...t.LayerUuidWithTrack].map(b => b.toString(16).padStart(2, '0')).join(''));
    const data = ext.get(str(t.TrackActionMixer2)); if (!id || !data) continue;
    try { anim.set(id, clipKeys(clipTiming(await clipInflate(data.subarray(4))), start)); } catch (e) { console.warn('clip timing', e); }
  }
  // walk the tree bottom → top
  const out = [];
  const walk = async (id, folder) => {
    for (const L of children(id)) {
      const name = str(L.LayerName) || 'Layer';
      onStep && onStep(name);
      if (L.LayerType === 1584) { out.push({ name, paper: true, visible: visible(L) }); continue; } // paper
      if (L.LayerType === 8720) { report.sound = true; continue; } // audio layer: its sound is read below
      const hidden = !visible(L) || (folder && !folder.visible);
      const opacity = ((L.LayerOpacity ?? 256) / 256) * (folder ? folder.opacity : 1);
      if (anim.has(L.MainId)) { // an animation folder → one layer whose keyframes are its cels
        const cels = new Map(), pool = new Map();
        for (const C of children(L.MainId)) if (!pool.has(str(C.LayerName))) pool.set(str(C.LayerName), C);
        const keys = [];
        for (const [f, tag] of anim.get(L.MainId)) {
          let cv = null; const C = tag != null ? pool.get(tag) : null;
          if (C) { if (!cels.has(tag)) cels.set(tag, isFolder(C) ? await flatten(C) : await render(C)); cv = cels.get(tag); }
          keys.push([f, cv]);
        }
        out.push({ name, keys, hidden, opacity, blend: blendOf(L), clip: !!L.LayerClip, folder: folder && folder.ref });
        report.frames += keys.filter(k => k[1]).length; report.layers++;
        continue;
      }
      if (isFolder(L)) { // nested folders join their top folder (Inkvessa folders are one level)
        await walk(L.MainId, { ref: folder ? folder.ref : { name }, visible: !hidden, opacity });
        continue;
      }
      const cv = await render(L);
      if (!cv) { report.skipped.push(name); continue; }
      out.push({ name, canvas: cv, hidden, opacity, blend: blendOf(L), clip: !!L.LayerClip, folder: folder && folder.ref });
      report.layers++;
    }
  };
  await walk(canvas.CanvasRootFolder, null);
  // sound: CanvasItem (ItemType "Audio") → CanvasItemBinary → the file as it was imported (mp3, wav…)
  let audio = null;
  if (report.sound) {
    const bins = byId(table('CanvasItemBinary')), item = table('CanvasItem').find(i => str(i.ItemType) === 'Audio');
    const bin = item && bins.get(item.ItemBinaryMainIndex), data = bin && ext.get(str(bin.ItemBinaryData));
    if (data) audio = new File([data], (str(item.ItemCaption) || 'sound') + '.' + (str(item.ItemFileExtension) || 'mp3'));
    else report.skipped.push('sound');
  }
  return { W, H, fps, frames: anim.size ? frames : 1, layers: out, report, audio };
}

/* a new document from the layers read */
function clipDocument(name, R) {
  if (typeof docPrepareNew === 'function') docPrepareNew();
  stop();
  // every cel is a full page: on a phone / iPad, a big animation is opened smaller so it fits in memory (Safari
  // empties canvases past ~300 MB); on a computer up to ~2 GB
  const cels = R.layers.reduce((n, l) => n + (l.keys ? l.keys.length : 1), 0), budget = HISTORY_BYTES < 200e6 ? 280e6 : 2e9;
  const k = Math.min(1, 8192 / Math.max(R.W, R.H), Math.sqrt(budget / Math.max(1, cels * R.W * R.H * 4)));
  const W = Math.max(1, Math.round(R.W * k)), H = Math.max(1, Math.round(R.H * k));
  R.scaled = k < 1 ? Math.round(k * 100) : 0;
  Object.assign(state, { name, w: W, h: H, frameCount: R.frames, fps: R.fps, frame: 0, loop: true, layers: [] });
  state.onion = { on: false, before: 2, after: 1 };
  resizeDocCanvases();
  layerSeq = 1; layerCounter = R.layers.length;
  const folders = new Map();
  const draw = cv => { const c = makeCel(!!cv); if (cv) c.getContext('2d').drawImage(cv, 0, 0, W, H); return c; };
  for (const it of R.layers) {
    let l;
    if (it.paper) { l = createLayer('Paper', '#ffffff'); l.paper = true; l.locked = true; l.visible = it.visible; state.layers.push(l); continue; }
    l = createLayer(it.name);
    if (it.keys) { l.cels = new Map(it.keys.map(([f, cv]) => [f, draw(cv)])); if (!l.cels.has(0)) l.cels.set(0, makeCel(false)); }
    else l.cels = new Map([[0, draw(it.canvas)]]);
    Object.assign(l, { visible: !it.hidden, opacity: clamp(it.opacity ?? 1, 0, 1), blend: it.blend || 'normal', clip: !!it.clip });
    if (it.folder && typeof newFolder === 'function') {
      if (!folders.has(it.folder)) folders.set(it.folder, newFolder(it.folder.name)); // hidden folders: their layers are hidden one by one
      l.folder = folders.get(it.folder);
    }
    state.layers.push(l);
  }
  if (!state.layers.length) state.layers.push(createLayer('Layer 1'));
  state.activeId = state.layers[state.layers.length - 1].id;
  bindAll(0);
  history.undo.length = 0; history.redo.length = 0;
  resetSelection();
  dirty = false;
  setMode(R.frames > 1 ? 'anim' : 'draw', true);
  refreshAll(); syncTab(); fit();
  if (typeof tlReset === 'function') { tlReset(); setTimeout(() => tlCapture(true), 100); }
}
async function openClipFile(file) {
  let u8;
  try {
    u8 = new Uint8Array(await file.arrayBuffer());
    if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot unpack the layers');
    toast('Opening ' + file.name + '…');
    let last = 0;
    const R = await readClip(u8, n => { const t = performance.now(); if (t - last > 400) { last = t; toast('Opening ' + file.name + ': ' + n + '…'); } });
    if (!R.layers.some(l => l.canvas || l.keys)) throw new Error('no layer pictures found');
    clipDocument(file.name.replace(/\.clip$/i, ''), R);
    if (R.audio && typeof audioImport === 'function') await audioImport(R.audio, true);
    const r = R.report;
    toast(`Opened ${file.name}: ${r.layers} layer${r.layers === 1 ? '' : 's'}${r.frames ? `, ${r.frames} animation drawings over ${R.frames} frames at ${R.fps} fps` : ''}${R.audio ? ', with its sound' : ''}` +
      (R.scaled ? ` · opened at ${R.scaled} % size so it fits in this device's memory` : '') +
      (r.skipped.length ? ` · not brought over: ${r.skipped.slice(0, 4).join(', ')}${r.skipped.length > 4 ? '…' : ''}` : ''), 8000);
  } catch (e) {
    console.warn('clip layers', e);
    toast('Could not read the layers of this .clip (' + e.message + '): opening the flat picture instead.', 6000);
    return openClipPreview(file);
  }
}
