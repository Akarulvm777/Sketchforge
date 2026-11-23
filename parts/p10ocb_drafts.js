/* ---------- Real files and drafts ----------
   A drawing is a REAL FILE once you saved it (File › Save) or opened it from your device (r.realFile, kept by the
   session). Auto-save writes real files only. A new drawing you never saved is a DRAFT: auto-save keeps it inside
   Sketchforge (the reopened tabs + Home page › Drafts) to save space on the device, and drafts are deleted when the app
   is reset to defaults or installed again (dropDrafts, p10zza_reset, the install check in index.html).
   • Every new file shows a short notice saying so (sketchforge.draftnote.v1 = 'off': don't show again).
   • Closing a file always asks: a draft → Save as a file / Keep as a draft / Delete it / Cancel; a real file with
     changes → Save / Don't save / Cancel (draftCloseAsk, docClose wrapped). */
let RECENT_SKIP = false, DRAFT_OPENING = 0;
async function dropDrafts() {
  if (typeof recentList !== 'function') return;
  const list = await recentList(), drafts = list.filter(e => e.draft);
  if (!drafts.length) return;
  await recentKV('readwrite', s => { s.put(list.filter(e => !e.draft), 'list'); drafts.forEach(e => s.delete('doc:' + e.name)); });
}
async function draftForget(name) { // a draft the user deleted: out of the Home page too
  if (typeof recentList !== 'function') return;
  const list = await recentList(); if (!list.some(e => e.name === name && e.draft)) return;
  await recentKV('readwrite', s => { s.put(list.filter(e => !(e.name === name && e.draft)), 'list'); s.delete('doc:' + name); });
}
function draftNotice() {
  try { if (localStorage.getItem('sketchforge.draftnote.v1') === 'off') return; } catch (e) { /* show it */ }
  let n = $('#draftNote'); if (n) n.remove();
  n = document.createElement('div'); n.id = 'draftNote'; n.setAttribute('role', 'status');
  n.innerHTML = `<b>📝 New drawing = a draft</b><p>Auto-save keeps it inside Sketchforge (Home page › Drafts) to save space on your device. It becomes a real file when you use <b>File › Save</b> (Ctrl+S); after that, auto-save updates that file. Drafts are deleted if you reinstall or reset Sketchforge.</p>
    <div class="dn-row"><label><input type="checkbox" id="draftNoteOff"> Don't show this again</label><button class="primary" type="button">Got it</button></div>`;
  n.addEventListener('pointerdown', e => e.stopPropagation());
  n.querySelector('button').onclick = () => { if (n.querySelector('#draftNoteOff').checked) { try { localStorage.setItem('sketchforge.draftnote.v1', 'off'); } catch (e) { /* ignore */ } } n.remove(); };
  (typeof viewport !== 'undefined' ? viewport : document.body).appendChild(n);
}
/* the obligatory question when a file is closed; resolves true when it was closed */
function draftCloseAsk(r) {
  return new Promise(res => {
    const draft = !r.realFile, name = docName(r);
    const d = document.createElement('dialog'); d.className = 'csdlg'; d.id = 'closeAskDlg';
    d.innerHTML = draft
      ? `<h3>Close “${hubEscD(name)}”?</h3><p>This drawing is a <b>draft</b>: it is not saved as a file on your device yet. Drafts stay inside Sketchforge (Home page) and are deleted if you reinstall or reset the app.</p>
         <div class="btnrow"><button class="primary" data-a="save">💾 Save as a file…</button><button data-a="keep">Keep as a draft</button><button data-a="delete">Delete it</button><button data-a="cancel">Cancel</button></div>`
      : `<h3>Save the changes to “${hubEscD(name)}”?</h3><p>Your file on the device does not have the latest changes yet.</p>
         <div class="btnrow"><button class="primary" data-a="save">💾 Save</button><button data-a="nosave">Don't save</button><button data-a="cancel">Cancel</button></div>`;
    document.body.appendChild(d);
    const done = v => { d.close(); d.remove(); res(v); };
    d.addEventListener('cancel', e => { e.preventDefault(); done(false); });
    d.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const a = b.dataset.a;
      if (a === 'cancel') return done(false);
      d.close(); d.remove();
      if (a === 'save') {
        if (r !== DOCS.cur) docSwitch(r);
        await saveDocument();
        if (dirty) return res(false); // the save was cancelled: the file stays open
        DRAFT_CLOSE(r); return res(true);
      }
      if (a === 'delete') { RECENT_SKIP = true; try { DRAFT_CLOSE(r); } finally { RECENT_SKIP = false; } draftForget(name); return res(true); }
      if (a === 'keep' && r !== DOCS.cur) docSwitch(r); // closing the current tab records its latest state on the Home page
      DRAFT_CLOSE(r); res(true); // keep (as a draft) / don't save
    });
    d.showModal();
  });
}
const hubEscD = s => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
let DRAFT_CLOSE = r => r;
function installDrafts() {
  // saving makes a real file; opening a .sketchforge from the device too
  hookAfter('saveDocument', () => { const r = DOCS.cur; if (r && !dirty && !r.realFile) { r.realFile = true; syncTab(); } }, -10); // before the Home page records the file
  if (typeof openAnyDocument === 'function') {
    const o0 = openAnyDocument; openAnyDocument = async function (f) { DRAFT_OPENING++; try { const out = await o0.apply(this, arguments); if (f && /\.sketchforge$/i.test(f.name || '') && DOCS.cur) { DOCS.cur.realFile = true; syncTab(); } return out; } finally { DRAFT_OPENING--; } };
  }
  const of0 = openDocumentFile; openDocumentFile = async function () { DRAFT_OPENING++; try { return await of0.apply(this, arguments); } finally { DRAFT_OPENING--; } };
  // every new drawing: the notice (not for the blank start page, reopened work or opened files)
  const n0 = newDocument; newDocument = function () {
    const out = n0.apply(this, arguments);
    setTimeout(() => { if (!DRAFT_OPENING && !(typeof SESS !== 'undefined' && SESS.restoring) && DOCS.cur && !DOCS.cur.blank && !DOCS.cur.realFile && document.body.classList.contains('hub-open') === false) draftNotice(); }, 0);
    return out;
  };
  // closing always asks
  const c0 = docClose; DRAFT_CLOSE = r => c0(r, true);
  docClose = function (r, force) {
    r = r || DOCS.cur;
    if (force || !r) return c0.apply(this, arguments);
    const pristine = typeof docPristine === 'function' && docPristine(r);
    if (pristine || (r.realFile && !docDirty(r))) return c0(r, true);
    draftCloseAsk(r);
    return false;
  };
  docCloseOthers = async function (keep) { for (const r of DOCS.list.slice()) if (r !== keep) { if (docClose(r) === false && !(await new Promise(res => { const t = setInterval(() => { if (!$('#closeAskDlg')) { clearInterval(t); res(!DOCS.list.includes(r)); } }, 100); }))) return; } };
  try { if (localStorage.getItem('sketchforge.dropdrafts')) { localStorage.removeItem('sketchforge.dropdrafts'); dropDrafts(); } } catch (e) { /* ignore */ }
}
