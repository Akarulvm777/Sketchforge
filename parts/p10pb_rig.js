/* ---------- Rigging: bone rig (layer parenting) and puppet warp ----------
   Bone rig (Animate-style cut-out animation): each body part is a layer; a layer can follow a parent layer
   (l.parent). Its pivot is the joint. Moving / rotating / scaling a parent with the Move tool carries every
   child with it, on keyframes and through motion tweens (layerMat in p02 composes the matrices). */

function rigDescendants(l) {
  const out = new Set(), walk = p => { for (const c of state.layers) if (c.parent === p.id && !out.has(c)) { out.add(c); walk(c); } };
  walk(l); return out;
}
function setParentDialog() {
  const l = activeLayer(); if (!l) return;
  const bad = rigDescendants(l);
  const opts = [['', '— none (free layer) —']].concat(state.layers.filter(x => x !== l && !bad.has(x) && !x.paper && !x.vref).reverse().map(x => [String(x.id), x.name]));
  proDialog(`Bone rig: parent of "${l.name}"`, [{ k: 'parent', label: 'Follows', type: 'select', val: String(l.parent || ''), options: opts }], p => {
    const pid = p.parent ? +p.parent : null;
    timelineOp(() => { setLayerParent(l, pid); });
    toast(pid ? `"${l.name}" now follows "${layerParent(l).name}". Alt+drag its orange dot (Move tool) onto the joint.` : `"${l.name}" is free again`, 6000);
  }, 'Set');
}
/* Re-parent without the picture jumping: every keyframe keeps its on-screen placement. */
function setLayerParent(l, pid) {
  const I = [1, 0, 0, 1, 0, 0], keys = [...l.cels.keys()];
  const before = new Map(keys.map(k => [k, layerMat(l, k) || I]));
  l.parent = pid;
  const par = layerParent(l);
  for (const k of keys) {
    const inv = invMat(par ? layerMat(par, k) || I : I); if (!inv) continue;
    rigDecompose(mulMat(inv, before.get(k)), ensureXf(l.cels.get(k)), l);
  }
}
/* matrix → x, y, rot, sx, sy (around the layer pivot) */
function rigDecompose(m, x, l) {
  const [px, py] = pivotOf(l);
  const sx = Math.hypot(m[0], m[1]) || 1, rot = Math.atan2(m[1], m[0]) / DEG, det = m[0] * m[3] - m[1] * m[2], sy = det / sx;
  x.rot = rot; x.sx = sx; x.sy = sy;
  const base = matFrom({ x: 0, y: 0, rot, sx, sy }, px, py);
  x.x = m[4] - base[4]; x.y = m[5] - base[5];
}
function drawBones(g, S) {
  const rigged = state.layers.filter(l => l.visible && layerParent(l));
  if (!rigged.length) return;
  const act = activeLayer(), chain = new Set(); for (let l = act; l; l = layerParent(l)) { chain.add(l); if (chain.size > 20) break; }
  const joint = l => { const m = layerMat(l, state.frame) || [1, 0, 0, 1, 0, 0], [px, py] = pivotOf(l); return S(...applyMat(m, px, py)); };
  g.save();
  for (const l of rigged) {
    const a = joint(layerParent(l)), b = joint(l), on = chain.has(l);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), len = Math.hypot(b[0] - a[0], b[1] - a[1]), w = Math.min(9, Math.max(4, len * 0.09));
    g.fillStyle = on ? 'rgba(255,170,60,.55)' : 'rgba(120,200,255,.35)'; g.strokeStyle = on ? '#ffaa3c' : '#78c8ff'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(a[0], a[1]);
    g.lineTo(a[0] + Math.cos(ang + 1.2) * w, a[1] + Math.sin(ang + 1.2) * w); g.lineTo(b[0], b[1]);
    g.lineTo(a[0] + Math.cos(ang - 1.2) * w, a[1] + Math.sin(ang - 1.2) * w); g.closePath(); g.fill(); g.stroke();
    for (const p of [a, b]) { g.beginPath(); g.arc(p[0], p[1], 4, 0, 7); g.fillStyle = '#fff'; g.fill(); g.stroke(); }
  }
  g.restore();
}
function rigHelp() {
  let d = $('#rigHelp');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'rigHelp'; d.className = 'csdlg';
    d.innerHTML = `<form method="dialog"><h5>Rigging a character</h5><div class="small" style="line-height:1.55">
      <p><b>Bone rig (cut-out animation)</b></p>
      <ol style="margin:0 0 8px 18px;padding:0"><li>Draw each body part on its own layer (body, upper arm, forearm, hand…).</li>
      <li>Select a part and use <i>Layer › Bone rig: set parent…</i> — forearm follows upper arm, upper arm follows body…</li>
      <li>With the <i>Move</i> tool, <b>Alt+drag the orange dot</b> of each part onto its joint (shoulder, elbow…).</li>
      <li>Rotate parts with the Move tool's round handle. Children follow. Make keyframes and press <b>Tween</b>: the whole limb animates.</li></ol>
      <p><b>Puppet warp (bend one drawing)</b></p>
      <ol style="margin:0 0 8px 18px;padding:0"><li>Choose the <i>Puppet warp</i> sub-tool (Move group) and click on the drawing to place pins (shoulder, elbow, wrist…).</li>
      <li>Drag a pin: the drawing bends smoothly around the other pins. Keep a pin still to hold that part in place.</li>
      <li>Pose it on two keyframes, then <i>Animation › Puppet: create in-betweens</i> fills the frames between.</li></ol></div>
      <div class="dialog-actions"><button value="ok" class="primary">OK</button></div></form>`;
    document.body.appendChild(d);
  }
  d.showModal();
}
function installRig() {
  IC.puppet = '<circle cx="7" cy="6" r="2"/><circle cx="17" cy="10" r="2"/><circle cx="9" cy="18" r="2"/><path d="M7 8c1 4 7 1 9 3M10 16c2-2 5-3 6-4"/>';
  TOOLDEF.puppet = { name: 'Puppet warp', kind: 'puppet', icon: 'puppet' };
  const mg = GROUPS.find(g => g.id === 'move'); if (mg && !mg.subs.includes('puppet')) mg.subs.push('puppet');
  Object.assign(CMD, { puppetInbetween, puppetClear, rigParent: setParentDialog, rigFree: () => { const l = activeLayer(); if (l && l.parent) timelineOp(() => setLayerParent(l, null)); }, rigHelp });
  const LY = MENUS.find(m => m[0] === 'Layer')[1];
  LY.push('-', ['Bone rig: set parent…', 'rigParent'], ['Bone rig: free this layer', 'rigFree'], ['How to rig a character…', 'rigHelp']);
  const AN = MENUS.find(m => m[0] === 'Animation')[1];
  AN.push('-', ['Puppet: create in-betweens', 'puppetInbetween'], ['Puppet: remove pins', 'puppetClear'], ['How to rig a character…', 'rigHelp']);
}

