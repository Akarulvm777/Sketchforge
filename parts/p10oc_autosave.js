/* ---------- Auto-save every 5 minutes (when you are not drawing) ----------
   AUTO (sketchforge.autosave.v1): every few seconds a check; when the document has unsaved changes, the last save is
   AUTO.min minutes old and nobody is drawing / playing (inputQuiet), the file is saved by itself:
   • a file you saved with the browser's "save to" window (File System Access: Chrome, Edge, the desktop app) is
     written again in place — no download, no question (the handle lives on the document's tab: DOCS.cur.handle);
   • in the Android / iPad app it is written to Documents/Sketchforge like File › Save;
   • otherwise (Safari, Firefox) a copy goes to the app's own storage (the "reopen my last work" session), and the
     status bar says so. Save (Ctrl+S) uses the "save to" window where the browser has it (sketchforge.savepick.v1). */
const AUTO = { on: true, min: 5, last: 0, timer: null, note: '' };
try { const a = JSON.parse(localStorage.getItem('sketchforge.autosave.v1') || 'null'); if (a) Object.assign(AUTO, { on: a.on !== false, min: a.min || 5 }); } catch (e) { /* ignore */ }
const autoSavePrefs = () => { try { localStorage.setItem('sketchforge.autosave.v1', JSON.stringify({ on: AUTO.on, min: AUTO.min })); } catch (e) { /* ignore */ } };
const canPickSave = () => typeof window.showSaveFilePicker === 'function' && window.isSecureContext && !(typeof isNativeApp === 'function' && isNativeApp())
  && (() => { try { return localStorage.getItem('sketchforge.savepick.v1') !== 'off'; } catch (e) { return true; } })();
const docFileName = () => (state.name || 'Untitled').replace(/[^\w\- ]+/g, '_') + '.sketchforge';
async function writeHandle(h, blob) {
  if (h.queryPermission && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted' && (await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('No permission to write the file');
  const w = await h.createWritable(); await w.write(blob); await w.close();
}
/* is it time to auto-save? (pure: the numbers in, yes / no out) */
function autoSaveDue(o) { return !!(o.on && o.dirty && !o.busy && o.quiet && o.now - o.last >= o.min * 60000); }
function autoSaveStatus(t) {
  let s = $('#autoSaveStat'); const host = $('#statusView'); if (!s && host) { s = document.createElement('span'); s.id = 'autoSaveStat'; s.className = 'muted'; s.style.marginLeft = '12px'; host.after(s); }
  if (s) s.textContent = t || '';
}
async function autoSaveNow() {
  const r = DOCS.cur, name = docFileName(), hh = new Date().toTimeString().slice(0, 5);
  try {
    const doc = await buildDocObject(undefined, { cache: true, quiet: true });
    const blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
    if (r && r.handle) { await writeHandle(r.handle, blob); dirty = false; syncTab(); autoSaveStatus(`Auto-saved ${hh}`); }
    else if (r && r.realFile && typeof isNativeApp === 'function' && isNativeApp()) { await nativeSave(blob, name); dirty = false; syncTab(); autoSaveStatus(`Auto-saved ${hh}`); }
    else { if (typeof sessionSave === 'function') await sessionSave(); autoSaveStatus(r && r.realFile ? `Auto-saved in the app ${hh} (Save to update your file)` : `Draft kept in the app ${hh} (File › Save makes a real file)`); }
  } catch (e) { autoSaveStatus('Auto-save failed: ' + (e.message || e)); }
  AUTO.last = Date.now();
}
function autoSaveTick() {
  const busy = !!(stroke || active || exporting || playing || document.querySelector('dialog[open]'));
  if (!dirty) { AUTO.last = Date.now(); return; } // nothing to save: the minutes count from the first change after a save
  if (autoSaveDue({ on: AUTO.on, dirty, busy, quiet: inputQuiet(5000), now: Date.now(), last: AUTO.last, min: AUTO.min })) autoSaveNow();
}
function installAutoSave() {
  AUTO.last = Date.now();
  // Save: the browser's "save to" window when it has one; then the same file is updated by Save and by auto-save
  const s0 = saveDocument;
  saveDocument = async function () {
    const r = DOCS.cur;
    if (r && r.handle) {
      try { const doc = await buildDocObject(); await writeHandle(r.handle, new Blob([JSON.stringify(doc)], { type: 'application/json' })); dirty = false; syncTab(); AUTO.last = Date.now(); toast('Saved: ' + r.handle.name); autoSaveStatus('Saved ' + new Date().toTimeString().slice(0, 5)); return; }
      catch (e) { r.handle = null; }
    }
    if (canPickSave()) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: docFileName(), types: [{ description: 'Inkvessa file', accept: { 'application/json': ['.sketchforge'] } }] });
        const doc = await buildDocObject(); await writeHandle(h, new Blob([JSON.stringify(doc)], { type: 'application/json' }));
        if (r) r.handle = h; dirty = false; syncTab(); AUTO.last = Date.now();
        toast(`Saved: ${h.name}${AUTO.on ? ` — it is now auto-saved every ${AUTO.min} minutes while you rest` : ''}`, 4500); autoSaveStatus('Saved ' + new Date().toTimeString().slice(0, 5)); return;
      } catch (e) { if (e && e.name === 'AbortError') return; /* not allowed here: download instead */ }
    }
    await s0.apply(this, arguments); AUTO.last = Date.now();
  };
  CMD.save = () => saveDocument();
  CMD.autoSave = () => { AUTO.on = !AUTO.on; autoSavePrefs(); toast(AUTO.on ? `Auto-save on: every ${AUTO.min} minutes when you are not drawing` : 'Auto-save off'); autoSaveStatus(''); };
  CMD.autoSaveMin = () => proDialog('Auto-save', [{ k: 'on', label: 'Auto-save when you are not drawing', type: 'check', val: AUTO.on }, { k: 'min', label: 'Every (minutes)', type: 'range', min: 1, max: 30, val: AUTO.min }],
    v => { AUTO.on = !!v.on; AUTO.min = Math.max(1, +v.min || 5); autoSavePrefs(); toast(AUTO.on ? `Auto-save every ${AUTO.min} minutes` : 'Auto-save off'); }, 'OK');
  const F = MENUS.find(m => m[0] === 'File');
  if (F) { const i = F[1].findIndex(x => Array.isArray(x) && x[1] === 'save'); F[1].splice(i + 1, 0, ['⏱ Auto-save (on / off)', 'autoSave'], ['⏱ Auto-save settings…', 'autoSaveMin']); }
  AUTO.timer = setInterval(autoSaveTick, 10000);
}
