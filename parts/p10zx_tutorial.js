/* ---------- Tutorials: guided tours of the whole app ----------
   Help › Tutorials opens the tutorial centre. A tutorial is a list of steps; each step can spotlight a part of
   the interface (el: CSS selector, or a list — the first visible one is used), explain it (t, x), prepare the
   screen first (pre) and offer a "Show me" button (demo: [label, fn]). Finished tutorials get a ✓
   (localStorage 'sketchforge.tutorials.v1'). On first start a small corner card offers the welcome tour. */
const TUT_KEY = 'sketchforge.tutorials.v1';
const tutState = (() => { try { return JSON.parse(localStorage.getItem(TUT_KEY) || '{}'); } catch (e) { return {}; } })();
const tutSave = () => { try { localStorage.setItem(TUT_KEY, JSON.stringify(tutState)); } catch (e) { /* ignore */ } };
const narrow = () => innerWidth <= 900;
const menuEl = n => [`.menu[data-menu="${n}"] > .menu-btn`, '#btnMenu'];
const toolEl = g => `#toolbox .tool[data-group="${g}"]`;
function tutDock(side) { // make a side panel visible (on phones / tablets the panels are hidden sheets)
  if (!narrow()) return;
  const app = $('#app'); app.classList.add('docks');
  if (innerWidth <= 560) { app.classList.toggle('phone-left', side === 'left'); app.classList.toggle('phone-right', side === 'right'); }
}
function tutNoDock() { if (narrow()) $('#app').classList.remove('docks', 'phone-left', 'phone-right'); }
const tutGroup = g => () => { tutNoDock(); if (GROUPS.some(x => x.id === g)) selectGroup(g); };
const anim = () => { if (state.mode !== 'anim') setMode('anim'); };

