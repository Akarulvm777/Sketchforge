/* ---------- 🎨 Custom P: interface colours (presets + custom), custom icons, reset ----------
   Colours: every colour in style.css is repainted. Greys are mapped by brightness onto the theme's
   ramp (deep → line → background → panel → muted → text), the copper accent and the slate-blue selection
   map to the theme accent, other saturated colours (record red, symmetry pink...) are kept.
   Icons: icon(name) in p00 returns customIcons[name] when set (an image scaled to 64 px, shown in the
   same 24×24 SVG box as the built-in icons). Everything is stored in localStorage (CP_KEY). */
const CP_KEY = 'sketchforge.customp.v1';
const CP = { preset: 'default', custom: null, canvas: '', icons: {} };
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
  contrast: ['High contrast', { bg: '#000000', panel: '#121212', text: '#ffffff', accent: '#ffd400' }]
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
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) { /* file:// or cross-origin sheet: variables only */ } }
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

/* ---- persistence ---- */
function cpSave() {
  try { localStorage.setItem(CP_KEY, JSON.stringify(CP)); return true; }
  catch (e) { toast('Could not save: browser storage is full (try smaller or fewer icons)'); return false; }
}
function loadCustomP() {
  try { const o = JSON.parse(localStorage.getItem(CP_KEY) || 'null'); if (o) Object.assign(CP, o); } catch (e) { /* ignore */ }
  Object.assign(customIcons, CP.icons);
  if (CP.preset !== 'default' || CP.canvas) cpApply();
}
function cpSetPreset(id) { CP.preset = id; cpApply(); cpSave(); cpRefreshDlg(); }
function cpResetAll() {
  CP.preset = 'default'; CP.custom = null; CP.canvas = ''; CP.icons = {};
  for (const k in customIcons) delete customIcons[k];
  cpApply(); cpSave(); cpRefreshIcons(); cpRefreshDlg();
  toast('Interface reset to default');
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

/* ---- dialog ---- */
let cpTab = 'colors';
function cpOpen(tab) {
  if (tab) cpTab = tab;
  let d = $('#cpDialog');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'cpDialog'; d.className = 'csdlg cpdlg';
    document.body.appendChild(d);
  }
  cpRefreshDlg(true);
  if (!d.open) d.showModal();
}
function cpRefreshDlg(force) {
  const d = $('#cpDialog'); if (!d || (!d.open && !force)) return;
  const t = cpTheme() || CP_DEFAULT, cur = CP.custom || t;
  const swatch = th => { const c = th || CP_DEFAULT; return `<span class="cpsw"><i style="background:${c.bg}"></i><i style="background:${c.panel}"></i><i style="background:${c.text}"></i><i style="background:${c.accent}"></i></span>`; };
  const colors = `
    <div class="grp">Colour modes</div>
    <div class="cpPresets">${Object.entries(CP_THEMES).map(([k, [n, th]]) => `<button type="button" data-preset="${k}" class="${CP.preset === k ? 'on' : ''}">${swatch(th)}<span>${n}</span></button>`).join('')}
      <button type="button" data-preset="custom" class="${CP.preset === 'custom' ? 'on' : ''}">${swatch(CP.custom)}<span>My colours</span></button></div>
    <div class="grp">My colours</div>
    <div class="cpPickers">
      ${[['bg', 'Background'], ['panel', 'Panels'], ['text', 'Text'], ['accent', 'Accent']].map(([k, n]) => `<label><input type="color" data-ck="${k}" value="${cur[k]}"><span>${n}</span></label>`).join('')}
      <label><input type="color" id="cpCanvas" value="${CP.canvas || '#4b4b4b'}"><span>Canvas area</span></label>
      <label class="check"><input type="checkbox" id="cpCanvasOn" ${CP.canvas ? 'checked' : ''}> custom canvas area</label>
    </div>
    <p class="muted small">Pick any colour: the whole interface follows live. Changing a colour switches to "My colours".</p>`;
  const names = Object.keys(IC).sort();
  const icons = `
    <p class="muted small" style="margin-top:0">Click an icon to replace it with any image (PNG, JPG, GIF, WebP, SVG, BMP, ICO…). It is resized to icon size automatically. × puts the original back.</p>
    <div class="cpIcons">${names.map(k => `<div class="cpIcon ${customIcons[k] ? 'custom' : ''}" data-ik="${k}" title="${cpIconLabel(k)}"><button type="button" class="cpPick">${icon(k)}</button><span>${cpIconLabel(k)}</span>${customIcons[k] ? '<button type="button" class="cpX" title="Restore original">×</button>' : ''}</div>`).join('')}</div>`;
  d.innerHTML = `<form method="dialog"><h5>🎨 Custom P — customise the interface</h5>
    <div class="cpTabs"><button type="button" data-tab="colors" class="${cpTab === 'colors' ? 'on' : ''}">Colours</button><button type="button" data-tab="icons" class="${cpTab === 'icons' ? 'on' : ''}">Icons</button></div>
    <div class="cpBody">${cpTab === 'colors' ? colors : icons}</div>
    <div class="dialog-actions"><button type="button" id="cpReset">Reset to default</button><span style="flex:1"></span><button type="button" id="cpClose" class="primary">Done</button></div></form>`;
  d.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { cpTab = b.dataset.tab; cpRefreshDlg(); });
  d.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { if (b.dataset.preset === 'custom' && !CP.custom) CP.custom = { ...(cpTheme() || CP_DEFAULT) }; cpSetPreset(b.dataset.preset); });
  d.querySelectorAll('[data-ck]').forEach(inp => inp.oninput = () => {
    if (CP.preset !== 'custom') { CP.custom = { ...(cpTheme() || CP_DEFAULT) }; CP.preset = 'custom'; }
    CP.custom[inp.dataset.ck] = inp.value; cpApply();
    d.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('on', b.dataset.preset === 'custom'));
  });
  d.querySelectorAll('[data-ck]').forEach(inp => inp.onchange = () => { cpSave(); cpRefreshDlg(); });
  const cv = d.querySelector('#cpCanvas'), cvOn = d.querySelector('#cpCanvasOn');
  if (cv) { cv.oninput = () => { CP.canvas = cv.value; cvOn.checked = true; cpApply(); }; cv.onchange = cpSave; cvOn.onchange = () => { CP.canvas = cvOn.checked ? cv.value : ''; cpApply(); cpSave(); }; }
  d.querySelectorAll('.cpIcon').forEach(cell => {
    const k = cell.dataset.ik;
    cell.querySelector('.cpPick').onclick = () => pickFile('image/*,.svg,.ico,.bmp,.webp,.avif,.gif', f => cpSetIcon(k, f));
    const x = cell.querySelector('.cpX'); if (x) x.onclick = () => cpClearIcon(k);
  });
  d.querySelector('#cpReset').onclick = () => { if (confirm('Reset colours and icons to the default?')) cpResetAll(); };
  d.querySelector('#cpClose').onclick = () => d.close();
}

function installCustomP() {
  const CPM = 'cpTheme_';
  Object.assign(CMD, { cpOpen: () => cpOpen('colors'), cpIcons: () => cpOpen('icons'), cpReset: () => { if (confirm('Reset colours and icons to the default?')) cpResetAll(); } });
  for (const k in CP_THEMES) CMD[CPM + k] = () => { cpSetPreset(k); toast('Colour mode: ' + CP_THEMES[k][0]); };
  const items = [['Customise interface…', 'cpOpen'], '-', ...Object.entries(CP_THEMES).map(([k, [n]]) => ['Colour mode: ' + n, CPM + k]), '-',
    ['Change icons…', 'cpIcons'], '-', ['Reset to default', 'cpReset']];
  const at = MENUS.findIndex(m => m[0] === 'Add-ons');
  MENUS.splice(at < 0 ? MENUS.length - 1 : at + 1, 0, ['🎨 Custom P', items]);
}
