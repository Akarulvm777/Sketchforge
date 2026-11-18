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

## 2.0.x: symmetry drawing
"Symmetry" button in the top bar (or View menu, or Shift+M) mirrors everything you draw. The ▾ opens options: mirror, 4-way mirror, radial and kaleidoscope (2–24 segments), with a vertical or horizontal axis through the canvas centre. Pens, brushes, erasers and figure shapes are mirrored exactly (tips, nib angles and paper texture included), also on moved / rotated layers, and one undo removes the whole stroke. For an axis at any position or angle, use Ruler → Symmetry ruler.

## 2.0.x: 🎨 Custom P menu
New menu next to Add-ons. Colour modes: Default, Midnight blue, Graphite, Light, Paper, Sakura, Forest, Ocean, Purple night, Sepia, High contrast, or "My colours" (background, panels, text, accent and canvas area, applied live). Icons: replace any icon with any image file the browser can open (PNG, JPG, GIF, WebP, SVG, BMP, ICO…); it is resized to icon size automatically, and × restores the original. "Reset to default" puts colours and icons back. Settings are remembered on this device.

## 2.0.x: time-lapse per file, workspace recording
- The "REC Time-lapse" button turns recording on / off (remembered); ▾ opens options and export.
- Each file has its own time-lapse: New starts an empty one, it is saved inside the .sketchforge file (optional) and continues when you reopen that file.
- Record modes: **Workspace view** (default: the canvas as you see it, with zoom, pan, rotation, cursor, current tool, brush size and colour), **Whole screen** (real screen recording of the app, desktop browsers and the desktop app; asks permission), **Canvas only** (as before).

## 2.0.x: multiple documents
- Open as many files as you like: New and Open create a new tab (the empty start tab is reused). Click a tab to switch, × or middle-click to close (asks if there are unsaved changes), drag tabs to reorder, Ctrl+Tab / Ctrl+PageDown to cycle.
- Each document keeps its own layers, size, undo history, selection, zoom / rotation, time-lapse and audio. Copy / paste works between documents.
- Right-click a tab (or Window menu): close others, duplicate, **Move to new window** (the document opens in a separate app window and leaves this one), Open a copy in new window.
- Window → Second view: a floating live view of the current document with its own zoom, rotation and flip; ⧉ pops it out into its own window.

## 2.0.x: video and sound reference
- Animation → Import video reference… (also Layer menu, or drop a video on the canvas). Two ways to use it:
  - **Reference layer**: a VIDEO layer that shows the matching video frame for every timeline frame and plays with the animation. Adjustable opacity, start frame and fit; it can't be painted on and is never exported. The eyedropper picks colours from it.
  - **Animation frames**: every video frame becomes a frame on a new layer, to trace or paint over (rotoscoping).
- The video's sound can become the audio track; Layer → Add sound / voice… loads any audio file. Both play with the animation.
- Video and sound are kept inside the .sketchforge file (up to 60 MB each); bigger videos can be relinked with Animation → Relink video….

## 2.0.x: open Photoshop and Clip Studio files
- File → Open (or drop on the canvas) now opens **.psd / .psb** with their layers: position, opacity, visibility, blend mode, clipping; RGB, grayscale and CMYK, 8 and 16 bit. Groups are flattened (their visibility / opacity apply, the group name is added before the layer name), layer masks are applied to the pixels.
- **Save as Photoshop PSD** keeps layers, opacity, visibility, blend modes, clipping and non-English layer names.
- **.clip** (Clip Studio) files open as one flattened picture (the full preview stored inside the file); the .clip format is not public, so separate layers are not available — export PSD from Clip Studio for layers.

## 2.0.x: pen pressure for every tablet
- Strokes no longer start with a dot or a jump on tablets that report no pressure on the first touch (Wacom / Huion on Windows and others).
- View → Pen pressure & touch: **Calibrate my pen** (draw a few light-to-hard strokes; the app uses the range your pen really reaches — useful for XP-Pen / Huion pens that never report full pressure), Soft / Normal / Firm presets, a live "pressure is working" check, and setup steps for Wacom, XP-Pen, Huion, Gaomon / Veikk, macOS, iPad + Apple Pencil, Surface / Samsung.
- The pen's side button works: eyedropper by default (or move the canvas / nothing).
- iPad: no more text-selection magnifier or callout interrupting Apple Pencil strokes.

## 2.0.x: reuse drawings in animation
- Animation → Copy drawing / Paste drawing here (Alt+C / Alt+V): copy one layer's drawing to another frame, layer or document as a new keyframe — no redrawing.
- Animation → Repeat frames (cycle)…: repeat a frame range N times (walk / run cycles), on all layers or only the active one.
- Animation (or Window) → Drawing library: save a drawing or a selection once; click it (or drag it onto the canvas) to place it again on any frame, in any document. The library is kept in the browser between sessions.

## 2.0.x: bone rig (cut-out animation)
- Layer → Bone rig: set parent…: a layer follows its parent layer. Draw each body part on its own layer, link forearm → upper arm → body, and Alt+drag each part's orange pivot dot (Move tool) onto its joint.
- Rotating / moving a part with the Move tool carries all its children; keyframes and motion tweens animate the whole limb. Bones are drawn over the canvas in the Move tool. Parent links are saved in the file. Layer → How to rig a character… explains the steps.
