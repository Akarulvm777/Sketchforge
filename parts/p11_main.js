/* ---------- pointer input ---------- */
const pointers = new Map();
let pinch = null, spaceDown = false;

function vpXY(e) { const r = viewport.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function startPan(e) {
  active = { type: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
}
function pinchStart() {
  const [a, b] = Array.from(pointers.values());
  const r = viewport.getBoundingClientRect();
  const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
  pinch = {
    d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x),
    scale: view.scale, rot: view.rot, doc: screenToDoc(cx, cy)
  };
}
function pinchMove() {
  const [a, b] = Array.from(pointers.values());
  const r = viewport.getBoundingClientRect();
  const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
  view.scale = clamp(pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d), 0.05, 32);
  view.rot = ((pinch.rot + (Math.atan2(b.y - a.y, b.x - a.x) - pinch.ang) / DEG * (view.flip ? -1 : 1) + 540) % 360) - 180;
  anchorView(cx, cy, pinch.doc);
  applyView(); updateCursor();
}

viewport.addEventListener('pointerdown', e => {
  if (playing) stop();
  try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
  const touch = e.pointerType === 'touch';
  if (e.pointerType === 'pen') {
    penCfg.penSeen = true;
    if (!penCfg.announced) { penCfg.announced = true; toast('Pen detected — pressure sensitivity is on'); }
    /* flip-over eraser end (XP-Pen, Wacom, Huion: buttons bit 32 / button 5) */
    if ((e.buttons & 32) || e.button === 5) {
      if (!penCfg.eraserPrev && !stroke && !active) { penCfg.eraserPrev = state.tool; const g = groupTool.eraser || 'eraser'; if (TOOLDEF[g]) selectTool(g); }
    }
  }
  const palmBlock = touch && penCfg.palm && penCfg.penSeen;
  const tapT = performance.now();
  if (touch) pointers.get(e.pointerId).t0 = tapT, pointers.get(e.pointerId).x0 = e.clientX, pointers.get(e.pointerId).y0 = e.clientY;
  if (pointers.size === 2) {
    if (stroke) endStroke(true);
    if (active && active.type !== 'pan') active = null;
    active = null;
    pinchStart();
    return;
  }
  if (pointers.size > 2) return;
  if (stroke || active) return;
  const k = kindOf(state.tool);
  if (e.button === 1 || spaceDown || k === 'hand' || (touch && (!state.fingerDraw || palmBlock))) { startPan(e); return; }
  if (e.button === 2) return;
  const d = toDoc(e);
  switch (k) {
    case 'brush': case 'shape': beginStroke(e); break;
    case 'fill': floodFill(d.x, d.y); break;
    case 'pick': pickAt(e); active = { type: 'pick' }; break;
    case 'select': if (TOOLDEF[state.tool].wand) wandSelect(d.x, d.y, e.shiftKey ? 'add' : e.altKey ? 'subtract' : null); else if (state.tool === 'selpoly') polyClick(e); else selDragStart(e); break;
    case 'poly': polyClick(e); break;
    case 'dragdraw': ddDown(e); break;
    case 'lassofill': selDragStart(e); break;
    case 'gradient': gradDown(e); break;
    case 'text': textClick(e); break;
    case 'move': moveDown(e); break;
    case 'rotate': { const [cx, cy] = vpXY(e); active = { type: 'rotv', cx, cy, a0: Math.atan2(cy - vpCenter()[1], cx - vpCenter()[0]), r0: view.rot }; break; }
    case 'zoom': active = { type: 'zoomv', sx: e.clientX, s0: view.scale, cx: vpXY(e)[0], cy: vpXY(e)[1], moved: false, alt: e.altKey }; break;
  }
});
function pickAt(e) {
  const d = toDoc(e);
  const c = sampleColor(d.x, d.y);
  if (!c) return;
  if (e.altKey) { state.color2 = c; syncColorUI(); } else setColor(c);
}
viewport.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }
  /* cursor ring + status */
  const [vx, vy] = vpXY(e);
  if (cursorEl.dataset.ring === '1' && e.pointerType !== 'touch') {
    cursorEl.style.display = 'block';
    const d = parseFloat(cursorEl.style.width) || 10;
    cursorEl.style.transform = `translate(${vx - d / 2}px,${vy - d / 2}px)`;
  } else cursorEl.style.display = 'none';
  const dd = toDoc(e);
  $('#statusPos').textContent = `${Math.floor(dd.x)}, ${Math.floor(dd.y)}`;
  if (pinch && pointers.size === 2) { pinchMove(); return; }
  if (stroke) { if (e.pointerId === stroke.pointerId) moveStroke(e); return; }
  const a = active;
  if (!a) {
    polyMove(e);
    if (kindOf(state.tool) === 'move' && !sel.active) {
      const h = hitHandle(e);
      viewport.style.cursor = h === 'rot' ? 'grab' : h === 'pivot' ? 'crosshair' : h ? 'nwse-resize' : 'move';
    } else viewport.style.cursor = '';
    return;
  }
  switch (a.type) {
    case 'pan': view.x = a.vx + (e.clientX - a.sx); view.y = a.vy + (e.clientY - a.sy); applyView(); break;
    case 'sel': selDragMove(e); break;
    case 'dd': ddMove(e); break;
    case 'grad': gradMove(e); break;
    case 'xf': case 'pixmove': moveMove(e); break;
    case 'pick': pickAt(e); break;
    case 'rotv': {
      const [cx, cy] = vpCenter();
      let da = (Math.atan2(vy - cy, vx - cx) - a.a0) / DEG * (view.flip ? -1 : 1);
      let r = a.r0 + da; if (e.shiftKey) r = Math.round(r / 15) * 15;
      const p0 = screenToDoc(cx, cy);
      view.rot = ((r + 540) % 360) - 180; anchorView(cx, cy, p0); applyView(); break;
    }
    case 'zoomv': {
      const dx = e.clientX - a.sx;
      if (Math.abs(dx) > 3) a.moved = true;
      if (a.moved) { const p0 = screenToDoc(a.cx, a.cy); view.scale = clamp(a.s0 * Math.pow(1.01, dx), 0.05, 32); anchorView(a.cx, a.cy, p0); applyView(); updateCursor(); }
      break;
    }
  }
});
function pointerEnd(e) {
  const restoreTool = () => { if (penCfg.eraserPrev && e.pointerType === 'pen') { const t = penCfg.eraserPrev; penCfg.eraserPrev = null; if (TOOLDEF[t]) selectTool(t); } };
  setTimeout(restoreTool, 0);
  const gone = pointers.get(e.pointerId);
  if (gone && gone.type === 'touch' && penCfg.twoTapUndo && e.type === 'pointerup' && pointers.size === 2 && pinch &&
      performance.now() - (gone.t0 || 0) < 280 && Math.hypot(e.clientX - gone.x0, e.clientY - gone.y0) < 10) { undo(); }
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (stroke && e.pointerId === stroke.pointerId) { endStroke(e.type === 'pointercancel'); return; }
  const a = active;
  if (!a) return;
  switch (a.type) {
    case 'sel': selDragEnd(); break;
    case 'dd': ddUp(); break;
    case 'grad': gradUp(); break;
    case 'xf': case 'pixmove': moveUp(); break;
    case 'zoomv': active = null; if (!a.moved) { const [cx, cy] = [a.cx, a.cy]; zoomAt(cx, cy, a.alt ? 1 / 1.5 : 1.5); updateCursor(); } break;
    default: active = null;
  }
  drawOverlay();
}
viewport.addEventListener('pointerup', pointerEnd);
viewport.addEventListener('pointercancel', pointerEnd);
viewport.addEventListener('pointerleave', () => { cursorEl.style.display = 'none'; });
viewport.addEventListener('contextmenu', e => e.preventDefault());
viewport.addEventListener('wheel', e => {
  e.preventDefault();
  const [x, y] = vpXY(e);
  if (e.ctrlKey || e.metaKey || !e.shiftKey) zoomAt(x, y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
  else { view.x -= e.deltaY; view.y -= e.deltaX; applyView(); }
  updateCursor();
}, { passive: false });

/* ---------- commands ---------- */
const CMD = {
  newDoc: openNewDialog, open: () => $('#fileOpen').click(), save: saveDocument,
  exportAnim: openExport, exportPNG,
  undo, redo,
  selectAll, deselect, invertSel, fillSel: fillSelection, clearSel: clearSelection,
  copy: () => copySelection(false), cut: () => copySelection(true), paste: pasteClipboard,
  zoomIn: () => { zoomCenter(1.25); updateCursor(); }, zoomOut: () => { zoomCenter(0.8); updateCursor(); },
  zoomFit: () => { fit(); updateCursor(); }, zoom100: () => { zoomTo100(); updateCursor(); },
  rotL: () => { const [x, y] = vpCenter(); rotateViewAt(-15, x, y); }, rotR: () => { const [x, y] = vpCenter(); rotateViewAt(15, x, y); },
  rotReset: () => setViewRot(0), flipView,
  layerAdd, layerDup, layerDel, layerMerge, layerUp: () => layerMove(1), layerDown: () => layerMove(-1), clearLayer: clearLayerFrame,
  first: () => gotoFrame(0), last: () => gotoFrame(state.frameCount - 1),
  prev: () => gotoFrame(state.frame > 0 ? state.frame - 1 : state.frameCount - 1),
  next: () => gotoFrame(state.frame < state.frameCount - 1 ? state.frame + 1 : 0),
  play, keyframe: () => insertKeyframe(false), blankKey: () => insertKeyframe(true),
  insertFrame, removeFrame, removeKey: removeKeyframe, tween: createTween, removeTween,
  bake: bakeTransform,
  onion: () => { state.onion.on = !state.onion.on; syncTimelineFields(); updateOnion(); },
  toggleDocks: () => $('#app').classList.toggle('docks'),
  help: () => { buildHelp(); $('#helpDialog').showModal(); },
  swap: swapColors, resetColors: () => { setColor('#000000'); state.color2 = '#ffffff'; syncColorUI(); },
  fingerDraw: () => { state.fingerDraw = !state.fingerDraw; toast(state.fingerDraw ? 'Touch draws' : 'Touch pans / pinches only'); },
  penSettings: () => openPenDialog(),
  rename: () => askText('Document name', state.name, v => { if (v) { state.name = v; syncTab(); } })
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cmd]');
  if (!b || !CMD[b.dataset.cmd]) return;
  CMD[b.dataset.cmd]();
  if (b.classList.contains('mi')) closeMenus();
});

