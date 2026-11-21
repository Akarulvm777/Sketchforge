/* ---------- Hair & cloth bones (Spine-like physics chains) ----------
   Bone group › "Hair & cloth bones" (bonechain): click points along a strand of hair, a cape, a skirt, a tail or a
   ribbon, from where it is attached to its tip. That chain of bones BENDS the drawing (not just turns it): when the
   part it belongs to moves or turns, the chain lags behind, swings, bounces and settles like hair and cloth do, with
   gravity and optional wind.
   l.chain = { pts: [[x, y]…] (layer pixels, rest pose), inertia, strength, damping, mass, gravity, wind, mix } — one per layer.
   Practice model: chainPractice (a character with long hair and a cape, the body sways, the bones are ready).
   The motion is simulated frame by frame from frame 0 (chainSolve: Verlet points + length constraints + a pull back
   to the drawn shape + gravity relative to the drawn pose) and the drawing is warped with the puppet warp (pupWarp)
   into a view canvas shown instead of the cel (refreshStage) and used for exports (compositeFrame). Keyframes and
   pixels are never changed. Saved in the .sketchforge file (layers[].chain). */
const CHAIN = { hover: -1, drag: null };
let chainBusy = false, chainExport = false;
/* settings like Spine's physics constraints: inertia (how much of the part's motion makes it lag), strength (pull back
   to the drawn shape), damping (calms the swinging), mass (heavier = forces move it less), gravity, wind, mix (0 = as
   drawn, 1 = full physics). Older files had stiff / bounce / grav: read as strength / 1 − damping / gravity. */
const CHAIN_KEYS = ['inertia', 'strength', 'damping', 'mass', 'gravity', 'wind', 'mix'];
const chainParams = P => ({ inertia: P.inertia ?? 1, strength: P.strength ?? P.stiff ?? 0.3, damping: P.damping ?? (P.bounce != null ? 1 - P.bounce : 0.45),
  mass: P.mass ?? 1, gravity: P.gravity ?? P.grav ?? 0.5, wind: P.wind ?? 0, mix: P.mix ?? 1 });
