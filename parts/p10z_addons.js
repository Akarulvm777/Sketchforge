/* ---------- movable / floating panels ---------- */
const PANEL_KEY = 'sketchforge.layout.v1';
const panels = Array.from(document.querySelectorAll('.pal'));
panels.forEach(p => {
  const h = p.querySelector('h4');
  p.dataset.pid = h.childNodes[0].textContent.trim().toLowerCase().replace(/\s+/g, '-');
  p.dataset.home = p.parentElement.id;
  p.dataset.order = panels.indexOf(p);
  h.title = 'Drag to move or float. Double-click to collapse.';
});
const docks = { leftdock: $('#leftdock'), rightdock: $('#rightdock') };
const DEFAULT_LAYOUT = panels.map(p => ({ pid: p.dataset.pid, dock: p.dataset.home, order: +p.dataset.order }));

function saveLayout() {
  try {
    const out = panels.map(p => {
      const fl = p.classList.contains('float'), r = p.getBoundingClientRect();
      return { pid: p.dataset.pid, dock: fl ? 'float' : p.parentElement.id, x: fl ? r.left : 0, y: fl ? r.top : 0,
        w: fl ? r.width : 0, h: fl ? r.height : 0, collapsed: p.classList.contains('collapsed'), hidden: p.classList.contains('phidden'),
        order: Array.from(p.parentElement.children).indexOf(p) };
    });
    localStorage.setItem(PANEL_KEY, JSON.stringify(out));
  } catch (e) { /* storage unavailable */ }
}
function dockPanel(p, dockId, beforeEl) {
  p.classList.remove('float');
  p.style.cssText = '';
  const d = docks[dockId];
  if (beforeEl && beforeEl.parentElement === d) d.insertBefore(p, beforeEl); else d.appendChild(p);
  refreshDocks();
}
function floatPanel(p, x, y, w, h) {
  p.classList.add('float');
  document.body.appendChild(p);
  p.style.left = Math.max(0, x) + 'px'; p.style.top = Math.max(0, y) + 'px';
  p.style.width = (w || 240) + 'px';
  if (h) p.style.height = h + 'px';
  refreshDocks();
}
function refreshDocks() {
  for (const id in docks) docks[id].classList.toggle('empty', !docks[id].querySelector('.pal:not(.phidden)'));
  setTimeout(() => { resizeOverlay(); syncNav(); }, 30);
}
function dropTarget(x, y) {
  for (const id in docks) {
    const r = docks[id].getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && getComputedStyle(docks[id]).display !== 'none') return id;
  }
  return null;
}
function beforeElAt(dockId, y) {
  for (const el of docks[dockId].querySelectorAll(':scope > .pal')) {
    const r = el.getBoundingClientRect();
    if (y < r.top + r.height / 2) return el;
  }
  return null;
}
let marker = null;
panels.forEach(p => {
  const h = p.querySelector('h4');
  h.addEventListener('dblclick', () => { p.classList.toggle('collapsed'); saveLayout(); });
  h.addEventListener('pointerdown', e => {
    if (e.button !== 0 || window.innerWidth <= 900) return;
    const startX = e.clientX, startY = e.clientY;
    let r0 = p.getBoundingClientRect(), dragging = p.classList.contains('float');
    let offX = startX - r0.left, offY = startY - r0.top;
    const move = ev => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        dragging = true;
        r0 = p.getBoundingClientRect(); offX = startX - r0.left; offY = startY - r0.top;
        floatPanel(p, r0.left, r0.top, r0.width, 0);
      }
      p.style.left = (ev.clientX - offX) + 'px'; p.style.top = Math.max(0, ev.clientY - offY) + 'px';
      const t = dropTarget(ev.clientX, ev.clientY);
      Object.values(docks).forEach(d => d.classList.remove('drop'));
      if (t) docks[t].classList.add('drop');
    };
    const up = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      Object.values(docks).forEach(d => d.classList.remove('drop'));
      if (dragging) {
        const t = dropTarget(ev.clientX, ev.clientY);
        if (t) dockPanel(p, t, beforeElAt(t, ev.clientY));
        saveLayout();
      }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
});
new MutationObserver(() => {}).observe(document.body, { childList: true });
window.addEventListener('pointerup', () => { if (panels.some(p => p.classList.contains('float'))) saveLayout(); });

function resetLayout() {
  panels.forEach(p => { p.classList.remove('collapsed', 'phidden'); });
  DEFAULT_LAYOUT.slice().sort((a, b) => a.order - b.order).forEach(l => dockPanel(panels.find(p => p.dataset.pid === l.pid), l.dock));
  saveLayout(); toast('Panel layout reset');
}
function restoreLayout() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(PANEL_KEY) || 'null'); } catch (e) { /* ignore */ }
  if (!saved || window.innerWidth <= 900) return;
  saved.sort((a, b) => a.order - b.order).forEach(l => {
    const p = panels.find(x => x.dataset.pid === l.pid);
    if (!p) return;
    if (l.dock === 'float') floatPanel(p, Math.min(l.x, innerWidth - 80), Math.min(l.y, innerHeight - 60), l.w, l.h);
    else if (docks[l.dock]) docks[l.dock].appendChild(p);
    p.classList.toggle('collapsed', !!l.collapsed);
    p.classList.toggle('phidden', !!l.hidden);
  });
  refreshDocks();
}
function togglePanel(pid) {
  const p = panels.find(x => x.dataset.pid === pid);
  if (pid === '3d-model' && p.classList.contains('phidden')) { show3D(); return; }
  p.classList.toggle('phidden'); if (pid === '3d-model') { M3.hidden = p.classList.contains('phidden'); render3D(); } refreshDocks(); saveLayout();
}

/* ---------- add-ons: custom brush tips + script plug-ins ---------- */
const ADDON_KEY = 'sketchforge.addons.v1';
let addons = { brushes: [], scripts: [] };
/* imported tools are kept in IndexedDB (their tip images and textures do not fit in localStorage); scripts in localStorage */
let addonDBp = null;
const addonDB = () => addonDBp || (addonDBp = new Promise(res => { try { const rq = indexedDB.open('sketchforge-addons', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('kv'); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); } catch (e) { res(null); } }));
async function saveAddons() {
  try { localStorage.setItem(ADDON_KEY, JSON.stringify({ scripts: addons.scripts, brushes: [] })); } catch (e) { /* ignore */ }
  const db = await addonDB();
  if (!db) { try { localStorage.setItem(ADDON_KEY, JSON.stringify(addons)); } catch (e) { toast('Could not save the imported tools (storage full?)'); } return; }
  await new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(addons.brushes, 'brushes'); tx.oncomplete = res; tx.onerror = () => { toast('Could not save the imported tools'); res(); }; });
}
const MENU_ADDONS = ['Add-ons', [['Import Clip Studio tools (.sut, .zip)…', 'addSut'], ['Import a folder of Clip Studio tools…', 'addSutFolder'], ['Import brush tip (image)…', 'addBrushTip'], ['Install add-on script (.js)…', 'addScript'], ['Manage add-ons…', 'manageAddons'], '-']];

/* an image -> 256 px tip: transparent images keep their alpha; opaque ones: dark = ink. colour = keeps its colours */
async function makeTip(src, density) {
  const img = await loadImage(src);
  const tip = makeCanvas(256, 256), g = tip.getContext('2d');
  const k = Math.min(256 / img.width, 256 / img.height);
  g.drawImage(img, (256 - img.width * k) / 2, (256 - img.height * k) / 2, img.width * k, img.height * k);
  const d = g.getImageData(0, 0, 256, 256), px = d.data;
  let opaque = true, colour = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 250) opaque = false; if (px[i + 3] > 60) { n++; const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]); if (mx - mn > 60) colour++; } }
  const isColour = !opaque && n > 0 && colour / n > 0.15;
  // opaque image, or a Clip Studio brush material (grey picture): dark = ink, white = no ink, times its transparency
  if (opaque || (density && !isColour)) for (let i = 0; i < px.length; i += 4) { px[i + 3] = Math.round(px[i + 3] * (1 - (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255)); px[i] = px[i + 1] = px[i + 2] = 0; }
  g.putImageData(d, 0, 0);
  return { tip, colour: isColour && !density };
}
const GROUP_ICON = { pen: 'pen', pencil: 'pencil', brush: 'brush', airbrush: 'airbrush', decor: 'sparkle', eraser: 'eraser', blend: 'blend', shade: 'shade' };
/* every engine setting a brush definition can carry (imported tools, the brush editor, .sfbrush files) */
const BRUSH_KEYS = ['scatter', 'count', 'jitter', 'hueJit', 'wet', 'smudge', 'blurTool', 'nibRatio', 'nibAngle', 'speed', 'pMin', 'pCurve', 'aMin', 'aCurve', 'tipAngle', 'tipRotAmt', 'tipFollow',
  'tipThick', 'sprayFix', 'sprayBias', 'blendOp', 'perfSpacing', 'perfCount', 'perfDefer', 'paint', 'paintDensity', 'texRot', 'tMin', 'tCurve', 'vMin', 'vCurve', 'sRand', 'aRand', 'rotP', 'taperOut',
  'taperOutRatio', 'fadeIn', 'fadeOut', 'min1', 'flowSp', 'satJit', 'valJit', 'atMin', 'atCurve', 'avMin', 'avCurve', 'grain', 'twoTone', 'twoEdge'];
