/* ---------- 🎨 Custom P: customise the whole interface ----------
   Sections: themes (colour + layout presets, saved themes, import / export), colours of every area,
   text & fonts, layout & sizes, icons, canvas area, cursor, effects. Everything applies live.
   Base theme colours repaint style.css (below); per-area colours, sizes, fonts, layout and effects are
   generated into the <style id="cpOv"> sheet by cpOverrides(). Images and fonts live in IndexedDB.
   Colours: every colour in style.css is repainted. Greys are mapped by brightness onto the theme's
   ramp (deep → line → background → panel → muted → text), the copper accent and the slate-blue selection
   map to the theme accent, other saturated colours (record red, symmetry pink...) are kept.
   Icons: icon(name) in p00 returns customIcons[name] when set (an image scaled to 64 px, shown in the
   same 24×24 SVG box as the built-in icons). Everything is stored in localStorage (CP_KEY). */
const CP_KEY = 'sketchforge.customp.v2', CP_KEY_V1 = 'sketchforge.customp.v1';
const CP = { preset: 'default', custom: null, canvas: '', icons: {}, o: {} };
const CP_DEFAULT = { bg: '#323232', panel: '#434343', text: '#d9d9d9', accent: '#e08a3c' };
const CP_THEMES = {
  default: ['Default', null],
  midnight: ['Midnight blue', { bg: '#161b26', panel: '#1f2533', text: '#dfe6f3', accent: '#5aa2ff' }],
  graphite: ['Graphite', { bg: '#1a1a1a', panel: '#252525', text: '#e8e8e8', accent: '#a7b0ba' }],
  light: ['Light', { bg: '#dcdde1', panel: '#f3f3f5', text: '#26282b', accent: '#2f7bf5' }],
  paper: ['Paper (warm light)', { bg: '#e4dccd', panel: '#f6f1e7', text: '#3a3127', accent: '#c4622d' }],
  sakura: ['Sakura', { bg: '#2a1f26', panel: '#3a2a33', text: '#f6e3ec', accent: '#ff7eb6' }],
  forest: ['Forest', { bg: '#18211b', panel: '#223026', text: '#e1efe4', accent: '#5fd38a' }],
  ocean: ['Ocean', { bg: '#10222b', panel: '#173340', text: '#dff3fa', accent: '#2ec4d6' }],
  purple: ['Purple night', { bg: '#1e1828', panel: '#2a2238', text: '#ece4fb', accent: '#b38cff' }],
  sepia: ['Sepia', { bg: '#2b2620', panel: '#3a332a', text: '#efe4d0', accent: '#d9a05b' }],
  contrast: ['High contrast', { bg: '#000000', panel: '#121212', text: '#ffffff', accent: '#ffd400' }],
  vampire: ['Vampire', { bg: '#1e1f29', panel: '#282a36', text: '#f8f8f2', accent: '#ff79c6' }],
  mint: ['Mint (light)', { bg: '#d5eee4', panel: '#effaf5', text: '#1f3a30', accent: '#16a37a' }],
  amber: ['Retro amber', { bg: '#140e05', panel: '#21170a', text: '#ffcf7a', accent: '#ff9d00' }],
  neon: ['Neon night', { bg: '#0d0221', panel: '#1a0b3d', text: '#e8e1ff', accent: '#00f0ff' }],
  rose: ['Rose (light)', { bg: '#f0dde2', panel: '#fbf2f4', text: '#4a2430', accent: '#d6336c' }]
};

/* ---- colour helpers ---- */
function cpParse(s) {
  s = s.trim().toLowerCase();
  if (s === 'white') return [255, 255, 255, 1];
  if (s === 'black') return [0, 0, 0, 1];
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
  }
  const m = s.match(/rgba?\(([^)]*)\)/); if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}
const cpHex = c => '#' + c.slice(0, 3).map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const cpOut = c => c[3] < 1 ? `rgba(${c.slice(0, 3).map(v => Math.round(clamp(v, 0, 255))).join(', ')}, ${+c[3].toFixed(3)})` : cpHex(c);
const cpMix = (a, b, t) => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t).concat([1]);
const cpLum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
function cpHsv(c) { const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]), d = mx - mn; let h = 0;
  if (d) h = mx === c[0] ? ((c[1] - c[2]) / d) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4;
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255]; }

/* The theme's grey ramp, keyed by the brightness of the default theme's greys. */
function cpRamp(t) {
  const bg = cpParse(t.bg), panel = cpParse(t.panel), text = cpParse(t.text), dark = cpLum(bg) < 0.5;
  const K = [0, 0, 0, 1], W = [255, 255, 255, 1];
  return [
    [0, cpMix(bg, K, dark ? 0.7 : 0.45)],
    [0.13, cpMix(bg, K, dark ? 0.35 : 0.2)],
    [0.196, bg], [0.263, panel],
    [0.314, cpMix(panel, text, 0.07)], [0.353, cpMix(panel, text, 0.16)],
    [0.608, cpMix(panel, text, 0.55)], [0.851, text],
    [1, dark ? cpMix(text, W, 0.6) : cpMix(text, K, 0.3)]
  ];
}
function cpMapper(t) {
  const ramp = cpRamp(t), acc = cpParse(t.accent), acc2 = cpMix(acc, cpParse(t.panel), 0.55);
  const accL = cpLum([224, 138, 60]);
  return tok => {
    const c = cpParse(tok); if (!c) return tok;
    const [h, s, v] = cpHsv(c), L = cpLum(c);
    let out;
    if (s < 0.14 || v < 0.12) { // grey: interpolate on the ramp
      let i = 1; while (i < ramp.length - 1 && L > ramp[i][0]) i++;
      const [l0, c0] = ramp[i - 1], [l1, c1] = ramp[i];
      out = cpMix(c0, c1, clamp((L - l0) / ((l1 - l0) || 1), 0, 1));
    } else if (h >= 15 && h <= 45 && s > 0.45) { // copper accent family
      out = L > accL ? cpMix(acc, [255, 255, 255], (L - accL) / (1 - accL) * 0.8) : cpMix(acc, [0, 0, 0], (accL - L) / accL * 0.8);
    } else if (h >= 195 && h <= 235) { // blue / slate: selection and older accents
      out = s < 0.45 && v < 0.65 ? acc2 : acc;
    } else return tok;
    out[3] = c[3];
    return cpOut(out);
  };
}

