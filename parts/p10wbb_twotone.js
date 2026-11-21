/* ---------- Two-colour brushes: main colour inside, sub colour outside, or a sub-colour glow ----------
   Brush setting twoTone = 'edge' | 'glow' (twoEdge = width of the outer part, 0.05–0.9 of the size). Each dab paints
   the sub colour (state.color2, the second colour square) BEHIND what is already in the stroke (destination-over),
   then the main colour core on top: overlapping dabs make one clean outline / halo, not a row of rings.
   'edge' = hard rim of the size of the dab, core smaller; 'glow' = soft halo larger than the dab around a full core.
   Built-in tools: Outline marker and Neon glow pen (Pen group). Settings in Tool Property and the brush editor. */
function twoToneTip(ctx, st, cx, cy, d, paintCore) {
  const s = st.s, e = clamp(s.twoEdge ?? (s.twoTone === 'glow' ? 0.8 : 0.35), 0.05, 0.9), sub = state.color2 || '#000000';
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'destination-over';
  if (s.twoTone === 'glow') { const D = d * (1 + e * 1.6); ctx.drawImage(getTip(sub, 0), cx - D / 2, cy - D / 2, D, D); }
  else if (s.hardness >= 0.97) { ctx.fillStyle = sub; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill(); }
  else ctx.drawImage(getTip(sub, s.hardness), cx - d / 2, cy - d / 2, d, d);
  ctx.globalCompositeOperation = op;
  paintCore(ctx, st, cx, cy, s.twoTone === 'glow' ? d : Math.max(0.5, d * (1 - e)));
}
function installTwoTone() {
  // the dab painter: two-colour brushes go through twoToneTip (not for erasers, shapes or picture tips)
  const p0 = paintTip;
  paintTip = function (ctx, st, cx, cy, d) {
    const s = st.s;
    if (s.twoTone && !st.erase && !s.shape && !(s.tipId && customTips.has(s.tipId))) return twoToneTip(ctx, st, cx, cy, d, p0);
    return p0(ctx, st, cx, cy, d);
  };
  // built-in tools in the Pen group
  Object.assign(TOOLDEF, {
    outlinemarker: { name: 'Outline marker (main + sub colour)', kind: 'brush', icon: 'marker', preset: P(26, 1, 1, 1, true, false, 0.2, { twoTone: 'edge', twoEdge: 0.35, pMin: 0.5 }) },
    neonpen: { name: 'Neon glow pen', kind: 'brush', icon: 'pen', preset: P(10, 1, 1, 1, true, false, 0.25, { twoTone: 'glow', twoEdge: 0.8, pMin: 0.4 }) }
  });
  for (const k of ['outlinemarker', 'neonpen']) settings[k] = { ...TOOLDEF[k].preset };
  const g = GROUPS.find(x => x.id === 'pen'); if (g) g.subs.push('outlinemarker', 'neonpen');
  // Tool Property: Two colours (any round brush)
  const r0 = refreshProps;
  refreshProps = function () {
    const out = r0.apply(this, arguments);
    const body = $('#propBody'), id = state.tool, s = settings[id];
    if (!body || !s || kindOf(id) !== 'brush' || TOOLDEF[id].erase || s.smudge != null || s.shape) return out;
    grp(body, 'Two colours');
    const row = document.createElement('label'); row.className = 'select'; row.innerHTML = '<span>Colours</span><select><option value="">One colour</option><option value="edge">Main inside, sub colour outside</option><option value="glow">Main colour + sub colour glow</option></select>';
    const sel = row.querySelector('select'); sel.value = s.twoTone || ''; body.appendChild(row);
    sel.onchange = () => { s.twoTone = sel.value || undefined; if (s.twoTone && s.twoEdge == null) s.twoEdge = s.twoTone === 'glow' ? 0.8 : 0.35; refreshProps(); };
    if (s.twoTone) slider(body, s.twoTone === 'glow' ? 'Glow size' : 'Outline width', 5, 90, 1, (s.twoEdge ?? 0.35) * 100, v => v + '%', v => s.twoEdge = v / 100);
    if (s.twoTone) { const t = document.createElement('div'); t.className = 'hint'; t.textContent = 'The outside uses the sub colour (the second colour square; X swaps them).'; body.appendChild(t); }
    return out;
  };
}
