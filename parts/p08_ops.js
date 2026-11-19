/* ---------- timeline snapshots (structural + transform undo) ---------- */
function snapshotTimeline() {
  return {
    frameCount: state.frameCount, frame: state.frame, activeId: state.activeId,
    layers: state.layers.map(l => ({
      l, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked,
      paper: l.paper, px: l.px, py: l.py, clip: l.clip, alock: l.alock, ref: l.ref, draft: l.draft, mask: l.mask, maskEdit: l.maskEdit, vref: l.vref || null, parent: l.parent || null, folder: l.folder || null, tag: l.tag || null,
      cels: Array.from(l.cels.entries()).map(([k, c]) => [k, c, c._xf ? { ...c._xf } : null])
    }))
  };
}
function applyTimeline(s) {
  state.frameCount = s.frameCount;
  state.activeId = s.activeId;
  state.layers = s.layers.map(e => {
    const l = e.l;
    Object.assign(l, { name: e.name, visible: e.visible, opacity: e.opacity, blend: e.blend, locked: e.locked, paper: e.paper, px: e.px, py: e.py, clip: !!e.clip, alock: !!e.alock, ref: !!e.ref, draft: !!e.draft, mask: e.mask || null, maskEdit: !!e.maskEdit, vref: e.vref || null, parent: e.parent || null, folder: e.folder || null, tag: e.tag || null });
    l.cels = new Map(e.cels.map(([k, c, xf]) => { c._xf = xf ? { ...xf } : undefined; return [k, c]; }));
    return l;
  });
  state.frame = clamp(state.frame, 0, state.frameCount - 1);
}
function timelineEntry(before, after) {
  return {
    undo() { applyTimeline(before); },
    redo() { applyTimeline(after); }
  };
}
function refreshAll() {
  bindAll(state.frame);
  refreshStage(); renderLayers(); renderTimeline(); syncLayerControls();
  syncTimelineFields(); updateOnion(); updateStatus(); refreshProps(); drawOverlay(); updateNav();
}
function timelineOp(fn) {
  if (busy() || exporting) return false;
  const before = snapshotTimeline();
  const ok = fn();
  if (ok === false) return false;
  pushHistory(timelineEntry(before, snapshotTimeline()));
  refreshAll();
  return true;
}

/* ---------- layer operations ---------- */
function layerAdd() {
  timelineOp(() => {
    const l = createLayer('Layer ' + (++layerCounter));
    const i = state.layers.findIndex(x => x.id === state.activeId);
    insertLayerAt(l, i < 0 ? state.layers.length : i + 1);
  });
}
function layerDup() {
  const src = activeLayer(); if (!src) return;
  timelineOp(() => {
    const l = createLayer(src.name + ' copy');
    l.cels = new Map(Array.from(src.cels.entries()).map(([k, c]) => [k, copyCel(c, true)]));
    Object.assign(l, { opacity: src.opacity, blend: src.blend, px: src.px, py: src.py });
    bindLayer(l, state.frame);
    insertLayerAt(l, state.layers.indexOf(src) + 1);
  });
}
function layerDel() {
  const l = activeLayer(); if (!l) return;
  if (state.layers.length <= 1) { toast('A document needs at least one layer'); return; }
  timelineOp(() => { removeLayerObj(l); });
}
function layerMove(dir) {
  const l = activeLayer(); if (!l) return;
  const i = state.layers.indexOf(l), j = i + dir;
  if (j < 0 || j >= state.layers.length) return;
  timelineOp(() => { state.layers.splice(i, 1); state.layers.splice(j, 0, l); });
}
function layerMerge() {
  const up = activeLayer(); if (!up) return;
  const i = state.layers.indexOf(up);
  if (i === 0) { toast('No layer below to merge into'); return; }
  const lo = state.layers[i - 1];
  const hasXf = l => Array.from(l.cels.values()).some(c => c._xf && (c._xf.tween || !isIdentP(c._xf) || c._xf.alpha !== 1));
  if (hasXf(up) || hasXf(lo)) { toast('Bake transforms and remove tweens before merging'); return; }
  timelineOp(() => {
    const keys = new Set([...up.cels.keys(), ...lo.cels.keys()]);
    const out = new Map();
    for (const k of keys) {
      const c = makeCel(true);
      const g = c.getContext('2d');
      const a = celCanvas(lo, k), b = celCanvas(up, k);
      if (a) g.drawImage(a, 0, 0);
      if (b) {
        g.globalAlpha = up.opacity; g.globalCompositeOperation = canvasBlend(up.blend);
        g.drawImage(b, 0, 0);
      }
      out.set(k, c);
    }
    lo.cels = out;
    state.layers.splice(i, 1);
    state.activeId = lo.id;
  });
}
function clearLayerFrame() {
  const l = activeLayer(); if (!l) return;
  if (l.locked) { toast('Layer is locked'); return; }
  const k = keyAt(l, state.frame);
  if (k === null) return;
  if (k !== state.frame) {
    timelineOp(() => { l.cels.set(state.frame, makeCel(false)); });
    return;
  }
  const t = { layer: l, cel: l.cels.get(k), ctx: l.cels.get(k).getContext('2d'), created: false, key: k, frame: k };
  const b = { x: 0, y: 0, w: state.w, h: state.h };
  const before = crop(t.cel, b);
  t.ctx.clearRect(0, 0, state.w, state.h);
  t.cel._ink = false;
  pushHistory(celEntry(t, b, before, crop(t.cel, b)));
  afterEdit();
}

