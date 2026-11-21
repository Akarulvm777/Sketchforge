/* ---------- Tutorials for the newer parts of the app ----------
   Manga page setup, two-colour brushes, advanced tool setup, main part + gravity bones, face sliders and posing
   the 3D model. Added to TUTORIALS by installMoreTutorials (each next to the tutorials of its category). */
const MORE_TUTORIALS = [
  { id: 'mangapage', cat: 'Features', icon: '📖', title: 'Make a manga page', desc: 'Page size, panels, print guides and the manga layers in one step.', steps: [
    { el: menuEl('File'), t: 'New manga page', x: 'File › <b>📖 New manga page…</b> (also at the top of the Manga menu) makes a ready-to-draw page.', demo: ['Open it', () => newMangaPage()] },
    { t: 'Page and panels', x: 'Pick the <b>page</b> (phone / web, manga B5 or A4 print at 350 dpi, square, webtoon strip) and the <b>panels</b> (1–6 panels, classic manga, 4-panel strip). Set the space between panels and the border width.' },
    { el: '#layerList', pre: () => tutDock('right'), t: 'Your layers', x: '<b>Ink</b> for lines (selected for you), <b>Tone</b> for screen tones, <b>Colour</b> under the lines, <b>Text & balloons</b> for speech, <b>Panels</b> for the borders. <b>Guides</b> (trim / safe area) is a draft layer: never printed or exported.' },
    { el: toolEl('tone'), pre: tutNoDock, t: 'Tones and shading', x: 'The <b>Manga tone</b> tool paints dot / line tones that stick to the page; <b>Shading pens</b> draw hatching. The Manga menu also has panels, balloons and speed lines.' }
  ] },
  { id: 'twotone', cat: 'Tools & options', icon: '🌈', title: 'Two-colour brushes', desc: 'Outline marker, neon glow, and two colours on any round brush.', steps: [
    { el: toolEl('pen'), pre: tutGroup('pen'), t: 'Two new pens', x: 'In the Pen group: <b>Outline marker</b> (main colour inside, sub colour outline) and <b>Neon glow pen</b> (main colour with a soft sub-colour glow).', demo: ['Pick the Outline marker', () => selectTool('outlinemarker')] },
    { el: ['#subSw', '#btnMenu'], t: 'The sub colour', x: 'The outline / glow uses the <b>second colour square</b>. Press <b>X</b> to swap the two colours.' },
    { el: '#propBody', pre: () => { tutDock('left'); }, t: 'Any round brush', x: 'Tool Property › <b>Two colours</b>: “Main inside, sub colour outside” or “Main colour + sub colour glow”, and the outline width / glow size. Overlapping strokes make one clean outline, not rings.' }
  ] },
  { id: 'tooladv', cat: 'Tools & options', icon: '🎛', title: 'Advanced tool setup', desc: 'Quick setups, pressure curve, start / end, colour change, stroke quality.', steps: [
    { el: '#propBody .advhead', pre: () => { tutDock('left'); if (kindOf(state.tool) !== 'brush') selectTool('pen'); }, t: 'Advanced setup', x: 'Under Tool Property, <b>▸ Advanced setup</b> opens more settings for the tool you are using (built-in or imported).', demo: ['Open it', () => { advOpen(true); refreshProps(); }] },
    { t: 'Quick setups', x: 'One click gives the tool a ready feel: <b>✒ Crisp ink</b> (thin start and end, steady line), <b>✏ Soft sketch</b>, <b>🖌 Painterly</b>, <b>☁ Airy</b>. Then change anything you like.' },
    { t: 'Pressure curve', x: 'Drag the points of the curve: a <b>lower</b> curve means you press harder for a thick line, a <b>higher</b> one gives thick lines with a light touch. Minimum size / opacity = how thin / light at the lightest touch.' },
    { t: 'Start, end and colour', x: '<b>Thin start / end</b> (in pixels) and <b>fade</b> make tapered lines. <b>Colour change per dab</b> (hue, saturation, brightness) gives natural, painterly strokes. <b>Blending</b> = the tool\'s own mode (multiply, add…).' },
    { t: 'Stroke quality', x: '<b>Best</b>: smoother, denser strokes. <b>Fast</b>: fewer dabs for slow tablets and phones. <b>↺ Reset this tool</b> brings back its first settings.' }
  ] },
  { id: 'gravity', cat: 'Animation & rigging', icon: '🌬', title: 'Main part, gravity & hair bones', desc: 'One part holds the character; hair and cloth swing, bend and flow by themselves.', steps: [
    { el: menuEl('Animation'), pre: anim, t: 'Make main part', x: 'Select the body layer, then Animation › <b>🦴 Make main part</b>: every free part follows it, so moving or turning it moves the whole character.', demo: ['Make the active layer the main part', () => makeMainPart()] },
    { t: 'Joints', x: 'Each part turns around its <b>pivot</b> (its joint). Use the <b>Bone</b> tool to link a part to the one it hangs from and place the joint where they touch.' },
    { el: menuEl('Animation'), pre: anim, t: 'Gravity bone', x: 'Select hair, a cape, a tail or ears, then Animation › <b>🌬 Gravity bone…</b>: tick “Swing with gravity” and set soft ↔ stiff, bounce and gravity.', demo: ['Open Gravity bone', () => physDialog()] },
    { el: toolEl('bone'), pre: tutGroup('bone'), t: 'Hair & cloth bones', x: 'For long hair, a cape, a skirt or a ribbon that should <b>bend</b> and flow (like Spine): Bone group › <b>Hair & cloth</b>. Click points from where it is attached (orange dot) to its tip. Each pair of points is a bone; the drawing bends along them. Settings like Spine: inertia, strength, damping, mass, gravity, wind, mix (or a ready setting: long hair, cape, skirt…).', demo: ['Pick the tool', () => selectTool('bonechain')] },
    { t: 'Practice model', x: 'Animation › <b>🧝 Hair & cloth practice model</b>: a character whose long hair and cape already have bones. It plays at once: watch them flow, then change the settings.', demo: ['Open the practice model', () => chainPractice()] },
    { el: '#btnPlay', pre: anim, t: 'Play', x: 'Animate the body with keyframes (move / turn it). Press <b>Enter</b>: the gravity parts lag behind, swing and settle by themselves. Your keyframes are never changed.' }
  ] },
  { id: 'spinerig', cat: 'Animation & rigging', icon: '🦴', title: 'Rig like Spine (step by step)', desc: 'Main part, what follows what, hair & cloth bones, physics settings, play.', steps: [
    { t: 'The idea', x: 'A rig is a <b>skeleton</b>: one <b>main part</b> (the root, usually the body) holds everything; each other part <b>follows</b> one part (hand → arm → shoulder → body). Hair and cloth get <b>bones that bend</b> and move with physics. Let\'s look at a ready one.', demo: ['Open the practice model', () => chainPractice()] },
    { el: '#skelTree', pre: () => { tutDock('left'); if (!['bone', 'bonepose', 'bonechain'].includes(state.tool)) selectTool('bone'); }, t: 'The skeleton tree', x: 'Tool Property of every Bone tool shows <b>what follows what</b>: ★ is the main part at the top, every part is indented under the part it follows. 〰 = hair & cloth bones, 🌬 = gravity. Click a row to pick that part.' },
    { el: '#skelTree .btnrow', pre: () => { tutDock('left'); if (!['bone', 'bonepose', 'bonechain'].includes(state.tool)) selectTool('bone'); }, t: '1. The main part', x: 'Pick the body and press <b>★ Make main part</b>: every free part follows it at once. Only one part is the main part; it gets a ★ label on the canvas.' },
    { el: toolEl('bone'), pre: tutGroup('bone'), t: '2. What follows what', x: '<b>Bone: link parts</b>: click a part (hand), then the part it follows (arm). The joint goes where they touch; drag the dot to move it. The tree updates as you go.', demo: ['Bone: link parts', () => selectTool('bone')] },
    { el: toolEl('bone'), pre: tutGroup('bone'), t: '3. Hair & cloth bones', x: '<b>Bone: hair & cloth</b>: pick the hair / cape layer and click points from where it is attached (orange) to its tip. Each pair of points is a bone that bends the drawing.', demo: ['Bone: hair & cloth', () => selectTool('bonechain')] },
    { el: '#propBody', pre: () => { tutDock('left'); selectTool('bonechain'); }, t: '4. Physics settings', x: 'Like Spine: <b>Inertia</b> (how much it lags), <b>Strength</b> (back to its shape), <b>Damping</b> (calms it), <b>Mass</b>, <b>Gravity</b>, <b>Wind</b>, <b>Mix</b>. Or a ready setting: long hair, cape, skirt, ribbon, tail.' },
    { el: toolEl('bone'), pre: tutGroup('bone'), t: '5. Pose', x: '<b>Bone: pose</b>: drag a part to turn it around its joint — everything that follows it moves too. On the timeline each pose is a keyframe; turn on Tween between keyframes.', demo: ['Bone: pose', () => selectTool('bonepose')] },
    { el: '#btnPlay', pre: anim, t: '6. Play', x: 'Press <b>Enter</b>: the parts move with the main part, and the hair and cloth bend, lag and settle by themselves. Your drawings and keyframes never change.' }
  ] },
  { id: 'face', cat: 'Animation & rigging', icon: '🙂', title: 'Face sliders', desc: 'Blink, open the mouth, smile and raise the brows with sliders.', steps: [
    { el: menuEl('Animation'), pre: anim, t: 'Face sliders', x: 'Select the face layer, then Animation › <b>🙂 Face sliders…</b>.', demo: ['Open the face sliders', () => CMD.faceSliders()] },
    { t: 'Mark the parts', x: 'Add an <b>eye</b>, <b>mouth</b>, <b>smile</b> or <b>brow</b> part and drag a box around it on the drawing.' },
    { t: 'Move the sliders', x: 'Each slider changes the drawing on this frame (a face key). Keys in between are smoothed for you. <b>👁 Blink here</b> adds a quick blink.' }
  ] },
  { id: 'pose3d', cat: 'Features', icon: '🧍', title: 'Pose the 3D model', desc: 'Highlight, select, rotation rings, views, floor grid and shadow.', steps: [
    { el: '#btn3d', t: 'Open the 3D model', x: 'A posable figure to draw from.', demo: ['Open the 3D model', () => CMD.show3d()] },
    { t: 'Pick a part', x: 'Point at a body part: it lights up <b>blue</b>. Click it: it turns <b>red</b> and red / green / blue <b>rotation rings</b> appear at its joint.' },
    { t: 'Turn it exactly', x: 'Drag a ring to turn the part around that axis only. Or drag the part itself: the arm / leg follows (elbows and knees bend the right way). Every finger has its own joints.' },
    { t: 'Views and floor', x: 'The bar above the head: <b>Front / Side / Back</b> views, zoom and reset. Look › <b>Floor grid</b> and <b>Ground shadow</b> help you see the pose (the grid never goes onto your drawing).' },
    { t: 'Draw over it', x: '<b>Place on new layer</b> puts the pose on a layer to trace, or <b>Pose on canvas</b> lets you pose it right over your drawing.' }
  ] }
];
function installMoreTutorials() {
  for (const t of MORE_TUTORIALS) {
    if (TUTORIALS.some(x => x.id === t.id)) continue;
    let at = -1; TUTORIALS.forEach((x, i) => { if (x.cat === t.cat && !x.auto) at = i; });
    TUTORIALS.splice(at < 0 ? TUTORIALS.length : at + 1, 0, t);
    CMD['tut_' + t.id] = () => tutStart(t.id);
    const H = MENUS.find(m => m[0] === 'Help'); if (!H) continue;
    let j = -1; H[1].forEach((x, i) => { if (Array.isArray(x) && /^tut_/.test(x[1])) j = i; });
    if (j >= 0) H[1].splice(j + 1, 0, [t.icon + ' ' + t.title, 'tut_' + t.id]);
  }
}
