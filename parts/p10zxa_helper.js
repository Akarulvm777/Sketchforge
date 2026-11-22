/* ---------- ✨ Ask: the free built-in helper ----------
   No account, no internet, no cost: it searches the app itself — every menu command, every tool, every tutorial step
   and a list of common questions — and answers with buttons that take you there (run the command, pick the tool,
   open the tutorial at the right step). English and French words are understood. It never draws for anyone:
   asked why, it says "AI is not supposed to steal your job." */
const HELP_TIPS = [
  { q: 'reset default settings factory restore remove imported tools start again clean', t: 'Reset Sketchforge to defaults', x: 'Edit › Reset Sketchforge to defaults… (also in Help) puts every setting back and removes every imported tool, custom brush, theme and colour set. Your drawings and your account stay. [[cmd:resetDefaults|Reset to defaults…]]' },
  { q: 'manga page comic setup panels layout new manga page frames yonkoma webtoon print b5 a4 guides', t: 'New manga page', x: 'File › 📖 New manga page… (also in the Manga menu): choose the page (phone, B5 / A4 print, square, webtoon), a panel layout (1–6 panels, classic manga, 4-panel strip), the space between panels and the border width. You get print guides and the layers Colour, Tone, Ink, Text & balloons and Panels, ready to draw. [[cmd:newManga|New manga page…]]' },
  { q: 'tutorial every tool each tool learn tools how does this tool work try it guide', t: 'Tutorials for every tool', x: 'Help › 📚 Tutorials › Every tool: one tutorial per tool group with a step for each tool (also the ones you import), and a Try it button that uses the tool on a practice page. [[cmd:tutorials|Open the tutorials]]' },
  { q: 'lip sync lipsync mouth talk speak voice dialogue sound mouth shapes export video sound mp4 audio', t: 'Lip-sync and video with sound', x: 'Import the voice (Animation › Import audio…), draw a closed, a half-open and an open mouth in the 🔁 Swap bar, then Animation › 👄 Lip-sync from sound: the mouths are placed on the timeline from the loudness. Export MP4 / WebM with "Include the sound" ticked to keep the voice in the video.', a: [['cmd', 'lipSync', 'Lip-sync from sound'], ['cmd', 'audioImport', 'Import audio…']] },
  { q: 'vector layer vector line edit line thickness bend line vector eraser intersection inking clean lines editable', t: 'Vector layers (editable lines)', x: 'Layer › New vector layer: every pen line stays editable. Vector group › Vector edit: click a line, drag to bend it, change its thickness, smooth or delete it. Vector eraser: erases a line up to where it crosses other lines (or the whole line). Colour on a normal layer under it.', a: [['cmd', 'newVectorLayer', 'New vector layer'], ['tool', 'vecedit', 'Vector edit'], ['tool', 'vecerase', 'Vector eraser']] },
  { q: 'perspective vanishing point 2 point 3 point two point three point horizon background building room street ruler grid', t: 'Perspective (1, 2 or 3 points)', x: 'Ruler group › Perspective ruler: choose 1, 2 or 3 points in Tool Property, then click to place the vanishing points (drag them to move). Strokes follow the direction you start in: towards a point, or straight up.', a: [['tool', 'rl_persp', 'Perspective ruler']] },
  { q: 'fill leak gap close gaps colouring flat flats auto flat colour areas bucket fill outside lines', t: 'Smart colouring (close gaps, auto-flat)', x: 'Fill tool › Close gaps: the fill stops at small gaps in your lines. 🎨 Auto-flat colours puts one flat colour in every closed area, on a "Flats" layer under your lines (from the reference layers, or the active layer). Then fill over them with your real colours.', a: [['tool', 'fill', 'Fill tool'], ['cmd', 'autoFlat', 'Auto-flat colours']] },
  { q: 'tool lag slow imported tool freeze tune tuner optimize smooth sut performance faster', t: 'Imported tool is slow?', x: 'Sketchforge studies every imported tool (and again after each update) and makes slow ones lighter for the engine without changing how they look — ⓘ under Sub Tool shows "⚡ Tuned…". Add-ons › ⚡ Tune imported tools runs it again. Colour-mixing tools paint on a fast copy in memory.', a: [['cmd', 'tuneTools', 'Tune imported tools']] },
  { q: '3d model canvas drag pose model on drawing disappear small window place model', t: '3D model on your drawing', x: 'Drag the model from the 3D panel onto your drawing (or tap the tile) and pose it right on the canvas. It stays while you draw; ✋ Pose 3D model poses it again, ✕ hides it.', a: [['cmd', 'show3d', '3D model']] },
  { q: 'start screen home page start page recent files continue drawing projects launcher hub welcome page', t: 'Start screen', x: 'File › 🏠 Start screen: start a new illustration, manga, animation or webtoon, continue a recent file (with pictures), see what is new, tutorials and videos, tips and the newest community shares. The installed apps show it when they start; tick "Show when Sketchforge starts" to choose.', a: [['cmd', 'startHub', 'Start screen']] },
  { q: 'pages panel manga comic pages add page new page book page list webtoon chapter', t: 'Pages of a manga / comic', x: 'In a manga / comic file the 📖 Pages panel (right of the canvas) lists every page: ＋ New page (keeps the panel borders), click to open, ◀ ▶ move, ⧉ duplicate, ✕ delete. It opens by itself with manga files; Window › Pages panel turns it off.', a: [['cmd', 'newManga', 'New manga page…'], ['cmd', 'pagesPanel', 'Pages panel on / off']] },
  { q: 'auto save autosave automatic save every 5 minutes lost work backup save file keep saving', t: 'Auto-save', x: 'Every 5 minutes, when you are not drawing, your file saves itself. Save once with File › Save (Ctrl+S): in Chrome / Edge / the desktop app it asks where, then that same file stays up to date. File › ⏱ Auto-save turns it on / off; Auto-save settings… changes the minutes.', a: [['cmd', 'save', 'Save'], ['cmd', 'autoSaveMin', 'Auto-save settings…']] },
  { q: 'hair cloth bones chain bend flow spine skirt cape ribbon tail physics wave wind long hair strand bone chain', t: 'Hair & cloth bones (bend and flow)', x: 'Bone group › Hair & cloth: put the hair / cape on its own layer linked to the body, click points from where it is attached to its tip. When the body moves, the drawing bends along the bones, lags, swings and settles. Settings like Spine physics: inertia, strength, damping, mass, gravity, wind, mix. Pose them too (Pose bones, or Bone: pose): each pose is a key and the physics stays on top. Try the practice model first.', a: [['tool', 'bonechain', 'Hair & cloth bones'], ['cmd', 'chainPractice', 'Practice model'], ['tut', 'gravity', 'Tutorial']] },
  { q: 'gravity physics hair cloth tail swing bounce secondary motion spine flow wind main part root bone rig easy', t: 'Gravity bones (hair, cloth) and the main part', x: 'Rig a character with the Bone tool, then: select the body and use Animation › 🦴 Make main part — every free part follows it, so moving the body moves everyone. Select the hair (or cloth, tail, ears) and use Animation › 🌬 Gravity bone…: it swings by itself when the part it hangs from moves, then settles (soft ↔ stiff, bounce, gravity). Its joint is its pivot. [[cmd:mainPart|Make main part]] [[cmd:physBone|Gravity bone…]]' },
  { q: 'two colour colors brush outline glow neon main sub colour border edge marker halo', t: 'Two-colour brushes (outline, glow)', x: 'Pen group › Outline marker paints the main colour inside and the sub colour (the second colour square) as an outline; Neon glow pen adds a soft sub-colour glow around the main colour. Any round brush can do it: Tool Property › Two colours (also in the brush editor ⚙). [[tool:outlinemarker|Outline marker]] [[tool:neonpen|Neon glow pen]]' },
  { q: '3d model pose rotate ring gizmo joint arm hand finger turn axis side view front back camera shadow floor grid', t: 'Pose the 3D model', x: 'Open the 3D model (toolbar 🧍 3D model) and press ✋ Pose on canvas. Point at a body part: it lights up blue. Click it: it turns red and coloured rings appear — drag the red, green or blue ring to turn the part around that axis, or drag the part itself to move it. Every finger works too. The bar above the head has Front / Side / Back views, zoom and reset; the floor grid and shadow can be switched in Look. [[cmd:show3d|Open the 3D model]]' },
  { q: 'voice talk speak read aloud microphone listen say', t: 'Talk with ✨ Ask', x: 'In ✨ Ask, tap 🔊 and the answers are read aloud; tap 🎤 and ask with your voice (where your browser supports it — Chrome, Edge, Safari). Free, built into your browser. [[cmd:askAI|Open ✨ Ask]]' },
  { q: 'clipping clip layer below mask paint only inside shading colour inside lines lock transparency', t: 'Clipping layer (paint only inside the layer below)', x: 'In the Layer panel, the button next to ＋ (New layer) clips the active layer to the layer below: it only shows where the layer below has paint, so you can shade and colour without going outside the lines (Ctrl+Alt+G). The next button adds a layer mask. [[cmd:clipLayer|Clip to layer below]] [[cmd:maskAdd|Add layer mask]]' },
  { q: 'face slider live2d blink eye close mouth open smile brow expression lip talk face animation squash', t: 'Face sliders (Live2D-style blink, mouth, smile)', x: 'Animation › 🙂 Face sliders. Draw a face (eyes open, mouth closed as a line), tap ＋ Eye / ＋ Mouth / ＋ Smile / ＋ Brow and drag a box around each part. Move the sliders: that frame becomes a face key. Move them on another frame and the frames between are made smoothly. 👁 Blink here makes a blink in one tap. Works on the skin layer too. [[cmd:faceSliders|Open Face sliders]]' },
  { q: 'swap drawing replace hand open closed eyes open closed blink change drawing replacement animation mouth', t: 'Swap drawings (open ↔ closed hand, eyes)', x: 'Animation workspace: the 🔁 Swap bar above the timeline. Draw one version (e.g. hand open) and tap ＋, draw another version on another frame and tap ＋ again. Then on any frame tap a drawing to swap it in (its position, bones and tweens stay). Alt+] / Alt+[ = next / previous. Edited a drawing? ⟳ Update everywhere. [[cmd:swapAdd|Add this drawing]]' },
  { q: 'blend mode blending layer linear burn subtract add glow dodge vivid light linear light pin light hard mix darker lighter color divide brightness multiply screen overlay', t: 'Layer blending modes', x: 'Layer Property › Blend: 28 modes in the usual order — Normal, Darken, Multiply, Color burn, Linear burn, Subtract, Lighten, Screen, Color dodge, Glow dodge, Add, Add (Glow), Overlay, Soft light, Hard light, Difference, Vivid light, Linear light, Pin light, Hard mix, Exclusion, Darker / Lighter color, Divide, Hue, Saturation, Color, Brightness. They show the same on screen, in exports, when merging and in Photoshop files.' },
  { q: 'ipad apple pencil pressure not working no pressure safari iphone thickness pencil', t: 'Apple Pencil pressure on iPad', x: 'Open Sketchforge in Safari (or from the Home Screen icon), not inside another app. Pressure comes from the Pencil automatically. Test it in View › Pen pressure & touch: the pad says "raw pressure" (and "Apple Pencil force" when it comes from the Pencil sensor). If strokes stop or get stuck, turn off Settings › Apple Pencil › Scribble.', a: [['cmd', 'penSettings', 'Pen settings']] },
  { q: 'imported clip studio tool not same different match tune adjust fix brush looks wrong compare clip studio tool editor', t: 'Make an imported Clip Studio tool match', x: 'Pick the tool, ⓘ under Sub Tool shows what is ≈ close or ✗ missing. Then ⚙ Adjust in the brush editor: draw the same stroke in Clip Studio and here, and tune the settings (pressure curves, spacing, texture…) with the live preview. Save keeps it. Tutorial: Help › Tutorials › Clip Studio tools & your own brushes.', a: [['tut', 'brushes', 'Tutorial'], ['cmd', 'brushEdit', 'Edit this brush…']] },
  { q: 'favourite favorite colour color save colours set palette swatch history recent colours keep my colors name', t: 'Favourite colours and colour history', x: 'Color panel: pick a colour set (Basic, or ⋯ › New colour set… with any name), ＋ adds the main colour, tap to use, right-click or long-press to remove. History below shows the colours you painted with. Sets can be exported / imported (.sfcolors, GIMP .gpl).' },
  { q: 'paper texture new file canvas grain watercolour paper kraft sketchbook background paper colour', t: 'Paper texture', x: 'File › New: choose the paper colour and a Texture (drawing paper, watercolour, rough, canvas…). With "Brushes pick up the paper grain" pencils and pens show the grain. Change it later with Layer › Paper colour & texture….', a: [['cmd', 'paperTexture', 'Paper colour & texture…']] },
  { q: 'advanced setup tool settings quality smooth stroke pressure curve thin start end preset quick setup reset tool best fast spacing', t: 'Advanced tool setup & stroke quality', x: 'Tool Property › ▸ Advanced setup: quick setups (crisp ink, soft sketch, painterly, airy), the pressure curve, thin start / end, fade, colour change per dab, blending mode, ↺ Reset this tool, and Stroke quality: Fast (slow devices) / Normal / Best (smoothest strokes).' },
  { q: 'create make own brush custom brush settings edit brush every setting tip picture pressure curve spray texture brush editor sfbrush', t: 'Make or change a brush', x: 'Sub Tool ⚙ (or Tool Property › All brush settings…): every setting of a brush — tip pictures (or the drawing on the layer), pressure curves, thin start / end, spray, colour change, colour mixing, texture, blending mode — with a live preview. Built-in tools are changed as a copy. Export / open .sfbrush files to share brushes.', a: [['cmd', 'brushNew', 'Create a new brush…'], ['tut', 'brushes', 'Tutorial']] },
  { q: 'clip studio tool imported looks different not same translate translation report setting why brush colour mixing pressure curve', t: 'How an imported Clip Studio tool was translated', x: 'Pick the imported tool, then ⓘ at the bottom of the Sub Tool panel: every setting of the .sut and what Sketchforge did with it (✓ same, ≈ close, ✗ not in Sketchforge yet). Tools imported before 2.10 need to be imported again to get the new translation.' },
  { q: 'layer folder group organise tick select several layers many checkbox colour label color layer folder', t: 'Folders, tick boxes and colours', x: 'Tick the box on several layers, then 📁 Folder in the bar above the list. Right-click a layer for a colour label (or your own colour). Drag layers onto a folder to move them in; ▸ opens / closes it, its eye hides all of it.', a: [['cmd', 'layerFolder', 'New folder'], ['cmd', 'layerTag', 'Colour label…']] },
  { q: 'bone tool rig link parent joint click part follow skeleton easy rig', t: 'Bone tool (easy rig)', x: '🦴 Bone tool (after the Shading pens): click a part, then the part it follows. The joint goes where they touch; drag a dot to move it. Sub tool Bone: pose turns parts around their joints.', a: [['cmd', 'boneTool', 'Bone tool'], ['cmd', 'tut_fox', 'Practice with the fox']] },
  { q: 'rig rigging bones character cut out animate parts joints tutorial fox practice video learn', t: 'Learn to rig (fox practice)', x: 'Help › Tutorials › 🦊 Rig the fox: a practice character with every part on its own layer, step by step with "Show me" buttons. There is also a 1-minute video.', a: [['cmd', 'tut_fox', 'Start the fox tutorial'], ['cmd', 'foxVideo', 'Watch the video']] },
  { q: 'pose 3d model canvas click body part move arm leg hand drag pose directly', t: 'Pose the 3D model on the canvas', x: '3D panel › ✋ Pose on canvas, then drag any body part of the big model: Move pulls it (the arm or leg follows), Rotate turns the joint. Done goes back to drawing.', a: [['cmd', 'show3d', 'Open the 3D model']] },
  { q: 'vrm vroid own character model load my avatar import vrm', t: 'Your own VRoid character', x: '3D panel › Load VRM… (or My VRM…): pose your own VRoid Studio character with the same poses, hands and drag tools.', a: [['cmd', 'show3d', 'Open the 3D model']] },
  { q: 'pen lag slow light pressure gentle stroke starts late delay windows ink press and hold tablet laggy', t: 'Light strokes feel slow (Windows)', x: 'Windows waits on a gentle pen touch to see if you want a right-click. Control Panel › Pen and Touch › Press and hold › Settings… › untick "Enable press and hold for right-clicking". More tips in View › Pen pressure & touch.', a: [['cmd', 'penSettings', 'Pen settings']] },
  { q: 'import image picture photo png jpg jpeg webp gif bmp tiff svg add picture insert photo reference', t: 'Import a picture', x: 'File › Import image… (Ctrl+Shift+O) puts a picture on a new layer (PNG, JPEG, WebP, GIF, BMP, TIFF, SVG, ICO…). You can also drop it on the canvas or paste it (Ctrl+V). File › Open… opens a picture as a new page.', a: [['cmd', 'importImage', 'Import image…'], ['cmd', 'pasteImage', 'Paste picture']] },
  { q: 'import gif frames sequence pictures animation frames png sequence', t: 'Pictures as animation frames', x: 'File › Import pictures as animation frames…: choose several pictures (or one animated GIF) and each becomes a frame on one layer.', a: [['cmd', 'importFrames', 'Import frames…']] },
  { q: 'import sound music audio mp3 wav voice song', t: 'Import sound', x: 'File › Import sound / music… (MP3, WAV, M4A, OGG, FLAC…). It plays with your animation and shows under the timeline.', a: [['cmd', 'audioImport', 'Import sound…']] },
  { q: 'effect effects glow shadow outline border bloom emboss vignette glitch halftone oil paint twirl wave pinch sepia grayscale black white filter', t: 'Effects', x: 'Filter menu: glow, drop shadow, outline, bloom, emboss, line art from a photo, halftone, oil paint, vignette, chromatic aberration, glitch, twirl, pinch, wave, grayscale, sepia… You see the result live while you move the sliders.', a: [['cmd', 'fxGlow', 'Glow…'], ['cmd', 'fxOutline', 'Outline…'], ['cmd', 'fxShadow', 'Drop shadow…']] },
  { q: 'trace photo line art extract lines from picture', t: 'Lines from a photo', x: 'Import the photo, then Filter › Extract line art: you get dark lines on a clear layer to trace or colour.', a: [['cmd', 'fxLineArt', 'Extract line art…']] },
  { q: 'eyedropper pick colour color hold press long copy colour from drawing', t: 'Pick a colour by holding', x: 'Touch and hold (or click and hold) on the drawing for half a second: a circle shows the colour and it becomes your colour. Move to pick another one, lift to keep it. Turn it off in View › Hold to pick colour.', a: [['cmd', 'holdPick', 'Hold to pick on / off']] },
  { q: 'perfect circle straight line shape snap quickshape draw circle square triangle round correct shape', t: 'Perfect shapes (hold to snap)', x: 'Draw a circle, line, square or triangle and keep the pen down for half a second at the end: it becomes a perfect shape with the same brush. Lift to keep it, undo to get your stroke back. View › Hold to snap shapes turns it off.', a: [['cmd', 'holdShape', 'Hold to snap on / off']] },
  { q: 'pen pressure not working tablet wacom xp-pen huion thickness pressure', t: 'Pen pressure', x: 'Turn on Windows Ink in your tablet driver, then View › Pen pressure & touch: test pad, Soft / Normal / Firm, Calibrate my pen.', a: [['cmd', 'penSettings', 'Pen settings'], ['tut', 'pen', 'Pen tutorial']] },
  { q: 'save file where saved keep work sketchforge file', t: 'Saving your work', x: 'File › Save (Ctrl+S) saves a .sketchforge file with all layers and frames. Your last work also reopens by itself next time.', a: [['cmd', 'save', 'Save now']] },
  { q: 'export gif video mp4 png movie share animation', t: 'Export an animation', x: 'File › Export animation (Ctrl+E): GIF, video, PNG frames or a sprite sheet, with a transparent background if you like.', a: [['cmd', 'exportAnim', 'Export…']] },
  { q: 'animation one layer frame by frame next drawing new frame animate', t: 'Animate on one layer', x: 'In the Animation workspace press ＋ New drawing (Shift+→): next frame with a clean page; onion skin shows the previous drawing.', a: [['cmd', 'newDrawing', '＋ New drawing'], ['tut', 'animation', 'Make an animation']] },
  { q: 'onion skin see previous drawing ghost', t: 'Onion skin', x: 'Shows the previous drawing in red and the next one in green (key O). The ▾ next to it changes colours and how many.', a: [['cmd', 'onion', 'Onion skin on / off']] },
  { q: 'undo mistake back cancel', t: 'Undo / redo', x: 'Ctrl+Z undoes, Ctrl+Y redoes. On a touch screen: tap with two fingers to undo.', a: [['cmd', 'undo', 'Undo']] },
  { q: 'ipad iphone install home screen safari', t: 'iPad & iPhone', x: 'Open the Sketchforge website in Safari → Share → Add to Home Screen. It then opens full screen and works offline.', a: [['tut', 'apps', 'Install the app']] },
  { q: 'install windows mac android download app exe apk', t: 'Install the app', x: 'Windows .exe, Mac .dmg, Android .apk and Linux AppImage are on the Sketchforge website. They update themselves.', a: [['tut', 'apps', 'Install the app']] },
  { q: 'update new version latest', t: 'Updates', x: 'Sketchforge updates itself and shows a small card when a new version is ready. Help › Check for updates checks now.', a: [['cmd', 'checkUpdate', 'Check for updates']] },
  { q: 'colour inside lines clip clipping fill colours under lines', t: 'Colour under your lines', x: 'Make a new layer under the lines for colour, or use Layer › Clip to layer below to paint only where the layer below has paint.', a: [['tut', 'layers', 'Layers & selections']] },
  { q: 'mirror symmetry both sides', t: 'Symmetry', x: 'The Symmetry button mirrors what you draw (Shift+M); ▾ for 4-way, radial or kaleidoscope.', a: [['cmd', 'symToggle', 'Symmetry on / off']] },
  { q: '3d model pose body reference hand fingers', t: '3D model', x: 'The 3D model button opens a posable man / woman: drag a part to move it, bend fingers, change the body shape, then Place on new layer.', a: [['cmd', 'show3d', 'Open the 3D model']] },
  { q: 'theme colours interface dark light customise look icons font', t: 'Change how Sketchforge looks', x: '🎨 Custom P: themes, colours of every part, icons, fonts, layout, canvas and effects.', a: [['cmd', 'cpOpen', 'Open Custom P'], ['tut', 'custom', 'Custom P tutorial']] },
  { q: 'brush import sut clip studio brushes add brush gradient decoration tool zip folder download tools', t: 'Add Clip Studio tools', x: 'Add-ons › Import Clip Studio tools (several .sut, a .zip or a folder), or drop them on the Sub tool panel. Pens, pencils, brushes, airbrushes, decoration brushes, erasers, blend tools and gradients each go to their own group by themselves.', a: [['cmd', 'addSut', 'Import tools…'], ['cmd', 'addSutFolder', 'Import a folder…']] },
  { q: 'psd photoshop clip studio open file layers', t: 'Photoshop & Clip Studio files', x: 'File › Open reads .psd with layers and .clip as one picture; File › Save as Photoshop PSD keeps your layers.', a: [['cmd', 'open', 'Open…']] },
  { q: 'rig bones arm move parts cut out puppet', t: 'Rig a character', x: 'Put each body part on its own layer, link them with Layer › Bone rig: set parent…, then move / rotate with the Move tool and tween.', a: [['tut', 'rig', 'Rig tutorial'], ['tut', 'puppet', 'Puppet pins']] },
  { q: 'tween move object automatically in between', t: 'Motion tween', x: 'Two keyframes with the drawing in different places (Move tool), then Tween: the frames between are made for you.', a: [['tut', 'tween', 'Tween tutorial']] },
  { q: 'time lapse record video of drawing process', t: 'Time-lapse', x: 'REC Time-lapse records how you draw; ▾ → Export video.', a: [['cmd', 'tlToggle', 'Recording on / off']] },
  { q: 'cloud account sign in login google github sync settings', t: 'Account (optional)', x: 'Sign in with Google or GitHub to keep drawings in the cloud and your settings on all your devices.', a: [['cmd', 'account', 'Sign in']] },
  { q: 'manga tone screentone screen tone dots halftone shadow shading hatching trame ombre', t: 'Manga tones & shading', x: 'The Manga tone tool paints dot / line / cross-hatch / sand tones (pattern aligned on the page). Shading pens: shadow pen, hatching, cross-hatching, stipple. Manga › Screen tone… fills a selection.', a: [['tool', 'tone30', 'Dot tone 30%'], ['tool', 'hatchbrush', 'Hatching brush']] },
  { q: 'shortcuts keys keyboard', t: 'Shortcuts', x: 'Help › Shortcuts & help (F1) lists every key.', a: [['cmd', 'help', 'Shortcuts']] },
  { q: 'tutorial learn how start beginner new', t: 'Tutorials', x: 'Help › Tutorials has guided tours that point at the real buttons, from the first drawing to animation and rigging.', a: [['cmd', 'tutorials', 'All tutorials'], ['tut', 'welcome', 'Welcome tour']] }
];
// French (and a few other) words -> the English words used in the app
const HELP_SYN = {
  gomme: 'eraser', effacer: 'eraser', rubber: 'eraser', crayon: 'pencil', pinceau: 'brush', brosse: 'brush', stylo: 'pen', plume: 'pen', calque: 'layer', calques: 'layer',
  couleur: 'colour', couleurs: 'colour', color: 'colour', colors: 'colour', remplir: 'fill', remplissage: 'fill', seau: 'fill', bucket: 'fill', pot: 'fill', degrade: 'gradient',
  selection: 'select', selectionner: 'select', deplacer: 'move', bouger: 'move', texte: 'text', bulle: 'balloon', case: 'frame', cases: 'frame', regle: 'ruler',
  annuler: 'undo', refaire: 'redo', enregistrer: 'save', sauvegarder: 'save', sauver: 'save', ouvrir: 'open', exporter: 'export', imprimer: 'export', nouveau: 'new', nouvelle: 'new',
  animer: 'animation', anime: 'animation', animation: 'animation', image: 'frame', images: 'frame', dessin: 'drawing', dessins: 'drawing', oignon: 'onion', pelure: 'onion',
  lecture: 'play', jouer: 'play', vitesse: 'fps', boucle: 'loop', symetrie: 'symmetry', miroir: 'mirror', pression: 'pressure', tablette: 'tablet', zoomer: 'zoom',
  tourner: 'rotate', rotation: 'rotate', retourner: 'flip', theme: 'theme', icone: 'icons', police: 'font', aide: 'help', raccourci: 'shortcuts', raccourcis: 'shortcuts',
  os: 'bones', squelette: 'rig', marionnette: 'puppet', modele: 'model', corps: 'body', main: 'hand', doigt: 'fingers', doigts: 'fingers', telecharger: 'download',
  installer: 'install', mise: 'update', compte: 'account', connexion: 'sign', nuage: 'cloud', flou: 'blur', filtre: 'filter', masque: 'mask', aquarelle: 'watercolour',
  eyedropper: 'pick', pipette: 'pick', picker: 'pick', paint: 'brush', painting: 'brush', erase: 'eraser', delete: 'delete', supprimer: 'delete', wipe: 'clear', vider: 'clear'
};
const HELP_STOP = new Set('a an the to of in on for and or is are do does how can i my me you it this that what where which with use using get want need le la les un une des de du et ou est je mon ma mes comment faire pour avec dans sur ce cette quoi ou est-ce que qui il elle on y'.split(' '));
const hnorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/<[^>]+>/g, ' ');
const hstem = w => w.length > 4 ? w.replace(/(ings?|ed|es|s)$/, '') : w;
function htokens(s) {
  return hnorm(s).split(/[^a-z0-9+]+/).filter(w => w && !HELP_STOP.has(w)).map(w => hstem(HELP_SYN[w] || w));
}
let HELP_INDEX = null;
function helpIndex() {
  if (HELP_INDEX) return HELP_INDEX;
  const idx = [], strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const add = (e) => { e.tt = htokens(e.title); e.pt = htokens(e.path || ''); e.xt = htokens(e.text || '') ; idx.push(e); };
  for (const tip of HELP_TIPS) add({ kind: 'tip', title: tip.t, path: tip.q, text: tip.x, acts: tip.a, boost: 1.5 });
  if (typeof HELP_LESSONS !== 'undefined') for (const L of HELP_LESSONS) add({ kind: 'lesson', title: L.t, path: L.q + ' ' + L.cat, text: L.steps.join(' '), id: L.id, boost: 1.4 }); // painting / animation lessons (p10zxc)
  for (const [menu, items] of MENUS) for (const it of items) if (Array.isArray(it) && it[1] && CMD[it[1]] && !/^tut_|^tour/.test(it[1]))
    add({ kind: 'cmd', title: it[0].replace(/[…✨☁📚👋]/g, '').trim(), path: `${menu} › ${it[0]}`, text: it[2] ? 'Shortcut: ' + it[2] : '', id: it[1] });
  for (const g of GROUPS) for (const id of g.subs || []) { const d = TOOLDEF[id]; if (d) add({ kind: 'tool', title: d.name, path: `${g.name} tool`, text: `${g.name}${g.key ? ' (key ' + g.key + ')' : ''}`, id }); }
  for (const t of TUTORIALS) {
    const steps = typeof t.steps === 'function' ? t.steps() : t.steps;
    add({ kind: 'tut', title: t.title, path: 'Tutorial', text: t.desc, id: t.id, step: 0, boost: 1.2 });
    steps.forEach((s, k) => s.t && add({ kind: 'tut', title: strip(s.t), path: t.title, text: strip(s.x), id: t.id, step: k }));
  }
  return (HELP_INDEX = idx);
}
function helpSearch(q) {
  const qt = [...new Set(htokens(q))]; if (!qt.length) return [];
  const hit = (list, w) => list.some(x => x === w || (w.length > 3 && (x.startsWith(w) || w.startsWith(x)) && Math.min(x.length, w.length) > 3));
  const scored = helpIndex().map(e => {
    let s = 0, found = 0;
    for (const w of qt) { const v = (hit(e.tt, w) ? 3 : 0) + (hit(e.pt, w) ? 1.5 : 0) + (hit(e.xt, w) ? 1 : 0); if (v) found++; s += v; }
    s *= (e.boost || 1) * (found / qt.length) ** 1.5; // answers that match more of the question win
    return [s, e];
  }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
  const out = [], seen = new Set();
  for (const [s, e] of scored) { const k = e.kind === 'tip' ? 'tip:' + e.title : e.kind === 'tut' ? 'tut:' + e.id : e.kind + ':' + e.id;
    if (e.kind === 'tip' && (e.acts || []).some(a => seen.has(a[0] + ':' + a[1]))) continue;
    if (e.kind === 'tip') for (const a of e.acts || []) seen.add(a[0] + ':' + a[1]); if (seen.has(k) || (out.length && s < scored[0][0] * 0.35)) continue; seen.add(k); if (e.kind === 'cmd' || e.kind === 'tut') seen.add(e.kind + ':' + e.id); out.push(e); if (out.length >= 4) break; }
  return out;
}
const DRAW_ASK = /\b(draw|paint|sketch|colou?r|ink|finish|create|generate|make)\b.{0,30}\b(for me|me an?|it for me)\b|\b(can|could|will) you (draw|paint|sketch|make (me )?(a|an|my) (drawing|picture|art|character))|\bdessine|\bfais[- ]moi (un|une) (dessin|image)|\bpeux[- ]tu dessiner/;
const WHY_NOT = /\bwhy\b.{0,40}\b(not|n't|wont|won't|refuse)\b.{0,30}\b(draw|paint|art|help)|\bpourquoi\b.{0,40}\b(pas|refuse)\b.{0,30}\b(dessin|dessiner|aide)/;
function helpAnswer(q) {
  const n = hnorm(q);
  if (WHY_NOT.test(n)) return 'AI is not supposed to steal your job. Your art is yours to make — I can show you every tool that helps. [[tut:welcome|Welcome tour]]';
  if (DRAW_ASK.test(n)) return "I don't draw for you — the art is yours! But I can show you the tools: ask me things like \"where is the eraser?\" or \"how do I animate?\". [[tut:first|Your first drawing]]";
  const talk = chatReply(q, n); if (talk) return talk; // conversation first (greetings, "I need help", yes / no / more…)
  if (typeof lessonList === 'function' && /^\s*(learn|lessons?|teach me|tips|techniques?|tutorial list|apprendre|lecons?)\s*[?!.]*\s*$/.test(n)) return lessonList();
  const res = helpSearch(q);
  if (res.length && res[0].kind === 'lesson') { // a technique question: the whole lesson, then the closest app answers
    const L = HELP_LESSONS.find(x => x.id === res[0].id), more = res.slice(1, 3).filter(e => e.kind !== 'lesson');
    return lessonAnswer(L) + (more.length ? '\n\n' + more.map(e => helpLine(e)).join('\n\n') : '');
  }
  if (!res.length) { AI.ctx = { pending: 'topic' }; return aiPick(["Hmm, I'm not sure I understood. Can you tell me a bit more?", "I didn't quite get that — could you say it another way?"]) + ' Is it about one of these?\n' + TOPIC_CHIPS; }
  AI.ctx = { results: res, shown: Math.min(res.length, 3), offer: firstAction(res[0]), asked: 'helped' };
  return aiPick(['Here is what I found:', 'Sure! Look at this:', 'This should help:']) + '\n\n' + res.slice(0, 3).map(helpLine).join('\n\n') + '\n\nDid that help? [[say:Yes]] [[say:No]]' + (res.length > 3 ? ' [[say:Show me more]]' : '');
}
/* ---- conversation: ✨ Ask talks back like a chat (offline, rules + memory of the last answer in AI.ctx) ---- */
const aiPick = a => a[Math.floor(Math.random() * a.length)];
const TOPIC_CHIPS = '[[say:Drawing and painting]] [[say:Animation]] [[say:Learn a technique]] [[say:Find a tool]] [[say:Something is not working]]';
function firstAction(e) { if (!e) return null; if (e.kind === 'cmd') return ['cmd', e.id]; if (e.kind === 'tool') return ['tool', e.id]; if (e.kind === 'tut') return ['tut', e.id + '.' + (e.step || 0)]; if (e.kind === 'lesson') return ['lesson', e.id]; const a = (e.acts || [])[0]; return a ? [a[0], a[1]] : null; }
function chatReply(q, n) {
  const ctx = AI.ctx || {}, only = re => re.test(n) && n.split(/\s+/).length <= 6;
  // short answers to what was just asked
  if (only(/^(yes|yeah|yep|yup|sure|ok|okay|oui|ouais|d'accord|please|go|do it)\b/)) {
    if (ctx.asked === 'helped') { AI.ctx = {}; return aiPick(['Great! 😊', 'Awesome, glad it helped!', 'Nice!']) + ' Anything else I can help you with?'; }
    if (ctx.offer) { const [k, id] = ctx.offer; AI.ctx = {}; setTimeout(() => aiDo(k, id), 300); return 'Okay, opening it for you…'; }
    return 'Okay! What would you like to do?\n' + TOPIC_CHIPS;
  }
  if (only(/^(no|nope|nah|non|not really|it didn ?t)\b/)) {
    if (ctx.asked === 'helped' && ctx.results && ctx.results.length > ctx.shown) return moreResults(ctx);
    AI.ctx = { pending: 'topic' };
    return aiPick(["No problem. Tell me more about what you're trying to do and I'll look again.", "Sorry about that! Can you describe it with other words?"]) + '\n' + TOPIC_CHIPS + ' [[cmd:tutorials|All tutorials]]';
  }
  if (only(/^(more|show me more|other|another|others|next|autre|plus)\b/) && ctx.results) return moreResults(ctx);
  // small talk
  if (/^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening)|bonjour|salut|coucou|yo)\b/.test(n) && n.split(/\s+/).length <= 4) {
    AI.ctx = { pending: 'topic' };
    return aiPick(['Hi there! 👋', 'Hello! 😊', 'Hey! Nice to see you.']) + ' I\'m the Sketchforge helper. What would you like to do today?\n' + TOPIC_CHIPS;
  }
  if (/\b(how are you|how r u|how's it going|ca va|ça va|comment vas)/.test(n)) return "I'm doing great, thanks for asking! 😊 Ready to help. What are you working on?\n" + TOPIC_CHIPS;
  if (/\b(who are you|what are you|your name|qui es tu|t ?es qui)\b/.test(n)) return "I'm the Sketchforge helper ✨. I know every tool and menu in the app, I can walk you through tutorials and teach painting and animation techniques. I won't draw for you — the art is yours! What can I do for you?\n" + TOPIC_CHIPS;
  if (/\b(thanks?|thank you|thx|merci)\b/.test(n)) { AI.ctx = {}; return aiPick(["You're welcome! 😊", 'Anytime!', 'Happy to help!']) + ' Anything else?'; }
  if (only(/^(bye|goodbye|see you|see ya|au revoir|ciao)\b/)) { AI.ctx = {}; return 'Bye! Have fun drawing 🎨 I\'m here whenever you need me.'; }
  if (/^\s*(help|help me|i need help|need help|can you help( me)?|aide|aide moi|j ?ai besoin d ?aide|please help)\s*[?!.]*\s*$/.test(n)) {
    AI.ctx = { pending: 'topic' };
    return "Of course, I'm here to help! What kind of help do you need?\n" + TOPIC_CHIPS;
  }
  // answers to "what kind of help?"
  if (/^(drawing( and painting)?|painting|draw|dessin)$/.test(n.trim())) { AI.ctx = { pending: 'drawing' }; return 'Nice! What about drawing?\n[[say:Choose a brush]] [[say:Layers]] [[say:Colours]] [[say:Selection]] [[say:Pen pressure]] [[say:Paper texture]]'; }
  if (/^(animation|animate|animer)$/.test(n.trim())) { AI.ctx = { pending: 'anim' }; return 'Cool, animation! What do you want to do?\n[[say:Frame by frame]] [[say:Onion skin]] [[say:Tween]] [[say:Bone rig]] [[say:Swap drawings]] [[say:Face sliders]] [[say:Export gif]]'; }
  if (/^(learn( a technique)?|teach me|technique)$/.test(n.trim())) return lessonList();
  if (/^(find a tool|a tool|tool|outil)$/.test(n.trim())) { AI.ctx = { pending: 'tool' }; return 'Sure — which tool are you looking for? Type its name or what it does, e.g. "eraser", "fill", "blur", "ruler".'; }
  if (/^(something is not working|a problem|problem|bug|not working|probleme|problème)$/.test(n.trim())) { AI.ctx = { pending: 'problem' }; return "Oh no, let's fix it. What's happening?\n[[say:It is slow or laggy]] [[say:Pen pressure not working]] [[say:My drawing disappeared]] [[say:Imported tool looks wrong]] [[say:Cannot save or open]]"; }
  if (/^it is slow or laggy$/.test(n.trim())) return "Sorry it's slow! A few things help a lot:\n• Use a smaller page (File › New: e.g. 1500 × 2000 instead of print size).\n• Fewer layers on big pages.\n• Turn the time-lapse off if you don't need it (REC button).\n• Update to the newest version (installed apps update by themselves).\nDid that help? [[say:Yes]] [[say:No]]";
  if (/^my drawing disappeared$/.test(n.trim())) return "That can happen when the browser runs out of picture memory on very big pages (mostly iPad). Version 2.13.6 fixed the main cause. Your work is saved automatically: reopening Sketchforge brings back your last files. Also try Edit › Undo. To be safe, save often with File › Save. [[cmd:save|Save now]]\nDid that help? [[say:Yes]] [[say:No]]";
  return null;
}
function moreResults(ctx) {
  const next = ctx.results.slice(ctx.shown, ctx.shown + 3);
  if (!next.length) { AI.ctx = { pending: 'topic' }; return "That's everything I found. Try telling me with other words, or pick a topic:\n" + TOPIC_CHIPS; }
  ctx.shown += next.length; ctx.offer = firstAction(next[0]); ctx.asked = 'helped'; AI.ctx = ctx;
  return 'Here are some other ideas:\n\n' + next.map(helpLine).join('\n\n') + '\n\nDid that help? [[say:Yes]] [[say:No]]' + (ctx.results.length > ctx.shown ? ' [[say:Show me more]]' : '');
}
function helpLine(e) {
  if (e.kind === 'lesson') return `**📚 ${e.title}** — lesson\n[[lesson:${e.id}|Read the lesson]]`;
  {
    const btn = e.kind === 'cmd' ? `[[cmd:${e.id}|Do it]]` : e.kind === 'tool' ? `[[tool:${e.id}|Use it]]` : e.kind === 'tut' ? `[[tut:${e.id}.${e.step || 0}|Show me]]` : (e.acts || []).map(([k, id, l]) => `[[${k}:${id}|${l}]]`).join(' ');
    const where = e.kind === 'cmd' ? e.path : e.kind === 'tool' ? `Tool palette › ${e.text}` : e.kind === 'tut' ? (e.step ? `Tutorial "${e.path}"` : 'Tutorial') : '';
    const text = e.kind === 'cmd' ? e.text : e.kind === 'tool' ? '' : e.text;
    return `**${e.title}**${where ? ' — ' + where : ''}${text ? '\n' + (text.length > 220 ? text.slice(0, 217) + '…' : text) : ''}\n${btn}`;
  }
}

/* ---- the panel ---- */
const AI = { msgs: [] };
function aiOpen() {
  let p = $('#aiPanel');
  if (!p) {
    p = document.createElement('div'); p.id = 'aiPanel';
    p.innerHTML = `<div class="ai-head"><b>✨ Sketchforge helper</b><span class="muted small">Free, works offline. Finds tools, answers questions about the app and teaches painting and animation — it won't draw for you.</span><button type="button" class="ai-learn" title="Painting and animation lessons">📚 Learn</button><button type="button" class="ai-x" title="Close">✕</button></div>
      <div class="ai-log"></div><form class="ai-form"><textarea rows="2" placeholder="Ask anything… e.g. where is the eraser? how do I animate?"></textarea><button type="button" class="ai-mic" title="Ask with your voice">🎤</button><button type="button" class="ai-speak" title="Read the answers aloud">🔊</button><button class="primary">Ask</button></form>`;
    document.body.appendChild(p);
    p.querySelector('.ai-x').onclick = () => { p.hidden = true; };
    p.querySelector('.ai-learn').onclick = () => { AI.msgs.push({ role: 'assistant', content: lessonList() }); aiRender(); };
    const ta = p.querySelector('textarea');
    ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); p.querySelector('form').requestSubmit(); } });
    p.querySelector('form').onsubmit = e => { e.preventDefault(); const q = ta.value.trim(); if (q) { ta.value = ''; aiAsk(q); } };
    aiVoiceSetup(p, ta);
    aiRender();
  }
  p.hidden = false; p.querySelector('textarea').focus();
}
function aiFormat(text) {
  const h = esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  return h.replace(/\[\[say:([^\]|]{1,60})\]\]/g, (m, t) => `<button type="button" class="ai-say">${t}</button>`)
    .replace(/\[\[(cmd|tut|tool|learn|lesson):([\w.-]+)\|([^\]]{1,60})\]\]/g, (m, k, id, label) => `<button type="button" class="ai-act" data-k="${k}" data-id="${id}">${label}</button>`);
}
function aiRender() {
  const log = $('#aiPanel .ai-log'); if (!log) return;
  log.innerHTML = AI.msgs.length ? AI.msgs.map(m => `<div class="ai-msg ${m.role}">${aiFormat(m.content)}</div>`).join('')
    : `<div class="ai-msg assistant">${aiFormat('Hi! Ask me where a tool is, what a setting does, or how to do something. For example:')}<div class="ai-ex">${['How do I animate?', 'Where is the eraser?', 'How do I shade skin?', 'Perspective', 'Mouth shapes for talking', 'Export a GIF'].map(x => `<button type="button" class="ai-q">${x}</button>`).join('')}</div></div>`;
  log.querySelectorAll('.ai-q').forEach(b => b.onclick = () => aiAsk(b.textContent));
  log.querySelectorAll('.ai-say').forEach(b => b.onclick = () => aiAsk(b.textContent));
  log.querySelectorAll('.ai-act').forEach(b => b.onclick = () => aiDo(b.dataset.k, b.dataset.id));
  aiScroll();
}
function aiDo(k, id) {
  {
    if (k === 'cmd' && CMD[id]) CMD[id]();
    else if (k === 'tool' && TOOLDEF[id]) { selectTool(id); toast(TOOLDEF[id].name + ' selected'); }
    else if (k === 'learn') { AI.msgs.push({ role: 'assistant', content: lessonList(id) }); aiRender(); }
    else if (k === 'lesson') { const L = HELP_LESSONS.find(x => x.id === id); if (L) { AI.msgs.push({ role: 'user', content: L.t }, { role: 'assistant', content: lessonAnswer(L) }); aiRender(); } }
    else if (k === 'tut') { const [tid, st] = id.split('.'); $('#aiPanel').hidden = true; tutStart(tid); if (+st > 0) { TUT.i = Math.min(+st, TUT.steps.length - 1); tutShow(); } }
  }
}
function aiScroll() {
  const log = $('#aiPanel .ai-log'); if (!log) return;
  const last = log.querySelector('.ai-msg.user:last-of-type');
  log.scrollTop = last ? last.offsetTop - 8 : log.scrollHeight; // show the start of the newest answer
}
function aiAsk(q) {
  const a = helpAnswer(q);
  AI.msgs.push({ role: 'user', content: q }, { role: 'assistant', content: a });
  if (AI.msgs.length > 40) AI.msgs.splice(0, AI.msgs.length - 40);
  aiRender();
  if (AI_VOICE.speak) aiSay(a);
}
/* ✨ Ask talks: 🔊 reads answers aloud (speechSynthesis), 🎤 asks by voice (SpeechRecognition where the browser has it).
   Both are built into the browser: free, nothing is sent to an AI service by Sketchforge. Choice kept in sketchforge.aivoice.v1. */
