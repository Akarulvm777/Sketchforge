/* ---------- Lip-sync from the sound, and the sound in exported videos ----------
   Animation › 👄 Lip-sync from sound…: on the active layer, its swap drawings (🔁 Swap bar) are used as mouths —
   closed, half open, open (chosen in the dialog). The loudness of the sound track (aud.peaks) on every frame of the
   play range picks the mouth (lipFrames: thresholds relative to the loudest moment, a mouth held at least minHold
   frames so it does not flicker); a keyframe is made only where the mouth changes. One undo step.
   Export: "Include the sound" (on by default when there is sound) mixes the sound track into MP4 / WebM. */
/* the loudness (0..1, relative to the loudest moment) of each frame (pure) */
function frameLoudness(peaks, dur, fps, n) {
  const out = new Array(n).fill(0); if (!peaks || !peaks.length || !dur) return out;
  let mx = 0; for (const p of peaks) mx = Math.max(mx, p); if (!mx) return out;
  for (let f = 0; f < n; f++) { const a = Math.floor(f / fps / dur * peaks.length), b = Math.max(a + 1, Math.floor((f + 1) / fps / dur * peaks.length)); let m = 0; for (let i = a; i < b && i < peaks.length; i++) m = Math.max(m, peaks[i]); out[f] = m / mx; }
  return out;
}
/* mouth per frame: 0 closed, 1 half, 2 open, from the loudness; a change must last minHold frames (pure) */
function lipFrames(loud, half = 0.12, open = 0.45, minHold = 2) {
  const raw = loud.map(v => v >= open ? 2 : v >= half ? 1 : 0), out = raw.slice();
  let cur = raw[0];
  for (let f = 0; f < raw.length; f++) {
    if (raw[f] !== cur) { let k = f; while (k < raw.length && raw[k] === raw[f]) k++; if (k - f >= minHold || f === 0) cur = raw[f]; }
    out[f] = cur;
  }
  return out;
}
function lipSync() {
  const l = activeLayer();
  if (typeof aud === 'undefined' || !aud.peaks) { toast('First add the voice: Animation › Import audio…'); return; }
  const sw = typeof swapsOf === 'function' ? swapsOf(l) : [];
  if (sw.length < 2) { toast('Make the mouths first: draw a closed mouth and an open mouth (and a half-open one) in the 🔁 Swap bar of this layer'); return; }
  const opts = sw.map(s => [s.id, s.name]);
  proDialog('👄 Lip-sync from sound', [
    { k: 'closed', label: 'Closed mouth', type: 'select', val: sw[0].id, options: opts },
    { k: 'half', label: 'Half-open mouth', type: 'select', val: (sw[2] || sw[1]).id, options: opts },
    { k: 'open', label: 'Open mouth', type: 'select', val: sw[1].id, options: opts },
    { k: 'sens', label: 'Sensitivity', type: 'range', min: 10, max: 90, val: 50 },
    { k: 'hold', label: 'Hold each mouth at least (frames)', type: 'range', min: 1, max: 6, val: 2 }
  ], p => {
    const [a, b] = typeof playRange === 'function' ? playRange() : [0, state.frameCount - 1];
    const n = state.frameCount, k = p.sens / 50, loud = frameLoudness(aud.peaks, aud.dur, state.fps, n);
    const lv = lipFrames(loud, 0.12 / k, 0.45 / k, p.hold), ids = [p.closed, p.half, p.open];
    let made = 0;
    timelineOp(() => {
      let prev = -1;
      for (let f = a; f <= b; f++) {
        if (lv[f] === prev) continue; prev = lv[f];
        const s = sw.find(x => x.id === ids[lv[f]]); if (!s) continue;
        const kf = keyAt(l, f), cur = kf !== null ? l.cels.get(kf) : null, c = swapCopy(s.cel);
        if (cur) { const fp = frameParams(l, f); if (fp) c._xf = { ...IDENT, x: fp.p.x, y: fp.p.y, rot: fp.p.rot, sx: fp.p.sx, sy: fp.p.sy, alpha: fp.p.alpha }; }
        c._swap = s.id; c._ink = true; c._sv = (c._sv || 0) + 1; l.cels.set(f, c); made++;
      }
    });
    bindAll(state.frame); refreshAll(); markDirty(); if (typeof renderSwapBar === 'function') renderSwapBar(true);
    toast(`Lip-sync: ${made} mouth changes from the sound. Press Play (the sound plays too). Fix any frame by tapping another mouth in the Swap bar.`, 6000);
  }, 'Make lip-sync');
}
function installLipSync() {
  CMD.lipSync = lipSync;
  const A = MENUS.find(m => m[0] === 'Animation'); if (A) { const i = A[1].findIndex(x => Array.isArray(x) && x[1] === 'audioRemove'); A[1].splice(i < 0 ? A[1].length : i + 1, 0, ['👄 Lip-sync from sound…', 'lipSync']); }
  // export dialog: include the sound
  const go = $('#expGo'); if (go && !$('#expSound')) {
    const lab = document.createElement('label'); lab.className = 'check'; lab.innerHTML = '<input type="checkbox" id="expSound" checked> Include the sound (MP4 / WebM)';
    const loop = $('#expLoop'); (loop && loop.closest('label') ? loop.closest('label') : go).after(lab);
  }
}
