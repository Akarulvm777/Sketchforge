/* ---------- Tutorials for every tool (Help › Tutorials › Every tool) ----------
   One tutorial per tool group, one step per tool, made from GROUPS / TOOLDEF when the tutorials open — so a tool added
   later (built-in or imported .sut / .sfbrush / add-on) gets its step automatically. A step selects the tool, points at
   Tool Property, explains it (TOOL_TIPS, else a description made from the tool's kind and settings) and has
   "Try it": a practice page opens and the tool is used on it with synthetic pointer events (toolTry). */
const TOOL_GROUP_TIPS = {
  pen: 'Pens draw clean lines with pen pressure: thin when you press lightly, thick when you press hard. Best for line art.',
  pencil: 'Sketch tools have a grainy, textured line, like real pencil and charcoal on paper. Best for rough sketches.',
  brush: 'Brushes paint colour: soft airbrush-like brushes, watercolours that bleed, inks, oils and gouache that cover.',
  eraser: 'Erasers remove what is on the current layer. Hard = clean edge, soft = fades out, snap = removes whole lines.',
  blend: 'Blend tools mix the colours already on the layer: smooth transitions, blur, finger smudge.',
  liquify: 'Liquify pushes the pixels like warm wax: fix a face, an eye, a line without redrawing.',
  airbrush: 'Airbrushes spray soft colour or particles: shading, glow, texture.',
  decor: 'Decoration brushes stamp shapes along the stroke: sparkles, petals, hearts, bubbles, feathers.',
  tone: 'Manga tones fill an area with a dot, line or sand pattern fixed to the page, like screen tone stickers.',
  shade: 'Shading pens draw solid shadow, hatching, cross-hatching or stippling.',
  bone: 'The Bone tool links body parts drawn on separate layers so they move like a puppet.',
  fill: 'Fill colours a closed area in one click, or everything inside a lasso.',
  gradient: 'Gradients fill the layer (or the selection) with colours that change smoothly along a line you drag.',
  pick: 'The eyedropper picks a colour from the picture.',
  select: 'Selection tools choose an area: then painting, filling or moving only changes that area.',
  wand: 'Auto select chooses an area of the same colour in one click.',
  move: 'Move / transform moves, turns and scales a layer (and animates it with keyframes); puppet warp bends it with pins.',
  shape: 'Figures draw exact lines, rectangles, ellipses, polygons and curves with the current brush.',
  ruler: 'Rulers make your strokes follow a straight line, a perspective or a symmetry.',
  frame: 'Frame border cuts a manga page into panels.',
  balloon: 'Balloons add speech and thought bubbles.',
  text: 'Text writes words on the page.',
  hand: 'Navigate tools move, turn and zoom your view of the page (the drawing does not change).'
};
const TOOL_TIPS = {
  pen: 'A crisp, all-round inking pen.', realpen: 'An ink pen with a slightly rough, natural edge.', mapping: 'A thin, even pen for fine details and hatching.',
  turnip: 'A soft-edged pen with a big change between light and hard pressure.', callig: 'A flat calligraphy nib: the line is thick or thin depending on the direction.',
  textured: 'A pen with a paper texture in its line.', outlinemarker: 'Main colour inside, sub colour as an outline (set the sub colour in the second colour square).', neonpen: 'Main colour with a soft sub-colour glow, like a neon light.',
  pencil: 'A classic graphite pencil.', mech: 'A thin, hard mechanical pencil for clean sketches.', charcoal: 'A dark, grainy charcoal stick.', crayon: 'A waxy crayon with a broken, textured edge.', pastel: 'A soft chalky pastel.', chalk: 'Chalk with lots of paper grain.',
  brush: 'A soft round brush: shading and smooth colour.', marker: 'An even, flat marker.', wcround: 'A round watercolour brush: transparent colour with a darker edge.', wcflat: 'A flat watercolour brush for broad washes.',
  softbleed: 'Watercolour that bleeds softly into the paper.', wetwash: 'A big wet wash for skies and backgrounds.', roughwash: 'A rough, dry-ish watercolour stroke.', wcsplash: 'Watercolour splashes and drops.', wcwatery: 'Very watery colour that mixes with what is below.',
  brushpen: 'An ink brush pen: lively lines from thin to thick.', dryink: 'Dry ink with broken, scratchy strokes.', waterink: 'Watery ink that fades and pools.', blotink: 'Wet ink that blots like on absorbent paper.',
  oilpaint: 'Oil paint that mixes with the colour under the brush.', flatoil: 'A flat oil brush.', gouache: 'Opaque gouache that covers well.', impasto: 'Thick paint with visible brush marks.', acrylic: 'Acrylic paint: opaque and quick.',
  eraser: 'Erases with a clean, hard edge.', softeraser: 'Erases softly, like a soft brush.', kneaded: 'Lightens gently, like a kneaded eraser.', roughera: 'Erases with a rough, textured edge.', snapera: 'Erases a whole line up to where it crosses another line.',
  blend: 'Mixes neighbouring colours smoothly.', blurtool: 'Blurs where you paint.', finger: 'Smudges colour like a finger.',
  liquify: 'Drag on the picture to push, pull or twist it (options in Tool Property).',
  airbrush: 'Soft sprayed colour that builds up.', spray: 'Sprays fine dots of colour.', droplet: 'Sprays round droplets.', noisespr: 'Sprays a noisy texture.',
  sparkle: 'Little sparkles along the stroke.', glitter: 'Glitter dots.', dapple: 'Soft spots of light, like sun through leaves.', petal: 'Petals scattered along the stroke.', heart: 'Hearts.', bubble: 'Bubbles.', feather: 'Feathers.',
  toneera: 'Erases tone only.', shadowpen: 'A solid black shadow pen.', hatchbrush: 'Paints hatching lines.', xhatchbrush: 'Paints cross-hatching.', stipple: 'Paints little dots (stippling).',
  bone: 'Click a part, then the part it hangs from: they are linked; drag the dot to place the joint.', bonepose: 'Drag a part to turn it around its joint; everything attached follows.',
  fill: 'Fills an area using the lines on all layers.', fillone: 'Fills using only the current layer.', fillref: 'Fills using the layers marked as reference.', fillenclose: 'Draw around an area: every closed shape inside is filled.', filllasso: 'Draw a lasso: the inside is filled.',
  linear: 'A straight gradient from the main to the sub colour.', radial: 'A round gradient from the middle out.', gerase: 'Fades the layer out along the gradient.', gmanga: 'A dotted manga gradient.',
  pick: 'Click anywhere to take that colour. Tip: hold the pen still at the start of a stroke to pick a colour without changing tool.',
  selrect: 'Drag a rectangle.', selellipse: 'Drag an ellipse.', sellasso: 'Draw around the area.', selpoly: 'Click corners; double-click to close.', selpen: 'Paint the selection with a brush.', selerase: 'Paint to remove from the selection.', selshrink: 'Draw around: the selection shrinks to what you drew around.',
  selwand: 'Click: selects the area of that colour, looking at all layers.', selwandone: 'Click: selects the area of that colour on this layer.', selwandref: 'Click: selects using the reference layers.',
  move: 'Drag to move the layer; corners scale, the round handle turns. In Animation it makes keyframes.', puppet: 'Click to add pins, drag a pin to bend the picture.',
  line: 'Drag a straight line.', rect: 'Drag a rectangle.', oval: 'Drag an ellipse.', polyline: 'Click points; double-click to end.', polygon: 'Click corners; double-click to close.', curve: 'Click points: a smooth curve goes through them.',
  rl_line: 'Drag to place a ruler: strokes near it follow it.', rl_persp: 'Place vanishing points: strokes follow the perspective.', rl_sym: 'Strokes are mirrored on the other side.', rl_ell: 'Strokes follow an ellipse.',
  fr_rect: 'Drag a panel frame.', fr_cut: 'Drag across a panel to divide it.',
  text: 'Click where the text goes, then type.',
  hand: 'Drag to move the view (or hold Space with any tool).', rotate: 'Drag to turn the view (R, or the Navigator).', zoom: 'Click to zoom in, Alt+click to zoom out.'
};
function toolTip(id) {
  const T = TOOLDEF[id]; if (!T) return '';
  if (TOOL_TIPS[id]) return TOOL_TIPS[id];
  if (/^tone/.test(id)) return 'A screen-tone pattern: paint over an area to apply it.';
  if (/^g/.test(id) && T.kind === 'gradient') return 'A ready-made gradient: drag across the page.';
  if (/^bl_/.test(id)) return 'Drag to place this balloon.';
  if (T.custom || /^custom_/.test(id)) return 'A tool you imported. Its settings are in Tool Property; ⓘ at the bottom of Sub Tool shows how it was translated, ⚙ opens all its settings.';
  const s = settings[id] || T.preset || {};
  if (T.kind === 'brush') return T.erase ? 'An eraser.' : s.smudge != null ? 'Mixes the colours under the brush.' : s.tex ? 'A brush with a texture in its stroke.' : s.scatter ? 'A brush that scatters dabs along the stroke.' : s.hardness < 0.6 ? 'A soft brush.' : 'A brush with a firm edge.';
  return 'Use it on the page (settings in Tool Property).';
}
/* "Try it": a practice page, the tool used on it */
let TT_DOC = null;
async function toolPractice() {
  if (state.name !== TT_DOC) { newDocument(900, 600, 1, 12, false, 'Tool practice'); TT_DOC = state.name; if (state.layers.filter(l => !l.paper).length === 0) CMD.layerAdd(); refreshAll(); fit(); }
}
function ttPointer(type, x, y, buttons) {
  const [sx, sy] = docToScreen(x, y), r = viewport.getBoundingClientRect();
  viewport.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 77, pointerType: 'mouse', isPrimary: true, clientX: r.left + sx, clientY: r.top + sy, buttons, button: 0, pressure: buttons ? 0.6 : 0 }));
}
async function ttDrag(pts) {
  const wait = () => new Promise(r => requestAnimationFrame(r));
  ttPointer('pointerdown', pts[0][0], pts[0][1], 1); await wait();
  for (let i = 1; i < pts.length; i++) { ttPointer('pointermove', pts[i][0], pts[i][1], 1); if (i % 3 === 0) await wait(); }
  ttPointer('pointerup', pts[pts.length - 1][0], pts[pts.length - 1][1], 0); await wait();
}
const ttWave = (x0, x1, y, a) => Array.from({ length: 28 }, (_, i) => [x0 + (x1 - x0) * i / 27, y + Math.sin(i / 27 * Math.PI * 2) * a]);
async function toolTry(id) {
  await toolPractice();
  const T = TOOLDEF[id]; if (!T) return;
  const needsInk = T.erase || /blend|blurtool|finger|liquify|fill|selwand|move|puppet|snapera|bonepose/.test(id) || (settings[id] && settings[id].smudge != null);
  if (needsInk) { // something to work on: coloured strokes and a closed shape
    selectTool('pen'); const s = settings.pen, sz = s.size; s.size = 26; setColor('#3a6bd6');
    await ttDrag(ttWave(150, 750, 220, 40)); setColor('#e0603a'); await ttDrag(ttWave(150, 750, 300, 30));
    const ring = Array.from({ length: 40 }, (_, i) => [450 + Math.cos(i / 39 * Math.PI * 2) * 90, 450 + Math.sin(i / 39 * Math.PI * 2) * 70]); setColor('#222222'); await ttDrag(ring); s.size = sz;
  }
  selectTool(id);
  if (T.kind === 'brush') await ttDrag(ttWave(150, 750, needsInk ? 260 : 300, 60));
  else if (T.kind === 'fill') { ttPointer('pointerdown', 450, 450, 1); ttPointer('pointerup', 450, 450, 0); }
  else if (T.kind === 'pick' || id === 'zoom' || /selwand/.test(id)) { ttPointer('pointerdown', 450, 300, 1); ttPointer('pointerup', 450, 300, 0); }
  else if (T.kind === 'text') { toast('Click on the page and type — this tool needs your keyboard'); }
  else if (T.kind === 'poly') { for (const [x, y] of [[200, 400], [350, 200], [550, 380], [700, 220]]) { ttPointer('pointerdown', x, y, 1); ttPointer('pointerup', x, y, 0); } ttPointer('dblclick', 700, 220, 0); }
  else await ttDrag([[250, 180], [330, 230], [420, 300], [520, 380], [620, 440]]);
  refreshAll();
}
/* the tutorials: made fresh whenever the tutorial list opens (new and imported tools included) */
function buildToolTutorials() {
  for (let i = TUTORIALS.length - 1; i >= 0; i--) if (TUTORIALS[i].auto) TUTORIALS.splice(i, 1);
  for (const g of GROUPS) {
    if (!g || !g.id || !g.subs || !g.subs.length) continue;
    const subs = g.subs.filter(id => TOOLDEF[id]);
    if (!subs.length) continue;
    const steps = [{ el: toolEl(g.id), pre: tutGroup(g.id), t: (g.name || g.id) + ' tools', x: (TOOL_GROUP_TIPS[g.id] || 'Tools of this group.') + ` <b>${subs.length}</b> tool${subs.length > 1 ? 's' : ''}: the next steps show each one. Tap <b>Try it</b> to see it work on a practice page.` }];
    for (const id of subs) steps.push({ el: ['#propBody', '#subtoolList', toolEl(g.id)], pre: () => { tutNoDock(); if (GROUPS.some(x => x.id === g.id)) selectGroup(g.id); selectTool(id); }, t: TOOLDEF[id].name, x: esc(toolTip(id)) + ' Its size, opacity and other settings are in <b>Tool Property</b>.', demo: ['Try it', () => toolTry(id)] });
    TUTORIALS.push({ id: 'tools_' + g.id, auto: true, cat: 'Every tool', icon: '🧰', title: (g.name || g.id) + ' tools', desc: subs.slice(0, 4).map(id => TOOLDEF[id].name).join(', ') + (subs.length > 4 ? '…' : ''), steps });
    CMD['tut_tools_' + g.id] = () => tutStart('tools_' + g.id);
  }
}
function installToolTutorials() {
  buildToolTutorials();
  const c0 = tutCenter; tutCenter = function () { buildToolTutorials(); return c0.apply(this, arguments); };
  const s0 = tutStart; tutStart = function (id) { if (/^tools_/.test(id) && !TUTORIALS.some(t => t.id === id)) buildToolTutorials(); return s0.apply(this, arguments); };
  CMD.tutorials = () => tutCenter();
}