/* ---------- timeline operations ---------- */
function insertKeyframe(blank) {
  const l = activeLayer(); if (!l) return;
  const f = state.frame;
  if (blank) {
    timelineOp(() => {
      const had = keyAt(l, f) === f;
      const c = makeCel(false);
      if (had) { const o = l.cels.get(f); if (o._xf) c._xf = { ...o._xf }; }
      l.cels.set(f, c);
    });
    return;
  }
  if (keyAt(l, f) === f) { toast('Already a keyframe'); return; }
  timelineOp(() => {
    if (keyAt(l, f) === null) l.cels.set(f, makeCel(false));
    else ensureKeyHere(l);
  });
}
function removeKeyframe() {
  const l = activeLayer(); if (!l) return;
  if (keyAt(l, state.frame) !== state.frame) { toast('Not a keyframe'); return; }
  timelineOp(() => { l.cels.delete(state.frame); });
}
function insertFrame() {
  if (state.frameCount >= MAX_FRAMES) { toast('Maximum frames reached'); return; }
  const f = state.frame;
  timelineOp(() => {
    for (const l of state.layers) {
      const m = new Map();
      for (const [k, c] of l.cels) m.set(k > f ? k + 1 : k, c);
      l.cels = m;
    }
    state.frameCount++;
  });
}
function removeFrame() {
  if (state.frameCount <= 1) { toast('Need at least one frame'); return; }
  const f = state.frame;
  timelineOp(() => {
    for (const l of state.layers) {
      const m = new Map();
      for (const [k, c] of Array.from(l.cels.entries()).sort((a, b) => a[0] - b[0])) {
        if (k < f) m.set(k, c);
        else if (k === f) { if (!l.cels.has(f + 1)) m.set(f, c); }
        else m.set(k - 1, c);
      }
      l.cels = m;
    }
    state.frameCount--;
    state.frame = Math.min(state.frame, state.frameCount - 1);
  });
}
function setFrameCount(n) {
  n = clamp(Math.round(n) || 1, 1, MAX_FRAMES);
  if (n === state.frameCount) return;
  timelineOp(() => {
    state.frameCount = n;
    for (const l of state.layers) for (const k of Array.from(l.cels.keys())) if (k >= n && k !== 0) l.cels.delete(k);
    state.frame = Math.min(state.frame, n - 1);
  });
}
function createTween() {
  const l = activeLayer(); if (!l) return;
  const k = keyAt(l, state.frame);
  if (k === null) { toast('No keyframe here'); return; }
  if (nextKey(l, k) === null) { toast('Add a later keyframe first, then change its position / rotation / scale'); return; }
  timelineOp(() => { const x = ensureXf(l.cels.get(k)); x.tween = true; });
  toast('Motion tween created — edit the keyframes with the Move tool');
}
function removeTween() {
  const l = activeLayer(); if (!l) return;
  const k = keyAt(l, state.frame);
  if (k === null || !xfOf(l.cels.get(k)).tween) { toast('No tween here'); return; }
  timelineOp(() => { l.cels.get(k)._xf.tween = false; });
}
function setEase(v) {
  const l = activeLayer(); if (!l) return;
  const k = keyAt(l, state.frame);
  if (k === null) return;
  ensureXf(l.cels.get(k)).ease = clamp(v, -100, 100);
  refreshStage(); renderTimeline();
}

/* ---------- frame navigation / onion / playback ---------- */
function gotoFrame(n, quiet) {
  if (stroke || active) return;
  n = clamp(Math.round(n), 0, state.frameCount - 1);
  state.frame = n;
  bindAll(n);
  refreshStage(); updatePlayhead();
  if (!quiet) { renderLayers(); refreshProps(); updateOnion(); }
  syncTimelineFields(); updateStatus(); drawOverlay(); updateNav(); audioSeek();
  if (!playing && typeof sessionSoon === 'function') sessionSoon();
}
function sameDrawing(l, a, b) {
  const fa = frameParams(l, a), fb = frameParams(l, b);
  if (!fa || !fb) return fa === fb;
  return fa.key === fb.key && paramsEq(fa.p, fb.p);
}
/* animation preferences (per user, not per file) */
const ANP_KEY = 'sketchforge.anim.v1';
const ANP = Object.assign({ newKey: 'blank', expose: 1, oMode: 'drawings', oLayers: 'active', oBefore: '#ff3b3b', oAfter: '#2ecc71', oAlpha: 45, pingpong: false },
  (() => { try { return JSON.parse(localStorage.getItem(ANP_KEY) || '{}'); } catch (e) { return {}; } })());