/* ---------- menu bar ---------- */
const MENUS = [
  ['File', [['New…', 'newDoc', 'Ctrl+N'], ['Open…', 'open', 'Ctrl+O'], ['Save', 'save', 'Ctrl+S'], ['Rename…', 'rename'], '-',
    ['Export animation…', 'exportAnim', 'Ctrl+E'], ['Export current frame (PNG)', 'exportPNG']]],
  ['Edit', [['Undo', 'undo', 'Ctrl+Z'], ['Redo', 'redo', 'Ctrl+Y'], '-', ['Cut', 'cut', 'Ctrl+X'], ['Copy', 'copy', 'Ctrl+C'], ['Paste', 'paste', 'Ctrl+V'],
    '-', ['Fill selection', 'fillSel'], ['Clear selection', 'clearSel', 'Del'], '-', ['Swap colours', 'swap', 'X'], ['Reset colours', 'resetColors', 'D']]],
  ['Select', [['All', 'selectAll', 'Ctrl+A'], ['Deselect', 'deselect', 'Ctrl+D'], ['Invert', 'invertSel', 'Ctrl+Shift+I']]],
  ['Layer', [['New layer', 'layerAdd'], ['Duplicate', 'layerDup'], ['Merge down', 'layerMerge'], ['Delete', 'layerDel'], '-',
    ['Add 3D model (male / female)…', 'show3d'], '-', ['Move up', 'layerUp'], ['Move down', 'layerDown'], ['Clear this frame', 'clearLayer'], ['Bake transform', 'bake']]],
  ['Animation', [['Play / pause', 'play', 'Enter'], ['Insert keyframe', 'keyframe', 'K / F6'], ['Insert blank keyframe', 'blankKey', 'Shift+K / F7'],
    ['Insert frame', 'insertFrame', 'J / F5'], ['Remove frame', 'removeFrame', 'Shift+J'], ['Remove keyframe', 'removeKey', 'Shift+F6'], '-',
    ['Create motion tween', 'tween'], ['Remove tween', 'removeTween'], '-', ['Toggle onion skin', 'onion', 'O']]],
  ['View', [['Zoom in', 'zoomIn', '+'], ['Zoom out', 'zoomOut', '-'], ['Fit to screen', 'zoomFit', 'Ctrl+0'], ['Actual size', 'zoom100'],
    ['Rotate left', 'rotL', '['], ['Rotate right', 'rotR', ']'], ['Reset rotation', 'rotReset'], ['Flip horizontally', 'flipView'], '-',
    ['Touch draws (toggle)', 'fingerDraw'], ['Pen pressure & touch…', 'penSettings']]],
  ['Help', [['Shortcuts & help', 'help', 'F1']]]
];
function closeMenus() { document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open')); }
function buildMenus() {
  const nav = $('#menus');
  nav.innerHTML = '';
  for (const [name, items] of MENUS) {
    const m = document.createElement('div'); m.className = 'menu'; m.dataset.menu = name;
    const b = document.createElement('button'); b.className = 'menu-btn'; b.textContent = name;
    const dd = document.createElement('div'); dd.className = 'dropdown';
    for (const it of items) {
      if (it === '-') { dd.appendChild(document.createElement('hr')); continue; }
      const mi = document.createElement('button'); mi.className = 'mi'; mi.dataset.cmd = it[1];
      mi.innerHTML = `<span>${it[0]}</span>${it[2] ? `<kbd>${it[2]}</kbd>` : ''}`;
      dd.appendChild(mi);
    }
    b.onclick = e => { e.stopPropagation(); const was = m.classList.contains('open'); closeMenus(); if (!was) m.classList.add('open'); };
    b.onmouseenter = () => { if (document.querySelector('.menu.open') && !m.classList.contains('open')) { closeMenus(); m.classList.add('open'); } };
    m.append(b, dd); nav.appendChild(m);
  }
  document.addEventListener('click', e => { if (!e.target.closest('.menu')) closeMenus(); });
}

/* ---------- keyboard ---------- */
const TOOL_KEYS = { p: 'pen', n: 'pencil', b: 'brush', e: 'eraser', i: 'pick', m: 'select', v: 'move', u: 'shape', t: 'text', h: 'hand' }; /* group ids */
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    if (e.key === 'Escape' || (e.key === 'Enter' && e.target.type === 'number')) e.target.blur();
    return;
  }
  if (document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (k === ' ') { spaceDown = true; e.preventDefault(); viewport.style.cursor = 'grab'; return; }
  if (ctrl) {
    const map = { z: e.shiftKey ? redo : undo, y: redo, s: saveDocument, e: openExport, n: openNewDialog, o: () => $('#fileOpen').click(),
      a: selectAll, d: deselect, c: () => copySelection(false), x: () => copySelection(true), v: pasteClipboard, '0': () => { fit(); updateCursor(); },
      i: e.shiftKey ? invertSel : null, '=': CMD.zoomIn, '+': CMD.zoomIn, '-': CMD.zoomOut };
    if (map[k]) { e.preventDefault(); map[k](); }
    return;
  }
  if (e.key === 'F1') { e.preventDefault(); CMD.help(); return; }
  if (animKeyBlocked(e, k)) return;
  if (e.key === 'F5') { e.preventDefault(); insertFrame(); return; }
  if (e.key === 'F6') { e.preventDefault(); e.shiftKey ? removeKeyframe() : insertKeyframe(false); return; }
  if (e.key === 'F7') { e.preventDefault(); insertKeyframe(true); return; }
  if (e.key === 'Enter') { e.preventDefault(); play(); return; }
  if (e.key === 'Escape') { if (stroke) endStroke(true); else if (active) { active = null; drawOverlay(); } else deselect(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); clearSelection(); return; }
  if (e.key === 'Home') { gotoFrame(0); return; }
  if (e.key === 'End') { gotoFrame(state.frameCount - 1); return; }
  if (e.key === ',' || e.key === 'ArrowLeft') { e.preventDefault(); CMD.prev(); return; }
  if (e.key === '.' || e.key === 'ArrowRight') { e.preventDefault(); CMD.next(); return; }
  if (k === 'k') { e.shiftKey ? insertKeyframe(true) : insertKeyframe(false); return; }
  if (k === 'j') { e.shiftKey ? removeFrame() : insertFrame(); return; }
  if (k === 'o') { CMD.onion(); return; }
  if (k === 'x') { swapColors(); return; }
  if (k === 'd') { CMD.resetColors(); return; }
  if (e.key === '[') { CMD.rotL(); return; }
  if (e.key === ']') { CMD.rotR(); return; }
  if (e.key === '+' || e.key === '=') { CMD.zoomIn(); return; }
  if (e.key === '-') { CMD.zoomOut(); return; }
  if (k === 'g') { const cur = state.group; selectGroup(cur === 'fill' ? 'gradient' : 'fill'); return; }
  if (TOOL_KEYS[k]) selectGroup(TOOL_KEYS[k]);
});
document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; viewport.style.cursor = ''; } });