/* ---- stylesheet repaint ---- */
let cpDecls = null;
const CP_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/gi;
function cpCollect() {
  if (cpDecls) return cpDecls;
  cpDecls = [];
  const walk = rules => { for (const r of rules) {
    if (r.style) for (let i = 0; i < r.style.length; i++) {
      const p = r.style[i], v = r.style.getPropertyValue(p);
      CP_RE.lastIndex = 0;
      if (CP_RE.test(v)) cpDecls.push({ st: r.style, p, v, pr: r.style.getPropertyPriority(p) });
    }
    if (r.cssRules) walk(r.cssRules);
  } };
  for (const sh of document.styleSheets) { if (sh.ownerNode && sh.ownerNode.id === 'cpOv') continue; try { walk(sh.cssRules); } catch (e) { /* file:// or cross-origin sheet: variables only */ } }
  return cpDecls;
}
function cpTheme() { return CP.preset === 'custom' ? CP.custom : (CP_THEMES[CP.preset] || CP_THEMES.default)[1]; }
function cpApply() {
  const t = cpTheme(), decls = cpCollect(), root = document.documentElement.style;
  if (!t) { for (const d of decls) d.st.setProperty(d.p, d.v, d.pr); }
  else { const map = cpMapper(t); for (const d of decls) d.st.setProperty(d.p, d.v.replace(CP_RE, map), d.pr); }
  // Variables as inline styles: also covers pages where the stylesheet rules cannot be read (file://).
  for (const k of ['--bg', '--menu', '--panel', '--panel2', '--panel3', '--line', '--line2', '--text', '--muted', '--accent', '--accent-2']) root.removeProperty(k);
  if (t && !decls.length) {
    const r = cpRamp(t), at = L => cpOut(r.reduce((b, s) => Math.abs(s[0] - L) < Math.abs(b[0] - L) ? s : b)[1]);
    Object.entries({ '--bg': t.bg, '--menu': at(0.23), '--panel': t.panel, '--panel2': at(0.314), '--panel3': at(0.17), '--line': at(0.13), '--line2': at(0.353), '--text': t.text, '--muted': at(0.608), '--accent': t.accent, '--accent-2': cpOut(cpMix(cpParse(t.accent), cpParse(t.panel), 0.55)) }).forEach(([k, v]) => root.setProperty(k, v));
  }
  if (CP.canvas) root.setProperty('--canvas', CP.canvas); else root.removeProperty('--canvas');
  document.documentElement.style.colorScheme = t && cpLum(cpParse(t.bg)) > 0.5 ? 'light' : 'dark';
}

