/* ---------- ✨ Ask: the free built-in helper ----------
   No account, no internet, no cost: it searches the app itself — every menu command, every tool, every tutorial step
   and a list of common questions — and answers with buttons that take you there (run the command, pick the tool,
   open the tutorial at the right step). English and French words are understood. It never draws for anyone:
   asked why, it says "AI is not supposed to steal your job." */
const HELP_TIPS = [
  { q: 'pen pressure not working tablet wacom xp-pen huion thickness pressure', t: 'Pen pressure', x: 'Turn on Windows Ink in your tablet driver, then View › Pen pressure & touch: test pad, Soft / Normal / Firm, Calibrate my pen.', a: [['cmd', 'penSettings', 'Pen settings'], ['tut', 'pen', 'Pen tutorial']] },
  { q: 'save file where saved keep work sketchforge file', t: 'Saving your work', x: 'File › Save (Ctrl+S) saves a .sketchforge file with all layers and frames. Your last work also reopens by itself next time.', a: [['cmd', 'save', 'Save now']] },
  { q: 'export gif video mp4 png movie share animation', t: 'Export an animation', x: 'File › Export animation (Ctrl+E): GIF, video, PNG frames or a sprite sheet, with a transparent background if you like.', a: [['cmd', 'exportAnim', 'Export…']] },
  { q: 'animation one layer frame by frame next drawing new frame animate', t: 'Animate on one layer', x: 'In the Animation workspace press ＋ New drawing (Shift+→): next frame with a clean page; onion skin shows the previous drawing.', a: [['cmd', 'newDrawing', '＋ New drawing'], ['tut', 'animation', 'Make an animation']] },
  { q: 'onion skin see previous drawing ghost', t: 'Onion skin', x: 'Shows the previous drawing in red and the next one in green (key O). The ▾ next to it changes colours and how many.', a: [['cmd', 'onion', 'Onion skin on / off']] },
  { q: 'undo mistake back cancel', t: 'Undo / redo', x: 'Ctrl+Z undoes, Ctrl+Y redoes. On a touch screen: tap with two fingers to undo.', a: [['cmd', 'undo', 'Undo']] },
  { q: 'ipad iphone install home screen safari', t: 'iPad & iPhone', x: 'Open the Sketchforge website in Safari → Share → Add to Home Screen. It then opens full screen and works offline.', a: [['tut', 'apps', 'Install the app']] },
  { q: 'install windows mac android download app exe apk', t: 'Install the app', x: 'Windows .exe, Mac .dmg, Android .apk and Linux AppImage are on the Sketchforge website. They update themselves.', a: [['tut', 'apps', 'Install the app']] },
  { q: 'update new version latest', t: 'Updates', x: 'Sketchforge updates itself and shows a small card when a new version is ready. Help › Check for updates checks now.', a: [['cmd', 'checkUpdate', 'Check for updates']] },
  { q: 'colour inside lines clip clipping fill colours under lines', t: 'Colour under your lines', x: 'Make a new layer under the lines for colour, or use Layer › Clip to layer below to paint only where the layer below has paint.', a: [['tut', 'layers', 'Layers & selections']] },
  { q: 'mirror symmetry both sides', t: 'Symmetry', x: 'The Symmetry button mirrors what you draw (Shift+M); ▾ for 4-way, radial or kaleidoscope.', a: [['cmd', 'symToggle', 'Symmetry on / off']] },
  { q: '3d model pose body reference hand fingers', t: '3D model', x: 'The 3D model button opens a posable man / woman: drag a part to move it, bend fingers, change the body shape, then Place on new layer.', a: [['cmd', 'show3d', 'Open the 3D model']] },
  { q: 'theme colours interface dark light customise look icons font', t: 'Change how Sketchforge looks', x: '🎨 Custom P: themes, colours of every part, icons, fonts, layout, canvas and effects.', a: [['cmd', 'cpOpen', 'Open Custom P'], ['tut', 'custom', 'Custom P tutorial']] },
  { q: 'brush import sut clip studio brushes add brush', t: 'Add brushes', x: 'Drop a Clip Studio .sut file on the Sub tool panel, or Add-ons › Import brushes. The community library has brushes shared by others (☁ Account).', a: [['cmd', 'communityLib', 'Brushes & themes library']] },
  { q: 'psd photoshop clip studio open file layers', t: 'Photoshop & Clip Studio files', x: 'File › Open reads .psd with layers and .clip as one picture; File › Save as Photoshop PSD keeps your layers.', a: [['cmd', 'open', 'Open…']] },
  { q: 'rig bones arm move parts cut out puppet', t: 'Rig a character', x: 'Put each body part on its own layer, link them with Layer › Bone rig: set parent…, then move / rotate with the Move tool and tween.', a: [['tut', 'rig', 'Rig tutorial'], ['tut', 'puppet', 'Puppet pins']] },
  { q: 'tween move object automatically in between', t: 'Motion tween', x: 'Two keyframes with the drawing in different places (Move tool), then Tween: the frames between are made for you.', a: [['tut', 'tween', 'Tween tutorial']] },
  { q: 'time lapse record video of drawing process', t: 'Time-lapse', x: 'REC Time-lapse records how you draw; ▾ → Export video.', a: [['cmd', 'tlToggle', 'Recording on / off']] },
  { q: 'cloud account sign in login google github sync settings', t: 'Account (optional)', x: 'Sign in with Google or GitHub to keep drawings in the cloud and your settings on all your devices.', a: [['cmd', 'account', 'Sign in']] },
  { q: 'shortcuts keys keyboard', t: 'Shortcuts', x: 'Help › Shortcuts & help (F1) lists every key.', a: [['cmd', 'help', 'Shortcuts']] },
  { q: 'tutorial learn how start beginner new', t: 'Tutorials', x: 'Help › Tutorials has guided tours that point at the real buttons, from the first drawing to animation and rigging.', a: [['cmd', 'tutorials', 'All tutorials'], ['tut', 'welcome', 'Welcome tour']] }
];
// French (and a few other) words -> the English words used in the app
const HELP_SYN = {
  gomme: 'eraser', effacer: 'eraser', rubber: 'eraser', crayon: 'pencil', pinceau: 'brush', brosse: 'brush', stylo: 'pen', plume: 'pen', calque: 'layer', calques: 'layer',
  couleur: 'colour', couleurs: 'colour', color: 'colour', colors: 'colour', remplir: 'fill', remplissage: 'fill', seau: 'fill', bucket: 'fill', pot: 'fill', degrade: 'gradient',
  selection: 'select', selectionner: 'select', deplacer: 'move', bouger: 'move', texte: 'text', bulle: 'balloon', case: 'frame', cases: 'frame', regle: 'ruler',
  annuler: 'undo', refaire: 'redo', enregistrer: 'save', sauvegarder: 'save', sauver: 'save', ouvrir: 'open', exporter: 'export', imprimer: 'export', nouveau: 'new', nouvelle: 'new',
  animer: 'animation', anime: 'animation', animation: 'animation', image: 'frame', images: 'frame', dessin: 'drawing', dessins: 'drawing', oignon: 'onion', pelure: 'onion',
  lecture: 'play', jouer: 'play', vitesse: 'fps', boucle: 'loop', symetrie: 'symmetry', miroir: 'mirror', pression: 'pressure', tablette: 'tablet', zoomer: 'zoom',
  tourner: 'rotate', rotation: 'rotate', retourner: 'flip', theme: 'theme', icone: 'icons', police: 'font', aide: 'help', raccourci: 'shortcuts', raccourcis: 'shortcuts',
  os: 'bones', squelette: 'rig', marionnette: 'puppet', modele: 'model', corps: 'body', main: 'hand', doigt: 'fingers', doigts: 'fingers', telecharger: 'download',
  installer: 'install', mise: 'update', compte: 'account', connexion: 'sign', nuage: 'cloud', flou: 'blur', filtre: 'filter', masque: 'mask', aquarelle: 'watercolour',
  eyedropper: 'pick', pipette: 'pick', picker: 'pick', paint: 'brush', painting: 'brush', erase: 'eraser', delete: 'delete', supprimer: 'delete', wipe: 'clear', vider: 'clear'
};
const HELP_STOP = new Set('a an the to of in on for and or is are do does how can i my me you it this that what where which with use using get want need le la les un une des de du et ou est je mon ma mes comment faire pour avec dans sur ce cette quoi ou est-ce que qui il elle on y'.split(' '));
const hnorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/<[^>]+>/g, ' ');
const hstem = w => w.length > 4 ? w.replace(/(ings?|ed|es|s)$/, '') : w;
function htokens(s) {
  return hnorm(s).split(/[^a-z0-9+]+/).filter(w => w && !HELP_STOP.has(w)).map(w => hstem(HELP_SYN[w] || w));
}
let HELP_INDEX = null;
function helpIndex() {
  if (HELP_INDEX) return HELP_INDEX;
  const idx = [], strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const add = (e) => { e.tt = htokens(e.title); e.pt = htokens(e.path || ''); e.xt = htokens(e.text || '') ; idx.push(e); };
  for (const tip of HELP_TIPS) add({ kind: 'tip', title: tip.t, path: tip.q, text: tip.x, acts: tip.a, boost: 1.5 });
  for (const [menu, items] of MENUS) for (const it of items) if (Array.isArray(it) && it[1] && CMD[it[1]] && !/^tut_|^tour/.test(it[1]))
    add({ kind: 'cmd', title: it[0].replace(/[…✨☁📚👋]/g, '').trim(), path: `${menu} › ${it[0]}`, text: it[2] ? 'Shortcut: ' + it[2] : '', id: it[1] });
  for (const g of GROUPS) for (const id of g.subs || []) { const d = TOOLDEF[id]; if (d) add({ kind: 'tool', title: d.name, path: `${g.name} tool`, text: `${g.name}${g.key ? ' (key ' + g.key + ')' : ''}`, id }); }
  for (const t of TUTORIALS) {
    const steps = typeof t.steps === 'function' ? t.steps() : t.steps;
    add({ kind: 'tut', title: t.title, path: 'Tutorial', text: t.desc, id: t.id, step: 0, boost: 1.2 });
    steps.forEach((s, k) => s.t && add({ kind: 'tut', title: strip(s.t), path: t.title, text: strip(s.x), id: t.id, step: k }));
  }
  return (HELP_INDEX = idx);
}
function helpSearch(q) {
  const qt = [...new Set(htokens(q))]; if (!qt.length) return [];
  const hit = (list, w) => list.some(x => x === w || (w.length > 3 && (x.startsWith(w) || w.startsWith(x)) && Math.min(x.length, w.length) > 3));
  const scored = helpIndex().map(e => {
    let s = 0, found = 0;
    for (const w of qt) { const v = (hit(e.tt, w) ? 3 : 0) + (hit(e.pt, w) ? 1.5 : 0) + (hit(e.xt, w) ? 1 : 0); if (v) found++; s += v; }
    s *= (e.boost || 1) * (found / qt.length) ** 1.5; // answers that match more of the question win
    return [s, e];
  }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
  const out = [], seen = new Set();
  for (const [s, e] of scored) { const k = e.kind === 'tip' ? 'tip:' + e.title : e.kind === 'tut' ? 'tut:' + e.id : e.kind + ':' + e.id;
    if (e.kind === 'tip' && (e.acts || []).some(a => seen.has(a[0] + ':' + a[1]))) continue;
    if (e.kind === 'tip') for (const a of e.acts || []) seen.add(a[0] + ':' + a[1]); if (seen.has(k) || (out.length && s < scored[0][0] * 0.35)) continue; seen.add(k); if (e.kind === 'cmd' || e.kind === 'tut') seen.add(e.kind + ':' + e.id); out.push(e); if (out.length >= 4) break; }
  return out;
}
const DRAW_ASK = /\b(draw|paint|sketch|colou?r|ink|finish|create|generate|make)\b.{0,30}\b(for me|me an?|it for me)\b|\b(can|could|will) you (draw|paint|sketch|make (me )?(a|an|my) (drawing|picture|art|character))|\bdessine|\bfais[- ]moi (un|une) (dessin|image)|\bpeux[- ]tu dessiner/;
const WHY_NOT = /\bwhy\b.{0,40}\b(not|n't|wont|won't|refuse)\b.{0,30}\b(draw|paint|art|help)|\bpourquoi\b.{0,40}\b(pas|refuse)\b.{0,30}\b(dessin|dessiner|aide)/;
function helpAnswer(q) {
  const n = hnorm(q);
  if (WHY_NOT.test(n)) return 'AI is not supposed to steal your job. Your art is yours to make — I can show you every tool that helps. [[tut:welcome|Welcome tour]]';
  if (DRAW_ASK.test(n)) return "I don't draw for you — the art is yours! But I can show you the tools: ask me things like \"where is the eraser?\" or \"how do I animate?\". [[tut:first|Your first drawing]]";
  if (/^\s*(hi|hello|hey|bonjour|salut|coucou|yo)\b/.test(n) && n.length < 20) return 'Hi! Ask me where a tool is or how to do something, e.g. "how do I make an animation?", "eraser", "pen pressure not working".';
  if (/\b(thanks?|thank you|merci)\b/.test(n)) return 'You\'re welcome! Have fun drawing 🎨';
  const res = helpSearch(q);
  if (!res.length) return 'I couldn\'t find that. Try other words (e.g. "layer", "export gif", "onion skin"), or look in the tutorials. [[cmd:tutorials|All tutorials]]';
  return res.map(e => {
    const btn = e.kind === 'cmd' ? `[[cmd:${e.id}|Do it]]` : e.kind === 'tool' ? `[[tool:${e.id}|Use it]]` : e.kind === 'tut' ? `[[tut:${e.id}.${e.step || 0}|Show me]]` : (e.acts || []).map(([k, id, l]) => `[[${k}:${id}|${l}]]`).join(' ');
    const where = e.kind === 'cmd' ? e.path : e.kind === 'tool' ? `Tool palette › ${e.text}` : e.kind === 'tut' ? (e.step ? `Tutorial "${e.path}"` : 'Tutorial') : '';
    const text = e.kind === 'cmd' ? e.text : e.kind === 'tool' ? '' : e.text;
    return `**${e.title}**${where ? ' — ' + where : ''}${text ? '\n' + (text.length > 220 ? text.slice(0, 217) + '…' : text) : ''}\n${btn}`;
  }).join('\n\n');
}

/* ---- the panel ---- */
const AI = { msgs: [] };
function aiOpen() {
  let p = $('#aiPanel');
  if (!p) {
    p = document.createElement('div'); p.id = 'aiPanel';
    p.innerHTML = `<div class="ai-head"><b>✨ Sketchforge helper</b><span class="muted small">Free, works offline. Finds tools and answers questions — it won't draw for you.</span><button type="button" class="ai-x" title="Close">✕</button></div>
      <div class="ai-log"></div><form class="ai-form"><textarea rows="2" placeholder="Ask anything… e.g. where is the eraser? how do I animate?"></textarea><button class="primary">Ask</button></form>`;
    document.body.appendChild(p);
    p.querySelector('.ai-x').onclick = () => { p.hidden = true; };
    const ta = p.querySelector('textarea');
    ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); p.querySelector('form').requestSubmit(); } });
    p.querySelector('form').onsubmit = e => { e.preventDefault(); const q = ta.value.trim(); if (q) { ta.value = ''; aiAsk(q); } };
    aiRender();
  }
  p.hidden = false; p.querySelector('textarea').focus();
}
function aiFormat(text) {
  const h = esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  return h.replace(/\[\[(cmd|tut|tool):([\w.-]+)\|([^\]]{1,60})\]\]/g, (m, k, id, label) => `<button type="button" class="ai-act" data-k="${k}" data-id="${id}">${label}</button>`);
}
function aiRender() {
  const log = $('#aiPanel .ai-log'); if (!log) return;
  log.innerHTML = AI.msgs.length ? AI.msgs.map(m => `<div class="ai-msg ${m.role}">${aiFormat(m.content)}</div>`).join('')
    : `<div class="ai-msg assistant">${aiFormat('Hi! Ask me where a tool is, what a setting does, or how to do something. For example:')}<div class="ai-ex">${['How do I animate?', 'Where is the eraser?', 'Pen pressure not working', 'Export a GIF'].map(x => `<button type="button" class="ai-q">${x}</button>`).join('')}</div></div>`;
  log.querySelectorAll('.ai-q').forEach(b => b.onclick = () => aiAsk(b.textContent));
  log.querySelectorAll('.ai-act').forEach(b => b.onclick = () => {
    const k = b.dataset.k, id = b.dataset.id;
    if (k === 'cmd' && CMD[id]) CMD[id]();
    else if (k === 'tool' && TOOLDEF[id]) { selectTool(id); toast(TOOLDEF[id].name + ' selected'); }
    else if (k === 'tut') { const [tid, st] = id.split('.'); $('#aiPanel').hidden = true; tutStart(tid); if (+st > 0) { TUT.i = Math.min(+st, TUT.steps.length - 1); tutShow(); } }
  });
  const last = log.querySelector('.ai-msg.user:last-of-type');
  log.scrollTop = last ? last.offsetTop - 8 : log.scrollHeight; // show the start of the newest answer
}
function aiAsk(q) {
  AI.msgs.push({ role: 'user', content: q }, { role: 'assistant', content: helpAnswer(q) });
  if (AI.msgs.length > 40) AI.msgs.splice(0, AI.msgs.length - 40);
  aiRender();
}
