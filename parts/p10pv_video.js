/* ---------- Video & sound reference for animation ----------
   Video reference layer: layer.vref = { el (muted <video>), url, name, file, offset (first frame), dur, canvas, fit }.
   bindLayer() shows vref.canvas instead of a cel; the canvas is redrawn from the video at time (frame - offset) / fps.
   It plays with the timeline, is never painted on and is left out of exports (compositeFrame skips it).
   "Convert to frames" decodes the video into ordinary cels on a new layer for tracing / rotoscoping.
   Video and audio files are embedded in the .sketchforge file when small enough (VREF_EMBED_MAX). */
const VREF_EMBED_MAX = 60 * 1048576;

function vrefTime(l, f) { return clamp((f - l.vref.offset) / state.fps, 0, Math.max(0, l.vref.dur - 0.001)); }
function vrefInRange(l, f) { return f >= l.vref.offset && (f - l.vref.offset) / state.fps < l.vref.dur; }
function vrefPaint(l) {
  const v = l.vref, c = v.canvas, g = c.getContext('2d');
  if (c.width !== state.w || c.height !== state.h) { c.width = state.w; c.height = state.h; }
  g.clearRect(0, 0, c.width, c.height);
  if (!v.el || !v.el.videoWidth || !vrefInRange(l, state.frame)) {
    if (!v.el) { g.fillStyle = 'rgba(60,60,70,.55)'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#fff'; g.font = `${Math.round(state.h / 24)}px sans-serif`; g.textAlign = 'center'; g.fillText('Video "' + v.name + '" is missing — Layer › Relink video…', c.width / 2, c.height / 2); }
    return;
  }
  const vw = v.el.videoWidth, vh = v.el.videoHeight, k = v.fit === 'cover' ? Math.max(state.w / vw, state.h / vh) : Math.min(state.w / vw, state.h / vh);
  g.drawImage(v.el, (state.w - vw * k) / 2, (state.h - vh * k) / 2, vw * k, vh * k);
}
/* Called from bindLayer for every frame change. */
function vrefShow(l, f) {
  const v = l.vref; if (!v.el) { vrefPaint(l); return; }
  const t = vrefTime(l, f), inside = vrefInRange(l, f);
  if (playing && inside) {
    if (v.el.paused || Math.abs(v.el.currentTime - t) > 0.2) { try { v.el.currentTime = t; } catch (e) { /* not seekable yet */ } }
    if (v.el.paused) v.el.play().catch(() => { /* ignore */ });
    vrefPaint(l);
    if (!v.loop) { v.loop = true; const step = () => { if (!playing || !l.vref || !state.layers.includes(l)) { v.loop = false; if (l.vref && l.vref.el) l.vref.el.pause(); return; } vrefPaint(l); requestAnimationFrame(step); }; requestAnimationFrame(step); }
    return;
  }
  if (!v.el.paused) v.el.pause();
  if (Math.abs(v.el.currentTime - t) < 0.001 && v.el.readyState >= 2) { vrefPaint(l); return; }
  v.el.onseeked = () => { vrefPaint(l); if (typeof subViewInvalidate === 'function') subViewInvalidate(); };
  try { v.el.currentTime = t; } catch (e) { vrefPaint(l); }
  vrefPaint(l);
}
function vrefMakeEl(url) {
  const el = document.createElement('video');
  el.muted = true; el.playsInline = true; el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.src = url;
  return el;
}
function vrefWaitMeta(el) {
  return new Promise((res, rej) => {
    if (el.readyState >= 2) { res(); return; }
    el.onloadeddata = () => res();
    el.onerror = () => rej(new Error('This video format cannot be played by the browser (try MP4 / H.264 or WebM)'));
  });
}
async function vrefAttach(l, file) {
  const v = l.vref;
  if (v.url) URL.revokeObjectURL(v.url);
  v.url = URL.createObjectURL(file); v.file = file; v.name = file.name;
  v.el = vrefMakeEl(v.url);
  await vrefWaitMeta(v.el);
  v.dur = v.el.duration || 0;
  vrefShow(l, state.frame);
}
async function vrefCreateLayer(file, opt) {
  const l = createLayer('🎬 ' + file.name.replace(/\.[^.]+$/, ''));
  l.locked = true; l.opacity = opt.opacity;
  l.vref = { el: null, url: '', name: file.name, file: null, offset: opt.start, dur: 0, canvas: makeCanvas(state.w, state.h), fit: opt.fit || 'contain' };
  await vrefAttach(l, file);
  return l;
}

/* ---- import dialog ---- */
function openVideoImport(file) {
  let d = $('#vidDialog');
  if (!d) { d = document.createElement('dialog'); d.id = 'vidDialog'; d.className = 'csdlg'; document.body.appendChild(d); }
  d.innerHTML = `<form method="dialog"><h5>Import video: ${file.name.replace(/</g, '&lt;')}</h5>
    <p class="muted small" id="vidInfo" style="margin:0 0 8px">Reading video…</p>
    <label style="grid-template-columns:110px 1fr"><span>Use it as</span><select id="vidHow">
      <option value="ref">Reference layer (plays with the timeline, not exported)</option>
      <option value="frames">Animation frames (trace / paint over each frame)</option></select></label>
    <label><span>Start at frame</span><input type="range" id="vidStart" min="1" max="${state.frameCount}" value="${state.frame + 1}"><output>${state.frame + 1}</output></label>
    <label><span>Opacity</span><input type="range" id="vidOp" min="10" max="100" value="60"><output>60%</output></label>
    <label style="grid-template-columns:110px 1fr"><span>Fit</span><select id="vidFit"><option value="contain">Whole video inside the canvas</option><option value="cover">Fill the canvas (crop)</option></select></label>
    <label style="grid-template-columns:110px 1fr"><span>Timeline</span><span><input type="checkbox" id="vidExtend" checked> add frames so the whole video fits</span></label>
    <label style="grid-template-columns:110px 1fr"><span>Sound</span><span><input type="checkbox" id="vidSound" checked> use the video's sound as the audio track</span></label>
    <p class="muted small" id="vidProg" style="min-height:1.2em"></p>
    <div class="dialog-actions"><button type="button" id="vidCancel">Cancel</button><button type="button" id="vidGo" class="primary">Import</button></div></form>`;
  d.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { r.nextElementSibling.textContent = r.id === 'vidOp' ? r.value + '%' : r.value; });
  const probe = vrefMakeEl(URL.createObjectURL(file));
  let dur = 0;
  vrefWaitMeta(probe).then(() => {
    dur = probe.duration || 0;
    const n = Math.ceil(dur * state.fps);
    $('#vidInfo').textContent = `${probe.videoWidth}×${probe.videoHeight}, ${dur.toFixed(1)} s = ${n} frames at ${state.fps} fps (canvas has ${state.frameCount}).`;
  }).catch(e => { $('#vidInfo').textContent = e.message; $('#vidGo').disabled = true; });
  $('#vidCancel').onclick = () => { URL.revokeObjectURL(probe.src); d.close(); };
  $('#vidGo').onclick = async () => {
    const opt = { how: $('#vidHow').value, start: +$('#vidStart').value - 1, opacity: +$('#vidOp').value / 100, fit: $('#vidFit').value, extend: $('#vidExtend').checked, sound: $('#vidSound').checked };
    $('#vidGo').disabled = true;
    try {
      await videoImportRun(file, opt, dur, $('#vidProg'));
      d.close();
    } catch (e) { $('#vidProg').textContent = e.message; }
    $('#vidGo').disabled = false; URL.revokeObjectURL(probe.src);
  };
  d.showModal();
}
async function videoImportRun(file, opt, dur, prog) {
  const need = opt.start + Math.ceil(dur * state.fps);
  if (opt.how === 'frames') {
    const n = Math.min(Math.ceil(dur * state.fps), MAX_FRAMES - opt.start);
    if (n <= 0) throw new Error('No room left on the timeline');
    const el = vrefMakeEl(URL.createObjectURL(file)); await vrefWaitMeta(el);
    const cels = [];
    for (let i = 0; i < n; i++) {
      await new Promise(r => { el.onseeked = r; el.currentTime = Math.min(dur - 0.001, i / state.fps); });
      const c = makeCel(true), g = c.getContext('2d'), vw = el.videoWidth, vh = el.videoHeight;
      const k = opt.fit === 'cover' ? Math.max(state.w / vw, state.h / vh) : Math.min(state.w / vw, state.h / vh);
      g.drawImage(el, (state.w - vw * k) / 2, (state.h - vh * k) / 2, vw * k, vh * k);
      cels.push(c);
      if (i % 4 === 0) { prog.textContent = `Decoding frame ${i + 1} / ${n}`; await new Promise(r => setTimeout(r, 0)); }
    }
    URL.revokeObjectURL(el.src);
    timelineOp(() => {
      if (opt.extend && opt.start + n > state.frameCount) state.frameCount = Math.min(MAX_FRAMES, opt.start + n);
      const l = createLayer('🎬 ' + file.name.replace(/\.[^.]+$/, '') + ' (frames)');
      l.opacity = opt.opacity; l.cels = new Map();
      if (opt.start > 0) l.cels.set(0, makeCel(false));
      cels.forEach((c, i) => { if (opt.start + i < state.frameCount) l.cels.set(opt.start + i, c); });
      if (opt.start + n < state.frameCount) l.cels.set(opt.start + n, makeCel(false));
      const at = state.layers.findIndex(x => x.id === state.activeId);
      insertLayerAt(l, at + 1);
    });
    toast(`Video converted to ${n} frames — add a layer above it and trace`);
  } else {
    const l = await vrefCreateLayer(file, opt);
    timelineOp(() => {
      if (opt.extend && need > state.frameCount) state.frameCount = Math.min(MAX_FRAMES, need);
      const at = state.layers.findIndex(x => x.id === state.activeId);
      insertLayerAt(l, Math.max(at, state.layers.findIndex(x => x.paper) + 1));
      // keep drawing on the layer that was active
    });
    toast('Video reference added — it plays with the timeline and is not exported');
  }
  if (opt.sound && typeof audioImport === 'function') await audioImport(file, true);
  if (typeof setMode === 'function' && state.frameCount > 1 && state.mode !== 'anim') setMode('anim');
}
function vrefRelink() {
  const l = activeLayer();
  if (!l || !l.vref) { toast('Select a video reference layer first'); return; }
  pickFile('video/*', async f => { try { await vrefAttach(l, f); markDirty(); toast('Video relinked'); } catch (e) { toast(e.message); } });
}
function vrefSettings() {
  const l = activeLayer();
  if (!l || !l.vref) { toast('Select a video reference layer first'); return; }
  proDialog('Video reference', [
    { k: 'start', label: 'Starts at frame', min: 1, max: Math.max(1, state.frameCount), val: l.vref.offset + 1 },
    { k: 'fit', label: 'Fit', type: 'select', val: l.vref.fit, options: [['contain', 'Whole video inside'], ['cover', 'Fill the canvas (crop)']] }
  ], p => { l.vref.offset = p.start - 1; l.vref.fit = p.fit; vrefShow(l, state.frame); refreshStage(); markDirty(); });
}

