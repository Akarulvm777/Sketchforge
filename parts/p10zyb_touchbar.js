/* ---------- tablet / phone layout: one button per thing (3.6) ----------
   On narrow screens (iPad upright, phones: ≤ 900 px) the single "Panels" button that opened every panel at once is
   replaced by one button for each job, at the top right: 🖌 Brush (Sub Tool + Tool Property), 🎨 Colour, 🗂 Layers
   (Layer + Layer Property), 🧭 View (Navigator). Each opens only its own panel, in a pop-over under its button; one at
   a time; tap the button again, ✕, or the canvas to close. On the left edge of the canvas, two quick sliders change
   the brush size and opacity without opening anything (like tablet paint apps).
   The pop-over borrows the real panels (their DOM nodes) from the docks and gives them back on close, so everything
   inside works as before. The old Panels / docks way stays for the tutorials (tutDock). */
const TPOP_SETS = { brush: ['sub-tool', 'tool-property'], colour: ['color'], layers: ['layer', 'layer-property'], view: ['navigator'] };
const TPOP = { open: null, moved: [] };
const narrowUI = () => innerWidth <= 900;
function tpopClose() {
  const box = $('#tpop'); if (!box) return;
  for (const { p, parent, next } of TPOP.moved) { if (next && next.parentNode === parent) parent.insertBefore(p, next); else parent.appendChild(p); }
  TPOP.moved = []; TPOP.open = null; box.hidden = true;
  document.querySelectorAll('#touchbar button').forEach(b => b.classList.remove('on'));
}
function tpopOpen(name) {
  if (TPOP.open === name) { tpopClose(); return; }
  tpopClose();
  $('#app').classList.remove('docks', 'phone-left', 'phone-right');
  let box = $('#tpop');
  if (!box) { box = document.createElement('div'); box.id = 'tpop'; box.innerHTML = '<div class="tpop-head"><b></b><button type="button" class="tpop-x" aria-label="Close">✕</button></div><div class="tpop-body"></div>'; document.body.appendChild(box); box.querySelector('.tpop-x').onclick = tpopClose; }
  const body = box.querySelector('.tpop-body'), btn = $(`#touchbar [data-pop="${name}"]`);
  box.querySelector('.tpop-head b').textContent = btn ? btn.querySelector('i').textContent + ' ' + btn.querySelector('span').textContent : name;
  for (const pid of TPOP_SETS[name]) {
    const p = document.querySelector(`.pal[data-pid="${pid}"]`); if (!p) continue;
    TPOP.moved.push({ p, parent: p.parentNode, next: p.nextSibling });
    p.classList.remove('phidden'); body.appendChild(p);
  }
  box.dataset.side = name === 'brush' || name === 'colour' ? 'left' : 'right';
  box.hidden = false; TPOP.open = name; if (btn) btn.classList.add('on');
  if (name === 'layers') renderLayers(); if (name === 'view') updateNav(); if (name === 'brush') { renderSubTools(); refreshProps(); }
}
function quickSliders() {
  let q = $('#quickSliders'); if (q) return q;
  q = document.createElement('div'); q.id = 'quickSliders';
  q.innerHTML = `<label title="Brush size"><input type="range" class="qs-size" min="0" max="1000" orient="vertical"><span class="qs-val"></span></label>
    <label title="Brush opacity"><input type="range" class="qs-op" min="1" max="100" orient="vertical"><span class="qs-val2"></span></label>`;
  viewport.appendChild(q);
  // size on a curve: fine control for small sizes, up to 500 px
  const toSize = v => Math.round(Math.max(1, Math.pow(v / 1000, 2.2) * 500) * 10) / 10, fromSize = s => Math.round(Math.pow(clamp(s, 1, 500) / 500, 1 / 2.2) * 1000);
  const sz = q.querySelector('.qs-size'), op = q.querySelector('.qs-op');
  sz.oninput = () => { const s = settings[state.tool]; if (!s) return; s.size = toSize(+sz.value); quickSync(); if (typeof updateCursor === 'function') updateCursor(); };
  op.oninput = () => { const s = settings[state.tool]; if (!s) return; s.opacity = +op.value / 100; quickSync(); };
  sz.onchange = op.onchange = () => { refreshProps(); };
  quickSync.toSlider = fromSize;
  return q;
}
function quickSync() {
  const q = $('#quickSliders'); if (!q) return;
  const s = settings[state.tool], show = narrowUI() && s && s.size != null;
  q.hidden = !show; if (!show) return;
  const sz = q.querySelector('.qs-size'), op = q.querySelector('.qs-op');
  if (document.activeElement !== sz) sz.value = quickSync.toSlider(s.size);
  if (document.activeElement !== op) op.value = Math.round((s.opacity ?? 1) * 100);
  q.querySelector('.qs-val').textContent = (Math.round(s.size * 10) / 10) + 'px';
  q.querySelector('.qs-val2').textContent = Math.round((s.opacity ?? 1) * 100) + '%';
}
function installTouchBar() {
  const bar = document.createElement('div'); bar.id = 'touchbar'; bar.className = 'only-narrow';
  bar.innerHTML = [['brush', '🖌', 'Brush', 'Brush: tools and their settings'], ['colour', '🎨', 'Colour', 'Colour'], ['layers', '🗂', 'Layers', 'Layers'], ['view', '🧭', 'View', 'Navigator: zoom, rotate, flip']]
    .map(([k, i, t, tt]) => `<button type="button" data-pop="${k}" title="${tt}"><i>${i}</i><span>${t}</span></button>`).join('');
  const docksBtn = $('#btnDocks'); if (docksBtn) { docksBtn.after(bar); docksBtn.classList.add('replaced'); }
  // phones: no room in the top bar → a small column of round buttons on the right edge of the canvas
  const place = () => { const phone = innerWidth <= 560, inVp = bar.parentNode === viewport; if (phone && !inVp) { viewport.appendChild(bar); bar.classList.add('phone'); } else if (!phone && inVp && docksBtn) { docksBtn.after(bar); bar.classList.remove('phone'); } };
  place();
  bar.querySelectorAll('[data-pop]').forEach(b => b.onclick = () => tpopOpen(b.dataset.pop));
  // the canvas closes the pop-over (draw right after picking)
  viewport.addEventListener('pointerdown', e => { if (TPOP.open && !e.target.closest('#quickSliders, #touchbar')) tpopClose(); }, true);
  addEventListener('resize', () => { if (!narrowUI()) tpopClose(); place(); quickSync(); });
  // tutorials open the docks: give the panels back first
  const td = typeof tutDock === 'function' ? tutDock : null; if (td) tutDock = function () { tpopClose(); return td.apply(this, arguments); };
  quickSliders(); quickSync();
  hookAfter('refreshProps', quickSync);
  CMD.popBrush = () => tpopOpen('brush'); CMD.popColour = () => tpopOpen('colour'); CMD.popLayers = () => tpopOpen('layers'); CMD.popView = () => tpopOpen('view');
}