/* a brush definition → engine settings (tipIds: registered tip images; texId: registered texture image) */
function brushPreset(def, tipIds = [], texId = null) {
  const extra = { aa: def.aa ?? 2, taperIn: def.taperIn || 0, taperRatio: def.taperRatio ?? 0.3, spacing: def.spacing || 0.15, tipRot: !!def.tipRot };
  if (tipIds.length === 1) extra.tipId = tipIds[0];
  else if (tipIds.length > 1) { extra.tipId = tipIds[0]; extra.tipIds = tipIds; extra.tipOrder = def.tipOrder || 'random'; }
  for (const k of BRUSH_KEYS) if (def[k] != null) extra[k] = def[k];
  if (def.tex) { extra.tex = texId || (def.texImg ? 'paper' : def.tex); extra.texAmt = def.texAmt ?? 0.6; extra.texScale = def.texScale || 1; }
  return P(def.size || 40, tipIds.length ? 1 : (def.hardness ?? 1), def.flow ?? 1, def.opacity ?? 1, def.pSize ?? true, def.pAlpha ?? false, def.smooth ?? 0.2, extra);
}
/* the texture picture of a definition, with its brightness / contrast (Clip Studio -100…100) */
async function texImage(def) {
  let img = await loadImage(def.texImg);
  if (def.texBright || def.texContrast) {
    const c = makeCanvas(img.width, img.height), g = c.getContext('2d');
    g.filter = `brightness(${clamp(1 + (def.texBright || 0) / 100, 0, 2)}) contrast(${clamp(1 + (def.texContrast || 0) / 100, 0, 3)})`; g.drawImage(img, 0, 0); img = c;
  }
  return img;
}
async function registerBrush(def, persist) {
  const id = def.id || 'custom_' + Date.now().toString(36) + Math.floor(Math.random() * 999);
  const group = def.group || (def.pen ? 'pen' : 'brush');
  if (def.kind === 'gradient' || group === 'gradient') { // a gradient preset
    TOOLDEF[id] = { name: def.name || 'Gradient', kind: 'gradient', icon: 'gradient', custom: true, stops: def.stops || [[0, 'fg'], [1, 'bg']], radial: !!def.radial, report: def.report };
    settings[id] = {};
    const gg = GROUPS.find(g2 => g2.id === 'gradient'); if (gg && !gg.subs.includes(id)) gg.subs.push(id);
    if (persist) { addons.brushes.push({ ...def, id, group: 'gradient' }); saveAddons(); }
    renderSubTools();
    return id;
  }
  const tipSrcs = def.tips && def.tips.length ? def.tips : def.tip ? [def.tip] : [];
  const ids = [];
  for (let i = 0; i < tipSrcs.length; i++) {
    try { const { tip, colour } = await makeTip(tipSrcs[i], def.tipDensity); const tid = id + (i ? '_' + i : ''); customTips.set(tid, tip); if (colour) tip._colour = true; ids.push(tid); } catch (e) { /* skip a broken image */ }
  }
  let texId = null;
  if (def.tex && def.texImg) { try { texId = registerTexture('tex_' + id, await texImage(def), def.texInv); } catch (e) { /* keep generic paper */ } }
  TOOLDEF[id] = { name: def.name || 'Custom brush', kind: 'brush', icon: GROUP_ICON[group] || (def.pen ? 'pen' : 'brush'), custom: true, report: def.report,
    preset: brushPreset(def, ids, texId) };
  if (group === 'eraser' || def.erase) TOOLDEF[id].erase = true;
  settings[id] = { ...TOOLDEF[id].preset };
  const g = GROUPS.find(g2 => g2.id === group) || GROUPS.find(g2 => g2.id === 'brush');
  for (const o of GROUPS) if (o !== g && o.subs && o.subs.includes(id)) o.subs.splice(o.subs.indexOf(id), 1); // edited into another group
  if (!g.subs.includes(id)) g.subs.push(id);
  if (persist) { const i = addons.brushes.findIndex(b2 => b2.id === id), rec = { ...def, id, group: g.id }; if (i >= 0) addons.brushes[i] = rec; else addons.brushes.push(rec); saveAddons(); }
  renderSubTools();
  return id;
}

/* ---------- Clip Studio .sut (SQLite) reader ---------- */
function readSqlite(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (String.fromCharCode(...u8.slice(0, 15)) !== 'SQLite format 3') throw new Error('Not a SQLite-based file');
  let ps = dv.getUint16(16); if (ps === 1) ps = 65536;
  const usable = ps - u8[20], dec = new TextDecoder();
  const varint = (o) => { let v = 0n, i = 0; for (; i < 8; i++) { const b = u8[o + i]; v = (v << 7n) | BigInt(b & 127); if (!(b & 128)) return [Number(v), i + 1]; } v = (v << 8n) | BigInt(u8[o + 8]); return [Number(v), 9]; };
  const payload = (o, P) => {
    const maxL = usable - 35, minL = Math.floor((usable - 12) * 32 / 255) - 23;
    if (P <= maxL) return u8.slice(o, o + P);
    let K = minL + (P - minL) % (usable - 4); const local = K <= maxL ? K : minL;
    const out = new Uint8Array(P); out.set(u8.slice(o, o + local)); let got = local, next = dv.getUint32(o + local);
    while (next && got < P) { const po = (next - 1) * ps, n = Math.min(usable - 4, P - got); out.set(u8.slice(po + 4, po + 4 + n), got); got += n; next = dv.getUint32(po); }
    return out;
  };
  const record = (p) => {
    const pdv = new DataView(p.buffer, p.byteOffset, p.byteLength);
    const vi = (o) => { let v = 0n, i = 0; for (; i < 8; i++) { const b = p[o + i]; v = (v << 7n) | BigInt(b & 127); if (!(b & 128)) return [Number(v), i + 1]; } v = (v << 8n) | BigInt(p[o + 8]); return [Number(v), 9]; };
    const [hs, hl] = vi(0); const types = []; let o = hl;
    while (o < hs) { const [t, l] = vi(o); types.push(t); o += l; }
    const vals = []; let d = hs;
    for (const t of types) {
      if (t === 0) vals.push(null);
      else if (t >= 1 && t <= 6) { const n = [0, 1, 2, 3, 4, 6, 8][t]; let v = 0n; for (let i = 0; i < n; i++) v = (v << 8n) | BigInt(p[d + i]); if (p[d] & 128) v -= 1n << BigInt(n * 8); vals.push(Number(v)); d += n; }
      else if (t === 7) { vals.push(pdv.getFloat64(d)); d += 8; }
      else if (t === 8) vals.push(0); else if (t === 9) vals.push(1);
      else if (t >= 12 && t % 2 === 0) { const n = (t - 12) / 2; vals.push(p.slice(d, d + n)); d += n; }
      else if (t >= 13) { const n = (t - 13) / 2; vals.push(dec.decode(p.slice(d, d + n))); d += n; }
      else throw new Error('bad record');
    }
    return vals;
  };
  const rows = (root) => {
    const out = [];
    const walk = (pg) => {
      const base = (pg - 1) * ps, h = pg === 1 ? 100 : 0, type = u8[base + h], n = dv.getUint16(base + h + 3);
      if (type === 0x0d) {
        for (let i = 0; i < n; i++) {
          let o = base + dv.getUint16(base + h + 8 + i * 2);
          const [P, l1] = varint(o); o += l1; const [rid, l2] = varint(o); o += l2;
          out.push([rid, record(payload(o, P))]);
        }
      } else if (type === 0x05) {
        for (let i = 0; i < n; i++) walk(dv.getUint32(base + dv.getUint16(base + h + 12 + i * 2)));
        walk(dv.getUint32(base + h + 8));
      }
    };
    walk(root); return out;
  };
  const tables = {};
  for (const [, r] of rows(1)) {
    if (r[0] !== 'table') continue;
    const sql = r[4], inner = sql.slice(sql.indexOf('(') + 1, sql.lastIndexOf(')'));
    const cols = []; let depth = 0, cur = '';
    for (const ch of inner) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { cols.push(cur.trim().split(/\s+/)[0]); cur = ''; } else cur += ch; }
    cols.push(cur.trim().split(/\s+/)[0]);
    tables[r[1]] = rows(r[3]).map(([rid, v]) => { const o = {}; cols.forEach((c, i) => { o[c] = i === 0 && v[i] === null ? rid : v[i]; }); return o; });
  }
  return tables;
}
function findPng(blob) {
  if (!blob || !blob.length) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47];
  for (let i = 0; i < blob.length - 8; i++) {
    if (blob[i] === sig[0] && blob[i + 1] === sig[1] && blob[i + 2] === sig[2] && blob[i + 3] === sig[3]) {
      for (let j = i + 8; j <= blob.length - 8; j++) if (blob[j] === 0x49 && blob[j + 1] === 0x45 && blob[j + 2] === 0x4e && blob[j + 3] === 0x44) {
        let bin = ''; blob.slice(i, j + 8).forEach(b => { bin += String.fromCharCode(b); });
        return 'data:image/png;base64,' + btoa(bin);
      }
    }
  }
  return null;
}
/* effector blob (pen pressure etc.), big-endian: @8 input bits (16 pressure, 32 tilt, 64 speed, 128 random), minimum % per input
   (@12 pressure, @16 tilt, @20 speed, @24 random), then curve blocks [12, n, 16, n × (x, y) doubles], one per input in that order */
function sutEffector(b) {
  const o = { bits: 0, min: 0, curve: null, curves: [], mins: {}, curveOf: {} };
  if (!b || b.length < 16) return o;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), u = i => dv.getUint32(i);
  o.bits = u(8); o.min = clamp(u(12) / 100, 0, 1);
  for (let i = 16; i + 12 <= b.length;) {
    const n = u(i + 4);
    if (u(i) === 12 && n >= 2 && n <= 64 && u(i + 8) === 16 && i + 12 + n * 16 <= b.length) {
      const pts = []; for (let k = 0; k < n; k++) pts.push([+dv.getFloat64(i + 12 + k * 16).toFixed(3), +dv.getFloat64(i + 20 + k * 16).toFixed(3)]);
      o.curves.push(pts); i += 12 + n * 16;
    } else i += 4;
  }
  const straight = c => !c || (c.length === 2 && c[0][0] === 0 && c[0][1] === 0 && c[1][0] === 1 && c[1][1] === 1); // a straight line needs no curve
  let k = 0;
  [[16, 12], [32, 16], [64, 20], [128, 24]].forEach(([bit, at]) => {
    o.mins[bit] = b.length >= at + 4 ? clamp(u(at) / 100, 0, 1) : 0;
    if (o.bits & bit) { const c = o.curves[k++]; if (!straight(c)) o.curveOf[bit] = c; }
  });
  o.curve = o.curveOf[16] || null;
  return o;
}
/* start / end effect targets: entries (id, on, amount): 1001 = size, 1021 = opacity */
function sutInOut(b) {
  const o = {}; if (!b || b.length < 24) return o;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i + 12 <= b.length; i += 4) { const id = dv.getUint32(i); if ((id === 1001 || id === 1021) && !(id in o)) { const on = dv.getUint32(i + 4); if (on <= 1) o[id] = on ? clamp(dv.getUint32(i + 8) / 100, 0, 1) : 0; } }
  return o;
}
function findPngs(blob) { // every PNG inside a blob (decoration brushes keep several tip images)
  const out = []; if (!blob || !blob.length) return out;
  for (let i = 0; i < blob.length - 8; i++) {
    if (blob[i] !== 0x89 || blob[i + 1] !== 0x50 || blob[i + 2] !== 0x4e || blob[i + 3] !== 0x47) continue;
    for (let j = i + 8; j <= blob.length - 8; j++) if (blob[j] === 0x49 && blob[j + 1] === 0x45 && blob[j + 2] === 0x4e && blob[j + 3] === 0x44) {
      let bin = ''; blob.subarray(i, j + 8).forEach(b => { bin += String.fromCharCode(b); });
      out.push('data:image/png;base64,' + btoa(bin)); i = j + 7; break;
    }
  }
  return out;
}
/* Clip Studio gradient (GradationData): big-endian; header size, record size, count; each record = R, G, B, A
   (32-bit, the colour byte repeated), flags, position (0..0x8000 = 0..1), kind. */
