/* ---------- Import pictures ----------
   File › Import image… (PNG, JPEG, WebP, GIF, BMP, SVG, ICO, AVIF, TIFF, …) puts the picture on a new layer, fitted to
   the page; several pictures (or an animated GIF / WebP / PNG) become animation frames on one layer.
   File › Open… also opens a picture as a new document of its size. Drag & drop pictures on the canvas, or paste one
   copied from another app (Ctrl+V / Edit › Paste image from clipboard).                                              */
const IMG_ACCEPT = 'image/*,.png,.jpg,.jpeg,.jfif,.pjpeg,.webp,.gif,.bmp,.dib,.svg,.ico,.cur,.avif,.apng,.tif,.tiff,.heic,.heif';
const isImageFile = f => /^image\//.test(f.type || '') || /\.(png|jpe?g|jfif|pjpeg|webp|gif|bmp|dib|svg|ico|cur|avif|apng|tiff?|heic|heif)$/i.test(f.name || '');
const isTiff = f => /\.tiff?$/i.test(f.name || '') || f.type === 'image/tiff';
const isHeic = f => /\.(heic|heif)$/i.test(f.name || '') || /heic|heif/.test(f.type || '');

/* ---------- baseline TIFF reader: strips, none / LZW / PackBits / Deflate, 8 or 16 bits, grey / RGB(A) / palette ---------- */
async function readTIFF(buf) {
  const dv = new DataView(buf), le = dv.getUint16(0) === 0x4949;
  const u16 = o => dv.getUint16(o, le), u32 = o => dv.getUint32(o, le);
  if (u16(2) !== 42) throw new Error('not a TIFF file');
  const ifd = u32(4), n = u16(ifd), T = {};
  const SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4), sz = (SZ[type] || 1) * cnt;
    const off = sz <= 4 ? e + 8 : u32(e + 8), vals = [];
    for (let k = 0; k < Math.min(cnt, 1 << 16); k++) vals.push(type === 3 ? u16(off + k * 2) : type === 4 ? u32(off + k * 4) : dv.getUint8(off + k));
    T[tag] = vals;
  }
  const W = T[256][0], H = T[257][0], bps = (T[258] || [1])[0], comp = (T[259] || [1])[0], photo = (T[262] || [1])[0];
  const spp = (T[277] || [1])[0], rps = (T[278] || [H])[0], pred = (T[317] || [1])[0], planar = (T[284] || [1])[0];
  if (T[322]) throw new Error('tiled TIFF files are not supported — save it as PNG');
  if (planar !== 1) throw new Error('planar TIFF files are not supported');
  if (bps !== 8 && bps !== 16 && !(bps === 1 && spp === 1)) throw new Error(bps + '-bit TIFF is not supported');
  const offs = T[273], cnts = T[279], bpp = spp * bps / 8, rowB = bps === 1 ? Math.ceil(W / 8) : W * bpp;
  const raw = new Uint8Array(rowB * H); let pos = 0;
  for (let s = 0; s < offs.length; s++) {
    let src = new Uint8Array(buf, offs[s], cnts ? cnts[s] : rowB * rps), out;
    if (comp === 1) out = src;
    else if (comp === 32773) out = unpackBits(src, rowB * Math.min(rps, H - s * rps));
    else if (comp === 5) out = lzwTIFF(src, rowB * Math.min(rps, H - s * rps));
    else if (comp === 8 || comp === 32946) out = new Uint8Array(await new Response(new Blob([src]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    else throw new Error('this TIFF compression is not supported — save it as PNG');
    raw.set(out.subarray(0, Math.min(out.length, raw.length - pos)), pos); pos += out.length;
  }
  if (pred === 2 && bps === 8) for (let y = 0; y < H; y++) for (let x = spp; x < rowB; x++) raw[y * rowB + x] = (raw[y * rowB + x] + raw[y * rowB + x - spp]) & 255;
  const rgba = new Uint8ClampedArray(W * H * 4), map = T[320];
  const smp = (y, x, c) => bps === 16 ? raw[y * rowB + (x * spp + c) * 2 + (le ? 1 : 0)] : raw[y * rowB + x * spp + c];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4; let r, g, b, a = 255;
    if (bps === 1) { const bit = (raw[y * rowB + (x >> 3)] >> (7 - (x & 7))) & 1; r = g = b = (photo === 0 ? !bit : bit) ? 255 : 0; }
    else if (photo === 3 && map) { const i = smp(y, x, 0), m = map.length / 3; r = map[i] >> 8; g = map[m + i] >> 8; b = map[2 * m + i] >> 8; }
    else if (photo === 2 || spp >= 3) { r = smp(y, x, 0); g = smp(y, x, 1); b = smp(y, x, 2); if (spp > 3) a = smp(y, x, 3); }
    else { r = g = b = photo === 0 ? 255 - smp(y, x, 0) : smp(y, x, 0); if (spp > 1) a = smp(y, x, 1); }
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
  }
  const c = makeCanvas(W, H); c.getContext('2d').putImageData(new ImageData(rgba, W, H), 0, 0);
  return c;
}
function unpackBits(src, n) {
  const out = new Uint8Array(n); let i = 0, o = 0;
  while (i < src.length && o < n) {
    const h = (src[i++] << 24) >> 24;
    if (h >= 0) { for (let k = 0; k <= h && o < n; k++) out[o++] = src[i++]; }
    else if (h !== -128) { const v = src[i++]; for (let k = 0; k < 1 - h && o < n; k++) out[o++] = v; }
  }
  return out;
}
function lzwTIFF(src, n) {
  const out = new Uint8Array(n); let o = 0, bit = 0, width = 9, dict = [], prev = null;
  const reset = () => { dict = []; for (let i = 0; i < 256; i++) dict[i] = [i]; dict[256] = dict[257] = null; width = 9; };
  const read = () => { let v = 0; for (let k = 0; k < width; k++) { const b = bit >> 3; v = (v << 1) | ((src[b] >> (7 - (bit & 7))) & 1); bit++; } return v; };
  reset();
  while ((bit + width) <= src.length * 8 && o < n) {
    const code = read();
    if (code === 257) break;
    if (code === 256) { reset(); prev = null; continue; }
    let ent = dict[code];
    if (!ent) ent = prev.concat([prev[0]]);
    for (const v of ent) { if (o < n) out[o++] = v; }
    if (prev) dict.push(prev.concat([ent[0]]));
    prev = ent;
    if (dict.length + 1 >= (1 << width) && width < 12) width++;
  }
  return out;
}

/* ---------- decode any picture into frames [{ canvas, dur }] ---------- */
async function decodePicture(file, allFrames) {
  if (isTiff(file)) return [{ canvas: await readTIFF(await file.arrayBuffer()), dur: 0 }];
  if (allFrames && 'ImageDecoder' in window && /gif|webp|png|apng/i.test(file.type || file.name)) {
    try {
      const type = file.type || (/\.gif$/i.test(file.name) ? 'image/gif' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/png');
      const dec = new ImageDecoder({ data: await file.arrayBuffer(), type });
      await dec.tracks.ready;
      const N = dec.tracks.selectedTrack ? dec.tracks.selectedTrack.frameCount : 1;
      if (N > 1) {
        const out = [];
        for (let i = 0; i < Math.min(N, MAX_FRAMES); i++) {
          const { image } = await dec.decode({ frameIndex: i });
          const c = makeCanvas(image.displayWidth, image.displayHeight); c.getContext('2d').drawImage(image, 0, 0);
          out.push({ canvas: c, dur: (image.duration || 100000) / 1000 }); image.close();
        }
        dec.close();
        return out;
      }
      dec.close();
    } catch (e) { /* fall back to the first frame */ }
  }
  let src = null;
  try { src = await createImageBitmap(file); } catch (e) { /* SVG and a few others: through an <img> */ }
  if (!src) {
    const url = URL.createObjectURL(file);
    try { src = await loadImage(url); } catch (e) {
      throw new Error(isHeic(file) ? 'HEIC photos cannot be read here. On iPhone: Settings › Camera › Formats › Most Compatible, or share the photo as JPEG.' : 'this picture format cannot be read');
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  let w = src.width || src.naturalWidth || 512, h = src.height || src.naturalHeight || 512;
  if (/svg/i.test(file.type || file.name) && Math.max(w, h) < 1024) { const k = 1024 / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); } // vector: draw it sharp
  const c = makeCanvas(w, h); c.getContext('2d').drawImage(src, 0, 0, w, h);
  if (src.close) src.close();
  return [{ canvas: c, dur: 0 }];
}
/* draw a picture into a page-sized cel, fitted (never enlarged) and centred */
function fitCel(pic, cel) {
  const k = Math.min(1, state.w / pic.width, state.h / pic.height), w = pic.width * k, h = pic.height * k;
  const g = cel.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(pic, (state.w - w) / 2, (state.h - h) / 2, w, h);
}
const picName = f => (f.name || 'Picture').replace(/\.[^.]+$/, '');

/* one picture -> new layer; several pictures / animated picture -> frames on one new layer */
async function importPictures(files, opt = {}) {
  files = [...files].filter(isImageFile);
  if (!files.length) return;
  if (exporting || (typeof busy === 'function' && busy())) return;
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  toast('Importing ' + (files.length > 1 ? files.length + ' pictures' : files[0].name) + '…', 1500);
  let frames = [];
  try {
    for (const f of files) frames.push(...(await decodePicture(f, opt.frames !== false)).map(x => ({ ...x, name: picName(f) })));
  } catch (e) { toast('Could not import: ' + e.message, 5000); return; }
  if (!frames.length) return;
  const anim = frames.length > 1;
  timelineOp(() => {
    const l = createLayer(anim ? picName(files[0]) + (files.length > 1 ? ' (sequence)' : ' (animation)') : frames[0].name);
    const start = anim ? state.frame : 0;
    l.cels = new Map();
    if (anim) {
      // one picture per frame, or held as long as the GIF says
      let f = start;
      for (const fr of frames) {
        if (f >= MAX_FRAMES) break;
        const c = makeCel(false); fitCel(fr.canvas, c); c._ink = true; l.cels.set(f, c);
        f += fr.dur ? Math.max(1, Math.round(fr.dur / 1000 * state.fps)) : 1;
      }
      if (f > state.frameCount) state.frameCount = Math.min(MAX_FRAMES, f);
      if (f < state.frameCount) l.cels.set(f, makeCel(false));
      if (start > 0) l.cels.set(0, makeCel(false));
    } else {
      const c = makeCel(false); fitCel(frames[0].canvas, c); c._ink = true; l.cels.set(0, c);
    }
    bindLayer(l, state.frame);
    const i = state.layers.findIndex(x => x.id === state.activeId);
    insertLayerAt(l, i < 0 ? state.layers.length : i + 1);
  });
  if (anim && typeof setMode === 'function' && state.mode !== 'anim') setMode('anim');
  const big = frames.some(fr => fr.canvas.width > state.w || fr.canvas.height > state.h);
  toast(anim ? `${frames.length} frames imported on a new layer` : `Picture added on a new layer${big ? ' (made smaller to fit the page)' : ''} — use Move (V) to place it`, 3500);
}
/* File › Open… with a picture: a new document the size of the picture */
async function openImageDocument(file) {
  try {
    const [fr] = await decodePicture(file, false);
    openLayersAsDocument(picName(file), fr.canvas.width, fr.canvas.height, [{ name: picName(file), canvas: fr.canvas }]);
    toast('Opened ' + file.name);
  } catch (e) { toast('Could not open: ' + e.message, 5000); }
}
function pickPictures(multiple, cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = IMG_ACCEPT; i.multiple = multiple;
  i.onchange = () => { if (i.files.length) cb([...i.files]); };
  i.click();
}
/* picture copied in another app */
async function pasteImageFromSystem(quiet) {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('no clipboard');
    for (const it of await navigator.clipboard.read()) {
      const t = it.types.find(x => x.startsWith('image/'));
      if (t) { const b = await it.getType(t); await importPictures([new File([b], 'Pasted picture.' + t.split('/')[1], { type: t })]); return true; }
    }
  } catch (e) { /* not allowed / nothing */ }
  if (!quiet) toast('No picture on the clipboard — copy a picture in another app first');
  return false;
}

function installImport() {
  let copiedHere = 0, leftApp = 0;
  window.addEventListener('blur', () => { leftApp = Date.now(); });
  Object.assign(CMD, {
    importImage: () => pickPictures(true, files => importPictures(files)),
    importFrames: () => pickPictures(true, files => importPictures(files, { frames: true })),
    pasteImage: () => pasteImageFromSystem(false)
  });
  for (const k of ['copy', 'cut']) { const f = CMD[k]; CMD[k] = () => { copiedHere = Date.now(); f(); }; }
  const F = MENUS[0][1], at = F.findIndex(x => Array.isArray(x) && x[1] === 'save') + 1;
  F.splice(at, 0, '-', ['Import image…', 'importImage', 'Ctrl+Shift+O'], ['Import pictures as animation frames…', 'importFrames'],
    ['Import sound / music…', 'audioImport'], ['Import video…', 'videoImport'], '-');
  const E = MENUS.find(m => m[0] === 'Edit')[1];
  E.splice(E.findIndex(x => Array.isArray(x) && x[1] === 'paste') + 1, 0, ['Paste image from clipboard', 'pasteImage']);
  // File › Open accepts pictures too
  const inp = $('#fileOpen'); inp.accept += ',' + IMG_ACCEPT;
  // drop pictures on the canvas
  viewport.addEventListener('dragover', e => { if ([...e.dataTransfer.items].some(it => it.kind === 'file')) e.preventDefault(); });
  viewport.addEventListener('drop', e => {
    const files = [...e.dataTransfer.files].filter(f => isImageFile(f) && !/\.(psd|psb)$/i.test(f.name));
    if (!files.length) return;
    e.preventDefault(); importPictures(files);
  });
  // Ctrl+V: a picture copied in another app (since you last copied inside Inkvessa) goes on a new layer;
  // otherwise Inkvessa's own clipboard is pasted as before. The browser's paste event carries the picture.
  let pending = 0;
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase(), tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.querySelector('dialog[open]')) return;
    if (k === 'c' || k === 'x') copiedHere = Date.now();
    if (k === 'o' && e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); CMD.importImage(); }
    if (k === 'v' && !e.shiftKey && !e.altKey) {
      e.stopImmediatePropagation(); // no preventDefault: the paste event must come
      clearTimeout(pending); pending = setTimeout(() => { pending = 0; pasteClipboard(); }, 120); // no paste event (some systems): internal paste
    }
  }, true);
  document.addEventListener('paste', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const files = [...(e.clipboardData ? e.clipboardData.files : [])].filter(isImageFile);
    const outside = files.length && !(clipboard && copiedHere > leftApp);
    if (!pending && !outside) return;
    clearTimeout(pending); pending = 0;
    e.preventDefault();
    if (outside) importPictures(files); else pasteClipboard();
  });
}
