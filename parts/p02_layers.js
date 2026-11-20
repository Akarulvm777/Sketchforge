/* ---------- canvases: stroke buffer, onion skin, selection, scratch ---------- */
const bufCanvas = makeCanvas(state.w, state.h);
bufCanvas.id = 'stroke-buffer';
const bufCtx = bufCanvas.getContext('2d');
const onionCanvas = makeCanvas(state.w, state.h);
onionCanvas.id = 'onion-canvas';
const onionCtx = onionCanvas.getContext('2d');
const antsCanvas = makeCanvas(state.w, state.h);
antsCanvas.id = 'ants-canvas';
const antsCtx = antsCanvas.getContext('2d');
const snapCanvas = makeCanvas(state.w, state.h);
const snapCtx = snapCanvas.getContext('2d');
const rawCanvas = makeCanvas(state.w, state.h);
const rawCtx = rawCanvas.getContext('2d');
const tmpCanvas = makeCanvas(state.w, state.h);
const tmpCtx = tmpCanvas.getContext('2d');
const pickCanvas = makeCanvas(1, 1);
const pickCtx = pickCanvas.getContext('2d', { willReadFrequently: true });
const DOC_CANVASES = [bufCanvas, onionCanvas, antsCanvas, snapCanvas, rawCanvas, tmpCanvas];

/* ---------- cel transforms (motion tween data) ----------
   A cel (keyframe image) may carry c._xf = {x,y,rot,sx,sy,alpha,tween,ease}.
   Between two keyframes, if the first has tween=true, the transform is
   interpolated frame by frame (the first key's drawing moves/rotates/scales).  */
const IDENT = Object.freeze({ x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1, tween: false, ease: 0 });
const xfOf = c => c._xf || IDENT;
function ensureXf(c) { if (!c._xf) c._xf = { ...IDENT }; return c._xf; }
const isIdentP = p => !p || (p.x === 0 && p.y === 0 && p.rot === 0 && p.sx === 1 && p.sy === 1);
const paramsEq = (a, b) => a.x === b.x && a.y === b.y && a.rot === b.rot && a.sx === b.sx && a.sy === b.sy && a.alpha === b.alpha;

function makeCel(ink) {
  const c = makeCanvas(state.w, state.h);
  c._ink = !!ink;
  return c;
}
function copyCel(src, keepTween) {
  const c = makeCanvas(state.w, state.h);
  c.getContext('2d').drawImage(src, 0, 0);
  c._ink = src._ink !== false;
  if (src._swap) c._swap = src._swap; // a swap drawing keeps its name on copied keyframes (p10pd_swap)
  if (src._face) c._face = { rest: src._face.rest, v: { ...src._face.v } }; // face sliders (p10pe_face): copies are face keys
  if (src._pup) c._pup = { rest: src._pup.rest, pins: src._pup.pins.map(p => p.slice()), cur: src._pup.cur.map(p => p.slice()) }; // puppet pins travel with copies (new keyframes)
  if (src._xf) {
    c._xf = { ...src._xf };
    if (!keepTween) { c._xf.tween = false; c._xf.ease = 0; }
  }
  return c;
}

/* ---------- layers & cels ----------
   A layer owns `cels`: Map(frameIndex -> canvas). A keyframe holds until the
   next keyframe on that layer. layer.canvas / layer.ctx always point at the
   cel shown on the current frame (null when the layer is empty there).     */
function createLayer(name, fill) {
  const c = makeCel(!!fill);
  if (fill) { const g = c.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, state.w, state.h); }
  const l = {
    id: layerSeq++, name, cels: new Map([[0, c]]), canvas: null, ctx: null,
    visible: true, opacity: 1, blend: 'normal', locked: false, paper: false, px: null, py: null,
    clip: false, alock: false, ref: false, draft: false, mask: null, maskEdit: false
  };
  bindLayer(l, state.frame);
  return l;
}
const activeLayer = () => state.layers.find(l => l.id === state.activeId) || null;

function keyAt(l, f) {
  let best = null;
  for (const k of l.cels.keys()) if (k <= f && (best === null || k > best)) best = k;
  return best;
}
function nextKey(l, f) {
  let best = null;
  for (const k of l.cels.keys()) if (k > f && (best === null || k < best)) best = k;
  return best;
}
function celCanvas(l, f) {
  const k = keyAt(l, f);
  return k === null ? null : l.cels.get(k);
}
function bindLayer(l, f) {
  if (l.vref) { l.canvas = l.vref.canvas; l.ctx = null; vrefShow(l, f); return; } // video reference layer (p10pv_video)
  const c = celCanvas(l, f);
  l.canvas = c;
  l.ctx = c ? c.getContext('2d') : null;
}
function bindAll(f) { for (const l of state.layers) bindLayer(l, f); }

const pivotOf = l => [l.px == null ? state.w / 2 : l.px, l.py == null ? state.h / 2 : l.py];

