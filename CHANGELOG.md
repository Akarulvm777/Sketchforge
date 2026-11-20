# Changelog

Every Sketchforge update, newest first. Each section is `## <version>: <title>`; the app's What's new window, the
website and the GitHub release notes are made from this file (see `build.py`, `tools/build_site.mjs`,
`tools/release_notes.py`).

## 2.13: swap drawings tutorial
- New: Help › Tutorials › 🔁 Swap drawings (practice), also in the Animation menu. A practice file with two drawings of the same girl (calm and excited): add them to the swap bar, swap them on any frame, update everywhere, play. Each step has a Show me button.

## 2.13: swap drawings and face sliders
- New: swap drawings in animation: open hand ↔ closed hand, eyes open ↔ closed, any mouth shape. In the Animation workspace the 🔁 Swap bar above the timeline keeps each layer's drawings: draw a version and tap ＋, then tap a drawing on any frame to swap it in. The frame keeps its position, rotation, bones and tweens. Alt+] / Alt+[ = next / previous drawing; ⟳ Update everywhere copies an edited drawing to every frame that uses it; right-click a drawing to rename or remove it. Saved in the .sketchforge file.
- New: face sliders, Live2D-style (Animation › 🙂 Face sliders). Draw a face, drag a box around each eye, the mouth and the brows, then move the sliders: Eye open / closed, Mouth open, Smile, Brow up / down. Each frame where you move a slider becomes a face key, and the frames between two keys are made for you, smoothly. 👁 Blink here makes a whole blink in one tap. Works when the face is drawn on the skin (the skin colour fills in). You can choose the colour inside the mouth. Saved in the .sketchforge file.

## 2.12: every blending mode, and a welcome from the mascot
- New: all 28 layer blending modes in the usual order: Linear burn, Subtract, Glow dodge, Add, Add (Glow), Vivid light, Linear light, Pin light, Hard mix, Darker color, Lighter color and Divide join the others ("Luminosity" is now called Brightness). They look the same on screen, in exports, when merging layers, with the eyedropper and in Photoshop files.
- Fixed: the layer list did not show the new blend mode name after changing it.
- New: ✨ Ask teaches painting and animation: 29 step-by-step lessons (sketching, line art, proportions, hands, faces, perspective, colour harmony, values, blend modes, cel and soft shading, light, skin, hair, eyes, watercolour, painterly, backgrounds, manga pages, animation principles, bouncing ball, walk cycle, mouth shapes, cut-out rigs, layer setup, finishing), each with buttons to the tools that help. Ask a question ("how do I shade skin?") or tap 📚 Learn.
- New: the Sketchforge mascot welcomes you with an animation on the first start and when a new version starts, just before What's new (tap to skip; Help › Play the welcome animation).

## 2.11: your colours, paper and brushes
- New: the update history. What's new (Help › What's new in this version) shows the newest update first, then every earlier update with its date and time; tap one to read it. The website shows it too.
- New: the Mac app is back (Apple Silicon and Intel .dmg), and the iPad test app (.ipa) is built with every release.
- New: an iPad / iPhone test app (.ipa, unsigned) with every release, to install with AltStore or Sideloadly and your Apple ID (works 7 days, then install again). Saved files appear in Files › On My iPad › Sketchforge. The Home Screen web app still works as before.
- Faster drawing, most of all on iPad and big pages: the pen position is measured once per frame instead of on every pen event; a stroke no longer copies the whole picture when it starts (only erasers and blending brushes need it); textures, selections and erasers work on the stroke's area only; the blur tool is about 25× faster; watercolour edges are made from a smaller copy; time-lapse and auto-save wait until you stop drawing.
- Fixed: Apple Pencil pressure on iPad. When Safari sends the Pencil without pressure, Sketchforge reads the Pencil's force sensor directly; in-between samples without pressure take the pen's real pressure. The Pencil no longer opens the magnifier or selects text on the canvas. View › Pen pressure & touch shows where the pressure comes from.
- Fixed for iPad / iPhone: older iPad Safari (before iPadOS 15.4) can now open every window of the app. If the app ever cannot start on a device, it shows why, with a Repair & reload button (instead of a blank page).
- Website: new section about Clip Studio tools, the brush editor, colour sets and paper; clearer iPad steps and help.
- New: make an imported Clip Studio tool match. ⓘ › ⚙ Adjust opens it in the brush editor with a list of what Clip Studio does differently; tune it with the live preview (pressure, tilt and speed curves too). Everything the import translated is kept.
- New tutorial: Help › Tutorials › Clip Studio tools & your own brushes (and ✨ Ask knows about it).
- New: colour sets. Keep as many sets of favourite colours as you like, each with its own name (Color panel: ＋ adds the main colour, ⋯ › New colour set…, right-click or long-press to remove, export / import, GIMP palettes too).
- New: colour history. The colours you painted with stay below the sets, even after a restart.
- New: paper texture for new files (drawing paper, watercolour, rough, canvas, charcoal…) with paper colour presets (cream, kraft, black…). Brushes can pick up the paper grain. Change it any time: Layer › Paper colour & texture….
- New: the brush editor. Create your own brush or change any brush with every setting: tip pictures (or the drawing on your layer), angle, thickness, rotation, pressure curves, thin start / end, spray, colour change, colour mixing, watercolour edge, texture, blending mode. Live preview. Share brushes as .sfbrush files.