/* ---- options: everything beyond the base colours ---- */
const CP_AREAS = [ // key, label, background selector, text selector (auto-contrast unless a text colour is set)
  ['menubar', 'Menu bar', '#menubar', '#menubar, #menubar .menu-btn'],
  ['cmdbar', 'Command bar', '#cmdbar', '#cmdbar, #cmdbar button'],
  ['tabbar', 'Tabs bar', '#tabbar', '#tabbar .tab:not(.on)'],
  ['tab', 'Active tab', '#tabbar .tab.on', '#tabbar .tab.on'],
  ['toolbox', 'Tool palette', '#toolbox', null],
  ['tool', 'Tool buttons', '#toolbox .tool', '#toolbox .tool'],
  ['toolOn', 'Selected tool', '#toolbox .tool.active, .sub-item.active', '#toolbox .tool.active, .sub-item.active'],
  ['docks', 'Side panels', '#leftdock, #rightdock, .pal', '#leftdock, #rightdock'],
  ['header', 'Panel titles', '.pal h4', '.pal h4'],
  ['items', 'Tool & layer lists', '.sub-item:not(.active), .layer-item:not(.active)', '.sub-item:not(.active), .layer-item:not(.active)'],
  ['layerOn', 'Selected layer', '.layer-item.active, .tl-row.active .tl-name', '.layer-item.active, .tl-row.active .tl-name'],
  ['timeline', 'Timeline', '#timeline, #tlScroll, .tl-name, .tl-head', '#timeline'],
  ['cells', 'Timeline frames', '.tl-cell.hold, .tl-cell.key', null],
  ['tween', 'Tween frames', '.tl-cell.tween', null],
  ['statusbar', 'Status bar', '#statusbar', '#statusbar'],
  ['buttons', 'Buttons', '.pal button, dialog button, .popover button, .navrow button, .seg button, .lbtns button', '.pal button, dialog button, .popover button, .navrow button, .seg button'],
  ['primary', 'OK buttons', 'button.primary', 'button.primary'],
  ['inputs', 'Text boxes', 'input[type=text], input[type=number], select, textarea', 'input[type=text], input[type=number], select, textarea'],
  ['dialogs', 'Dialogs & menus', 'dialog, .popover, .dropdown, .subview, .svhead', 'dialog, .popover, .dropdown'],
  ['toast', 'Messages', '#toast', '#toast']
];
const CP_TEXTS = [['text', 'Main text'], ['muted', 'Secondary text'], ['menuText', 'Menu text'], ['headerText', 'Panel title text'], ['keyDot', 'Keyframe dots'], ['border', 'Borders'], ['slider', 'Sliders'], ['scroll', 'Scrollbars']];
const CP_FONTS = [['', 'System (default)'], ['"Segoe UI", system-ui, sans-serif', 'Segoe UI'], ['Helvetica, Arial, sans-serif', 'Helvetica / Arial'], ['Verdana, Geneva, sans-serif', 'Verdana (wide)'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet'], ['ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif', 'Rounded'], ['Georgia, "Times New Roman", serif', 'Georgia (serif)'],
  ['ui-monospace, Consolas, "Courier New", monospace', 'Monospace'], ['"Comic Sans MS", "Comic Neue", cursive', 'Comic'], ['Impact, "Arial Black", sans-serif', 'Heavy'], ['SFUserFont, system-ui, sans-serif', 'My font file']];
const CP_LAYOUTS = {
  compact: ['Compact pro', { scale: 90, density: 'compact', radius: 2, iconSize: 18 }],
  touch: ['Big & touch-friendly (tablet)', { scale: 120, density: 'comfy', radius: 10, iconSize: 26, fontSize: 110 }],
  soft: ['Soft & rounded', { radius: 14, density: 'comfy', shadow: 60, anim: true, glow: true }],
  square: ['Classic square', { radius: 0, density: 'normal', shadow: 0, border: 1 }]
};
const cpO = () => CP.o || (CP.o = {});
const cpColOf = k => (cpO().col || {})[k] || null;

/* readable text colour for a background */
function cpContrast(hex) { const c = cpParse(hex); return c && cpLum(c) > 0.55 ? '#1d1f22' : '#f2f3f5'; }
/* build the override style sheet from CP.o */
function cpOverrides() {
  const o = cpO(), col = o.col || {}, css = [], root = document.documentElement.style, I = ' !important';
  const R = (sel, decl) => css.push(`${sel}{${decl}}`);
  // area colours
  for (const [k, , bg, txt] of CP_AREAS) {
    const c = col[k]; if (!c) continue;
    R(bg, `background:${c}${I};background-color:${c}${I};border-color:color-mix(in srgb, ${c} 70%, #000)${I}`);
    if (txt && !(k === 'menubar' && col.menuText) && !(k === 'header' && col.headerText)) R(txt, `color:${cpContrast(c)}${I}`);
  }
  if (col.text) { R('body, #app', `color:${col.text}${I}`); root.setProperty('--text', col.text); }
  if (col.muted) root.setProperty('--muted', col.muted);
  if (col.menuText) R('#menubar, #menubar .menu-btn', `color:${col.menuText}${I}`);
  if (col.headerText) R('.pal h4', `color:${col.headerText}${I}`);
  if (col.keyDot) R('.tl-cell.key::after', `background:${col.keyDot}${I}`), R('.tl-cell.key.blank::after', `background:transparent${I};border-color:${col.keyDot}${I}`);
  if (col.border) R('#menubar, #cmdbar, #tabbar, #toolbox, #leftdock, #rightdock, #timeline, #statusbar, .pal, .pal h4, .layer-item, dialog, .dropdown, .popover', `border-color:${col.border}${I}`);
  if (col.slider) R('input[type=range], input[type=checkbox], input[type=radio], progress', `accent-color:${col.slider}${I}`);
  if (col.scroll) R('*', `scrollbar-color:${col.scroll} transparent`), R('::-webkit-scrollbar-thumb', `background:${col.scroll}${I};border-radius:6px`), R('::-webkit-scrollbar', 'width:10px;height:10px;background:transparent');
  // text & fonts
  if (o.font) R('html, body, button, input, select, textarea', `font-family:${o.font}${I}`);
  const fs = (o.fontSize || 100) / 100;
  if (fs !== 1) {
    R('html, body', `font-size:${12 * fs}px${I}`);
    R('.small, .pal h4, #statusbar, #propBody .hint, #propBody .grp, .seg button, .numgrid label, .navrow.tight button, .tl-ruler .tl-name, .dropdown .mi kbd', `font-size:${11 * fs}px${I}`);
    R('.tl-rc', `font-size:${10 * fs}px${I}`); R('dialog h2, dialog h5', `font-size:${15 * fs}px${I}`);
  }
  if (o.bold) R('body, button, .menu-btn, .sub-item, .layer-item', `font-weight:600${I}`);
  if (o.letter) R('body, button', `letter-spacing:${o.letter / 10}px${I}`);
  if (o.headerCase === 'upper') R('.pal h4', `text-transform:uppercase${I}`);
  else if (o.headerCase === 'normal') R('.pal h4', `text-transform:none${I}`);
  else if (o.headerCase === 'title') R('.pal h4', `text-transform:capitalize${I}`);
  // layout & sizes
  const sc = (o.scale || 100) / 100;
  if (sc !== 1) R('#menubar, #cmdbar, #tabbar, #toolbox, #leftdock, #rightdock, #timeline, #tlResize, #statusbar, dialog, .popover, .subview', `zoom:${sc}`);
  if (o.radius != null) {
    const r = o.radius;
    R('#app button, #app input, #app select, #app textarea, .pal, dialog, .popover, .dropdown, .sub-item, .layer-item, .subview, #toast, .tl-cell.key::after', `border-radius:${r}px${I}`);
    R('#tabbar .tab', `border-radius:${r}px ${r}px 0 0${I}`); R('.tl-cell.key::after', `border-radius:${Math.max(r, 3) >= 6 ? '50%' : r + 'px'}${I}`);
  }
  if (o.border != null) R('#menubar, #cmdbar, #tabbar, #toolbox, #leftdock, #rightdock, #timeline, #statusbar, .pal h4, .layer-item', `border-width:${o.border}px${I}${o.border ? '' : ';border-style:none' + I}`);
  if (o.density === 'compact') { R('.sub-item', `padding:2px 6px${I}`); R('.layer-item', `padding:1px 3px${I}`); R('#propBody label, #propBody .grp', `margin-top:1px${I};margin-bottom:1px${I}`); R('#toolbox', `gap:1px${I};padding:3px 2px${I}`); R('.pal h4', `padding:2px 6px${I}`); }
  else if (o.density === 'comfy') { R('.sub-item', `padding:9px 10px${I}`); R('.layer-item', `padding:6px 6px${I}`); R('#propBody label', `margin-top:5px${I};margin-bottom:5px${I}`); R('#toolbox', `gap:6px${I};padding:8px 5px${I}`); R('.pal h4', `padding:7px 10px${I}`); R('#app button', `min-height:28px`); }
  const ic = o.iconSize || 20;
  if (ic !== 20) { R('#toolbox .tool svg', `width:${ic}px${I};height:${ic}px${I}`); R('#toolbox .tool', `width:${ic + 16}px${I};height:${ic + 14}px${I}`); R('#cmdbar button svg', `width:${ic - 3}px${I};height:${ic - 3}px${I}`); R('.sub-item svg, .layer-item .mini svg, .tl-name .mini svg', `width:${Math.round(ic * 0.75)}px${I};height:${Math.round(ic * 0.75)}px${I};flex-basis:${Math.round(ic * 0.75)}px${I}`); }
  if (!o.iconSize || o.iconSize === 20) { /* keep */ }
  const cols = o.toolCols || 0;
  if (cols) { const w = cols * (ic + 18) + 10; R('#toolbox', `display:grid${I};grid-template-columns:repeat(${cols}, 1fr)${I};flex:0 0 ${w}px${I};width:${w}px${I};align-content:start${I};justify-items:center${I}`); R('#toolbox .tsep', `grid-column:1 / -1${I};width:90%`); }
  if (o.dockL) root.setProperty('--dock-l', o.dockL + 'px'); else root.removeProperty('--dock-l');
  if (o.dockR) root.setProperty('--dock-r', o.dockR + 'px'); else root.removeProperty('--dock-r');
  if (o.tlH) root.setProperty('--tl-h', o.tlH + 'px'); else root.removeProperty('--tl-h');
  if (o.toolSide === 'right') R('#toolbox', `order:9`);
  if (o.swapDocks) { R('#rightdock', `order:1`); R('#center', `order:5`); R('#leftdock', `order:8`); }
  else R('#center', 'order:5'), R('#leftdock', 'order:1'), R('#rightdock', 'order:8');
  if (o.cmdPos === 'bottom') { R('#cmdbar', 'order:20'); R('#statusbar', 'order:21'); }
  if (o.tlPos === 'top') { R('#timeline', 'order:-2'); R('#tlResize', 'order:-1'); }
  if (o.hideStatus) R('#statusbar', `display:none${I}`);
  if (o.hideTabs) R('#tabbar', `display:none${I}`);
  if (o.hideCmd) R('#cmdbar', `display:none${I}`);
  // icons
  if (o.iconColor) R('#toolbox .tool, #cmdbar button, .lbtns button, .sub-item svg, #subtoolBar button, .layer-item .mini, .tl-transport button', `color:${o.iconColor}${I}`);
  if (o.iconOn) R('#toolbox .tool.active, .sub-item.active svg', `color:${o.iconOn}${I}`);
  if (o.iconStroke) R('svg[stroke-width]', `stroke-width:${o.iconStroke}${I}`);
  // canvas area
  const vp = '#viewport';
  if (o.cvType && o.cvType !== 'theme') {
    const c1 = o.cvColor || '#4b4b4b', c2 = o.cvColor2 || '#2b2b2b';
    if (o.cvType === 'solid') R(vp, `background:${c1}${I}`);
    else if (o.cvType === 'gradient') R(vp, `background:linear-gradient(${o.cvAngle ?? 160}deg, ${c1}, ${c2})${I}`);
    else if (o.cvType === 'radial') R(vp, `background:radial-gradient(circle at 50% 45%, ${c1}, ${c2})${I}`);
    else if (o.cvType === 'checker') R(vp, `background:repeating-conic-gradient(${c1} 0% 25%, ${c2} 0% 50%) 0 0 / ${(o.cvSize || 24)}px ${(o.cvSize || 24)}px${I}`);
    else if (o.cvType === 'dots') R(vp, `background:radial-gradient(${c2} 1.4px, transparent 1.6px) 0 0 / ${(o.cvSize || 24)}px ${(o.cvSize || 24)}px, ${c1}${I}`);
    else if (o.cvType === 'grid') R(vp, `background:linear-gradient(${c2} 1px, transparent 1px) 0 0 / ${(o.cvSize || 24)}px ${(o.cvSize || 24)}px, linear-gradient(90deg, ${c2} 1px, transparent 1px) 0 0 / ${(o.cvSize || 24)}px ${(o.cvSize || 24)}px, ${c1}${I}`);
    else if (o.cvType === 'image' && CP_ASSETS.cvImage) R(vp, `background:${c1} url("${CP_ASSETS.cvImage}") center / ${o.cvFit === 'tile' ? 'auto' : o.cvFit === 'contain' ? 'contain no-repeat' : 'cover no-repeat'}${I}`);
  }
  if (o.cvShadow != null) R('#stage', `box-shadow:0 ${o.cvShadow / 8}px ${o.cvShadow / 2}px rgba(0,0,0,${Math.min(0.9, o.cvShadow / 100)})${I}`);
  if (o.cvBorder) R('#stage', `outline:${o.cvBorderW || 1}px solid ${o.cvBorder}${I}`);
  // cursor
  if (o.curColor) R('#cursor', `border-color:${o.curColor}${I}`);
  if (o.curWidth) R('#cursor', `border-width:${o.curWidth}px${I}`);
  if (o.curShadow === false) R('#cursor', `box-shadow:none${I}`);
  if (o.curCross) R('#cursor::before, #cursor::after', `content:'';position:absolute;left:50%;top:50%;background:${o.curColor || '#fff'};transform:translate(-50%,-50%)`), R('#cursor::before', 'width:9px;height:1px'), R('#cursor::after', 'width:1px;height:9px');
  // effects
  if (CP_ASSETS.wallpaper) R('body', `background:#000 url("${CP_ASSETS.wallpaper}") center / ${o.wallFit === 'tile' ? 'auto' : 'cover'} fixed${I}`), R('#app', `background:transparent${I}`);
  const a = o.panelAlpha ?? 100;
  if (a < 100 || CP_ASSETS.wallpaper) {
    const mix = (v, sel) => R(sel, `background-color:color-mix(in srgb, ${v} ${a}%, transparent)${I}${o.blur ? `;backdrop-filter:blur(${o.blur}px);-webkit-backdrop-filter:blur(${o.blur}px)` : ''}`);
    mix(col.menubar || 'var(--menu)', '#menubar'); mix(col.cmdbar || 'var(--menu)', '#cmdbar'); mix(col.tabbar || 'var(--bg)', '#tabbar'); mix(col.toolbox || 'var(--panel)', '#toolbox');
    mix(col.docks || 'var(--panel)', '#leftdock, #rightdock'); mix(col.timeline || 'var(--panel)', '#timeline'); mix(col.statusbar || 'var(--menu)', '#statusbar');
    R('.pal', `background:transparent${I}`);
    if (!o.cvType || o.cvType === 'theme') mix('var(--canvas)', '#viewport');
  }
  if (o.shadow) R('#toolbox, #leftdock, #rightdock, .pal, dialog, .popover, .dropdown, #menubar', `box-shadow:0 ${o.shadow / 20}px ${o.shadow / 4}px rgba(0,0,0,${o.shadow / 160})${I}`);
  if (o.anim) R('#app button, .sub-item, .layer-item, #tabbar .tab, .tool', 'transition:background-color .18s, color .18s, transform .12s, box-shadow .18s'), R('#toolbox .tool:hover, .sub-item:hover', 'transform:translateY(-1px)');
  if (o.glow) R('#toolbox .tool.active, .sub-item.active, .layer-item.active, #tabbar .tab.on', 'box-shadow:0 0 0 1px var(--accent), 0 0 10px color-mix(in srgb, var(--accent) 60%, transparent)' + I);
  let st = $('#cpOv'); if (!st) { st = document.createElement('style'); st.id = 'cpOv'; document.head.appendChild(st); }
  st.textContent = css.join('\n');
}
function cpApplyAll() { cpApply(); cpOverrides(); }

/* ---- images & fonts (IndexedDB) ---- */
const CP_ASSETS = {}; // key -> object URL
let cpIDB = null;
function cpDB() {
  if (cpIDB) return Promise.resolve(cpIDB);
  return new Promise(res => { try { const rq = indexedDB.open('sketchforge-customp', 1); rq.onupgradeneeded = () => { rq.result.createObjectStore('assets'); rq.result.createObjectStore('themes', { keyPath: 'name' }); }; rq.onsuccess = () => res(cpIDB = rq.result); rq.onerror = () => res(null); } catch (e) { res(null); } });
}
async function cpDBdo(store, mode, fn) { const db = await cpDB(); if (!db) return null; return new Promise((res, rej) => { const tx = db.transaction(store, mode), r = fn(tx.objectStore(store)); tx.oncomplete = () => res(r && 'result' in r ? r.result : null); tx.onerror = () => rej(tx.error); }); }
async function cpSetAsset(key, blob) {
  if (CP_ASSETS[key]) URL.revokeObjectURL(CP_ASSETS[key]);
  if (blob) { CP_ASSETS[key] = URL.createObjectURL(blob); await cpDBdo('assets', 'readwrite', s => s.put(blob, key)); }
  else { delete CP_ASSETS[key]; await cpDBdo('assets', 'readwrite', s => s.delete(key)); }
  if (key === 'font') await cpLoadFont(blob);
}
async function cpLoadFont(blob) {
  try { if (!blob) return; const f = new FontFace('SFUserFont', await blob.arrayBuffer()); await f.load(); document.fonts.add(f); } catch (e) { toast('That font file could not be read (use .ttf, .otf or .woff)'); }
}
async function cpLoadAssets() {
  for (const k of ['cvImage', 'wallpaper', 'font']) {
    const b = await cpDBdo('assets', 'readonly', s => s.get(k)).catch(() => null);
    if (b) { CP_ASSETS[k] = URL.createObjectURL(b); if (k === 'font') await cpLoadFont(b); }
  }
  cpOverrides();
}

/* ---- persistence ---- */
function cpSave() {
  try { localStorage.setItem(CP_KEY, JSON.stringify(CP)); return true; }
  catch (e) { toast('Could not save: browser storage is full (try smaller or fewer icons)'); return false; }
}
function loadCustomP() {
  try {
    const o = JSON.parse(localStorage.getItem(CP_KEY) || localStorage.getItem(CP_KEY_V1) || 'null');
    if (o) { Object.assign(CP, o); if (!CP.o) CP.o = {}; if (CP.canvas && !CP.o.cvType) { CP.o.cvType = 'solid'; CP.o.cvColor = CP.canvas; } CP.canvas = ''; }
  } catch (e) { /* ignore */ }
  Object.assign(customIcons, CP.icons);
  cpApplyAll();
  cpLoadAssets();
}
function cpChanged() { cpOverrides(); cpSave(); }
function cpSetPreset(id) { CP.preset = id; cpApply(); cpSave(); cpRefreshDlg(); }
function cpResetAll() {
  CP.preset = 'default'; CP.custom = null; CP.canvas = ''; CP.icons = {}; CP.o = {};
  for (const k in customIcons) delete customIcons[k];
  for (const k of Object.keys(CP_ASSETS)) cpSetAsset(k, null);
  cpApplyAll(); cpSave(); cpRefreshIcons(); cpRefreshDlg();
  toast('Interface reset to default');
}
const CP_SECTION_KEYS = {
  colors: ['col'], text: ['font', 'fontSize', 'bold', 'letter', 'headerCase'],
  layout: ['scale', 'radius', 'border', 'density', 'iconSize', 'toolCols', 'dockL', 'dockR', 'tlH', 'toolSide', 'swapDocks', 'cmdPos', 'tlPos', 'hideStatus', 'hideTabs', 'hideCmd'],
  icons: ['iconColor', 'iconOn', 'iconStroke'], canvas: ['cvType', 'cvColor', 'cvColor2', 'cvAngle', 'cvSize', 'cvFit', 'cvShadow', 'cvBorder', 'cvBorderW'],
  cursor: ['curColor', 'curWidth', 'curCross', 'curShadow'], effects: ['panelAlpha', 'blur', 'shadow', 'anim', 'glow', 'wallFit']
};
function cpResetSection(sec) {
  const o = cpO();
  for (const k of CP_SECTION_KEYS[sec] || []) delete o[k];
  if (sec === 'colors') { CP.preset = 'default'; CP.custom = null; cpApply(); }
  if (sec === 'icons') { CP.icons = {}; for (const k in customIcons) delete customIcons[k]; cpRefreshIcons(); }
  if (sec === 'canvas') cpSetAsset('cvImage', null);
  if (sec === 'effects') cpSetAsset('wallpaper', null);
  if (sec === 'text') cpSetAsset('font', null);
  cpChanged(); cpRefreshDlg();
}

/* ---- saved themes, import / export ---- */
const blobToURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function cpSnapshot() {
  const assets = {};
  for (const k of Object.keys(CP_ASSETS)) { try { assets[k] = await blobToURL(await (await fetch(CP_ASSETS[k])).blob()); } catch (e) { /* skip */ } }
  return { format: 'sketchforge-theme', version: 2, preset: CP.preset, custom: CP.custom, icons: CP.icons, o: JSON.parse(JSON.stringify(cpO())), assets };
}
async function cpRestore(t) {
  if (!t || t.format !== 'sketchforge-theme') throw new Error('Not a Sketchforge theme file');
  CP.preset = t.preset || 'default'; CP.custom = t.custom || null; CP.icons = t.icons || {}; CP.o = t.o || {};
  for (const k in customIcons) delete customIcons[k]; Object.assign(customIcons, CP.icons);
  for (const k of ['cvImage', 'wallpaper', 'font']) await cpSetAsset(k, t.assets && t.assets[k] ? await (await fetch(t.assets[k])).blob() : null);
  cpApplyAll(); cpSave(); cpRefreshIcons(); cpRefreshDlg();
}
async function cpSaveTheme() {
  const name = prompt('Name for this theme', 'My theme ' + new Date().toLocaleDateString()); if (!name) return;
  const snap = await cpSnapshot(); snap.name = name;
  await cpDBdo('themes', 'readwrite', s => s.put(snap)); toast('Theme "' + name + '" saved'); cpRefreshDlg();
}
async function cpListThemes() { return (await cpDBdo('themes', 'readonly', s => s.getAll()).catch(() => null)) || []; }
async function cpExportTheme() { const snap = await cpSnapshot(); download(new Blob([JSON.stringify(snap)], { type: 'application/json' }), 'sketchforge-theme.sftheme'); }
function cpImportTheme() { pickFile('.sftheme,application/json', async f => { try { await cpRestore(JSON.parse(await readFile(f, true))); toast('Theme imported'); } catch (e) { toast(e.message); } }); }
function cpSurprise() {
  const h = Math.random() * 360, dark = Math.random() < 0.75, hsl = (h2, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h2 / 60) % 2 - 1)), m = l - c / 2; const [r, g, b] = h2 < 60 ? [c, x, 0] : h2 < 120 ? [x, c, 0] : h2 < 180 ? [0, c, x] : h2 < 240 ? [0, x, c] : h2 < 300 ? [x, 0, c] : [c, 0, x]; return cpHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]); };
  CP.custom = dark ? { bg: hsl(h, 0.25, 0.1), panel: hsl(h, 0.22, 0.16), text: hsl(h, 0.2, 0.9), accent: hsl((h + 140 + Math.random() * 80) % 360, 0.85, 0.6) }
    : { bg: hsl(h, 0.25, 0.84), panel: hsl(h, 0.3, 0.95), text: hsl(h, 0.3, 0.15), accent: hsl((h + 140 + Math.random() * 80) % 360, 0.75, 0.45) };
  CP.preset = 'custom'; cpApply(); cpSave(); cpRefreshDlg();
}

