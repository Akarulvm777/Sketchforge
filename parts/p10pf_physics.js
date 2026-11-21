/* ---------- Easier rig: a main part, and gravity bones for hair / cloth (secondary motion, Spine-like) ----------
   • Make main part: the active layer becomes the part that holds the character; every free part follows it
     (setLayerParent), so moving / turning the main part moves everything.
   • Gravity bone: l.phys = { on, stiff, bounce, grav } on a part (hair, cloth, tail, ears…). When the part it hangs
     from moves or turns, it swings like a soft pendulum around its joint (its pivot), lags behind, bounces and settles.
     The swing is simulated frame by frame from frame 0 (rest) and added to the part's rotation where pictures are
     drawn: layerMat and xfCss are wrapped; keyframes are never changed (frameParams stays as it was).
   Saved in the .sketchforge file (layers[].phys). Cache per layer, cleared whenever the document changes. */
let physVer = 1, frameParams0 = null;
const physKick = () => { physVer++; };
function physDefaults() { return { on: true, stiff: 0.35, bounce: 0.5, grav: 0.6 }; }
/* the swing angle (degrees) of a gravity part on frame f */
function physAngle(l, f) {
  const P = l.phys; if (!P || !P.on || state.frameCount < 2) return 0;
  const c = l._physCache;
  if (c && c.ver === physVer && c.n === state.frameCount) return c.a[clamp(f, 0, c.a.length - 1)] || 0;
  const a = physSimulate(l);
  l._physCache = { ver: physVer, n: state.frameCount, a };
  return a[clamp(f, 0, a.length - 1)] || 0;
}
function physSimulate(l) {
  const P = l.phys, n = state.frameCount, out = new Array(n).fill(0);
  const [px, py] = pivotOf(l), I = [1, 0, 0, 1, 0, 0];
  // the part's "weight": the middle of its drawing (first keyframe), seen from the joint
  const k0 = [...l.cels.keys()].sort((a, b) => a - b)[0], cel = l.cels.get(k0), bb = cel && celBBox(cel);
  const cx = bb ? bb.x + bb.w / 2 : px, cy = bb ? bb.y + bb.h / 2 : py + 60;
  const len = Math.max(20, Math.hypot(cx - px, cy - py)), rest = Math.atan2(cy - py, cx - px);
  // where the joint is and how the part is turned on each frame, without the swing
  const base = f => { const fp = frameParams0(l, f), own = fp && !isIdentP(fp.p) ? xfMatrix(fp.p, l) : null; return withParent(own, l, f) || I; };
  const K = 0.02 + P.stiff * 0.35, D = 0.04 + (1 - P.bounce) * 0.4, G = P.grav * 0.06, SUB = 4;
  let phi = 0, w = 0, prev = null, prev2 = null;
  for (let f = 0; f < n; f++) {
    const m = base(f), jx = m[0] * px + m[2] * py + m[4], jy = m[1] * px + m[3] * py + m[5];
    const turn = Math.atan2(m[1], m[0]), dirRest = turn + rest; // where the part points without the swing
    let ax = 0, ay = 0; if (prev && prev2) { ax = jx - 2 * prev[0] + prev2[0]; ay = jy - 2 * prev[1] + prev2[1]; }
    else if (prev) { ax = jx - prev[0]; ay = jy - prev[1]; ax *= 0.5; ay *= 0.5; }
    // a turn of the parent also throws the part: the change of the base angle acts like an angular kick
    if (prev && prev[2] != null) { let dt = turn - prev[2]; if (dt > Math.PI) dt -= 2 * Math.PI; if (dt < -Math.PI) dt += 2 * Math.PI; w -= dt * (0.6 + P.bounce * 0.4); }
    for (let s = 0; s < SUB; s++) {
      const dir = dirRest + phi, tx = -Math.sin(dir), ty = Math.cos(dir); // tangent of the swing
      const inertia = -(ax * tx + ay * ty) / len / SUB;                   // the joint accelerates, the weight lags
      const gravity = G * (Math.cos(dir) - Math.cos(dirRest)) / SUB;      // pulls toward hanging (none at rest)
      w += inertia + gravity - K * phi / SUB - D * w / SUB;
      phi = clamp(phi + w / SUB, -1.2, 1.2);
    }
    out[f] = phi / DEG;
    prev2 = prev; prev = [jx, jy, turn];
  }
  return out;
}
/* "Make main part": every free part follows the active layer */
function makeMainPart() {
  const root = activeLayer(); if (!root || root.paper || root.vref) { toast('Pick the body part that holds the character (e.g. the body) first'); return; }
  const below = rigDescendants(root); let n = 0;
  timelineOp(() => {
    for (const l of state.layers) if (l !== root && !l.paper && !l.vref && !l.parent && !below.has(l) && !l.ref) { setLayerParent(l, root.id); n++; }
    root.mainPart = true;
  });
  physKick(); refreshAll();
  toast(n ? `"${root.name}" is the main part: ${n} part${n > 1 ? 's' : ''} now follow it. Move or turn it to move the whole character.` : `"${root.name}" is the main part (every part already follows something).`, 5000);
}
/* gravity on / off and settings for the active part */
function physDialog() {
  const l = activeLayer(); if (!l || l.paper || l.vref) { toast('Pick a part (hair, cloth, tail…) first'); return; }
  const P = l.phys || physDefaults();
  proDialog(`Gravity bone: "${l.name}"`, [
    { k: 'on', label: 'Swing with gravity (hair, cloth, tail, ears…)', type: 'check', val: !!(l.phys && l.phys.on) },
    { k: 'stiff', label: 'Soft ↔ stiff', type: 'range', min: 0, max: 100, val: Math.round(P.stiff * 100) },
    { k: 'bounce', label: 'Bounce', type: 'range', min: 0, max: 100, val: Math.round(P.bounce * 100) },
    { k: 'grav', label: 'Gravity', type: 'range', min: 0, max: 100, val: Math.round(P.grav * 100) }
  ], v => {
    const before = l.phys ? { ...l.phys } : null, after = { on: !!v.on, stiff: v.stiff / 100, bounce: v.bounce / 100, grav: v.grav / 100 };
    const apply = x => { l.phys = x ? { ...x } : null; l._physCache = null; physKick(); refreshAll(); };
    apply(after);
    pushHistory({ undo() { apply(before); }, redo() { apply(after); } });
    toast(after.on ? (l.parent ? `"${l.name}" now swings when "${layerParent(l).name}" moves. Play the animation to see it.` : `"${l.name}" swings when it moves. Tip: make it follow the part it hangs from (Bone tool) — the joint is its pivot.`) : 'Gravity off', 5000);
  }, 'OK');
}
function installPhysics() {
  // the original frame params (keyframes / tweens only) for the simulation; drawing gets the swing on top
  frameParams0 = frameParams;
  const lm0 = layerMat;
  layerMat = function (l, f = state.frame, depth = 0) {
    const sw = l && l.phys && l.phys.on ? physAngle(l, f) : 0;
    if (!sw) return lm0(l, f, depth);
    const fp = frameParams(l, f), p = fp ? { ...fp.p } : { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1 };
    p.rot += sw;
    return withParent(xfMatrix(p, l), l, f, depth);
  };
  const xc0 = xfCss;
  xfCss = function (p, l) {
    const sw = l && l.phys && l.phys.on ? physAngle(l, state.frame) : 0;
    if (!sw) return xc0(p, l);
    const q = p ? { ...p } : { x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1 }; q.rot += sw;
    return xc0(q, l) === 'none' && !l.parent ? `matrix(${xfMatrix(q, l).join(',')})` : xc0(q, l);
  };
  const md0 = markDirty; markDirty = function () { physKick(); return md0.apply(this, arguments); };
  Object.assign(CMD, { mainPart: makeMainPart, physBone: physDialog });
  const A = MENUS.find(m => m[0] === 'Animation') || MENUS.find(m => m[0] === 'Layer');
  if (A) A[1].push('-', ['🦴 Make main part (everything follows it)', 'mainPart'], ['🌬 Gravity bone (hair, cloth, tail)…', 'physBone']);
}
