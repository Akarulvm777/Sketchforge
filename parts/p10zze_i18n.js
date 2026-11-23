/* ---------- languages (3.3) ----------
   The interface follows the language of the browser / system (navigator.languages) when Sketchforge has it, and a
   picker (like Blender's first-start setup) asks once at the first start and once after each update. Help › 🌐
   Language… changes it any time. Key sketchforge.lang.v1 = code ('en', 'th'…); langasked.v1 = version last asked.
   How: the texts of the interface stay in English in the code; a MutationObserver translates every text node and
   title / placeholder that matches a row of I18N_ROWS (p10zzd_i18n_data), keeping its leading emoji / symbols and
   trailing "…" (i18nSplit). Translated nodes remember their English text, so switching language is instant.
   Nothing runs while the language is English. User content (inputs, text areas, editable text) is never touched. */
const I18N_LANGS = [['en', 'English'], ['th', 'ไทย'], ['fr', 'Français'], ['es', 'Español'], ['pt', 'Português'], ['de', 'Deutsch'], ['ja', '日本語'], ['zh', '中文'], ['ko', '한국어']];
const I18N = { lang: 'en', map: null, obs: null };
const I18N_ATTRS = ['title', 'placeholder', 'aria-label'];
const I18N_SKIP = 'script, style, textarea, input, [contenteditable], .noi18n';

/* pure: first language of the list Sketchforge has ('th-TH' → 'th'), else English */
function langDetect(list) {
  for (const l of list || []) { const c = String(l || '').toLowerCase().split(/[-_]/)[0]; if (I18N_LANGS.some(x => x[0] === c)) return c; }
  return 'en';
}
/* pure: leading symbols / emoji, the text, trailing "…" */
function i18nSplit(t) {
  const a = (t.match(/^[^\p{L}\p{N}]*/u) || [''])[0], rest = t.slice(a.length);
  const b = (rest.match(/(…|\.\.\.)?\s*$/) || [''])[0];
  return [a, rest.slice(0, rest.length - b.length), b];
}
/* pure: the table for one language (Map English → translation) */
function i18nTable(rows, lang) {
  const i = I18N_LANGS.findIndex(x => x[0] === lang), m = new Map();
  if (i <= 0) return m;
  for (const r of rows.split('\n')) { const c = r.split('|'); if (c.length === I18N_LANGS.length && c[i]) m.set(c[0], c[i]); }
  return m;
}
function tr(text) {
  if (!I18N.map || !text) return text;
  const [a, c, b] = i18nSplit(text), t = I18N.map.get(c);
  return t ? a + t + b : text;
}
function i18nText(n) {
  const cur = n.data;
  if (cur === n.__sfTr) return; // our own translation
  const en = cur;
  if (!/[A-Za-z]/.test(en) || (n.parentElement && n.parentElement.closest(I18N_SKIP))) return;
  const t = tr(en);
  if (t !== en) { n.__sfEn = en; n.__sfTr = t; n.data = t; } else { n.__sfEn = n.__sfTr = undefined; }
}
function i18nAttr(el, name) {
  const cur = el.getAttribute(name); if (!cur) return;
  const T = el.__sfAt || (el.__sfAt = {});
  if (T[name] && cur === T[name][1]) return;
  if (!/[A-Za-z]/.test(cur) || el.closest(I18N_SKIP.replace('input, ', ''))) return;
  const t = tr(cur);
  if (t !== cur) { T[name] = [cur, t]; el.setAttribute(name, t); } else delete T[name];
}
function i18nWalk(root) {
  if (root.nodeType === 3) { i18nText(root); return; }
  if (root.nodeType !== 1 || root.matches('script, style')) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) i18nText(n);
  for (const a of I18N_ATTRS) { if (root.hasAttribute(a)) i18nAttr(root, a); root.querySelectorAll('[' + a + ']').forEach(el => i18nAttr(el, a)); }
}
/* every node back to English (before switching to another language) */
function i18nRestore() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) if (n.__sfTr !== undefined && n.data === n.__sfTr) { const en = n.__sfEn; n.__sfEn = n.__sfTr = undefined; n.data = en; }
  document.querySelectorAll(I18N_ATTRS.map(a => '[' + a + ']').join(',')).forEach(el => {
    const T = el.__sfAt; if (!T) return;
    for (const a in T) if (el.getAttribute(a) === T[a][1]) el.setAttribute(a, T[a][0]);
    el.__sfAt = null;
  });
}
function setLanguage(lang, save) {
  if (!I18N_LANGS.some(x => x[0] === lang)) lang = 'en';
  if (save) prefs.set('lang.v1', lang);
  if (I18N.obs) { I18N.obs.disconnect(); I18N.obs = null; }
  if (I18N.map) i18nRestore();
  I18N.lang = lang; I18N.map = lang === 'en' ? null : i18nTable(I18N_ROWS, lang);
  document.documentElement.lang = lang;
  if (!I18N.map) return;
  i18nWalk(document.body);
  I18N.obs = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach(i18nWalk);
      else if (r.type === 'characterData') i18nText(r.target);
      else if (r.type === 'attributes') i18nAttr(r.target, r.attributeName);
    }
  });
  I18N.obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
}
/* the picker: big buttons with each language in its own words (like Blender's quick setup) */
function langPicker(first) {
  if ($('#langPick')) return;
  const d = document.createElement('div'); d.id = 'langPick'; d.className = 'langpick noi18n';
  const sug = langDetect(navigator.languages || [navigator.language]);
  d.innerHTML = `<h3>🌐 Language · ภาษา · Langue · Idioma · 言語</h3>
    <p class="muted small">${first ? 'Choose the language of Sketchforge. You can change it any time: Help › 🌐 Language.' : 'Change the language of Sketchforge.'}</p>
    <div class="langgrid">${I18N_LANGS.map(([c, n]) => `<button type="button" data-l="${c}" class="${c === I18N.lang ? 'on' : ''}">${escHtml(n)}${c === sug && c !== 'en' ? ' <span class="muted small">(your system)</span>' : ''}</button>`).join('')}</div>
    <div class="dialog-actions"><button type="button" class="primary" data-a="ok">OK</button></div>`;
  document.body.appendChild(d);
  d.querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
    setLanguage(b.dataset.l, true);
    d.querySelectorAll('[data-l]').forEach(x => x.classList.toggle('on', x === b));
    if (typeof buildMenus === 'function') buildMenus();
  });
  d.querySelector('[data-a=ok]').onclick = () => { prefs.set('langasked.v1', APP_VERSION); d.remove(); };
}
function installLanguages() {
  CMD.language = () => langPicker(false);
  for (const name of ['Help', 'View']) {
    const M = MENUS.find(m => m[0] === name);
    if (M && !M[1].some(x => Array.isArray(x) && x[1] === 'language')) M[1].push(['🌐 Language…', 'language']);
  }
  const saved = prefs.get('lang.v1', '');
  setLanguage(saved || langDetect(navigator.languages || [navigator.language]), false);
  // ask at the first start and after each update, unless turned off (the tests turn the welcome off, and this with it)
  const off = prefs.get('langask.v1', '') === 'never' || prefs.get('welcome.v1', '') === 'never';
  if (!off && prefs.get('langasked.v1', '') !== APP_VERSION) setTimeout(() => langPicker(true), 700);
}
