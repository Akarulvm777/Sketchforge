/* ---------- workspaces: Drawing vs Animation ---------- */
state.mode = 'draw';
const ANIM_KEYS = new Set(['F5', 'F6', 'F7', 'Enter']);
function animKeyBlocked(e, k) {
  if (state.mode === 'anim') return false;
  if (ANIM_KEYS.has(e.key) || k === 'k' || k === 'j' || k === 'o') return true;
  if (e.key === 'Home' || e.key === 'End' || e.key === ',' || e.key === '.' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (state.frameCount > 1) { /* multi-page drawing: arrows turn pages */
      e.preventDefault();
      gotoFrame(e.key === 'Home' ? 0 : e.key === 'End' ? state.frameCount - 1 : state.frame + (e.key === ',' || e.key === 'ArrowLeft' ? -1 : 1));
    }
    return true;
  }
  return false;
}
function setMode(m, quiet) {
  if (m !== 'draw' && m !== 'anim') return;
  stop();
  state.mode = m;
  document.body.classList.toggle('mode-draw', m === 'draw');
  document.body.classList.toggle('mode-anim', m === 'anim');
  document.querySelectorAll('#modeSwitch button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  if (m === 'draw') { state.onion.on = false; const cb = $('#onionOn'); if (cb) cb.checked = false; }
  updateOnion(); updatePageBar();
  setTimeout(() => { try { fit(); } catch (e) { /* ignore */ } }, 0);
  if (!quiet) toast(m === 'draw' ? 'Drawing workspace' : 'Animation workspace');
}
function updatePageBar() {
  const pb = $('#pageBar'); if (!pb) return;
  pb.hidden = !(state.mode === 'draw' && state.frameCount > 1);
  $('#pageLbl').textContent = `Page ${state.frame + 1} / ${state.frameCount}`;
}
function installWorkspace() {
  const sw = document.createElement('div'); sw.id = 'modeSwitch';
  sw.innerHTML = '<button data-mode="draw" title="Drawing workspace (illustration / manga)">✎ Drawing</button><button data-mode="anim" title="Animation workspace (timeline)">▶ Animation</button>';
  $('#menubar').insertBefore(sw, $('#menubar .grow'));
  sw.onclick = e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); };
  const pb = document.createElement('div'); pb.id = 'pageBar'; pb.hidden = true;
  pb.innerHTML = '<button id="pgPrev" title="Previous page">◀</button><span id="pageLbl"></span><button id="pgNext" title="Next page">▶</button><button id="pgAdd" title="Add page after this one">+ Page</button>';
  $('#cmdbar').appendChild(pb);
  $('#pgPrev').onclick = () => gotoFrame(state.frame - 1);
  $('#pgNext').onclick = () => gotoFrame(state.frame + 1);
  $('#pgAdd').onclick = () => pageAdd();
  const pm = document.createElement('button'); pm.textContent = 'Pages…'; pm.onclick = () => openPages(); pb.appendChild(pm);
  const og = gotoFrame;
  setMode(state.mode, true);
}
