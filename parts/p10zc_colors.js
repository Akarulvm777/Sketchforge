/* ---------- Colour sets (favourite colours) and colour history ----------
   As many named sets as you like (Basic, Skin, Hair…): add the main colour, tap to use, right-click / long-press or
   "Remove colours" to take one out. History = the last colours you painted with, kept between sessions. */
const CS_KEY = 'sketchforge.colorsets.v1', CH_KEY = 'sketchforge.colorhist.v1', CH_MAX = 48;
const CS_BASIC = ['#000000', '#ffffff', '#7f7f7f', '#c3c3c3', '#ff0000', '#ff7f27', '#ffd800', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#b97a57', '#ffaec9', '#fff2b0'];
let CSETS = null, csRemoving = false;
function csLoad() {
  try { CSETS = JSON.parse(localStorage.getItem(CS_KEY) || 'null'); } catch (e) { CSETS = null; }
  if (!CSETS || !Array.isArray(CSETS.sets) || !CSETS.sets.length) CSETS = { cur: 0, sets: [{ name: 'Basic', colors: CS_BASIC.slice() }] };
  CSETS.cur = clamp(CSETS.cur | 0, 0, CSETS.sets.length - 1);
  try { const h = JSON.parse(localStorage.getItem(CH_KEY) || '[]'); if (Array.isArray(h) && !(state.recent || []).length) state.recent = h.slice(0, CH_MAX); } catch (e) { /* none */ }
}
function csSave() { try { localStorage.setItem(CS_KEY, JSON.stringify(CSETS)); } catch (e) { /* full */ } }
function chSave() { try { localStorage.setItem(CH_KEY, JSON.stringify((state.recent || []).slice(0, CH_MAX))); } catch (e) { /* full */ } }
const csSet = () => CSETS.sets[CSETS.cur];
/* draws the current set and the history (called by renderSwatches in p07) */
function renderColorSets() {
  if (!CSETS) csLoad();
  const sel = $('#csSel');
  if (sel) { sel.innerHTML = CSETS.sets.map((s, i) => `<option value="${i}">${escHtml(s.name)} (${s.colors.length})</option>`).join(''); sel.value = String(CSETS.cur); }
  const mk = (box, arr, inSet) => {
    if (!box) return;
    box.innerHTML = '';
    arr.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (inSet && csRemoving ? ' rm' : ''); b.style.background = c; b.title = c + (inSet ? (csRemoving ? ' — tap to remove' : ' — right-click to remove') : '');
      b.onclick = () => { if (inSet && csRemoving) csRemove(i); else setColor(c); };
      if (inSet) {
        b.oncontextmenu = e => { e.preventDefault(); popMenu(e.clientX, e.clientY, [['Use this colour', () => setColor(c)], ['Remove from "' + csSet().name + '"', () => csRemove(i)], ['Copy ' + c, () => { try { navigator.clipboard.writeText(c); } catch (er) { /* no clipboard */ } }]]); };
        let t = 0; b.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') t = setTimeout(() => { t = -1; csRemove(i); }, 650); });
        b.addEventListener('pointerup', () => { if (t > 0) clearTimeout(t); }); b.addEventListener('pointerleave', () => { if (t > 0) clearTimeout(t); });
      } else b.oncontextmenu = e => { e.preventDefault(); popMenu(e.clientX, e.clientY, [['Use this colour', () => setColor(c)], ['Add to "' + csSet().name + '"', () => csAdd(c)]]); };
      box.appendChild(b);
    });
    if (inSet && !arr.length) { const p = document.createElement('span'); p.className = 'csempty'; p.textContent = 'Empty: ＋ adds the main colour'; box.appendChild(p); }
  };
  mk($('#swatches'), csSet().colors, true);
  mk($('#recent'), state.recent || [], false);
}
function csAdd(c) {
  c = (c || state.color).toLowerCase();
  const s = csSet(); if (s.colors.includes(c)) { toast(c + ' is already in "' + s.name + '"'); return; }
  s.colors.push(c); csSave(); renderColorSets(); toast('Added ' + c + ' to "' + s.name + '"', 1200);
}
function csRemove(i) { const s = csSet(); s.colors.splice(i, 1); csSave(); renderColorSets(); }
function csNew() {
  const name = (prompt('Name of the new colour set:', 'My colours ' + (CSETS.sets.length + 1)) || '').trim(); if (!name) return;
  CSETS.sets.push({ name, colors: [] }); CSETS.cur = CSETS.sets.length - 1; csSave(); renderColorSets();
}
function csRename() { const s = csSet(), name = (prompt('Rename the colour set:', s.name) || '').trim(); if (name) { s.name = name; csSave(); renderColorSets(); } }
function csDelete() {
  if (CSETS.sets.length < 2) { toast('Keep at least one colour set (you can empty it instead)'); return; }
  if (!confirm('Delete the colour set "' + csSet().name + '"?')) return;
  CSETS.sets.splice(CSETS.cur, 1); CSETS.cur = Math.max(0, CSETS.cur - 1); csSave(); renderColorSets();
}
function csExport() { download(new Blob([JSON.stringify({ format: 'sketchforge-colors', sets: [csSet()] }, null, 1)], { type: 'application/json' }), csSet().name.replace(/[^\w-]+/g, '_') + '.sfcolors'); }
function csImport() {
  pickFile('.sfcolors,.json,.gpl,.txt', async f => {
    const txt = await readFile(f, true); let sets = [];
    try { const j = JSON.parse(txt); sets = (j.sets || []).filter(s => s && Array.isArray(s.colors)).map(s => ({ name: String(s.name || f.name), colors: s.colors.filter(c => /^#[0-9a-f]{6}$/i.test(c)) })); }
    catch (e) { // GIMP / Krita palette (.gpl) or a plain list of hex colours
      const cols = []; for (const line of txt.split(/\r?\n/)) { const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)/), h = line.match(/#[0-9a-f]{6}/i); if (m) cols.push('#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('')); else if (h) cols.push(h[0].toLowerCase()); }
      if (cols.length) sets = [{ name: f.name.replace(/\.[^.]+$/, ''), colors: cols }];
    }
    if (!sets.length) { toast('No colours found in that file'); return; }
    CSETS.sets.push(...sets); CSETS.cur = CSETS.sets.length - 1; csSave(); renderColorSets(); toast('Added ' + sets.length + ' colour set' + (sets.length > 1 ? 's' : ''));
  });
}
function csMenu(e) {
  const r = e.currentTarget.getBoundingClientRect();
  popMenu(r.left, r.bottom + 2, [
    ['＋ New colour set…', csNew], ['Rename "' + csSet().name + '"…', csRename], ['Delete "' + csSet().name + '"', csDelete, CSETS.sets.length < 2], '-',
    ['Add the main colour', () => csAdd()], ['Add the sub colour', () => csAdd(state.color2)], ['Add every colour of the history', () => { const s = csSet(); for (const c of state.recent || []) if (!s.colors.includes(c)) s.colors.push(c); csSave(); renderColorSets(); }],
    [csRemoving ? '✓ Done removing' : 'Remove colours (tap a swatch)…', () => { csRemoving = !csRemoving; renderColorSets(); if (csRemoving) toast('Tap the colours to remove, then ⋯ › Done removing', 2500); }],
    ['Sort by colour', () => { const s = csSet(); s.colors.sort((a, b) => { const A = hexToHsv(a), B = hexToHsv(b); return (A.s < 0.08) - (B.s < 0.08) || A.h - B.h || B.v - A.v; }); csSave(); renderColorSets(); }], '-',
    ['Export this set (.sfcolors)', csExport], ['Import colour sets (.sfcolors, .gpl)…', csImport], '-',
    ['Clear the history', () => { state.recent = []; chSave(); renderColorSets(); }]
  ]);
}
function installColorSets() {
  csLoad();
  const sel = $('#csSel'); if (!sel) return;
  sel.onchange = () => { CSETS.cur = +sel.value; csRemoving = false; csSave(); renderColorSets(); };
  $('#csAdd').onclick = () => csAdd();
  $('#csMenu').onclick = csMenu;
  $('#csClearHist').onclick = () => { if (!(state.recent || []).length || confirm('Clear the colour history?')) { state.recent = []; chSave(); renderColorSets(); } };
  Object.assign(CMD, { colorSetNew: csNew, colorAdd: () => csAdd() });
  renderColorSets();
}
