/* ---------- Layer panel: tick boxes, folders, colour labels ----------
   - a tick box on every layer: tick as many as you like, then act on all of them (put in a folder, colour, show /
     hide, delete) from the bar above the list
   - folders: l.folder = { id, name, open, visible, color } shared by its layers (they stay next to each other);
     a folder exists while it has layers. Click ▸ to open / close, 👁 hides the whole folder, ⋯ = rename / colour /
     ungroup / delete. Drag layers onto a folder (or onto a layer inside it) to move them in.
   - colour labels: l.tag / folder.color, preset colours + your own (sketchforge.tagcolors.v1)
   Saved in the .sketchforge file (layers[].folder index + doc.folders, layers[].tag) and in undo snapshots.        */
const LSEL = new Set();          // ticked layer ids (this tab)
let folderSeq = 1;
const TAG_COLORS = ['#e5484d', '#f08c2e', '#f5d90a', '#46a758', '#3e8ef7', '#8e4ec6', '#e93d82', '#8b8d98'];
const TAG_KEY = 'sketchforge.tagcolors.v1';
const tagRecent = () => { try { return JSON.parse(localStorage.getItem(TAG_KEY) || '[]'); } catch (e) { return []; } };
const newFolder = name => ({ id: folderSeq++, name: name || 'Folder ' + folderSeq, open: true, visible: true, color: null });
const foldersOf = () => { const s = []; for (const l of state.layers) if (l.folder && !s.includes(l.folder)) s.push(l.folder); return s; };
/* members of a folder stay together (at the place of the topmost one) */
function folderNormalize() {
  for (const f of foldersOf()) {
    const idx = state.layers.map((l, i) => l.folder === f ? i : -1).filter(i => i >= 0);
    if (idx[idx.length - 1] - idx[0] === idx.length - 1) continue;
    const mem = idx.map(i => state.layers[i]), top = idx[idx.length - 1];
    const rest = state.layers.filter(l => l.folder !== f);
    const at = rest.indexOf(state.layers.slice(top + 1).find(l => l.folder !== f)); // first non-member above the top member
    rest.splice(at < 0 ? rest.length : at, 0, ...mem);
    state.layers = rest;
  }
}
const ticked = () => state.layers.filter(l => LSEL.has(l.id));
const targets = () => { const t = ticked(); return t.length ? t : [activeLayer()].filter(Boolean); };