function parseGradation(blob) {
  if (!blob || blob.length < 24) return null;
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength), hs = dv.getUint32(0), rs = dv.getUint32(4), n = dv.getUint32(8);
  if (hs < 12 || rs < 28 || !n || n > 64 || hs + n * rs > blob.length) return null;
  const stops = [];
  for (let i = 0; i < n; i++) {
    const o = hs + i * rs, r = blob[o], g = blob[o + 4], b = blob[o + 8], a = blob[o + 12], pos = clamp(dv.getUint32(o + 20) / 0x8000, 0, 1);
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    stops.push([pos, a >= 255 ? hex : `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`]);
  }
  stops.sort((x, y) => x[0] - y[0]);
  return stops.length >= 2 ? stops : null;
}
/* images used by the tools: the MaterialFile table holds each material as a tar archive (thumbnail/thumbnail.png = the
   picture, data/material_0.layer = the full picture in Clip Studio's own format, whose header gives the real size) */
function untar(u8) {
  const out = {}; let o = 0;
  while (o + 512 <= u8.length) {
    const name = new TextDecoder().decode(u8.subarray(o, o + 100)).replace(/\0.*$/s, '');
    if (!name) break;
    const size = parseInt(new TextDecoder().decode(u8.subarray(o + 124, o + 136)).replace(/[^0-7]/g, '') || '0', 8);
    out[name] = u8.subarray(o + 512, o + 512 + size);
    o += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}
const pngURL = u8 => { let bin = ''; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return 'data:image/png;base64,' + btoa(bin); };
function sutMaterials(t) {
  const m = new Map();
  for (const r of (t.MaterialFile || [])) {
    if (!r.FileData || !r.FileData.length) continue;
    try {
      const files = untar(r.FileData), th = files['thumbnail/thumbnail.png']; if (!th) continue;
      let w = 0; const lay = files['data/material_0.layer'];
      if (lay) for (let i = 0; i < Math.min(lay.length - 24, 20000); i++) if (lay[i] === 0x89 && lay[i + 1] === 0x50 && lay[i + 2] === 0x4e && lay[i + 3] === 0x47) { w = ((lay[i + 16] << 24) | (lay[i + 17] << 16) | (lay[i + 18] << 8) | lay[i + 19]) >>> 0; break; }
      const key = String(r.CatalogPath || r.OriginalPath || '').replace(/:data:.*$/, '');
      m.set(key, { url: pngURL(th), w: w > 0 && w < 20000 ? w : 300 });
    } catch (e) { /* skip a broken material */ }
  }
  return m;
}
/* a pattern / texture setting names its materials by catalog path (UTF-16 text inside the blob) */
function sutRefs(blob, mats) {
  if (!blob || !blob.length || !mats.size) return [];
  let txt = ''; // UTF-16 little-endian text (both alignments, to be safe)
  for (const st of [0, 1]) { for (let i = st; i + 1 < blob.length; i += 2) txt += String.fromCharCode(blob[i] | (blob[i + 1] << 8)); txt += '\n'; }
  const out = []; for (const k of mats.keys()) if (k && txt.includes(k) && !out.includes(mats.get(k))) out.push(mats.get(k));
  // keep the order they appear in
  return out.sort((a, b) => txt.indexOf([...mats].find(([, v]) => v === a)[0]) - txt.indexOf([...mats].find(([, v]) => v === b)[0]));
}
/* what kind of tool a sub tool is: from its name (English / Japanese / Chinese / Korean words) and its settings */
const SUT_NAMES = [['gradient', /gradient|gradation|グラデ|渐变|漸層|그라데/i], ['eraser', /eras|消しゴム|消去|橡皮|지우개/i],
  ['shade', /hatch|cross ?hatch|カケ|ハッチ|網|アミ|斜線|排线|해칭/i],
  ['blend', /blend|blur|smudge|finger|ぼかし|指先|色混ぜ|涂抹|模糊|블렌드|흐림/i], ['airbrush', /air ?brush|spray|エアブラシ|スプレー|喷枪|噴槍|에어/i],
  ['decor', /deco|star|flower|lace|sparkle|glitter|leaf|leaves|grass|chain|ribbon|stamp|pattern|snow|heart|cloud|装飾|デコ|模様|花|星|レース|ハート|キラ|光|装饰|爱心|데코|꽃|하트/i],
  ['pencil', /pencil|crayon|chalk|charcoal|pastel|鉛筆|クレヨン|パステル|木炭|铅笔|蜡笔|연필/i],
  ['brush', /brush|paint|water ?colou?r|oil|gouache|acrylic|wash|水彩|油彩|ブラシ|筆|画笔|油画|붓|수채/i], ['pen', /pen|ink|marker|liner|line ?art|ペン|マーカー|線画|钢笔|線稿|筆ペン|펜|선화/i]];
function sutKind(name, v, tips, node) {
  const cols = Object.keys(v), has = re => cols.some(c => re.test(c) && v[c] != null && v[c] !== 0);
  if ((node && node.NodeInputOp === 52) || has(/Gradation|Gradient/i) || (v.BrushSize == null && SUT_NAMES[0][1].test(name))) return 'gradient';
  if (v.BrushSize == null) return null; // fill, text, selection… not a drawing tool
  // specific names first (eraser, blend, airbrush, decoration…), then what the settings show, then the generic words brush / pen
  for (const [k, re] of SUT_NAMES) if (k !== 'gradient' && k !== 'brush' && k !== 'pen' && re.test(name)) return k;
  if (has(/^BrushErase|EraseMode/i)) return 'eraser';
  if (tips.length > 1 || v.BrushRibbon || (v.BrushUseSpray && v.BrushUsePatternImage) || (tips.length && (v.BrushInterval || 0) >= 50)) return 'decor';
  for (const [k, re] of SUT_NAMES) if ((k === 'brush' || k === 'pen') && re.test(name)) return k;
  if (v.BrushUseSpray) return 'airbrush';
  if (v.BrushUseWaterColor || v.BrushUseWaterEdge) return 'brush'; // colour mixing / watercolour edge (the mix amounts are always stored, even when off)
  if (v.TextureImage && (v.BrushHardness ?? 100) < 100 || (v.TextureImage && (v.BrushSize || 0) <= 30)) return 'pencil';
  if ((v.BrushHardness ?? 100) >= 90 && !v.TextureImage) return (v.BrushSize || 0) > 40 ? 'brush' : 'pen';
  if (v.TextureImage) return 'pencil';
  return 'brush';
}
const sutNum = (v, re) => { for (const c of Object.keys(v)) if (re.test(c) && typeof v[c] === 'number') return v[c]; return null; };
/* Clip Studio blending modes (same numbers as layer modes) → canvas */
const SUT_BLEND = { 1: ['darken', 'Darken'], 2: ['multiply', 'Multiply'], 3: ['color-burn', 'Color burn'], 4: ['color-burn', 'Linear burn', 1], 7: ['lighten', 'Lighten'],
  8: ['screen', 'Screen'], 9: ['color-dodge', 'Color dodge'], 10: ['color-dodge', 'Glow dodge', 1], 11: ['lighter', 'Add'], 12: ['lighter', 'Add (glow)', 1], 14: ['overlay', 'Overlay'],
  15: ['soft-light', 'Soft light'], 16: ['hard-light', 'Hard light'], 17: ['difference', 'Difference'], 22: ['exclusion', 'Exclusion'], 23: ['hue', 'Hue'], 24: ['saturation', 'Saturation'],
  25: ['color', 'Color'], 26: ['luminosity', 'Brightness'] };
/* every setting the translator understands; anything else that differs from Clip Studio's usual value is reported (and remembered) */
const SUT_USED = new Set(('Opacity AntiAlias CompositeMode FlickerReduction TextureImage TextureCompositeMode TextureReverseDensity TextureScale2 TextureDensity TextureDensityEffector ' +
  'BrushSize BrushSizeUnit BrushSizeEffector BrushOpacityEffector BrushFlow BrushFlowEffector BrushHardness BrushInterval BrushIntervalEffector BrushAutoIntervalType BrushThickness ' +
  'BrushThicknessEffector BrushVerticalThicknes BrushRotation BrushRotationEffector BrushRotationRandomScale BrushRotationInSpray BrushRotationEffectorInSpray BrushRotationRandomInSpray ' +
  'BrushUsePatternImage BrushPatternImageArray BrushPatternOrderType BrushPatternOrderType2 BrushPatternNameVersion BrushUseWaterColor BrushUseWaterColor2 BrushWaterColor BrushMixColor ' +
  'BrushMixColorEffector BrushMixAlpha BrushMixAlphaEffector BrushMixColorExtension BrushChangePatternColor BrushHueChange BrushHueChangeEffector BrushChangeStrokeColor BrushStrokeHueChange ' +
  'BrushUseSpray BrushSpraySize BrushSpraySizeUnit BrushSpraySizeEffector BrushSpraySizeSyncBrushSize BrushSprayDensity BrushSprayDensityEffector BrushUseIn BrushInLength BrushInLengthUnit ' +
  'BrushInRatio BrushUseOut BrushOutLength BrushOutLengthUnit BrushOutRatio BrushInOutTarget BrushInOutType BrushInOutBySpeed BrushUseWaterEdge BrushWaterEdgeRadius BrushWaterEdgeRadiusUnit ' +
  'BrushWaterEdgeAlphaPower BrushBlurEffector BrushSubColorEffector BrushSaturationChangeEffector BrushValueChangeEffector GradationData GradationShapeKind BrushSprayBias ' +
  'TextureRotate TextureBrightness TextureContrast TextureForPlot BrushAtLeast1Pixel BrushAdjustFlowByInterval BrushUseRevision BrushRevision BrushSaturationChange BrushValueChange ' +
  'BrushStrokeSaturationChange BrushStrokeValueChange BrushBlendPatternByDarken BrushSharpenCorner TextureStressDensity FlickerReductionBySpeed BrushWaterEdgeBlur BrushWaterEdgeAfterDrag').split(' '));
/* Clip Studio's usual values (from 69 real tools): a setting left at its usual value changes nothing */
const SUT_USUAL = { FlickerReductionBySpeedType: 1, BrushBlur: 5, BrushChangeColorTarget: 1, BrushRevision: 10, BrushRevisionBySpeed: 1, BrushRevisionByViewScale: 1,
  BrushVectorEraserReferAllLayer: 1, BrushEnableSnap: 1, BrushVectorMagnetPower: 30, BrushAdjustVelocity: 1, DualBrushCompositeMode: 1, DualAntiAlias: 2, DualSize: 30, DualFlow: 100,
  DualAdjustFlowByInterval: 1, DualHardness: 100, DualInterval: 10, DualAutoIntervalType: 2, DualThickness: 100, DualRotationEffector: 3, DualRotationRandomScale: 100,
  DualRotationEffectorInSpray: 1, DualRotationRandomInSpray: 100, DualTextureScale: 100, DualTextureDensity: 50, DualSpraySize: 2, DualSprayDensity: 1, FillExpandLength: 10, FillExpandType: 2, FillColorMargin: 10 };
/* settings that only matter for vector layers, fills or the tool's own panel layout */
const SUT_IGNORE = /^(_PW_ID|VariantID|VariantShow|Fill|BrushVector|BrushUseVectorEraser|BrushEnableSnap|BrushUseVectorMagnet|BrushEraseAllLayer|BrushUseReferLayer|BrushAdjustVelocity|BrushQuality|BrushRevision(BySpeed|ByViewScale|Bezier)|FlickerReductionBySpeedType|BrushChangeColorTarget|BrushBlurLinkSize|BrushBlurUnit)/;
const SUT_LABEL = { TextureBrightness: 'Texture brightness', TextureContrast: 'Texture contrast', TextureRotate: 'Texture angle', TextureStressDensity: 'Emphasise texture density', TextureForPlot: 'Texture on each dab',
  BrushSprayBias: 'Spray bias', BrushSharpenCorner: 'Sharp corners', BrushAtLeast1Pixel: 'At least 1 px', BrushAdjustFlowByInterval: 'Flow follows spacing', UseDualBrush: 'Dual brush',
  BrushRibbon: 'Ribbon', BrushBlendPatternByDarken: 'Blend tips by darken', BrushSaturationChange: 'Saturation change per dab', BrushValueChange: 'Brightness change per dab', BrushSubColor: 'Sub colour mix',
  Stickness: 'Ink stickiness', BrushUseRevision: 'Post correction', BrushRevision: 'Post correction amount', FlickerReductionBySpeed: 'Stabilise by speed', BrushBlurKind: 'Blur kind', BrushBlur: 'Blur amount',
  BrushColorMixingMode: 'Colour mixing mode', BrushLMSLinearity: 'Colour mixing (LMS)', BrushContinuousPlot: 'Continuous spray', BrushSprayUseFixedPoint: 'Fixed spray points', BrushWaterEdgeValuePower: 'Watercolour edge darkness',
  BrushWaterEdgeAfterDrag: 'Watercolour edge after drag', BrushWaterEdgeBlur: 'Watercolour edge blur', BrushStrokeSaturationChange: 'Saturation change per stroke', BrushStrokeValueChange: 'Brightness change per stroke' };
/* remember the Clip Studio settings this translator does not handle yet (shown in the tool report) */
function sutLearn(keys) {
  if (!keys.length) return;
  let m = {}; try { m = JSON.parse(localStorage.getItem('sketchforge.sutlearn.v1') || '{}'); } catch (e) { /* new */ }
  for (const k of keys) m[k] = (m[k] || 0) + 1;
  try { localStorage.setItem('sketchforge.sutlearn.v1', JSON.stringify(m)); } catch (e) { /* full */ }
}
/* Convert Clip Studio sub tool data (.sut) into Inkvessa tool definitions, each with the group it belongs to and a report:
   every setting the tool changes, and what became of it (✓ same, ≈ close, ✗ not in Inkvessa yet). */
function sutToDefs(buf) {
  const t = readSqlite(buf);
  const variants = new Map((t.Variant || []).map(v => [v.VariantID, v]));
  const mats = sutMaterials(t);
  const defs = [];
  for (const n of (t.Node || [])) {
    const v = variants.get(n.NodeVariantID);
    if (!v || !n.NodeName) continue;
    const tipMats = v.BrushUsePatternImage ? sutRefs(v.BrushPatternImageArray, mats) : [];
    const tips = v.BrushUsePatternImage ? (tipMats.length ? tipMats.map(m => m.url) : findPngs(v.BrushPatternImageArray)) : [];
    const texMat = sutRefs(v.TextureImage, mats)[0];
    const group = sutKind(n.NodeName, v, tips, n);
    if (!group) {
      // no brush size stored: a drawing tool by its name gets default settings (like the built-in Dot pen); others are skipped
      const byName = SUT_NAMES.find(([k, re]) => k !== 'gradient' && re.test(n.NodeName));
      if (byName) defs.push({ name: n.NodeName, group: byName[0], size: 4, hardness: 1, flow: 1, opacity: (v.Opacity ?? 100) / 100, aa: 0, smooth: 0, pSize: false, pen: byName[0] === 'pen', erase: byName[0] === 'eraser' || undefined,
        report: [['ok', 'No size stored: a ' + byName[0] + ' with default settings (from its name)']] });
      else defs.push({ name: n.NodeName, skip: true });
      continue;
    }
    if (group === 'gradient') {
      const real = parseGradation(v.GradationData);
      defs.push({ name: n.NodeName, kind: 'gradient', group, radial: v.GradationShapeKind === 1 || /circle|radial|円|放射/i.test(n.NodeName), approx: !real,
        stops: real || (/transparent|透明/i.test(n.NodeName) ? [[0, 'fg'], [1, 'fg0']] : [[0, 'fg'], [1, 'bg']]),
        report: [real ? ['ok', `Gradient with its ${real.length} colour stops`] : ['approx', 'Gradient colours not stored in a readable way: foreground → background']] });
      continue;
    }
    const R = [], ok = m => R.push(['ok', m]), near = m => R.push(['approx', m]), no = m => R.push(['no', m]), pct = x => Math.round(x * 100) + '%';
    const es = sutEffector(v.BrushSizeEffector), ef = sutEffector(v.BrushFlowEffector), eo = sutEffector(v.BrushOpacityEffector);
    const thick = (v.BrushThickness ?? 100) / 100, spray = !!v.BrushUseSpray;
    const def = { name: n.NodeName, group, size: clamp(Math.round(v.BrushSize * 10) / 10, 0.5, 1000), opacity: (v.Opacity ?? 100) / 100, flow: (v.BrushFlow ?? 100) / 100,
      hardness: (v.BrushHardness ?? 100) / 100, aa: v.AntiAlias ?? 2, smooth: clamp((v.FlickerReduction || 0) / 50, 0, 0.9), pen: group === 'pen',
      spacing: clamp((v.BrushInterval || 10) / 100, 0.04, 2), tip: tips[0] || null, tips: tips.length > 1 ? tips : undefined, tipDensity: tipMats.length > 0 || undefined };
    ok(`Size ${def.size}px, opacity ${pct(def.opacity)}, density ${pct(def.flow)}` + (tips.length ? '' : `, hardness ${pct(def.hardness)}`) + `, anti-aliasing ${['none', 'weak', 'medium', 'strong'][def.aa] || def.aa}`);
    if (v.FlickerReduction) ok(`Stabiliser ${v.FlickerReduction}`);
    if (v.FlickerReductionBySpeed) near('Stabilise by speed: the stabiliser is the same at every speed');
    // pen pressure (and speed / random / tilt) on size and density, with the tool's own curve and minimum
    def.pSize = !!(es.bits & 16); def.pAlpha = !!((ef.bits | eo.bits) & 16); def.speed = (es.bits & 64) ? 0.5 : 0;
    if (def.pSize) { def.pMin = es.min; if (es.curve) def.pCurve = es.curve; ok(`Pressure → size (minimum ${pct(es.min)}${es.curve ? ', own pressure curve' : ''})`); }
    const ea = (eo.bits & 16) ? eo : ef;
    if (def.pAlpha) { def.aMin = ea.min; if (ea.curve) def.aCurve = ea.curve; ok(`Pressure → ${(eo.bits & 16) ? 'opacity' : 'density'} (minimum ${pct(ea.min)}${ea.curve ? ', own curve' : ''})`); }
    // every imported tool reacts to the pen: a tool saved without any pressure gets pressure → size (minimum 30%)
    if (!def.pSize && !def.pAlpha) { def.pSize = true; def.pMin = 0.3; def.autoPressure = true; ok('Pen pressure added: size follows the pen (the tool had no pressure setting; turn it off in ⚙ if you prefer)'); }
    if (es.bits & 32) { if (es.mins[32] < 1) { def.tMin = es.mins[32]; def.tCurve = es.curveOf[32] || [[0, 0], [1, 1]]; ok(`Pen tilt → size (minimum ${pct(es.mins[32])})`); } else ok('Pen tilt → size: no effect (minimum 100%)'); }
    if (es.bits & 64) { def.speed = 0; if (es.mins[64] < 1) { def.vMin = es.mins[64]; def.vCurve = es.curveOf[64] || [[0, 1], [1, 0]]; ok(`Drawing speed → size (minimum ${pct(es.mins[64])}, own curve)`); } else ok('Drawing speed → size: no effect (minimum 100%)'); }
    if (es.bits & 128) { def.sRand = es.mins[128]; ok(`Random size per dab (minimum ${pct(es.mins[128])})`); }
    const er = (eo.bits & 128) ? eo : ef;
    if (er.bits & 128) { def.aRand = er.mins[128]; ok(`Random ${(eo.bits & 128) ? 'opacity' : 'density'} per dab (minimum ${pct(er.mins[128])})`); }
    const eT = (eo.bits & 32) ? eo : ef, eV = (eo.bits & 64) ? eo : ef;
    if ((eT.bits & 32) && eT.mins[32] < 1) { def.atMin = eT.mins[32]; def.atCurve = eT.curveOf[32] || [[0, 0], [1, 1]]; ok(`Pen tilt → opacity (minimum ${pct(eT.mins[32])})`); }
    if ((eV.bits & 64) && eV.mins[64] < 1) { def.avMin = eV.mins[64]; def.avCurve = eV.curveOf[64] || [[0, 1], [1, 0]]; ok(`Drawing speed → opacity (minimum ${pct(eV.mins[64])})`); }
    // tip: shape images (materials), rotation, thickness, order
    if (tips.length) ok(`${tips.length} tip image${tips.length > 1 ? 's' : ''} from the file${tipMats.length ? ' (read as density: dark = ink)' : ''}`);
    else if (v.BrushUsePatternImage) no('Tip image could not be read: round tip used');
    if (tips.length > 1) { const o = v.BrushPatternOrderType ?? 0; def.tipOrder = o <= 1 ? 'seq' : 'random'; ok(`Tips used ${def.tipOrder === 'seq' ? 'one after the other' : 'in random order'}`); }
    if (tips.length && v.BrushAutoIntervalType && v.BrushAutoIntervalType !== 0 && !v.BrushInterval) def.spacing = 0.1;
    if (tips.length) ok(`Spacing ${Math.round(def.spacing * 100)}% of the size`);
    const re = (spray ? v.BrushRotationEffectorInSpray : v.BrushRotationEffector) || 0, rnd = (spray ? v.BrushRotationRandomInSpray : v.BrushRotationRandomScale) ?? 100;
    const rot = (spray ? v.BrushRotationInSpray : v.BrushRotation) || v.BrushRotation || 0;
    if (tips.length) {
      if (rot) { def.tipAngle = rot; ok(`Tip angle ${Math.round(rot)}°`); }
      if (re & 128) { def.tipRot = true; def.tipRotAmt = clamp(rnd / 100, 0, 1); ok(`Random rotation ${rnd}%`); }
      if (re & (256 | 512)) { def.tipFollow = true; near('Tip turns with the stroke direction'); }
      if (thick !== 1) { def.tipThick = clamp(thick > 1 ? 1 / thick : thick, 0.05, 1); ok(`Tip thickness ${Math.round(thick * 100)}%`); }
    } else {
      if (thick !== 1) { def.nibRatio = clamp(thick > 1 ? 1 / thick : thick, 0.05, 1); def.nibAngle = (rot || 0) + ((thick > 1) !== !!v.BrushVerticalThicknes ? 90 : 0); ok(`Flat nib: thickness ${Math.round(thick * 100)}%, angle ${Math.round(rot)}°`); }
      if (re & 128) near('Random nib angle: kept fixed');
    }
    if ((re & 16) && rot) { def.rotP = true; ok('Pressure → tip angle'); }
    // spray: the tool size is the spray area, the particles have their own size
    if (spray) {
      const area = def.size, part = v.BrushSpraySizeSyncBrushSize ? area * (v.BrushSpraySize ?? 100) / 100 : (v.BrushSpraySize ?? 2);
      def.count = clamp(Math.round(v.BrushSprayDensity ?? 5), 1, 12); def.sprayFix = true;
      if (tips.length && part > 1) {
        def.size = clamp(Math.round(part * 10) / 10, 1, 1000); def.scatter = clamp(area / 2 / def.size, 0.05, 3); def.spacing = clamp(def.spacing * area / def.size, 0.04, 3);
        ok(`Spray: area ${area}px, ${tips.length > 1 ? 'shapes' : 'particles'} ${def.size}px, density ${def.count}`);
      } else { def.scatter = 0.5; def.sprayFix = false; def.count = clamp(Math.round((v.BrushSprayDensity ?? 10) / 2) + 2, 2, 12); ok(`Spray: area ${area}px, density ${v.BrushSprayDensity}`); }
      if (v.BrushSprayBias) { def.sprayBias = clamp(v.BrushSprayBias / 100, -1, 1); ok(`Spray bias ${v.BrushSprayBias} (${v.BrushSprayBias < 0 ? 'more at the rim' : 'more in the middle'})`); }
    }
    // texture (paper): its real size, density, inverted
    if (v.TextureImage && (texMat || findPng(v.TextureImage))) {
      def.texImg = texMat ? texMat.url : findPng(v.TextureImage); def.tex = 'paper'; def.texAmt = clamp((v.TextureDensity ?? 50) / 100, 0, 1);
      def.texScale = clamp((texMat ? texMat.w / 256 : 1) * (v.TextureScale2 ?? 100) / 100, 0.05, 16); def.texInv = !!v.TextureReverseDensity;
      ok(`Texture from the file: density ${pct(def.texAmt)}, scale ${v.TextureScale2 ?? 100}%${def.texInv ? ', inverted' : ''}${texMat && texMat.w <= 300 ? ' (preview-size picture)' : ''}`);
      if (v.TextureRotate) { def.texRot = v.TextureRotate; ok(`Texture angle ${Math.round(v.TextureRotate)}°`); }
      if (v.TextureStressDensity) { def.texContrast = (def.texContrast || 0) + 60; ok('Emphasise texture density (stronger grain)'); }
      if (v.TextureBrightness || v.TextureContrast) { def.texBright = v.TextureBrightness || 0; def.texContrast = (def.texContrast || 0) + (v.TextureContrast || 0); ok(`Texture brightness ${def.texBright}, contrast ${def.texContrast}`); }
      if (v.TextureCompositeMode) near(`Texture mode ${v.TextureCompositeMode}: applied as multiply`);
      if (v.TextureForPlot) near('Texture on each dab: applied to the whole stroke (looks the same, no doubled grain)');
    } else if (v.TextureImage) no('Texture could not be read');
    // colour change per dab: only when the tool switches it on (the hue value is kept even when it is off)
    if (v.BrushChangePatternColor || v.BrushChangeStrokeColor) {
      const hue = v.BrushChangeStrokeColor && v.BrushStrokeHueChange ? v.BrushStrokeHueChange : (v.BrushHueChange ?? sutNum(v, /Hue(Change|Jitter|Random)|ColorJitterHue|ChangeHue/i));
      if (hue) { def.hueJit = clamp(hue > 1 ? hue / 180 : hue, 0, 1); ok(`Colour (hue) change ±${Math.round(def.hueJit * 180)}°`); }
      const sat = v.BrushChangeStrokeColor && v.BrushStrokeSaturationChange ? v.BrushStrokeSaturationChange : v.BrushSaturationChange;
      const val = v.BrushChangeStrokeColor && v.BrushStrokeValueChange ? v.BrushStrokeValueChange : v.BrushValueChange;
      if (sat) { def.satJit = clamp(sat / 100, 0, 1); ok(`Saturation change ${sat}%`); }
      if (val) { def.valJit = clamp(val / 100, 0, 1); ok(`Brightness change ${val}%`); }
    }
    // colour mixing: amount of paint / density of paint / colour stretch
    if (v.BrushUseWaterColor) {
      const P = (v.BrushMixColor ?? 100) / 100, D = (v.BrushMixAlpha ?? 100) / 100;
      if (P >= 0.99 && D >= 0.99) ok('Colour mixing at 100% paint: paints its own colour');
      else {
        def.paint = P; def.paintDensity = D; def.smudge = clamp(0.25 + 0.7 * (v.BrushMixColorExtension ?? 10) / 100, 0.2, 0.95);
        ok(`Colour mixing: amount of paint ${pct(P)}, density ${pct(D)}, colour stretch ${v.BrushMixColorExtension ?? 10}`);
        if (v.CompositeMode) near('Blending mode is not used while mixing colours');
      }
    }
    if (v.BrushUseWaterEdge && (v.BrushWaterEdgeBlur || v.BrushWaterEdgeAfterDrag)) near('Watercolour edge blur / after drag: edge drawn when the pen lifts');
    if (v.BrushUseWaterEdge) { def.wet = clamp(0.3 + (v.BrushWaterEdgeAlphaPower ?? 20) / 60, 0.3, 0.9); if (def.paint != null) near('Watercolour edge is not used while mixing colours'); else ok('Watercolour edge'); }
    // start / end (taper)
    const io = sutInOut(v.BrushInOutTarget);
    if (v.BrushUseIn && io[1001]) {
      def.taperIn = v.BrushInOutType === 1 ? def.size * 4 : (v.BrushInLength || 0); def.taperRatio = clamp(1 - io[1001], 0, 1);
      (v.BrushInOutType === 1 ? near : ok)(`Thin start: ${v.BrushInOutType === 1 ? 'about ' + Math.round(def.taperIn) + 'px' : def.taperIn + 'px'}, from ${pct(def.taperRatio)}`);
    }
    if (v.BrushUseOut && io[1001]) {
      def.taperOut = v.BrushInOutType === 1 ? def.size * 4 : (v.BrushOutLength || 0); def.taperOutRatio = clamp(1 - io[1001], 0, 1);
      if (def.taperOut > 0) (v.BrushInOutType === 1 ? near : ok)(`Thin end: ${v.BrushInOutType === 1 ? 'about ' + Math.round(def.taperOut) + 'px' : def.taperOut + 'px'}, down to ${pct(def.taperOutRatio)}`);
    }
    if (io[1021]) {
      if (v.BrushUseIn) { def.fadeIn = true; if (!def.taperIn) { def.taperIn = v.BrushInOutType === 1 ? def.size * 4 : (v.BrushInLength || 0); def.taperRatio = 1; } ok('Fade in (opacity) at the start'); }
      if (v.BrushUseOut) { def.fadeOut = true; if (!def.taperOut) { def.taperOut = v.BrushInOutType === 1 ? def.size * 4 : (v.BrushOutLength || 0); def.taperOutRatio = 1; } ok('Fade out (opacity) at the end'); }
    }
    // small things
    if (v.BrushAtLeast1Pixel) { def.min1 = true; ok('At least 1 px'); }
    if (v.BrushAdjustFlowByInterval && tips.length) { def.flowSp = true; ok('Density follows spacing'); }
    if (v.BrushUseRevision && v.BrushRevision) { def.smooth = clamp(def.smooth + v.BrushRevision / 200, 0, 0.9); near(`Post correction ${v.BrushRevision}: extra stabiliser`); }
    if (v.BrushBlendPatternByDarken && tips.length) near('Tips blended by darken: overlapping tips add up normally (the same with one colour)');
    if (v.BrushSharpenCorner) near('Sharp corners: corners stay slightly round');
    // blending mode
    if (v.CompositeMode && def.paint == null) { const b = SUT_BLEND[v.CompositeMode]; if (b) { def.blendOp = b[0]; (b[2] ? near : ok)(`Blending mode: ${b[1]}`); } else no(`Blending mode ${v.CompositeMode}`); }
    if (group === 'blend' && def.paint == null) { def.smudge = /blur|ぼかし|模糊/i.test(n.NodeName) ? 0 : 0.85; if (def.smudge === 0) def.blurTool = true; ok(def.blurTool ? 'Blur tool' : 'Blend (smudge) tool'); }
    if (group === 'eraser') { def.erase = true; ok('Eraser'); }
    // everything else the tool changes that Inkvessa does not use yet
    const unknown = [];
    for (const [k, x] of Object.entries(v)) {
      if (SUT_USED.has(k) || SUT_IGNORE.test(k) || x == null || x instanceof Uint8Array || typeof x === 'string') continue;
      if (/^Dual/.test(k) && !v.UseDualBrush) continue;
      if (/^BrushBlur/.test(k) && group !== 'blend') continue; // the blur amount only matters for blur tools
      if (/^BrushWaterEdge/.test(k) && !v.BrushUseWaterEdge) continue;
      if (/Unit$/.test(k)) continue;
      const usual = SUT_USUAL[k] ?? 0;
      if (Math.abs(x - usual) > 1e-6) unknown.push(k);
    }
    for (const k of unknown) no(`${SUT_LABEL[k] || k.replace(/^Brush/, '').replace(/([a-z])([A-Z])/g, '$1 $2')}: ${typeof v[k] === 'number' ? +v[k].toFixed(2) : v[k]} (not in Inkvessa yet)`);
    def.report = R; def.unknown = unknown;
    defs.push(def);
  }
  return defs;
}
async function importSut(file, F) {
  F = F || IMPW_NONE; // the import window's row for this file (p10zbf), or nothing
  F.status('reading the file…'); await impwTick();
  const buf = await file.arrayBuffer();
  F.status('reading settings and materials…'); await impwTick();
  const defs = sutToDefs(buf);
  const use = defs.filter(d => !d.skip);
  sutLearn(use.flatMap(d => d.unknown || []));
  if (!use.length) throw new Error(defs.length ? 'this tool is not a drawing tool (fill, text, selection…)' : 'No tools found in that file');
  F.parsed(use.length > 1 ? use.length + ' tools in this file' : '');
  const out = [];
  for (const def of use) {
    const T = F.tool(def), { unknown, ...keep } = def;
    T.step('read', Math.round(buf.byteLength / 1024) + ' KB');
    const nImg = (def.tips && def.tips.length ? def.tips.length : def.tip ? 1 : 0) + (def.texImg ? 1 : 0);
    T.step('mat', nImg ? nImg + ' image' + (nImg > 1 ? 's' : '') + (def.texImg ? ' (with a paper texture)' : '') : def.kind === 'gradient' ? 'colours of the gradient' : 'none needed'); await impwTick();
    const rep = def.report || [], n = { ok: 0, approx: 0, no: 0 }; rep.forEach(r => n[r[0]]++);
    T.step('set', rep.length ? `${n.ok} same${n.approx ? ', ' + n.approx + ' close' : ''}${n.no ? ', ' + n.no + ' not in Inkvessa yet' : ''}` : 'read'); await impwTick();
    const group = def.kind === 'gradient' ? 'gradient' : def.group || 'brush';
    const id = await registerBrush(keep, true);
    T.step('place', '', GROUP_LABEL[group] || group);
    out.push({ id, group, name: def.name, report: def.report, row: T });
  }
  if (out.length) selectTool(out[out.length - 1].id);
  out.skipped = defs.length - use.length;
  return out;
}
const GROUP_LABEL = { pen: 'Pen', pencil: 'Pencil', brush: 'Brush', airbrush: 'Airbrush', decor: 'Decoration', eraser: 'Eraser', blend: 'Blend', gradient: 'Gradient', shade: 'Shading pens' };
/* many tools at once: .sut files, .zip files of .sut, or folders */
async function unzipSut(file) {
  const u = new Uint8Array(await file.arrayBuffer()), dv = new DataView(u.buffer), out = [];
  let e = u.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error(file.name + ': not a zip file');
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (!/\.sut$/i.test(name) || name.includes('__MACOSX')) continue;
    const dataAt = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u.subarray(dataAt, dataAt + csize);
    const bytes = method === 0 ? raw : method === 8 ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : null;
    if (bytes) out.push(new File([bytes], name.split('/').pop()));
  }
  return out;
}
async function importTools(files) {
  let list = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) { try { list.push(...await unzipSut(f)); } catch (e) { toast(e.message); } }
    else if (/\.sut$/i.test(f.name)) list.push(f);
  }
  if (!list.length) { toast('No Clip Studio tools (.sut) found'); return []; }
  const per = {}, failed = []; let skipped = 0, all = [];
  const W = impwOpen(list.length); // the import window: every step for every tool (p10zbf)
  for (const f of list) {
    const F = W.file(f.name);
    try { const r = await importSut(f, F); skipped += r.skipped || 0; for (const t of r) { per[t.group] = (per[t.group] || 0) + 1; all.push(t); } }
    catch (e) { if (/not a drawing tool/.test(e.message)) { skipped++; F.fail('skipped: not a drawing tool (fill, text, selection…)'); } else { failed.push(f.name); F.fail('could not be read'); } }
  }
  // test stroke (the tuner makes heavy tools draw smoothly, p10zbd), then the preview
  const brushes = all.filter(t => TOOLDEF[t.id] && kindOf(t.id) === 'brush');
  if (brushes.length) await tuneTools(brushes.map(t => t.id), true, { now: true, onTool: (id, res) => { const t = all.find(x => x.id === id); if (t) t.row.step('test', res ? impwTestNote(res) : 'drawn'); } });
  for (const t of all) {
    if (!TOOLDEF[t.id]) continue;
    if (kindOf(t.id) !== 'brush') t.row.step('test', 'not needed for a gradient');
    else if (t.row.pct < impwPct('test')) t.row.step('test', 'drawn');
    await impwTick();
    t.row.done(toolPreview(t.id) || (kindOf(t.id) === 'brush' ? strokePreview(t.id) : TOOLDEF[t.id].stops ? gradPreview(t.id) : null));
  }
  const parts = Object.entries(per).map(([g, k]) => `${k} → ${GROUP_LABEL[g] || g}`);
  const close = all.filter(t => (t.report || []).some(r => r[0] !== 'ok')).length;
  toast(`Imported ${all.length} tool${all.length === 1 ? '' : 's'}: ${parts.join(', ') || 'none'}${skipped ? ` · ${skipped} skipped (not drawing tools)` : ''}${failed.length ? ` · ${failed.length} could not be read` : ''}` +
    (all.length ? ` · ⓘ under Sub Tool shows how each tool was translated${close ? ` (${close} with settings Inkvessa does differently)` : ''}` : ''), 8000);
  W.finish(`${all.length} tool${all.length === 1 ? '' : 's'} added${parts.length ? ': ' + parts.join(', ') : ''}${skipped ? ` · ${skipped} skipped (not drawing tools)` : ''}${failed.length ? ` · ${failed.length} could not be read` : ''}. ⓘ under Sub Tool shows how each tool was translated.`);
  all.forEach(t => { delete t.row; });
  lastImport = all;
  if (all.length) { const last = all[all.length - 1]; const grp = GROUPS.find(g => g.subs && g.subs.includes(last.id)); if (grp) selectGroup(grp.id); selectTool(last.id); }
  return all;
}
/* files from a drop: folders too */
async function droppedFiles(dt) {
  const items = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (!items.length) return [...dt.files];
  const out = [];
  const walk = ent => new Promise(res => {
    if (ent.isFile) ent.file(f => { out.push(f); res(); }, () => res());
    else if (ent.isDirectory) { const r = ent.createReader(), all = []; const more = () => r.readEntries(async es => { if (!es.length) { for (const e of all) await walk(e); res(); } else { all.push(...es); more(); } }, () => res()); more(); }
    else res();
  });
  for (const e of items) await walk(e);
  return out;
}
/* the Clip Studio pen set that ships built in (replaces the original pens) */
function loadBuiltinPens() {
  const ids = { 'G-pen': 'pen', 'Real G-Pen': 'realpen', 'Mapping pen': 'mapping', 'Turnip pen': 'turnip', Calligraphy: 'callig', 'Textured pen': 'textured' };
  const grp = GROUPS.find(g => g.id === 'pen'); const order = [];
  for (const [name, b64] of PENSET) {
    try {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const def = sutToDefs(u.buffer).find(d => !d.skip); if (!def) continue;
      const id = ids[name] || 'pen_' + name.toLowerCase().replace(/[^a-z]+/g, '_');
      TOOLDEF[id] = { name: def.name || name, kind: 'brush', icon: 'pen', preset: P(def.size, def.hardness, def.flow, def.opacity, def.pSize, def.pAlpha, def.smooth,
        { aa: def.aa, speed: def.speed || 0, taperIn: def.taperIn, taperRatio: def.taperRatio, nibRatio: def.nibRatio ?? def.tipThick ?? 1, nibAngle: def.nibAngle ?? def.tipAngle ?? 0, pMin: def.pMin, pCurve: def.pCurve, aMin: def.aMin, aCurve: def.aCurve, tMin: def.tMin, tCurve: def.tCurve, vMin: def.vMin, vCurve: def.vCurve,
          sRand: def.sRand, taperOut: def.taperOut, taperOutRatio: def.taperOutRatio, min1: def.min1,
          ...(def.tex ? { tex: def.tex, texAmt: def.texAmt, texScale: def.texScale } : id === 'textured' ? { tex: 'paper', texAmt: 0.85 } : {}) }) };
      settings[id] = { ...TOOLDEF[id].preset };
      order.push(id);
    } catch (e) { /* skip unreadable */ }
  }
  if (order.length) {
    for (const old of grp.subs) if (!order.includes(old)) { delete TOOLDEF[old]; delete settings[old]; }
    grp.subs = order;
  }
}
function readFile(file, asText) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; asText ? r.readAsText(file) : r.readAsDataURL(file); });
}
function pickFile(accept, cb) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
  i.onchange = () => { if (i.files[0]) cb(i.files[0]); };
  i.click();
}
const API = {
  version: 1, importSut, state, toast, setColor, activeLayer, compositeFrame, selectTool, gotoFrame,
  addBrush: def => registerBrush(def, false),
  addCommand(name, label, fn) {
    CMD['addon_' + name] = fn;
    const items = MENUS.find(m => m[0] === 'Add-ons')[1];
    items.push([label, 'addon_' + name]);
    buildMenus();
  }
};
window.Sketchforge = API; window.Nexilune = API; window.Inkvessa = API; // add-ons written for the old names keep working
function runScript(text, name) {
  try { new Function('Sketchforge', 'Nexilune', 'Inkvessa', text)(API, API, API); return true; }
  catch (e) { toast(`Add-on "${name}" failed: ${e.message}`); return false; }
}
function installAddonUI() {
buildSubBar();
CMD.addBrushTip = () => pickFile('image/*', async f => {
  try {
    const url = await readFile(f);
    const id = await registerBrush({ name: f.name.replace(/\.[^.]+$/, ''), tip: url }, true);
    selectTool(id); toast('Brush added to the Brush group');
  } catch (e) { toast('Could not read that image'); }
});
CMD.addSut = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.sut,.zip'; i.multiple = true; i.onchange = () => i.files.length && importTools([...i.files]); i.click(); };
CMD.addSutFolder = () => { const i = document.createElement('input'); i.type = 'file'; i.webkitdirectory = true; i.multiple = true; i.onchange = () => i.files.length && importTools([...i.files]); i.click(); };
CMD.addScript = () => pickFile('.js,text/javascript', async f => {
  if (!confirm('Add-on scripts can do anything in this app. Only install scripts you trust.\n\nInstall "' + f.name + '"?')) return;
  const text = await readFile(f, true);
  if (runScript(text, f.name)) { addons.scripts.push({ name: f.name, text }); saveAddons(); toast('Installed ' + f.name); }
});
CMD.manageAddons = () => {
  const list = [...addons.brushes.map(b => ['brush', b.id, b.name]), ...addons.scripts.map((s, i) => ['script', i, s.name])];
  if (!list.length) { toast('No add-ons installed yet'); return; }
  const d = $('#helpDialog');
  $('#helpBody').innerHTML = '<h5>Installed add-ons</h5>' + list.map(([t, id, n]) =>
    `<div><span>${t === 'brush' ? '🖌' : '⚙'} ${n.replace(/[<>&]/g, '')}</span><button data-rm="${t}:${id}">Remove</button></div>`).join('') +
    '<div style="grid-column:1/-1;display:block;color:#aaa">Removing takes effect after reloading the page.</div>';
  $('#helpBody').onclick = e => {
    const rm = e.target.dataset && e.target.dataset.rm; if (!rm) return;
    const [t, id] = rm.split(':');
    if (t === 'brush') addons.brushes = addons.brushes.filter(b => b.id !== id); else addons.scripts.splice(+id, 1);
    saveAddons(); e.target.closest('div').remove();
  };
  d.showModal();
};
CMD.resetLayout = resetLayout;
CMD.show3d = show3D;
panels.forEach(p => { CMD['panel_' + p.dataset.pid] = () => togglePanel(p.dataset.pid); });
MENUS.push(MENU_ADDONS);
MENUS.splice(MENUS.length - 2, 0, ['Window', [['Reset panel layout', 'resetLayout'], '-',
  ...panels.map(p => [p.querySelector('h4').childNodes[0].textContent.trim() + ' (show / hide)', 'panel_' + p.dataset.pid])]]);
/* keep Help last */
MENUS.push(MENUS.splice(MENUS.findIndex(m => m[0] === 'Help'), 1)[0]);

}

