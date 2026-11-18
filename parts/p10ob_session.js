/* ---------- Remember the last work ----------
   A few seconds after any change (and when switching tabs or leaving the app) every open document is saved
   to IndexedDB 'sketchforge-session' with which tab was active and, per document, the frame, zoom / position
   and unsaved state. On the next start everything is opened again where it was left.
   Unchanged cels reuse their last PNG (cel._sv counters, celURL in p10_docs_export), so saving stays cheap. */
const SESS = { on: true, t: 0, busy: false, again: false, restoring: false, db: null };
try { SESS.on = localStorage.getItem('sketchforge.session.v1') !== 'off'; } catch (e) { /* ignore */ }
function sessDB() {
  if (SESS.db) return Promise.resolve(SESS.db);
  return new Promise(res => { try { const rq = indexedDB.open('sketchforge-session', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('kv'); rq.onsuccess = () => res(SESS.db = rq.result); rq.onerror = () => res(null); } catch (e) { res(null); } });
}
async function sessKV(mode, fn) { const db = await sessDB(); if (!db) return null; return new Promise((res, rej) => { const tx = db.transaction('kv', mode), r = fn(tx.objectStore('kv')); tx.oncomplete = () => res(r && 'result' in r ? r.result : null); tx.onerror = () => rej(tx.error); }); }
function sessionSoon(ms = 2500) {
  if (!SESS.on || SESS.restoring) return;
  clearTimeout(SESS.t); SESS.t = setTimeout(sessionSave, ms);
}
async function sessionSave() {
  if (!SESS.on || SESS.restoring || typeof DOCS === 'undefined' || !DOCS.list.length) return;
  if (SESS.busy || stroke || active || exporting) { SESS.again = true; sessionSoon(1500); return; }
  SESS.busy = true;
  try {
    const docs = [];
    for (const r of DOCS.list) {
      const cur = r === DOCS.cur;
      if (!cur && !r.saved) continue;
      const src = cur ? null : { st: r.saved.state, lc: r.saved.layerCounter, aud: r.saved.aud, tl: r.saved.tl };
      const doc = await buildDocObject(src, { cache: true, quiet: true });
      const info = cur ? { frame: state.frame, view: { ...view }, dirty, blank: !!r.blank && !dirty && !history.undo.length }
        : { frame: r.saved.state.frame, view: r.saved.view, dirty: r.saved.dirty, blank: false };
      docs.push({ json: JSON.stringify(doc), ...info });
    }
    await sessKV('readwrite', s => s.put({ t: Date.now(), active: DOCS.list.indexOf(DOCS.cur), docs, tool: state.tool, color: state.color, color2: state.color2 }, 'last'));
  } catch (e) { console.warn('session save failed', e); }
  SESS.busy = false;
  if (SESS.again) { SESS.again = false; sessionSoon(); }
}
async function sessionRestore() {
  if (!SESS.on || location.hash === '#sf-child') return;
  const rec = await sessKV('readonly', s => s.get('last')).catch(() => null);
  if (!rec || !rec.docs) return;
  const keep = rec.docs.map((d, i) => ({ d, i })).filter(x => !x.d.blank);
  if (!keep.length) return;
  SESS.restoring = true;
  const opened = [];
  try {
    for (const { d, i } of keep) {
      await openDocumentFile(new File([d.json], 'last work.sketchforge'));
      if (d.frame) gotoFrame(d.frame);
      if (d.view) { Object.assign(view, d.view); applyView(); }
      dirty = !!d.dirty; syncTab();
      opened.push({ rec: DOCS.cur, i });
    }
    const act = opened.find(o => o.i === rec.active) || opened[opened.length - 1];
    if (act && act.rec !== DOCS.cur) docSwitch(act.rec);
    if (rec.tool && TOOLDEF[rec.tool]) selectTool(rec.tool);
    if (rec.color) setColor(rec.color);
    if (rec.color2) { state.color2 = rec.color2; if (typeof syncColorUI === 'function') syncColorUI(); }
    toast(`Welcome back — your last work is open again (${opened.length} file${opened.length > 1 ? 's' : ''}, ${state.name} at frame ${state.frame + 1})`, 5000);
  } catch (e) { console.warn('session restore failed', e); }
  SESS.restoring = false;
}
function installSession() {
  Object.assign(CMD, {
    sessToggle: () => {
      SESS.on = !SESS.on; try { localStorage.setItem('sketchforge.session.v1', SESS.on ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (SESS.on) sessionSave(); else sessKV('readwrite', s => s.delete('last'));
      toast(SESS.on ? 'Your work will be reopened next time' : 'Last work will not be remembered');
    },
    sessFresh: () => { if (!confirm('Close every open file and start with a blank page? (Unsaved work is lost.)')) return; sessKV('readwrite', s => s.delete('last')).then(() => location.reload()); }
  });
  const F = MENUS[0][1];
  F.push('-', ['Reopen my last work at start (on / off)', 'sessToggle'], ['Start fresh (close everything)', 'sessFresh']);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sessionSave(); });
  window.addEventListener('pagehide', () => sessionSave());
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { /* ignore */ });
}
