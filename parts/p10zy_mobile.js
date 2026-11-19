/* ---------- Phones & tablets ----------
   Narrow screens (≤ 900 px: phones, iPad portrait): the menu row becomes a "☰ Menu" button that opens a
   full-height, touch-friendly sheet with every menu. On phones (≤ 560 px) the Panels button steps through
   tool settings & colour → layers & navigator → closed, each as a full-width sheet.
   Android app (Capacitor): download() saves files into Documents (or opens the share sheet). */
function openMobileMenu() {
  let m = $('#mobileMenu');
  if (!m) {
    m = document.createElement('div'); m.id = 'mobileMenu'; m.hidden = true;
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-cmd]') || e.target.closest('.mm-close')) m.hidden = true; });
    document.body.appendChild(m);
  }
  const sec = MENUS.map(([name, items]) => `<details><summary>${name}</summary>${items.filter(it => it !== '-').map(it =>
    `<button class="mm-item" data-cmd="${it[1]}"><span>${it[0]}</span>${it[2] ? `<kbd>${it[2]}</kbd>` : ''}</button>`).join('')}</details>`).join('');
  m.innerHTML = `<div class="mm-sheet"><div class="mm-head"><b>Menu</b><button class="mm-close" aria-label="Close">×</button></div>${sec}</div>`;
  m.hidden = false;
}
let phonePanel = 0; // 0 closed, 1 tool settings (left), 2 layers (right)
function togglePanelsPhone() {
  const app = $('#app');
  if (innerWidth > 560) { app.classList.toggle('docks'); return; }
  phonePanel = (phonePanel + 1) % 3;
  app.classList.toggle('docks', phonePanel > 0);
  app.classList.toggle('phone-left', phonePanel === 1);
  app.classList.toggle('phone-right', phonePanel === 2);
  $('#btnDocks').textContent = ['Panels', 'Layers ▸', 'Close ✕'][phonePanel];
}
/* Android app: write the file to Documents; if that is not allowed, open the share sheet (Drive, Files, mail…) */
const isNativeApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
async function nativeSave(blob, name) {
  const P = window.Capacitor.Plugins || {}, FS = P.Filesystem, SH = P.Share;
  const data = await new Promise(r => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
  try {
    await FS.writeFile({ path: 'Sketchforge/' + name, data, directory: 'DOCUMENTS', recursive: true });
    const ios = window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios';
    toast(ios ? 'Saved: Files › On My iPad › Sketchforge › Sketchforge › ' + name : 'Saved to Documents/Sketchforge/' + name, 4000);
  } catch (e) {
    try {
      const r = await FS.writeFile({ path: name, data, directory: 'CACHE' });
      await SH.share({ title: name, url: r.uri, dialogTitle: 'Save or send ' + name });
    } catch (e2) { toast('Could not save the file: ' + (e2.message || e2)); }
  }
}
function installMobile() {
  const b = document.createElement('button'); b.id = 'btnMenu'; b.className = 'only-narrow'; b.textContent = '☰ Menu';
  b.onclick = openMobileMenu;
  $('#menubar').insertBefore(b, $('#menus'));
  CMD.toggleDocks = togglePanelsPhone;
  if (isNativeApp()) document.body.classList.add('native-app');
}
