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
async function makeTip(src) {
  const img = await loadImage(src);
  const tip = makeCanvas(256, 256), g = tip.getContext('2d');
  const k = Math.min(256 / img.width, 256 / img.height);
  g.drawImage(img, (256 - img.width * k) / 2, (256 - img.height * k) / 2, img.width * k, img.height * k);
  const d = g.getImageData(0, 0, 256, 256), px = d.data;
  let opaque = true, colour = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 250) opaque = false; if (px[i + 3] > 60) { n++; const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]); if (mx - mn > 60) colour++; } }
  if (opaque) for (let i = 0; i < px.length; i += 4) { px[i + 3] = 255 - (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11); px[i] = px[i + 1] = px[i + 2] = 0; }
  g.putImageData(d, 0, 0);
  return { tip, colour: !opaque && n > 0 && colour / n > 0.15 };
}
const GROUP_ICON = { pen: 'pen', pencil: 'pencil', brush: 'brush', airbrush: 'airbrush', decor: 'sparkle', eraser: 'eraser', blend: 'blend' };
async function registerBrush(def, persist) {
  const id = def.id || 'custom_' + Date.now().toString(36) + Math.floor(Math.random() * 999);
  const group = def.group || (def.pen ? 'pen' : 'brush');
  if (def.kind === 'gradient' || group === 'gradient') { // a gradient preset
    TOOLDEF[id] = { name: def.name || 'Gradient', kind: 'gradient', icon: 'gradient', custom: true, stops: def.stops || [[0, 'fg'], [1, 'bg']], radial: !!def.radial };
    settings[id] = {};
    const gg = GROUPS.find(g2 => g2.id === 'gradient'); if (gg && !gg.subs.includes(id)) gg.subs.push(id);
    if (persist) { addons.brushes.push({ ...def, id, group: 'gradient' }); saveAddons(); }
    renderSubTools();
    return id;
  }
  const extra = { aa: def.aa ?? 2, taperIn: def.taperIn || 0, taperRatio: def.taperRatio ?? 0.3, spacing: def.spacing || 0.15, tipRot: !!def.tipRot };
  const tipSrcs = def.tips && def.tips.length ? def.tips : def.tip ? [def.tip] : [];
  const ids = [];
  for (let i = 0; i < tipSrcs.length; i++) {
    try { const { tip, colour } = await makeTip(tipSrcs[i]); const tid = id + (i ? '_' + i : ''); customTips.set(tid, tip); if (colour) tip._colour = true; ids.push(tid); } catch (e) { /* skip a broken image */ }
  }
  if (ids.length === 1) extra.tipId = ids[0];
  else if (ids.length > 1) { extra.tipId = ids[0]; extra.tipIds = ids; extra.tipOrder = def.tipOrder || 'random'; }
  for (const k of ['scatter', 'count', 'jitter', 'hueJit', 'wet', 'smudge', 'blurTool', 'nibRatio', 'nibAngle', 'speed']) if (def[k] != null) extra[k] = def[k];
  if (def.tex) {
    extra.tex = def.tex; extra.texAmt = def.texAmt ?? 0.6; extra.texScale = def.texScale || 1;
    if (def.texImg) { try { extra.tex = registerTexture('tex_' + id, await loadImage(def.texImg), def.texInv); } catch (e) { /* keep generic paper */ } }
  }
  TOOLDEF[id] = { name: def.name || 'Custom brush', kind: 'brush', icon: GROUP_ICON[group] || (def.pen ? 'pen' : 'brush'), custom: true,
    preset: P(def.size || 40, ids.length ? 1 : (def.hardness ?? 1), def.flow ?? 1, def.opacity ?? 1, def.pSize ?? true, def.pAlpha ?? false, def.smooth ?? 0.2, extra) };
  if (group === 'eraser' || def.erase) TOOLDEF[id].erase = true;
  settings[id] = { ...TOOLDEF[id].preset };
  const g = GROUPS.find(g2 => g2.id === group) || GROUPS.find(g2 => g2.id === 'brush');
  if (!g.subs.includes(id)) g.subs.push(id);
  if (persist) { addons.brushes.push({ ...def, id, group: g.id }); saveAddons(); }
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
const effectorInputs = b => (b && b.length >= 16 ? new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(12) : 0);
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
/* what kind of tool a sub tool is: from its name (English / Japanese / Chinese / Korean words) and its settings */
const SUT_NAMES = [['gradient', /gradient|gradation|グラデ|渐变|漸層|그라데/i], ['eraser', /eras|消しゴム|消去|橡皮|지우개/i],
  ['blend', /blend|blur|smudge|finger|ぼかし|指先|色混ぜ|涂抹|模糊|블렌드|흐림/i], ['airbrush', /air ?brush|spray|エアブラシ|スプレー|喷枪|噴槍|에어/i],
  ['decor', /deco|star|flower|lace|sparkle|glitter|leaf|leaves|grass|chain|ribbon|stamp|pattern|snow|heart|cloud|装飾|デコ|模様|花|星|レース|装饰|데코|꽃/i],
  ['pencil', /pencil|crayon|chalk|charcoal|pastel|鉛筆|クレヨン|パステル|木炭|铅笔|蜡笔|연필/i],
  ['brush', /brush|paint|water ?colou?r|oil|gouache|acrylic|wash|水彩|油彩|ブラシ|筆|画笔|油画|붓|수채/i], ['pen', /pen|ink|marker|liner|ペン|マーカー|钢笔|筆ペン|펜/i]];
function sutKind(name, v, tips) {
  const cols = Object.keys(v), has = re => cols.some(c => re.test(c) && v[c] != null && v[c] !== 0);
  if (has(/Gradation|Gradient/i) || (v.BrushSize == null && SUT_NAMES[0][1].test(name))) return 'gradient';
  if (v.BrushSize == null) return null; // fill, text, selection… not a drawing tool
  for (const [k, re] of SUT_NAMES) if (k !== 'gradient' && re.test(name)) return k;
  if (has(/Erase/i)) return 'eraser';
  if (tips.length > 1 || v.BrushRibbon || (v.BrushUseSpray && v.BrushUsePatternImage)) return 'decor';
  if (v.BrushUseSpray) return 'airbrush';
  if (has(/WaterEdge|ColorMix|PaintMix|MixColor|MixingColor/i)) return 'brush';
  if ((v.BrushHardness ?? 100) >= 90 && !v.TextureImage) return 'pen';
  if (v.TextureImage) return 'pencil';
  return 'brush';
}
const sutNum = (v, re) => { for (const c of Object.keys(v)) if (re.test(c) && typeof v[c] === 'number') return v[c]; return null; };
/* Convert Clip Studio sub tool data (.sut) into Sketchforge tool definitions, each with the group it belongs to. */
function sutToDefs(buf) {
  const t = readSqlite(buf);
  const variants = new Map((t.Variant || []).map(v => [v.VariantID, v]));
  const defs = [];
  for (const n of (t.Node || [])) {
    const v = variants.get(n.NodeVariantID);
    if (!v || !n.NodeName) continue;
    const tips = v.BrushUsePatternImage ? findPngs(v.BrushPatternImageArray) : [];
    const group = sutKind(n.NodeName, v, tips);
    if (!group) { defs.push({ name: n.NodeName, skip: true }); continue; }
    if (group === 'gradient') {
      defs.push({ name: n.NodeName, kind: 'gradient', group, radial: /circle|radial|円|放射/i.test(n.NodeName) || !!sutNum(v, /Circle|Radial/i), approx: true,
        stops: /transparent|透明/i.test(n.NodeName) ? [[0, 'fg'], [1, 'fg0']] : [[0, 'fg'], [1, 'bg']] });
      continue;
    }
    const sz = effectorInputs(v.BrushSizeEffector), fl = effectorInputs(v.BrushFlowEffector), op = effectorInputs(v.BrushOpacityEffector);
    /* effector input bits (observed): 16 = pen pressure, 64 = drawing speed */
    const rot = v.BrushRotation || 0, thick = (v.BrushThickness ?? 100) / 100;
    const def = {
      name: n.NodeName, group, size: clamp(Math.round(v.BrushSize * 10) / 10, 0.5, 300),
      opacity: (v.Opacity ?? 100) / 100, flow: (v.BrushFlow ?? 100) / 100, hardness: (v.BrushHardness ?? 100) / 100,
      aa: v.AntiAlias ?? 2, smooth: clamp((v.FlickerReduction || 0) / 50, 0, 0.9),
      pSize: !!(sz & 16), pAlpha: !!((fl & 16) || (op & 16)), speed: (sz & 64) ? 0.5 : 0,
      spacing: clamp((v.BrushInterval || 10) / 100, 0.04, 2), tip: tips[0] || null, tips: tips.length > 1 ? tips : undefined,
      taperIn: v.BrushUseIn ? (v.BrushInLength || 0) : 0, taperRatio: (v.BrushInRatio ?? 30) / 100,
      nibRatio: thick < 1 ? clamp(thick, 0.05, 1) : 1, nibAngle: rot,
      pen: group === 'pen',
      ...(v.TextureImage ? { texImg: findPng(v.TextureImage), tex: 'paper', texAmt: clamp((v.TextureDensity ?? 50) / 100, 0, 1),
        texScale: clamp((v.TextureScale2 ?? 100) / 100, 0.1, 8), texInv: !!v.TextureReverseDensity } : {})
    };
    if (v.BrushUseSpray) { def.scatter = clamp((v.BrushSpraySize ?? 100) / 100, 0.2, 3); def.count = clamp(Math.round((v.BrushSprayDensity ?? 10) / 8), 1, 10); }
    if ((v.BrushRotationRandom || v.BrushRotationRandomInSpray || 0) > 0 || group === 'decor') def.tipRot = !!((v.BrushRotationRandom || v.BrushRotationRandomInSpray || 0) > 0);
    if (group === 'decor' && v.BrushUseSpray) def.jitter = 0.35;
    if (tips.length > 1) def.tipOrder = v.BrushPatternOrderType === 0 ? 'seq' : 'random';
    const hue = sutNum(v, /Hue(Change|Jitter|Random)|ColorJitterHue|ChangeHue/i); if (hue) def.hueJit = clamp(hue > 1 ? hue / 100 : hue, 0, 1);
    if (v.BrushUseWaterEdge || sutNum(v, /WaterEdge/i)) def.wet = 0.55;
    if (group === 'blend') { def.smudge = /blur|ぼかし|模糊/i.test(n.NodeName) ? 0 : 0.85; if (def.smudge === 0) def.blurTool = true; }
    if (group === 'eraser') def.erase = true;
    defs.push(def);
  }
  return defs;
}
async function importSut(file) {
  const defs = sutToDefs(await file.arrayBuffer());
  const use = defs.filter(d => !d.skip);
  if (!use.length) throw new Error(defs.length ? 'this tool is not a drawing tool (fill, text, selection…)' : 'No tools found in that file');
  const out = [];
  for (const def of use) out.push({ id: await registerBrush(def, true), group: def.kind === 'gradient' ? 'gradient' : def.group || 'brush', name: def.name });
  if (out.length) selectTool(out[out.length - 1].id);
  out.skipped = defs.length - use.length;
  return out;
}
const GROUP_LABEL = { pen: 'Pen', pencil: 'Pencil', brush: 'Brush', airbrush: 'Airbrush', decor: 'Decoration', eraser: 'Eraser', blend: 'Blend', gradient: 'Gradient' };
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
  for (const f of list) {
    try { const r = await importSut(f); skipped += r.skipped || 0; for (const t of r) { per[t.group] = (per[t.group] || 0) + 1; all.push(t); } }
    catch (e) { if (/not a drawing tool/.test(e.message)) skipped++; else failed.push(f.name); }
  }
  const parts = Object.entries(per).map(([g, k]) => `${k} → ${GROUP_LABEL[g] || g}`);
  toast(`Imported ${all.length} tool${all.length === 1 ? '' : 's'}: ${parts.join(', ') || 'none'}${skipped ? ` · ${skipped} skipped (not drawing tools)` : ''}${failed.length ? ` · ${failed.length} could not be read` : ''}`, 7000);
  if (all.length) { const last = all[all.length - 1]; const grp = GROUPS.find(g => g.subs.includes(last.id)); if (grp) selectGroup(grp.id); selectTool(last.id); }
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
      const def = sutToDefs(u.buffer)[0]; if (!def) continue;
      const id = ids[name] || 'pen_' + name.toLowerCase().replace(/[^a-z]+/g, '_');
      TOOLDEF[id] = { name: def.name || name, kind: 'brush', icon: 'pen', preset: P(def.size, def.hardness, def.flow, def.opacity, def.pSize, def.pAlpha, def.smooth,
        { aa: def.aa, speed: def.speed || 0, taperIn: def.taperIn, taperRatio: def.taperRatio, nibRatio: def.nibRatio, nibAngle: def.nibAngle,
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
window.Sketchforge = API;
function runScript(text, name) {
  try { new Function('Sketchforge', text)(API); return true; }
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
    };
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
    d.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { penCfg.gamma = PRESETS[b.dataset.preset]; sync(); save(); });
    $('#penGamma').oninput = e => { penCfg.gamma = e.target.value / 100; sync(); save(); };
    $('#penMin').oninput = e => { penCfg.min = e.target.value / 100; sync(); save(); };
    $('#penMax').oninput = e => { penCfg.max = e.target.value / 100; sync(); save(); };
    $('#penSide').onchange = e => { penCfg.side = e.target.value; save(); };
    $('#penPalm').onchange = e => { penCfg.palm = e.target.checked; save(); };
    $('#penUndo').onchange = e => { penCfg.twoTapUndo = e.target.checked; save(); };
    $('#penReset').onclick = () => { Object.assign(penCfg, { gamma: 0.8, min: 0, max: 1, palm: true, twoTapUndo: true, side: 'pick' }); sync(); save(); };
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
      const raw = isPen ? e.pressure : 0.5;
      if (isPen) pressureOf(e);
      if (cal && isPen && e.pressure > 0) cal.samples.push(e.pressure);
      const p = isPen ? shapePressure(raw > 0 ? raw : 0.03) : 0.5;
      $('#penStatus').textContent = `${e.pointerType}  ·  raw pressure ${raw.toFixed(2)}  →  used ${p.toFixed(2)}` + (cal ? `  ·  calibrating (${cal.samples.length} samples)` : '');
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
  mk('plus', 'Add tools: Clip Studio .sut files (several at once, or a .zip) or an image', () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.sut,.zip,image/*'; i.multiple = true;
    i.onchange = async () => { const fs = [...i.files], tools = fs.filter(f => /\.(sut|zip)$/i.test(f.name)); if (tools.length) await importTools(tools); for (const f of fs) if (!tools.includes(f)) await importAnyFile(f); }; i.click(); });
  mk('copy', 'Duplicate this sub tool', duplicateBrush);
  mk('trash', 'Delete this sub tool (imported / duplicated only)', deleteBrush);
  const hintEl = document.createElement('span'); hintEl.textContent = 'Drop .sut tools / a folder here'; bar.appendChild(hintEl);
  list.after(bar);
  const sec = list.closest('.pal');
  sec.addEventListener('dragover', e => { e.preventDefault(); sec.classList.add('dropfile'); });
  sec.addEventListener('dragleave', () => sec.classList.remove('dropfile'));
  sec.addEventListener('drop', async e => { e.preventDefault(); sec.classList.remove('dropfile'); const fs = await droppedFiles(e.dataTransfer), tools = fs.filter(f => /\.(sut|zip)$/i.test(f.name));
    if (tools.length) await importTools(tools); for (const f of fs) if (!tools.includes(f) && /^image\//.test(f.type)) await importAnyFile(f); });
}
