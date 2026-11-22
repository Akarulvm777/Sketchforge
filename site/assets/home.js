/* Sketchforge home: menu, reveal, live app embed, animation video tabs, active section in nav. */
(function () {
  const $ = s => document.querySelector(s);

  // mobile menu
  const burger = $('#sfBurger'), menu = $('#sfMenu');
  if (burger && menu) {
    burger.onclick = () => { const o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); };
    menu.addEventListener('click', e => { if (e.target.tagName === 'A') { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  }

  // reveal on scroll
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // live app inside the hero frame (phones go to the full-screen studio instead)
  const launch = $('#sfLaunch'), device = $('#sfDevice');
  if (launch && device) launch.onclick = () => {
    if (innerWidth < 760) { location.href = 'studio.html'; return; }
    const scr = device.querySelector('.sf-device-screen');
    const load = document.createElement('div'); load.className = 'sf-loading'; load.textContent = 'Loading the studio…';
    const f = document.createElement('iframe');
    f.src = 'app/'; f.title = 'Sketchforge'; f.allow = 'fullscreen; clipboard-read; clipboard-write; autoplay';
    f.setAttribute('allowfullscreen', '');
    f.onload = () => load.remove();
    scr.append(load, f); device.classList.add('live');
    device.querySelector('.sf-device-url').textContent = 'sketchforge · live';
  };

  // animation tabs + autoplay when visible
  const video = $('#sfVideo'), cap = $('#sfCap'), sound = $('#sfSound');
  if (video) {
    document.querySelectorAll('.sf-tabs button').forEach(b => b.onclick = () => {
      document.querySelectorAll('.sf-tabs button').forEach(x => x.classList.toggle('on', x === b));
      video.src = b.dataset.video; cap.textContent = b.dataset.cap; video.play().catch(() => {});
    });
    new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) video.play().catch(() => {}); else video.pause(); }), { threshold: .35 }).observe(video);
    sound.onclick = () => { video.muted = !video.muted; sound.textContent = video.muted ? '🔇' : '🔊'; };
  }

  // highlight the section in view
  const links = [...document.querySelectorAll('#sfMenu a[href^="#"]')];
  const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  addEventListener('scroll', () => {
    let cur = null; for (const s of secs) if (s.getBoundingClientRect().top < 140) cur = s.id;
    links.forEach(a => a.classList.toggle('here', a.getAttribute('href') === '#' + cur));
  }, { passive: true });
})();
