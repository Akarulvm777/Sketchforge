/* ---------- Symmetry: one-click mirror drawing (toolbar button + popup + View menu) ----------
   Uses the symmetry ruler (ruler.sym, p10r_pro). Strokes, erasers and shapes are copied through symMats(). */
const SYM_MODES = [['mirror', 'Mirror'], ['quad', '4-way mirror'], ['rot', 'Radial (rotate)'], ['kaleido', 'Kaleidoscope']];
const SYM_KEY = 'sketchforge.sym.v1';
function symSave() { try { localStorage.setItem(SYM_KEY, JSON.stringify({ mode: ruler.symMode, count: ruler.symCount })); } catch (e) { /* ignore */ } }
function symLoad() {
  try { const o = JSON.parse(localStorage.getItem(SYM_KEY) || 'null'); if (o) { if (SYM_MODES.some(m => m[0] === o.mode)) ruler.symMode = o.mode; if (o.count >= 2 && o.count <= 32) ruler.symCount = o.count | 0; } } catch (e) { /* ignore */ }
}
/* Axis through the canvas centre: vertical (|), horizontal (—). */
function symCenter(dir) {
  const cx = state.w / 2, cy = state.h / 2;
  ruler.sym = dir === 'h' ? { x0: cx - 400, y0: cy, x1: cx + 400, y1: cy } : { x0: cx, y0: cy - 400, x1: cx, y1: cy + 400 };
}
function symInside() { const r = ruler.sym; if (!r) return false; const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2; return cx >= 0 && cy >= 0 && cx <= state.w && cy <= state.h; }
function symSet(on) {
  if (on && !symInside()) symCenter('v');
  ruler.snap.sym = !!on; ruler.show = true;
  symChanged();
}
function symChanged() { symSave(); symUpdateBtn(); symFillPop(); drawOverlay(); refreshProps(); }
function symUpdateBtn() {
  const b = $('#symBtn'); if (!b) return;
  const on = symOn(), name = (SYM_MODES.find(m => m[0] === ruler.symMode) || SYM_MODES[0])[1];
  b.classList.toggle('on', on);
  b.querySelector('.lbl').textContent = on ? 'Symmetry: ' + name + (ruler.symMode === 'rot' || ruler.symMode === 'kaleido' ? ' ×' + ruler.symCount : '') : 'Symmetry';
}
function symFillPop() {
  const p = $('#symPop'); if (!p || p.hidden) return;
  const on = symOn();
  p.innerHTML = `
    <label class="check"><input type="checkbox" id="symOn" ${on ? 'checked' : ''}> Symmetry on</label>
    <div class="grp">Mode</div>
    <div class="symModes">${SYM_MODES.map(([k, t]) => `<button data-m="${k}" class="${ruler.symMode === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="symCount" ${ruler.symMode === 'rot' || ruler.symMode === 'kaleido' ? '' : 'hidden'}>
      <label class="slider"><span>Segments</span><input type="range" id="symN" min="2" max="24" value="${ruler.symCount}"><output>${ruler.symCount}</output></label></div>
    <div class="grp">Axis</div>
    <div class="btnrow"><button data-a="v">Vertical |</button><button data-a="h">Horizontal —</button></div>
    <p class="muted small">Axis goes through the canvas centre. To place it anywhere (or at an angle), use Ruler → Symmetry ruler and drag a line.</p>`;
  p.querySelector('#symOn').onchange = e => symSet(e.target.checked);
  p.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { ruler.symMode = b.dataset.m; symSet(true); });
  p.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { symCenter(b.dataset.a); symSet(true); });
  const n = p.querySelector('#symN');
  n.oninput = () => { ruler.symCount = +n.value; n.nextElementSibling.textContent = n.value; symSave(); symUpdateBtn(); drawOverlay(); };
}
function symTogglePop(anchor) {
  let p = $('#symPop');
  if (!p) { p = document.createElement('div'); p.id = 'symPop'; p.className = 'popover'; p.hidden = true; document.body.appendChild(p); }
  p.hidden = !p.hidden;
  if (p.hidden) return;
  const r = anchor.getBoundingClientRect();
  p.style.left = Math.min(r.left, innerWidth - 270) + 'px'; p.style.top = (r.bottom + 4) + 'px';
  symFillPop();
}
function installSymmetry() {
  symLoad();
  Object.assign(CMD, {
    symToggle: () => { symSet(!symOn()); toast('Symmetry ' + (symOn() ? 'on' : 'off')); },
    symVertical: () => { ruler.symMode = 'mirror'; symCenter('v'); symSet(true); },
    symHorizontal: () => { ruler.symMode = 'mirror'; symCenter('h'); symSet(true); },
    symQuad: () => { ruler.symMode = 'quad'; symSet(true); },
    symRadial: () => { ruler.symMode = 'rot'; symSet(true); },
    symKaleido: () => { ruler.symMode = 'kaleido'; symSet(true); }
  });
  MENUS.find(m => m[0] === 'View')[1].push('-', ['Symmetry on / off', 'symToggle', 'Shift+M'], ['Symmetry: mirror left / right', 'symVertical'],
    ['Symmetry: mirror top / bottom', 'symHorizontal'], ['Symmetry: 4-way', 'symQuad'], ['Symmetry: radial', 'symRadial'], ['Symmetry: kaleidoscope', 'symKaleido']);
  const b = document.createElement('button'); b.id = 'symBtn'; b.title = 'Symmetry: click to turn on / off, ▾ for options';
  b.innerHTML = '<span class="lbl">Symmetry</span><span class="caret">▾</span>';
  b.onclick = e => { if (e.target.classList.contains('caret')) symTogglePop(b); else CMD.symToggle(); };
  $('#cmdbar').insertBefore(b, $('#tlBtn'));
  document.addEventListener('pointerdown', e => { const p = $('#symPop'); if (p && !p.hidden && !p.contains(e.target) && !b.contains(e.target)) p.hidden = true; });
  symUpdateBtn();
}
