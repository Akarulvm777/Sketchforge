/* ---------- brush textures, upgraded (3.6) ----------
   - 16 more built-in textures (TEX_MORE): linen, cold-press watercolour, sponge, crackle, sand, wood grain, kraft
     fibres, fine noise; 3.7: pastel paper, dry brush, granulation, clouds, stipple, hatching, burlap, concrete — all generated here (tileable, TEX_N px), nothing downloaded.
   - texContrast / texBright (−100..100) and texInv now work for every built-in texture too (before: only for
     pictures from .sut files, baked when imported): a derived texture is made once (texDerivedId → texBase) and used
     by the stroke (paperGrain is wrapped: it already gets the stroke's own copy of the settings).
   - texMode 'dab': the texture is stamped with each dab (like a sponge / stamp) instead of laid on the whole stroke,
     and texPress makes the grain fill in when you press harder (light touch = more texture). drawOne is wrapped for it.
   - Tool Property › Texture: a preview swatch of the texture, Rotation, Contrast, Brightness, Invert, "On each dab",
     "Press harder = less grain". The keys are in BRUSH_KEYS (saved with tools, .sfbrush) and in the brush editor. */
const TEX_MORE = [['linen', 'Linen'], ['coldpress', 'Cold-press watercolour'], ['sponge', 'Sponge'], ['crackle', 'Crackle'], ['sand', 'Sand'], ['wood', 'Wood grain'], ['kraft', 'Kraft paper fibres'], ['finenoise', 'Fine noise'],
  // 3.7
  ['laid', 'Pastel paper (laid lines)'], ['drybrush', 'Dry brush streaks'], ['granulation', 'Watercolour granulation'], ['clouds', 'Soft clouds'], ['stipple', 'Stipple dots'], ['hatch', 'Hatching'], ['burlap', 'Burlap'], ['concrete', 'Concrete']];