/* ---- tutorial content ---- */
const TUTORIALS = [
  { id: 'welcome', cat: 'Get started', icon: '👋', title: 'Welcome tour', desc: 'What Sketchforge is and where everything is (2 minutes).', steps: [
    { t: 'Welcome to Sketchforge 👋', x: 'A drawing <b>and</b> animation studio: pens and brushes like a comic / illustration app, plus a timeline, tweens and rigging like an animation app. This tour shows where everything is. Use <b>Next</b> or the → key.' },
    { el: ['#menus', '#btnMenu'], t: 'Menus', x: 'Every command lives here: File, Edit, Select, Layer, Manga, Animation, View, Filter, Window, Add-ons, 🎨 Custom P and Help. On phones and tablets it is the <b>☰ Menu</b> button.' },
    { el: '#modeSwitch', t: 'Drawing / Animation', x: '<b>Drawing</b> is for illustrations and comics. <b>Animation</b> shows the timeline for frames, keyframes and tweens. Switch any time.' },
    { el: '#cmdbar', t: 'Quick buttons', x: 'New, open, save, undo / redo, selection, zoom, flip, export and help, plus <b>Symmetry</b>, <b>REC Time-lapse</b> and <b>3D model</b>.' },
    { el: '#tabbar', t: 'Documents', x: 'Every open file has a tab. <b>+</b> makes a new one, drag tabs to reorder, right-click for more (duplicate, move to a new window…).' },
    { el: '#toolbox', pre: tutNoDock, t: 'Tool palette', x: 'Pens, pencils, brushes, erasers, blend, liquify, airbrush, decorations, fill, gradient, eyedropper, selection, move, figures, rulers, frames, balloons, text and navigation. A small corner triangle means the tool has variations.' },
    { el: '#subtoolList', pre: () => tutDock('left'), t: 'Sub tools', x: 'The variations of the chosen tool — for the pen: G-pen, Real G-pen, Mapping pen… You can add your own brushes with <b>+</b> (Clip Studio .sut files or images).' },
    { el: '#propBody', pre: () => tutDock('left'), t: 'Tool property', x: 'Size, hardness, density, opacity, pressure, paper texture, stabiliser… for the selected sub tool.' },
    { el: '.colorbody', pre: () => tutDock('left'), t: 'Colour', x: 'Pick colours on the wheel, type a hex code, swap main / sub colour (X).' },
    { el: '#viewport', pre: tutNoDock, t: 'The canvas', x: 'Draw here. Two fingers or the wheel to zoom, Space+drag or the middle button to move, <b>[</b> and <b>]</b> to rotate the view.' },
    { el: '.navbox', pre: () => tutDock('right'), t: 'Navigator', x: 'A small view of the whole picture with zoom, rotation, fit and flip.' },
    { el: '#layerList', pre: () => tutDock('right'), t: 'Layers', x: 'Draw on separate layers, change their order, opacity and blend mode, hide or lock them.' },
    { el: ['#symBtn'], pre: tutNoDock, t: 'Symmetry', x: 'Mirror everything you draw — left/right, 4-way, radial or kaleidoscope.' },
    { el: '#tlBtn', t: 'Time-lapse', x: 'Records a video of how you draw, per file. Click to turn recording on / off, ▾ to export the video.' },
    { el: '#btn3d', t: '3D model', x: 'A posable 3D man / woman to draw from, with poses and light.' },
    { el: menuEl('🎨 Custom P'), t: '🎨 Custom P', x: 'Make the interface yours: themes, colours of every part, icons, fonts, layout and more.' },
    { el: menuEl('Help'), t: 'Help & tutorials', x: 'Shortcuts and all the tutorials are in the <b>Help</b> menu. Your work is saved automatically and reopened next time. Have fun! 🎨' }
  ] },
  { id: 'first', cat: 'Get started', icon: '✏️', title: 'Your first drawing', desc: 'New file, pen, colour, eraser, undo, layers, save.', steps: [
    { el: '#cmdbar [data-cmd="newDoc"]', t: 'A new file', x: 'This button (or File › New, Ctrl+N) opens the New dialog: illustration, comic, webtoon or animation sizes.' },
    { el: toolEl('pen'), pre: tutGroup('pen'), t: 'Take a pen', x: 'The <b>Pen</b> tool (key <b>P</b>). It is selected now.' },
    { el: '#propBody', pre: () => tutDock('left'), t: 'Size', x: 'Choose the size with the slider or the size buttons. With a pen tablet, pressing harder makes the line thicker.' },
    { el: '.colorbody', pre: () => tutDock('left'), t: 'Colour', x: 'Pick a colour on the wheel. The big square is the main colour, the small one the sub colour.' },
    { el: '#viewport', pre: tutNoDock, t: 'Draw!', x: 'Draw on the canvas now. Try a few lines.' },
    { el: toolEl('eraser'), pre: tutGroup('eraser'), t: 'Eraser', x: 'The <b>Eraser</b> (key <b>E</b>) removes paint — hard, soft, kneaded, rough…' },
    { el: ['#cmdbar [data-cmd="undo"]'], t: 'Undo / redo', x: 'Made a mistake? <b>Ctrl+Z</b> undoes, <b>Ctrl+Y</b> redoes. On a touch screen: tap with two fingers to undo.' },
    { el: '.lbtns', pre: () => tutDock('right'), t: 'Layers', x: '<b>+</b> adds a layer. Draw lines on one layer and colours on another, so you can change one without touching the other.' },
    { el: '#cmdbar [data-cmd="save"]', pre: tutNoDock, t: 'Save', x: 'Saves a <b>.sketchforge</b> file with all layers and frames (Ctrl+S). File › Export makes PNG, GIF, video or PSD.' }
  ] },
  { id: 'tools', cat: 'Tools & options', icon: '🧰', title: 'Every tool, one by one', desc: 'Each tool of the palette and its sub tools.', steps: () => {
    const info = {
      pen: 'Clean ink lines. Pressure changes the thickness. Calligraphy and textured pens too.',
      pencil: 'Sketching with a pencil grain: pencil, mechanical pencil, charcoal, crayon, pastel, chalk.',
      brush: 'Painting: soft brush, marker, watercolours (wet edges), inks, oil, gouache, impasto, acrylic.',
      eraser: 'Remove paint: hard, soft, kneaded, rough (patchy) and snap eraser.',
      blend: 'Mix and smudge colours already on the layer: blend, blur, finger tip.',
      liquify: 'Push, pull, twirl or pinch the picture like warm wax.',
      airbrush: 'Soft spray, splatter spray, droplets and noise.',
      decor: 'Stamp patterns along the stroke: sparkles, glitter, dappled light, petals, hearts, bubbles, feathers.',
      tone: 'Manga screen tones you paint with: dot tones 10–50 %, fine and big dots, line, horizontal line and cross-hatch tones, sand tone, and a tone eraser. The pattern stays aligned on the page like a real tone sheet.',
      shade: 'Pens for manga shadows: shadow pen (solid blacks), hatching and cross-hatching brushes, stipple pen.',
      fill: 'Fill an area: from all layers, only this layer, reference layers, enclose & fill, lasso fill.',
      gradient: 'Linear and radial gradients and ready-made skies (sunset, night, rainbow…), gradient eraser, manga gradient.',
      pick: 'Eyedropper: click to take a colour from the picture (Alt = sub colour).',
      select: 'Choose an area to work only inside it: rectangle, ellipse, lasso, polyline, selection pen, erase / shrink selection.',
      wand: 'Auto select: click a colour area to select it (all layers, this layer, or reference layers).',
      move: 'Move, rotate and scale a layer (and animate it with tweens). Puppet warp bends a drawing with pins.',
      shape: 'Straight lines, rectangles, ellipses, polylines, polygons and curves.',
      ruler: 'Rulers your strokes snap to: straight, perspective, symmetry, ellipse.',
      frame: 'Comic panel borders: draw a frame, then divide it with a gutter.',
      balloon: 'Speech balloons: ellipse, rounded, cloud, shout, thought — with a tail.',
      text: 'Click on the canvas and type. Font, size and colour are in Tool property.',
      hand: 'Navigate: move the view, rotate it, zoom.'
    };
    return [{ t: 'The tool palette', x: 'Let\'s visit every tool. Each step selects the tool so you can see its <b>sub tools</b> and <b>properties</b>.', el: '#toolbox', pre: tutNoDock }]
      .concat(GROUPS.filter(g => g.subs && g.subs.length).map(g => ({
        el: toolEl(g.id), pre: tutGroup(g.id), t: `${g.name}${g.key ? ' (key ' + g.key + ')' : ''}`,
        x: (info[g.id] || '') + `<div class="tut-subs">${g.subs.map(id => TOOLDEF[id] ? TOOLDEF[id].name : id).join(' · ')}</div>`
      })))
      .concat([{ t: 'Tool property', el: '#propBody', pre: () => { tutDock('left'); selectGroup('pen'); }, x: 'Every tool has its own settings here. Change them freely — <b>Sub tool › duplicate</b> keeps a copy of your favourite settings.' }]);
  } },
  { id: 'menus', cat: 'Tools & options', icon: '📋', title: 'All menus and options', desc: 'What you find in each menu.', steps: [
    { el: menuEl('File'), t: 'File', x: 'New, open (.sketchforge, Photoshop .psd, Clip Studio .clip), save, export PNG / GIF / video / PSD, time-lapse, close document, reopen last work.' },
    { el: menuEl('Edit'), t: 'Edit', x: 'Undo, redo, cut, copy, paste, fill / clear selection, colour swaps and colour corrections (brightness, hue, levels, posterize…).' },
    { el: menuEl('Select'), t: 'Select', x: 'Select all, deselect, invert, expand / shrink, blur the selection border.' },
    { el: menuEl('Layer'), t: 'Layer', x: 'New / duplicate / merge / delete layers, masks, clipping, lock transparency, reference & draft layers, 3D model, video and sound reference, bone rig.' },
    { el: menuEl('Manga'), t: 'Manga', x: 'Panel layouts, focus lines, speed lines, screen tones, rulers.' },
    { el: menuEl('Animation'), pre: anim, t: 'Animation', x: 'Play, keyframes, frames, tweens, onion skin, light table, copy / paste drawings, repeat frames, drawing library, audio and video, puppet in-betweens.' },
    { el: menuEl('View'), t: 'View', x: 'Zoom, rotate, flip, two-column palette, symmetry, pen pressure & touch settings.' },
    { el: menuEl('Filter'), t: 'Filter', x: 'Blur, sharpen, noise, tonal curve, colour balance, gradient map, radial blur and more.' },
    { el: menuEl('Window'), t: 'Window', x: 'Show / hide panels, reset the layout, switch documents, move a file to a new window, second view, drawing library.' },
    { el: menuEl('Add-ons'), t: 'Add-ons', x: 'Import Clip Studio brushes (.sut), image brush tips and add-on scripts.' },
    { el: menuEl('🎨 Custom P'), t: '🎨 Custom P', x: 'Themes, colours, icons, fonts, layout, canvas area, cursor and effects.' },
    { el: menuEl('Help'), t: 'Help', x: 'Shortcuts and these tutorials.' }
  ] },
  { id: 'layers', cat: 'Tools & options', icon: '🗂', title: 'Layers & selections', desc: 'Organise your drawing, work inside an area.', steps: [
    { el: '#layerList', pre: () => tutDock('right'), t: 'The layer list', x: 'The top layer is drawn over the others. Click a layer to draw on it. 👁 hides it, 🔒 locks it.' },
    { el: '.lbtns', pre: () => tutDock('right'), t: 'Layer buttons', x: 'Add, duplicate, merge down, move up / down, clear, delete.' },
    { el: '.lprops', pre: () => tutDock('right'), t: 'Opacity & blend', x: 'Make a layer see-through, or blend it (multiply for shadows, screen / add for light…).' },
    { el: menuEl('Layer'), pre: tutNoDock, t: 'Clipping & masks', x: '<b>Clip to layer below</b> paints only where the layer below has paint (perfect for colouring inside lines). <b>Masks</b> hide parts without erasing.' },
    { el: toolEl('select'), pre: tutGroup('select'), t: 'Selections', x: 'Draw a selection: painting and filters then only affect the inside. Ctrl+D removes it, Ctrl+Shift+I inverts it. With a selection, the Move tool moves the selected pixels.' }
  ] },
  { id: 'pen', cat: 'Tools & options', icon: '🖊', title: 'Pen tablet & pressure', desc: 'Wacom, XP-Pen, Huion, Apple Pencil…', steps: [
    { t: 'Pressure', x: 'With a pen tablet or stylus, pressing harder makes lines thicker or darker (set per brush in Tool property: "Affects size / density").' },
    { el: menuEl('View'), t: 'Pen settings', x: 'View › <b>Pen pressure & touch</b>: test pad, Soft / Normal / Firm, <b>Calibrate my pen</b>, side button (eyedropper), palm rejection.', demo: ['Open pen settings', () => CMD.penSettings()] },
    { t: 'No pressure?', x: 'Turn on <b>Windows Ink</b> in your tablet driver (Wacom, XP-Pen, Huion, Gaomon…). The steps for each brand are in the pen settings under "No pressure?".' }
  ] },
  { id: 'brushes', cat: 'Tools & options', icon: '🖌', title: 'Clip Studio tools & your own brushes', desc: 'Import tools, see how they were translated, tune them to match, make new brushes.', steps: [
    { el: '#subtoolBar button[data-ic=plus]', pre: () => { tutDock('left'); if (!['pen', 'pencil', 'brush'].includes(state.group)) selectGroup('pen'); }, t: 'Import Clip Studio tools', x: '＋ adds Clip Studio tools: several <b>.sut</b> files, a <b>.zip</b> or a folder (or drop them on this panel). Each one goes to the right group by itself: pens, brushes, decoration, gradients…' },
    { el: '#subtoolBar button[data-ic=info]', pre: () => tutDock('left'), t: 'ⓘ How it was translated', x: 'Pick an imported tool, then ⓘ: every Clip Studio setting and what Sketchforge did with it — <b>✓ same</b>, <b>≈ close</b>, <b>✗ not in Sketchforge yet</b>. Tools imported before 2.10 need to be imported again.' },
    { el: '#subtoolBar button[data-ic=sliders]', pre: () => tutDock('left'), t: '⚙ Make it match', x: 'The brush editor opens any tool with <b>all its settings</b>. For an imported tool it lists what Clip Studio does differently: draw the same stroke in both apps and tune size, pressure curves, spacing, texture… until it matches. The preview updates as you move the sliders.', demo: ['Open the brush editor', () => openBrushEditor(state.tool)] },
    { t: 'Every setting', x: 'Tip pictures (or the drawing on your layer), angle, thickness, rotation · pressure, tilt and speed curves (drag the points) · thin start / end · spray · colour change and colour mixing · watercolour edge · texture · blending mode · eraser, smudge or blur.' },
    { t: 'Save and share', x: '<b>Save</b> keeps your changes, <b>Save as new</b> makes a copy. Built-in tools are changed as a copy "(mine)", so the originals stay. <b>Export .sfbrush</b> makes a file you can share; ＋ or a drop opens it.' },
    { el: '#propBody .beopen', pre: () => tutDock('left'), t: 'Also here', x: 'Tool Property › <b>⚙ All brush settings…</b> opens the same editor for the tool you are using.' },
    { el: '#csSel', pre: () => tutDock('left'), t: 'Your colours', x: 'Colour sets: keep favourite colours in as many named sets as you like (＋ adds the main colour, ⋯ for new / rename / export). <b>History</b> under them shows the colours you painted with.' },
    { el: menuEl('Layer'), pre: tutNoDock, t: 'Paper', x: 'File › New lets you pick a <b>paper texture</b> (drawing paper, watercolour, canvas…) and colour; brushes pick up its grain. Change it later: Layer › <b>Paper colour & texture…</b>', demo: ['Paper colour & texture…', () => CMD.paperTexture()] }
  ] },
  { id: 'features', cat: 'Features', icon: '⭐', title: 'Symmetry, time-lapse, 3D & more', desc: 'The big helpers, one after the other.', steps: [
    { el: '#symBtn', pre: tutNoDock, t: 'Symmetry', x: 'Click to mirror everything you draw. ▾ chooses mirror, 4-way, radial or kaleidoscope (Shift+M).', demo: ['Turn symmetry on', () => { if (!symOn()) CMD.symToggle(); }] },
    { el: '#tlBtn', t: 'Time-lapse', x: 'Records how you draw — each file has its own. Modes: <b>Workspace view</b> (zoom, rotation, tool, cursor), <b>Whole screen</b>, <b>Canvas only</b>. ▾ → Export video.' },
    { el: '#btn3d', t: '3D model', x: 'Posable man / woman: <b>drag a hand, foot or any part</b> and the body follows (or switch to Drag: Rotate joint), every finger bends, hand poses (fist, point, peace…), body shape (head, build, shoulders, hips, arm and leg length), zoom and size. Then <b>Place on new layer</b> to trace it.', demo: ['Open the 3D model', () => CMD.show3d()] },
    { el: '#tabbar', t: 'Many files', x: 'Open as many files as you like. Right-click a tab: <b>Move to new window</b>. Window › <b>Second view</b>: a live floating view with its own zoom / flip.' },
    { el: menuEl('File'), t: 'Photoshop & Clip Studio', x: 'File › Open reads <b>.psd</b> with layers and <b>.clip</b> (as one picture). File › Save as Photoshop PSD keeps your layers.' },
    { el: menuEl('Animation'), pre: anim, t: 'Video & sound reference', x: 'Animation › <b>Import video reference</b>: a video layer that plays with your timeline (not exported) or frames to trace over; its sound plays too.' },
    { t: 'Your work is remembered', x: 'Close the app any time: next start reopens your files on the same frame and zoom. (File › Reopen my last work: on / off.)' }
  ] },
  { id: 'animation', cat: 'Animation & rigging', icon: '🎞', title: 'Make an animation', desc: 'One layer, new drawing per frame, onion skin, play, export.', steps: [
    { el: '#timeline', pre: anim, t: 'Animation mode', x: 'The timeline appears at the bottom. Each <b>column is a frame</b>, each <b>row a layer</b>.' },
    { el: '#timeline', pre: anim, t: 'One layer is enough', x: 'You can draw a <b>whole animation on one layer</b>: every frame gets its own drawing. Use extra layers only for colours, backgrounds or effects.' },
    { el: '#viewport', pre: () => { anim(); tutNoDock(); }, t: '1. First drawing', x: 'On frame 1, draw your first pose.' },
    { el: '#anNewBtn', pre: anim, t: '2. Next drawing', x: 'Press <b>＋ New drawing</b> (Shift+→): it goes to the next frame, adds it if needed, and gives you a clean page. Draw the next pose.', demo: ['＋ New drawing', () => { anim(); newDrawing(); }] },
    { el: '#onionOn', pre: anim, t: '3. Onion skin', x: 'The previous drawing shows faintly in red (and the next one in green), so you can draw in the right place. Key <b>O</b> turns it on / off, ▾ changes colours and how many.' },
    { el: '#anExpose', pre: anim, t: '4. Timing', x: '<b>on 1s</b> = a new drawing every frame (smooth), <b>on 2s</b> = every 2 frames (classic cartoon timing, half the work).' },
    { el: '#btnPlay', pre: anim, t: '5. Play', x: '<b>Enter</b> plays and stops. Set the speed in <b>FPS</b> (12 = classic, 24 = smooth). <b>Loop</b> repeats, <b>Ping-pong</b> goes back and forth.' },
    { el: '#tlInner', pre: anim, t: '6. Fix the timing', x: '<b>Right-click</b> a frame for everything: hold longer / shorter, delete, copy, reverse, play range. <b>Drag</b> the selected drawing to move it (Alt = copy). <b>Double-click</b> an empty frame for a new drawing.' },
    { el: menuEl('Animation'), pre: anim, t: 'Handy tools', x: 'Copy / paste drawings, <b>Repeat frames</b> for cycles, <b>Light table</b>, audio for lip sync, video reference.' },
    { el: '#cmdbar [data-cmd="exportAnim"]', t: '7. Export', x: 'Export a <b>GIF</b>, a <b>video</b>, <b>PNG frames</b> or a <b>sprite sheet</b> (Ctrl+E), with a transparent background if you like.' }
  ] },
  { id: 'animtools', cat: 'Animation & rigging', icon: '🎛', title: 'Every animation tool', desc: 'Each button and setting of the timeline.', steps: [
    { el: '.tl-transport', pre: anim, t: 'Play buttons', x: 'First frame (Home), previous ( , or ←), <b>play / pause</b> (Enter), next ( . or →), last frame (End).' },
    { el: '#curFrame', pre: anim, t: 'Frame / total', x: 'The frame you are on and how many frames the animation has. Type a bigger total to make it longer.' },
    { el: '#fps', pre: anim, t: 'FPS', x: 'Frames per second: how fast it plays. 12 is classic hand-drawn, 24 film, 30 video.' },
    { el: '#loop', pre: anim, t: 'Loop & ping-pong', x: '<b>Loop</b> plays again from the start. <b>Ping-pong</b> plays forward then backward (great for breathing, waving, blinking).' },
    { el: '#anOnionBtn', pre: anim, t: 'Onion skin settings', x: 'Show the previous / next <b>drawings</b> or <b>frames</b>, this layer or all layers, how many before / after, their colours and strength.', demo: ['Open the settings', () => { anim(); anOnionPop($('#anOnionBtn')); }] },
    { el: '#anNewBtn', pre: anim, t: '＋ New drawing', x: 'Next frame with a clean page (Shift+→). With <b>on 2s</b> it jumps 2 frames, so each drawing lasts 2 frames.' },
    { el: '#anNewKey', pre: anim, t: 'Empty frame', x: 'What happens when you draw on a frame that has no drawing of its own: <b>new drawing</b> (frame by frame), <b>copy previous</b> (change a copy) or <b>edit previous</b> (change the drawing that is held).' },
    { el: '#timeline [data-cmd="keyframe"]', pre: anim, t: '+ Key / + Blank', x: '<b>+ Key</b> (K) makes a keyframe from a copy of the drawing; <b>+ Blank</b> (Shift+K) an empty one.' },
    { el: '#timeline [data-cmd="insertFrame"]', pre: anim, t: '+ Frame / − Frame', x: 'Insert or delete a frame in <b>all layers</b> at once (J / Shift+J): everything after moves.' },
    { el: '#timeline [data-cmd="removeKey"]', pre: anim, t: '− Key', x: 'Deletes the drawing on this frame; the previous drawing is then held longer.' },
    { el: '#timeline [data-cmd="tween"]', pre: anim, t: 'Tween / No tween', x: 'A <b>motion tween</b> moves, turns, scales or fades a drawing between two keyframes. Right-click a tweened frame for <b>ease in / ease out</b>.' },
    { el: '#tlInner', pre: anim, t: 'The frames', x: 'Dot = a drawing, bar = held, blue = tween. Click to go there, <b>drag the selected drawing</b> to move it (Alt = copy), <b>double-click</b> an empty frame, <b>right-click</b> for the menu.' },
    { el: '#tlInner .tl-ruler', pre: anim, t: 'Play range', x: 'Right-click a frame → <b>Play from here / Play until here</b> to loop only a part while you work on it. Frames outside are striped.' },
    { el: '.lbtns', pre: () => { anim(); tutDock('right'); }, t: 'Layers for colour', x: 'Add a layer for colours, a background or effects: each layer has its own row of drawings in the timeline.' },
    { el: '#cmdbar [data-cmd="exportAnim"]', pre: tutNoDock, t: 'Export', x: 'GIF, video (WebM / MP4), PNG frames, sprite sheet; all frames or only the play range; transparent background.' }
  ] },
  { id: 'tween', cat: 'Animation & rigging', icon: '🌀', title: 'Motion tweens', desc: 'Let the computer draw the in-between movement.', steps: [
    { pre: anim, t: 'What is a tween?', x: 'Draw something <b>once</b>, set where it is at two keyframes, and the frames between are calculated: moving, turning, growing, fading.' },
    { el: toolEl('move'), pre: () => { anim(); tutGroup('move')(); }, t: '1. Move tool', x: 'On frame 1, place your drawing with the Move tool (key <b>V</b>): drag to move, round handle to rotate, corners to scale.' },
    { el: '.tl-transport', pre: anim, t: '2. Second key', x: 'Go to a later frame, press <b>K</b>, and move / rotate / scale the drawing there.' },
    { el: '#timeline', pre: anim, t: '3. Tween', x: 'Go back to the first keyframe and press <b>Tween</b>. The frames in between turn blue: done! Alt+drag the orange dot to change the pivot.' }
  ] },
  { id: 'rig', cat: 'Animation & rigging', icon: '🦴', title: 'Rig a character (bones)', desc: 'Main part, what follows what, joints, hair & cloth bones, pose, animate.', steps: [
    { t: 'Bone rig', x: 'Draw each body part on <b>its own layer</b>: body, head, upper arm, forearm, hand, hair, cape… A rig links them like a skeleton: one <b>main part</b> holds everything, every other part <b>follows</b> one part. <a href="#" onclick="CMD.videoSpine();return false">▶ Watch the video</a>' },
    { el: toolEl('bone'), pre: tutGroup('bone'), t: '1. The main part', x: 'Take the <b>🦴 Bone</b> tool, pick the body and press <b>★ Make main part</b> (Tool Property): every free part follows it. Only one part is the main part; it has a ★ on the canvas.' },
    { el: toolEl('bone'), pre: tutGroup('bone'), t: '2. What follows what', x: '<b>Bone: link parts</b>: <b>click the forearm, then the upper arm</b> — the forearm follows. Same for hand → forearm, head → body… The joint goes where the parts touch.' },
    { el: ['#skelTree', '#propBody'], pre: () => { tutDock('left'); if (!['bone', 'bonepose', 'bonechain'].includes(state.tool)) selectTool('bone'); }, t: '3. The skeleton tree', x: 'Tool Property shows the <b>skeleton tree</b>: ★ main part on top, every part under the part it follows. Click a row to pick a part. A part on the top level without ★ is still free.' },
    { el: toolEl('bone'), pre: tutGroup('bone'), t: '4. Put the joints', x: 'With Bone: link parts, <b>drag a dot</b> onto its joint (shoulder, elbow, wrist): the picture does not move. Alt+click a part frees it.' },
    { el: toolEl('bone'), pre: tutGroup('bone'), t: '5. Hair & cloth bones', x: '<b>Bone: hair & cloth</b>: click points along long hair, a cape or a skirt, from where it is attached to its tip. The first bone is the main bone fixed to the part; the drawing bends along the bones and flows with physics (inertia, strength, damping, mass, gravity, wind, mix).', demo: ['Open the practice model', () => chainPractice()] },
    { el: toolEl('bone'), pre: () => { tutGroup('bone')(); selectTool('bonepose'); }, t: '6. Pose', x: '<b>Bone: pose</b>: drag a part to turn it around its joint, everything that follows it moves. Drag a hair / cloth bone point to pose those bones too — the physics stays on top.' },
    { el: '#timeline', pre: anim, t: '7. Animate', x: 'Pose on a keyframe, make another keyframe (K), change the pose, then <b>Tween</b>: the whole character animates, and hair and cloth follow by themselves. More: 🦴 Rig like Spine and 🦊 Rig the fox.' }
  ] },
  { id: 'puppet', cat: 'Animation & rigging', icon: '📌', title: 'Bend a drawing (puppet pins)', desc: 'Pins on a drawing, drag to animate it.', steps: [
    { el: toolEl('move'), pre: () => { tutNoDock(); selectTool('puppet'); }, t: 'Puppet warp', x: 'The <b>Puppet warp</b> sub tool of the Move group is selected now.' },
    { el: '#viewport', t: '1. Pins', x: 'Click on the drawing to put pins on the joints (shoulder, elbow, wrist). Alt+click removes a pin.' },
    { el: '#viewport', t: '2. Bend', x: 'Drag a pin: the drawing bends smoothly around the others. Pins you don\'t move hold their part in place.' },
    { el: '#propBody', pre: () => tutDock('left'), t: '3. In-betweens', x: 'Pose one keyframe, make the next one (K), move its pins, then <b>Create in-betweens</b>: every frame between is generated.' }
  ] },
  { id: 'reuse', cat: 'Animation & rigging', icon: '♻️', title: 'Reuse drawings', desc: 'Never redraw the same thing twice.', steps: [
    { el: menuEl('Animation'), t: 'Copy / paste a drawing', x: '<b>Alt+C</b> copies the drawing of this layer, <b>Alt+V</b> pastes it on another frame, layer or file as a new keyframe.' },
    { el: menuEl('Animation'), t: 'Repeat frames', x: 'Animation › <b>Repeat frames</b>: repeat frames 1–8 several times for walk and run cycles.' },
    { el: menuEl('Window'), t: 'Drawing library', x: 'Window › <b>Drawing library</b>: save a drawing once, click or drag it onto any frame of any file later. It stays between sessions.', demo: ['Open the library', () => CMD.library()] }
  ] },
  { id: 'custom', cat: 'Customise', icon: '🎨', title: 'Custom P: make it yours', desc: 'Themes, colours, icons, fonts, layout, effects.', steps: [
    { el: menuEl('🎨 Custom P'), pre: () => { const d = $('#cpDialog'); if (d && d.open) d.close(); }, t: '🎨 Custom P', x: 'This menu customises the whole interface. Let\'s open it.' },
    { el: '#cpDialog .cpTabs [data-tab="themes"]', pre: () => cpOpen('themes'), t: 'Themes', x: 'Colour themes, layout styles (compact, big for tablets, soft, classic), 🎲 Surprise me, save your own themes and share them as files.' },
    { el: '#cpDialog .cpTabs [data-tab="colors"]', pre: () => cpOpen('colors'), t: 'Colours', x: 'Base colours, then <b>every part</b> separately: menu bar, panels, buttons, timeline, dialogs… Text stays readable automatically. ↺ puts one back.' },
    { el: '#cpDialog .cpTabs [data-tab="icons"]', pre: () => cpOpen('icons'), t: 'Icons', x: 'Click any icon to replace it with any image. Change icon colour, size and line thickness.' },
    { el: '#cpDialog .cpTabs [data-tab="text"]', pre: () => cpOpen('text'), t: 'Text', x: 'Font (or your own font file), text size, bold, spacing.' },
    { el: '#cpDialog .cpTabs [data-tab="layout"]', pre: () => cpOpen('layout'), t: 'Layout', x: 'Interface size, roundness, spacing, panel widths, tool palette on the left or right, toolbar at the bottom, hide bars…' },
    { el: '#cpDialog .cpTabs [data-tab="canvas"]', pre: () => cpOpen('canvas'), t: 'Canvas area', x: 'Colour, gradient, checkerboard, dots, grid or your own picture around the drawing.' },
    { el: '#cpDialog .cpTabs [data-tab="effects"]', pre: () => cpOpen('effects'), t: 'Effects', x: 'Wallpaper behind the app, glass panels, shadows, animations, glow. Also try the <b>Cursor</b> tab.' },
    { el: '#cpReset', pre: () => cpOpen('effects'), t: 'Reset', x: '<b>Reset to default</b> brings everything back. Press Done when you are happy.' }
  ] },
  { id: 'apps', cat: 'Customise', icon: '📲', title: 'Install the app', desc: 'Windows, Mac, Android, iPad / iPhone.', steps: [
    { t: 'Sketchforge everywhere', x: '<b>Windows</b>: Sketchforge-Setup .exe. <b>Mac</b>: the .dmg (arm64 for Apple Silicon, x64 for Intel). <b>Android</b>: the .apk. All are on the project\'s Releases page.' },
    { t: 'iPad & iPhone', x: 'Open the web link in Safari → Share → <b>Add to Home Screen</b>. It then opens full screen like an app and works offline.' },
    { t: 'Your files', x: 'Save .sketchforge files to keep your work; open them on any device. Your last work also reopens automatically on the same device.' },
    { el: ['#acctBtn', '#aiBtn', '#btnMenu'], pre: tutNoDock, t: 'Account & cloud (optional)', x: 'When accounts are switched on, <b>Sign in</b> with Google or GitHub (top right) saves drawings in the cloud, keeps your settings on all your devices and shares brushes and themes. Everything else works without an account.' },
    { el: ['#aiBtn', '#aiFab', '#acctBtn', '#btnMenu'], t: '✨ Ask the helper', x: 'Ask where a tool is or how something works (✨ Ask, or Help › Ask the helper on phones). It is free, works offline, and answers with buttons that take you there. It never draws for you.' },
    { el: menuEl('Help'), t: 'Updates', x: 'Sketchforge updates itself: you get a small card when a new version is ready. <b>Help › Check for updates</b> checks right away.' }
  ] }
];