async function loadAddons() {
  try { addons = { brushes: [], scripts: [], ...JSON.parse(localStorage.getItem(ADDON_KEY) || '{}') }; } catch (e) { /* ignore */ }
  const db = await addonDB();
  if (db) {
    const saved = await new Promise(res => { try { const rq = db.transaction('kv').objectStore('kv').get('brushes'); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); } catch (e) { res(null); } });
    if (Array.isArray(saved)) addons.brushes = saved.concat(addons.brushes.filter(b => !saved.some(x => x.id === b.id)));
    if (addons.brushes.length && !Array.isArray(saved)) saveAddons(); // move the old localStorage tools over
  }
  for (const b of addons.brushes) { try { await registerBrush({ ...b }, false); } catch (e) { /* skip broken */ } }
  for (const s of addons.scripts) runScript(s.text, s.name);
}


/* ---------- pen pressure & touch settings (Apple Pencil / tablet) ---------- */
function openPenDialog() {
  let d = $('#penDialog');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'penDialog'; d.className = 'pendlg';
    d.innerHTML = `<form method="dialog"><h2>Pen pressure & touch</h2>
      <p class="small" id="penDetect"></p>
      <p class="muted small" id="penStatus">Draw on the test pad with your pen (Apple Pencil, Wacom, XP-Pen, Huion, Surface pen…) to see the response.</p>
      <canvas id="penPad" width="520" height="150" style="width:100%;background:#2a2a2a;border:1px solid #1c1c1c;touch-action:none;border-radius:4px"></canvas>
      <div class="btnrow" style="margin:6px 0"><span class="muted small" style="align-self:center">Feel:</span>
        <button type="button" data-preset="soft">Soft</button><button type="button" data-preset="normal">Normal</button><button type="button" data-preset="firm">Firm</button>
        <span style="flex:1"></span><button type="button" id="penCal" title="Measures how light and how hard your pen really goes">Calibrate my pen…</button></div>
      <p class="small" id="penCalMsg" hidden></p>
      <div class="pencurve"><div id="penCurveHost"></div><p class="muted small">Your pressure curve: <b>drag the points</b> to shape it as you like. Left = how hard you press, up = how thick / dark the line gets. Click to add a point, double-click to remove one.</p></div>
      <label class="slider"><span>Sensitivity</span><input type="range" id="penGamma" min="30" max="300" step="5"><output id="penGammaV"></output></label>
      <p class="muted small" style="margin:0 0 6px">Left = soft (light pressure already gives thick lines), right = firm (you must press harder).</p>
      <label class="slider"><span>Min. pressure</span><input type="range" id="penMin" min="0" max="50" step="1"><output id="penMinV"></output></label>
      <label class="slider"><span>Max. pressure</span><input type="range" id="penMax" min="30" max="100" step="1"><output id="penMaxV"></output></label>
      <label class="select"><span>Side button</span><select id="penSide"><option value="pick">Eyedropper (pick colour)</option><option value="pan">Move the canvas</option><option value="none">Nothing</option></select></label>
      <label class="check"><input type="checkbox" id="penPalm"> Palm rejection: once a pen is used, fingers only pan / zoom</label>
      <label class="check"><input type="checkbox" id="penUndo"> Two-finger tap = undo</label>
      <details class="pentips"><summary>No pressure? Set up your tablet</summary>
        <p class="small">Browsers and the desktop app read pressure through the system pen API. If lines never get thinner / thicker:</p>
        <ul class="small">
          <li><b>Wacom (Windows):</b> Wacom Tablet Properties → Mapping → tick <i>Use Windows Ink</i>.</li>
          <li><b>XP-Pen (Windows):</b> Pentablet / XP-PEN driver → Pen → tick <i>Windows Ink</i>, then restart the app.</li>
          <li><b>Huion (Windows):</b> HuionTablet → Digital Pen → tick <i>Enable Windows Ink</i>.</li>
          <li><b>Gaomon, Veikk, Ugee, XenceLabs:</b> in the driver, turn on <i>Windows Ink</i> (sometimes called "Windows Ink support").</li>
          <li><b>macOS:</b> install the latest tablet driver and allow it in System Settings → Privacy &amp; Security → Accessibility.</li>
          <li><b>iPad + Apple Pencil:</b> works in Safari / the Home Screen app. If strokes stop, turn off <i>Settings → Apple Pencil → Scribble</i>.</li>
          <li><b>Surface, Samsung S-Pen, Android styluses:</b> work out of the box in Chrome / Edge.</li>
          <li>Then use <b>Calibrate my pen</b> above so light and hard strokes reach the full range.</li>
        </ul></details>
      <details class="pentips"><summary>Light, slow strokes start late? (Windows)</summary>
        <p class="small">Windows waits a moment on a gentle pen touch to see if you want a right-click. Hard or fast strokes skip the wait, light slow ones feel laggy. Turn it off:</p>
        <ul class="small">
          <li><b>Windows 10 / 11:</b> Start → type <i>Pen and Touch</i> (Control Panel) → <i>Pen Options</i> → <i>Press and hold</i> → <i>Settings…</i> → untick <i>Enable press and hold for right-clicking</i>.</li>
          <li>Also in Settings → Bluetooth &amp; devices → Pen &amp; Windows Ink: turn off <i>Show visual effects</i> and <i>Show cursor</i> if the pen still feels slow.</li>
          <li><b>Wacom:</b> Wacom Tablet Properties → Pen → <i>Tip Feel</i> towards <i>Soft</i>; untick <i>Use Windows Ink</i> only if pressure keeps working without it.</li>
          <li><b>XP-Pen / Huion:</b> in the driver, make the pressure curve softer at the start, and turn off "press and hold" / right-click gestures if offered.</li>
        </ul></details>
      <div class="dialog-actions"><button type="button" id="penReset">Reset</button><button type="button" id="penClose" class="primary">Done</button></div></form>`;
    document.body.appendChild(d);
    const pad = $('#penPad'), g = pad.getContext('2d');
    const sync = () => {
      $('#penGamma').value = Math.round(penCfg.gamma * 100); $('#penGammaV').textContent = penCfg.gamma.toFixed(2);
      $('#penMin').value = Math.round(penCfg.min * 100); $('#penMinV').textContent = Math.round(penCfg.min * 100) + '%';
      $('#penMax').value = Math.round(penCfg.max * 100); $('#penMaxV').textContent = Math.round(penCfg.max * 100) + '%';
      $('#penPalm').checked = penCfg.palm; $('#penUndo').checked = penCfg.twoTapUndo; $('#penSide').value = penCfg.side || 'pick';
      const det = $('#penDetect');
      det.innerHTML = penCfg.penSeen ? (realPressureSeen ? '✅ Pen detected, pressure is working.' : (penSamples > 20 && penFlat ? '⚠️ Pen detected but it sends <b>no pressure</b> — see "No pressure?" below.' : '✏️ Pen detected — draw on the pad to check pressure.')) : 'No pen used yet in this session — draw on the pad with your pen.';
      drawCurve();
      if (curveEd) curveEd.set(penCfg.curve || gammaPts(penCfg.gamma));
    };
    // points that follow the Sensitivity curve, so dragging starts from what the user has now
    const gammaPts = gm => [0, 0.25, 0.5, 0.75, 1].map(x => [x, +Math.pow(x, gm).toFixed(3)]);
    const curveEd = typeof beCurve === 'function' ? beCurve($('#penCurveHost'), penCfg.curve || gammaPts(penCfg.gamma), pts => { penCfg.curve = pts || [[0, 0], [1, 1]]; drawCurve(); save(); }) : null;
    const save = () => { try { const { penSeen, announced, eraserPrev, ...keep } = penCfg; localStorage.setItem('sketchforge.pen', JSON.stringify(keep)); } catch (e) { /* ignore */ } };
    const drawCurve = () => {
      g.clearRect(0, 0, pad.width, pad.height);
      g.strokeStyle = '#555'; g.strokeRect(0.5, 0.5, 130, 140);
      g.strokeStyle = '#8aa4d6'; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= 100; i++) { const y = shapePressure(i / 100); const X = 4 + i * 1.22, Y = 136 - (y - 0.01) * 130; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
      g.stroke(); g.lineWidth = 1;
      g.fillStyle = '#888'; g.font = '10px sans-serif'; g.fillText('pressure curve', 140, 14);
    };
    const PRESETS = { soft: 0.55, normal: 0.8, firm: 1.4 };
    d.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { penCfg.gamma = PRESETS[b.dataset.preset]; penCfg.curve = null; sync(); save(); });
    $('#penGamma').oninput = e => { penCfg.gamma = e.target.value / 100; penCfg.curve = null; sync(); save(); };
    $('#penMin').oninput = e => { penCfg.min = e.target.value / 100; sync(); save(); };
    $('#penMax').oninput = e => { penCfg.max = e.target.value / 100; sync(); save(); };
    $('#penSide').onchange = e => { penCfg.side = e.target.value; save(); };
    $('#penPalm').onchange = e => { penCfg.palm = e.target.checked; save(); };
    $('#penUndo').onchange = e => { penCfg.twoTapUndo = e.target.checked; save(); };
    $('#penReset').onclick = () => { Object.assign(penCfg, { gamma: 0.8, curve: null, min: 0, max: 1, palm: true, twoTapUndo: true, side: 'pick' }); sync(); save(); };
    $('#penClose').onclick = () => d.close();
    /* calibration: collect raw pen pressures, then use the light / hard ends the pen really reaches */
    let cal = null;
    $('#penCal').onclick = () => {
      cal = { samples: [] };
      const m = $('#penCalMsg'); m.hidden = false; m.textContent = 'Calibrating: on the pad, draw 3–4 strokes going from very light to as hard as you normally press…';
      g.clearRect(0, 0, pad.width, pad.height);
    };
    const finishCal = () => {
      const s = cal.samples.sort((a, b) => a - b), m = $('#penCalMsg'); cal = null;
      $('#penStatus').textContent = 'Calibration finished — draw on the pad to try the new range.';
      if (s.length < 60) { m.textContent = 'Not enough pen data — make sure you draw with the pen (not a finger or mouse) and try again.'; return; }
      const q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))];
      if (q(0.98) - q(0.02) < 0.05) { m.textContent = '⚠️ Your pen reports the same pressure everywhere: pressure is not reaching the app. See "No pressure?" below.'; return; }
      penCfg.min = clamp(Math.round(q(0.03) * 100) / 100, 0, 0.4);
      penCfg.max = clamp(Math.round(q(0.97) * 100) / 100, Math.max(0.3, penCfg.min + 0.15), 1);
      m.textContent = `✅ Done: your light strokes start at ${Math.round(penCfg.min * 100)}% and your hard strokes reach ${Math.round(penCfg.max * 100)}% — now the full range is used.`;
      sync(); save();
    };
    let last = null, calStrokes = 0;
    pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); last = null; if (e.pointerType === 'pen') penCfg.penSeen = true; padMove(e); });
    pad.addEventListener('pointermove', e => { if (e.buttons) { for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) padMove(ev); } });
    pad.addEventListener('pointerup', e => { last = null; if (cal && e.pointerType === 'pen' && ++calStrokes >= 3 && cal.samples.length > 150) { calStrokes = 0; finishCal(); } });
    function padMove(e) {
      const r = pad.getBoundingClientRect(), k = pad.width / r.width;
      const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
      const isPen = e.pointerType === 'pen';
      const raw = isPen ? penRaw(e) : 0.5;
      if (isPen) pressureOf(e);
      if (cal && isPen && raw > 0) cal.samples.push(raw);
      const p = isPen ? shapePressure(raw > 0 ? raw : 0.03) : 0.5;
      $('#penStatus').textContent = `${e.pointerType}  ·  raw pressure ${raw.toFixed(2)}${isPen && penRaw.src !== 'pointer' ? ' (' + penRaw.src + ')' : ''}  →  used ${p.toFixed(2)}` + (cal ? `  ·  calibrating (${cal.samples.length} samples)` : '');
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 1 + p * 9, 0, 7); g.fill();
      last = [x, y];
      if (!cal) { const det = $('#penDetect'); if (isPen && realPressureSeen) det.innerHTML = '✅ Pen detected, pressure is working.'; }
    }
    d.sync = sync;
  }
  d.sync(); d.showModal();
}

