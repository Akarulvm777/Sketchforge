/* ---------- Perspective rulers with 1, 2 or 3 vanishing points ----------
   ruler.vps = [{ x, y }…] (document space), ruler.pcount = 1 | 2 | 3. Click with the Perspective ruler to place the
   points (up to pcount; once full, a click moves the nearest one); drag a point to move it. Each point radiates its
   own coloured guide lines, two or more points draw the horizon line. A stroke follows the direction it starts in:
   the line towards the vanishing point that matches best (perspDirs / perspPick), or a vertical (2 points) /
   horizontal + vertical (1 point) line. Replaces the old single-point ruler.persp (read once for old sessions). */
const VP_COLS = ['#ffbe3c', '#3fd6ff', '#ff6fd8'];
/* the directions (radians) a stroke starting at (x, y) may follow (pure) */
function perspDirs(vps, x, y, vert = true) {
  const out = vps.map(p => Math.atan2(y - p.y, x - p.x));
  if (vps.length === 1) out.push(0, Math.PI / 2);
  if (vps.length === 2 && vert) out.push(Math.PI / 2);
  return out;
}
/* the direction closest to the movement (dx, dy), lines have no sign (pure) */
function perspPick(dirs, dx, dy) {
  const m = Math.atan2(dy, dx); let best = dirs[0], bd = 9;
  for (const a of dirs) { let d = Math.abs(((m - a) % Math.PI + Math.PI) % Math.PI); d = Math.min(d, Math.PI - d); if (d < bd) { bd = d; best = a; } }
  return best;
}
function installPersp() {
  if (!ruler.vps) ruler.vps = ruler.persp ? [{ ...ruler.persp }] : [];
  ruler.persp = null; if (ruler.pcount == null) ruler.pcount = 2; if (ruler.vert == null) ruler.vert = true;
  const rs0 = rulerStart; rulerStart = function (d) {
    const lock = rs0.apply(this, arguments);
    if (lock || !ruler.vps.length || !ruler.snap.persp) return lock;
    return { type: 'pmulti', x0: d.x, y0: d.y, dirs: perspDirs(ruler.vps, d.x, d.y, ruler.vert), a: null };
  };
  const ra0 = rulerApply; rulerApply = function (lock, d) {
    if (!lock || lock.type !== 'pmulti') return ra0.apply(this, arguments);
    if (lock.a == null) { const dx = d.x - lock.x0, dy = d.y - lock.y0; if (Math.hypot(dx, dy) < 6 / view.scale) return { x: lock.x0, y: lock.y0 }; lock.a = perspPick(lock.dirs, dx, dy); }
    const ux = Math.cos(lock.a), uy = Math.sin(lock.a), t = (d.x - lock.x0) * ux + (d.y - lock.y0) * uy;
    return { x: lock.x0 + ux * t, y: lock.y0 + uy * t };
  };
  const dr0 = drawRulers; drawRulers = function (g, S) {
    dr0.apply(this, arguments);
    if (!ruler.show || !ruler.vps.length) return;
    g.save(); g.lineWidth = 1;
    const line = (x0, y0, x1, y1, col) => { const a = S(x0, y0), b = S(x1, y1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = col; g.stroke(); };
    const on = ruler.snap.persp;
    if (ruler.vps.length >= 2) { const [a, b] = ruler.vps, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, k = 30000 / L; g.setLineDash([10, 6]); g.lineWidth = 1.5; line(a.x - dx * k, a.y - dy * k, b.x + dx * k, b.y + dy * k, on ? 'rgba(255,255,255,.75)' : 'rgba(160,160,160,.4)'); g.setLineDash([]); g.lineWidth = 1; }
    ruler.vps.forEach((p, i) => {
      const col = VP_COLS[i] + (on ? '88' : '40');
      for (let k = 0; k < 36; k++) { const a = k * Math.PI / 18; line(p.x, p.y, p.x + Math.cos(a) * 30000, p.y + Math.sin(a) * 30000, col); }
      const s = S(p.x, p.y); g.fillStyle = VP_COLS[i]; g.strokeStyle = '#111'; g.beginPath(); g.arc(s[0], s[1], 7, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#111'; g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), s[0], s[1] + 0.5);
    });
    g.restore();
  };
  const hitVP = (x, y) => { const S = docToScreen(x, y); let best = -1, bd = 16; ruler.vps.forEach((p, i) => { const q = docToScreen(p.x, p.y), d = Math.hypot(q[0] - S[0], q[1] - S[1]); if (d < bd) { bd = d; best = i; } }); return best; };
  Object.assign(TOOLDEF.rl_persp, {
    name: 'Perspective ruler (1–3 points)',
    ddDown(o) { o.vp = hitVP(o.x0, o.y0); },
    ddMove(o) { if (o.vp >= 0) { ruler.vps[o.vp] = { x: o.x1, y: o.y1 }; drawOverlay(); } },
    ddEnd(o) {
      if (o.vp < 0) {
        const p = { x: o.x1, y: o.y1 };
        if (ruler.vps.length < ruler.pcount) ruler.vps.push(p);
        else { let k = 0, bd = Infinity; ruler.vps.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; k = i; } }); ruler.vps[k] = p; }
      }
      ruler.snap.persp = true; drawOverlay(); refreshProps();
      const left = ruler.pcount - ruler.vps.length;
      if (o.vp < 0 && left > 0) toast(`Vanishing point ${ruler.vps.length} placed — click to place ${left} more`, 2500);
    }
  });
  const pc0 = CMD.rulerClear; CMD.rulerClear = () => { ruler.vps = []; pc0(); };
  const pp0 = proProps; proProps = function (body, id) {
    const out = pp0.apply(this, arguments);
    if (id !== 'rl_persp') return out;
    grp(body, 'Perspective');
    seg(body, [[1, '1 point'], [2, '2 points'], [3, '3 points']], ruler.pcount, v => { ruler.pcount = v; if (ruler.vps.length > v) ruler.vps.length = v; drawOverlay(); refreshProps(); });
    const st = document.createElement('div'); st.className = 'small muted'; st.style.margin = '4px 0';
    st.textContent = `${ruler.vps.length} of ${ruler.pcount} vanishing point${ruler.pcount > 1 ? 's' : ''} placed. Click to place, drag a point to move it.`;
    body.appendChild(st);
    if (ruler.pcount === 2) { const l = document.createElement('label'); l.className = 'check'; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = ruler.vert; i.onchange = () => { ruler.vert = i.checked; }; l.append(i, ' Vertical lines stay vertical'); body.appendChild(l); }
    btns(body, [['Clear the vanishing points', () => { ruler.vps = []; drawOverlay(); refreshProps(); }]]);
    hint(body, 'A stroke follows the direction you start drawing in: towards a vanishing point (or straight up / across).');
    return out;
  };
}