function easeT(t, e) {
  e = (e || 0) / 100;
  if (e > 0) return 1 - Math.pow(1 - t, 1 + e * 2);
  if (e < 0) return Math.pow(t, 1 + (-e) * 2);
  return t;
}
/* The transform of layer l on frame f (interpolated inside a tween). */
function frameParams(l, f) {
  const k = keyAt(l, f);
  if (k === null) return null;
  const c = l.cels.get(k);
  const a = xfOf(c);
  const p = { x: a.x, y: a.y, rot: a.rot, sx: a.sx, sy: a.sy, alpha: a.alpha };
  if (a.tween) {
    const n = nextKey(l, k);
    if (n !== null) {
      const b = xfOf(l.cels.get(n));
      const t = easeT((f - k) / (n - k), a.ease);
      p.x = lerp(a.x, b.x, t); p.y = lerp(a.y, b.y, t);
      p.rot = lerp(a.rot, b.rot, t);
      p.sx = lerp(a.sx, b.sx, t); p.sy = lerp(a.sy, b.sy, t);
      p.alpha = lerp(a.alpha, b.alpha, t);
    }
  }
  return { cel: c, key: k, p };
}

/* 2D affine matrices as [a,b,c,d,e,f] (CSS matrix order) */
function matFrom(p, px, py) {
  const r = p.rot * DEG, cs = Math.cos(r), sn = Math.sin(r);
  const a = cs * p.sx, b = sn * p.sx, c = -sn * p.sy, d = cs * p.sy;
  return [a, b, c, d, p.x + px - (a * px + c * py), p.y + py - (b * px + d * py)];
}
function xfMatrix(p, l) { const [px, py] = pivotOf(l); return matFrom(p, px, py); }
const mulMat = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
/* Bone rig: a layer can follow a parent layer (l.parent = parent id). The layer's full matrix on frame f is
   parent's full matrix × its own keyframe transform. Returns null when the result is the identity. */
function layerParent(l) { return l && l.parent ? state.layers.find(x => x.id === l.parent && x !== l) || null : null; }
function withParent(own, l, f, depth = 0) {
  const par = depth < 16 ? layerParent(l) : null;
  if (!par) return own;
  const pm = layerMat(par, f, depth + 1);
  if (!pm) return own;
  return own ? mulMat(pm, own) : pm;
}
function layerMat(l, f = state.frame, depth = 0) {
  const fp = frameParams(l, f);
  return withParent(fp && !isIdentP(fp.p) ? xfMatrix(fp.p, l) : null, l, f, depth);
}
function invMat(m) {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (!det) return null;
  const ia = d / det, ib = -b / det, ic = -c / det, id = a / det;
  return [ia, ib, ic, id, -(ia * e + ic * f), -(ib * e + id * f)];
}
const applyMat = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function xfCss(p, l) {
  if (l && l.parent) { const m = withParent(p && !isIdentP(p) ? xfMatrix(p, l) : null, l, state.frame); return m ? `matrix(${m.join(',')})` : 'none'; }
  if (!p || isIdentP(p)) return 'none';
  const [px, py] = pivotOf(l);
  return `translate(${p.x}px,${p.y}px) translate(${px}px,${py}px) rotate(${p.rot}deg) scale(${p.sx},${p.sy}) translate(${-px}px,${-py}px)`;
}

function insertLayerAt(l, idx) {
  state.layers.splice(idx, 0, l);
  state.activeId = l.id;
}
function removeLayerObj(l) {
  const i = state.layers.indexOf(l);
  if (i < 0) return;
  state.layers.splice(i, 1);
  if (state.activeId === l.id) {
    const n = state.layers[Math.min(i, state.layers.length - 1)];
    state.activeId = n ? n.id : null;
  }
}

function layerZ(l) { return 10 + state.layers.indexOf(l) * 2; }