/* ---- saving media in the document ---- */
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
async function dataURLToFile(url, name) { const b = await (await fetch(url)).blob(); return new File([b], name, { type: b.type }); }
/* layer record extras for buildDocObject */
async function vrefSerialize(l) {
  const v = l.vref;
  const out = { name: v.name, offset: v.offset, fit: v.fit, data: null };
  if (v.file && v.file.size <= VREF_EMBED_MAX) out.data = await blobToDataURL(v.file);
  else if (v.file) toast(`"${v.name}" is too big to keep inside the file (${Math.round(v.file.size / 1048576)} MB) — relink it after opening`);
  return out;
}
async function vrefRestore(l, rec) {
  l.vref = { el: null, url: '', name: rec.name, file: null, offset: rec.offset || 0, dur: 0, canvas: makeCanvas(state.w, state.h), fit: rec.fit || 'contain' };
  if (rec.data) { try { await vrefAttach(l, await dataURLToFile(rec.data, rec.name)); } catch (e) { /* stays "missing" */ } }
  else vrefPaint(l);
}
async function audioSerialize() {
  if (!aud.file) return null;
  if (aud.file.size > VREF_EMBED_MAX) { toast('The audio file is too big to keep inside the document'); return { name: aud.name, data: null }; }
  return { name: aud.name, data: await blobToDataURL(aud.file) };
}
async function audioRestore(rec) {
  if (!rec || !rec.data) return;
  try { await audioImport(await dataURLToFile(rec.data, rec.name), true); } catch (e) { /* ignore */ }
}

