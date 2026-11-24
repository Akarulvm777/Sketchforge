/* ---------- your own keyboard shortcuts (3.6) ----------
   Help › ⌨ Keyboard shortcuts…: every menu command and every tool can get a key (or Ctrl / Alt / Shift + key).
   Click Set, press the keys, done. Your shortcuts win over the built-in ones (a keydown listener in capture runs
   them first) and show in the menus. Saved in prefs keys.v1 = { 'Ctrl+Shift+K': 'cmd:<id>' | 'tool:<id>' }. */
const KEYS = { map: {}, wait: null };
/* pure: the name of a key press ('Ctrl+Shift+K', 'Alt+F5', 'B'); null for a lone modifier */
function keyCombo(e) {
  const k = e.key; if (!k || ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock'].includes(k)) return null;
  const name = k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k;
  return [e.ctrlKey || e.metaKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey && k.length > 1 || e.shiftKey && /[A-Z]/i.test(k) ? 'Shift' : '', name].filter(Boolean).join('+');
}
/* every action that can get a shortcut: menu commands (label, id, built-in key) and tools */
function keyActions() {
  const out = [], seen = new Set();
  for (const [menu, items] of MENUS) for (const it of items) if (Array.isArray(it) && it[1] && !seen.has('cmd:' + it[1])) { seen.add('cmd:' + it[1]); out.push({ id: 'cmd:' + it[1], label: it[0].replace(/…$/, ''), where: menu, builtin: it[2] || '' }); }
  for (const g of GROUPS) for (const t of g.subs || []) if (TOOLDEF[t] && !seen.has('tool:' + t)) { seen.add('tool:' + t); out.push({ id: 'tool:' + t, label: TOOLDEF[t].name, where: 'Tool · ' + (g.name || g.id), builtin: '' }); }
  return out;
}
const keyOf = id => Object.keys(KEYS.map).find(k => KEYS.map[k] === id) || '';
function keyRun(id) {
  const [kind, name] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
  if (kind === 'tool' && TOOLDEF[name]) { const g = GROUPS.find(x => (x.subs || []).includes(name)); if (g) selectGroup(g.id); selectTool(name); return true; }
  if (kind === 'cmd' && typeof CMD[name] === 'function') { CMD[name](); return true; }
  return false;
}
function keySet(combo, id) { // one key → one action
  for (const k of Object.keys(KEYS.map)) if (KEYS.map[k] === id) delete KEYS.map[k];
  if (combo) KEYS.map[combo] = id;
  prefs.setJson('keys.v1', KEYS.map); keyMenus();
}
function keyMenus() { // the menus show your keys
  document.querySelectorAll('#menus .mi[data-cmd]').forEach(mi => {
    const k = keyOf('cmd:' + mi.dataset.cmd); let kb = mi.querySelector('kbd');
    if (k) { if (!kb) { kb = document.createElement('kbd'); mi.appendChild(kb); } if (!kb.dataset.orig) kb.dataset.orig = kb.textContent || '-'; kb.textContent = k; kb.classList.add('mine'); }
    else if (kb && kb.dataset.orig) { if (kb.dataset.orig === '-') kb.remove(); else { kb.textContent = kb.dataset.orig; kb.classList.remove('mine'); delete kb.dataset.orig; } }
  });
}
function keyDialog() {
  let d = $('#keysDlg'); if (d) d.remove();
  d = document.createElement('dialog'); d.id = 'keysDlg'; d.className = 'keysdlg';
  d.innerHTML = `<form method="dialog"><h2>⌨ Keyboard shortcuts</h2>
    <p class="muted small">Find a command or a tool, press <b>Set</b>, then press the keys you want (Esc = cancel, Backspace = no key). Your keys win over the built-in ones.</p>
    <input type="search" class="keysearch" placeholder="Search a command or tool…"><div class="keylist"></div>
    <div class="dialog-actions"><button type="button" data-a="reset">Reset all my keys</button><span style="flex:1"></span><button type="submit" class="primary">Done</button></div></form>`;
  document.body.appendChild(d);
  const list = d.querySelector('.keylist'), search = d.querySelector('.keysearch'), acts = keyActions();
  const render = () => {
    const q = search.value.trim().toLowerCase();
    list.innerHTML = '';
    for (const a of acts) {
      if (q && !(a.label + ' ' + a.where).toLowerCase().includes(q)) continue;
      const mine = keyOf(a.id), row = document.createElement('div'); row.className = 'keyrow';
      row.innerHTML = `<span class="kname">${escHtml(a.label)}<small class="muted"> · ${escHtml(a.where)}</small></span><kbd class="${mine ? 'mine' : ''}">${escHtml(mine || a.builtin || '—')}</kbd><button type="button">${KEYS.wait === a.id ? 'Press keys…' : 'Set'}</button>${mine ? '<button type="button" class="kclear" title="Remove my key">✕</button>' : ''}`;
      const set = row.querySelector('button'); set.onclick = () => { KEYS.wait = a.id; render(); };
      if (KEYS.wait === a.id) setTimeout(() => set.focus(), 0); // the keys pressed next go to this row
      const c = row.querySelector('.kclear'); if (c) c.onclick = () => { keySet('', a.id); render(); };
      list.appendChild(row);
    }
  };
  search.oninput = render;
  d.addEventListener('keydown', e => {
    if (!KEYS.wait) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { KEYS.wait = null; render(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { keySet('', KEYS.wait); KEYS.wait = null; render(); return; }
    const combo = keyCombo(e); if (!combo) return;
    const prev = KEYS.map[combo];
    keySet(combo, KEYS.wait);
    if (prev && prev !== KEYS.wait) { const p = acts.find(a => a.id === prev); toast(`${combo} moved from "${p ? p.label : prev}"`); }
    KEYS.wait = null; render();
  }, true);
  d.querySelector('[data-a=reset]').onclick = () => { KEYS.map = {}; prefs.setJson('keys.v1', {}); keyMenus(); render(); };
  d.addEventListener('close', () => { KEYS.wait = null; d.remove(); });
  render(); d.showModal(); search.focus();
}
function installKeys() {
  KEYS.map = prefs.json('keys.v1', {}) || {};
  CMD.keyShortcuts = keyDialog;
  const H = MENUS.find(m => m[0] === 'Help');
  if (H && !H[1].some(x => Array.isArray(x) && x[1] === 'keyShortcuts')) H[1].splice(1, 0, ['⌨ Keyboard shortcuts (make your own)…', 'keyShortcuts']);
  // your keys first (capture), so they win over the built-in ones
  document.addEventListener('keydown', e => {
    if (e.repeat || !Object.keys(KEYS.map).length) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable || document.querySelector('dialog[open]')) return;
    const id = KEYS.map[keyCombo(e)];
    if (id && keyRun(id)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  hookAfter('buildMenus', keyMenus);
}
