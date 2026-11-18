/* ---------- animation extras: light table, frame tools, audio, page manager, PSD export ---------- */
const lightPins = [];
function pinTint(f) {
  const c = compositeFrame(f, { skipPaper: true }), g = c.getContext('2d');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#3b8bff'; g.fillRect(0, 0, state.w, state.h);
  return c;
}
function drawPins() {
  for (const f of lightPins) {
    if (f < 0 || f >= state.frameCount || f === state.frame) continue;
    onionCtx.globalAlpha = 0.4; onionCtx.drawImage(pinTint(f), 0, 0);
  }
  onionCtx.globalAlpha = 1;
}
function lightTogglePin() {
  const i = lightPins.indexOf(state.frame);
  if (i >= 0) lightPins.splice(i, 1); else lightPins.push(state.frame);
  updateOnion(); toast(i >= 0 ? 'Light table: frame ' + (state.frame + 1) + ' unpinned' : 'Light table: frame ' + (state.frame + 1) + ' pinned (blue)');
}
/* ---- frame tools ---- */
function cloneAt(l, f) { const c = celCanvas(l, f); return c ? copyCel(c, false) : null; }
function dupFrame() {
  if (state.frameCount >= MAX_FRAMES) { toast('Maximum frames reached'); return; }
  const f = state.frame;
  timelineOp(() => {
    for (const l of state.layers) {
      const src = cloneAt(l, f), m = new Map();
      for (const [k, c] of l.cels) m.set(k > f ? k + 1 : k, c);
      if (src) m.set(f + 1, src);
      l.cels = m;
    }
    state.frameCount++; state.frame = f + 1;
  });
}
let frameClip = null;
function copyFrame() { frameClip = state.layers.map(l => cloneAt(l, state.frame)); toast('Frame ' + (state.frame + 1) + ' copied'); }
function pasteFrame() {
  if (!frameClip) { toast('Copy a frame first'); return; }
  const f = state.frame;
  timelineOp(() => { state.layers.forEach((l, i) => { const c = frameClip[i]; if (c) l.cels.set(f, copyCel(c, false)); }); bindAll(f); });
}
function reverseFrames() {
  const n = state.frameCount;
  timelineOp(() => {
    for (const l of state.layers) {
      if (l.paper) continue;
      const m = new Map(); let prev = null;
      for (let i = 0; i < n; i++) { const c = celCanvas(l, n - 1 - i); if (c && c !== prev) m.set(i, c); prev = c; }
      if (!m.size) m.set(0, makeCel(false));
      l.cels = m;
    }
  });
  toast('Frames reversed');
}
function retime(p) {
  const k = p.factor;
  if (state.frameCount * k > MAX_FRAMES) { toast('Too many frames'); return; }
  timelineOp(() => {
    for (const l of state.layers) { const m = new Map(); for (const [f, c] of l.cels) m.set(f * k, c); l.cels = m; }
    state.frameCount *= k;
  });
  toast('Shooting on ' + k + 's');
}
/* ---- audio ---- */
const aud = { el: null, name: '', peaks: null, dur: 0, url: '', file: null };
function audioStart() { if (!aud.el) return; try { aud.el.currentTime = Math.min(aud.dur, state.frame / state.fps); aud.el.play(); } catch (e) { /* autoplay policy */ } }
function audioStop() { if (aud.el) aud.el.pause(); }
function audioSeek() { if (aud.el && !playing) { try { aud.el.currentTime = Math.min(aud.dur, state.frame / state.fps); } catch (e) { /* ignore */ } } }
function drawAudioStrip() {
  const cv = $('#audioStrip'), wrap = $('#audioWrap'); if (!cv) return;
  wrap.hidden = !aud.el;
  if (!aud.el) return;
  const off = nameW(), w = off + state.frameCount * CELL_W + 40, h = 34;
  cv.width = w; cv.height = h; cv.style.width = w + 'px';
  const g = cv.getContext('2d'); g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#9aa7b5'; g.font = '11px sans-serif'; g.fillText('♪ ' + aud.name, 6, 21);
  const pxPerSec = CELL_W * state.fps, total = Math.min(aud.dur * pxPerSec, state.frameCount * CELL_W);
  g.fillStyle = '#3b556f'; g.fillRect(off, 4, total, h - 8);
  g.fillStyle = '#7fb4e8';
  for (let x = 0; x < total; x++) { const i = Math.min(aud.peaks.length - 1, Math.floor(x / (aud.dur * pxPerSec) * aud.peaks.length)), a = aud.peaks[i] * (h - 10) / 2; g.fillRect(off + x, h / 2 - a, 1, Math.max(1, a * 2)); }
}
async function audioImport(file, quiet) {
  try {
    const buf = await file.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext, ac = new AC();
    const dec = await ac.decodeAudioData(buf.slice(0)); ac.close && ac.close();
    const ch = dec.getChannelData(0), N = 4000, peaks = new Float32Array(N), step = Math.max(1, Math.floor(ch.length / N));
    for (let i = 0; i < N; i++) { let m = 0; for (let j = 0; j < step; j++) m = Math.max(m, Math.abs(ch[i * step + j] || 0)); peaks[i] = m; }
    if (aud.url) URL.revokeObjectURL(aud.url);
    if (aud.el) aud.el.pause();
    aud.url = URL.createObjectURL(file); aud.el = new Audio(aud.url); aud.name = file.name; aud.dur = dec.duration; aud.peaks = peaks; aud.file = file;
    drawAudioStrip(); if (!quiet) toast('Audio loaded: ' + file.name + ' (' + dec.duration.toFixed(1) + ' s) — it plays with the animation');
    if (typeof markDirty === 'function' && !quiet) markDirty();
  } catch (e) { if (!quiet || file.type.startsWith('audio/')) toast(file.type.startsWith('video/') ? 'This video has no sound the browser can read' : 'Could not read that audio file'); }
}
function audioRemove() { audioStop(); aud.el = null; aud.peaks = null; aud.file = null; drawAudioStrip(); markDirty(); toast('Audio removed'); }
/* ---- pages (comic) ---- */
function pagesExpand() { /* every layer gets its own cel on every page */
  for (const l of state.layers) for (let f = 0; f < state.frameCount; f++) if (!l.cels.has(f)) { const c = celCanvas(l, f); l.cels.set(f, c ? copyCel(c, false) : makeCel(false)); }
}
function blankPageCels(f) { for (const l of state.layers) l.cels.set(f, l.paper ? (celCanvas(l, f - 1) ? copyCel(celCanvas(l, f - 1), false) : makeCel(true)) : makeCel(false)); }
function pageAdd() {
  if (state.frameCount >= MAX_FRAMES) { toast('Page limit reached'); return; }
  const at = state.frame + 1;
  timelineOp(() => {
    pagesExpand();
    for (const l of state.layers) { const m = new Map(); for (const [k, c] of l.cels) m.set(k >= at ? k + 1 : k, c); l.cels = m; }
    state.frameCount++;
    for (const l of state.layers) l.cels.set(at, l.paper ? copyCel(l.cels.get(at - 1), false) : makeCel(false));
    state.frame = at;
  });
}
function pageDup(f) {
  timelineOp(() => {
    pagesExpand();
    for (const l of state.layers) { const m = new Map(); for (const [k, c] of l.cels) m.set(k > f ? k + 1 : k, c); m.set(f + 1, copyCel(l.cels.get(f), false)); l.cels = m; }
    state.frameCount++; state.frame = f + 1;
  });
}
function pageDel(f) {
  if (state.frameCount <= 1) { toast('A book needs at least one page'); return; }
  timelineOp(() => {
    pagesExpand();
    for (const l of state.layers) { const m = new Map(); for (const [k, c] of l.cels) { if (k < f) m.set(k, c); else if (k > f) m.set(k - 1, c); } l.cels = m; }
    state.frameCount--; state.frame = Math.min(state.frame, state.frameCount - 1);
  });
}
function pageSwap(a, b) {
  if (a < 0 || b < 0 || a >= state.frameCount || b >= state.frameCount) return;
  timelineOp(() => { pagesExpand(); for (const l of state.layers) { const x = l.cels.get(a); l.cels.set(a, l.cels.get(b)); l.cels.set(b, x); } state.frame = b; });
}
async function pagesExport() {
  const files = [], enc = new TextEncoder();
  for (let i = 0; i < state.frameCount; i++) {
    const c = compositeFrame(i), o = makeCanvas(state.w, state.h), g = o.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, state.w, state.h); g.drawImage(c, 0, 0);
    const blob = await canvasToBlob(o); files.push({ name: `${state.name}_p${String(i + 1).padStart(3, '0')}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
  }
  download(new Blob([makeZip(files)], { type: 'application/zip' }), state.name.replace(/[^\w\- ]+/g, '_') + '_pages.zip');
}
function openPages() {
  let d = $('#pgDialog');
  if (!d) { d = document.createElement('dialog'); d.id = 'pgDialog'; d.className = 'csdlg pgdlg'; document.body.appendChild(d); }
  const render = () => {
    d.innerHTML = `<h5>Pages (${state.frameCount})</h5><div class="pg-grid"></div><div class="row"><button id="pgnAdd">+ New page</button><button id="pgnExp">Export all as PNG (ZIP)</button><button id="pgnClose" class="primary">Close</button></div>`;
    const grid = d.querySelector('.pg-grid');
    for (let i = 0; i < state.frameCount; i++) {
      const cell = document.createElement('div'); cell.className = 'pg-cell' + (i === state.frame ? ' on' : '');
      const cv = document.createElement('canvas'), k = 150 / state.h; cv.width = Math.max(40, Math.round(state.w * k)); cv.height = 150;
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(compositeFrame(i), 0, 0, cv.width, cv.height);
      cv.onclick = () => { gotoFrame(i); render(); };
      const bar = document.createElement('div'); bar.className = 'pg-bar';
      const mk = (t, title, fn) => { const b = document.createElement('button'); b.textContent = t; b.title = title; b.onclick = () => { fn(); render(); }; bar.appendChild(b); };
      mk('◀', 'Move earlier', () => pageSwap(i, i - 1)); mk('▶', 'Move later', () => pageSwap(i, i + 1)); mk('⧉', 'Duplicate', () => pageDup(i)); mk('✕', 'Delete', () => pageDel(i));
      const lab = document.createElement('span'); lab.textContent = i + 1;
      cell.append(cv, lab, bar); grid.appendChild(cell);
    }
    d.querySelector('#pgnAdd').onclick = () => { pageAdd(); render(); };
    d.querySelector('#pgnExp').onclick = pagesExport;
    d.querySelector('#pgnClose').onclick = () => d.close();
  };
  render(); d.showModal();
}
/* ---- PSD export (layers, current frame) ---- */
const PSD_BLEND = { normal: 'norm', multiply: 'mul ', screen: 'scrn', overlay: 'over', darken: 'dark', lighten: 'lite', 'color-dodge': 'div ', 'color-burn': 'idiv', 'hard-light': 'hLit', 'soft-light': 'sLit', difference: 'diff', exclusion: 'smud', hue: 'hue ', saturation: 'sat ', color: 'colr', luminosity: 'lum ' };
function exportPSD() {
  const W = state.w, H = state.h;
  if (W > 30000 || H > 30000) { toast('Canvas too large for PSD'); return; }
  const est = state.layers.length * W * H * 4 / 1048576;
  if (est > 800 && !confirm(`PSD export needs about ${Math.round(est)} MB of memory. Continue?`)) return;
  const chunks = []; let total = 0;
  const push = u => { chunks.push(u); total += u.length; };
  const be = (n, b) => { const u = new Uint8Array(b); for (let i = 0; i < b; i++) u[b - 1 - i] = (n / Math.pow(256, i)) & 255; return u; };
  const ascii = s => new Uint8Array([...s].map(c => c.charCodeAt(0)));
  const layers = state.layers.map(l => {
    const fp = frameParams(l, state.frame), c = makeCanvas(W, H);
    if (fp) { drawLayerOwn.frame = state.frame; drawLayerOwn(c.getContext('2d'), l, fp); drawLayerOwn.frame = undefined; }
    return { l, d: c.getContext('2d').getImageData(0, 0, W, H).data };
  });
  /* layer records */
  const recs = [], chData = [];
  for (const { l, d } of layers) {
    const planes = [3, 0, 1, 2].map(ch => { const p = new Uint8Array(W * H); for (let i = 0, j = ch; i < p.length; i++, j += 4) p[i] = d[j]; return p; });
    const ids = [-1, 0, 1, 2];
    const ascName = l.name.slice(0, 200).replace(/[^\x20-\x7e]/g, '_'), nm = ascii(ascName), padN = (1 + nm.length + 3) & ~3;
    // 'luni' block: the real (Unicode) layer name, so Photoshop shows non-English names correctly
    const uni = l.name.slice(0, 200), luniLen = 4 + uni.length * 2 + ((4 + uni.length * 2) % 4 ? 4 - (4 + uni.length * 2) % 4 : 0);
    const luni = new Uint8Array(12 + luniLen), lv = new DataView(luni.buffer);
    luni.set(ascii('8BIMluni')); lv.setUint32(8, luniLen); lv.setUint32(12, uni.length); for (let k = 0; k < uni.length; k++) lv.setUint16(16 + k * 2, uni.charCodeAt(k));
    const parts = [be(0, 4), be(0, 4), be(H, 4), be(W, 4), be(4, 2)];
    ids.forEach((id, i) => { parts.push(be(id & 0xffff, 2), be(W * H + 2, 4)); });
    parts.push(ascii('8BIM'), ascii(PSD_BLEND[l.blend] || 'norm'), new Uint8Array([Math.round(l.opacity * 255), l.clip ? 1 : 0, l.visible ? 0 : 2, 0]), be(4 + 4 + padN + luni.length, 4), be(0, 4), be(0, 4));
    const pn = new Uint8Array(padN); pn[0] = nm.length; pn.set(nm, 1); parts.push(pn, luni);
    recs.push(parts);
    chData.push(planes);
  }
  let linfoLen = 2; for (const r of recs) for (const p of r) linfoLen += p.length;
  for (const pl of chData) linfoLen += pl.length * (W * H + 2);
  const pad = linfoLen & 1; linfoLen += pad;
  push(ascii('8BPS')); push(be(1, 2)); push(new Uint8Array(6)); push(be(3, 2)); push(be(H, 4)); push(be(W, 4)); push(be(8, 2)); push(be(3, 2));
  push(be(0, 4)); push(be(0, 4));
  push(be(linfoLen + 4 + 4, 4)); /* layer & mask info length (layer info len field + data + global mask len) */
  push(be(linfoLen, 4)); push(be(layers.length, 2));
  recs.forEach(r => r.forEach(push));
  chData.forEach(pl => pl.forEach(p => { push(be(0, 2)); push(p); }));
  if (pad) push(new Uint8Array(1));
  push(be(0, 4));
  /* merged image: flatten on white */
  const flat = makeCanvas(W, H), fg = flat.getContext('2d'); fg.fillStyle = '#fff'; fg.fillRect(0, 0, W, H); fg.drawImage(compositeFrame(state.frame), 0, 0);
  const fd = fg.getImageData(0, 0, W, H).data;
  push(be(0, 2));
  for (let ch = 0; ch < 3; ch++) { const p = new Uint8Array(W * H); for (let i = 0, j = ch; i < p.length; i++, j += 4) p[i] = fd[j]; push(p); }
  const out = new Uint8Array(total); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  download(new Blob([out], { type: 'image/vnd.adobe.photoshop' }), state.name.replace(/[^\w\- ]+/g, '_') + '.psd');
  toast('PSD saved (' + layers.length + ' layers)');
}
function installAnim() {
  const a = document.createElement('div'); a.id = 'audioWrap'; a.hidden = true; a.innerHTML = '<canvas id="audioStrip" height="34"></canvas>';
  $('#timeline').insertBefore(a, $('#tlScroll'));
  $('#tlScroll').addEventListener('scroll', () => { a.scrollLeft = $('#tlScroll').scrollLeft; });
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.weba,.webm,.mp4,.mov,.amr,.3gp,.caf,.aif,.aiff'; inp.hidden = true; document.body.appendChild(inp);
  inp.onchange = () => { if (inp.files[0]) audioImport(inp.files[0]); inp.value = ''; };
  Object.assign(CMD, { lightPin: lightTogglePin, lightClear: () => { lightPins.length = 0; updateOnion(); toast('Light table cleared'); }, dupFrame, copyFrame, pasteFrame, reverseFrames,
    retime: () => proDialog('Shoot on…', [{ k: 'factor', label: 'Hold each drawing', min: 1, max: 6, val: 2 }], retime), audioImport: () => inp.click(), audioRemove, pages: openPages, pageAdd, exportPSD });
  const AN = MENUS.find(m => m[0] === 'Animation')[1];
  AN.push('-', ['Duplicate frame', 'dupFrame'], ['Copy frame', 'copyFrame'], ['Paste frame', 'pasteFrame'], ['Reverse frames', 'reverseFrames'], ['Shoot on 2s / 3s…', 'retime'], '-',
    ['Light table: pin / unpin this frame', 'lightPin'], ['Light table: clear', 'lightClear'], '-', ['Import audio…', 'audioImport'], ['Remove audio', 'audioRemove']);
  const F = MENUS[0][1]; F.splice(F.findIndex(x => x[1] === 'exportPNG') + 1, 0, ['Export PSD (layers)…', 'exportPSD'], ['Page manager…', 'pages']);
  $('#pgAdd').onclick = pageAdd;
  /* new comic: one blank page per frame */
}
function installUiExtras() {
  const apply = on => { document.body.classList.toggle('tools2', on); try { localStorage.setItem('sketchforge.tools2', on ? '1' : ''); } catch (e) { /* ignore */ } setTimeout(() => { try { fit(); } catch (e) { /* ignore */ } }, 0); };
  let on = false; try { on = !!localStorage.getItem('sketchforge.tools2'); } catch (e) { /* ignore */ }
  apply(on);
  CMD.tools2 = () => apply(!document.body.classList.contains('tools2'));
  MENUS.find(m => m[0] === 'View')[1].push('-', ['Two-column tool palette', 'tools2']);
  const b = document.createElement('button'); b.id = 'btn3d'; b.textContent = '🧍 3D model'; b.title = 'Add a posable 3D figure to draw from';
  b.onclick = () => CMD.show3d(); $('#cmdbar').insertBefore(b, $('#tlBtn'));
}
