/* ---------- colour: wheel + swatches ---------- */
const wheel = $('#wheel'), wctx = wheel.getContext('2d');
const hsv = { h: 0, s: 0, v: 0 };
function hexToHsv(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: mx ? d / mx : 0, v: mx };
}
function hsvToHex(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
const WR_OUT = 82, WR_IN = 64, WSQ = 44;
function drawWheel() {
  const W = wheel.width, cx = W / 2, cy = W / 2;
  wctx.clearRect(0, 0, W, W);
  for (let a = 0; a < 360; a += 1) {
    wctx.beginPath();
    wctx.arc(cx, cy, (WR_OUT + WR_IN) / 2, (a - 1) * DEG, (a + 1) * DEG);
    wctx.strokeStyle = `hsl(${a},100%,50%)`;
    wctx.lineWidth = WR_OUT - WR_IN;
    wctx.stroke();
  }
  const sq = WSQ * 2;
  const gh = wctx.createLinearGradient(cx - WSQ, 0, cx + WSQ, 0);
  gh.addColorStop(0, '#fff'); gh.addColorStop(1, `hsl(${hsv.h},100%,50%)`);
  wctx.fillStyle = gh; wctx.fillRect(cx - WSQ, cy - WSQ, sq, sq);
  const gv = wctx.createLinearGradient(0, cy - WSQ, 0, cy + WSQ);
  gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(1, '#000');
  wctx.fillStyle = gv; wctx.fillRect(cx - WSQ, cy - WSQ, sq, sq);
  wctx.lineWidth = 2; wctx.strokeStyle = '#fff';
  const ha = hsv.h * DEG, hr = (WR_OUT + WR_IN) / 2;
  wctx.beginPath(); wctx.arc(cx + Math.cos(ha) * hr, cy + Math.sin(ha) * hr, 6, 0, 7); wctx.stroke();
  wctx.beginPath(); wctx.arc(cx - WSQ + hsv.s * sq, cy - WSQ + (1 - hsv.v) * sq, 5, 0, 7); wctx.stroke();
  wctx.strokeStyle = '#000'; wctx.lineWidth = 1; wctx.stroke();
}
function syncColorUI() {
  $('#mainSw').style.background = state.color;
  $('#subSw').style.background = state.color2;
  if (document.activeElement !== $('#hexInput')) $('#hexInput').value = state.color;
  drawWheel();
}
function setColor(hex, fromHsv) {
  state.color = hex.toLowerCase();
  if (!fromHsv) Object.assign(hsv, hexToHsv(state.color));
  syncColorUI();
}
function addRecent(c) {
  state.recent = state.recent || [];
  state.recent = [c, ...state.recent.filter(x => x !== c)].slice(0, 14);
  renderSwatches();
}
function renderSwatches() {
  const base = ['#000000', '#ffffff', '#7f7f7f', '#c3c3c3', '#ff0000', '#ff7f27', '#ffd800', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#b97a57', '#ffaec9', '#fff2b0'];
  const mk = (box, arr) => {
    box.innerHTML = '';
    arr.forEach(c => {
      const b = document.createElement('button');
      b.className = 'swatch'; b.style.background = c; b.title = c;
      b.onclick = () => setColor(c);
      box.appendChild(b);
    });
  };
  mk($('#swatches'), base);
  mk($('#recent'), state.recent || []);
}
function swapColors() { const a = state.color; state.color = state.color2; state.color2 = a; Object.assign(hsv, hexToHsv(state.color)); syncColorUI(); }
let wheelDrag = null;
function wheelPick(e) {
  const r = wheel.getBoundingClientRect();
  const k = wheel.width / r.width;
  const x = (e.clientX - r.left) * k - wheel.width / 2, y = (e.clientY - r.top) * k - wheel.height / 2;
  if (wheelDrag === 'ring') hsv.h = (Math.atan2(y, x) / DEG + 360) % 360;
  else { hsv.s = clamp((x + WSQ) / (WSQ * 2), 0, 1); hsv.v = 1 - clamp((y + WSQ) / (WSQ * 2), 0, 1); }
  setColor(hsvToHex(hsv.h, hsv.s, hsv.v), true);
}
wheel.addEventListener('pointerdown', e => {
  const r = wheel.getBoundingClientRect(), k = wheel.width / r.width;
  const x = (e.clientX - r.left) * k - wheel.width / 2, y = (e.clientY - r.top) * k - wheel.height / 2;
  const d = Math.hypot(x, y);
  if (d >= WR_IN - 2 && d <= WR_OUT + 2) wheelDrag = 'ring';
  else if (Math.abs(x) <= WSQ + 3 && Math.abs(y) <= WSQ + 3) wheelDrag = 'sq';
  else return;
  wheel.setPointerCapture(e.pointerId);
  wheelPick(e);
});
wheel.addEventListener('pointermove', e => { if (wheelDrag) wheelPick(e); });
wheel.addEventListener('pointerup', () => { wheelDrag = null; });
$('#hexInput').addEventListener('input', e => {
  let v = e.target.value.trim();
  if (!v.startsWith('#')) v = '#' + v;
  if (/^#[0-9a-f]{6}$/i.test(v)) setColor(v);
});
$('#hexInput').addEventListener('blur', () => { $('#hexInput').value = state.color; });
$('#mainSw').onclick = swapColors;
$('#subSw').onclick = swapColors;
$('#swapColors').onclick = swapColors;

/* ---------- tool palette + sub tools ---------- */
function buildToolbox() {
  const box = $('#toolbox');
  box.innerHTML = '';
  for (const g of GROUPS) {
    if (g.sep) { const s = document.createElement('div'); s.className = 'tsep'; box.appendChild(s); continue; }
    const b = document.createElement('button');
    b.className = 'tool' + (g.subs.length > 1 ? ' has-sub' : '');
    b.dataset.group = g.id;
    b.title = `${g.name} (${g.key})`;
    b.innerHTML = icon(g.icon);
    b.onclick = () => selectGroup(g.id);
    box.appendChild(b);
  }
}
const groupTool = {}, subTab = {};
function selectGroup(id) {
  const g = GROUPS.find(x => x.id === id);
  if (!g) return;
  /* G toggles fill <-> gradient */
  selectTool(groupTool[id] && g.subs.includes(groupTool[id]) ? groupTool[id] : g.subs[0]);
}
function selectTool(id) {
  if (busy()) return;
  const g = groupOf(id);
  polyCancel();
  state.tool = id; state.group = g.id; groupTool[g.id] = id;
  if (kindOf(id) === 'brush') state.lastBrush = id;
  document.querySelectorAll('#toolbox .tool').forEach(b => {
    b.classList.toggle('active', b.dataset.group === g.id);
    if (b.dataset.group === g.id) b.innerHTML = icon(TOOLDEF[id].icon);
  });
  renderSubTools(); refreshProps(); drawOverlay();
  viewport.dataset.tool = kindOf(id);
  updateCursor();
}
/* little sample stroke so each pen can be told apart at a glance */
function strokePreview(id) {
  const c = makeCanvas(150, 30), g = c.getContext('2d'), s = settings[id];
  const w0 = clamp(Math.sqrt(s.size) * 1.9, 2, 13);
  g.fillStyle = '#fff';
  if (s.shape) {
    for (let i = 0; i < 7; i++) drawShapeTip(g, s.shape, 12 + i * 21, 15 + Math.sin(i * 1.3) * 5, 13, '#fff');
    return c;
  }
  if ((s.scatter || 0) > 0.5 && !s.tex) {
    for (let i = 0; i < 70; i++) { g.globalAlpha = 0.4 + Math.random() * 0.6; g.beginPath(); g.arc(6 + Math.random() * 138, 15 + (Math.random() - 0.5) * 22, 0.7 + Math.random() * 2.2, 0, 7); g.fill(); }
    return c;
  }
  for (let i = 0; i <= 150; i++) {
    const t = i / 150;
    const x = 4 + t * 142, y = 15 + Math.sin(t * Math.PI * 1.6 + 0.3) * 7 - t * 4;
    let w = w0 * (s.pSize || s.speed ? Math.pow(Math.sin(Math.PI * t), 0.7) : 1) * (s.speed ? 1 - 0.5 * t : 1);
    w = Math.max(0.8, w);
    g.globalAlpha = Math.min(1, s.flow * (s.grain ? 1 - s.grain * Math.random() : 1) * (s.tex ? 1 - (s.texAmt == null ? 0.6 : s.texAmt) * 0.9 * Math.random() : 1) + 0.15);
    g.beginPath();
    if (s.nibRatio < 1 && !s.nib) { g.save(); g.translate(x, y); g.rotate(-s.nibAngle * DEG); g.scale(1, s.nibRatio); g.arc(0, 0, w / 2, 0, 7); g.restore(); }
    else if (s.nib) { g.save(); g.translate(x, y); g.rotate(-s.nib * DEG); g.scale(1, 0.28); g.arc(0, 0, w, 0, 7); g.restore(); }
    else g.arc(x, y, w / 2, 0, 7);
    g.fill();
  }
  return c;
}
function renderSubTools() {
  const g = GROUPS.find(x => x.id === state.group);
  const list = $('#subtoolList');
  list.innerHTML = '';
  let subs = g.subs;
  if (g.tabs) {
    const cur = g.tabs.find(t => t[0] === subTab[g.id]) || g.tabs.find(t => t[1].includes(state.tool)) || g.tabs[0];
    subTab[g.id] = cur[0];
    const row = document.createElement('div'); row.className = 'subtabs';
    g.tabs.forEach(t => {
      const tb = document.createElement('button'); tb.textContent = t[0]; tb.className = t === cur ? 'on' : '';
      tb.onclick = () => { subTab[g.id] = t[0]; selectTool(t[1].includes(state.tool) ? state.tool : t[1][0]); };
      row.appendChild(tb);
    });
    list.appendChild(row);
    subs = cur[1];
  }
  subs.forEach(id => {
    const b = document.createElement('button');
    b.className = 'sub-item' + (id === state.tool ? ' active' : '');
    b.innerHTML = (kindOf(id) === 'brush' || TOOLDEF[id].stops)
      ? `<span class="prev"></span><span class="nm">${TOOLDEF[id].name}</span>`
      : `${icon(TOOLDEF[id].icon)}<span class="nm">${TOOLDEF[id].name}</span>`;
    if (kindOf(id) === 'brush') b.querySelector('.prev').appendChild(strokePreview(id));
    else if (TOOLDEF[id].stops) b.querySelector('.prev').appendChild(gradPreview(id));
    b.onclick = () => selectTool(id);
    list.appendChild(b);
  });
}

/* ---------- tool property panel ---------- */
function slider(parent, label, min, max, step, val, fmt, onInput) {
  const l = document.createElement('label'); l.className = 'slider';
  const out = document.createElement('output');
  const inp = document.createElement('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
  const R = v => Math.round(v * 100) / 100;
  out.textContent = fmt(R(+val));
  inp.oninput = () => { out.textContent = fmt(R(+inp.value)); onInput(+inp.value); };
  const sp = document.createElement('span'); sp.textContent = label;
  l.append(sp, inp, out); parent.appendChild(l);
}
const SIZE_PRESETS = [1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 15, 17, 20, 25, 30, 40, 50, 60, 70, 80, 100, 150, 200, 300];
function sizeGrid(parent, s) {
  const grid = document.createElement('div'); grid.className = 'sizegrid';
  SIZE_PRESETS.forEach(v => {
    const b = document.createElement('button');
    b.className = 'sz' + (Math.abs(s.size - v) < 0.01 ? ' on' : '');
    b.title = v + ' px';
    b.innerHTML = `<i style="width:${Math.min(20, 2 + Math.sqrt(v) * 1.15)}px;height:${Math.min(20, 2 + Math.sqrt(v) * 1.15)}px"></i><span>${v}</span>`;
    b.onclick = () => { s.size = v; updateCursor(); refreshProps(); };
    grid.appendChild(b);
  });
  parent.appendChild(grid);
}
function checkbox(parent, label, val, onChange) {
  const l = document.createElement('label'); l.className = 'check';
  const i = document.createElement('input'); i.type = 'checkbox'; i.checked = val;
  i.onchange = () => onChange(i.checked);
  l.append(i, document.createTextNode(' ' + label)); parent.appendChild(l);
}
function seg(parent, opts, cur, onPick) {
  const d = document.createElement('div'); d.className = 'seg';
  opts.forEach(([v, t]) => {
    const b = document.createElement('button'); b.textContent = t; b.className = v === cur ? 'on' : '';
    b.onclick = () => { onPick(v); refreshProps(); };
    d.appendChild(b);
  });
  parent.appendChild(d);
}
function hint(parent, t) { const p = document.createElement('div'); p.className = 'hint'; p.textContent = t; parent.appendChild(p); }
function grp(parent, t) { const p = document.createElement('div'); p.className = 'grp'; p.textContent = t; parent.appendChild(p); }
function btns(parent, list) {
  const d = document.createElement('div'); d.className = 'btnrow';
  list.forEach(([t, fn]) => { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; d.appendChild(b); });
  parent.appendChild(d);
}
function refreshProps() {
  const body = $('#propBody');
  if (!body) return;
  if (document.activeElement && body.contains(document.activeElement) && document.activeElement.type === 'number') return;
  body.innerHTML = '';
  const id = state.tool, k = kindOf(id);
  $('#toolName').textContent = TOOLDEF[id].name;
  if (k === 'dragdraw') { if (id === 'liquify') liqProps(body); else proProps(body, id); return; }
  if (k === 'brush' || k === 'shape' || k === 'poly') {
    const s = (k === 'shape' || k === 'poly') ? settings.shape : settings[id];
    slider(body, 'Size', 1, 300, 1, s.size, v => v + 'px', v => { s.size = v; updateCursor(); });
    sizeGrid(body, s);
    if (k === 'brush') {
      slider(body, 'Hardness', 0, 100, 1, s.hardness * 100, v => v + '%', v => s.hardness = v / 100);
      slider(body, 'Density', 1, 100, 1, s.flow * 100, v => v + '%', v => s.flow = v / 100);
      slider(body, 'Opacity', 1, 100, 1, s.opacity * 100, v => v + '%', v => s.opacity = v / 100);
      grp(body, 'Texture');
      const tl = document.createElement('label'); tl.className = 'select';
      tl.innerHTML = '<span>Paper</span>';
      const ts = document.createElement('select');
      [['', 'None'], ['paper', 'Watercolour paper'], ['grain', 'Pencil grain'], ['canvas', 'Canvas weave'], ['rough', 'Rough'], ['bristle', 'Bristle'], ['charcoal', 'Charcoal']].forEach(([v, t]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = t; if ((s.tex || '') === v) o.selected = true; ts.appendChild(o);
      });
      ts.onchange = () => { s.tex = ts.value || undefined; if (s.tex && s.texAmt == null) s.texAmt = 0.6; renderSubTools(); refreshProps(); };
      tl.appendChild(ts); body.appendChild(tl);
      if (s.tex) {
        slider(body, 'Strength', 0, 100, 1, (s.texAmt == null ? 0.6 : s.texAmt) * 100, v => v + '%', v => s.texAmt = v / 100);
        slider(body, 'Scale', 25, 400, 5, (s.texScale || 1) * 100, v => v + '%', v => s.texScale = v / 100);
      }
      grp(body, 'Stroke character');
      slider(body, 'Scatter', 0, 400, 5, (s.scatter || 0) * 100, v => v + '%', v => { s.scatter = v / 100; renderSubTools(); });
      slider(body, 'Per step', 1, 12, 1, s.count || 1, v => v, v => s.count = v);
      slider(body, 'Size jitter', 0, 100, 1, (s.jitter || 0) * 100, v => v + '%', v => s.jitter = v / 100);
      slider(body, 'Wet edge', 0, 100, 1, (s.wet || 0) * 100, v => v + '%', v => s.wet = v / 100);
      grp(body, 'Anti-aliasing');
      seg(body, [[0, 'None'], [1, 'Weak'], [2, 'Normal'], [3, 'Strong']], s.aa, v => s.aa = v);
      slider(body, 'Stabilise', 0, 100, 1, s.smooth * 100, v => v + '%', v => s.smooth = v / 100);
      slider(body, 'By speed', 0, 100, 1, s.speed * 100, v => v + '%', v => { s.speed = v / 100; renderSubTools(); });
      grp(body, 'Pen pressure');
      checkbox(body, 'Affects size', s.pSize, v => s.pSize = v);
      checkbox(body, 'Affects density', s.pAlpha, v => s.pAlpha = v);
    } else {
      checkbox(body, 'Fill shape', state.shapeFill, v => state.shapeFill = v);
      hint(body, k === 'poly' ? (id === 'curve' ? 'Click start, click end, then click where the curve should bend.' : 'Click points; double-click or press Enter to finish, Esc to cancel. Polygon closes itself.') : 'Hold Shift for a straight / square / circle shape.');
    }
  } else if (k === 'fill') {
    slider(body, 'Tolerance', 0, 100, 1, state.fillTol, v => v, v => state.fillTol = v);
    slider(body, 'Grow edge', 0, 8, 1, state.fillGrow, v => v + 'px', v => state.fillGrow = v);
    checkbox(body, 'Refer to all layers', state.fillAll, v => state.fillAll = v);
    hint(body, 'Click inside a region to fill it with the main colour. Press G again for gradients.');
  } else if (k === 'lassofill') {
    checkbox(body, 'Refer to all layers', state.fillAll, v => state.fillAll = v);
    hint(body, id === 'fillenclose' ? 'Draw a loop around the area. Fills everything inside except the line art.' : 'Draw a loop; the whole area inside is filled with the main colour.');
  } else if (k === 'gradient') {
    seg(body, [['sub', 'Main → Sub'], ['transparent', 'Main → Clear']], state.gradEnd, v => state.gradEnd = v);
    hint(body, 'Drag from start to end. Limited to the selection if one exists.');
  } else if (k === 'select') {
    seg(body, [['replace', 'New'], ['add', 'Add'], ['subtract', 'Sub'], ['intersect', 'Both']], state.selMode, v => state.selMode = v);
    if (TOOLDEF[id].wand) slider(body, 'Tolerance', 0, 100, 1, state.wandTol, v => v, v => state.wandTol = v);
    if (id === 'selpen' || id === 'selerase') slider(body, 'Pen size', 2, 200, 1, state.selPenSize || 24, v => v + 'px', v => state.selPenSize = v);
    if (id === 'selpoly') hint(body, 'Click points; double-click, Enter or click the first point to close. Esc cancels.');
    btns(body, [['All', selectAll], ['None', deselect], ['Invert', invertSel]]);
    btns(body, [['Fill', fillSelection], ['Clear', clearSelection]]);
    hint(body, 'Shift = add, Alt = subtract. Switch to Move (V) to drag the selected pixels.');
  } else if (k === 'text') {
    const sel2 = document.createElement('select');
    ['sans-serif', 'serif', 'monospace', 'cursive', 'Impact', 'Comic Sans MS'].forEach(f => {
      const o = document.createElement('option'); o.value = o.textContent = f; if (f === state.font) o.selected = true; sel2.appendChild(o);
    });
    sel2.onchange = () => state.font = sel2.value;
    body.appendChild(sel2);
    slider(body, 'Size', 8, 400, 1, state.fontSize, v => v + 'px', v => state.fontSize = v);
    checkbox(body, 'Bold', state.bold, v => state.bold = v);
    checkbox(body, 'Italic', state.italic, v => state.italic = v);
    seg(body, [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], state.align, v => state.align = v);
  } else if (k === 'move') {
    refreshMoveProps(body);
  } else if (k === 'hand') hint(body, 'Drag to pan. Space also pans with any tool.');
  else if (k === 'rotate') hint(body, 'Drag to rotate the canvas view (your drawing is not changed). Shift snaps to 15°.');
  else if (k === 'zoom') hint(body, 'Click to zoom in, Alt+click to zoom out, drag left/right to scale.');
}
function refreshMoveProps(body) {
  if (sel.active) {
    hint(body, 'Selection active: drag to move the selected pixels. Deselect (Ctrl+D) to transform the whole layer.');
    return;
  }
  const l = activeLayer();
  if (!l || !l.canvas) { hint(body, 'Pick a layer with a drawing.'); return; }
  const fp = frameParams(l, state.frame);
  const isKey = keyAt(l, state.frame) === state.frame;
  hint(body, isKey ? 'Keyframe: drag the picture, corner handles (scale), top handle (rotate), Alt+drag the orange dot (pivot).'
    : 'Tween / held frame: editing here makes a new keyframe.');
  const grid = document.createElement('div'); grid.className = 'numgrid';
  const fields = [['x', 'X', 1], ['y', 'Y', 1], ['rot', 'Rotate°', 1], ['sx', 'Scale X', 0.01], ['sy', 'Scale Y', 0.01], ['alpha', 'Alpha', 0.05]];
  fields.forEach(([key, nm, step]) => {
    const lab = document.createElement('label'); lab.textContent = nm;
    const inp = document.createElement('input'); inp.type = 'number'; inp.step = step;
    inp.value = +(+fp.p[key]).toFixed(2);
    inp.onchange = () => {
      const v = parseFloat(inp.value);
      if (isNaN(v)) return;
      const before = snapshotTimeline();
      const cel = ensureKeyHere(l);
      ensureXf(cel)[key] = key === 'alpha' ? clamp(v, 0, 1) : v;
      pushHistory(timelineEntry(before, snapshotTimeline()));
      refreshStage(); renderTimeline(); drawOverlay(); syncTimelineFields();
      inp.blur(); refreshProps();
    };
    lab.appendChild(inp); grid.appendChild(lab);
  });
  body.appendChild(grid);
  btns(body, [['Reset transform', () => {
    const before = snapshotTimeline();
    const cel = ensureKeyHere(l); const x = ensureXf(cel);
    Object.assign(x, { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1 });
    pushHistory(timelineEntry(before, snapshotTimeline()));
    afterEdit();
  }], ['Bake into pixels', bakeTransform]]);
}
function bakeTransform() {
  const l = activeLayer();
  if (!l || !l.canvas) return;
  const k = keyAt(l, state.frame);
  const cel = l.cels.get(k);
  if (xfOf(cel).tween) { toast('Remove the tween first'); return; }
  if (isIdentP(xfOf(cel)) && xfOf(cel).alpha === 1) { toast('Nothing to bake'); return; }
  const before = snapshotTimeline();
  const c = makeCel(true);
  const g = c.getContext('2d');
  g.globalAlpha = xfOf(cel).alpha;
  g.transform(...xfMatrix(xfOf(cel), l));
  g.drawImage(cel, 0, 0);
  l.cels.set(k, c);
  bindAll(state.frame);
  pushHistory(timelineEntry(before, snapshotTimeline()));
  afterEdit();
}

/* ---------- cursor ring ---------- */
function updateCursor() {
  const k = kindOf(state.tool);
  const el = cursorEl;
  if (k === 'brush' || k === 'shape') {
    const d = Math.max(4, settings[k === 'shape' ? 'shape' : state.tool].size * view.scale);
    el.style.width = el.style.height = d + 'px';
    el.dataset.ring = '1';
  } else el.dataset.ring = '';
}

/* ---------- navigator ---------- */
const navC = $('#navCanvas'), navG = navC.getContext('2d');
let navT = 0;
function zoomToSlider(s) { return Math.round((Math.log(s / 0.05) / Math.log(32 / 0.05)) * 100); }
function sliderToZoom(v) { return 0.05 * Math.pow(32 / 0.05, v / 100); }
function syncNav() {
  $('#navZoom').value = zoomToSlider(view.scale);
  $('#navZoomVal').textContent = Math.round(view.scale * 100) + '%';
  $('#navRot').value = Math.round(view.rot);
  $('#navRotVal').textContent = Math.round(view.rot) + '°';
  updateNav();
}
function updateNav() {
  if (navT) return;
  navT = setTimeout(() => {
    navT = 0;
    const W = navC.width, H = navC.height;
    navG.clearRect(0, 0, W, H);
    const k = Math.min(W / state.w, H / state.h);
    const ox = (W - state.w * k) / 2, oy = (H - state.h * k) / 2;
    navG.fillStyle = '#555'; navG.fillRect(ox, oy, state.w * k, state.h * k);
    try { navG.drawImage(compositeFrame(state.frame), ox, oy, state.w * k, state.h * k); } catch (e) { /* ignore */ }
    const r = viewport.getBoundingClientRect();
    navG.strokeStyle = '#ff4d4d'; navG.lineWidth = 1.5; navG.beginPath();
    [[0, 0], [r.width, 0], [r.width, r.height], [0, r.height]].forEach(([x, y], i) => {
      const p = screenToDoc(x, y);
      const X = ox + p.x * k, Y = oy + p.y * k;
      i ? navG.lineTo(X, Y) : navG.moveTo(X, Y);
    });
    navG.closePath(); navG.stroke();
  }, 60);
}
$('#navZoom').oninput = e => setZoom(sliderToZoom(+e.target.value));
$('#navRot').oninput = e => setViewRot(+e.target.value);
navC.addEventListener('pointerdown', e => {
  const move = ev => {
    const r = navC.getBoundingClientRect();
    const W = navC.width, H = navC.height, k = Math.min(W / state.w, H / state.h);
    const ox = (W - state.w * k) / 2, oy = (H - state.h * k) / 2;
    const x = ((ev.clientX - r.left) * (W / r.width) - ox) / k, y = ((ev.clientY - r.top) * (H / r.height) - oy) / k;
    const [cx, cy] = vpCenter();
    anchorView(cx, cy, { x, y });
    applyView();
  };
  navC.setPointerCapture(e.pointerId);
  move(e);
  navC.onpointermove = move;
  navC.onpointerup = () => { navC.onpointermove = null; };
});

/* ---------- layer panel controls ---------- */
BLENDS.forEach(v => {
  const o = document.createElement('option'); o.value = v;
  o.textContent = v === 'normal' ? 'Normal' : v.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
  $('#layerBlend').appendChild(o);
});
$('#layerBlend').onchange = e => {
  const l = activeLayer(); if (!l) return;
  const old = l.blend, nv = e.target.value;
  l.blend = nv; refreshStage(); markDirty();
  pushHistory({ undo() { l.blend = old; }, redo() { l.blend = nv; } });
};
let opStart = null;
$('#layerOpacity').oninput = e => {
  const l = activeLayer(); if (!l) return;
  if (opStart === null) opStart = l.opacity;
  l.opacity = +e.target.value / 100;
  $('#layerOpacityVal').textContent = e.target.value;
  refreshStage(); markDirty();
};
$('#layerOpacity').onchange = () => {
  const l = activeLayer(); if (!l || opStart === null) return;
  const old = opStart, nv = l.opacity; opStart = null;
  pushHistory({ undo() { l.opacity = old; }, redo() { l.opacity = nv; } });
};