function refreshStage() {
  stage.style.width = state.w + 'px';
  stage.style.height = state.h + 'px';
  const wanted = new Set();
  state.layers.forEach((l, i) => {
    const c = l.canvas;
    if (!c) return;
    const fp = frameParams(l, state.frame);
    wanted.add(c);
    const s = c.style;
    s.display = l.visible ? 'block' : 'none';
    s.opacity = String(l.opacity * (fp ? fp.p.alpha : 1));
    s.mixBlendMode = cssBlend(l.blend);
    s.transform = fp ? xfCss(fp.p, l) : 'none';
    s.zIndex = 10 + i * 2;
    if (l.draft) s.opacity = String(l.opacity * (fp ? fp.p.alpha : 1) * 0.45);
    if (c.parentNode !== stage) stage.appendChild(c);
    if (isCustomBlend(l.blend) && !l.vref) { // linear burn, add, vivid light…: a baked view of this layer over what is below
      s.display = 'none';
      const bv = customBlendView(l, i); wanted.add(bv); if (bv.parentNode !== stage) stage.appendChild(bv);
      return;
    }
    const cv = clipViewFor(l, i);
    if (cv) { s.display = 'none'; wanted.add(cv); if (cv.parentNode !== stage) stage.appendChild(cv); }
    if (l.mask && l.maskEdit) {
      const mc = celCanvas(l.mask, state.frame);
      let rv = l._rv; if (!rv || rv.width !== state.w || rv.height !== state.h) rv = l._rv = makeCanvas(state.w, state.h);
      const rg = rv.getContext('2d'); rg.clearRect(0, 0, state.w, state.h);
      if (mc) { rg.drawImage(mc, 0, 0); rg.globalCompositeOperation = 'source-in'; rg.fillStyle = '#ff2a2a'; rg.fillRect(0, 0, state.w, state.h); rg.globalCompositeOperation = 'source-over'; }
      rv.style.cssText = 'opacity:.5;position:absolute;left:0;top:0;pointer-events:none;z-index:' + (11 + i * 2);
      wanted.add(rv); if (rv.parentNode !== stage) stage.appendChild(rv);
    }
  });
  Array.from(stage.children).forEach(ch => {
    if (ch === bufCanvas || ch === onionCanvas || ch === antsCanvas) return;
    if (!wanted.has(ch)) stage.removeChild(ch);
  });
  for (const c of [onionCanvas, antsCanvas, bufCanvas]) if (c.parentNode !== stage) stage.appendChild(c);
  onionCanvas.style.zIndex = 5000;
  antsCanvas.style.zIndex = 9000;
  if (!stroke && !(active && active.usesBuffer)) bufCanvas.style.zIndex = 9999;
  if (typeof subViewInvalidate === 'function') subViewInvalidate();
}

/* ---------- layer panel ---------- */
function mkMini(iconName, on, title, fn) {
  const b = document.createElement('button');
  b.className = 'mini' + (on ? '' : ' off');
  b.innerHTML = icon(iconName);
  b.title = title;
  b.onclick = ev => { ev.stopPropagation(); fn(); };
  return b;
}
function renderLayers() {
  if (typeof renderLayersPro === 'function') return renderLayersPro(); // tick boxes, folders, colours (p10wc)
  const list = $('#layerList');
  list.innerHTML = '';
  for (let i = state.layers.length - 1; i >= 0; i--) {
    const l = state.layers[i];
    const item = document.createElement('div');
    item.className = 'layer-item' + (l.id === state.activeId ? ' active' : '');

    const th = Math.max(16, Math.min(48, Math.round(40 * state.h / state.w)));
    const thumb = makeCanvas(40, th);
    thumb.className = 'thumb';
    if (l.canvas) thumb.getContext('2d').drawImage(l.canvas, 0, 0, thumb.width, thumb.height);

    const name = document.createElement('span');
    name.className = 'name';
    const meta = document.createElement('small');
    meta.textContent = Math.round(l.opacity * 100) + ' %  ' + (l.blend === 'normal' ? 'Normal' : l.blend) + layerFlags(l);
    const nm2 = document.createElement('span');
    nm2.textContent = l.name;
    name.append(meta, nm2);
    name.ondblclick = ev => { ev.stopPropagation(); renameLayer(l); };

    item.append(
      mkMini('eye', l.visible, 'Show / hide', () => toggleVisible(l)),
      thumb, name,
      mkMini('lock', l.locked, 'Lock / unlock', () => toggleLock(l))
    );
    item.onclick = () => selectLayer(l.id);
    list.appendChild(item);
  }
}
function toggleVisible(l) {
  l.visible = !l.visible;
  markDirty(); refreshStage(); renderLayers(); renderTimeline(); updateOnion();
}
function toggleLock(l) {
  l.locked = !l.locked;
  renderLayers(); renderTimeline();
}
function renameLayer(l) {
  askText('Layer name', l.name, v => {
    if (!v) return;
    l.name = v.slice(0, 40);
    renderLayers(); renderTimeline(); markDirty();
  });
}
function selectLayer(id) {
  if (busy()) return;
  state.activeId = id;
  renderLayers(); renderTimeline(); syncLayerControls(); refreshProps(); drawOverlay();
}
function syncLayerControls() {
  { const l = activeLayer(), c = $('#btnClip'), m = $('#btnMask'); if (c) c.classList.toggle('on', !!(l && l.clip)); if (m) m.classList.toggle('on', !!(l && l.mask)); }
  const l = activeLayer();
  $('#layerOpacity').value = l ? Math.round(l.opacity * 100) : 100;
  $('#layerOpacityVal').textContent = $('#layerOpacity').value;
  $('#layerBlend').value = l ? l.blend : 'normal';
}

/* ---------- small prompt dialog (window.prompt does not exist in Electron) ---------- */
let promptCb = null;
function askText(title, value, cb) {
  const d = $('#promptDialog');
  $('#pdTitle').textContent = title;
  $('#pdInput').value = value || '';
  promptCb = cb;
  if (typeof d.showModal === 'function') { d.showModal(); $('#pdInput').select(); }
}
$('#promptForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#pdInput').value.trim();
  $('#promptDialog').close();
  const cb = promptCb; promptCb = null;
  if (cb) cb(v);
});
$('#pdCancel').onclick = () => { promptCb = null; $('#promptDialog').close(); };