## 2.10: more Clip Studio settings work
- New: thin end. Tools with a thin start / end in Clip Studio now get thinner at the end of the stroke too (and fade in / out when the tool fades opacity).
- New: pen tilt and drawing speed change size and opacity through each tool's own curves; random size and opacity per dab use the tool's minimum.
- New: saturation and brightness change per dab, rotation by pen pressure, "at least 1 px", density that follows spacing, stronger texture grain, post correction.
- New: colour mixing brushes keep their paper texture.

## 2.10: Clip Studio tools translated setting by setting
- New: a tool translator. Every imported Clip Studio tool is read setting by setting, and ⓘ at the bottom of the Sub Tool panel shows what became of each one (✓ same, ≈ close, ✗ not in Sketchforge yet). Settings Sketchforge does not use yet are remembered, so you can see which ones your tools rely on.
- New: colour mixing. Brushes with Clip Studio colour mixing pick up the colour under them and mix it with the brush colour (amount of paint, density, colour stretch).
- New: each tool's own pen pressure curve and minimum size / opacity are used, so pens feel like they do in Clip Studio.
- New: a tool's own blending mode (Multiply…), spray area + particle size + bias, tip angle, random rotation, tip thickness, texture angle, brightness and contrast.
- Fixed: pen pressure was read from the wrong place in .sut files, so some tools ignored pressure.
- Fixed: imported tools started every stroke thin even when the tool does not do that. Only tools that switch on a thin start for size get it now.
- Fixed: decoration shapes no longer turn randomly unless the tool says so; better group choice (brush / pen / pencil / decoration).
- Tools imported before 2.10: import the .sut files again to get the new translation.

## 2.9: Clip Studio tools work like they should
- Fixed: imported Clip Studio gradients all came out as main → sub colour. They now keep their own colours (every colour stop and its position).
- Fixed: brush tips and textures stored as materials inside the .sut file were ignored, so many brushes drew as plain round brushes. They are read now, at their real size (hatching pens, decoration brushes, textured line art, watercolour paper).
- Fixed: tip pictures are read like in Clip Studio (dark = ink, white = no ink), so shapes such as hearts show up instead of a grey blob.
- Fixed: a colour change that is switched off in the tool no longer adds random colours.
- Hatching pens go to the Shading pens group by themselves.

## 2.9: easier layers and a fresh start on new installs
- Installing the app (Windows / Mac / Linux installer or a new Android APK) starts with default settings; your work, drawing library and imported tools are kept. Automatic updates keep your settings.
- Every layer has a ⋯ button: move it to a folder, colour it… (works with a finger, no right-click needed). A folder's ⋯ has "Put the selected layer here".
- New folder with no layer ticked makes an empty folder ready to fill.
- Fixed: with many tools, the Sub tool list squeezed them thin. Tools keep their size and the list scrolls.

## 2.9: rig with the Bone tool
- New 🦴 Bone tool (in the tool palette, after the Shading pens). Click a part, then click the part it follows: they are linked and the joint goes where they touch. Or drag from a part onto its parent. Drag any dot to move a joint. Alt+click frees a part.
- Sub tool Bone: pose: drag a part to turn it around its joint, everything attached follows. On the timeline each pose makes a keyframe.
- The rigging tutorials (and the fox practice) now use the Bone tool.