const chainDefaults = () => ({ pts: [], ...chainParams({}) });
const CHAIN_PRESETS = [
  ['Long hair', { inertia: 1, strength: 0.32, damping: 0.5, mass: 1, gravity: 0.6, wind: 0 }],
  ['Cape / coat', { inertia: 0.85, strength: 0.28, damping: 0.55, mass: 1.4, gravity: 0.7, wind: 0 }],
  ['Skirt', { inertia: 0.8, strength: 0.45, damping: 0.55, mass: 1, gravity: 0.5, wind: 0 }],
  ['Ribbon / flag', { inertia: 1, strength: 0.12, damping: 0.3, mass: 0.7, gravity: 0.4, wind: 0.3 }],
  ['Tail / ears', { inertia: 0.7, strength: 0.6, damping: 0.5, mass: 1, gravity: 0.2, wind: 0 }]
];
const chainOn = l => !!(l && l.chain && l.chain.pts && l.chain.pts.length >= 2);
/* pure: rest points (layer space), one layer matrix per frame, settings → the points (layer space) on every frame */
function chainSolve(pts, mats, P0) {
  const n = pts.length, out = [], P = chainParams(P0 || {});
  if (n < 2 || !mats.length) return mats.map(() => pts.map(p => p.slice()));
  const W = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  const k = 0.01 + P.strength * 0.32, damp = 0.03 + P.damping * 0.5, mass = Math.max(0.1, P.mass), G = P.gravity * 6 / mass, wind = P.wind * 3 / mass;
  const carry = 1 - clamp(P.inertia, 0, 1), mix = clamp(P.mix, 0, 1), SUB = 3;
  const a0 = Math.atan2(mats[0][1], mats[0][0]);
  let pos = [], prev = [], Rp = null;
  for (let f = 0; f < mats.length; f++) {
    const m = mats[f], R = pts.map(p => W(m, p));
    if (f === 0) { pos = R.map(p => p.slice()); prev = R.map(p => p.slice()); Rp = R; out.push(pts.map(p => p.slice())); continue; }
    // inertia: the part of the motion that does NOT make the chain lag is carried along directly
    if (carry) for (let i = 1; i < n; i++) { const dx = (R[i][0] - Rp[i][0]) * carry, dy = (R[i][1] - Rp[i][1]) * carry; pos[i][0] += dx; pos[i][1] += dy; prev[i][0] += dx; prev[i][1] += dy; }
    // gravity relative to the drawn pose: none while the part keeps its angle, pulls toward "down" when it turns
    const a = Math.atan2(m[1], m[0]) - a0, gx = G * Math.sin(a), gy = G * (1 - Math.cos(a));
    for (let s = 0; s < SUB; s++) {
      for (let i = 1; i < n; i++) {
        const t = i / (n - 1), ki = k * (1.6 - t) / SUB, p = pos[i], q = prev[i];
        const vx = (p[0] - q[0]) * (1 - damp / SUB), vy = (p[1] - q[1]) * (1 - damp / SUB);
        const wx = wind ? wind * t * (0.75 + 0.25 * Math.sin((f + s / SUB) * 0.33 + i * 0.8)) : 0; // wind along x, with a little flutter
        prev[i] = [p[0], p[1]];
        p[0] += vx + (R[i][0] - p[0]) * ki + (gx + wx) * t / SUB;
        p[1] += vy + (R[i][1] - p[1]) * ki + gy * t / SUB;
      }
      pos[0] = R[0].slice(); prev[0] = R[0].slice();
      for (let it = 0; it < 3; it++) for (let i = 1; i < n; i++) { // keep every bone its length
        const L = Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]), dx = pos[i][0] - pos[i - 1][0], dy = pos[i][1] - pos[i - 1][1], d = Math.hypot(dx, dy) || 1;
        pos[i][0] = pos[i - 1][0] + dx * L / d; pos[i][1] = pos[i - 1][1] + dy * L / d;
      }
    }
    Rp = R;
    const inv = invMat(m);
    out.push(pos.map((p, i) => { const q = W(inv, p); return [pts[i][0] + (q[0] - pts[i][0]) * mix, pts[i][1] + (q[1] - pts[i][1]) * mix]; }));
  }
  return out;
}
/* the chain's points on frame f (cached until anything in the document changes) */
function chainAt(l, f) {
  const C = l.chain; if (!chainOn(l)) return null;
  const c = l._chainCache, key = physVer + '|' + state.frameCount + '|' + JSON.stringify(C);
  if (!c || c.key !== key) {
    chainBusy = true;
    let mats; try { mats = Array.from({ length: state.frameCount }, (_, i) => layerMat(l, i) || I6); } finally { chainBusy = false; }
    l._chainCache = { key, sim: chainSolve(C.pts, mats, C) };
  }
  return l._chainCache.sim[clamp(f, 0, state.frameCount - 1)];
}
const chainMoved = (rest, cur) => cur && rest.some((p, i) => Math.hypot(p[0] - cur[i][0], p[1] - cur[i][1]) > 0.3);
/* the drawing of l on frame f bent by its chain (one view canvas per layer, redrawn when something changes) */
function chainView(l, f, cel) {
  const cur = chainAt(l, f); if (!cur || !cel || !chainMoved(l.chain.pts, cur)) return cel;
  let v = l._chainView; if (!v || v.width !== cel.width || v.height !== cel.height) { v = l._chainView = makeCanvas(cel.width, cel.height); v._key = ''; }
  const key = (cel._sv || 0) + '|' + f + '|' + cur.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(';');
  if (v._key !== key) {
    const g = v.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, v.width, v.height);
    // an extra fixed point just before the root keeps what is above the attachment (the top of the head…) in place
    const P = l.chain.pts, ax = P[0][0] - (P[1][0] - P[0][0]) * 0.6, ay = P[0][1] - (P[1][1] - P[0][1]) * 0.6;
    g.save(); pupWarp(g, cel, [[ax, ay], ...P], [[ax, ay], ...cur], 18); g.restore(); v._key = key;
  }
  return v;
}
/* editing the drawing of a chain layer shows it unbent (you draw the rest pose) */
const chainEditing = l => l.id === state.activeId && ['brush', 'fill', 'shape', 'poly'].includes(kindOf(state.tool));
function chainUndo(l, before) {
  const after = l.chain ? JSON.parse(JSON.stringify(l.chain)) : null, b = before ? JSON.parse(JSON.stringify(before)) : null;
  const apply = x => { l.chain = x ? JSON.parse(JSON.stringify(x)) : null; l._chainCache = null; physKick(); refreshAll(); };
  pushHistory({ undo() { apply(b); }, redo() { apply(after); } }); markDirty();
}
const chainPtsDoc = l => { const m = layerMat(l, state.frame) || I6, cur = chainAt(l, state.frame) || l.chain.pts; return cur.map(p => applyMat(m, p[0], p[1])); };
function chainHit(l, x, y) {
  if (!chainOn(l) && !(l && l.chain && l.chain.pts.length)) return -1;
  const S = docToScreen(x, y), pts = chainPtsDoc(l);
  let best = -1, bd = 12; pts.forEach((p, i) => { const s = docToScreen(p[0], p[1]), d = Math.hypot(s[0] - S[0], s[1] - S[1]); if (d < bd) { bd = d; best = i; } });
  return best;
}
const BONE_CHAIN = {
  name: 'Bone: hair & cloth', kind: 'dragdraw', icon: 'bonechain',
  ddDown(o) {
    let l = activeLayer();
    const hit = l && l.chain ? chainHit(l, o.x0, o.y0) : -1;
    if (hit >= 0) { o.layer = l; o.idx = hit; o.before = JSON.parse(JSON.stringify(l.chain)); return; }
    const p = partAt(o.x0, o.y0); if (p && p !== l && !(l && l.chain && l.chain.pts.length)) { l = p; state.activeId = p.id; }
    if (!l || l.paper || l.vref) { toast('Pick the hair / cloth layer first'); return; }
    if (l.locked) { toast('Layer is locked'); return; }
    o.layer = l; o.add = true; o.before = l.chain ? JSON.parse(JSON.stringify(l.chain)) : null;
  },
  ddMove(o) {
    if (!o.layer || o.idx == null) { CHAIN.hover = activeLayer() ? chainHit(activeLayer(), o.x1, o.y1) : -1; return; }
    if (state.frame !== 0 && keyAt(o.layer, state.frame) !== keyAt(o.layer, 0)) { /* rest pose edits use this frame's matrix */ }
    const inv = invMat(layerMat(o.layer, state.frame) || I6), q = applyMat(inv, o.x1, o.y1);
    o.layer.chain.pts[o.idx] = q; o.layer._chainCache = null; o.moved = true; refreshStage();
  },
  ddEnd(o) {
    const l = o.layer; if (!l) return;
    if (o.idx != null) { if (o.moved) chainUndo(l, o.before); if (o.alt && !o.moved) { l.chain.pts.splice(o.idx, 1); chainUndo(l, o.before); } refreshAll(); return; }
    if (!o.add) return;
    const inv = invMat(layerMat(l, state.frame) || I6), q = applyMat(inv, o.x1, o.y1);
    if (!l.chain) l.chain = chainDefaults();
    l.chain.pts.push(q); l._chainCache = null; physKick();
    chainUndo(l, o.before);
    const n = l.chain.pts.length;
    toast(n === 1 ? `"${l.name}": the first point is where it is attached. Click along it to its tip.` : `${n - 1} bone${n > 2 ? 's' : ''} on "${l.name}". Animate the part it hangs from and press Play.`, 3500);
    refreshAll();
  },
  overlay(g, S) {
    const l = activeLayer(); if (!l || !l.chain || !l.chain.pts.length) { drawBones(g, S); return; }
    drawBones(g, S);
    const pts = chainPtsDoc(l).map(p => S(p[0], p[1]));
    g.save(); g.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) { // bone shapes: a thin diamond from each point to the next
      const [a, b] = [pts[i - 1], pts[i]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * Math.min(7, L / 4), ny = dx / L * Math.min(7, L / 4);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0] + dx * 0.2 + nx, a[1] + dy * 0.2 + ny); g.lineTo(b[0], b[1]); g.lineTo(a[0] + dx * 0.2 - nx, a[1] + dy * 0.2 - ny); g.closePath();
      g.fillStyle = 'rgba(120,200,255,.35)'; g.strokeStyle = '#78c8ff'; g.lineWidth = 1.5; g.fill(); g.stroke();
    }
    pts.forEach((p, i) => { g.beginPath(); g.arc(p[0], p[1], i === 0 ? 6.5 : 5, 0, 7); g.fillStyle = i === 0 ? '#ff8a3d' : i === CHAIN.hover ? '#ffe066' : '#ffffff'; g.strokeStyle = '#1b1d20'; g.lineWidth = 1.5; g.fill(); g.stroke(); });
    g.restore();
  },
  props(body) {
    const l = activeLayer(), C = l && l.chain;
    hint(body, 'Bones that bend hair, a cape, a skirt, a tail or a ribbon and make it flow. Put the part on its own layer and link it to the part it hangs from (Bone: link parts). Then click points from where it is attached (orange) to its tip. Drag a point to move it, Alt+click a point to remove it.');
    const st = document.createElement('div'); st.className = 'small muted'; st.style.margin = '4px 0 6px';
    st.textContent = l ? (C && C.pts.length ? `"${l.name}": ${Math.max(0, C.pts.length - 1)} bone${C.pts.length === 2 ? '' : 's'}` : `"${l.name}": no hair / cloth bones yet — click on the drawing`) : 'No layer';
    body.appendChild(st);
    if (C && C.pts.length) {
      const P = chainParams(C);
      const commit = before => { if (!commit.b) commit.b = before; clearTimeout(commit.t); commit.t = setTimeout(() => { chainUndo(l, commit.b); commit.b = null; }, 400); };
      const set = (k, v) => { const before = JSON.parse(JSON.stringify(C)); Object.assign(C, P, { [k]: v }); delete C.stiff; delete C.bounce; delete C.grav; P[k] = v; l._chainCache = null; physKick(); refreshStage(); commit(before); };
      const row = document.createElement('label'); row.className = 'select'; row.innerHTML = '<span>Ready setting</span>';
      const sel = document.createElement('select'); sel.innerHTML = '<option value="">Choose…</option>' + CHAIN_PRESETS.map((p, i) => `<option value="${i}">${p[0]}</option>`).join('');
      sel.onchange = () => { const pr = CHAIN_PRESETS[+sel.value]; if (!pr) return; const before = JSON.parse(JSON.stringify(C)); Object.assign(C, P, pr[1]); delete C.stiff; delete C.bounce; delete C.grav; l._chainCache = null; physKick(); chainUndo(l, before); refreshProps(); refreshStage(); };
      row.appendChild(sel); body.appendChild(row);
      slider(body, 'Inertia (how much it lags)', 0, 100, 1, P.inertia * 100, v => v + '%', v => set('inertia', v / 100));
      slider(body, 'Strength (back to its shape)', 0, 100, 1, P.strength * 100, v => v + '%', v => set('strength', v / 100));
      slider(body, 'Damping (calms the swing)', 0, 100, 1, P.damping * 100, v => v + '%', v => set('damping', v / 100));
      slider(body, 'Mass (heavier)', 10, 300, 5, P.mass * 100, v => v + '%', v => set('mass', v / 100));
      slider(body, 'Gravity', 0, 100, 1, P.gravity * 100, v => v + '%', v => set('gravity', v / 100));
      slider(body, 'Wind (← −  + →)', -100, 100, 1, P.wind * 100, v => v + '%', v => set('wind', v / 100));
      slider(body, 'Mix (drawn ↔ physics)', 0, 100, 1, P.mix * 100, v => v + '%', v => set('mix', v / 100));
    }
    btns(body, [
      ['▶ Play', () => { if (state.mode !== 'anim') setMode('anim'); play(); }],
      ['Remove these bones', () => { if (!l || !l.chain) return; const b = JSON.parse(JSON.stringify(l.chain)); l.chain = null; l._chainCache = null; chainUndo(l, b); refreshAll(); }],
      ['🧝 Practice model', () => chainPractice()]
    ]);
  }
};
/* practice model: a character with long hair and a cape; the body sways left and right, the bones are already placed */
function chainPractice() {
  newDocument(600, 600, 36, 12, false, 'Hair & cloth practice');
  state.layers = state.layers.filter(l => l.paper);
  const add = (name, draw, parent) => { const l = createLayer(name); const c = makeCel(true); l.cels = new Map([[0, c]]); const g = c.getContext('2d'); draw(g); c._sv = 1; state.layers.push(l); if (parent) setLayerParent(l, parent.id); return l; };
  const round = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill(); };
  const body = createLayer('Body');
  const cape = add('Cape', g => { g.fillStyle = '#6b3fc4'; g.beginPath(); g.moveTo(262, 200); g.lineTo(338, 200); g.lineTo(385, 440); g.quadraticCurveTo(300, 465, 215, 440); g.closePath(); g.fill(); g.strokeStyle = '#4a2a8a'; g.lineWidth = 3; for (let x = 250; x <= 350; x += 25) { g.beginPath(); g.moveTo(300 + (x - 300) * 0.4, 210); g.lineTo(x, 445); g.stroke(); } });
  const hair = add('Hair', g => { g.fillStyle = '#5b3420'; round(g, 238, 112, 124, 230, 50); g.strokeStyle = '#3c2214'; g.lineWidth = 3; for (let x = 255; x <= 345; x += 18) { g.beginPath(); g.moveTo(x, 130); g.lineTo(x + 2, 335); g.stroke(); } });
  const bc = makeCel(true); body.cels = new Map([[0, bc]]); { const g = bc.getContext('2d'); g.fillStyle = '#3a6ea5'; round(g, 256, 188, 88, 190, 26); g.fillStyle = '#2b5583'; g.fillRect(256, 300, 88, 12); }
  state.layers.push(body);
  const head = add('Head', g => { g.fillStyle = '#f1c7a0'; g.beginPath(); g.arc(300, 150, 46, 0, 7); g.fill(); g.fillStyle = '#5b3420'; g.beginPath(); g.arc(300, 138, 48, Math.PI, 0); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(284, 158, 4, 0, 7); g.arc(316, 158, 4, 0, 7); g.fill(); });
  setLayerParent(head, body.id); setLayerParent(cape, body.id); setLayerParent(hair, head.id); body.mainPart = true;
  head.px = 300; head.py = 192; body.px = 300; body.py = 378; cape.px = 300; cape.py = 202; hair.px = 300; hair.py = 120;
  hair.chain = { pts: [[300, 118], [300, 170], [300, 222], [300, 274], [300, 330]], ...CHAIN_PRESETS[0][1], mix: 1 };
  cape.chain = { pts: [[300, 202], [300, 262], [300, 322], [300, 382], [300, 445]], ...CHAIN_PRESETS[1][1], mix: 1 };
  // the body sways: keyframes 0, 9, 18, 27 with tweens
  const keys = [[0, 0, 0], [9, 110, 10], [18, -110, -10], [27, 0, 0]];
  keys.forEach(([f, x, rot]) => { const c = f === 0 ? bc : copyCel(bc); c._xf = { x, y: 0, rot, sx: 1, sy: 1, alpha: 1, tween: f !== 27, ease: 40 }; body.cels.set(f, c); });
  state.activeId = hair.id; layerCounter = state.layers.length;
  history.undo.length = 0; history.redo.length = 0; physKick();
  setMode('anim', true); bindAll(0); selectTool('bonechain'); refreshAll(); if (typeof fit === 'function') fit(); if (typeof syncTab === 'function') syncTab();
  toast('Practice model: the hair and the cape already have bones (blue). Press Play: they bend and flow when the body sways. Try the ready settings and sliders in Tool Property.', 7000);
  setTimeout(() => { try { if (!playing) play(); } catch (e) { /* ignore */ } }, 600);
}
function installChainBones() {
  IC.bonechain = '<circle cx="5" cy="4" r="2.2"/><path d="M6.5 5.6c3 2.5 1 5 3.5 7.4s5 1 7 4"/><circle cx="10" cy="13" r="1.6"/><circle cx="18" cy="18.5" r="1.8"/>';
  TOOLDEF.bonechain = BONE_CHAIN; settings.bonechain = {};
  const g = GROUPS.find(x => x.id === 'bone'); if (g && !g.subs.includes('bonechain')) g.subs.push('bonechain');
  CMD.boneChain = () => selectTool('bonechain'); CMD.chainPractice = chainPractice;
  const A = MENUS.find(m => m[0] === 'Animation'); if (A) { const i = A[1].findIndex(x => Array.isArray(x) && x[1] === 'physBone'); A[1].splice(i < 0 ? A[1].length : i + 1, 0, ['〰 Hair & cloth bones (bend and flow)', 'boneChain'], ['🧝 Hair & cloth practice model', 'chainPractice']); }
  // the stage shows the bent drawing instead of the cel
  const rs0 = refreshStage;
  refreshStage = function () {
    const out = rs0.apply(this, arguments);
    state.layers.forEach(l => {
      const c = l.canvas; if (!c || !chainOn(l) || l.vref) { if (l._chainView && l._chainView.parentNode) l._chainView.remove(); return; }
      if (!l.visible || chainEditing(l) || isCustomBlend(l.blend) || l.clip || l.mask || c.style.display === 'none') { if (l._chainView && l._chainView.parentNode) l._chainView.remove(); return; }
      const v = chainView(l, state.frame, c);
      if (v === c) { if (l._chainView && l._chainView.parentNode) l._chainView.remove(); return; }
      v.style.cssText = c.style.cssText; v.style.pointerEvents = 'none'; c.style.display = 'none';
      if (v.parentNode !== stage) stage.insertBefore(v, c.nextSibling);
    });
    return out;
  };
  // exports and previews: compositeFrame gets the bent drawing
  const fp0 = frameParams;
  frameParams = function (l, f) {
    const fp = fp0.apply(this, arguments);
    if (!chainExport || chainBusy || !fp || !chainOn(l)) return fp;
    return { ...fp, cel: chainView(l, f, fp.cel) };
  };
  const cf0 = compositeFrame;
  compositeFrame = function () { const was = chainExport; chainExport = true; try { return cf0.apply(this, arguments); } finally { chainExport = was; } };
}
