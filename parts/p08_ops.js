/* ---------- timeline snapshots (structural + transform undo) ---------- */
function snapshotTimeline() {
  return {
    frameCount: state.frameCount, frame: state.frame, activeId: state.activeId,
    layers: state.layers.map(l => ({
      l, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked,
      paper: l.paper, px: l.px, py: l.py, clip: l.clip, alock: l.alock, ref: l.ref, draft: l.draft, mask: l.mask, maskEdit: l.maskEdit, vref: l.vref || null, parent: l.parent || null,
      cels: Array.from(l.cels.entries()).map(([k, c]) => [k, c, c._xf ? { ...c._xf } : null])
    }))
  };
}
function applyTimeline(s) {
  state.frameCount = s.frameCount;
  state.activeId = s.activeId;
  state.layers = s.layers.map(e => {
    const l = e.l;
    Object.assign(l, { name: e.name, visible: e.visible, opacity: e.opacity, blend: e.blend, locked: e.locked, paper: e.paper, px: e.px, py: e.py, clip: !!e.clip, alock: !!e.alock, ref: !!e.ref, draft: !!e.draft, mask: e.mask || null, maskEdit: !!e.maskEdit, vref: e.vref || null, parent: e.parent || null });
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
function updateOnion() {
  const o = state.onion;
  onionCanvas.style.display = (o.on || lightPins.length) && !playing ? 'block' : 'none';
  onionCtx.clearRect(0, 0, state.w, state.h);
  if (playing) return;
  drawPins();
  if (!o.on) return;
  const draw = (f, color, alpha) => {
    if (f < 0 || f >= state.frameCount || f === state.frame) return;
    const c = compositeFrame(f, { skipPaper: true });
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color; g.fillRect(0, 0, state.w, state.h);
    onionCtx.globalAlpha = alpha;
    onionCtx.drawImage(c, 0, 0);
  };
  for (let i = o.before; i >= 1; i--) draw(state.frame - i, '#ff3b3b', 0.45 / i);
  for (let i = 1; i <= o.after; i++) draw(state.frame + i, '#2ecc71', 0.45 / i);
  onionCtx.globalAlpha = 1;
}
let playTimer = 0, playLast = 0;
function setPlayIcon() { $('#btnPlay').innerHTML = icon(playing ? 'pause' : 'play'); }
function play() {
  if (playing) return stop();
  if (busy()) return;
  playing = true;
  setPlayIcon(); updateOnion();
  if (!state.loop && state.frame >= state.frameCount - 1) gotoFrame(0, true);
  playLast = performance.now();
  audioStart();
  const tick = now => {
    if (!playing) return;
    const step = 1000 / state.fps;
    if (now - playLast >= step) {
      const n = Math.floor((now - playLast) / step);
      playLast += n * step;
      let f = state.frame + n;
      if (f >= state.frameCount) {
        if (state.loop) { f %= state.frameCount; audioStart(); } else { gotoFrame(state.frameCount - 1, true); return stop(); }
      }
      gotoFrame(f, true);
    }
    playTimer = requestAnimationFrame(tick);
  };
  playTimer = requestAnimationFrame(tick);
}
function stop() {
  if (!playing) return;
  playing = false;
  audioStop();
  cancelAnimationFrame(playTimer);
  setPlayIcon();
  renderLayers(); updateOnion(); refreshProps(); drawOverlay();
}