## 2.9: layer folders, tick boxes and colours
- Every layer has a tick box: tick as many as you want, then put them in a folder, colour them, show / hide or delete them together.
- Folders: open / close, hide the whole folder, rename, ungroup. Drag layers onto a folder to move them in.
- Colour labels for layers and folders, with preset colours and your own colours (remembered).

## 2.9: all your Clip Studio tools
- Import Clip Studio tools of every kind, not only pens: pencils, brushes, airbrushes, decoration brushes, erasers, blend tools and gradients. Each one goes by itself to the right tool group and stays there.
- Decoration brushes keep all their shapes, scatter, random rotation and colour changes; shapes in colour keep their colours.
- Import many at once: several .sut files, a .zip of tools, or a whole folder (Add-ons menu, the + of the Sub tool panel, or drop them on it).

## 2.8: learn to rig with a fox
- Help › Tutorials › 🦊 Rig the fox: a practice file with a fox (art by bluegi), every body part on its own layer. Step by step: put the parts together, link them with bones, place the joints, pose, animate with keyframes and tweens, play. Each step has a "Show me" button.
- A 1-minute video of the same steps, in Help › ▶ Video: rig a character and on the website.

## 2.8: new 3D characters (VRoid)
- The 3D panel's man and woman are new VRoid characters with a full skeleton: every finger and better bending at the shoulders, elbows, knees and hips. Models by bluegi.
- They are grey mannequins by default, with the eyes and brows still visible. 3D panel › Colours › Original colours shows their colours.
- Load VRM… (or the "My VRM…" button) poses your own VRoid Studio character with the same tools: poses, hand poses, drag to move, body shape.
- The previous grey mannequin is still there: Model › Simple mannequin.

## 2.8: pose the 3D model right on the canvas
- 3D panel › ✋ Pose on canvas: click or touch any body part on the big model over your drawing and drag it. Move: the hand, foot or head follows your finger and the arm or leg bends. Rotate: turn that joint. Drag the hips to move the whole body, drag empty space to turn around the model.
- A small bar on the canvas shows which part you hold and switches Move / Rotate. Done goes back to drawing.

## 2.7: smoother light pressure (Apple Pencil, pen tablets)
- Fixed: drawing slowly with light pressure, the line trailed behind the pen tip. It now follows the pen right away.
- Fixed: with some pens (Windows Ink tablets, Apple Pencil), the start of a light stroke was lost because the first touch reported no pressure. The line now starts exactly where the pen touches down.
- Light touches now give a clearer line: the default pressure response is softer. Pen pressure & touch › Soft / Normal / Firm still lets you choose.

## 2.7: perfect shapes and quick colour picking
- Draw a circle, line, square or triangle and keep the pen or finger down for half a second at the end: it becomes a perfect shape with the same brush (circle, ellipse, straight line, corner line, arc, triangle, square, rectangle, polygon). Lift to keep it, undo to get your own stroke back.
- Touch and hold (or click and hold with the mouse) on the drawing: a circle shows the colour under your finger and it becomes your colour. Move to pick another one, lift to keep it.
- Both can be turned off in the View menu.

## 2.7: import pictures and sound
- File › Import image… (Ctrl+Shift+O): PNG, JPEG, WebP, GIF, BMP, TIFF, SVG, ICO, AVIF and more, on a new layer, fitted to the page.
- Several pictures or an animated GIF become animation frames on one layer.
- File › Open… opens a picture as a new page of its size. Drop pictures on the canvas, or paste a picture copied in another app (Ctrl+V or Edit › Paste image from clipboard).
- File › Import sound / music… (MP3, WAV, M4A, OGG, FLAC…) and File › Import video… are now in the File menu.

## 2.7: effects with live preview
- New effects in the Filter menu: glow, drop shadow, outline (border), bloom, extract line art (trace a photo), emboss, halftone dots, oil paint, vignette, chromatic aberration, glitch, twirl, pinch / bulge, wave / ripple, grayscale, sepia.
- Every filter and effect now shows the result live on the canvas while you move the sliders.

