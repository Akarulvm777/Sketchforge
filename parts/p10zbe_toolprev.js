/* ---------- sample previews for tools without a picture (3.3) ----------
   The Sub Tool list shows a stroke for brushes and the colours for gradient presets; every other tool used to
   show only its icon. toolPreview(id) draws a small sample of what the tool makes (150 × 30, white on the dark
   list, like strokePreview): balloons, panels, rulers, shapes, fills, selections, text, bones, manga tones…
   Returns null for tools with nothing to show (hand, zoom…): the list keeps their icon. */
const TP_W = 150, TP_H = 30;
const TP_INK = '#fff', TP_ACC = '#e0a06a';

/* manga tone brushes: a stroke mask multiplied by the real tone pattern (same maths as toneTexture) */
const TP_TONES = new Map(); // tone id -> pattern, built once
function tpTone(texId, erase) {
  const c = makeCanvas(TP_W, TP_H), g = c.getContext('2d'), N = 256;
  let v = TP_TONES.get(texId);
  if (!v) { v = new Float32Array(N * N); if (!toneTexture(texId, v, N)) return null; TP_TONES.set(texId, v); }
  const mask = makeCanvas(TP_W, TP_H), mg = mask.getContext('2d');
  mg.strokeStyle = '#000'; mg.lineCap = 'round'; mg.lineWidth = 22;
  mg.beginPath(); mg.moveTo(14, 18); mg.bezierCurveTo(50, 2, 95, 30, 136, 12); mg.stroke();
  const m = mg.getImageData(0, 0, TP_W, TP_H).data, img = g.createImageData(TP_W, TP_H), d = img.data;
  for (let y = 0; y < TP_H; y++) for (let x = 0; x < TP_W; x++) {
    const i = (y * TP_W + x) * 4, inStroke = m[i + 3] / 255, tone = v[(y % N) * N + (x % N)];
    const a = erase ? tone * (1 - inStroke) : tone * inStroke;
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}
function tpStroke(g, w) { g.strokeStyle = TP_INK; g.fillStyle = TP_INK; g.lineWidth = w || 1.6; g.lineCap = 'round'; g.lineJoin = 'round'; }
function tpAnts(g, path) { // marching ants: black dashes over white
  g.lineWidth = 1.2; g.setLineDash([]); g.strokeStyle = TP_INK; path(); g.stroke();
  g.setLineDash([4, 4]); g.strokeStyle = '#000'; path(); g.stroke(); g.setLineDash([]);
}
function tpBalloon(g, kind) {
  const b = { x: 34, y: 4, w: 82, h: 21 };
  g.lineWidth = 1.6; g.strokeStyle = TP_INK; g.fillStyle = 'rgba(255,255,255,.12)';
  balloonPath(g, kind, b); g.fill(); g.stroke();
  if (kind === 'thought') { [[30, 25, 3], [23, 27.5, 2]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }); }
  else { tailPath(g, b, kind, 140, 0.35); g.stroke(); }
  g.fillStyle = TP_INK; g.font = '9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(kind === 'spike' ? 'WOW!' : kind === 'thought' ? 'hmm…' : 'Hello!', 75, 15);
}
const TP_DRAW = {
  /* comic panels */
  fr_rect: g => { tpStroke(g, 1.8); [[6, 3, 52, 24], [62, 3, 38, 24], [104, 3, 40, 24]].forEach(r => g.strokeRect(...r)); },
  fr_cut: g => { tpStroke(g, 1.8); g.strokeRect(20, 3, 110, 24); g.setLineDash([3, 3]); g.strokeStyle = TP_ACC; g.beginPath(); g.moveTo(70, 1); g.lineTo(82, 29); g.stroke(); g.setLineDash([]); },
  /* rulers: the guide (accent) and a line snapped to it */
  rl_line: g => { g.fillStyle = 'rgba(224,160,106,.35)'; g.fillRect(6, 17, 138, 8); g.strokeStyle = TP_ACC; g.lineWidth = 1; for (let x = 10; x < 144; x += 8) { g.beginPath(); g.moveTo(x, 17); g.lineTo(x, x % 32 === 10 ? 23 : 20); g.stroke(); } tpStroke(g, 2); g.beginPath(); g.moveTo(14, 13); g.lineTo(136, 13); g.stroke(); },
  rl_persp: g => { const vx = 75, vy = 6; g.strokeStyle = TP_ACC; g.lineWidth = 1; for (const x of [0, 30, 120, 150]) { g.beginPath(); g.moveTo(vx, vy); g.lineTo(x, 30); g.stroke(); } g.beginPath(); g.arc(vx, vy, 2.5, 0, 7); g.fillStyle = TP_ACC; g.fill(); tpStroke(g, 1.6); g.strokeRect(52, 18, 46, 10); g.beginPath(); g.moveTo(52, 18); g.lineTo(64, 12); g.lineTo(86, 12); g.lineTo(98, 18); g.stroke(); },
  rl_sym: g => { g.setLineDash([3, 3]); g.strokeStyle = TP_ACC; g.lineWidth = 1; g.beginPath(); g.moveTo(75, 0); g.lineTo(75, 30); g.stroke(); g.setLineDash([]); tpStroke(g, 1.8); for (const s of [1, -1]) { g.beginPath(); g.moveTo(75 + s * 6, 6); g.bezierCurveTo(75 + s * 40, 2, 75 + s * 50, 26, 75 + s * 14, 26); g.stroke(); } },
  rl_ell: g => { g.setLineDash([3, 3]); g.strokeStyle = TP_ACC; g.lineWidth = 1; g.beginPath(); g.ellipse(75, 15, 50, 11, 0, 0, 7); g.stroke(); g.setLineDash([]); tpStroke(g, 2); g.beginPath(); g.ellipse(75, 15, 50, 11, 0, Math.PI * 0.1, Math.PI * 1.2); g.stroke(); },
  /* balloons */
  bl_ellipse: g => tpBalloon(g, 'ellipse'), bl_round: g => tpBalloon(g, 'round'), bl_cloud: g => tpBalloon(g, 'cloud'),
  bl_spike: g => tpBalloon(g, 'spike'), bl_thought: g => tpBalloon(g, 'thought'),
  /* shapes */
  line: g => { tpStroke(g, 2); g.beginPath(); g.moveTo(10, 25); g.lineTo(140, 5); g.stroke(); },
  rect: g => { tpStroke(g, 2); g.strokeRect(40, 4, 70, 22); },
  oval: g => { tpStroke(g, 2); g.beginPath(); g.ellipse(75, 15, 38, 11, 0, 0, 7); g.stroke(); },
  polyline: g => { tpStroke(g, 2); const p = [[10, 24], [45, 6], [80, 22], [110, 8], [140, 20]]; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); p.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }); },
  polygon: g => { tpStroke(g, 2); g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 - Math.PI / 2; g.lineTo(75 + Math.cos(a) * 24, 16 + Math.sin(a) * 12); } g.closePath(); g.stroke(); },
  curve: g => { tpStroke(g, 2); g.beginPath(); g.moveTo(10, 24); g.bezierCurveTo(50, -8, 100, 38, 140, 6); g.stroke(); g.fillStyle = TP_ACC; [[10, 24], [140, 6]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }); },
  /* fills: closed line art, the inside filled with the accent colour */
  fill: g => { g.fillStyle = TP_ACC; g.beginPath(); g.ellipse(52, 15, 32, 11, 0, 0, 7); g.fill(); tpStroke(g, 2); g.stroke(); g.beginPath(); g.ellipse(110, 15, 24, 9, 0, 0, 7); g.stroke(); },
  fillenclose: g => { g.fillStyle = TP_ACC; g.beginPath(); g.ellipse(60, 15, 30, 10, 0, 0, 7); g.fill(); tpStroke(g, 2); g.stroke(); tpAnts(g, () => { g.beginPath(); g.moveTo(20, 3); g.bezierCurveTo(70, -4, 120, 6, 100, 27); g.bezierCurveTo(60, 32, 14, 26, 20, 3); }); },
  /* selections: marching ants */
  selrect: g => tpAnts(g, () => { g.beginPath(); g.rect(30, 5, 90, 20); }),
  selellipse: g => tpAnts(g, () => { g.beginPath(); g.ellipse(75, 15, 42, 11, 0, 0, 7); }),
  sellasso: g => tpAnts(g, () => { g.beginPath(); g.moveTo(30, 8); g.bezierCurveTo(60, -2, 110, 4, 122, 14); g.bezierCurveTo(118, 30, 60, 30, 36, 24); g.closePath(); }),
  selpoly: g => tpAnts(g, () => { g.beginPath(); [[30, 6], [80, 3], [122, 12], [100, 26], [44, 24]].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }),
  selwand: g => { g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(70, 15, 34, 11, 0, 0, 7); g.fill(); tpAnts(g, () => { g.beginPath(); g.ellipse(70, 15, 34, 11, 0, 0, 7); }); g.strokeStyle = TP_ACC; g.lineWidth = 2; g.beginPath(); g.moveTo(112, 26); g.lineTo(126, 8); g.stroke(); },
  /* text */
  text: g => { g.fillStyle = TP_INK; g.font = 'bold 17px sans-serif'; g.textBaseline = 'middle'; g.fillText('Aa', 30, 16); g.font = '15px serif'; g.fillText('あ 文字', 66, 16); },
  /* move / puppet / liquify / bones / vector edit */
  move: g => { tpStroke(g, 1.6); g.setLineDash([3, 3]); g.strokeRect(20, 6, 40, 18); g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(88, 6, 40, 18); g.strokeRect(88, 6, 40, 18); g.beginPath(); g.moveTo(64, 15); g.lineTo(84, 15); g.moveTo(78, 10); g.lineTo(84, 15); g.lineTo(78, 20); g.stroke(); },
  puppet: g => { g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1; for (let i = 0; i <= 6; i++) { g.beginPath(); for (let x = 30; x <= 120; x += 5) { const y = 4 + i * 3.6 + Math.sin((x - 30) / 90 * Math.PI) * 4 * (i / 6); x === 30 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); } g.fillStyle = TP_ACC; [[40, 8], [75, 20], [110, 10]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }); },
  liquify: g => { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); for (let x = 10; x <= 140; x += 3) { const dx = x - 75, y = 4 + i * 5.5 + 6 * Math.exp(-dx * dx / 500) * Math.sin(i); x === 10 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); } },
  bone: g => { const p = [[25, 22], [62, 10], [98, 16], [128, 6]]; g.strokeStyle = TP_ACC; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.fillStyle = TP_INK; p.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }); },
  vecedit: g => { tpStroke(g, 2); g.beginPath(); g.moveTo(14, 22); g.bezierCurveTo(50, 0, 100, 34, 136, 8); g.stroke(); g.fillStyle = TP_ACC; [[14, 22], [75, 16], [136, 8]].forEach(([x, y]) => { g.fillRect(x - 3, y - 3, 6, 6); }); },
  vecerase: g => { tpStroke(g, 2); g.beginPath(); g.moveTo(14, 22); g.lineTo(60, 10); g.moveTo(90, 18); g.lineTo(136, 8); g.stroke(); g.setLineDash([2, 3]); g.strokeStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(60, 10); g.lineTo(90, 18); g.stroke(); g.setLineDash([]); },
  /* eyedropper: colour swatches, the picked one ringed */
  pick: g => { ['#d84a4a', '#e0a06a', '#5aa9e6', '#68c08a'].forEach((c, i) => { g.fillStyle = c; g.fillRect(20 + i * 28, 7, 24, 16); }); g.strokeStyle = TP_INK; g.lineWidth = 2; g.strokeRect(46, 5, 28, 20); },
  /* gradient tools without colour stops: foreground → background */
  linear: g => { const gr = g.createLinearGradient(0, 0, TP_W, 0); gr.addColorStop(0, state.color); gr.addColorStop(1, state.color2 || '#fff'); g.fillStyle = gr; g.fillRect(0, 2, TP_W, 26); },
  radial: g => { const gr = g.createRadialGradient(75, 15, 0, 75, 15, 75); gr.addColorStop(0, state.color); gr.addColorStop(1, state.color2 || '#fff'); g.fillStyle = gr; g.fillRect(0, 2, TP_W, 26); }
};
/* tools that look like another one */
Object.assign(TP_DRAW, { fillone: TP_DRAW.fill, fillref: TP_DRAW.fill, filllasso: TP_DRAW.fillenclose, selpen: TP_DRAW.sellasso, selerase: TP_DRAW.sellasso,
  selshrink: TP_DRAW.selrect, selwandone: TP_DRAW.selwand, selwandref: TP_DRAW.selwand, bonepose: TP_DRAW.bone, bonechain: TP_DRAW.bone });

function toolPreview(id) {
  const def = TOOLDEF[id]; if (!def) return null;
  const s = settings[id];
  if (kindOf(id) === 'brush' && s && typeof s.tex === 'string' && TONES[s.tex]) return tpTone(s.tex, false);
  if (id === 'toneera') return tpTone('tone_dot30', true);
  const f = TP_DRAW[id] || (def.balloon && TP_DRAW['bl_' + def.balloon]);
  if (!f) return null;
  const c = makeCanvas(TP_W, TP_H);
  try { f(c.getContext('2d')); } catch (e) { return null; }
  return c;
}