const TEX_ALL = [['paper', 'Watercolour paper'], ['grain', 'Pencil grain'], ['canvas', 'Canvas weave'], ['rough', 'Rough'], ['bristle', 'Bristle'], ['charcoal', 'Charcoal'], ...TEX_MORE];
/* pure: the values (0..1 = how much paint shows) of one of the new textures, N × N, tileable */
function texMore(id, N) {
  const v = new Float32Array(N * N); let sd = 98765;
  const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  if (id === 'linen') {
    const nx = latticeNoise(N, N, 64, 8, 51), ny = latticeNoise(N, N, 8, 64, 52);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, a = 0.5 + 0.5 * Math.sin(x * Math.PI / 2 + nx[i] * 2), b = 0.5 + 0.5 * Math.sin(y * Math.PI / 2 + ny[i] * 2); v[i] = clamp(0.2 + 0.45 * Math.max(a, b) + 0.25 * Math.min(a, b) + (rnd() - 0.5) * 0.1, 0, 1); }
  } else if (id === 'coldpress') {
    const a = latticeNoise(N, N, 16, 16, 61), b = latticeNoise(N, N, 48, 48, 62);
    for (let i = 0; i < v.length; i++) v[i] = clamp((a[i] * 0.55 + b[i] * 0.45 - 0.35) * 2.2 + (rnd() - 0.5) * 0.08, 0, 1);
  } else if (id === 'sponge') {
    const a = latticeNoise(N, N, 32, 32, 71), b = latticeNoise(N, N, 12, 12, 72);
    for (let i = 0; i < v.length; i++) { const t = a[i] * 0.7 + b[i] * 0.3; v[i] = clamp((t - 0.42) * 6, 0, 1); }
  } else if (id === 'crackle') { // cells with cracks between them (distance to the two nearest points, wrapped)
    const P = []; for (let k = 0; k < 42; k++) P.push([rnd() * N, rnd() * N]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of P) { let dx = Math.abs(x - px), dy = Math.abs(y - py); dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy); const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      v[y * N + x] = clamp((Math.sqrt(d2) - Math.sqrt(d1)) / 3, 0, 1) * (0.85 + rnd() * 0.15);
    }
  } else if (id === 'sand') {
    for (let i = 0; i < v.length; i++) v[i] = clamp(0.55 + (rnd() - 0.5) * 0.5 - (rnd() < 0.08 ? 0.5 : 0) + (rnd() < 0.05 ? 0.4 : 0), 0, 1);
  } else if (id === 'wood') {
    const n = latticeNoise(N, N, 4, 16, 81), f = latticeNoise(N, N, 2, 64, 82);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, r = 0.5 + 0.5 * Math.sin((x / N * 12 + n[i] * 3) * Math.PI * 2); v[i] = clamp(0.3 + r * 0.5 + f[i] * 0.2 + (rnd() - 0.5) * 0.06, 0, 1); }
  } else if (id === 'kraft') {
    v.fill(0.8);
    for (let k = 0; k < 900; k++) { // short fibres, wrapped at the edges
      let x = rnd() * N, y = rnd() * N; const a = rnd() * Math.PI * 2, L = 4 + rnd() * 14, dark = 0.25 + rnd() * 0.4;
      for (let t = 0; t < L; t++) { x += Math.cos(a); y += Math.sin(a); const i = (((y | 0) % N + N) % N) * N + (((x | 0) % N + N) % N); v[i] = Math.min(v[i], dark); }
    }
    const n = latticeNoise(N, N, 32, 32, 91); for (let i = 0; i < v.length; i++) v[i] = clamp(v[i] * (0.85 + n[i] * 0.3), 0, 1);
  } else if (id === 'finenoise') {
    for (let i = 0; i < v.length; i++) v[i] = clamp(0.3 + rnd() * 0.7, 0, 1);
  } else if (id === 'laid') { // pastel paper: fine horizontal ribs, a chain line every 64 px
    const n = latticeNoise(N, N, 32, 32, 101);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, rib = 0.5 + 0.5 * Math.cos(y * Math.PI * 2 / 4), dc = Math.min(x % 64, 64 - x % 64), chain = Math.exp(-dc * dc / 3); v[i] = clamp(0.3 + 0.55 * rib * (0.75 + 0.5 * n[i]) - 0.15 * chain + (rnd() - 0.5) * 0.1, 0, 1); }
  } else if (id === 'drybrush') { // long broken streaks along the stroke direction (x)
    const a = latticeNoise(N, N, 4, 96, 111), b = latticeNoise(N, N, 16, 128, 112);
    for (let i = 0; i < v.length; i++) v[i] = clamp((a[i] * 0.6 + b[i] * 0.4 - 0.38) * 3.5, 0, 1);
  } else if (id === 'granulation') { // pigment settling in clusters of dark specks
    const a = latticeNoise(N, N, 16, 16, 121), b = latticeNoise(N, N, 64, 64, 122);
    for (let i = 0; i < v.length; i++) v[i] = clamp(0.55 + (rnd() < 0.35 * a[i] * b[i] + 0.04 ? 0.45 : -0.15) + (rnd() - 0.5) * 0.12, 0, 1);
  } else if (id === 'clouds') {
    const a = latticeNoise(N, N, 4, 4, 131), b = latticeNoise(N, N, 8, 8, 132), c = latticeNoise(N, N, 32, 32, 133);
    for (let i = 0; i < v.length; i++) v[i] = clamp((a[i] * 0.55 + b[i] * 0.3 + c[i] * 0.15 - 0.2) * 1.7, 0, 1);
  } else if (id === 'stipple') { // a dot every 8 px, jittered, of varying size: paint only on the dots
    v.fill(0.04);
    for (let gy = 0; gy < N; gy += 8) for (let gx = 0; gx < N; gx += 8) {
      const cx = gx + 4 + (rnd() - 0.5) * 4, cy = gy + 4 + (rnd() - 0.5) * 4, r = 1.2 + rnd() * 1.6;
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) { const d = Math.hypot(x - cx, y - cy), i = ((y % N + N) % N) * N + ((x % N + N) % N); v[i] = Math.max(v[i], clamp(r + 0.5 - d, 0, 1)); }
    }
  } else if (id === 'hatch') { // diagonal lines, 8 px apart, slightly broken
    const n = latticeNoise(N, N, 64, 64, 141);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = (x + y) % 8; v[y * N + x] = d < 3 ? clamp(0.7 + n[y * N + x] * 0.4, 0, 1) : 0.06; }
  } else if (id === 'burlap') { // coarse loose weave, 8 px threads
    const nx = latticeNoise(N, N, 32, 4, 151), ny = latticeNoise(N, N, 4, 32, 152);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, a = Math.max(0, Math.sin((x + nx[i] * 3) * Math.PI / 4)), b = Math.max(0, Math.sin((y + ny[i] * 3) * Math.PI / 4)); v[i] = clamp(0.08 + 0.85 * Math.max(a, b) * (0.8 + rnd() * 0.3), 0, 1); }
  } else if (id === 'concrete') { // rough stone with small pits
    const a = latticeNoise(N, N, 32, 32, 161), b = latticeNoise(N, N, 128, 128, 162);
    for (let i = 0; i < v.length; i++) v[i] = clamp(0.35 + a[i] * 0.35 + b[i] * 0.25 + (rnd() - 0.5) * 0.2, 0, 1);
    for (let k = 0; k < 160; k++) { const cx = rnd() * N, cy = rnd() * N, r = 0.8 + rnd() * 2.2; for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) v[((y % N + N) % N) * N + ((x % N + N) % N)] = 0.05; }
  } else return null;
  return v;
}
/* pure: contrast / brightness (−100..100) / invert applied to texture values */
function texAdjust(v, contrast, bright, inv) {
  const k = Math.pow(2, (contrast || 0) / 50), b = (bright || 0) / 100, out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) { let x = inv ? 1 - v[i] : v[i]; x = (x - 0.5) * k + 0.5 + b; out[i] = clamp(x, 0, 1); }
  return out;
}
const texBuiltIn = id => !!id && !/^(tex_|__)/.test(id);
function texDerivedId(id, s) {
  if (!texBuiltIn(id) || !(s.texContrast || s.texBright || s.texInv)) return id;
  const key = `${id}~c${s.texContrast || 0}~b${s.texBright || 0}~${s.texInv ? 'i' : ''}`;
  if (!texBase.has(key)) {
    const v = texAdjust(texBaseFor(id)._vals, s.texContrast, s.texBright, s.texInv), N = TEX_N, c = makeCanvas(N, N), g = c.getContext('2d'), im = g.createImageData(N, N);
    for (let i = 0; i < v.length; i++) im.data[i * 4 + 3] = v[i] * 255;
    g.putImageData(im, 0, 0); c._vals = v; texBase.set(key, c);
  }
  return key;
}
/* a small picture of a texture (dark = paint) for Tool Property */
function texSwatch(id, s) {
  const N = TEX_N, src = texBaseFor(texDerivedId(id, s || {})), c = makeCanvas(150, 30), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 150, 30);
  const t = makeCanvas(N, N), tg = t.getContext('2d'), im = tg.createImageData(N, N), v = src._vals;
  for (let i = 0; i < v.length; i++) { const k = 255 - v[i] * 230; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = k; im.data[i * 4 + 3] = 255; }
  tg.putImageData(im, 0, 0);
  const pat = g.createPattern(t, 'repeat'), k = (s && s.texScale) || 1;
  if (pat.setTransform) pat.setTransform(new DOMMatrix().rotateSelf((s && s.texRot) || 0).scaleSelf(k * 0.5, k * 0.5));
  g.fillStyle = pat; g.fillRect(0, 0, 150, 30);
  return c;
}
function installTexPlus() {
  // the new textures
  const tb0 = texBaseFor; texBaseFor = function (id) {
    if (!texBase.has(id)) { const v = texMore(id, TEX_N); if (v) { const N = TEX_N, c = makeCanvas(N, N), g = c.getContext('2d'), im = g.createImageData(N, N); for (let i = 0; i < v.length; i++) im.data[i * 4 + 3] = v[i] * 255; g.putImageData(im, 0, 0); c._vals = v; texBase.set(id, c); return c; } }
    return tb0.apply(this, arguments);
  };
  for (const k of ['texInv', 'texBright', 'texContrast', 'texMode', 'texPress']) if (!BRUSH_KEYS.includes(k)) BRUSH_KEYS.push(k);
  // brush editor: the new textures and settings
  const at = BE_TEX.findIndex(x => x[0] === 'image'); BE_TEX.splice(at < 0 ? BE_TEX.length : at, 0, ...TEX_MORE);
  const sec = BE_FORM.find(x => x[0] === 'Texture');
  if (sec && !sec[1].some(f => f[0] === 'texMode')) sec[1].push(['texMode', 'Texture on', 'select', [['', 'The whole stroke'], ['dab', 'Each dab (stamp)']]], ['texPress', 'Press harder = less grain', 'range', 0, 1, 0.01, '%']);
  for (const k of ['texMode', 'texPress']) BE_MANAGED.add(k);
  // each stroke: its own copy of the settings gets the adjusted texture / the per-dab texture
  const pg0 = paperGrain; paperGrain = function (s) {
    const out = pg0.apply(this, arguments);
    if (s.tex) {
      s.tex = texDerivedId(s.tex, s);
      if (s.texMode === 'dab') { s.texDab = s.tex; s.texAmtDab = s.texAmt == null ? 0.6 : s.texAmt; delete s.tex; }
    }
    return out;
  };
  const d0 = drawOne; drawOne = function (st) {
    const s = st.s;
    if (!s.texDab) return d0.apply(this, arguments);
    const keep = s.tex, keepSt = st.tex; // a second texture (p10zbj) may be on the whole stroke meanwhile
    s.tex = s.texDab; st.tex = false; s.texAmt = s.texAmtDab * (1 - (s.texPress || 0) * clamp(st.lp ?? 0.5, 0, 1));
    try { return d0.apply(this, arguments); } finally { s.tex = keep; st.tex = keepSt; if (keep === undefined) delete s.tex; }
  };
  // Tool Property: the texture list, its picture and the new settings
  hookAfter('refreshProps', () => {
    if (kindOf(state.tool) !== 'brush') return;
    const body = $('#propBody'), s = settings[state.tool]; if (!body || !s) return;
    const sel = [...body.querySelectorAll('select')].find(x => [...x.options].some(o => o.value === 'charcoal')); if (!sel) return;
    const load = [...sel.options].find(o => o.value === '@load');
    for (const [v, t] of TEX_MORE) if (![...sel.options].some(o => o.value === v)) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.insertBefore(o, load || null); }
    sel.value = s.tex || '';
    if (!s.tex) return;
    // after the Scale slider
    const anchor = [...body.querySelectorAll('label.slider')].find(l => /^Scale/.test(l.textContent)) || sel.closest('label');
    const box = document.createElement('div'); box.className = 'texplus';
    const sw = document.createElement('div'); sw.className = 'texswatch'; box.appendChild(sw);
    const redraw = () => { sw.innerHTML = ''; try { sw.appendChild(texSwatch(s.tex, s)); } catch (e) { /* picture textures: no swatch */ } };
    slider(box, 'Rotation', 0, 360, 1, s.texRot || 0, v => v + '°', v => { s.texRot = v; redraw(); });
    if (texBuiltIn(s.tex)) {
      slider(box, 'Contrast', -100, 100, 1, s.texContrast || 0, v => String(v), v => { s.texContrast = v; redraw(); });
      slider(box, 'Brightness', -100, 100, 1, s.texBright || 0, v => String(v), v => { s.texBright = v; redraw(); });
      checkbox(box, 'Invert the texture', !!s.texInv, v => { s.texInv = v; redraw(); });
    }
    checkbox(box, 'On each dab (like a stamp / sponge)', s.texMode === 'dab', v => { s.texMode = v ? 'dab' : ''; refreshProps(); });
    slider(box, 'Press harder = less grain', 0, 100, 1, (s.texPress || 0) * 100, v => v + '%', v => { s.texPress = v / 100; }); // whole stroke: p10zbj
    anchor.after(box); redraw();
  }, 15);
}
