/* ---------- Paper texture: choose a paper when you make a new file (or later: Layer › Paper texture…) ----------
   The paper layer gets the colour + the grain (it is part of the picture, so exports show it). With "Brushes pick up
   the grain", brushes that have no texture of their own take the paper's grain, like real pencil on paper. */
const PAPER_TEX = [['', 'None (smooth)'], ['grain', 'Drawing paper'], ['paper', 'Watercolour paper'], ['rough', 'Rough (cold press)'], ['canvas', 'Canvas'],
  ['charcoal', 'Charcoal paper'], ['bristle', 'Bristle board']];
const PAPER_COLOURS = [['#ffffff', 'White'], ['#fbf6ea', 'Cream'], ['#f3ecd9', 'Ivory sketchbook'], ['#d9c3a0', 'Kraft'], ['#e8e4dc', 'Grey board'], ['#2a2a2e', 'Black paper']];
/* paints the paper layer: colour, then the grain (darker where the paper is lower) */
function applyPaperTexture(layer, opt) {
  if (!layer) return;
  const id = opt.id || '', amt = clamp(opt.amt ?? 0.5, 0, 1), color = opt.color || '#ffffff';
  const sc = clamp(opt.scale || Math.max(state.w, state.h) / 2048, 1, 4);
  for (const [, c] of layer.cels) {
    const g = c.getContext('2d');
    g.save(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    if (id) {
      const dark = hexToRgb(color).reduce((a, b) => a + b, 0) < 200; // grain shows as light flecks on black paper
      const N = TEX_N, v = texBaseFor(id)._vals, tile = makeCanvas(N, N), tg = tile.getContext('2d'), im = tg.createImageData(N, N);
      for (let i = 0; i < v.length; i++) { const k = clamp(v[i], 0, 1); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = dark ? 255 : 0; im.data[i * 4 + 3] = (dark ? 1 - k : k) * 255; }
      tg.putImageData(im, 0, 0);
      const pat = g.createPattern(tile, 'repeat'); if (pat.setTransform) pat.setTransform(new DOMMatrix([sc, 0, 0, sc, 0, 0]));
      g.globalAlpha = amt * (dark ? 0.18 : 0.28); g.fillStyle = pat; g.fillRect(0, 0, c.width, c.height);
    }
    g.restore(); c._ink = true; if (c._sv != null) c._sv++; else c._sv = 1;
  }
  layer.paperTex = { id, amt, color, grain: !!opt.grain, scale: sc };
}
/* brushes without their own texture take the paper grain (called by beginStroke, p04) */
function paperGrain(s, erase, direct, isShape) {
  if (erase || isShape || s.tex || s.shape) return;
  const p = state.layers.find(l => l.paper && l.paperTex && l.paperTex.grain && l.paperTex.id && l.visible);
  if (!p) return;
  s.tex = p.paperTex.id; s.texAmt = clamp(0.25 + p.paperTex.amt * 0.5, 0, 0.85); s.texScale = p.paperTex.scale || 1;
}
function paperFields(prefix, cur) {
  cur = cur || {};
  return `<label class="nw-r"><span>Texture</span><select id="${prefix}Tex">${PAPER_TEX.map(([v, n]) => `<option value="${v}"${(cur.id || '') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="nw-r"><span>Grain strength</span><input type="range" id="${prefix}Amt" min="0.1" max="1" step="0.05" value="${cur.amt ?? 0.5}"></label>
    <label class="check"><input type="checkbox" id="${prefix}Grain"${cur.grain === false ? '' : ' checked'}> Brushes pick up the paper grain</label>`;
}
function paperDialog() {
  const p = state.layers.find(l => l.paper);
  if (!p) { toast('This file has a transparent background: there is no paper layer'); return; }
  const cur = p.paperTex || { id: '', amt: 0.5, color: '#ffffff', grain: true };
  const d = document.createElement('dialog'); d.className = 'paperdlg';
  d.innerHTML = `<form method="dialog"><h3>Paper texture</h3>
    <label class="nw-r"><span>Paper colour</span><input type="color" id="ppColor" value="${cur.color || '#ffffff'}"> <select id="ppPreset"><option value="">Presets…</option>${PAPER_COLOURS.map(([c, n]) => `<option value="${c}">${n}</option>`).join('')}</select></label>
    ${paperFields('pp', cur)}
    <p class="muted small">Repaints the paper layer (one undo step). Your drawing layers are not touched.</p>
    <div class="dialog-actions"><button value="cancel">Cancel</button><button value="ok" class="primary">OK</button></div></form>`;
  document.body.appendChild(d);
  d.querySelector('#ppPreset').onchange = e => { if (e.target.value) d.querySelector('#ppColor').value = e.target.value; };
  d.addEventListener('close', () => {
    if (d.returnValue === 'ok') {
      const cel = p.cels.get(state.frame) || p.cels.get(0), before = cel ? crop(cel, { x: 0, y: 0, w: cel.width, h: cel.height }) : null;
      applyPaperTexture(p, { id: d.querySelector('#ppTex').value, amt: +d.querySelector('#ppAmt').value, color: d.querySelector('#ppColor').value, grain: d.querySelector('#ppGrain').checked });
      if (cel && before && typeof celEntry === 'function') pushHistory(celEntry({ layer: p, cel, ctx: cel.getContext('2d') }, { x: 0, y: 0, w: cel.width, h: cel.height }, before, crop(cel, { x: 0, y: 0, w: cel.width, h: cel.height })));
      dirty = true; refreshAll();
    }
    d.remove();
  });
  d.showModal();
}
function installPaperTexture() {
  // New dialog: texture + grain under the paper colour
  const row = $('#newPaper') && $('#newPaper').closest('.nw-r');
  if (row && !$('#newTex')) {
    const box = document.createElement('div'); box.id = 'newPaperTex'; box.innerHTML = paperFields('new', { id: '', amt: 0.5, grain: true });
    row.after(box);
    const sync = () => { box.hidden = $('#newTransparent').checked; };
    $('#newTransparent').addEventListener('change', sync); sync();
  }
  CMD.paperTexture = paperDialog;
  const L = MENUS.find(m => m[0] === 'Layer');
  if (L && !L[1].some(x => Array.isArray(x) && x[1] === 'paperTexture')) L[1].push('-', ['Paper colour & texture…', 'paperTexture']);
}
/* New dialog → the paper of the new file */
function paperFromDialog(paper) {
  if (!paper || !$('#newTex')) return;
  applyPaperTexture(paper, { id: $('#newTex').value, amt: +$('#newAmt').value, color: $('#newPaper').value, grain: $('#newGrain').checked });
}
