#!/usr/bin/env node
// Copies the static app (the files listed in package.json build.files, minus the Electron shell) into www/
// for the Android app (Capacitor) and the web / iPad version.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const out = path.join(ROOT, 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
for (const f of pkg.build.files.filter(f => f !== 'main.js')) fs.copyFileSync(path.join(ROOT, f), path.join(out, f));
console.log('www/ ready:', fs.readdirSync(out).join(', '));
