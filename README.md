# Sketchforge 2.0 — drawing + animation studio

A Clip Studio-style workspace fused with an Adobe Animate-style timeline.
Original app, "inspired by" those tools — it uses no Clip Studio / Adobe code, assets or branding, and is not an exact clone.

## Run it
- **Any browser / phone / tablet:** open `index.html` (or host the folder; it installs as a PWA — "Add to Home Screen").
- **Desktop app:** `npm install` then `npm start` (Electron). `npm run dist` builds installers (electron-builder).
- Mobile native shell: wrap the same folder with Capacitor (`npx cap add android|ios`).

## What's in this stage
- CSP-style layout: menu bar, tool palette with sub-tool groups, Tool Property panel, Navigator (zoom / rotate / flip), colour wheel, layers with blend + opacity.
- Pens, pencils, brushes, airbrush, marker, soft/hard eraser (pressure + stabiliser), fill, linear/radial gradient, eyedropper, shapes, text.
- Selection: rectangle, ellipse, lasso, magic wand, add/subtract/intersect, invert, fill, clear, copy/cut/paste, move selected pixels.
- Canvas rotate (twist / `[` `]` / Rotate tool), flip, pinch zoom, pan.
- Timeline: keyframes, blank keyframes, insert/remove frames, onion skin, playback, scrubbing.
- **Motion tweens:** Move tool drags / rotates / scales / pivots a keyframe; "Tween" fills in the frames between keys (with easing field in code, alpha too).
- Undo/redo for everything, save/open `.sketchforge`, export GIF, WebM, PNG-sequence ZIP, single PNG.

## Not yet (next stage)
Manga tools (panel cutting, speech balloons, screen tones, rulers/perspective guides), 3D models, vector layers, shape tweens / bones, audio.

## Build from source
`python3 build.py` concatenates `parts/*.js` into `app.js`.

## 0.5: movable panels + add-ons
- Drag any panel title to float it anywhere, drop it on either side to dock it; double-click a title to collapse. Window menu: show/hide panels, reset layout. Layout is remembered.
- Add-ons menu: import an image as a brush tip (PNG with transparency, or dark-on-white), install a `.js` add-on script (API: `Sketchforge.addBrush`, `Sketchforge.addCommand`, ...).
- Clip Studio's own brush/material files (.sut, .lmtl etc.) are proprietary and cannot be loaded.

## 0.6: Clip Studio .sut import
Add-ons -> Import Clip Studio brush (.sut). Reads size, opacity, density, hardness, anti-aliasing, stabilisation, pressure on size/density, start taper and embedded tip images. Texture, spray, dual brush, out-taper and colour-mixing settings are not applied.

## 0.7: pen pressure & touch (Apple Pencil / tablets)
Edit-> View menu "Pen pressure & touch...": sensitivity curve, min/max pressure, palm rejection (fingers pan/zoom once a pen is used), two-finger tap = undo, live test pad.
iPad: host the folder (Netlify / GitHub Pages), open in Safari, Share -> Add to Home Screen.

## 0.8: Sub Tool footer
Buttons under the Sub Tool list: + import (.sut or image), duplicate, delete (imported/duplicated only). You can also drag a .sut file onto the panel.

## 0.9: visual polish
Calmer colour scheme, uppercase panel headers, rounded menus and dialogs, accent bars on selected rows, softer canvas background.

## 1.0: 3D model panel
Layer -> Add 3D model: posable male / female mannequin (joint sliders, drag a body part to rotate it, preset poses), cube / sphere / cylinder, import .glb / .gltf / .obj, light direction, toon shading, show over canvas as reference, "Place on new layer". Uses a bundled copy of three.js (three3d.js, MIT licence).

## 1.1: built-in Clip Studio pen set
The Pen group now ships with the 11 pens from the user's own Clip Studio "pen" folder (G-pen, Real G-Pen, Mapping pen, Turnip pen, Calligraphy, Textured pen, Milli pen, Felt pen, Rough pen, Flat marker, Dot pen), imported from their .sut files with settings approximated. Check each brush's licence before sharing the app with others.

## 2.0.x: rigged 3D mannequins
The 3D panel's male and female mannequins are now real body meshes (from `assets/HumanLowPolyBaseMesh.fbx`), rigged with the same 16 joints as before, in grey. All poses, joint sliders, drag-to-rotate, toon shading and "Place on new layer" work as before; clicking a body part selects the joint under the cursor on the posed body.
The rig is generated offline: `npm install` then `npm run build:models` rewrites `models3d.js` (quantized mesh + skin weights, loaded on demand like `three3d.js`, so it also works from `file://`). If `models3d.js` is missing, the old procedural mannequin is used.
Check the licence of the base mesh before distributing the app.