/* ---- icons ---- */
function cpRefreshIcons() {
  applyIcons(); buildToolbox(); selectTool(state.tool); setPlayIcon(); renderLayers();
  document.querySelectorAll('#subtoolBar button[data-ic]').forEach(b => { b.innerHTML = icon(b.dataset.ic); });
}
/* Any image the browser can decode → 64×64 PNG, contained and centred. */
function cpImageToIcon(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const S = 64, c = makeCanvas(S, S), g = c.getContext('2d'), w = im.naturalWidth || S, h = im.naturalHeight || S, k = Math.min(S / w, S / h);
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, (S - w * k) / 2, (S - h * k) / 2, w * k, h * k);
      URL.revokeObjectURL(url); res(c.toDataURL('image/png'));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('This file is not an image the browser can open')); };
    im.src = url;
  });
}
async function cpSetIcon(name, file) {
  try {
    const data = await cpImageToIcon(file);
    CP.icons[name] = data; customIcons[name] = data;
    if (!cpSave()) { delete CP.icons[name]; delete customIcons[name]; }
    cpRefreshIcons(); cpRefreshDlg();
  } catch (e) { toast(e.message); }
}
function cpClearIcon(name) { delete CP.icons[name]; delete customIcons[name]; cpSave(); cpRefreshIcons(); cpRefreshDlg(); }
const cpIconLabel = k => k.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase());

