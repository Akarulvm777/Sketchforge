/* ---------- timeline UI ---------- */
const tlInner = $('#tlInner'), tlScroll = $('#tlScroll');
let playheadEl = null;
const nameW = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--name-w')) || 160;

function renderTimeline() {
  tlInner.innerHTML = '';
  tlInner.style.width = (nameW() + state.frameCount * CELL_W + 40) + 'px';
  if (typeof drawAudioStrip === 'function') drawAudioStrip();
  const n = state.frameCount;
  /* ruler */
  const ruler = document.createElement('div'); ruler.className = 'tl-row tl-ruler';
  const rn = document.createElement('div'); rn.className = 'tl-name'; rn.textContent = 'Layers  /  Frames';
  ruler.appendChild(rn);
  for (let f = 0; f < n; f++) {
    const c = document.createElement('div');
    c.className = 'tl-cell tl-rc' + ((f + 1) % 5 === 0 ? ' five' : '');
    c.dataset.f = f;
    if ((f + 1) % 5 === 0 || f === 0) c.textContent = f + 1;
    ruler.appendChild(c);
  }
  tlInner.appendChild(ruler);
  /* layer rows (top layer first) */
  for (let i = state.layers.length - 1; i >= 0; i--) {
    const l = state.layers[i];
    const row = document.createElement('div');
    row.className = 'tl-row' + (l.id === state.activeId ? ' active' : '');
    row.dataset.id = l.id;
    const nm = document.createElement('div'); nm.className = 'tl-name';
    nm.append(mkMini('eye', l.visible, 'Show / hide', () => toggleVisible(l)),
      mkMini('lock', l.locked, 'Lock / unlock', () => toggleLock(l)));
    const sp = document.createElement('span'); sp.className = 'nm'; sp.textContent = l.name;
    sp.ondblclick = () => renameLayer(l);
    nm.appendChild(sp);
    row.appendChild(nm);
    const keys = Array.from(l.cels.keys()).sort((a, b) => a - b);
    const cells = new Array(n).fill(null);
    keys.forEach((k, idx) => {
      if (k >= n) return;
      const nk = idx + 1 < keys.length ? keys[idx + 1] : n;
      const c = l.cels.get(k);
      const tw = xfOf(c).tween && idx + 1 < keys.length;
      for (let f = k; f < Math.min(nk, n); f++) {
        const cls = ['tl-cell'];
        if (f === k) cls.push('key');
        if (f === k && !c._ink) cls.push('blank');
        if (tw) cls.push('tween'); else if (f > k) cls.push('hold');
        if (f === Math.min(nk, n) - 1) cls.push('last');
        cells[f] = cls.join(' ');
      }
    });
    for (let f = 0; f < n; f++) {
      const c = document.createElement('div');
      c.className = cells[f] || 'tl-cell';
      c.dataset.f = f;
      row.appendChild(c);
    }
    tlInner.appendChild(row);
  }
  playheadEl = document.createElement('div');
  playheadEl.id = 'tlPlayhead';
  tlInner.appendChild(playheadEl);
  updatePlayhead();
}
function updatePlayhead() {
  if (!playheadEl) return;
  const x = nameW() + state.frame * CELL_W + CELL_W / 2 - 1;
  playheadEl.style.left = x + 'px';
  const vis = tlScroll.clientWidth - nameW();
  const rel = state.frame * CELL_W - tlScroll.scrollLeft;
  if (rel < 0) tlScroll.scrollLeft = state.frame * CELL_W;
  else if (rel > vis - CELL_W * 2) tlScroll.scrollLeft = state.frame * CELL_W - vis + CELL_W * 3;
}
function syncTimelineFields() {
  const set = (id, v) => { const e = $(id); if (e && document.activeElement !== e) e.value = v; };
  set('#curFrame', state.frame + 1);
  set('#frameCount', state.frameCount);
  set('#fps', state.fps);
  set('#onionBefore', state.onion.before);
  set('#onionAfter', state.onion.after);
  $('#loop').checked = state.loop;
  $('#onionOn').checked = state.onion.on;
  $('#autoKey').checked = state.autoKey;
  $('#curFrame').max = state.frameCount;
}
/* scrub by dragging */
let scrub = null;
tlInner.addEventListener('pointerdown', e => {
  if (e.target.closest('button') || e.target.closest('.tl-name') && !e.target.closest('.nm')) {
    if (e.target.closest('button')) return;
  }
  const row = e.target.closest('.tl-row');
  if (!row || busy()) return;
  if (row.dataset.id) selectLayer(+row.dataset.id);
  scrub = { moved: false };
  tlInner.setPointerCapture(e.pointerId);
  const to = ev => {
    const r = tlInner.getBoundingClientRect();
    const f = Math.floor((ev.clientX - r.left - nameW()) / CELL_W);
    if (ev.clientX - r.left >= nameW() - 1) gotoFrame(f);
  };
  to(e);
  tlInner.onpointermove = ev => { if (scrub) to(ev); };
});
tlInner.addEventListener('pointerup', () => { scrub = null; tlInner.onpointermove = null; });

$('#curFrame').onchange = e => { gotoFrame((+e.target.value || 1) - 1); e.target.blur(); };
$('#frameCount').onchange = e => { setFrameCount(+e.target.value); e.target.blur(); };
$('#fps').onchange = e => { state.fps = clamp(Math.round(+e.target.value) || 12, 1, 60); markDirty(); updateStatus(); syncTimelineFields(); };
$('#loop').onchange = e => { state.loop = e.target.checked; };
$('#autoKey').onchange = e => { state.autoKey = e.target.checked; };
$('#onionOn').onchange = e => { state.onion.on = e.target.checked; updateOnion(); };
$('#onionBefore').onchange = e => { state.onion.before = clamp(+e.target.value || 0, 0, 5); updateOnion(); };
$('#onionAfter').onchange = e => { state.onion.after = clamp(+e.target.value || 0, 0, 5); updateOnion(); };

/* resizable timeline */
$('#tlResize').addEventListener('pointerdown', e => {
  const startY = e.clientY, startH = $('#timeline').getBoundingClientRect().height;
  const el = e.currentTarget; el.setPointerCapture(e.pointerId);
  el.onpointermove = ev => {
    const h = clamp(startH + (startY - ev.clientY), 110, window.innerHeight * 0.6);
    document.documentElement.style.setProperty('--tl-h', h + 'px');
    resizeOverlay();
  };
  el.onpointerup = () => { el.onpointermove = null; fit(); };
});

