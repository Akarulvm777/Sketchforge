/* ---------- import window: what Inkvessa does with each imported tool (3.3) ----------
   Importing .sut tools is not a download: the app studies each tool. importTools (p10z) opens this window and
   reports every step per tool: reading the file, its materials (pattern / texture images), its settings, where it
   goes (group), a test stroke (the tuner, p10zbd) and the preview. Each tool row shows a percentage, the current
   step, the source file and the destination group. The window does not block the app (Hide keeps it working). */
const IMPW_STEPS = [
  ['read', 'Reading the tool', 15], ['mat', 'Materials (images, textures)', 15], ['set', 'Settings', 15],
  ['place', 'Choosing where it goes', 10], ['test', 'Test stroke', 35], ['prev', 'Preview', 10]
];
/* pure: percentage once the steps up to `key` are done (key = null: nothing done) */
function impwPct(key) {
  const i = IMPW_STEPS.findIndex(s => s[0] === key);
  return i < 0 ? 0 : IMPW_STEPS.slice(0, i + 1).reduce((n, s) => n + s[2], 0);
}
const IMPW_NONE = { status() {}, fail() {}, tool() { return { step() {}, done() {} }; }, parsed() {} };
let IMPW = null;
function impwOpen(nFiles) {
  let d = $('#importWin');
  if (!d) {
    d = document.createElement('div'); d.id = 'importWin'; d.className = 'impw';
    d.innerHTML = `<div class="impw-head"><b>Studying your tools</b><span class="impw-all"></span><button type="button" class="impw-x" title="Hide (the study keeps going)">Hide</button></div>
      <p class="muted small impw-note">Nothing is downloaded: Inkvessa reads each tool, its images and settings, tries a stroke and makes a preview.</p>
      <div class="impw-bar"><i></i></div><div class="impw-list"></div>`;
    document.body.appendChild(d);
    d.querySelector('.impw-x').onclick = () => { d.hidden = true; };
  }
  d.hidden = false; d.classList.remove('done');
  const list = d.querySelector('.impw-list'); list.innerHTML = '';
  d.querySelector('.impw-x').textContent = 'Hide';
  const files = [];
  const W = IMPW = { el: d, files };
  const overall = () => {
    const n = Math.max(nFiles, files.length) || 1;
    const sum = files.reduce((a, f) => a + (f.failed ? 100 : f.tools.length ? f.tools.reduce((x, t) => x + t.pct, 0) / f.tools.length : f.pct), 0);
    const p = Math.round(sum / n);
    d.querySelector('.impw-bar i').style.width = p + '%';
    d.querySelector('.impw-all').textContent = p + '%';
    return p;
  };
  W.file = name => {
    const box = document.createElement('div'); box.className = 'impw-file';
    box.innerHTML = `<div class="impw-src">📄 <span></span> <em class="muted"></em></div>`;
    box.querySelector('span').textContent = name;
    list.appendChild(box);
    const F = { tools: [], pct: 0, failed: false };
    F.status = t => { box.querySelector('em').textContent = t; F.pct = 5; overall(); };
    F.fail = t => { F.failed = true; box.classList.add('bad'); box.querySelector('em').textContent = '✗ ' + t; overall(); };
    F.parsed = t => { box.querySelector('em').textContent = t || ''; };
    F.tool = def => {
      const row = document.createElement('div'); row.className = 'impw-tool';
      row.innerHTML = `<span class="impw-prev"><i class="impw-spin"></i></span><div class="impw-main"><div class="impw-name"><b></b><span class="impw-grp muted"></span><span class="impw-pct">0%</span></div>
        <div class="impw-bar sm"><i></i></div><div class="impw-step muted small"></div></div>`;
      row.querySelector('b').textContent = def.name || 'Tool';
      box.appendChild(row);
      const T = { pct: 0 };
      T.step = (key, detail, group) => {
        T.pct = impwPct(key); if (key === 'test') T.test = detail;
        const next = IMPW_STEPS[IMPW_STEPS.findIndex(s => s[0] === key) + 1];
        row.querySelector('.impw-pct').textContent = T.pct + '%';
        row.querySelector('.impw-bar i').style.width = T.pct + '%';
        row.querySelector('.impw-step').textContent = '✓ ' + IMPW_STEPS.find(s => s[0] === key)[1] + (detail ? ': ' + detail : '') + (next ? '  ·  next: ' + next[1].toLowerCase() + '…' : '');
        if (group) row.querySelector('.impw-grp').textContent = ' → ' + group;
        overall();
      };
      T.done = (prev, note) => {
        T.step('prev', note);
        row.querySelector('.impw-step').textContent = '✓ Studied' + (T.test ? ' · test stroke: ' + T.test : '');
        const p = row.querySelector('.impw-prev'); p.innerHTML = ''; if (prev) p.appendChild(prev);
        row.classList.add('ok');
      };
      F.tools.push(T);
      return T;
    };
    files.push(F);
    return F;
  };
  W.finish = text => {
    overall(); d.classList.add('done');
    d.querySelector('.impw-head b').textContent = 'Your tools are ready';
    d.querySelector('.impw-note').textContent = text;
    d.querySelector('.impw-x').textContent = 'Close';
  };
  return W;
}
/* let the window repaint between steps */
const impwTick = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