/* ---- the studio dialog ---- */
const CP_SECTIONS = [['themes', '🎭', 'Themes'], ['colors', '🎨', 'Colours'], ['icons', '✏️', 'Icons'], ['text', '🔤', 'Text'], ['layout', '📐', 'Layout'], ['canvas', '🖼', 'Canvas'], ['cursor', '🎯', 'Cursor'], ['effects', '✨', 'Effects']];
let cpTab = 'themes';
function cpOpen(tab) {
  if (tab && CP_SECTIONS.some(x => x[0] === tab)) cpTab = tab;
  let d = $('#cpDialog');
  if (!d) { d = document.createElement('dialog'); d.id = 'cpDialog'; d.className = 'csdlg cpdlg'; document.body.appendChild(d); }
  cpRefreshDlg(true);
  if (!d.open) d.showModal();
}
/* small control builders: each returns an element; changes apply live */
function cpRow(label, ctrl, onReset, hint) {
  const r = document.createElement('div'); r.className = 'cprow';
  const l = document.createElement('span'); l.className = 'cplbl'; l.textContent = label; if (hint) l.title = hint;
  r.append(l, ctrl);
  if (onReset) { const b = document.createElement('button'); b.type = 'button'; b.className = 'cpreset'; b.textContent = '↺'; b.title = 'Back to default'; b.onclick = onReset; r.appendChild(b); }
  return r;
}
function cpColor(label, get, set, auto) {
  const w = document.createElement('label'); w.className = 'cpcard' + (get() ? ' set' : ''); w.dataset.label = label;
  const i = document.createElement('input'); i.type = 'color'; i.value = get() || auto || '#808080';
  const t = document.createElement('span'); t.textContent = label;
  i.oninput = () => { set(i.value); w.classList.add('set'); cpOverrides(); }; i.onchange = () => cpSave();
  const r = document.createElement('button'); r.type = 'button'; r.className = 'cpreset'; r.textContent = '↺'; r.title = 'Back to the theme colour';
  r.onclick = e => { e.preventDefault(); set(null); cpChanged(); cpRefreshDlg(); };
  w.append(i, t, r);
  return w;
}
/* colour cards sit in a grid, like the original picker layout */
function cpCards(...cards) { const g = document.createElement('div'); g.className = 'cpPickers'; g.append(...cards.flat().filter(Boolean)); return g; }
function cpRange(label, min, max, step, get, set, fmt, def) {
  const w = document.createElement('span'); w.className = 'cprange';
  const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = get() ?? def;
  const o = document.createElement('output'); o.textContent = fmt(+i.value);
  i.oninput = () => { set(+i.value); o.textContent = fmt(+i.value); cpOverrides(); }; i.onchange = () => cpSave();
  w.append(i, o);
  return cpRow(label, w, () => { set(null); cpChanged(); cpRefreshDlg(); });
}
function cpSelect(label, opts, get, set) {
  const s = document.createElement('select');
  for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; if ((get() ?? '') === v) o.selected = true; s.appendChild(o); }
  s.onchange = () => { set(s.value || null); cpChanged(); cpRefreshDlg(); };
  return cpRow(label, s, () => { set(null); cpChanged(); cpRefreshDlg(); });
}
function cpToggle(label, get, set) {
  const l = document.createElement('label'); l.className = 'cptoggle';
  const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!get();
  i.onchange = () => { set(i.checked || null); cpChanged(); };
  l.append(i, document.createTextNode(' ' + label));
  return l;
}
function cpBtn(text, fn, cls) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; if (cls) b.className = cls; b.onclick = fn; return b; }
function cpGroup(title, ...kids) { const g = document.createElement('div'); g.className = 'cpgroup'; const h = document.createElement('div'); h.className = 'grp'; h.textContent = title; g.append(h, ...kids.flat().filter(Boolean)); return g; }
function cpImagePicker(label, key, onSet) {
  const w = document.createElement('span'); w.className = 'cpcolor';
  const has = !!CP_ASSETS[key];
  w.append(cpBtn(has ? 'Change image…' : 'Choose image…', () => pickFile(key === 'font' ? '.ttf,.otf,.woff,.woff2' : 'image/*', async f => { await cpSetAsset(key, f); if (onSet) onSet(); cpChanged(); cpRefreshDlg(); })));
  if (has && key !== 'font') { const im = document.createElement('img'); im.src = CP_ASSETS[key]; im.className = 'cpthumb'; w.appendChild(im); }
  if (has && key === 'font') { const s = document.createElement('span'); s.className = 'small'; s.textContent = ' loaded'; w.appendChild(s); }
  return cpRow(label, w, has ? async () => { await cpSetAsset(key, null); cpChanged(); cpRefreshDlg(); } : null);
}
const O = k => () => cpO()[k], S = k => v => { if (v === null || v === undefined || v === '') delete cpO()[k]; else cpO()[k] = v; };
const C = k => () => (cpO().col || {})[k], CS = k => v => { const c = cpO().col || (cpO().col = {}); if (v) c[k] = v; else delete c[k]; };
function cpAutoColor(sel, prop = 'backgroundColor') { const el = document.querySelector(sel.split(',')[0]); if (!el) return null; const c = cpParse(getComputedStyle(el)[prop] || ''); return c && c[3] > 0 ? cpHex(c) : null; }

