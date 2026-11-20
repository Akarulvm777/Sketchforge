# Sketchforge

**Sketchforge is a free 2D drawing and animation app.** Paint illustrations and comics, then bring them to life with
frame-by-frame or cut-out animation, all in one workspace. It runs on Windows, Mac, Linux, Android, and in any browser
(iPad and iPhone included).

Its layout will feel familiar to people who know professional illustration and animation software. All of its code is
original.

## What it is for

- **Drawing and painting:** pens, pencils, brushes, airbrush, watercolour and textured brushes with pen pressure
  (Apple Pencil and drawing tablets), layers with folders, masks, clipping and 28 blend modes, selections, filters
  and effects, rulers, symmetry, perfect shapes.
- **Comics and manga:** panels, speech bubbles, screen tones, shading pens, page manager.
- **Animation:** timeline with keyframes, onion skin, motion tweens, bone rigs and puppet warp, swap drawings
  (open ↔ closed hand), Live2D-style face sliders (blink, mouth, smile), light table, sound for lip-sync.
- **References:** a posable 3D model, video reference layers, imported pictures.
- **Your tools:** import Clip Studio `.sut` brushes, make your own brushes, colour sets and themes.
- **Files:** saves `.sketchforge` projects; opens and saves Photoshop `.psd`; exports PNG, GIF, WebM video, sprite
  sheets and PNG sequences.
- **Learning:** built-in tutorials and ✨ Ask, a free offline helper that explains every tool and teaches painting
  and animation techniques.

## Install

Download the latest version from the [website](https://akarulvm777.github.io/Sketchforge/) or the
[Releases page](https://github.com/Akarulvm777/Sketchforge/releases/latest):

| Platform | File |
|---|---|
| Windows | `Sketchforge-Setup-<version>.exe` |
| Mac | `…-mac-arm64.dmg` (Apple Silicon) or `…-mac-x64.dmg` (Intel) |
| Linux | `…-linux-x86_64.AppImage` |
| Android | `…-android.apk` |
| iPad / iPhone / any browser | open the website's web app, then Share → Add to Home Screen |

Installed apps update themselves. What changed in each version: [CHANGELOG.md](CHANGELOG.md).

## Build from source

The `master` branch is always the code of the latest release.

```bash
python3 build.py              # makes app.js from parts/*.js
python3 -m http.server 8000   # then open http://localhost:8000
npm install && npm start      # desktop app (Electron)
npm run dist                  # installers for your platform (electron-builder)
npm test                      # automated tests (needs Python 3, Node and Playwright)
```

## License

MIT. Third-party parts keep their own licences (three.js: `THREE-LICENSE.txt`).
