(() => {
'use strict';

/* =====================================================================
   Sketchforge v0.9.1
   Clip Studio-style workspace + Animate-style timeline:
   tool groups, selection, transform, gradient, text, view rotate / flip,
   keyframes, motion tweens, onion skin, GIF / WebM / PNG-sequence export.
   ===================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DEG = Math.PI / 180;

const viewport = $('#viewport');
const stage = $('#stage');
const cursorEl = $('#cursor');
const toastEl = $('#toast');
const overlay = $('#overlay');
const octx = overlay.getContext('2d');

const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'soft-light', 'hard-light', 'difference',
  'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const canvasBlend = b => (b === 'normal' ? 'source-over' : b);

const MAX_FRAMES = 500;
const CELL_W = 18;

/* ---------- icons ---------- */
const IC = {
  pen: '<path d="M12 3l6 8-6 10-6-10z"/><circle cx="12" cy="10.5" r="1.4"/><path d="M12 12v9"/>',
  pencil: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M14 7l3 3"/>',
  brush: '<path d="M18.5 3.5l2 2-8.5 8.5-2-2z"/><path d="M10 12.5c-2.8 0-4 1.7-4 3.5 0 1.6-1.2 2.6-2.5 3 3.5 1.6 8 .8 8-3.2"/>',
  marker: '<path d="M4 20l3-1 10-10-3-3L4 16z"/><path d="M14 6l3 3"/>',
  eraser: '<path d="M7 20h11"/><path d="M5.5 13.5l7-7a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12 18H8.5l-3-3a2 2 0 0 1 0-1.5z"/><path d="M9.5 10l6 6"/>',
  fill: '<path d="M5 11l6-6 7 7-6 6z"/><path d="M19 14.5c1.4 1.8 2 2.8 2 3.8a2 2 0 0 1-4 0c0-1 .6-2 2-3.8z"/><path d="M5 11h13"/>',
  gradient: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M12 5v14M16 5v14" opacity=".6"/>',
  pick: '<path d="M20 4a2.1 2.1 0 0 0-3 0l-3 3-1-1-2 2 6 6 2-2-1-1 3-3a2.1 2.1 0 0 0 0-3z"/><path d="M12 9l-7 7v3h3l7-7"/>',
  selrect: '<rect x="4" y="5" width="16" height="14" stroke-dasharray="3 2.5"/>',
  selellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5" stroke-dasharray="3 2.5"/>',
  sellasso: '<path d="M4 11c0-3.5 3.5-6 8-6s8 2.5 8 5.5-3.5 5.5-8 5.5c-1 0-2-.1-3-.3" stroke-dasharray="3 2.5"/><path d="M9 16c-.8 1.4-1.4 2.6-1.6 3.4-.2.8.3 1.4 1.1 1.4"/>',
  selwand: '<path d="M4 20L15 9"/><path d="M17 4v3M15.5 5.5h3M20 9v2M19 10h2"/>',
  shape: '<rect x="3" y="11" width="10" height="10" rx="1"/><circle cx="15" cy="9" r="6"/>',
  line: '<path d="M5 19L19 5"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  oval: '<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V13M17 9.5a1.5 1.5 0 0 1 3 0V15c0 3.9-3 6-6.5 6H12c-3 0-4-1.5-5.7-4L4.4 14c-.7-1 .6-2.4 1.8-1.6L8 13.8"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
  zoom: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6M10 7v6M7 10h6"/>',
  newdoc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>',
  open: '<path d="M3 7h6l2 2h10v10H3z"/><path d="M3 19l3-8h17l-3 8"/>',
  save: '<path d="M5 3h12l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"  transform="translate(0 -5)"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 0 0 0 12" transform="translate(0 -5)"/>',
  deselect: '<rect x="4" y="5" width="16" height="14" stroke-dasharray="3 2.5"/><path d="M8 9l8 6M16 9l-8 6"/>',
  invert: '<rect x="4" y="5" width="16" height="14" stroke-dasharray="3 2.5"/><path d="M12 5v14M12 5h8v14h-8z" fill="currentColor"/>',
  flip: '<path d="M12 3v18" stroke-dasharray="2 2.5"/><path d="M9 7L3 17h6zM15 7l6 10h-6z"/>',
  export: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  rotl: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>',
  rotr: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  merge: '<path d="M12 3v10M7 9l5 5 5-5"/><path d="M5 20h14"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  clear: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 8l8 8M16 8l-8 8"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
  first: '<path d="M6 5v14"/><path d="M19 5L9 12l10 7z"/>',
  prev: '<path d="M17 5L8 12l9 7z"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3.2"/>',
  next: '<path d="M7 5l9 7-9 7z"/>',
  last: '<path d="M18 5v14"/><path d="M5 5l10 7L5 19z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
};
const FILLED_ICONS = new Set(['play', 'prev', 'next', 'first', 'last']);
const customIcons = {}; /* name -> image data URL, set from the Custom P menu (p10zz_customp) */
function icon(n) {
  if (customIcons[n]) return `<svg viewBox="0 0 24 24" class="cicon"><image href="${customIcons[n]}" x="0" y="0" width="24" height="24" preserveAspectRatio="xMidYMid meet"/></svg>`;
  const fill = FILLED_ICONS.has(n) ? 'currentColor' : 'none';
  return `<svg viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;
}
function applyIcons(root = document) {
  root.querySelectorAll('[data-ic]').forEach(el => { el.innerHTML = icon(el.dataset.ic); });
}

/* ---------- tools ----------
   TOOLDEF: every sub tool. GROUPS: what the tool palette shows.            */
const P = (size, hardness, flow, opacity, pSize, pAlpha, smooth, extra) =>
  ({ size, hardness, flow, opacity, pSize, pAlpha, smooth, aa: 2, speed: 0, nib: 0, grain: 0, taperIn: 0, taperRatio: 0.3, nibRatio: 1, nibAngle: 0, ...extra });
const TOOLDEF = {
  pen:        { name: 'G-pen',            kind: 'brush', icon: 'pen',    preset: P(6, 1, 1, 1, true, false, 0.30) },
  mapping:    { name: 'Mapping pen',       kind: 'brush', icon: 'pen',    preset: P(3, 1, 1, 1, false, false, 0.50) },
  realpen:    { name: 'Real G-Pen',         kind: 'brush', icon: 'pen',    preset: P(10, 0.85, 0.9, 1, true, true, 0.25) },
  pencil:     { name: 'Pencil',            kind: 'brush', icon: 'pencil', preset: P(5, 0.55, 0.45, 1, true, true, 0.10) },
  turnip:     { name: 'Turnip pen',        kind: 'brush', icon: 'pen',    preset: P(9, 1, 1, 1, true, false, 0.30, { speed: 0.6 }) },
  callig:     { name: 'Calligraphy',       kind: 'brush', icon: 'pen',    preset: P(14, 1, 1, 1, false, false, 0.30, { nib: 45 }) },
  textured:   { name: 'Textured pen',      kind: 'brush', icon: 'pen',    preset: P(12, 0.8, 0.85, 1, true, true, 0.20, { grain: 0.5 }) },
  mech:       { name: 'Mechanical pencil', kind: 'brush', icon: 'pencil', preset: P(2, 1, 0.7, 1, true, true, 0.15) },
  brush:      { name: 'Soft brush',        kind: 'brush', icon: 'brush',  preset: P(40, 0.25, 0.30, 1, true, true, 0.20) },
  airbrush:   { name: 'Airbrush',          kind: 'brush', icon: 'brush',  preset: P(70, 0, 0.12, 1, true, true, 0.20) },
  marker:     { name: 'Marker',            kind: 'brush', icon: 'marker', preset: P(24, 0.9, 1, 0.6, false, false, 0.20) },
  eraser:     { name: 'Hard eraser',       kind: 'brush', icon: 'eraser', erase: true, preset: P(30, 0.85, 1, 1, true, false, 0.20) },
  softeraser: { name: 'Soft eraser',       kind: 'brush', icon: 'eraser', erase: true, preset: P(50, 0.2, 0.6, 1, true, false, 0.20) },
  fill:       { name: 'Fill',              kind: 'fill',     icon: 'fill' },
  linear:     { name: 'Linear gradient',   kind: 'gradient', icon: 'gradient' },
  radial:     { name: 'Radial gradient',   kind: 'gradient', icon: 'gradient' },
  pick:       { name: 'Eyedropper',        kind: 'pick',     icon: 'pick' },
  selrect:    { name: 'Rectangle',         kind: 'select',   icon: 'selrect' },
  selellipse: { name: 'Ellipse',           kind: 'select',   icon: 'selellipse' },
  sellasso:   { name: 'Lasso',             kind: 'select',   icon: 'sellasso' },
  selwand:    { name: 'Magic wand',        kind: 'select',   icon: 'selwand' },
  line:       { name: 'Line',              kind: 'shape',    icon: 'line' },
  rect:       { name: 'Rectangle',         kind: 'shape',    icon: 'rect' },
  oval:       { name: 'Ellipse',           kind: 'shape',    icon: 'oval' },
  text:       { name: 'Text',              kind: 'text',     icon: 'text' },
  move:       { name: 'Move / transform',  kind: 'move',     icon: 'move' },
  hand:       { name: 'Hand',              kind: 'hand',     icon: 'hand' },
  rotate:     { name: 'Rotate view',       kind: 'rotate',   icon: 'rotate' },
  zoom:       { name: 'Zoom',              kind: 'zoom',     icon: 'zoom' }
};
const GROUPS = [
  { id: 'pen',      name: 'Pen',               key: 'P', icon: 'pen',      subs: ['pen', 'realpen', 'mapping', 'turnip', 'callig', 'textured'] },
  { id: 'pencil',   name: 'Pencil',            key: 'N', icon: 'pencil',   subs: ['pencil', 'mech'] },
  { id: 'brush',    name: 'Brush',             key: 'B', icon: 'brush',    subs: ['brush', 'airbrush', 'marker'] },
  { id: 'eraser',   name: 'Eraser',            key: 'E', icon: 'eraser',   subs: ['eraser', 'softeraser'] },
  { sep: true },
  { id: 'fill',     name: 'Fill',              key: 'G', icon: 'fill',     subs: ['fill'] },
  { id: 'gradient', name: 'Gradient',          key: 'G', icon: 'gradient', subs: ['linear', 'radial'] },
  { id: 'pick',     name: 'Eyedropper',        key: 'I', icon: 'pick',     subs: ['pick'] },
  { sep: true },
  { id: 'select',   name: 'Selection',         key: 'M', icon: 'selrect',  subs: ['selrect', 'selellipse', 'sellasso', 'selwand'] },
  { id: 'move',     name: 'Move / transform',  key: 'V', icon: 'move',     subs: ['move'] },
  { id: 'shape',    name: 'Figure',            key: 'U', icon: 'shape',    subs: ['line', 'rect', 'oval'] },
  { id: 'text',     name: 'Text',              key: 'T', icon: 'text',     subs: ['text'] },
  { sep: true },
  { id: 'hand',     name: 'Navigate',          key: 'H', icon: 'hand',     subs: ['hand', 'rotate', 'zoom'] }
];
const kindOf = id => TOOLDEF[id].kind;
const groupOf = id => GROUPS.find(g => g.subs && g.subs.includes(id));

const settings = {};
for (const k in TOOLDEF) if (TOOLDEF[k].preset) settings[k] = { ...TOOLDEF[k].preset };
settings.shape = P(6, 1, 1, 1, false, false, 0);

const state = {
  name: 'Untitled',
  w: 1280, h: 720,
  layers: [],
  activeId: null,
  tool: 'pen',
  group: 'pen',
  lastBrush: 'pen',
  color: '#000000',
  color2: '#ffffff',
  shapeFill: false,
  fingerDraw: true,
  fillTol: 16,
  fillGrow: 1,
  fillAll: false,
  selMode: 'replace',
  wandTol: 16,
  gradEnd: 'sub',
  font: 'sans-serif',
  fontSize: 48,
  bold: false,
  italic: false,
  align: 'left',
  frame: 0,
  frameCount: 24,
  fps: 12,
  loop: true,
  autoKey: true,
  onion: { on: false, before: 2, after: 1 }
};
const view = { x: 0, y: 0, scale: 1, rot: 0, flip: false };

let layerSeq = 1;
let layerCounter = 1;
let dirty = false;
let playing = false;
let exporting = false;
let stroke = null;   // active brush / shape stroke
let active = null;   // any other active pointer interaction (select, move, gradient ...)

/* ---------- helpers ---------- */
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function crop(src, b) {
  const c = makeCanvas(b.w, b.h);
  c.getContext('2d').drawImage(src, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  return c;
}
function clampBox(x0, y0, x1, y1) {
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(state.w, Math.ceil(x1));
  y1 = Math.min(state.h, Math.ceil(y1));
  if (!(x1 > x0) || !(y1 > y0)) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
let toastTimer = 0;
function toast(msg, ms) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms || 2200);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Image failed to load'));
    im.src = src;
  });
}
function canvasToBlob(c, type = 'image/png') {
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not encode image'))), type));
}