const AI_VOICE = (() => { try { return { speak: false, ...JSON.parse(localStorage.getItem('sketchforge.aivoice.v1') || '{}') }; } catch (e) { return { speak: false }; } })();
function aiPlain(t) { return String(t).replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1').replace(/\*\*/g, '').replace(/[•→›]/g, ', ').replace(/\s+/g, ' ').trim(); }
function aiSay(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(aiPlain(text).slice(0, 1200)); u.lang = 'en-US'; u.rate = 1; speechSynthesis.speak(u);
}
function aiVoiceSetup(p, ta) {
  const sp = p.querySelector('.ai-speak'), mic = p.querySelector('.ai-mic');
  const paint = () => { sp.classList.toggle('on', !!AI_VOICE.speak); sp.title = AI_VOICE.speak ? 'Reading answers aloud — tap to stop' : 'Read the answers aloud'; };
  if (!('speechSynthesis' in window)) sp.hidden = true;
  sp.onclick = () => { AI_VOICE.speak = !AI_VOICE.speak; try { localStorage.setItem('sketchforge.aivoice.v1', JSON.stringify(AI_VOICE)); } catch (e) { /* ignore */ }
    paint(); if (!AI_VOICE.speak) speechSynthesis.cancel(); else { const last = [...AI.msgs].reverse().find(m => m.role === 'assistant'); aiSay(last ? last.content : 'Hi! Ask me anything about Sketchforge.'); } };
  paint();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { mic.hidden = true; return; }
  let rec = null;
  mic.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1;
    mic.classList.add('on'); ta.placeholder = 'Listening… speak now';
    rec.onresult = e => { const r = e.results[e.results.length - 1]; ta.value = r[0].transcript; if (r.isFinal) { const q = ta.value.trim(); ta.value = ''; if (q) aiAsk(q); } };
    rec.onerror = e => { if (e.error === 'not-allowed') toast('Allow the microphone to ask with your voice'); };
    rec.onend = () => { rec = null; mic.classList.remove('on'); ta.placeholder = 'Ask anything… e.g. where is the eraser? how do I animate?'; };
    rec.start();
  };
}