/* ---------- Sub Tool panel footer: add / duplicate / delete brushes ---------- */
async function importAnyFile(f) {
  try {
    if (/\.(sut|zip)$/i.test(f.name)) await importTools([f]);
    else if (/\.sfbrush$/i.test(f.name)) { const j = JSON.parse(await readFile(f, true)); if (!j.def) throw new Error('not a Inkvessa brush'); await importSfBrush(j.def); }
    else if (/^image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name)) {
      const id = await registerBrush({ name: f.name.replace(/\.[^.]+$/, ''), tip: await readFile(f) }, true); selectTool(id); toast('Brush added');
    } else toast('Drop a .sut brush or an image');
  } catch (e) { toast('Could not import: ' + e.message); }
}
function duplicateBrush() {
  const id = state.tool, def0 = TOOLDEF[id];
  if (kindOf(id) !== 'brush') { toast('Pick a brush or pen first'); return; }
  const s = settings[id], orig = addons.brushes.find(b => b.id === id);
  registerBrush({ name: def0.name + ' copy', size: s.size, hardness: s.hardness, flow: s.flow, opacity: s.opacity, pSize: s.pSize, pAlpha: s.pAlpha,
    smooth: s.smooth, aa: s.aa, spacing: s.spacing, taperIn: s.taperIn, taperRatio: s.taperRatio, tip: orig && orig.tip, tipRot: s.tipRot,
    pen: groupOf(id).id === 'pen' }, true).then(nid => { selectTool(nid); toast('Duplicated'); });
}
/* Tool translator report: every Clip Studio setting of an imported tool and what became of it */
let lastImport = [];
function toolReport(id) {
  id = id || state.tool;
  const d = TOOLDEF[id];
  if (!d || !d.custom) { toast('Pick an imported tool to see how it was translated'); return; }
  const rows = d.report || [];
  let learnt = {}; try { learnt = JSON.parse(localStorage.getItem('sketchforge.sutlearn.v1') || '{}'); } catch (e) { /* none */ }
  const others = lastImport.filter(t => t.id !== id && TOOLDEF[t.id]);
  const dlg = document.createElement('dialog'); dlg.className = 'toolreport';
  const ic = { ok: '✓', approx: '≈', no: '✗' };
  const list = rows.length ? rows.map(([k, m]) => `<li class="r-${k}"><b>${ic[k]}</b><span>${m.replace(/[<&]/g, c => c === '<' ? '&lt;' : '&amp;')}</span></li>`).join('')
    : '<li class="r-approx"><b>≈</b><span>Imported before the tool translator existed: import the .sut file again to see (and get) the full translation.</span></li>';
  const counts = ['ok', 'approx', 'no'].map(k => rows.filter(r => r[0] === k).length);
  const top = Object.entries(learnt).sort((a, b) => b[1] - a[1]).slice(0, 8);
  dlg.innerHTML = `<form method="dialog"><h3>ⓘ ${d.name.replace(/[<&]/g, '')}</h3>
    <p class="sub">Clip Studio tool → Inkvessa <b>${GROUP_LABEL[(groupOf(id) || {}).id] || ''}</b> · ✓ ${counts[0]} same · ≈ ${counts[1]} close · ✗ ${counts[2]} not yet</p>
    <ul class="trep">${list}</ul>
    ${top.length ? `<details><summary>Clip Studio settings seen in your tools that Inkvessa does not use yet</summary><p class="sub">${top.map(([k, c]) => `${SUT_LABEL[k] || k} (${c})`).join(' · ')}</p></details>` : ''}
    ${others.length ? `<p class="sub">Other tools from the last import: ${others.map(t => `<a href="#" data-id="${t.id}">${TOOLDEF[t.id].name.replace(/[<&]/g, '')}</a>`).join(' · ')}</p>` : ''}
    <div class="row"><button type="button" data-a="tune">⚙ Adjust in the brush editor…</button><button value="ok">Close</button></div></form>`;
  dlg.querySelectorAll('a[data-id]').forEach(a => a.onclick = e => { e.preventDefault(); dlg.close(); selectTool(a.dataset.id); toolReport(a.dataset.id); });
  dlg.addEventListener('close', () => dlg.remove());
  const tune = dlg.querySelector('[data-a=tune]'); if (kindOf(id) !== 'brush') tune.remove(); else tune.onclick = () => { dlg.close(); openBrushEditor(id); };
  document.body.appendChild(dlg); dlg.showModal();
}
function deleteBrush() {
  const id = state.tool;
  if (!TOOLDEF[id].custom) { toast('Built-in tools cannot be deleted. Only imported or duplicated ones.'); return; }
  if (!confirm('Delete "' + TOOLDEF[id].name + '"?')) return;
  const g = groupOf(id); g.subs.splice(g.subs.indexOf(id), 1);
  delete TOOLDEF[id]; delete settings[id]; customTips.delete(id);
  addons.brushes = addons.brushes.filter(b => b.id !== id); saveAddons();
  selectTool(g.subs[0]);
}
function buildSubBar() {
  const list = $('#subtoolList');
  const bar = document.createElement('div'); bar.id = 'subtoolBar';
  const mk = (ic, title, fn) => { const b = document.createElement('button'); b.dataset.ic = ic; b.innerHTML = icon(ic); b.title = title; b.onclick = fn; bar.appendChild(b); };
  mk('plus', 'Add tools: Clip Studio .sut files (several at once, or a .zip) or an image', () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.sut,.zip,.sfbrush,image/*'; i.multiple = true;
    i.onchange = async () => { const fs = [...i.files], tools = fs.filter(f => /\.(sut|zip)$/i.test(f.name)); if (tools.length) await importTools(tools); for (const f of fs) if (!tools.includes(f)) await importAnyFile(f); }; i.click(); });
  mk('copy', 'Duplicate this sub tool', duplicateBrush);
  mk('trash', 'Delete this sub tool (imported / duplicated only)', deleteBrush);
  mk('info', 'How this imported tool was translated from Clip Studio', () => toolReport());
  const hintEl = document.createElement('span'); hintEl.textContent = 'Drop tools here'; hintEl.title = 'Drop Clip Studio .sut tools, a .zip, a folder, a .sfbrush or a picture here'; bar.appendChild(hintEl);
  list.after(bar);
  const sec = list.closest('.pal');
  sec.addEventListener('dragover', e => { e.preventDefault(); sec.classList.add('dropfile'); });
  sec.addEventListener('dragleave', () => sec.classList.remove('dropfile'));
  sec.addEventListener('drop', async e => { e.preventDefault(); sec.classList.remove('dropfile'); const fs = await droppedFiles(e.dataTransfer), tools = fs.filter(f => /\.(sut|zip)$/i.test(f.name));
    if (tools.length) await importTools(tools); for (const f of fs) if (!tools.includes(f) && (/^image\//.test(f.type) || /\.sfbrush$/i.test(f.name))) await importAnyFile(f); });
}
