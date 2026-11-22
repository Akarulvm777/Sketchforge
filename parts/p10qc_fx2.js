/* ---------- More FX (Filter › More effects) ----------
   All go through effectDialog (live preview on the layer, OK = one undo step, Cancel restores). Each FX2 function
   takes a copy of the layer (canvas) and its settings and returns the result canvas. Colour: hue / saturation /
   brightness (+ colourise), brightness & contrast, duotone. Light: light leak, lens flare, neon edges.
   Styles: pixel art, cartoon (cel look), pencil sketch, old film, VHS scanlines. The pixel maths are pure functions
   on RGBA arrays (fx2Hsb, fx2Contrast, fx2Duotone, fx2Posterize, fx2Sobel) so they can be tested. */
const fx2Rgb = hex => { const n = parseInt(String(hex).replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function fx2Lum(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }
/* hue shift (degrees), saturation and brightness (−100..100), or colourise with one hue (pure, in place) */
function fx2Hsb(d, hue, sat, bri, colorize) {
  const hs = hue / 60, s1 = 1 + sat / 100, b1 = bri / 100;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, c = mx - mn;
    let h = 0, s = 0;
    if (c) { s = c / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; }
    if (colorize) { h = hs; s = clamp(0.25 * s1, 0, 1); } else { h = (h + hs) % 6; if (h < 0) h += 6; s = clamp(s * s1, 0, 1); }
    let L = clamp(l + b1 * (b1 > 0 ? 1 - l : l), 0, 1);
    const C = (1 - Math.abs(2 * L - 1)) * s, X = C * (1 - Math.abs(h % 2 - 1)), m = L - C / 2;
    const [rr, gg, bb] = h < 1 ? [C, X, 0] : h < 2 ? [X, C, 0] : h < 3 ? [0, C, X] : h < 4 ? [0, X, C] : h < 5 ? [X, 0, C] : [C, 0, X];
    d[i] = (rr + m) * 255; d[i + 1] = (gg + m) * 255; d[i + 2] = (bb + m) * 255;
  }
  return d;
}
function fx2Contrast(d, bri, con) { const k = (259 * (con + 255)) / (255 * (259 - con)); for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) d[i + j] = k * (d[i + j] + bri - 128) + 128; return d; }
function fx2Duotone(d, dark, light, mix) { const A = fx2Rgb(dark), B = fx2Rgb(light), m = mix / 100; for (let i = 0; i < d.length; i += 4) { const t = fx2Lum(d[i], d[i + 1], d[i + 2]) / 255; for (let j = 0; j < 3; j++) d[i + j] = d[i + j] * (1 - m) + (A[j] + (B[j] - A[j]) * t) * m; } return d; }
function fx2Posterize(d, n) { const k = 255 / (n - 1); for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) d[i + j] = Math.round(d[i + j] / k) * k; return d; }
/* edge strength 0..255 per pixel (Sobel on brightness × alpha) (pure) */
function fx2Sobel(d, w, h) {
  const L = new Float32Array(w * h), E = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) L[i] = fx2Lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) * d[i * 4 + 3] / 255 + (255 - d[i * 4 + 3]) * 0.5;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, gx = -L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1] + L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1], gy = -L[i - w - 1] - 2 * L[i - w] - L[i - w + 1] + L[i + w - 1] + 2 * L[i + w] + L[i + w + 1];
    E[i] = Math.min(255, Math.hypot(gx, gy) / 4);
  }
  return E;
}
const fx2Canvas = src => { const c = makeCanvas(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0); return c; };
const fx2Map = (src, fn) => { const c = fx2Canvas(src), g = c.getContext('2d'), im = g.getImageData(0, 0, c.width, c.height); fn(im.data, c.width, c.height); g.putImageData(im, 0, 0); return c; };
function fx2Blur(src, px) {
  const c = makeCanvas(src.width, src.height), g = c.getContext('2d');
  if (typeof g.filter === 'string') { g.filter = `blur(${px}px)`; g.drawImage(src, 0, 0); return c; }
  g.drawImage(src, 0, 0); if (typeof gaussianBlur === 'function') gaussianBlur(c, px); return c;
}
const FX2 = {
  hsb: (s, p) => fx2Map(s, d => fx2Hsb(d, p.hue, p.sat, p.bri, p.colorize)),
  contrast: (s, p) => fx2Map(s, d => fx2Contrast(d, p.bri, p.con)),
  duotone: (s, p) => fx2Map(s, d => fx2Duotone(d, p.dark, p.light, p.mix)),
  lightleak(s, p) {
    const c = fx2Canvas(s), g = c.getContext('2d'), w = c.width, h = c.height, [r, gg, b] = fx2Rgb(p.color);
    const pts = [[p.x / 100 * w, p.y / 100 * h, Math.max(w, h) * p.size / 100], [w - p.x / 100 * w * 0.6, h * 0.85, Math.max(w, h) * p.size / 160]];
    g.save(); g.globalCompositeOperation = 'source-atop';
    for (const [x, y, R] of pts) { const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${r},${gg},${b},${p.amount / 100})`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    g.restore(); g.globalCompositeOperation = 'destination-in'; g.drawImage(s, 0, 0); return c;
  },
  flare(s, p) {
    const c = fx2Canvas(s), g = c.getContext('2d'), w = c.width, h = c.height, x = p.x / 100 * w, y = p.y / 100 * h, R = Math.max(w, h) * p.size / 100, k = p.amount / 100;
    g.save(); g.globalCompositeOperation = 'screen';
    const glow = (cx, cy, rr, col, a) => { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.35, `rgba(${col},${a * 0.35})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); };
    glow(x, y, R, '255,250,230', 0.95 * k);
    const dx = w / 2 - x, dy = h / 2 - y;
    [[0.5, 0.18, '120,200,255'], [0.9, 0.1, '255,160,90'], [1.3, 0.22, '160,255,180'], [1.7, 0.08, '255,120,200']].forEach(([t, rr, col]) => glow(x + dx * t * 2, y + dy * t * 2, R * rr, col, 0.45 * k));
    g.strokeStyle = `rgba(255,255,240,${0.5 * k})`; g.lineWidth = Math.max(1, R * 0.01);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(x - Math.cos(a) * R * 1.2, y - Math.sin(a) * R * 1.2); g.lineTo(x + Math.cos(a) * R * 1.2, y + Math.sin(a) * R * 1.2); g.stroke(); }
    g.restore(); g.globalCompositeOperation = 'destination-in'; g.drawImage(s, 0, 0); return c;
  },
  neon(s, p) {
    const w = s.width, h = s.height, sd = s.getContext('2d').getImageData(0, 0, w, h).data, E = fx2Sobel(sd, w, h), [r, gg, b] = fx2Rgb(p.color);
    const e = makeCanvas(w, h), eg = e.getContext('2d'), im = eg.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = E[i] > p.threshold ? 255 : 0; im.data[i * 4] = r; im.data[i * 4 + 1] = gg; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = v; }
    eg.putImageData(im, 0, 0);
    const out = makeCanvas(w, h), og = out.getContext('2d');
    if (p.keep) { og.globalAlpha = p.dim / 100; og.drawImage(s, 0, 0); og.globalAlpha = 1; }
    og.globalCompositeOperation = 'lighter'; og.drawImage(fx2Blur(e, p.glow), 0, 0); og.drawImage(fx2Blur(e, p.glow / 3), 0, 0); og.drawImage(e, 0, 0);
    return out;
  },
  pixel(s, p) {
    const w = s.width, h = s.height, k = Math.max(2, p.size), sw = Math.max(1, Math.round(w / k)), sh = Math.max(1, Math.round(h / k));
    const sm = makeCanvas(sw, sh), sg = sm.getContext('2d'); sg.imageSmoothingEnabled = true; sg.drawImage(s, 0, 0, sw, sh);
    const im = sg.getImageData(0, 0, sw, sh); fx2Posterize(im.data, p.colors); for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] > 100 ? 255 : 0; sg.putImageData(im, 0, 0);
    const out = makeCanvas(w, h), og = out.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(sm, 0, 0, w, h); return out;
  },
  cartoon(s, p) {
    const w = s.width, h = s.height, sm = fx2Blur(s, p.smooth), d0 = s.getContext('2d').getImageData(0, 0, w, h).data;
    const c = fx2Map(sm, d => fx2Posterize(d, p.levels)), g = c.getContext('2d'), im = g.getImageData(0, 0, w, h), E = fx2Sobel(d0, w, h);
    for (let i = 0; i < w * h; i++) { if (E[i] > p.lines) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 20; } im.data[i * 4 + 3] = d0[i * 4 + 3]; }
    g.putImageData(im, 0, 0); return c;
  },
  sketch(s, p) {
    const w = s.width, h = s.height, d0 = s.getContext('2d').getImageData(0, 0, w, h).data;
    // colour dodge of the grey picture with its blurred negative = pencil lines
    const grey = fx2Map(s, d => { for (let i = 0; i < d.length; i += 4) { const v = fx2Lum(d[i], d[i + 1], d[i + 2]) * d[i + 3] / 255 + 255 - d[i + 3]; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } });
    const inv = fx2Map(grey, d => { for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) d[i + j] = 255 - d[i + j]; }), bl = fx2Blur(inv, p.width);
    const gd = grey.getContext('2d').getImageData(0, 0, w, h), bd = bl.getContext('2d').getImageData(0, 0, w, h).data, D = gd.data, k = p.dark / 50;
    for (let i = 0; i < D.length; i += 4) { const v = Math.min(255, D[i] * 255 / Math.max(1, 255 - bd[i])), out = 255 - (255 - v) * k; D[i] = D[i + 1] = D[i + 2] = clamp(out, 0, 255); D[i + 3] = p.paper ? 255 : Math.min(255, (255 - D[i]) * 2) * d0[i + 3] / 255; }
    grey.getContext('2d').putImageData(gd, 0, 0); return grey;
  },
  oldfilm(s, p) {
    const c = fx2Map(s, (d, w, h) => { let seed = 13; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
      for (let i = 0; i < d.length; i += 4) { const l = fx2Lum(d[i], d[i + 1], d[i + 2]), n = (rnd() - 0.5) * p.grain * 1.4; d[i] = l * 1.07 + 18 + n; d[i + 1] = l * 0.95 + 8 + n; d[i + 2] = l * 0.78 + n; }
      const lines = Math.round(p.scratches / 10); for (let k = 0; k < lines; k++) { const x = Math.floor(rnd() * w), a = 0.3 + rnd() * 0.4; for (let y = 0; y < h; y++) { const i = (y * w + x) * 4; d[i] = d[i] * (1 - a) + 230 * a; d[i + 1] = d[i + 1] * (1 - a) + 220 * a; d[i + 2] = d[i + 2] * (1 - a) + 200 * a; } } });
    const g = c.getContext('2d'), w = c.width, h = c.height, gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    gr.addColorStop(0, 'rgba(40,25,10,0)'); gr.addColorStop(1, `rgba(40,25,10,${p.vignette / 100})`); g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, w, h); return c;
  },
  vhs(s, p) {
    const w = s.width, h = s.height, out = makeCanvas(w, h), og = out.getContext('2d'), sh = p.shift;
    og.drawImage(s, 0, 0);
    const split = (col, dx) => { const t = makeCanvas(w, h), tg = t.getContext('2d'); tg.drawImage(s, dx, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, w, h); og.globalCompositeOperation = 'screen'; og.globalAlpha = 0.6; og.drawImage(t, 0, 0); og.globalAlpha = 1; };
    split('#ff0040', -sh); split('#00e0ff', sh);
    og.globalCompositeOperation = 'source-atop'; og.fillStyle = `rgba(0,0,0,${p.lines / 100})`;
    for (let y = 0; y < h; y += p.gap) og.fillRect(0, y, w, Math.max(1, p.gap / 2));
    og.globalCompositeOperation = 'destination-in'; og.drawImage(s, 0, 0); return out;
  }
};
function installFx2() {
  const E = (title, fields, fn) => () => effectDialog(title, fields, fn);
  Object.assign(CMD, {
    fxHsb: E('Hue / saturation / brightness', [{ k: 'hue', label: 'Hue', min: -180, max: 180, val: 0 }, { k: 'sat', label: 'Saturation', min: -100, max: 100, val: 0 }, { k: 'bri', label: 'Brightness', min: -100, max: 100, val: 0 }, { k: 'colorize', label: 'Colourise (one colour)', type: 'check', val: false }], FX2.hsb),
    fxContrast: E('Brightness & contrast', [{ k: 'bri', label: 'Brightness', min: -100, max: 100, val: 0 }, { k: 'con', label: 'Contrast', min: -100, max: 100, val: 20 }], FX2.contrast),
    fxDuotone: E('Duotone', [{ k: 'dark', label: 'Shadows', type: 'color', val: '#1d1b4a' }, { k: 'light', label: 'Lights', type: 'color', val: '#ffb37a' }, { k: 'mix', label: 'Amount', min: 10, max: 100, val: 100 }], FX2.duotone),
    fxLightLeak: E('Light leak', [{ k: 'color', label: 'Colour', type: 'color', val: '#ff8a3d' }, { k: 'amount', label: 'Strength', min: 10, max: 100, val: 60 }, { k: 'size', label: 'Size', min: 10, max: 120, val: 55 }, { k: 'x', label: 'Position X %', min: 0, max: 100, val: 10 }, { k: 'y', label: 'Position Y %', min: 0, max: 100, val: 15 }], FX2.lightleak),
    fxFlare: E('Lens flare', [{ k: 'x', label: 'Light X %', min: 0, max: 100, val: 22 }, { k: 'y', label: 'Light Y %', min: 0, max: 100, val: 20 }, { k: 'size', label: 'Size', min: 5, max: 80, val: 25 }, { k: 'amount', label: 'Strength', min: 10, max: 100, val: 80 }], FX2.flare),
    fxNeon: E('Neon edges', [{ k: 'color', label: 'Colour', type: 'color', val: '#38d6ff' }, { k: 'threshold', label: 'Edges from', min: 5, max: 120, val: 30 }, { k: 'glow', label: 'Glow', min: 1, max: 40, val: 10 }, { k: 'keep', label: 'Keep the picture under it', type: 'check', val: true }, { k: 'dim', label: 'Picture brightness', min: 0, max: 100, val: 35 }], FX2.neon),
    fxPixel: E('Pixel art', [{ k: 'size', label: 'Pixel size', min: 2, max: 40, val: 8 }, { k: 'colors', label: 'Colours per channel', min: 2, max: 16, val: 6 }], FX2.pixel),
    fxCartoon: E('Cartoon (cel look)', [{ k: 'levels', label: 'Colour steps', min: 2, max: 10, val: 4 }, { k: 'smooth', label: 'Smoothing', min: 0, max: 12, val: 3 }, { k: 'lines', label: 'Outlines from', min: 10, max: 160, val: 60 }], FX2.cartoon),
    fxSketch: E('Pencil sketch', [{ k: 'width', label: 'Line width', min: 1, max: 30, val: 6 }, { k: 'dark', label: 'Darkness', min: 10, max: 100, val: 60 }, { k: 'paper', label: 'White paper behind', type: 'check', val: false }], FX2.sketch),
    fxOldFilm: E('Old film', [{ k: 'grain', label: 'Grain', min: 0, max: 100, val: 40 }, { k: 'scratches', label: 'Scratches', min: 0, max: 100, val: 30 }, { k: 'vignette', label: 'Dark corners', min: 0, max: 100, val: 55 }], FX2.oldfilm),
    fxVhs: E('VHS / scanlines', [{ k: 'shift', label: 'Colour shift', min: 0, max: 30, val: 6 }, { k: 'lines', label: 'Scanlines', min: 0, max: 80, val: 30 }, { k: 'gap', label: 'Line gap', min: 2, max: 12, val: 4 }], FX2.vhs)
  });
  const F = MENUS.find(m => m[0] === 'Filter'); if (!F) return;
  F[1].push('-', ['🎨 Hue / saturation / brightness…', 'fxHsb'], ['Brightness & contrast…', 'fxContrast'], ['Duotone…', 'fxDuotone'],
    '-', ['☀ Light leak…', 'fxLightLeak'], ['Lens flare…', 'fxFlare'], ['Neon edges…', 'fxNeon'],
    '-', ['Pixel art…', 'fxPixel'], ['Cartoon (cel look)…', 'fxCartoon'], ['Pencil sketch…', 'fxSketch'], ['Old film…', 'fxOldFilm'], ['VHS / scanlines…', 'fxVhs']);
}