/* ---------- rendering ---------- */
function renderLayersPro() {
  const list = $('#layerList');
  for (const id of [...LSEL]) if (!state.layers.some(l => l.id === id)) LSEL.delete(id);
  folderNormalize();
  list.innerHTML = '';
  const done = new Set();
  for (let i = state.layers.length - 1; i >= 0; i--) {
    const l = state.layers[i], f = l.folder;
    if (f && !done.has(f)) { done.add(f); list.appendChild(folderRow(f)); }
    if (f && !f.open) continue;
    list.appendChild(layerRow(l, !!f));
  }
  renderSelBar();
}
function mkTick(on, title, fn) {
  const b = document.createElement('input'); b.type = 'checkbox'; b.className = 'ltick'; b.checked = on; b.title = title;
  b.onclick = e => e.stopPropagation(); b.onchange = () => fn(b.checked);
  return b;
}
function layerRow(l, inFolder) {
  const item = document.createElement('div');
  item.className = 'layer-item' + (l.id === state.activeId ? ' active' : '') + (inFolder ? ' infolder' : '') + (LSEL.has(l.id) ? ' ticked' : '');
  item.dataset.lid = l.id;
  if (l.tag) item.style.setProperty('--tag', l.tag);
  if (inFolder && l.folder.color) item.style.setProperty('--ftag', l.folder.color);
  const th = Math.max(16, Math.min(48, Math.round(40 * state.h / state.w)));
  const thumb = makeCanvas(40, th); thumb.className = 'thumb';
  if (l.canvas) thumb.getContext('2d').drawImage(l.canvas, 0, 0, thumb.width, thumb.height);
  const name = document.createElement('span'); name.className = 'name';
  const meta = document.createElement('small');
  meta.textContent = Math.round(l.opacity * 100) + ' %  ' + (BLEND_LABEL[l.blend] || l.blend) + layerFlags(l);
  const nm2 = document.createElement('span'); nm2.textContent = l.name;
  name.append(meta, nm2);
  name.ondblclick = ev => { ev.stopPropagation(); renameLayer(l); };
  item.append(
    mkTick(LSEL.has(l.id), 'Tick to select several layers', on => { on ? LSEL.add(l.id) : LSEL.delete(l.id); renderLayers(); }),
    mkMini('eye', l.visible, 'Show / hide', () => toggleVisible(l)),
    thumb, name,
    mkMini('lock', l.locked, 'Lock / unlock', () => toggleLock(l)));
  // ⋯ = layer options (move to a folder, colour…): works with a finger too, no right-click needed
  const more = document.createElement('button'); more.className = 'mini lmore'; more.textContent = '⋯'; more.title = 'Layer options: move to a folder, colour…';
  more.onclick = e => { e.stopPropagation(); if (!LSEL.has(l.id)) selectLayer(l.id); const r = more.getBoundingClientRect(); layerMenu(r.left, r.bottom, l); };
  item.appendChild(more);
  item.onclick = e => { if (e.shiftKey || e.ctrlKey || e.metaKey) { LSEL.has(l.id) ? LSEL.delete(l.id) : LSEL.add(l.id); renderLayers(); return; } selectLayer(l.id); };
  item.oncontextmenu = e => { e.preventDefault(); if (!LSEL.has(l.id)) selectLayer(l.id); layerMenu(e.clientX, e.clientY, l); };
  dragRow(item, () => (LSEL.has(l.id) ? ticked() : [l]), l);
  return item;
}
function folderRow(f) {
  const mem = state.layers.filter(l => l.folder === f);
  const row = document.createElement('div');
  row.className = 'layer-folder' + (mem.some(l => l.id === state.activeId) ? ' hasactive' : '');
  if (f.color) row.style.setProperty('--ftag', f.color);
  const all = mem.every(l => LSEL.has(l.id));
  const arrow = document.createElement('button'); arrow.className = 'mini farrow'; arrow.textContent = f.open ? '▾' : '▸'; arrow.title = f.open ? 'Close folder' : 'Open folder';
  arrow.onclick = e => { e.stopPropagation(); f.open = !f.open; renderLayers(); };
  const name = document.createElement('span'); name.className = 'name';
  name.innerHTML = `<span class="ficon">📁</span> <b></b> <small>${mem.length}</small>`; name.querySelector('b').textContent = f.name;
  name.ondblclick = e => { e.stopPropagation(); renameFolder(f); };
  const more = document.createElement('button'); more.className = 'mini'; more.textContent = '⋯'; more.title = 'Folder options';
  more.onclick = e => { e.stopPropagation(); const r = more.getBoundingClientRect(); folderMenu(r.left, r.bottom, f); };
  row.append(
    mkTick(all, 'Tick every layer in this folder', on => { for (const l of mem) on ? LSEL.add(l.id) : LSEL.delete(l.id); renderLayers(); }),
    arrow, mkMini('eye', f.visible !== false, 'Show / hide the folder', () => folderVisible(f, f.visible === false)), name, more);
  row.onclick = () => { f.open = !f.open; renderLayers(); };
  row.oncontextmenu = e => { e.preventDefault(); folderMenu(e.clientX, e.clientY, f); };
  dropTarget(row, f, null);
  return row;
}
/* the bar above the list when layers are ticked */
function renderSelBar() {
  let bar = $('#layerSelBar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'layerSelBar'; $('#layerList').before(bar); }
  const n = ticked().length;
  bar.hidden = !n;
  if (!n) return;
  bar.innerHTML = `<b>${n} ticked</b><button data-a="folder" title="Put them in a new folder">📁 Folder</button><button data-a="move" title="Move them into a folder">➜ Move to…</button><button data-a="color" title="Colour label">🎨</button><button data-a="eye" title="Show / hide">👁</button><button data-a="del" title="Delete">🗑</button><button data-a="clear" title="Untick all">✕</button>`;
  bar.querySelector('[data-a=folder]').onclick = () => groupIntoFolder();
  bar.querySelector('[data-a=move]').onclick = e => { const r = e.target.getBoundingClientRect(); moveToFolderMenu(r.left, r.bottom, ticked()); };
  bar.querySelector('[data-a=color]').onclick = e => { const r = e.target.getBoundingClientRect(); colorPicker(r.left, r.bottom, ticked(), null); };
  bar.querySelector('[data-a=eye]').onclick = () => { const t = ticked(), show = t.some(l => !l.visible); t.forEach(l => { l.visible = show; }); markDirty(); refreshStage(); renderLayers(); renderTimeline(); updateOnion(); };
  bar.querySelector('[data-a=del]').onclick = () => deleteLayers(ticked());
  bar.querySelector('[data-a=clear]').onclick = () => { LSEL.clear(); renderLayers(); };
}

/* ---------- actions ---------- */
function groupIntoFolder(list) {
  list = (list || targets()).filter(l => !l.paper || state.layers.length > 1);
  if (!list.length) return;
  timelineOp(() => {
    const f = newFolder(); f.name = 'Folder ' + (foldersOf().length + 1);
    const top = Math.max(...list.map(l => state.layers.indexOf(l)));
    const ordered = state.layers.filter(l => list.includes(l));
    const rest = state.layers.filter(l => !list.includes(l)), anchor = state.layers.slice(top + 1).find(l => !list.includes(l));
    const at = anchor ? rest.indexOf(anchor) : rest.length;
    rest.splice(at, 0, ...ordered); state.layers = rest;
    for (const l of ordered) l.folder = f;
  });
  LSEL.clear(); renderLayers();
  toast('Folder made. Double-click its name to rename it.');
}
/* a new folder with nothing ticked: a folder holding one new blank layer, ready to fill (put layers in with ⋯ › Move to folder) */
function newEmptyFolder() {
  timelineOp(() => {
    const f = newFolder(); f.name = 'Folder ' + (foldersOf().length + 1);
    const l = createLayer('Layer ' + (++layerCounter)); l.folder = f;
    const a = activeLayer(), i = a ? state.layers.indexOf(a) : state.layers.length - 1;
    const at = a && a.folder ? Math.max(...state.layers.map((x, k) => x.folder === a.folder ? k : -1)) + 1 : i + 1;
    state.layers.splice(at, 0, l); state.activeId = l.id;
  });
  renderLayers();
  toast('New folder. Put layers in it: ⋯ on a layer › Move to folder, or drag them onto the folder.', 4500);
}
function moveIntoFolder(list, f, above) {
  if (!list.length) return;
  timelineOp(() => {
    const rest = state.layers.filter(l => !list.includes(l)), ordered = state.layers.filter(l => list.includes(l));
    let at;
    if (above) at = rest.indexOf(above) + 1;
    else if (f) { const mem = rest.filter(l => l.folder === f); at = mem.length ? rest.indexOf(mem[mem.length - 1]) + 1 : rest.length; }
    else at = rest.length;
    rest.splice(at, 0, ...ordered); state.layers = rest;
    for (const l of ordered) l.folder = f || null;
  });
  renderLayers();
}
function ungroup(f) { timelineOp(() => { for (const l of state.layers) if (l.folder === f) l.folder = null; }); }
function deleteLayers(list) {
  if (!list.length) return;
  if (list.length >= state.layers.length) { toast('A document needs at least one layer'); return; }
  timelineOp(() => { for (const l of list) removeLayerObj(l); });
  LSEL.clear(); renderLayers();
}
function folderVisible(f, show) {
  f.visible = show;
  for (const l of state.layers) if (l.folder === f) { if (!show) { l._fv = l.visible; l.visible = false; } else { l.visible = l._fv !== undefined ? l._fv : true; delete l._fv; } }
  markDirty(); refreshStage(); renderLayers(); renderTimeline(); updateOnion();
}
function renameFolder(f) { askText('Folder name', f.name, v => { if (v) { f.name = v.slice(0, 40); markDirty(); renderLayers(); } }); }
function setTag(list, folder, color) {
  if (folder) folder.color = color; else for (const l of list) l.tag = color;
  if (color && !TAG_COLORS.includes(color)) { const r = [color, ...tagRecent().filter(c => c !== color)].slice(0, 8); try { localStorage.setItem(TAG_KEY, JSON.stringify(r)); } catch (e) { /* ignore */ } }
  markDirty(); renderLayers(); renderTimeline();
}

/* ---------- small popups ---------- */
function popMenu(x, y, items) {
  document.querySelectorAll('.lpop').forEach(p => p.remove());
  const m = document.createElement('div'); m.className = 'lpop';
  for (const it of items) {
    if (it === '-') { m.appendChild(document.createElement('hr')); continue; }
    const b = document.createElement('button'); b.textContent = it[0]; if (it[2]) b.disabled = true;
    b.onclick = e => { e.stopPropagation(); m.remove(); it[1](b); }; m.appendChild(b);
  }
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px'; m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
  return m;
}
function layerMenu(x, y, l) {
  const list = LSEL.has(l.id) ? ticked() : [l], many = list.length > 1;
  popMenu(x, y, [
    [many ? `🎨 Colour label (${list.length} layers)…` : '🎨 Colour label…', () => colorPicker(x, y, list, null)],
    ['📁 Put in a new folder', () => groupIntoFolder(list)],
    ['➜ Move to folder…', () => moveToFolderMenu(x, y, list)],
    ['Take out of the folder', () => moveIntoFolder(list, null, list[0].folder ? state.layers.filter(m => m.folder === list[0].folder).pop() : null), !list.some(m => m.folder)],
    '-', ['Rename…', () => renameLayer(l), many], ['Delete', () => deleteLayers(list)]
  ]);
}
function folderMenu(x, y, f) {
  popMenu(x, y, [
    [ticked().length ? `➜ Put the ${ticked().length} ticked layer${ticked().length > 1 ? 's' : ''} here` : '➜ Put the selected layer here', () => { const list = targets().filter(l => l.folder !== f); if (list.length) moveIntoFolder(list, f); else toast('That layer is already in this folder'); }],
    ['Rename…', () => renameFolder(f)], ['🎨 Folder colour…', () => colorPicker(x, y, [], f)],
    [f.open ? 'Close' : 'Open', () => { f.open = !f.open; renderLayers(); }],
    ['Tick all its layers', () => { for (const l of state.layers) if (l.folder === f) LSEL.add(l.id); renderLayers(); }],
    '-', ['Ungroup (keep the layers)', () => ungroup(f)], ['Delete folder and its layers', () => deleteLayers(state.layers.filter(l => l.folder === f))]
  ]);
}
function moveToFolderMenu(x, y, list) {
  const fs = foldersOf();
  popMenu(x, y, [...fs.map(f => ['📁 ' + f.name, () => moveIntoFolder(list, f)]), ...(fs.length ? ['-'] : []), ['📁 New folder', () => groupIntoFolder(list)], ['No folder', () => moveIntoFolder(list, null, list[0].folder ? state.layers.filter(m => m.folder === list[0].folder).pop() : null)]]);
}
function colorPicker(x, y, list, folder) {
  document.querySelectorAll('.lpop').forEach(p => p.remove());
  const m = document.createElement('div'); m.className = 'lpop lcolors';
  const cur = folder ? folder.color : (list[0] && list[0].tag);
  const sw = (c, title) => `<button class="lsw${c === cur ? ' on' : ''}" data-c="${c || ''}" title="${title || c}" style="${c ? 'background:' + c : ''}">${c ? '' : '⦸'}</button>`;
  m.innerHTML = `<div class="small muted">${folder ? 'Folder colour' : 'Colour label'}</div><div class="lswrow">${sw(null, 'No colour')}${TAG_COLORS.map(c => sw(c)).join('')}</div>
    ${tagRecent().length ? `<div class="small muted">Your colours</div><div class="lswrow">${tagRecent().map(c => sw(c)).join('')}</div>` : ''}
    <label class="lcustom small">Your own colour <input type="color" value="${cur || '#3e8ef7'}"></label>`;
  document.body.appendChild(m);
  m.querySelectorAll('.lsw').forEach(b => b.onclick = () => { setTag(list, folder, b.dataset.c || null); m.remove(); });
  m.querySelector('input[type=color]').onchange = e => { setTag(list, folder, e.target.value); m.remove(); };
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px'; m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
}

/* ---------- drag layers into folders / between layers ---------- */
let dragList = null;
function dragRow(item, getList, l) {
  item.draggable = true;
  item.addEventListener('dragstart', e => { dragList = getList(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-sf-layer', String(l.id)); item.classList.add('dragging'); });
  item.addEventListener('dragend', () => { dragList = null; item.classList.remove('dragging'); document.querySelectorAll('.dropover').forEach(x => x.classList.remove('dropover')); });
  dropTarget(item, null, l);
}
function dropTarget(el, f, above) {
  el.addEventListener('dragover', e => { if (!dragList) return; e.preventDefault(); el.classList.add('dropover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dropover'));
  el.addEventListener('drop', e => {
    if (!dragList) return; e.preventDefault(); el.classList.remove('dropover');
    const list = dragList.filter(x => x !== above); dragList = null;
    if (f) moveIntoFolder(list, f); else if (above) moveIntoFolder(list, above.folder || null, above);
  });
}

function installLayersPro() {
  Object.assign(CMD, {
    layerFolder: () => (ticked().length ? groupIntoFolder() : newEmptyFolder()),
    layerTag: () => { const r = $('#layerList').getBoundingClientRect(); colorPicker(r.left, r.top, targets(), null); },
    layerTickAll: () => { state.layers.forEach(l => LSEL.add(l.id)); renderLayers(); },
    layerTickNone: () => { LSEL.clear(); renderLayers(); }
  });
  const LY = MENUS.find(m => m[0] === 'Layer')[1];
  LY.splice(LY.findIndex(x => Array.isArray(x) && x[1] === 'layerDel') + 1, 0, '-', ['📁 New folder from ticked / this layer', 'layerFolder'], ['🎨 Colour label…', 'layerTag'],
    ['Tick all layers', 'layerTickAll'], ['Untick all layers', 'layerTickNone']);
  IC.folder = '<path d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2h9a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/>';
  const tb = document.querySelector('button[data-cmd="layerDup"][data-ic]'); // the panel button, not the menu item
  if (tb && !document.querySelector('button[data-cmd="layerFolder"][data-ic]')) {
    const b = document.createElement('button'); b.dataset.cmd = 'layerFolder'; b.dataset.ic = 'folder'; b.title = 'New folder (from the ticked layers or this layer)'; b.innerHTML = icon('folder'); tb.after(b);
  }
}