async function cpSectionBody(sec) {
  const b = document.createElement('div'), o = cpO();
  const swatch = th => { const c = th || CP_DEFAULT; return `<span class="cpsw"><i style="background:${c.bg}"></i><i style="background:${c.panel}"></i><i style="background:${c.text}"></i><i style="background:${c.accent}"></i></span>`; };
  if (sec === 'themes') {
    const grid = document.createElement('div'); grid.className = 'cpPresets';
    for (const [k, [n, th]] of Object.entries(CP_THEMES)) { const x = document.createElement('button'); x.type = 'button'; x.dataset.preset = k; x.className = CP.preset === k ? 'on' : ''; x.innerHTML = swatch(th) + `<span>${n}</span>`; x.onclick = () => cpSetPreset(k); grid.appendChild(x); }
    const mine = document.createElement('button'); mine.type = 'button'; mine.dataset.preset = 'custom'; mine.className = CP.preset === 'custom' ? 'on' : ''; mine.innerHTML = swatch(CP.custom) + '<span>My colours</span>'; mine.onclick = () => { if (!CP.custom) CP.custom = { ...(cpTheme() || CP_DEFAULT) }; cpSetPreset('custom'); }; grid.appendChild(mine);
    const lay = document.createElement('div'); lay.className = 'cpbtns';
    for (const [k, [n, v]] of Object.entries(CP_LAYOUTS)) lay.appendChild(cpBtn(n, () => { Object.assign(cpO(), v); cpChanged(); cpRefreshDlg(); toast('Layout: ' + n); }));
    const themes = await cpListThemes(), saved = document.createElement('div'); saved.className = 'cpbtns';
    if (!themes.length) saved.innerHTML = '<span class="muted small">No saved themes yet.</span>';
    for (const t of themes) { const w = document.createElement('span'); w.className = 'cpsaved'; w.append(cpBtn(t.name, () => cpRestore(t).then(() => toast('Theme "' + t.name + '" applied'))), cpBtn('×', async () => { if (confirm('Delete theme "' + t.name + '"?')) { await cpDBdo('themes', 'readwrite', s => s.delete(t.name)); cpRefreshDlg(); } }, 'cpx')); saved.appendChild(w); }
    const act = document.createElement('div'); act.className = 'cpbtns';
    act.append(cpBtn('🎲 Surprise me', cpSurprise), cpBtn('💾 Save current as theme…', cpSaveTheme), cpBtn('⬇ Export theme file', cpExportTheme), cpBtn('⬆ Import theme file…', cpImportTheme));
    b.append(cpGroup('Colour themes', grid), cpGroup('Layout styles', lay), cpGroup('My saved themes', saved), cpGroup('More', act));
  } else if (sec === 'colors') {
    const cur = CP.custom || cpTheme() || CP_DEFAULT;
    const base = [['bg', 'Background'], ['panel', 'Panels'], ['text', 'Text'], ['accent', 'Accent']].map(([k, n]) => {
      const w = document.createElement('label'); w.className = 'cpcard set'; w.dataset.label = n;
      const i = document.createElement('input'); i.type = 'color'; i.dataset.ck = k; i.value = cur[k];
      i.oninput = () => { if (CP.preset !== 'custom') { CP.custom = { ...(cpTheme() || CP_DEFAULT) }; CP.preset = 'custom'; } CP.custom[k] = i.value; cpApply(); cpOverrides(); }; i.onchange = () => cpSave();
      const t = document.createElement('span'); t.textContent = n; w.append(i, t); return w;
    });
    const areas = CP_AREAS.map(([k, n, sel]) => cpColor(n, C(k), CS(k), cpAutoColor(sel)));
    const texts = CP_TEXTS.map(([k, n]) => cpColor(n, C(k), CS(k)));
    b.append(cpGroup('My colours (the whole interface follows)', cpCards(base)), cpGroup('Each part of the interface', cpCards(areas)), cpGroup('Text, lines & details', cpCards(texts)),
      Object.assign(document.createElement('p'), { className: 'muted small', textContent: 'Text on a coloured area switches between light and dark automatically so it stays readable. ↺ puts one colour back.' }));
  } else if (sec === 'text') {
    b.append(cpGroup('Font',
      cpSelect('Interface font', CP_FONTS, O('font'), S('font')),
      cpImagePicker('My font file (.ttf .otf .woff)', 'font', () => { cpO().font = 'SFUserFont, system-ui, sans-serif'; }),
      cpRange('Text size', 80, 150, 5, O('fontSize'), S('fontSize'), v => v + '%', 100),
      cpToggle('Bold text everywhere', O('bold'), S('bold')),
      cpRange('Letter spacing', 0, 20, 1, O('letter'), S('letter'), v => (v / 10).toFixed(1) + ' px', 0),
      cpSelect('Panel titles', [['', 'As the theme'], ['upper', 'UPPERCASE'], ['title', 'Title Case'], ['normal', 'Normal']], O('headerCase'), S('headerCase'))));
  } else if (sec === 'layout') {
    b.append(cpGroup('Size & shape',
      cpRange('Interface scale', 70, 160, 5, O('scale'), S('scale'), v => v + '%', 100),
      cpRange('Roundness', 0, 20, 1, O('radius'), S('radius'), v => v + ' px', 4),
      cpRange('Border thickness', 0, 4, 1, O('border'), S('border'), v => v + ' px', 1),
      cpSelect('Spacing', [['', 'Normal'], ['compact', 'Compact'], ['comfy', 'Comfortable (touch)']], O('density'), S('density'))),
    cpGroup('Panels',
      cpRange('Tool palette icons', 14, 34, 1, O('iconSize'), S('iconSize'), v => v + ' px', 20),
      cpSelect('Tool palette columns', [['', 'As View menu'], ['1', '1 column'], ['2', '2 columns'], ['3', '3 columns']], () => o.toolCols ? String(o.toolCols) : '', v => S('toolCols')(v ? +v : null)),
      cpRange('Left panel width', 160, 420, 5, O('dockL'), S('dockL'), v => v + ' px', 224),
      cpRange('Right panel width', 160, 460, 5, O('dockR'), S('dockR'), v => v + ' px', 250),
      cpRange('Timeline height', 110, 420, 5, O('tlH'), S('tlH'), v => v + ' px', 180)),
    cpGroup('Arrangement',
      cpSelect('Tool palette side', [['', 'Left'], ['right', 'Right']], O('toolSide'), S('toolSide')),
      cpToggle('Swap left and right panels', O('swapDocks'), S('swapDocks')),
      cpSelect('Command bar', [['', 'Top'], ['bottom', 'Bottom']], O('cmdPos'), S('cmdPos')),
      cpSelect('Timeline', [['', 'Below the canvas'], ['top', 'Above the canvas']], O('tlPos'), S('tlPos')),
      cpToggle('Hide the status bar', O('hideStatus'), S('hideStatus')),
      cpToggle('Hide the document tabs', O('hideTabs'), S('hideTabs')),
      cpToggle('Hide the command bar', O('hideCmd'), S('hideCmd'))));
  } else if (sec === 'icons') {
    const names = Object.keys(IC).sort(), grid = document.createElement('div'); grid.className = 'cpIcons';
    grid.innerHTML = names.map(k => `<div class="cpIcon ${customIcons[k] ? 'custom' : ''}" data-ik="${k}" title="${cpIconLabel(k)}"><button type="button" class="cpPick">${icon(k)}</button><span>${cpIconLabel(k)}</span>${customIcons[k] ? '<button type="button" class="cpX" title="Restore original">×</button>' : ''}</div>`).join('');
    grid.querySelectorAll('.cpIcon').forEach(cell => {
      const k = cell.dataset.ik;
      cell.querySelector('.cpPick').onclick = () => pickFile('image/*,.svg,.ico,.bmp,.webp,.avif,.gif', f => cpSetIcon(k, f));
      const x = cell.querySelector('.cpX'); if (x) x.onclick = () => cpClearIcon(k);
    });
    b.append(Object.assign(document.createElement('p'), { className: 'muted small', textContent: 'Click an icon to replace it with any image (PNG, JPG, GIF, WebP, SVG, BMP, ICO…). It is resized to icon size automatically. × puts the original back.' }), grid, cpGroup('Look of all icons',
      cpCards(cpColor('Icon colour', O('iconColor'), S('iconColor'), cpAutoColor('#toolbox .tool', 'color')), cpColor('Selected tool icon', O('iconOn'), S('iconOn'))),
      cpRange('Line thickness', 0.8, 3.2, 0.1, O('iconStroke'), S('iconStroke'), v => v.toFixed(1), 1.8),
      cpRange('Tool palette icon size', 14, 34, 1, O('iconSize'), S('iconSize'), v => v + ' px', 20)));
  } else if (sec === 'canvas') {
    b.append(cpGroup('Background around the drawing',
      cpSelect('Style', [['', 'Theme colour'], ['solid', 'Solid colour'], ['gradient', 'Gradient'], ['radial', 'Radial glow'], ['checker', 'Checkerboard'], ['dots', 'Dots'], ['grid', 'Grid lines'], ['image', 'My image']], O('cvType'), S('cvType')),
      o.cvType && o.cvType !== 'theme' ? cpCards(cpColor('Colour', O('cvColor'), S('cvColor'), cpAutoColor('#viewport')), ['gradient', 'radial', 'checker', 'dots', 'grid'].includes(o.cvType) ? cpColor('Second colour', O('cvColor2'), S('cvColor2'), '#2b2b2b') : null) : null,
      o.cvType === 'gradient' ? cpRange('Gradient angle', 0, 360, 5, O('cvAngle'), S('cvAngle'), v => v + '°', 160) : null,
      ['checker', 'dots', 'grid'].includes(o.cvType) ? cpRange('Pattern size', 6, 80, 2, O('cvSize'), S('cvSize'), v => v + ' px', 24) : null,
      o.cvType === 'image' ? cpImagePicker('Image', 'cvImage') : null,
      o.cvType === 'image' ? cpSelect('Image fit', [['', 'Fill'], ['contain', 'Whole image'], ['tile', 'Tile']], O('cvFit'), S('cvFit')) : null),
    cpGroup('The drawing sheet',
      cpRange('Shadow', 0, 100, 5, O('cvShadow'), S('cvShadow'), v => v + '%', 30),
      cpCards(cpColor('Border colour', O('cvBorder'), S('cvBorder'))),
      cpRange('Border thickness', 1, 6, 1, O('cvBorderW'), S('cvBorderW'), v => v + ' px', 1)));
  } else if (sec === 'cursor') {
    b.append(cpGroup('Brush cursor',
      cpCards(cpColor('Outline colour', O('curColor'), S('curColor'), '#ffffff')),
      cpRange('Outline thickness', 1, 4, 1, O('curWidth'), S('curWidth'), v => v + ' px', 1),
      cpToggle('Cross in the centre', O('curCross'), S('curCross')),
      cpToggle('Dark outline around it (visible on white)', () => o.curShadow !== false, v => { if (v) delete o.curShadow; else o.curShadow = false; })));
  } else if (sec === 'effects') {
    b.append(cpGroup('Wallpaper & glass',
      cpImagePicker('Wallpaper behind the whole app', 'wallpaper', () => { if ((o.panelAlpha ?? 100) === 100) o.panelAlpha = 80; }),
      CP_ASSETS.wallpaper ? cpSelect('Wallpaper fit', [['', 'Fill'], ['tile', 'Tile']], O('wallFit'), S('wallFit')) : null,
      cpRange('Panel opacity', 30, 100, 5, O('panelAlpha'), S('panelAlpha'), v => v + '%', 100),
      cpRange('Glass blur behind panels', 0, 24, 1, O('blur'), S('blur'), v => v + ' px', 0)),
    cpGroup('Depth & motion',
      cpRange('Panel shadows', 0, 100, 5, O('shadow'), S('shadow'), v => v + '%', 0),
      cpToggle('Smooth animations', O('anim'), S('anim')),
      cpToggle('Glow on the selected tool, layer and tab', O('glow'), S('glow'))));
  }
  return b;
}
async function cpRefreshDlg(force) {
  const d = $('#cpDialog'); if (!d || (!d.open && !force)) return;
  const body = await cpSectionBody(cpTab), sc = d.querySelector('.cpBody') ? d.querySelector('.cpBody').scrollTop : 0;
  d.innerHTML = `<form method="dialog"><h5>🎨 Custom P — customise the interface</h5><div class="cpwrap"><nav class="cpTabs"></nav><div class="cpBody"></div></div>
    <div class="dialog-actions"><button type="button" id="cpReset">Reset to default</button><button type="button" id="cpResetSec" class="cplink">Reset this tab</button><span style="flex:1"></span><button type="button" id="cpClose" class="primary">Done</button></div></form>`;
  const nav = d.querySelector('.cpTabs');
  for (const [k, , n] of CP_SECTIONS) { const x = cpBtn(n, () => { cpTab = k; cpRefreshDlg(); }, cpTab === k ? 'on' : ''); x.dataset.tab = k; nav.appendChild(x); }
  d.querySelector('.cpBody').appendChild(body);
  d.querySelector('.cpBody').scrollTop = sc;
  d.querySelector('#cpResetSec').onclick = () => { if (cpTab === 'themes') { if (confirm('Back to the default colours and layout?')) { CP.preset = 'default'; CP.custom = null; CP.o = {}; cpApplyAll(); cpSave(); cpRefreshDlg(); } } else cpResetSection(cpTab); };
  d.querySelector('#cpReset').onclick = () => { if (confirm('Reset colours, layout, fonts, icons and effects to the default?')) cpResetAll(); };
  d.querySelector('#cpClose').onclick = () => d.close();
}

