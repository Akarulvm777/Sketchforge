#!/usr/bin/env node
// Builds the website into dist-site/: the landing / account pages (site/), the web app in /app/ (same files as the
// desktop app), /version.json (what the apps check for updates) and Netlify headers.
//   node tools/build_site.mjs                  (Netlify runs this; see netlify.toml)
// Download links: package.json "sketchforge.releasesRepo" (a PUBLIC GitHub repo that holds the installers, e.g.
// "you/sketchforge-downloads") -> https://github.com/<repo>/releases/download/v<version>/<file>; or set DOWNLOADS_DIR
// to a folder with the installers to put them on the site itself (/downloads/).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'dist-site');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const V = pkg.version, cfg = pkg.sketchforge || {};
const copy = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); };
const copyDir = (src, dst) => { for (const e of fs.readdirSync(src, { withFileTypes: true })) { const s = path.join(src, e.name), d = path.join(dst, e.name); if (e.isDirectory()) copyDir(s, d); else copy(s, d); } };

fs.rmSync(OUT, { recursive: true, force: true });
copyDir(path.join(ROOT, 'site'), OUT);
for (const f of ['icon.svg', 'icon-192.png', 'icon-512.png', 'cloud-config.js', 'cloud-lib.js']) copy(path.join(ROOT, f), path.join(OUT, f));
// the web app
const appFiles = pkg.build.files.filter(f => f !== 'main.js');
const files = [];
for (const f of appFiles) {
  copy(path.join(ROOT, f), path.join(OUT, 'app', f));
  files.push({ path: f, size: fs.statSync(path.join(ROOT, f)).size });
}
// downloads
const names = { windows: `Sketchforge-Setup-${V}.exe`, macArm: `Sketchforge-${V}-mac-arm64.dmg`, macIntel: `Sketchforge-${V}-mac-x64.dmg`,
  android: `Sketchforge-${V}-android.apk`, linux: `Sketchforge-${V}-linux-x86_64.AppImage`, ios: `Sketchforge-${V}-ios-unsigned.ipa` };
if (cfg.mac === false) { delete names.macArm; delete names.macIntel; } // Mac build paused: no Mac links
const downloads = {};
if (process.env.DOWNLOADS_DIR) {
  for (const [k, n] of Object.entries(names)) { const p = path.join(process.env.DOWNLOADS_DIR, n); if (fs.existsSync(p)) { copy(p, path.join(OUT, 'downloads', n)); downloads[k] = `downloads/${n}`; } }
} else if (cfg.releasesRepo) {
  for (const [k, n] of Object.entries(names)) downloads[k] = `https://github.com/${cfg.releasesRepo}/releases/download/v${V}/${n}`;
}
// notes: the README sections of this version ("## 2.4: …")
const mm = V.split('.').slice(0, 2).join('.');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const changes = readme.split(/\n(?=## )/).filter(sec => sec.startsWith(`## ${mm}:`)).map(sec => {
  const [head, ...rest] = sec.split('\n');
  return { title: head.slice(mm.length + 4).trim(), items: rest.filter(l => /^- /.test(l)).map(l => l.slice(2).replace(/\*\*/g, '').trim()) };
});
const notes = changes.map(c => '• ' + c.title).join('\n');
const site = ((fs.readFileSync(path.join(ROOT, 'cloud-config.js'), 'utf8').match(/"site"\s*:\s*"([^"]*)"/) || [])[1] || '').replace(/\/+$/, '');
const version = { version: V, date: new Date().toISOString().slice(0, 10), notes, changes, files, downloads,
  shell: { desktop: cfg.minShell || '2.4.0', android: cfg.minShell || '2.4.0', ios: '2.11.5' }, site };
fs.writeFileSync(path.join(OUT, 'version.json'), JSON.stringify(version, null, 1));
fs.writeFileSync(path.join(OUT, '_headers'), `/version.json
  Cache-Control: no-cache
  Access-Control-Allow-Origin: *
/app/*
  Cache-Control: no-cache
  Access-Control-Allow-Origin: *
/cloud-config.js
  Cache-Control: no-cache
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);
console.log(`site ${V}: ${files.length} app files, downloads: ${Object.keys(downloads).join(', ') || 'none'} -> ${path.relative(ROOT, OUT)}`);
