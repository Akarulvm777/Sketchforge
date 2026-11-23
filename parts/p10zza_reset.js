/* ---------- Reset Sketchforge to defaults (Edit / Help menu) ----------
   Puts every setting back as on a new install and removes every imported tool (.sut / .sfbrush, kept in IndexedDB
   'sketchforge-addons'), custom brushes, Custom P themes and pictures ('sketchforge-customp'), colour sets, layouts.
   Deleted too: drafts (drawings never saved as a file: the open tabs kept by the app and the Home page drafts). Kept: files you saved, the drawing library, the account sign-in, and the markers that stop the welcome /
   What's new / "fresh install" messages from showing again. Then the app reloads. */
const RESET_KEEP = /^sketchforge\.(auth|session|install|shell|live|lastver|welcome|tutorials|animintro)/;
function deleteDB(name) { return new Promise(res => { try { const rq = indexedDB.deleteDatabase(name); rq.onsuccess = rq.onerror = rq.onblocked = () => res(); } catch (e) { res(); } }); }
async function resetToDefaults(skipConfirm) {
  if (!skipConfirm && !confirm('Reset Sketchforge to its default settings?\n\nThis removes every imported tool (Clip Studio .sut, .sfbrush), your custom brushes, themes, colour sets, layouts and all settings.\n\nDrafts (drawings you never saved as a file) are deleted too. Files you saved and your account stay.')) return false;
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('sketchforge.') && !RESET_KEEP.test(k)) localStorage.removeItem(k); } catch (e) { /* storage blocked */ }
  // drafts (drawings never saved as a file) are deleted, as the notice on every new file says
  if (typeof dropDrafts === 'function') { try { await dropDrafts(); } catch (e) { /* keep going */ } }
  await Promise.all(['sketchforge-addons', 'sketchforge-customp', 'sketchforge-session'].map(deleteDB));
  try { localStorage.setItem('sketchforge.resetdone', '1'); } catch (e) { /* ignore */ }
  location.reload();
  return true;
}
function installReset() {
  CMD.resetDefaults = () => resetToDefaults();
  const E = MENUS.find(m => m[0] === 'Edit'), Hm = MENUS.find(m => m[0] === 'Help');
  const item = ['⟲ Reset Sketchforge to defaults…', 'resetDefaults'];
  if (E) E[1].push('-', item);
  if (Hm) Hm[1].push('-', item);
  try { if (localStorage.getItem('sketchforge.resetdone')) { localStorage.removeItem('sketchforge.resetdone'); setTimeout(() => toast('Sketchforge is back to its default settings', 4000), 800); } } catch (e) { /* ignore */ }
}