function installVideo() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*,.mp4,.webm,.mov,.m4v,.ogv'; inp.hidden = true; document.body.appendChild(inp);
  inp.onchange = () => { if (inp.files[0]) openVideoImport(inp.files[0]); inp.value = ''; };
  Object.assign(CMD, { videoImport: () => inp.click(), vrefRelink, vrefSettings });
  const AN = MENUS.find(m => m[0] === 'Animation')[1], ai = AN.findIndex(x => Array.isArray(x) && x[1] === 'audioImport');
  AN.splice(ai, 0, ['Import video reference…', 'videoImport']);
  AN.splice(AN.findIndex(x => Array.isArray(x) && x[1] === 'audioRemove') + 1, 0, ['Video reference settings…', 'vrefSettings'], ['Relink video…', 'vrefRelink']);
  const LY = MENUS.find(m => m[0] === 'Layer')[1];
  LY.splice(LY.findIndex(x => Array.isArray(x) && x[1] === 'show3d') + 1, 0, ['Add video reference…', 'videoImport'], ['Add sound / voice…', 'audioImport']);
  // dropping a video or audio file on the canvas imports it
  viewport.addEventListener('dragover', e => { if ([...e.dataTransfer.items].some(i => /^(video|audio)\//.test(i.type))) e.preventDefault(); });
  viewport.addEventListener('drop', e => {
    const f = [...e.dataTransfer.files].find(x => /^(video|audio)\//.test(x.type)); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    if (f.type.startsWith('video/')) openVideoImport(f); else audioImport(f);
  }, true);
}
