/* ---------- 3.0 "Studio" look helpers ----------
   Sliders show their filled part (CSS var --fill on every range input, kept up to date on input and when panels are
   rebuilt). rangeFillPct is pure. */
function rangeFillPct(v, min, max) { const a = +min || 0, b = max === '' || max == null ? 100 : +max; return b > a ? clamp((+v - a) / (b - a) * 100, 0, 100) : 0; }
function rangeFill(el) { if (el && el.type === 'range') el.style.setProperty('--fill', rangeFillPct(el.value, el.min, el.max).toFixed(1) + '%'); }
function installStudio() {
  hookAfter('refreshStage', () => { if (MIR_OV && stroke === MIR_OV.st && MIR_OV.cv.parentNode === stage && MIR_OV.el.parentNode !== stage) MIR_OV.cv.after(MIR_OV.el); }, 30); // keep the mixing-brush tile overlay on the stage
  installAskFab();
  document.body.classList.add('studio');
  const all = root => (root.querySelectorAll ? root.querySelectorAll('input[type=range]') : []).forEach(rangeFill);
  document.addEventListener('input', e => rangeFill(e.target), true);
  document.addEventListener('change', e => rangeFill(e.target), true);
  let pend = false;
  new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; all(document); }); }).observe(document.body, { childList: true, subtree: true });
  // values set from code (no input event): refresh now and then while the pointer moves
  document.addEventListener('pointerup', () => requestAnimationFrame(() => all(document)), true);
  all(document);
}
/* ✨ Ask button on phones / tablets: drag it anywhere (position kept), View › ✨ Ask button shows / hides it.
   sketchforge.aifab.v1 = { x, y (fractions of the screen), hidden }. fabClamp is pure. */
const FAB = (() => { try { return JSON.parse(localStorage.getItem('sketchforge.aifab.v1')) || {}; } catch (e) { return {}; } })();
const fabSave = () => { try { localStorage.setItem('sketchforge.aifab.v1', JSON.stringify(FAB)); } catch (e) {} };
function fabClamp(x, y, size, W, H, pad = 6) { return [clamp(x, pad, Math.max(pad, W - size - pad)), clamp(y, pad, Math.max(pad, H - size - pad))]; }
function fabPlace(fab) {
  fab.classList.toggle('fab-hidden', !!FAB.hidden);
  if (FAB.x == null) { fab.style.left = fab.style.top = ''; fab.style.right = fab.style.bottom = ''; return; }
  const s = fab.offsetWidth || 52, [x, y] = fabClamp(FAB.x * innerWidth, FAB.y * innerHeight, s, innerWidth, innerHeight);
  Object.assign(fab.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
}
function installAskFab() {
  const fab = $('#aiFab'); if (!fab) return;
  let drag = null, moved = false;
  fab.addEventListener('pointerdown', e => { const r = fab.getBoundingClientRect(); drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY }; moved = false; try { fab.setPointerCapture(e.pointerId); } catch (er) {} });
  fab.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
    moved = true; fab.classList.add('dragging');
    const [x, y] = fabClamp(e.clientX - drag.dx, e.clientY - drag.dy, fab.offsetWidth, innerWidth, innerHeight);
    Object.assign(fab.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
  });
  const up = e => {
    if (!drag || e.pointerId !== drag.id) return; drag = null; fab.classList.remove('dragging');
    if (moved) { const r = fab.getBoundingClientRect(); FAB.x = r.left / innerWidth; FAB.y = r.top / innerHeight; fabSave(); }
  };
  fab.addEventListener('pointerup', up); fab.addEventListener('pointercancel', up);
  fab.addEventListener('click', e => { if (moved) { e.stopImmediatePropagation(); e.preventDefault(); moved = false; } }, true);
  addEventListener('resize', () => fabPlace(fab));
  CMD.toggleAskFab = () => {
    FAB.hidden = !FAB.hidden; fabSave(); fabPlace(fab);
    toast(FAB.hidden ? '✨ Ask button hidden. Bring it back: View › ✨ Ask button (or Help › Ask the helper).' : '✨ Ask button shown — drag it anywhere.', 3500);
  };
  CMD.resetAskFab = () => { delete FAB.x; delete FAB.y; FAB.hidden = false; fabSave(); fabPlace(fab); };
  const V = MENUS.find(m => m[0] === 'View');
  if (V) V[1].push('-', ['Show / hide the ✨ Ask button (phones: drag it anywhere)', 'toggleAskFab'], ['Put the ✨ Ask button back in the corner', 'resetAskFab']);
  fabPlace(fab);
}