/* ---- the player ---- */
const TUT = { cur: null, i: 0, steps: [], queue: [] };
function tutStart(id, queue) {
  const t = TUTORIALS.find(x => x.id === id); if (!t) return;
  TUT.queue = queue || [];
  const c = $('#tutCenter'); if (c && c.open) c.close();
  const w = $('#tutWelcome'); if (w) w.remove();
  TUT.cur = t; TUT.i = 0; TUT.steps = typeof t.steps === 'function' ? t.steps() : t.steps;
  let o = $('#tutOverlay') || TUT.o;
  if (!o) {
    o = document.createElement('div'); o.id = 'tutOverlay';
    o.innerHTML = '<div class="tut-hole"></div><div class="tut-card" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(o);
    window.addEventListener('resize', () => { if (TUT.cur) tutShow(); });
    document.addEventListener('keydown', e => {
      if (!TUT.cur) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); tutGo(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); tutGo(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tutEnd(); }
    }, true);
  }
  o.hidden = false; TUT.o = o;
  tutShow();
}
function tutFind(el) {
  for (const s of [].concat(el || [])) {
    const e = document.querySelector(s);
    if (e) { const r = e.getBoundingClientRect(); if (r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden') return e; }
  }
  return null;
}
function tutShow() {
  const s = TUT.steps[TUT.i], o = $('#tutOverlay') || TUT.o, hole = o.querySelector('.tut-hole'), card = o.querySelector('.tut-card');
  try { if (s.pre) s.pre(); } catch (e) { console.warn('tutorial step', e); }
  tutHost();
  const place = () => {
    const el = tutFind(s.el), cpOpenNow = $('#cpDialog') && $('#cpDialog').open;
    tutHost();
    if (el) {
      const r = el.getBoundingClientRect(), pad = 6;
      Object.assign(hole.style, { display: 'block', left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    } else hole.style.display = 'none';
    const last = TUT.i === TUT.steps.length - 1;
    card.innerHTML = `<div class="tut-top"><span>${TUT.cur.icon} ${TUT.cur.title}</span><span>${TUT.i + 1} / ${TUT.steps.length}</span></div>
      <h4>${s.t || ''}</h4><div class="tut-text">${s.x || ''}</div>
      <div class="tut-bar">${s.demo ? `<button class="tut-demo">▶ ${s.demo[0]}</button>` : ''}<span style="flex:1"></span>
      <button class="tut-close" title="Close (Esc)">Close</button>${TUT.i ? '<button class="tut-back">← Back</button>' : ''}<button class="tut-next primary">${last ? 'Finish ✓' : 'Next →'}</button></div>
      <div class="tut-dots">${TUT.steps.map((_, k) => `<i class="${k === TUT.i ? 'on' : k < TUT.i ? 'done' : ''}"></i>`).join('')}</div>`;
    card.querySelector('.tut-next').onclick = () => tutGo(1);
    const b = card.querySelector('.tut-back'); if (b) b.onclick = () => tutGo(-1);
    card.querySelector('.tut-close').onclick = tutEnd;
    const d = card.querySelector('.tut-demo'); if (d) d.onclick = () => { try { s.demo[1](); } catch (e) { toast(e.message); } setTimeout(place, 250); };
    // place the card next to the spotlight (below, above, right, left), or centred
    const cw = Math.min(360, innerWidth - 24); card.style.width = cw + 'px';
    const ch = card.offsetHeight, M = 12;
    let x = (innerWidth - cw) / 2, y = (innerHeight - ch) / 2;
    if (el) {
      const r = hole.getBoundingClientRect();
      if (r.bottom + ch + M < innerHeight) { y = r.bottom + M; x = r.left + r.width / 2 - cw / 2; }
      else if (r.top - ch - M > 0) { y = r.top - ch - M; x = r.left + r.width / 2 - cw / 2; }
      else if (r.right + cw + M < innerWidth) { x = r.right + M; y = r.top + r.height / 2 - ch / 2; }
      else if (r.left - cw - M > 0) { x = r.left - cw - M; y = r.top + r.height / 2 - ch / 2; }
    }
    card.style.left = clamp(x, M, innerWidth - cw - M) + 'px'; card.style.top = clamp(y, M, innerHeight - ch - M) + 'px';
    card.querySelector('.tut-next').focus({ preventScroll: true });
  };
  requestAnimationFrame(() => requestAnimationFrame(place));
}
/* a modal dialog makes the rest of the page inert, so while Custom P is open the overlay lives inside it
   (cpRefreshDlg rebuilds the dialog and calls this again) */
function tutHost() {
  const o = $('#tutOverlay') || TUT.o; if (!o || !TUT.cur) return;
  TUT.o = o;
  const cp = $('#cpDialog'), host = cp && cp.open ? cp : document.body;
  if (o.parentNode !== host) host.appendChild(o);
  o.classList.toggle('over-dialog', host !== document.body);
}
function tutGo(d) {
  const n = TUT.i + d;
  if (n >= TUT.steps.length) { tutState[TUT.cur.id] = true; tutSave(); const t = TUT.cur, q = TUT.queue; tutEnd(); if (q.length) { const nx = TUTORIALS.find(x => x.id === q[0]); toast(`${t.icon} "${t.title}" finished ✓ — next: ${nx ? nx.title : ''}`, 3000); setTimeout(() => tutStart(q[0], q.slice(1)), 600); } else toast(`${t.icon} "${t.title}" finished ✓ — more in Help › Tutorials`, 4000); return; }
  if (n < 0) return;
  TUT.i = n; tutShow();
}
function tutEnd() {
  const o = $('#tutOverlay') || TUT.o; if (o) o.hidden = true;
  const cp = $('#cpDialog'); if (TUT.cur && TUT.cur.id === 'custom' && cp && cp.open) cp.close();
  if (o && o.parentNode !== document.body) document.body.appendChild(o);
  TUT.cur = null; tutNoDock();
}

/* ---- the tutorial centre ---- */
function tutCenter() {
  let d = $('#tutCenter');
  if (!d) { d = document.createElement('dialog'); d.id = 'tutCenter'; d.className = 'csdlg tutdlg'; document.body.appendChild(d); }
  const cats = [...new Set(TUTORIALS.map(t => t.cat))];
  const done = TUTORIALS.filter(t => tutState[t.id]).length;
  d.innerHTML = `<form method="dialog"><h5>📚 Tutorials</h5><p class="muted small" style="margin:0 0 8px">Guided tours that point at the real buttons. ${done} of ${TUTORIALS.length} done. Use → / ← keys, Esc to stop.</p>
    <div class="tut-list">${cats.map(c => `<div class="grp">${c}</div><div class="tut-grid">${TUTORIALS.filter(t => t.cat === c).map(t =>
      `<button type="button" class="tut-item ${tutState[t.id] ? 'done' : ''}" data-tut="${t.id}"><span class="tut-ic">${t.icon}</span><span><b>${t.title}</b><small>${t.desc}</small></span>${tutState[t.id] ? '<i>✓</i>' : ''}</button>`).join('')}</div>`).join('')}</div>
    <div class="dialog-actions"><button type="button" id="tutResetDone">Reset ✓ marks</button><span style="flex:1"></span><button type="button" id="tutCenterClose" class="primary">Close</button></div></form>`;
  d.querySelectorAll('[data-tut]').forEach(b => b.onclick = () => tutStart(b.dataset.tut));
  d.querySelector('#tutCenterClose').onclick = () => d.close();
  d.querySelector('#tutResetDone').onclick = () => { for (const k of Object.keys(tutState)) delete tutState[k]; tutState.seen = true; tutSave(); tutCenter(); };
  if (!d.open) d.showModal();
}
/* first start: a small, non-blocking card in the corner */
function tutWelcome() {
  if (tutState.seen || location.hash === '#sf-child') return;
  tutState.seen = true; tutSave();
  const w = document.createElement('div'); w.id = 'tutWelcome';
  w.innerHTML = `<b>👋 New to Sketchforge?</b><span>Take the 2-minute tour of the app.</span><div><button class="primary" data-a="go">Start the tour</button><button data-a="all">All tutorials</button><button data-a="no">Later</button></div>`;
  w.onclick = e => { const a = e.target.dataset && e.target.dataset.a; if (!a) return; w.remove(); if (a === 'go') tutStart('welcome'); else if (a === 'all') tutCenter(); };
  document.body.appendChild(w);
  setTimeout(() => { if (w.isConnected) w.classList.add('fade'); }, 25000);
  setTimeout(() => w.remove(), 26000);
}
/* first switch to Animation: "Is this your first time?" (until they tick "Don't ask again" or finish the tour) */
const ANI_KEY = 'sketchforge.animintro.v1';
function animIntro() {
  if (TUT.cur || location.hash === '#sf-child') return;
  let v; try { v = localStorage.getItem(ANI_KEY); } catch (e) { return; }
  if (v === 'never' || v === 'done' || $('#animIntro')) return;
  const d = document.createElement('dialog'); d.id = 'animIntro'; d.className = 'csdlg tutdlg';
  d.innerHTML = `<form method="dialog"><h5>🎞 Welcome to the Animation workspace</h5>
    <p style="margin:6px 0 10px;line-height:1.5">Is this your first time making an animation in Sketchforge?<br><span class="muted small">A short guided tour shows how to draw an animation on one layer, then every timeline tool and setting.</span></p>
    <label class="check" style="margin:0 0 10px"><input type="checkbox" id="aiNever"> Don't ask me again</label>
    <div class="dialog-actions"><button type="button" id="aiNo">No, I know how</button><span style="flex:1"></span><button type="button" id="aiYes" class="primary">Yes, show me</button></div></form>`;
  document.body.appendChild(d);
  const close = () => { d.close(); d.remove(); };
  d.querySelector('#aiYes').onclick = () => { try { localStorage.setItem(ANI_KEY, 'done'); } catch (e) { /* ignore */ } close(); tutStart('animation', ['animtools', 'tween', 'rig']); };
  d.querySelector('#aiNo').onclick = () => { if (d.querySelector('#aiNever').checked) try { localStorage.setItem(ANI_KEY, 'never'); } catch (e) { /* ignore */ } close(); };
  d.addEventListener('cancel', () => d.remove());
  d.showModal();
}
function installTutorials() {
  Object.assign(CMD, { tutorials: tutCenter, tourWelcome: () => tutStart('welcome') });
  for (const t of TUTORIALS) CMD['tut_' + t.id] = () => tutStart(t.id);
  const H = MENUS.find(m => m[0] === 'Help')[1];
  H.unshift(['📚 Tutorials…', 'tutorials'], ['👋 Welcome tour', 'tourWelcome'], '-',
    ...TUTORIALS.filter(t => t.id !== 'welcome').map(t => [t.icon + ' ' + t.title, 'tut_' + t.id]), '-');
  setTimeout(() => welcomeGate.then(tutWelcome), 1500); // after the mascot's welcome
}
