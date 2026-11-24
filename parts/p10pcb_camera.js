/* ---------- animation camera (3.6) ----------
   Animation › 🎥 Camera…: camera keys on frames (position, zoom, rotation); between keys the camera glides (eased).
   The camera frame (the size of the page) is drawn on the canvas as a dashed box; playback can be watched through
   it; every export (video, GIF, PNG sequence, sprite sheet, current frame) is framed by it. "Use what I see now"
   makes a key from the current view. state.camera = { on, preview, keys: [[frame, { x, y, z, rot }]] } (centre in
   page pixels, zoom, degrees), part of the document (DOC_FIELDS, saved as doc.camera). The page pixels are never
   changed: the camera only frames them (camAt / camMatrix pure). */
const camDefault = () => ({ on: true, preview: true, keys: [] });
/* pure: the camera at frame f (eased between keys; before the first / after the last key = that key) */
function camAt(cam, f, w, h) {
  const base = { x: w / 2, y: h / 2, z: 1, rot: 0 };
  if (!cam || !cam.keys || !cam.keys.length) return base;
  const ks = cam.keys.slice().sort((a, b) => a[0] - b[0]);
  if (f <= ks[0][0]) return { ...base, ...ks[0][1] };
  if (f >= ks[ks.length - 1][0]) return { ...base, ...ks[ks.length - 1][1] };
  let i = 0; while (f > ks[i + 1][0]) i++;
  const [fa, A] = ks[i], [fb, B] = ks[i + 1], t0 = (f - fa) / (fb - fa), t = t0 * t0 * (3 - 2 * t0);
  const L = (a, b) => a + (b - a) * t;
  return { x: L(A.x, B.x), y: L(A.y, B.y), z: Math.exp(L(Math.log(A.z), Math.log(B.z))), rot: L(A.rot, B.rot) };
}
/* pure: page → output picture matrix [a, b, c, d, e, f] for a camera on a w × h page */
function camMatrix(c, w, h) {
  const r = -c.rot * Math.PI / 180, co = Math.cos(r) * c.z, si = Math.sin(r) * c.z;
  return [co, si, -si, co, w / 2 - (co * c.x - si * c.y), h / 2 - (si * c.x + co * c.y)];
}
const camOn = () => !!(state.camera && state.camera.on && state.camera.keys.length);
const CAM = { export: 0, previewing: false };
/* the 4 corners of the camera frame in page pixels (for the dashed box) */
function camCorners(c, w, h) {
  const [a, b, cc, d, e, f] = camMatrix(c, w, h), det = a * d - b * cc;
  const inv = (X, Y) => { const x = X - e, y = Y - f; return [(d * x - cc * y) / det, (-b * x + a * y) / det]; };
  return [inv(0, 0), inv(w, 0), inv(w, h), inv(0, h)];
}
function camPanel() {
  if (!state.camera) state.camera = camDefault();
  let p = $('#camPanel'); if (p) { p.remove(); }
  p = document.createElement('div'); p.id = 'camPanel'; p.className = 'refwin campanel';
  p.innerHTML = `<div class="refhead"><b>🎥 Camera</b><span style="flex:1"></span><button type="button" data-a="close" title="Close">✕</button></div><div class="cambody"></div>`;
  document.body.appendChild(p);
  p.querySelector('[data-a=close]').onclick = () => { p.remove(); drawOverlay(); };
  camPanelFill();
}
function camPanelFill() {
  const p = $('#camPanel'); if (!p) return;
  const body = p.querySelector('.cambody'); body.innerHTML = '';
  const C = state.camera, here = C.keys.find(k => k[0] === state.frame), cur = camAt(C, state.frame, state.w, state.h);
  checkbox(body, 'Use the camera (playback and exports)', C.on, v => { C.on = v; markDirty(); drawOverlay(); });
  checkbox(body, 'Watch playback through the camera', C.preview, v => { C.preview = v; });
  const set = (k, v) => { const now = { ...camAt(C, state.frame, state.w, state.h), [k]: v }; camSetKey(state.frame, now, true); };
  const info = document.createElement('p'); info.className = 'muted small';
  info.textContent = here ? `Frame ${state.frame + 1}: camera key — change it below.` : `Frame ${state.frame + 1}: no key here (moving the sliders adds one).`;
  body.appendChild(info);
  slider(body, 'Left ↔ right', 0, state.w, 1, Math.round(cur.x), v => v + ' px', v => set('x', v));
  slider(body, 'Up ↕ down', 0, state.h, 1, Math.round(cur.y), v => v + ' px', v => set('y', v));
  slider(body, 'Zoom', 25, 800, 5, Math.round(cur.z * 100), v => v + '%', v => set('z', v / 100));
  slider(body, 'Rotation', -180, 180, 1, Math.round(cur.rot), v => v + '°', v => set('rot', v));
  const row = document.createElement('div'); row.className = 'btnrow';
  row.innerHTML = `<button type="button" data-a="see">📷 Use what I see now</button><button type="button" data-a="key">＋ Key here</button><button type="button" data-a="del"${here ? '' : ' disabled'}>Remove this key</button>`;
  body.appendChild(row);
  row.querySelector('[data-a=see]').onclick = camFromView;
  row.querySelector('[data-a=key]').onclick = () => camSetKey(state.frame, { ...cur });
  row.querySelector('[data-a=del]').onclick = () => camDelKey(state.frame);
  const list = document.createElement('p'); list.className = 'muted small';
  list.innerHTML = C.keys.length ? 'Keys on frames: ' + C.keys.slice().sort((a, b) => a[0] - b[0]).map(k => `<a href="#" data-f="${k[0]}">${k[0] + 1}</a>`).join(', ') : 'No camera keys yet: frame the shot with the view (zoom / move / rotate), then 📷 Use what I see now. Go to another frame and do it again: the camera glides between them.';
  list.querySelectorAll('[data-f]').forEach(a => a.onclick = e => { e.preventDefault(); gotoFrame(+a.dataset.f); });
  body.appendChild(list);
}
function camSetKey(f, c, quiet) {
  const C = state.camera, before = JSON.stringify(C.keys);
  C.keys = C.keys.filter(k => k[0] !== f); C.keys.push([f, { x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(4), rot: +c.rot.toFixed(2) }]); C.keys.sort((a, b) => a[0] - b[0]);
  const after = JSON.stringify(C.keys);
  pushHistory({ undo() { C.keys = JSON.parse(before); camPanelFill(); drawOverlay(); }, redo() { C.keys = JSON.parse(after); camPanelFill(); drawOverlay(); }, bytes: 0 });
  markDirty(); drawOverlay(); if (!quiet) camPanelFill(); else { const p = $('#camPanel'); if (p) p.querySelector('.muted.small').textContent = `Frame ${state.frame + 1}: camera key — change it below.`; }
}
function camDelKey(f) {
  const C = state.camera, before = JSON.stringify(C.keys); C.keys = C.keys.filter(k => k[0] !== f); const after = JSON.stringify(C.keys);
  pushHistory({ undo() { C.keys = JSON.parse(before); camPanelFill(); drawOverlay(); }, redo() { C.keys = JSON.parse(after); camPanelFill(); drawOverlay(); }, bytes: 0 });
  markDirty(); camPanelFill(); drawOverlay();
}
/* a key from the current view: the page point at the middle of the screen, the zoom compared with "fit" */
function camFromView() {
  const r = vpRect(), mid = toDoc({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
  const fitZ = Math.min(r.width / state.w, r.height / state.h);
  camSetKey(state.frame, { x: mid.x, y: mid.y, z: Math.max(0.25, view.scale / fitZ), rot: view.rot || 0 });
  toast('Camera key on frame ' + (state.frame + 1));
}
/* the stage seen through the camera while playing */
function camPreviewApply() {
  const on = playing && camOn() && state.camera.preview;
  if (!on) { if (CAM.previewing) { CAM.previewing = false; viewport.classList.remove('campreview'); applyView(); } return; }
  const r = vpRect(), fitZ = Math.min(r.width / state.w, r.height / state.h) * 0.96;
  const [a, b, c, d, e, f] = camMatrix(camAt(state.camera, state.frame, state.w, state.h), state.w, state.h);
  const ox = (r.width - state.w * fitZ) / 2, oy = (r.height - state.h * fitZ) / 2;
  stage.style.transform = `matrix(${a * fitZ},${b * fitZ},${c * fitZ},${d * fitZ},${e * fitZ + ox},${f * fitZ + oy})`;
  if (!CAM.previewing) { CAM.previewing = true; viewport.classList.add('campreview'); viewport.style.setProperty('--camw', state.w * fitZ + 'px'); viewport.style.setProperty('--camh', state.h * fitZ + 'px'); }
}
function installCamera() {
  if (!DOC_FIELDS.includes('camera')) DOC_FIELDS.push('camera'); if (state.camera === undefined) state.camera = null;
  CMD.camera = camPanel;
  CMD.camFromView = () => { if (!state.camera) state.camera = camDefault(); camFromView(); camPanelFill(); };
  const A = MENUS.find(m => m[0] === 'Animation');
  if (A && !A[1].some(x => Array.isArray(x) && x[1] === 'camera')) A[1].push('-', ['🎥 Camera (pan, zoom, rotate)…', 'camera'], ['📷 Camera key from what I see', 'camFromView']);
  // exports are framed by the camera
  const cf0 = compositeFrame; compositeFrame = function (f, opts) {
    const out = cf0.apply(this, arguments);
    if (!CAM.export || !camOn() || (opts && (opts.until != null || opts.view || opts.scale))) return out;
    const o = makeCanvas(out.width, out.height), g = o.getContext('2d'), m = camMatrix(camAt(state.camera, f, state.w, state.h), state.w, state.h);
    if (!(opts && opts.skipPaper)) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, o.width, o.height); }
    g.imageSmoothingQuality = 'high'; g.setTransform(...m); g.drawImage(out, 0, 0); return o;
  };
  // the commands that export (replaced by hand: they are async / not in HOOKABLE; the flag only frames their pictures)
  for (const name of ['runExport', 'exportPNG', 'anSpriteSheet']) {
    const get = { runExport: () => runExport, exportPNG: () => exportPNG, anSpriteSheet: () => anSpriteSheet }[name], f0 = get();
    const wrapped = async function () { CAM.export++; try { return await f0.apply(this, arguments); } finally { CAM.export--; } };
    if (name === 'runExport') runExport = wrapped; else if (name === 'exportPNG') exportPNG = wrapped; else anSpriteSheet = wrapped;
  }
  $('#expGo').onclick = runExport; CMD.exportPNG = exportPNG; // they kept the old functions
  hookAfter('gotoFrame', () => { camPreviewApply(); camPanelFill(); });
  hookAfter('stop', camPreviewApply);
  // the camera frame on the canvas (dashed), with the next / previous framing faint
  hookAfter('drawOverlay', () => {
    if (!state.camera || !state.camera.keys.length || !state.camera.on || CAM.previewing) return;
    const g = ovl.getContext('2d');
    const pts = camCorners(camAt(state.camera, state.frame, state.w, state.h), state.w, state.h).map(([x, y]) => docToScreen(x, y));
    const dpr = window.devicePixelRatio || 1;
    g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.strokeStyle = '#ff5050'; g.lineWidth = 2; g.setLineDash([8, 6]);
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
    g.setLineDash([]); g.fillStyle = '#ff5050'; g.font = 'bold 11px system-ui'; g.fillText('🎥 ' + (state.frame + 1), pts[0][0] + 6, pts[0][1] + 14);
    g.restore();
  }, 20);
}
