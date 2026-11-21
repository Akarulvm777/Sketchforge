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
