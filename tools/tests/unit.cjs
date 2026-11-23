// Unit tests: small, fast checks of the app's pure functions (maths, file formats, shape recognition, blending…).
// They run inside the real app in a headless browser, so they test exactly the code that ships.
//   node tools/tests/unit.cjs            (part of `npm test`)
// Each test is a function run in the page; it returns true, or a string / object describing what went wrong.
const H = require('../e2e/harness.cjs');
const path = require('path');

const TESTS = {
  'clamp and colour helpers': () => clamp(5, 0, 3) === 3 && clamp(-1, 0, 3) === 0 && hexToRgb('#ff8000').join() === '255,128,0' && rgbToHex(255, 128, 0) === '#ff8000',

  'blend formulas (custom modes)': () => {
    const n = v => Math.round(v * 1000) / 1000, F = BLEND_FN, bad = [];
    const cases = [['linear-burn', 0.6, 0.7, 0.3], ['linear-burn', 0.2, 0.3, 0], ['subtract', 0.8, 0.3, 0.5], ['subtract', 0.2, 0.5, 0],
      ['add', 0.5, 0.3, 0.8], ['add', 0.8, 0.5, 1], ['linear-light', 0.5, 0.75, 1], ['linear-light', 0.5, 0.25, 0],
      ['pin-light', 0.8, 0.2, 0.4], ['pin-light', 0.2, 0.8, 0.6], ['hard-mix', 0.6, 0.5, 1], ['hard-mix', 0.4, 0.5, 0],
      ['divide', 0.5, 1, 0.5], ['divide', 0.25, 0.5, 0.5], ['divide', 0.5, 0, 1], ['divide', 0, 0, 0], ['glow-dodge', 0.5, 0, 0.5]];
    for (const [m, b, s, want] of cases) if (n(F[m](b, s)) !== want) bad.push(`${m}(${b}, ${s}) = ${n(F[m](b, s))}, want ${want}`);
    return bad.length ? bad : true;
  },

  'blend mode list: 28 modes, each named and drawable': () => {
    const bad = BLENDS.filter(b => !BLEND_LABEL[b] || (isCustomBlend(b) && !BLEND_FN[b] && b !== 'darker-color' && b !== 'lighter-color'));
    return BLENDS.length === 28 && BLENDS[0] === 'normal' && !bad.length ? true : { n: BLENDS.length, bad };
  },

  'screen preview uses the nearest native mode for custom modes': () => !isCustomBlend('multiply') && isCustomBlend('linear-burn') &&
    cssBlend('multiply') === 'multiply' && cssBlend('linear-burn') !== 'linear-burn' && cssBlend(undefined) === 'normal' && canvasBlend('add') === 'source-over',

  'blendCustom: Add of two half greys is white': () => {
    const a = makeCanvas(4, 4), b = makeCanvas(4, 4);
    for (const c of [a, b]) { const g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, 4, 4); }
    blendCustom(a.getContext('2d'), b, 'add');
    const d = a.getContext('2d').getImageData(1, 1, 1, 1).data;
    return d[0] >= 254 && d[3] === 255 ? true : [...d];
  },

  'pen pressure: dragged curve wins over sensitivity (pressureShape)': () => {
    const g = { min: 0, max: 1, gamma: 2 }, c = { min: 0, max: 1, gamma: 2, curve: [[0, 0], [0.5, 0.9], [1, 1]] };
    return Math.abs(pressureShape(0.5, g) - 0.25) < 1e-9 && Math.abs(pressureShape(0.5, c) - 0.9) < 1e-9 && pressureShape(0, c) === 0.01 && pressureShape(2, c) === 1;
  },
  'every drawing tool shows a sample preview (toolPreview)': () => {
    const skip = new Set(['hand', 'rotate', 'zoom']), miss = [];
    for (const g of GROUPS) for (const id of (g.subs || [])) if (!skip.has(id) && !(toolPreview(id) || kindOf(id) === 'brush' || TOOLDEF[id].stops)) miss.push(id);
    return miss.length ? 'no preview: ' + miss.join(', ') : true;
  },
  'import window percentages (impwPct)': () => impwPct(null) === 0 && impwPct('read') === 15 && impwPct('place') === 55 && impwPct('prev') === 100,
  'pressure curve (prCurve)': () => {
    const c = [[0, 0.2], [0.5, 0.4], [1, 1]];
    return prCurve(c, 0) === 0.2 && Math.abs(prCurve(c, 0.25) - 0.3) < 1e-9 && Math.abs(prCurve(c, 0.75) - 0.7) < 1e-9 && prCurve(c, 2) === 1 && prCurve(null, 0.3) === 0.3;
  },

  'keyframes: keyAt / nextKey': () => {
    const l = { cels: new Map([[0, 1], [4, 1], [9, 1]]) };
    return keyAt(l, 0) === 0 && keyAt(l, 3) === 0 && keyAt(l, 4) === 4 && keyAt(l, 20) === 9 && nextKey(l, 4) === 9 && nextKey(l, 9) === null && keyAt({ cels: new Map() }, 2) === null;
  },

  'matrices: inverse undoes the transform': () => {
    const m = [Math.cos(0.5) * 2, Math.sin(0.5) * 2, -Math.sin(0.5) * 2, Math.cos(0.5) * 2, 30, -12], [x, y] = applyMat(m, 7, 11), [a, b] = applyMat(invMat(m), x, y);
    return Math.abs(a - 7) < 1e-9 && Math.abs(b - 11) < 1e-9 && invMat([0, 0, 0, 0, 1, 1]) === null;
  },

  'CRC-32 (zip export)': () => crc32(new TextEncoder().encode('123456789')) === 0xCBF43926,

  'zip export: files with their names': async () => {
    const z = makeZip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }]), u = new Uint8Array(await z.arrayBuffer());
    const s = new TextDecoder().decode(u);
    return u[0] === 0x50 && u[1] === 0x4b && s.includes('a.txt') && s.includes('hello') ? true : { len: u.length, head: [...u.slice(0, 4)] };
  },

  'Clip Studio gradient (parseGradation)': () => {
    const rec = (r, g, b, a, pos) => { const o = new Uint8Array(28), dv = new DataView(o.buffer); o[0] = r; o[4] = g; o[8] = b; o[12] = a; dv.setUint32(20, pos); return o; };
    const head = new Uint8Array(12), dv = new DataView(head.buffer); dv.setUint32(0, 12); dv.setUint32(4, 28); dv.setUint32(8, 2);
    const blob = new Uint8Array([...head, ...rec(0, 0, 255, 255, 0x8000), ...rec(255, 0, 0, 128, 0)]);
    const st = parseGradation(blob);
    return st && st.length === 2 && st[0][0] === 0 && /rgba\(255,0,0,0\.50/.test(st[0][1]) && st[1][1] === '#0000ff' ? true : st;
  },

  'Clip Studio pressure settings (sutEffector)': () => {
    const b = new Uint8Array(16 + 12 + 2 * 16), dv = new DataView(b.buffer);
    dv.setUint32(8, 16); dv.setUint32(12, 30); dv.setUint32(16, 12); dv.setUint32(20, 2); dv.setUint32(24, 16);
    dv.setFloat64(28, 0); dv.setFloat64(36, 0.1); dv.setFloat64(44, 1); dv.setFloat64(52, 0.9);
    const o = sutEffector(b);
    return o.bits === 16 && Math.abs(o.min - 0.3) < 1e-9 && o.curve && o.curve[0][1] === 0.1 && o.curve[1][1] === 0.9 ? true : o;
  },

  'tar reader (Clip Studio materials)': () => {
    const enc = new TextEncoder(), h = new Uint8Array(512); h.set(enc.encode('thumbnail/thumbnail.png')); h.set(enc.encode('00000000003\0'), 124);
    const data = new Uint8Array(512); data.set([7, 8, 9]);
    const t = untar(new Uint8Array([...h, ...data, ...new Uint8Array(1024)]));
    const f = t['thumbnail/thumbnail.png'];
    return f && f.length === 3 && f[2] === 9 ? true : Object.keys(t);
  },

  'QuickShape recognises a line and a circle': () => {
    const line = [], circ = [];
    for (let i = 0; i <= 40; i++) line.push([10 + i * 5, 20 + i * 2 + (i % 2) * 0.6]);
    for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 2; circ.push([200 + Math.cos(a) * 60, 200 + Math.sin(a) * 60]); }
    const a = recognizeShape(line), b = recognizeShape(circ);
    return a && a.type === 'line' && b && b.type === 'ellipse' ? true : [a && a.type, b && b.type];
  },

  'TIFF reader: uncompressed RGB': async () => {
    // 2×1 pixels: red, blue; little-endian, one strip
    const tags = [[256, 3, 1, 2], [257, 3, 1, 1], [258, 3, 1, 8], [259, 3, 1, 1], [262, 3, 1, 2], [273, 4, 1, 0], [277, 3, 1, 3], [278, 3, 1, 1], [279, 4, 1, 6]];
    const ifd = 8, dataOff = ifd + 2 + tags.length * 12 + 4, buf = new ArrayBuffer(dataOff + 6), dv = new DataView(buf);
    dv.setUint16(0, 0x4949); dv.setUint16(2, 42, true); dv.setUint32(4, ifd, true); dv.setUint16(ifd, tags.length, true);
    tags.forEach(([tag, type, cnt, val], i) => { const e = ifd + 2 + i * 12; dv.setUint16(e, tag, true); dv.setUint16(e + 2, type, true); dv.setUint32(e + 4, cnt, true); if (tag === 273) val = dataOff; if (type === 3) dv.setUint16(e + 8, val, true); else dv.setUint32(e + 8, val, true); });
    new Uint8Array(buf, dataOff).set([255, 0, 0, 0, 0, 255]);
    const c = await readTIFF(buf), d = c.getContext('2d').getImageData(0, 0, 2, 1).data;
    return c.width === 2 && d[0] === 255 && d[2] === 0 && d[6] === 255 ? true : [c.width, ...d];
  },

  'face sliders: easing and in-between values': () => {
    const l = { faceParts: [{ id: 'm', kind: 'mouth', name: 'm', x: 0, y: 0, w: 4, h: 4 }], cels: new Map() };
    return faceEase(0) === 0 && faceEase(1) === 1 && faceEase(0.5) === 0.5 && faceVal({ _face: { v: { m: 0.7 } } }, l.faceParts[0]) === 0.7 &&
      faceVal(null, l.faceParts[0]) === 0 && faceVal(null, { id: 'e', kind: 'eye' }) === 1;
  },

  'face sliders: closing an eye drawn on skin leaves no hole': () => {
    const c = makeCel(true), g = c.getContext('2d');
    g.fillStyle = '#f0d0b0'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.ellipse(60, 60, 20, 12, 0, 0, 7); g.fill(); g.stroke();
    const l = { faceParts: [{ id: 'e', kind: 'eye', name: 'e', x: 36, y: 44, w: 48, h: 32 }], cels: new Map() };
    const k = makeCel(true); k._face = { rest: c, v: { e: 0 } }; faceRender(l, k);
    const d = k.getContext('2d').getImageData(36, 44, 48, 32).data; let holes = 0, white = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 250) holes++; if (d[i] > 245 && d[i + 1] > 245) white++; if (d[i] < 60) dark++; }
    return !holes && white < 10 && dark > 20 ? true : { holes, white, dark };
  },

  'undo step keeps one copy and swaps it back and forth': () => {
    const cel = makeCanvas(10, 10), ctx = cel.getContext('2d'), t = { cel, ctx, layer: { cels: new Map() }, created: false, key: 0, frame: 0 }, b = { x: 0, y: 0, w: 10, h: 10 };
    ctx.fillStyle = '#f00'; ctx.fillRect(0, 0, 10, 10); const before = crop(cel, b);
    ctx.fillStyle = '#00f'; ctx.fillRect(0, 0, 10, 10);
    const e = celEntry(t, b, before, crop(cel, b)), px = () => [...ctx.getImageData(5, 5, 1, 1).data].slice(0, 3).join();
    e.undo(); const u = px(); e.redo(); const r = px(); e.undo(); const u2 = px();
    return u === '255,0,0' && r === '0,0,255' && u2 === '255,0,0' && e.bytes === 400 ? true : { u, r, u2, bytes: e.bytes };
  },

  'undo history stays within its memory budget': () => {
    const keep = history.undo.slice(), keepR = history.redo.slice();
    history.undo.length = 0; history.redo.length = 0;
    for (let i = 0; i < 30; i++) pushHistory({ bytes: HISTORY_BYTES / 4, undo() {}, redo() {} });
    const n = history.undo.length, total = historyBytes();
    history.undo.length = 0; history.undo.push(...keep); history.redo.push(...keepR);
    return n === 4 && total <= HISTORY_BYTES ? true : { n, total, budget: HISTORY_BYTES };
  },

  'helper canvases are 1×1 while unused': () => {
    const sizes = [onionCanvas, antsCanvas, snapCanvas, rawCanvas, tmpCanvas].map(c => c.width * c.height);
    docSize(tmpCanvas, true); const big = tmpCanvas.width === state.w && tmpCanvas.height === state.h; docSize(tmpCanvas, false);
    return big && tmpCanvas.width === 1 && sizes.every(n => n <= 1 || n === state.w * state.h) ? true : { sizes, big };
  },

  'stroke quality changes the dab distance (mixing tools stay sparse)': () => {
    const m = QUALITY.mode, r = [];
    for (const q of ['fast', 'normal', 'best']) { QUALITY.mode = q; r.push(qualityStep(10, false), qualityStep(10, true)); }
    QUALITY.mode = m;
    return r[0] > r[2] && r[2] > r[4] && r[1] === 10 && r[3] === 10 && r[5] >= 8 ? true : r;
  },

  'quick setup sets only its keys and copies curves': () => {
    const s = { size: 33, tipId: 'x' }, p = ADV_PRESETS[0][1]; advApplyPreset(s, p);
    return s.size === 33 && s.tipId === 'x' && s.hardness === 1 && s.pCurve !== p.pCurve && s.pCurve[1][0] === p.pCurve[1][0];
  },

  'a new file starts with its paper locked': () => {
    newDocument(64, 64, 1, 12, false, 'u'); const p = state.layers.find(l => l.paper);
    return !!(p && p.locked);
  },

  'hair & cloth chain: still on frame 0, lags when the part moves, keeps bone lengths': () => {
    const pts = [[0, 0], [0, 40], [0, 80]], mats = [];
    for (let f = 0; f < 20; f++) mats.push([1, 0, 0, 1, Math.min(f, 5) * 20, 0]);
    const s = chainSolve(pts, mats, { stiff: 0.3, bounce: 0.5, grav: 0.5 });
    const len = Math.hypot(s[3][2][0] - s[3][1][0], s[3][2][1] - s[3][1][1]);
    return s[0][2][0] === 0 && s[3][2][0] < -5 && s[3][0][0] === 0 && Math.abs(len - 40) < 1 ? true : { f0: s[0][2], f3: s[3], len };
  },

  'hair & cloth chain: mix 0 = as drawn, inertia 0 = no lag, old settings still read': () => {
    const pts = [[0, 0], [0, 40], [0, 80]], mats = []; for (let f = 0; f < 10; f++) mats.push([1, 0, 0, 1, f * 20, 0]);
    const m0 = chainSolve(pts, mats, { mix: 0 })[5][2], i0 = chainSolve(pts, mats, { inertia: 0, gravity: 0 })[5][2], old = chainParams({ stiff: 0.7, bounce: 0.2, grav: 0.1 });
    return m0[0] === 0 && Math.abs(i0[0]) < 1 && old.strength === 0.7 && Math.abs(old.damping - 0.8) < 1e-9 && old.gravity === 0.1 ? true : { m0, i0, old };
  },

  'chain pose: a turned bone moves the bones after it, keys ease in between, lengths kept': () => {
    const pts = [[0, 0], [0, 10], [0, 20]], poses = [[0, [0, 0]], [10, [90, 0]]];
    const a = chainPosed(pts, poses, 10), m = chainPosed(pts, poses, 5), h = chainPosed(pts, poses, 30);
    const ok = Math.abs(a[1][0] + 10) < 1e-6 && Math.abs(a[2][0] + 20) < 1e-6 && Math.abs(Math.hypot(m[2][0] - m[1][0], m[2][1] - m[1][1]) - 10) < 1e-6 && m[2][0] < 0 && m[2][0] > -20 && h[2][0] === a[2][0];
    return ok ? true : { a, m, h };
  },

  'auto-save: only with changes, when quiet, not busy, after the minutes': () => {
    const b = { on: true, dirty: true, busy: false, quiet: true, now: 10 * 60000, last: 4 * 60000, min: 5 };
    return autoSaveDue(b) && !autoSaveDue({ ...b, dirty: false }) && !autoSaveDue({ ...b, quiet: false }) && !autoSaveDue({ ...b, busy: true }) && !autoSaveDue({ ...b, last: 6 * 60000 }) && !autoSaveDue({ ...b, on: false });
  },

  'start screen and pages panel: when they show, recent list order': () => {
    let l = []; for (const n of ['a', 'b', 'a', 'c']) l = recentMerge(l, { name: n }, 3);
    return hubShouldShow(null, true) && !hubShouldShow(null, false) && hubShouldShow('on', false) && !hubShouldShow('off', true)
      && l.map(e => e.name).join() === 'c,a,b' && pagesPanelWanted('auto', 'comic') && !pagesPanelWanted('off', 'comic') && !pagesPanelWanted('auto', 'illust');
  },

  'tool tuner: same strokes look the same, a missing half looks different, mixing tools are not tuned': () => {
    const w = 60, h = 12, A = new Uint8ClampedArray(w * h * 4), B = new Uint8ClampedArray(w * h * 4);
    for (let i = 3; i < A.length; i += 4) { A[i] = 255; B[i] = (i >> 2) % w < w / 2 ? 255 : 0; }
    const mix = tuneTool({ size: 10, smudge: 0.5, paint: 0.5 });
    return tuneDiffData(A, A, w, h) === 0 && tuneDiffData(A, B, w, h) > 0.4 && !Object.keys(mix.perf).length;
  },

  'mixing brushes paint on a copy in memory: read once, written back on flush': () => {
    const c = makeCanvas(300, 300), g = c.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 300, 300);
    let reads = 0; const gi = g.getImageData.bind(g); g.getImageData = (...a) => { reads++; return gi(...a); };
    const st = { t: { ctx: g, cel: c } };
    for (let k = 0; k < 20; k++) { const im = mirGet(st, 100 + k, 100, 20, 20); for (let i = 0; i < im.data.length; i += 4) im.data[i + 1] = 255; mirCopy(st, im, 100 + k, 100, true); }
    cancelAnimationFrame(st.mirRaf); mirFlush(st);
    const px = gi(110, 110, 1, 1).data;
    return reads <= 4 && px[0] === 255 && px[1] === 255 ? true : { reads, px: [...px] };
  },

  'smart fill: a gap in a circle leaks without "close gaps" and is sealed with it; auto-flat finds each area': () => {
    const w = 60, h = 60, data = new Uint8ClampedArray(w * h * 4), line = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 0;
    // a ring (radius 20, 2 px thick) with a 3 px gap on the right, and a line splitting the inside in two
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - 30, y - 30), gapHere = x > 46 && Math.abs(y - 30) <= 1;
      if ((d >= 19 && d <= 21 && !gapHere) || (x === 30 && d < 20)) { const i = y * w + x; line[i] = 1; data[i * 4 + 3] = 255; } }
    const g0 = state.fillGap; state.fillGap = 0; const plain = floodMask(data, w, h, 40, 30, 10); state.fillGap = g0; const sealed = floodGapMask(data, w, h, 40, 30, 10, 4);
    const leaked = plain.mask[2 * w + 2] === 1, inside = sealed && sealed.mask[30 * w + 40] === 1 && sealed.mask[2 * w + 2] === 0 && sealed.mask[30 * w + 22] === 0;
    const flats = flatLabels(line, w, h, 4, 10, true, 1), L = flats.labels;
    const two = L[30 * w + 22] > 0 && L[30 * w + 40] > 0 && L[30 * w + 22] !== L[30 * w + 40] && L[2 * w + 2] === 0;
    return leaked && inside && two ? true : { leaked, inside, two, a: L[30 * w + 22], b: L[30 * w + 40], out: L[2 * w + 2] };
  },

  'vector lines: crossings, erase to the crossing, slice, soft bend': () => {
    const h = { s: { size: 4 }, color: '#000', pts: [[0, 50, 1], [100, 50, 1]] }, v1 = { pts: [[30, 0, 1], [30, 100, 1]] }, v2 = { pts: [[70, 0, 1], [70, 100, 1]] };
    const xs = polyCross(h.pts, v1.pts), mid = vecErasePieces(h, [v1, v2], 50, 'cross'), whole = vecErasePieces(h, [v1, v2], 50, 'whole');
    const sl = polySlice(h.pts, 25, 75), bent = vecBend([[0, 0, 1], [50, 0, 1], [100, 0, 1]], 50, 0, 10, 40);
    const ok = Math.abs(xs[0] - 30) < 1e-6 && mid.length === 2 && Math.abs(mid[0].pts[1][0] - 30) < 1e-6 && Math.abs(mid[1].pts[0][0] - 70) < 1e-6 && whole.length === 0
      && Math.abs(sl[0][0] - 25) < 1e-6 && Math.abs(sl[sl.length - 1][0] - 75) < 1e-6 && bent[1][1] === 10 && bent[0][1] === 0;
    return ok ? true : { xs, mid: mid.map(m => m.pts), sl, bent };
  },

  'lip-sync: loudness per frame, mouths held at least 2 frames': () => {
    const peaks = Array.from({ length: 100 }, (_, i) => (i >= 40 && i < 60 ? 1 : i >= 20 && i < 40 ? 0.3 : 0.01));
    const loud = frameLoudness(peaks, 1, 10, 10), lv = lipFrames(loud), flick = lipFrames([0, 1, 0, 0, 0], 0.12, 0.45, 2);
    return lv[0] === 0 && lv[2] === 1 && lv[4] === 2 && lv[5] === 2 && lv[8] === 0 && flick.every(v => v === 0) ? true : { loud, lv, flick };
  },

  'comic text: vertical columns right to left, balloon bigger than the text': () => {
    const v = textLayout(['ab', 'c'], 20, 'v', 1.25, 'left', s => s.length * 10), h = textLayout(['abc'], 20, 'h', 1.25, 'center', s => s.length * 10);
    const b = balloonAround(h.box, 'ellipse', 20);
    return v.items[1].y > v.items[0].y && v.items[2].x < v.items[0].x && v.box.w === 50 && h.box.x === -15 && b.w > h.box.w * 1.4 && b.h > h.box.h * 1.4 ? true : { v, h, b };
  },

  'more FX: hue shift, contrast, duotone, posterize, edges': () => {
    const red = () => new Uint8ClampedArray([255, 0, 0, 255]);
    const h = fx2Hsb(red(), 120, 0, 0, false), g = fx2Hsb(red(), 0, -100, 0, false), c = fx2Contrast(new Uint8ClampedArray([100, 150, 200, 255]), 0, 60);
    const d = fx2Duotone(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), '#102030', '#ffeedd', 100), p = fx2Posterize(new Uint8ClampedArray([100, 200, 30, 255]), 2);
    const im = new Uint8ClampedArray(8 * 8 * 4); for (let i = 0; i < 64; i++) { const v = i % 8 < 4 ? 0 : 255; im.set([v, v, v, 255], i * 4); } const E = fx2Sobel(im, 8, 8);
    const ok = h[1] > 250 && h[0] < 5 && Math.abs(g[0] - g[1]) < 2 && c[0] < 100 && c[2] > 200 && d[0] === 16 && d[2] === 48 && d[4] === 255 && d[6] === 221
      && p[0] === 0 && p[1] === 255 && E[3 * 8 + 3] > 100 && E[3 * 8 + 1] === 0;
    return ok ? true : { h: [...h], g: [...g], c: [...c], d: [...d], p: [...p], e: [E[27], E[25]] };
  },

  'studio look: slider fill percent': () => rangeFillPct(5, 0, 10) === 50 && rangeFillPct(-3, 0, 10) === 0 && rangeFillPct(50, '', '') === 50 && rangeFillPct(1, 2, 2) === 0,

  'Ask button stays on screen when dragged': () => { const a = fabClamp(-50, 2000, 52, 390, 844), b = fabClamp(100, 200, 52, 390, 844); return a[0] === 6 && a[1] === 844 - 58 && b[0] === 100 && b[1] === 200 ? true : { a, b }; },

  'mixing brush dab: red over red stays red, full paint gives the brush colour': () => {
    const mk = (r, g, b) => { const S = new Uint8ClampedArray(20 * 20 * 4); for (let i = 0; i < S.length; i += 4) S.set([r, g, b, 255], i); return S; };
    const M = () => ({ G: 8, tw: 2, th: 2, ta: new Float32Array([1, 1, 1, 1]), carry: new Float32Array(256), pick: new Float32Array(256), init: false });
    const o = { blur: false, smudge: 0.5, strength: 1, paint: false, P: 0, D: 1, rgb: [0, 0, 0], tv: null };
    const A = mk(224, 64, 64); smudgeDab(M(), A, 20, 20, 0, 0, 5, 5, 10, o); const a = [...A.slice((10 * 20 + 10) * 4, (10 * 20 + 10) * 4 + 4)];
    const B = mk(224, 64, 64); smudgeDab(M(), B, 20, 20, 0, 0, 5, 5, 10, { ...o, paint: true, P: 1, D: 1, rgb: [32, 160, 64] }); const b = [...B.slice((10 * 20 + 10) * 4, (10 * 20 + 10) * 4 + 4)];
    const C = mk(224, 64, 64); smudgeDab(M(), C, 20, 20, 0, 0, 5, 5, 10, { ...o, blur: true }); const c = [...C.slice((10 * 20 + 10) * 4, (10 * 20 + 10) * 4 + 4)];
    const near = (p, q) => p.every((v, i) => Math.abs(v - q[i]) <= 2);
    return near(a, [224, 64, 64, 255]) && near(b, [32, 160, 64, 255]) && near(c, [224, 64, 64, 255]) && A[3] === 255 ? true : { a, b, c };
  },

  'GPU mixing engine compiles where WebGL2 exists': () => { const gl = document.createElement('canvas').getContext('webgl2'); return !gl || gpuMixInit() === true; },

  'hooks: run in order after the function, a failing hook does not stop the others, async waits; prefs never throw': async () => {
    const seen = [];
    hookAfter('markDirty', () => seen.push('b'), 5); hookAfter('markDirty', () => { throw new Error('broken'); }, 1); hookAfter('markDirty', () => seen.push('a'), -5);
    const ce = console.error; console.error = () => {}; markDirty(); console.error = ce;
    let after = null; hookAfter('saveDocument', () => { after = after || 'hook'; }, 99);
    const sd = HOOKABLE.saveDocument[0]();
    prefs.set('unit.x', 'y'); const pv = prefs.get('unit.x'); prefs.set('unit.x', null);
    return seen.join('') === 'ab' && typeof sd === 'function' && pv === 'y' && prefs.get('unit.x', 'd') === 'd' && escHtml('<a href="x">') === '&lt;a href=&quot;x&quot;&gt;' ? true : { seen, pv };
  },

  'every module started (no failure in the start-up list)': () => !window.__sfStartErrors || { failed: window.__sfStartErrors },

  'swap drawings: video layers have none': () => swapsOf({ vref: {} }).length === 0 && Array.isArray(swapsOf({})),
};

(async () => {
  const root = process.argv[2] || path.resolve(__dirname, '../..');
  const { pg, errors, done } = await H.open(root, 8870, { width: 1000, height: 700 });
  let failed = 0;
  for (const [name, fn] of Object.entries(TESTS)) {
    let r;
    try { r = await pg.evaluate(src => window.__sketchforge.scope('(' + src + ')')(), fn.toString()); } catch (e) { r = String(e.message || e).split('\n')[0]; }
    if (r === true) console.log('ok   ' + name);
    else { failed++; console.log('FAIL ' + name + '  ' + JSON.stringify(r)); }
  }
  await done();
  if (errors.length) { failed++; console.log('JS errors:', errors); }
  console.log(`${Object.keys(TESTS).length - failed} / ${Object.keys(TESTS).length} unit tests passed`, failed ? 'FAIL' : 'PASS');
  process.exit(failed ? 1 : 0);
})();
