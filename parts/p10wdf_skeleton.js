/* ---------- Skeleton tree (like Spine's tree view) ----------
   Shown in Tool Property of every Bone sub tool: the main part (★, the root that holds every bone) at the top, every
   part indented under the part it follows, with what each one has: 🦴 linked, 〰 hair & cloth bones, 🌬 gravity.
   Click a row to pick that part; buttons: make it the main part, make it follow the picked part… The main part is also
   labelled ★ on the canvas. skeletonRows() is the (pure-ish) list used by the view and the tests. */
const skelParts = () => state.layers.filter(l => !l.paper && !l.vref && !l.ref && !l.draft);
/* rows in tree order: [{ l, depth }] — the main part first, then the other top parts, children under their parent */
function skeletonRows() {
  const parts = skelParts(), ids = new Set(parts.map(l => l.id)), rows = [], seen = new Set();
  const kids = id => parts.filter(l => l.parent === id).reverse(); // top of the layer list first
  const walk = (l, d) => { if (seen.has(l.id)) return; seen.add(l.id); rows.push({ l, depth: d }); kids(l.id).forEach(k => walk(k, d + 1)); };
  const tops = parts.filter(l => !l.parent || !ids.has(l.parent)).reverse();
  tops.sort((a, b) => (b.mainPart ? 1 : 0) - (a.mainPart ? 1 : 0));
  tops.forEach(l => walk(l, 0));
  return rows;
}
function skelBadges(l) {
  const b = [];
  if (l.mainPart) b.push('★');
  if (chainOn(l)) b.push('〰'); if (l.phys && l.phys.on) b.push('🌬');
  return b.join(' ');
}
function skeletonTree(body) {
  const box = document.createElement('div'); box.id = 'skelTree';
  const head = document.createElement('div'); head.className = 'grp'; head.textContent = 'Skeleton (what follows what)'; box.appendChild(head);
  const rows = skeletonRows(), main = state.layers.find(l => l.mainPart && !l.paper);
  if (!rows.length) { hint(box, 'No parts yet: put each part (body, head, arms, hair…) on its own layer.'); body.appendChild(box); return; }
  const list = document.createElement('div'); list.className = 'skellist';
  for (const { l, depth } of rows) {
    const r = document.createElement('button'); r.type = 'button'; r.className = 'skelrow' + (l.id === state.activeId ? ' on' : '') + (l.mainPart ? ' main' : '');
    r.style.paddingLeft = (6 + depth * 14) + 'px';
    const par = layerParent(l);
    r.innerHTML = `<span class="sk-ico">${depth ? '└' : l.mainPart ? '★' : '•'}</span><span class="sk-name"></span><span class="sk-badge">${skelBadges(l).replace('★', '')}</span>`;
    r.querySelector('.sk-name').textContent = l.name;
    r.title = l.mainPart ? 'Main part: holds every bone' : par ? `Follows "${par.name}"` : 'Free part (follows nothing)';
    r.onclick = () => { state.activeId = l.id; refreshAll(); };
    list.appendChild(r);
  }
  box.appendChild(list);
  const free = rows.filter(r => !r.depth && !r.l.mainPart).length;
  const tip = document.createElement('div'); tip.className = 'small muted'; tip.style.margin = '4px 0';
  tip.textContent = !main ? 'Tip: pick the body and press ★ Make main part — every free part will follow it.'
    : free ? `${free} free part${free > 1 ? 's' : ''} (not following anything). Click one, then link it with Bone: link parts — or press ★ again.`
    : `★ ${main.name} holds the whole character.`;
  box.appendChild(tip);
  const a = activeLayer();
  const B = [['★ Make main part', () => { makeMainPart(); refreshProps(); }]];
  if (state.tool !== 'bone') B.push(['Free this part', () => { if (a && a.parent && typeof boneUnlink === 'function') { boneUnlink(a); refreshProps(); } }]);
  B.push(['🧝 Practice', () => chainPractice()]);
  btns(box, B);
  body.appendChild(box);
}
function installSkeleton() {
  for (const id of ['bone', 'bonepose', 'bonechain']) {
    const T = TOOLDEF[id]; if (!T || T._skel) continue; T._skel = true;
    const p0 = T.props; T.props = body => { p0(body); skeletonTree(body); };
    const o0 = T.overlay; T.overlay = (g, S) => { o0(g, S); skelLabel(g, S); };
  }
  // "Make main part" also clears the star from a previous main part (one root)
  const mm0 = makeMainPart;
  makeMainPart = function () { // the main part is the root: it follows nothing (no loop), and there is only one
    const a = activeLayer(); if (a && !a.paper && !a.vref) { for (const l of state.layers) if (l !== a) delete l.mainPart; if (a.parent) setLayerParent(a, null); }
    return mm0.apply(this, arguments); };
  CMD.mainPart = makeMainPart;
}
/* ★ label at the main part's joint on the canvas */
function skelLabel(g, S) {
  const m = state.layers.find(l => l.mainPart && l.visible); if (!m) return;
  const [x, y] = typeof jointDoc === 'function' ? jointDoc(m) : pivotOf(m), p = S(x, y);
  g.save(); g.font = 'bold 12px system-ui, sans-serif'; const t = '★ ' + m.name, w = g.measureText(t).width + 10;
  g.fillStyle = 'rgba(255,138,61,.92)'; g.fillRect(p[0] + 10, p[1] - 22, w, 18); g.fillStyle = '#1b1d20'; g.fillText(t, p[0] + 15, p[1] - 9); g.restore();
}