const anpSave = () => { try { localStorage.setItem(ANP_KEY, JSON.stringify(ANP)); } catch (e) { /* ignore */ } };
/* one layer on frame f (with its keyframe transform / rig) */
function layerFrameCanvas(l, f) {
  const fp = frameParams(l, f); if (!fp) return null;
  const c = makeCanvas(state.w, state.h), g = c.getContext('2d');
  const m = layerMat(l, f); if (m) g.transform(...m);
  g.drawImage(fp.cel, 0, 0);
  return c;
}
/* Onion skin. "drawings" mode shows the previous / next DRAWINGS of the active layer (keyframes), so held
   frames don't show the same picture twice; "frames" mode shows neighbouring frames. */
function onionFrames() {
  const o = state.onion, cur = state.frame, before = [], after = [];
  const l = activeLayer();
  if (ANP.oMode === 'drawings' && l && !l.vref) {
    const ks = Array.from(l.cels.keys()).filter(k => k < state.frameCount).sort((a, b) => a - b);
    const k = keyAt(l, cur), i = k === null ? -1 : ks.indexOf(k);
    for (let j = 1; j <= o.before; j++) { const x = i < 0 ? undefined : ks[i - j]; if (x !== undefined) before.push(x); }
    for (let j = 1; j <= o.after; j++) { const x = i < 0 ? ks[j - 1] : ks[i + j]; if (x !== undefined) after.push(x); }
    if (state.loop && i >= 0 && ks.length > 2) { // looping animation: the first drawing follows the last one
      if (!after.length && o.after) after.push(ks[0]);
      if (!before.length && o.before) before.push(ks[ks.length - 1]);
    }
  } else {
    for (let j = 1; j <= o.before; j++) if (cur - j >= 0) before.push(cur - j);
    for (let j = 1; j <= o.after; j++) if (cur + j < state.frameCount) after.push(cur + j);
  }
  return { before, after };
}
function updateOnion() {
  const o = state.onion;
  onionCanvas.style.display = (o.on || lightPins.length) && !playing ? 'block' : 'none';
  onionCtx.clearRect(0, 0, state.w, state.h);
  if (playing) return;
  drawPins();
  if (!o.on) return;
  const l = activeLayer(), one = ANP.oLayers === 'active' && l && !l.vref;
  const draw = (f, color, alpha) => {
    if (f < 0 || f >= state.frameCount || f === state.frame) return;
    if (one && sameDrawing(l, f, state.frame)) return;
    const c = one ? layerFrameCanvas(l, f) : compositeFrame(f, { skipPaper: true });
    if (!c) return;
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color; g.fillRect(0, 0, state.w, state.h);
    onionCtx.globalAlpha = alpha;
    onionCtx.drawImage(c, 0, 0);
  };
  const { before, after } = onionFrames(), a = clamp(ANP.oAlpha, 5, 100) / 100;
  for (let i = before.length; i >= 1; i--) draw(before[i - 1], ANP.oBefore, a / i);
  for (let i = 1; i <= after.length; i++) draw(after[i - 1], ANP.oAfter, a / i);
  onionCtx.globalAlpha = 1;
}
let playTimer = 0, playLast = 0;
function setPlayIcon() { $('#btnPlay').innerHTML = icon(playing ? 'pause' : 'play'); }
function play() {
  if (playing) return stop();
  if (busy()) return;
  playing = true;
  setPlayIcon(); updateOnion();
  const [lo, hi] = playRange();
  if (state.frame < lo || state.frame > hi || (!state.loop && state.frame >= hi)) gotoFrame(lo, true);
  playLast = performance.now();
  let dir = 1;
  audioStart();
  const tick = now => {
    if (!playing) return;
    const step = 1000 / state.fps;
    if (now - playLast >= step) {
      const n = Math.floor((now - playLast) / step);
      playLast += n * step;
      const [lo, hi] = playRange();
      let f = state.frame + n * dir;
      if (ANP.pingpong && hi > lo) { // back and forth
        while (f > hi || f < lo) { if (f > hi) { f = hi - (f - hi); dir = -1; } else { f = lo + (lo - f); dir = 1; } }
        if (f === lo && dir === 1) audioStart();
      } else if (f > hi) {
        if (state.loop) { f = lo + (f - lo) % (hi - lo + 1); audioStart(); } else { gotoFrame(hi, true); return stop(); }
      }
      gotoFrame(f, true);
    }
    playTimer = requestAnimationFrame(tick);
  };
  playTimer = requestAnimationFrame(tick);
}
/* the frames that play: the play range (set from the timeline menu) or the whole animation */
function playRange() {
  const n = state.frameCount;
  let lo = state.playIn == null ? 0 : state.playIn, hi = state.playOut == null ? n - 1 : state.playOut;
  lo = clamp(lo, 0, n - 1); hi = clamp(hi, 0, n - 1);
  return lo <= hi ? [lo, hi] : [0, n - 1];
}
function stop() {
  if (!playing) return;
  playing = false;
  audioStop();
  cancelAnimationFrame(playTimer);
  setPlayIcon();
  renderLayers(); updateOnion(); refreshProps(); drawOverlay();
}