function installCustomP() {
  const CPM = 'cpTheme_';
  Object.assign(CMD, { cpOpen: () => cpOpen('themes'), cpIcons: () => cpOpen('icons'), cpReset: () => { if (confirm('Reset colours, layout, fonts, icons and effects to the default?')) cpResetAll(); },
    cpSurprise, cpExport: cpExportTheme, cpImport: cpImportTheme, cpSaveTheme });
  for (const k in CP_THEMES) CMD[CPM + k] = () => { cpSetPreset(k); toast('Colour mode: ' + CP_THEMES[k][0]); };
  for (const [sec, , n] of CP_SECTIONS) CMD['cpSec_' + sec] = () => cpOpen(sec);
  const items = [['Customise the interface…', 'cpOpen'], '-', ...CP_SECTIONS.slice(1).map(([sec, e, n]) => [e + ' ' + n + '…', 'cpSec_' + sec]), '-',
    ...Object.entries(CP_THEMES).map(([k, [n]]) => ['Colour mode: ' + n, CPM + k]), '-',
    ['🎲 Surprise me (random theme)', 'cpSurprise'], ['💾 Save current as theme…', 'cpSaveTheme'], ['⬇ Export theme file', 'cpExport'], ['⬆ Import theme file…', 'cpImport'], '-', ['Reset to default', 'cpReset']];
  const at = MENUS.findIndex(m => m[0] === 'Add-ons');
  MENUS.splice(at < 0 ? MENUS.length - 1 : at + 1, 0, ['🎨 Custom P', items]);
}