/* ---------- help ---------- */
function buildHelp() {
  const sec = (t, rows) => `<h5>${t}</h5>` + rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('#helpBody').innerHTML =
    sec('Tools', [['Pen / Pencil / Brush / Eraser', 'P N B E'], ['Fill ↔ Gradient', 'G'], ['Eyedropper (Alt = sub colour)', 'I'], ['Selection', 'M'], ['Move / transform', 'V'], ['Figure', 'U'], ['Text', 'T'], ['Navigate', 'H / Space']]) +
    sec('Animation', [['Play / pause', 'Enter'], ['Prev / next frame', ', .  or ← →'], ['Keyframe / blank', 'K F6 / Shift+K F7'], ['Insert / remove frame', 'J F5 / Shift+J'], ['Remove keyframe', 'Shift+F6'], ['Onion skin', 'O'],
      ['Motion tween', 'Timeline → Tween']]) +
    sec('View', [['Zoom', 'Wheel, + −, pinch'], ['Rotate view', '[ ]  or two-finger twist'], ['Fit', 'Ctrl+0'], ['Pan', 'Space+drag, middle mouse']]) +
    sec('Edit', [['Undo / redo', 'Ctrl+Z / Ctrl+Y'], ['Select all / none / invert', 'Ctrl+A / D / Shift+I'], ['Copy / cut / paste', 'Ctrl+C X V'], ['Swap / reset colours', 'X / D'], ['Save / open', 'Ctrl+S / Ctrl+O'], ['Export', 'Ctrl+E']]) +
    `<h5>How tweens work</h5><div style="grid-column:1/-1;display:block;color:#ccc;line-height:1.5">
    1. Draw on a keyframe. 2. Go to a later frame and press <b>K</b> (new keyframe). 3. With the Move tool, drag / rotate / scale the picture on that keyframe.
    4. Go back to the first keyframe and press <b>Tween</b> — every frame in between is filled in automatically. Alt+drag the orange dot to move the pivot point.</div>`;
}

/* ---------- init ---------- */
function init() {
  loadBuiltinPens(); applyIcons(); installCsFeatures(); installAddonUI(); buildMenus(); installWorkspace(); installMasks(); installPro(); installFilters(); installAnim(); installUiExtras(); installTimelapse(); buildToolbox(); renderSwatches(); restoreLayout(); loadAddons().then(() => { buildMenus(); });
  setColor('#000000');
  setPlayIcon();
  newDocument(1280, 720, 1, 12, false);
  selectTool('pen');
  resizeOverlay();
  setTimeout(() => { fit(); updateCursor(); }, 50);
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.__sketchforge = {
    state, view, history, sel, CMD, get stroke() { return stroke; }, get active() { return active; },
    frameParams, compositeFrame, snapshotTimeline, applyTimeline, gotoFrame, selectTool, setColor, floodFill,
    saveDocumentJSON: () => JSON.stringify(state.layers.map(l => [l.name, Array.from(l.cels.keys())])),
    makeZip, crc32, lzw, newDocument, openDocumentFile, activeLayer, celBBox, insertKeyframe, createTween, ensureKeyHere, ensureXf,
    renderExportFrame, gifFrame, ByteBuf, toDoc, screenToDoc, applyRuler: () => 0
  };
}
init();
})();