## 2.6: your picture around the page
- 🎨 Custom P › Colours › Pictures: "Around the page" puts your own image in the area around the drawing (where you draw), besides the whole app background, panels, menu bar, tool palette and timeline.

## 2.6: easier updates
- When a new version needs a new installer, a popup offers "Download update": install it over the old app, no need to uninstall, your drawings and settings stay.
- After updating, a "What's new" popup lists what changed and what was fixed (also in Help › What's new in this version).
- Fixed: a new Android APK could not be installed over the previous one ("App not installed"). Android versions are now signed with the same Sketchforge key every time. One last time only: uninstall the old Android app before installing 2.6 (save your drawings first).

## 2.5: smoother drawing, less lag
- Fixed: on phones (and big pages) circles came out as polygons with straight sides. Strokes now follow a smooth curve through every point of your finger or pen, even when the device is busy.
- Fixed: lag while drawing. The time-lapse took a full-size picture after every stroke (over a second on a big page); it now records at screen size, when the app is idle. Remembering your work now saves in the background, never in the middle of a stroke. Each stroke no longer clears two full-size buffers.
- The stabiliser works on the smooth curve, so fast strokes keep their shape.

## 2.5: ✨ Ask on phones and tablets
- Fixed: the ✨ Ask helper was hidden on phones. It is now a round ✨ button in the corner on phones and tablets, and opens as a large panel.

## 2.5: pictures in 🎨 Custom P
- Colours tab › Pictures instead of colours: your own image behind the whole app, or on the side panels, menu bar, tool palette or timeline, with a "Darken pictures" slider so text stays readable.

## 2.5: manga tones and shading pens
- New Manga tone tool: dot tones 10 / 20 / 30 / 50 %, fine and big dots, line, horizontal line and cross-hatch tones, sand tone and a tone eraser. The pattern stays aligned on the page like a real tone sheet, so overlapping strokes never double the dots.
- New Shading pens: shadow pen (solid blacks), hatching brush, cross-hatching brush, stipple pen.

## 2.4.1: public website
- The official website is live on GitHub Pages: https://akarulvm777.github.io/Sketchforge/ — features, downloads for Windows / Mac / Android / Linux, and the web app (iPad: open it in Safari → Share → Add to Home Screen).
- Installed apps check this website for new versions and update themselves.
- The ✨ Ask helper is free and offline for everyone. Accounts / cloud stay hidden until they are switched on (docs/ONLINE-SETUP.md).

## 2.4: animation on one layer
- Draw a whole animation on one layer: drawing on a frame without its own drawing makes a new blank drawing (or a copy, or edits the held one — "Empty frame" in the timeline). Onion skin turns on by itself.
- ＋ New drawing (Shift+→) on 1s / 2s / 3s / 4s; right-click any frame for the timeline menu (new / copy / delete / clear drawing, hold longer / shorter, copy / paste, reverse, tween + ease in / out, insert / delete frame, play range); drag the selected drawing to move it (Alt = copy); double-click an empty frame.
- Play range (shown on the ruler), ping-pong; onion skin settings (drawings or frames, this layer or all, colours, strength).
- Export: sprite sheet, transparent background, play range only.
- The first time you open the Animation workspace Sketchforge asks if it's your first time and offers the animation tutorials (new: "Every animation tool"), with a "Don't ask me again" tick.

## 2.4: 3D model fingers, drag to move, body shape
- 3 bones in every finger: hand poses (relaxed, open, fist, point, peace, thumbs up, grip) and a curl slider per finger.
- Drag a hand, foot or any part and the body follows (elbows and knees bend the right way); "Drag: Rotate joint" keeps the old behaviour.
- Body shape: head, build, shoulders, hips, torso / arm / leg length, hands, feet. Zoom slider, pinch to zoom, size 20–300 %.

## 2.4: updates itself
- The browser / iPad version shows "New version — Reload"; the Windows / Mac app downloads new versions in the background and switches with one click (falls back to the built-in version if an update fails to start); the Android app downloads them into the app. Help › Check for updates.

## 2.4: account, cloud and the ✨ Ask helper
- Sign in with Google or GitHub (☁ Account or the button top right): save / open drawings in the cloud, settings sync between devices, a community library of brushes (.sut) and themes to add or share. Optional: everything else works without an account.
- ✨ Ask: a free helper that works offline. It searches every menu, tool, tutorial and common question (English and French words) and answers with buttons that take you there. It never draws for you — AI is not supposed to steal your job.
- Official website with downloads, features, account page. Setup: docs/ONLINE-SETUP.md.

## 2.3: remembers your last work
Close the app (or the tab) at any time: next time Sketchforge opens every file you had open, on the same tab, frame, zoom and position, with your tool and colours. Files keep their "unsaved" mark until you save them. File menu: "Reopen my last work at start (on / off)" and "Start fresh (close everything)".

## 2.3: installable apps
- Windows installer (.exe), Mac app (.dmg, Apple Silicon and Intel), Android app (.apk) and Linux AppImage, built automatically by GitHub Actions and attached to each release. iPad / iPhone: Add to Home Screen from Safari.
- Phones and small tablets: a ☰ Menu button replaces the menu bar, and Panels opens tool settings, then layers, as full-screen sheets. In the Android app, Save and Export write to Documents/Sketchforge (or open the share sheet).

## 2.3: tutorials
Help › 📚 Tutorials: 14 guided tours that point at the real buttons, with ▶ "Show me" buttons and ✓ marks for finished ones:
- Get started: Welcome tour (offered on first start), Your first drawing.
- Tools & options: Every tool one by one (each tool and its sub tools), All menus and options, Layers & selections, Pen tablet & pressure.
- Features: Symmetry, time-lapse, 3D, multiple files, Photoshop / Clip Studio files, video & sound reference, remembered work.
- Animation & rigging: Make an animation, Motion tweens, Rig a character (bones), Bend a drawing (puppet pins), Reuse drawings.
- Customise: Custom P (walks through every tab), Install the app.

## 2.2: 🎨 Custom P — customise everything
Custom P is now a full studio with 8 sections, all applied live:
- **Themes**: 16 colour themes, 4 layout styles (compact, big touch-friendly, soft rounded, classic square), 🎲 Surprise me, save your own themes, export / import theme files (.sftheme).
- **Colours**: base colours plus every area on its own (menu bar, command bar, tabs, tool palette, tool buttons, selected tool, side panels, panel titles, sub tools & layers, selected layer, timeline, frames, tweens, status bar, buttons, main buttons, text boxes, dialogs & menus, messages) and text, keyframe dots, borders, sliders, scrollbars. Text stays readable automatically.
- **Text & fonts**: 10 fonts or your own font file, text size, bold, letter spacing, panel title style.
- **Layout & size**: interface scale, roundness, border thickness, spacing, icon size, 1–3 tool columns, panel widths, timeline height, tool palette left / right, swap panels, command bar top / bottom, timeline above / below, hide status bar / tabs / command bar.
- **Icons**: colour, selected-tool colour, line thickness, size, replace any icon with any image.
- **Canvas area**: theme / solid / gradient / radial / checkerboard / dots / grid / your image, sheet shadow and border.
- **Cursor**: colour, thickness, centre cross, outline.
- **Effects**: wallpaper behind the app, see-through panels with glass blur, shadows, animations, glow.
- ↺ on every option, "Reset this section" and "Reset everything".

## 2.2: Custom P window
The Custom P window keeps the original look (tabs across the top, colour swatch cards, the icon grid, Reset to default / Done) with all the new options: themes, colours of every part, icons, text & fonts, layout, canvas area, cursor and effects.

## 2.1: rigged 3D mannequins
The 3D panel's male and female mannequins are now real body meshes (from `assets/HumanLowPolyBaseMesh.fbx`), rigged with the same 16 joints as before, in grey. All poses, joint sliders, drag-to-rotate, toon shading and "Place on new layer" work as before; clicking a body part selects the joint under the cursor on the posed body.
The rig is generated offline: `npm install` then `npm run build:models` rewrites `models3d.js` (quantized mesh + skin weights, loaded on demand like `three3d.js`, so it also works from `file://`). If `models3d.js` is missing, the old procedural mannequin is used.
Check the licence of the base mesh before distributing the app.

## 2.1: symmetry drawing
"Symmetry" button in the top bar (or View menu, or Shift+M) mirrors everything you draw. The ▾ opens options: mirror, 4-way mirror, radial and kaleidoscope (2–24 segments), with a vertical or horizontal axis through the canvas centre. Pens, brushes, erasers and figure shapes are mirrored exactly (tips, nib angles and paper texture included), also on moved / rotated layers, and one undo removes the whole stroke. For an axis at any position or angle, use Ruler → Symmetry ruler.

## 2.1: 🎨 Custom P menu
New menu next to Add-ons. Colour modes: Default, Midnight blue, Graphite, Light, Paper, Sakura, Forest, Ocean, Purple night, Sepia, High contrast, or "My colours" (background, panels, text, accent and canvas area, applied live). Icons: replace any icon with any image file the browser can open (PNG, JPG, GIF, WebP, SVG, BMP, ICO…); it is resized to icon size automatically, and × restores the original. "Reset to default" puts colours and icons back. Settings are remembered on this device.

## 2.1: time-lapse per file, workspace recording
- The "REC Time-lapse" button turns recording on / off (remembered); ▾ opens options and export.
- Each file has its own time-lapse: New starts an empty one, it is saved inside the .sketchforge file (optional) and continues when you reopen that file.
- Record modes: **Workspace view** (default: the canvas as you see it, with zoom, pan, rotation, cursor, current tool, brush size and colour), **Whole screen** (real screen recording of the app, desktop browsers and the desktop app; asks permission), **Canvas only** (as before).

## 2.1: multiple documents
- Open as many files as you like: New and Open create a new tab (the empty start tab is reused). Click a tab to switch, × or middle-click to close (asks if there are unsaved changes), drag tabs to reorder, Ctrl+Tab / Ctrl+PageDown to cycle.
- Each document keeps its own layers, size, undo history, selection, zoom / rotation, time-lapse and audio. Copy / paste works between documents.
- Right-click a tab (or Window menu): close others, duplicate, **Move to new window** (the document opens in a separate app window and leaves this one), Open a copy in new window.
- Window → Second view: a floating live view of the current document with its own zoom, rotation and flip; ⧉ pops it out into its own window.

## 2.1: video and sound reference
- Animation → Import video reference… (also Layer menu, or drop a video on the canvas). Two ways to use it:
  - **Reference layer**: a VIDEO layer that shows the matching video frame for every timeline frame and plays with the animation. Adjustable opacity, start frame and fit; it can't be painted on and is never exported. The eyedropper picks colours from it.
  - **Animation frames**: every video frame becomes a frame on a new layer, to trace or paint over (rotoscoping).
- The video's sound can become the audio track; Layer → Add sound / voice… loads any audio file. Both play with the animation.
- Video and sound are kept inside the .sketchforge file (up to 60 MB each); bigger videos can be relinked with Animation → Relink video….

## 2.1: open Photoshop and Clip Studio files
- File → Open (or drop on the canvas) now opens **.psd / .psb** with their layers: position, opacity, visibility, blend mode, clipping; RGB, grayscale and CMYK, 8 and 16 bit. Groups are flattened (their visibility / opacity apply, the group name is added before the layer name), layer masks are applied to the pixels.
- **Save as Photoshop PSD** keeps layers, opacity, visibility, blend modes, clipping and non-English layer names.
- **.clip** (Clip Studio) files open as one flattened picture (the full preview stored inside the file); the .clip format is not public, so separate layers are not available — export PSD from Clip Studio for layers.

## 2.1: pen pressure for every tablet
- Strokes no longer start with a dot or a jump on tablets that report no pressure on the first touch (Wacom / Huion on Windows and others).
- View → Pen pressure & touch: **Calibrate my pen** (draw a few light-to-hard strokes; the app uses the range your pen really reaches — useful for XP-Pen / Huion pens that never report full pressure), Soft / Normal / Firm presets, a live "pressure is working" check, and setup steps for Wacom, XP-Pen, Huion, Gaomon / Veikk, macOS, iPad + Apple Pencil, Surface / Samsung.
- The pen's side button works: eyedropper by default (or move the canvas / nothing).
- iPad: no more text-selection magnifier or callout interrupting Apple Pencil strokes.

## 2.1: reuse drawings in animation
- Animation → Copy drawing / Paste drawing here (Alt+C / Alt+V): copy one layer's drawing to another frame, layer or document as a new keyframe — no redrawing.
- Animation → Repeat frames (cycle)…: repeat a frame range N times (walk / run cycles), on all layers or only the active one.
- Animation (or Window) → Drawing library: save a drawing or a selection once; click it (or drag it onto the canvas) to place it again on any frame, in any document. The library is kept in the browser between sessions.

## 2.1: bone rig (cut-out animation)
- Layer → Bone rig: set parent…: a layer follows its parent layer. Draw each body part on its own layer, link forearm → upper arm → body, and Alt+drag each part's orange pivot dot (Move tool) onto its joint.
- Rotating / moving a part with the Move tool carries all its children; keyframes and motion tweens animate the whole limb. Bones are drawn over the canvas in the Move tool. Parent links are saved in the file. Layer → How to rig a character… explains the steps.

## 2.1: puppet warp
- Move group → **Puppet warp**: click a drawing to place pins on its joints, drag a pin to bend the drawing smoothly around the others (Alt+click removes a pin). The original drawing is kept, so bending again never loses quality.
- Animate it: pose one keyframe, make the next keyframe (K), move its pins, then **Create in-betweens** (tool panel or Animation menu) fills every frame between them. Pins are saved in the file; "Remove pins" restores the original drawing.

## 2.1: every tool checked, brush textures fixed
- An automated sweep now tries every tool in the palette (107 tools: pens, pencils, brushes, erasers, blend, liquify, airbrush, decoration, fill, gradients, eyedropper, selections, auto select, move, puppet, figures, rulers, frames, balloons, text, navigation): each must do its job, undo cleanly and raise no error.
- Fixed: the Text tool's box did not get keyboard focus (typing went nowhere until you tapped it); Ctrl+Enter now places the text.
- Fixed: brush textures washed out to solid colour (Chalk, Oil paint, Impasto, Dry ink, canvas / bristle papers). Textures are now applied to the whole stroke, so the grain stays visible however much you go over it; textured erasers erase in patches.
- New: Tool Property › Paper › Load image… turns any image into a paper texture. Imported Clip Studio brushes (.sut) keep their texture image, density, scale and invert settings.
- Tests: `bash tools/e2e/run_all.sh` runs the whole browser test suite.

## 1.1: built-in Clip Studio pen set
The Pen group now ships with the 11 pens from the user's own Clip Studio "pen" folder (G-pen, Real G-Pen, Mapping pen, Turnip pen, Calligraphy, Textured pen, Milli pen, Felt pen, Rough pen, Flat marker, Dot pen), imported from their .sut files with settings approximated. Check each brush's licence before sharing the app with others.

## 1.0: 3D model panel
Layer -> Add 3D model: posable male / female mannequin (joint sliders, drag a body part to rotate it, preset poses), cube / sphere / cylinder, import .glb / .gltf / .obj, light direction, toon shading, show over canvas as reference, "Place on new layer". Uses a bundled copy of three.js (three3d.js, MIT licence).

## 0.9: visual polish
Calmer colour scheme, uppercase panel headers, rounded menus and dialogs, accent bars on selected rows, softer canvas background.

## 0.8: Sub Tool footer
Buttons under the Sub Tool list: + import (.sut or image), duplicate, delete (imported/duplicated only). You can also drag a .sut file onto the panel.

## 0.7: pen pressure & touch (Apple Pencil / tablets)
Edit-> View menu "Pen pressure & touch...": sensitivity curve, min/max pressure, palm rejection (fingers pan/zoom once a pen is used), two-finger tap = undo, live test pad.
iPad: host the folder (Netlify / GitHub Pages), open in Safari, Share -> Add to Home Screen.

## 0.6: Clip Studio .sut import
Add-ons -> Import Clip Studio brush (.sut). Reads size, opacity, density, hardness, anti-aliasing, stabilisation, pressure on size/density, start taper and embedded tip images. Texture, spray, dual brush, out-taper and colour-mixing settings are not applied.

## 0.5: movable panels + add-ons
- Drag any panel title to float it anywhere, drop it on either side to dock it; double-click a title to collapse. Window menu: show/hide panels, reset layout. Layout is remembered.
- Add-ons menu: import an image as a brush tip (PNG with transparency, or dark-on-white), install a `.js` add-on script (API: `Sketchforge.addBrush`, `Sketchforge.addCommand`, ...).
- Clip Studio's own brush/material files (.sut, .lmtl etc.) are proprietary and cannot be loaded.
