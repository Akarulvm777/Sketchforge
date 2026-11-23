/* ---------- Welcome animation: the Nexilune mascot says "Welcome!" ----------
   On the very first start and at the first start of each new version, before the tour card / What's new. Tap to skip;
   it ends by itself after a few seconds. Help › Play the welcome animation shows it again. Key sketchforge.welcome.v1 =
   the last version welcomed ('never' = off; the test harness uses it). */
const WELCOME_KEY = 'sketchforge.welcome.v1';
let welcomeGate = Promise.resolve();
function sfWelcome(force) {
  return new Promise(done => {
    let seen = null;
    try { seen = localStorage.getItem(WELCOME_KEY); } catch (e) { /* private mode */ }
    const isNew = seen !== APP_VERSION; // first start ever, or the first start of a new version
    if (!force && (seen === 'never' || !isNew || location.hash === '#sf-child')) { done(); return; }
    if (!force) try { localStorage.setItem(WELCOME_KEY, APP_VERSION); } catch (e) { /* ignore */ }
    const update = !force && !!seen && seen !== APP_VERSION;
    const w = document.createElement('div'); w.id = 'sfWelcome';
    const word = 'Welcome!';
    w.innerHTML = `<div class="wl-card"><img class="wl-mascot" src="mascot.gif" alt="The Nexilune mascot waving">
      <h1 class="wl-word">${[...word].map((ch, i) => `<span style="animation-delay:${0.45 + i * 0.07}s">${ch}</span>`).join('')}</h1>
      <p class="wl-sub">${update ? `Nexilune ${APP_VERSION} is here` : 'to Nexilune — let’s draw something!'}</p>
      <p class="wl-tap">tap to continue</p></div>`;
    let closed = false;
    const close = () => { if (closed) return; closed = true; w.classList.add('wl-out'); setTimeout(() => { w.remove(); done(); }, 450); };
    w.addEventListener('pointerdown', close);
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { document.removeEventListener('keydown', k); close(); } });
    document.body.appendChild(w);
    setTimeout(close, 4200);
  });
}
function installWelcome() {
  CMD.welcome = () => sfWelcome(true);
  const H = MENUS.find(m => m[0] === 'Help');
  if (H && !H[1].some(x => Array.isArray(x) && x[1] === 'welcome')) H[1].push(['Play the welcome animation', 'welcome']);
  welcomeGate = sfWelcome(false); // the tour card and What's new wait for it
}
