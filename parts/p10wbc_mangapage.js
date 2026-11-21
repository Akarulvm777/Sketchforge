/* ---------- Manga page setup (File › New manga page…, Manga menu) ----------
   One dialog makes a ready-to-draw manga / comic page: page size (phone, B5 / A4 print at 350 dpi, square, webtoon),
   a panel layout drawn on its own "Panels" layer (gutter and border width), print guides (trim / safe area, the
   existing drawGuides on a draft layer: never exported) and the usual layers: Colour, Tone, Ink, Text & balloons.
   Panel layouts are rectangles in page fractions (MANGA_LAYOUTS). */
const MANGA_SIZES = { phone: ['Phone / web (1200 × 1800)', 1200, 1800, 144], b5: ['Manga B5 print (350 dpi)', 2508, 3541, 350], a4: ['A4 print (350 dpi)', 2480, 3508, 350], square: ['Square post (2000 × 2000)', 2000, 2000, 144], webtoon: ['Webtoon strip (800 × 6400)', 800, 6400, 72] };
const MANGA_LAYOUTS = {
  none: ['No panels', []],
  one: ['1 panel', [[0, 0, 1, 1]]],
  two: ['2 panels (stacked)', [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]]],
  three: ['3 panels (stacked)', [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]]],
  grid4: ['4 panels (2 × 2)', [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]]],
  grid6: ['6 panels (2 × 3)', [0, 1, 2].flatMap(r => [[0, r / 3, 0.5, 1 / 3], [0.5, r / 3, 0.5, 1 / 3]])],
  classic: ['Classic manga (5 panels)', [[0, 0, 1, 0.3], [0, 0.3, 0.42, 0.35], [0.42, 0.3, 0.58, 0.35], [0, 0.65, 0.62, 0.35], [0.62, 0.65, 0.38, 0.35]]],
  yonkoma: ['4-panel strip (yonkoma)', [0, 1, 2, 3].map(r => [0.18, r / 4, 0.64, 0.25])]
};
function mangaPanels(layer, layout, gutter, lw, margin) {
  const L = MANGA_LAYOUTS[layout]; if (!L || !L[1].length) return 0;
  const W = state.w - 2 * margin, H = state.h - 2 * margin, g = layer.cels.get(0).getContext('2d');
  g.strokeStyle = '#000000'; g.lineWidth = lw; g.lineJoin = 'miter';
  for (const [fx, fy, fw, fh] of L[1]) {
    const x = margin + fx * W + gutter / 2, y = margin + fy * H + gutter / 2, w = fw * W - gutter, h = fh * H - gutter;
    if (w > lw * 2 && h > lw * 2) g.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
  }
  layer.cels.get(0)._ink = true; layer.cels.get(0)._sv = (layer.cels.get(0)._sv || 0) + 1;
  return L[1].length;
}
function newMangaPage() {
  proDialog('📖 New manga page', [
    { k: 'size', label: 'Page', type: 'select', val: 'phone', options: Object.entries(MANGA_SIZES).map(([k, v]) => [k, v[0]]) },
    { k: 'layout', label: 'Panels', type: 'select', val: 'classic', options: Object.entries(MANGA_LAYOUTS).map(([k, v]) => [k, v[0]]) },
    { k: 'gutter', label: 'Space between panels', type: 'range', min: 0, max: 80, val: 24 },
    { k: 'lw', label: 'Panel border width', type: 'range', min: 1, max: 20, val: 6 },
    { k: 'guides', label: 'Print guides (trim / safe area)', type: 'check', val: true },
    { k: 'layers', label: 'Layers for colour, tone, ink and text', type: 'check', val: true }
  ], p => {
    const [, w, h, dpi] = MANGA_SIZES[p.size] || MANGA_SIZES.phone;
    newDocument(w, h, 1, 12, false, 'Manga page');
    state.projectType = 'comic'; state.dpi = dpi;
    const k = Math.min(w, h) / 1200, margin = Math.round(Math.min(w, h) * 0.06);
    const add = (name, extra) => { const l = createLayer(name); l.cels = new Map([[0, makeCel(false)]]); Object.assign(l, extra || {}); state.layers.push(l); return l; };
    // keep the paper, replace the default drawing layer by the manga set
    state.layers = state.layers.filter(l => l.paper);
    if (p.layers) { add('Colour'); add('Tone'); add('Ink'); add('Text & balloons'); }
    else add('Layer 1');
    const panels = add('Panels', { locked: false });
    const n = mangaPanels(panels, p.layout, Math.round(p.gutter * k), Math.max(1, Math.round(p.lw * k)), margin);
    if (!n) state.layers = state.layers.filter(l => l !== panels);
    if (p.guides && typeof drawGuides === 'function') { const g = createLayer('Guides'); g.cels = new Map([[0, makeCel(false)]]); g.draft = true; drawGuides(g, w, h, 'comic', dpi); state.layers.splice(1, 0, g); }
    const ink = state.layers.find(l => l.name === 'Ink') || state.layers[state.layers.length - 1];
    state.activeId = ink.id; layerCounter = state.layers.length;
    history.undo.length = 0; history.redo.length = 0;
    setMode('draw', true); bindAll(0); refreshAll(); fit(); if (typeof syncTab === 'function') syncTab();
    toast(`Manga page ready: ${n ? n + ' panels, ' : ''}draw your lines on "Ink". Tones go on "Tone", speech on "Text & balloons".`, 5000);
  }, 'Create');
}
function installMangaPage() {
  CMD.newManga = newMangaPage;
  const F = MENUS.find(m => m[0] === 'File'); if (F) { const i = F[1].findIndex(x => Array.isArray(x) && x[1] === 'newDoc'); F[1].splice(i + 1, 0, ['📖 New manga page…', 'newManga']); }
  const M = MENUS.find(m => m[0] === 'Manga'); if (M) M[1].unshift(['📖 New manga page…', 'newManga'], '-');
}