/* ===== Puppet warp (After Effects-style pins) =====
   A keyframe cel gets c._pup = { rest: canvas (the untouched drawing), pins: [[x,y]] (rest positions),
   cur: [[x,y]] (posed positions) } in layer-pixel space. The cel is re-rendered from rest with a
   rigid moving-least-squares deformation evaluated on a grid; each grid cell is two texture-mapped triangles. */
const PUP_GRID = 14, PUP_HIT = 12;
function pupDeform(pins, cur, x, y) {
  const n = pins.length;
  if (!n) return [x, y];
  if (n === 1) return [x + cur[0][0] - pins[0][0], y + cur[0][1] - pins[0][1]];
  let sw = 0, px = 0, py = 0, qx = 0, qy = 0;
  const w = new Array(n);
  for (let i = 0; i < n; i++) {
    const dx = pins[i][0] - x, dy = pins[i][1] - y, d2 = dx * dx + dy * dy;
    if (d2 < 1e-6) return [cur[i][0], cur[i][1]];
    w[i] = 1 / d2; sw += w[i]; px += w[i] * pins[i][0]; py += w[i] * pins[i][1]; qx += w[i] * cur[i][0]; qy += w[i] * cur[i][1];
  }
  px /= sw; py /= sw; qx /= sw; qy /= sw;
  // rotation that best maps the weighted pin offsets (complex form: sum w * q^ * conj(p^))
  let re = 0, im = 0;
  for (let i = 0; i < n; i++) {
    const ax = pins[i][0] - px, ay = pins[i][1] - py, bx = cur[i][0] - qx, by = cur[i][1] - qy;
    re += w[i] * (bx * ax + by * ay); im += w[i] * (by * ax - bx * ay);
  }
  const m = Math.hypot(re, im) || 1, c = re / m, s = im / m, vx = x - px, vy = y - py;
  return [c * vx - s * vy + qx, s * vx + c * vy + qy];
}
function pupRender(cel) {
  const P = cel._pup, rest = P.rest, g = cel.getContext('2d');
  cel._sv = (cel._sv || 0) + 1;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cel.width, cel.height);
  if (!P.pins.length) { g.drawImage(rest, 0, 0); g.restore(); cel._bb = undefined; return; }
  const bb = celBBox(rest); if (!bb) { g.restore(); return; }
  const m = PUP_GRID * 2, x0 = bb.x - m, y0 = bb.y - m, x1 = bb.x + bb.w + m, y1 = bb.y + bb.h + m;
  const nx = Math.max(1, Math.ceil((x1 - x0) / PUP_GRID)), ny = Math.max(1, Math.ceil((y1 - y0) / PUP_GRID));
  const pts = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const sx = x0 + i * (x1 - x0) / nx, sy = y0 + j * (y1 - y0) / ny; pts.push([sx, sy, ...pupDeform(P.pins, P.cur, sx, sy)]); }
  const tri = (a, b, c) => {
    // affine map from source triangle (a,b,c)[0..1] to destination (a,b,c)[2..3]
    const [sx0, sy0, dx0, dy0] = a, [sx1, sy1, dx1, dy1] = b, [sx2, sy2, dx2, dy2] = c;
    const den = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0); if (!den) return;
    const A = ((dx1 - dx0) * (sy2 - sy0) - (dx2 - dx0) * (sy1 - sy0)) / den, C = ((dx2 - dx0) * (sx1 - sx0) - (dx1 - dx0) * (sx2 - sx0)) / den;
    const B = ((dy1 - dy0) * (sy2 - sy0) - (dy2 - dy0) * (sy1 - sy0)) / den, D = ((dy2 - dy0) * (sx1 - sx0) - (dy1 - dy0) * (sx2 - sx0)) / den;
    const E = dx0 - A * sx0 - C * sy0, F = dy0 - B * sx0 - D * sy0;
    // clip slightly enlarged (0.9 px) to hide seams between neighbouring triangles
    const cx = (dx0 + dx1 + dx2) / 3, cy = (dy0 + dy1 + dy2) / 3, gro = p => { const ex = p[0] - cx, ey = p[1] - cy, l = Math.hypot(ex, ey) || 1; return [p[0] + ex / l * 0.9, p[1] + ey / l * 0.9]; };
    const [q0, q1, q2] = [gro([dx0, dy0]), gro([dx1, dy1]), gro([dx2, dy2])];
    g.save(); g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.closePath(); g.clip();
    g.setTransform(A, B, C, D, E, F); g.drawImage(rest, 0, 0); g.restore();
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = pts[j * (nx + 1) + i], b = pts[j * (nx + 1) + i + 1], c = pts[(j + 1) * (nx + 1) + i], d = pts[(j + 1) * (nx + 1) + i + 1];
    tri(a, b, d); tri(a, d, c);
  }
  g.restore();
  cel._bb = undefined; cel._ink = true;
}
const pupClone = P => P ? { rest: P.rest, pins: P.pins.map(p => p.slice()), cur: P.cur.map(p => p.slice()) } : null;
function pupLayerToScreen(l, x, y) { const m = layerMat(l, state.frame) || [1, 0, 0, 1, 0, 0]; return docToScreen(...applyMat(m, x, y)); }
function pupHit(l, P, e) {
  const r = viewport.getBoundingClientRect(), X = e.clientX - r.left, Y = e.clientY - r.top;
  let best = -1, bd = PUP_HIT;
  P.cur.forEach((p, i) => { const s = pupLayerToScreen(l, p[0], p[1]), d = Math.hypot(s[0] - X, s[1] - Y); if (d < bd) { bd = d; best = i; } });
  return best;
}
function puppetDown(e) {
  const l = canPaint(); if (!l || l.isMask) return;
  if (keyAt(l, state.frame) === null) { toast('Nothing on this layer at this frame'); return; }
  const lm = localMapper(l), d = toDoc(e), [lx, ly] = lm.map(d.x, d.y);
  const keyBefore = keyAt(l, state.frame) === state.frame;
  const before = snapshotTimeline();
  const cel = ensureKeyHere(l); if (!cel) return;
  const pupBefore = pupClone(cel._pup), pixBefore = crop(cel, { x: 0, y: 0, w: state.w, h: state.h });
  if (!cel._pup) { const rest = makeCanvas(state.w, state.h); rest.getContext('2d').drawImage(cel, 0, 0); rest._ink = true; cel._pup = { rest, pins: [], cur: [] }; }
  const P = cel._pup;
  let i = pupHit(l, P, e);
  if (i >= 0 && e.altKey) { P.pins.splice(i, 1); P.cur.splice(i, 1); pupRender(cel); pupCommit(l, cel, pupBefore, pixBefore, before, keyBefore); return; }
  if (i < 0) {
    // new pin: its rest position is where this posed point came from (inverse warp, swapping pins and cur)
    const rp = pupDeform(P.cur, P.pins, lx, ly);
    P.pins.push(rp); P.cur.push([lx, ly]); i = P.pins.length - 1;
    if (P.pins.length === 1) toast('Pin placed. Add more pins on joints, then drag a pin to bend the drawing (Alt+click removes a pin).', 6000);
  }
  active = { type: 'puppet', l, cel, i, map: lm.map, pupBefore, pixBefore, before, keyBefore, moved: false };
  drawOverlay();
}
function puppetMove(e) {
  const a = active, d = toDoc(e), [lx, ly] = a.map(d.x, d.y);
  a.cel._pup.cur[a.i] = [lx, ly]; a.moved = true;
  const now = performance.now();
  if (!a.t || now - a.t > 30) { a.t = now; pupRender(a.cel); renderLayers(); }
  drawOverlay();
}
function puppetUp() {
  const a = active; active = null;
  pupRender(a.cel);
  pupCommit(a.l, a.cel, a.pupBefore, a.pixBefore, a.before, a.keyBefore);
}
function pupCommit(l, cel, pupBefore, pixBefore, tlBefore, keyBefore) {
  const full = { x: 0, y: 0, w: state.w, h: state.h }, pixAfter = crop(cel, full), pupAfter = pupClone(cel._pup);
  const tlAfter = keyBefore ? null : snapshotTimeline();
  const put = (pix, pup) => { const g = cel.getContext('2d'); g.save(); g.globalCompositeOperation = 'copy'; g.drawImage(pix, 0, 0); g.restore(); cel._pup = pupClone(pup); cel._bb = undefined; };
  pushHistory({
    frame: state.frame,
    undo() { put(pixBefore, pupBefore); if (tlAfter) applyTimeline(tlBefore); afterHistory(); },
    redo() { if (tlAfter) applyTimeline(tlAfter); put(pixAfter, pupAfter); afterHistory(); }
  });
  refreshStage(); afterEdit(); updateNav();
}
/* Fill the frames between this puppet keyframe and the next one by interpolating the pins. */
function puppetInbetween() {
  const l = activeLayer(); if (!l) return;
  const k1 = keyAt(l, state.frame), k2 = k1 === null ? null : nextKey(l, k1);
  const c1 = k1 !== null && l.cels.get(k1), c2 = k2 !== null && l.cels.get(k2);
  if (!c1 || !c2 || !c1._pup || !c2._pup) { toast('Pose this keyframe and the next keyframe with Puppet warp pins first'); return; }
  if (c1._pup.rest !== c2._pup.rest || c1._pup.pins.length !== c2._pup.pins.length) { toast('Both keyframes need the same pins: make the second keyframe from the first (K), then move its pins'); return; }
  if (k2 - k1 < 2) { toast('There is no frame between the two keyframes'); return; }
  timelineOp(() => {
    for (let f = k1 + 1; f < k2; f++) {
      const t = (f - k1) / (k2 - k1), c = makeCel(true);
      if (c1._xf) c._xf = { ...c1._xf, tween: false };
      c._pup = { rest: c1._pup.rest, pins: c1._pup.pins.map(p => p.slice()), cur: c1._pup.cur.map((p, i) => [p[0] + (c2._pup.cur[i][0] - p[0]) * t, p[1] + (c2._pup.cur[i][1] - p[1]) * t]) };
      pupRender(c);
      l.cels.set(f, c);
    }
    bindAll(state.frame);
  });
  toast(`Puppet: ${k2 - k1 - 1} in-between frames created`);
}
function puppetClear() {
  const l = activeLayer(), k = l ? keyAt(l, state.frame) : null, c = k !== null && l.cels.get(k);
  if (!c || !c._pup) { toast('No puppet pins on this frame'); return; }
  const tl = snapshotTimeline(), pupBefore = pupClone(c._pup), pix = crop(c, { x: 0, y: 0, w: state.w, h: state.h });
  c._pup.cur = c._pup.pins.map(p => p.slice()); pupRender(c); c._pup = null;
  pupCommit(l, c, pupBefore, pix, tl, true);
  toast('Pins removed — the drawing is back to its original shape');
}
function drawPuppet(g) {
  if (state.tool !== 'puppet') return;
  const l = activeLayer(), k = l ? keyAt(l, state.frame) : null, c = k !== null && l.cels.get(k);
  if (!c || !c._pup) return;
  const act = active && active.type === 'puppet' ? active.i : -1;
  c._pup.cur.forEach((p, i) => {
    const s = pupLayerToScreen(l, p[0], p[1]);
    g.beginPath(); g.arc(s[0], s[1], 7, 0, 7); g.fillStyle = i === act ? '#ffaa3c' : '#ffd84a'; g.fill();
    g.lineWidth = 2; g.strokeStyle = '#1b1b1b'; g.stroke();
  });
}
function puppetProps(body) {
  grp(body, 'Puppet warp');
  const p = document.createElement('p'); p.className = 'muted small';
  p.textContent = 'Click the drawing to add pins (joints). Drag a pin to bend it, Alt+click removes a pin. Pose two keyframes (make the second one with K) and create the in-betweens.';
  body.appendChild(p);
  for (const [t, fn] of [['Create in-betweens', puppetInbetween], ['Remove pins (restore drawing)', puppetClear], ['How to rig a character…', rigHelp]]) {
    const b = document.createElement('button'); b.textContent = t; b.onclick = fn; b.style.cssText = 'display:block;width:100%;margin:4px 0'; body.appendChild(b);
  }
}
