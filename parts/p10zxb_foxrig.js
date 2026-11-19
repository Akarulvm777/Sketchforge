/* ---------- Tutorial: rig the fox, step by step ----------
   A practice file with a pixel-art fox by bluegi, every body part on its own layer (parts laid out apart). The tour:
   put the parts together, link them (bone rig), place the joints, pose, animate with keyframes + tweens, play.
   Every step has "Show me" (does it for you); the video on the website shows the same steps.                     */
const FOX_PARTS = [{"id":"tail","name":"tail","png":"iVBORw0KGgoAAAANSUhEUgAAABwAAAAdCAYAAAC5UQwxAAABdElEQVR42r2WMW6EMBBFx4iKKxilRDlDGgouEOoUWyNtsx0XWCkHQEpLnyZKvU2aPQRlNL7CtqSyY3s9tjFOpgKB/PjjP98AZCrO+RrzXgEZi3O+hsBFzoURMQgucrdxmTtY5o4EJwMREYaxNRat6/r3+XUCvE53H7Z7D6Ua8sMsaBbTOKEPz3fQrC5d5k6Zxrfnu4Cnx9K4v10O5LvD2O5TeJ5eyGdV0+cffFtdbGVNGsMw3x9/B6ya3tvG8+e7ui73pAq5f4S6ZIWU/X0qNymU6hARbpeDYf8QRG8nAACj2iaEYC7YFkU67O31y2ypXFgOqB7KKTBXCSFY6UoDOyNTYHYrlWlcZ9YwtuQpUDW9EcwhgN5OZRpbGZUiCmbZXofZYAmTnihiI0u10TNjIVj0WMSmiKuFOgwAgNnulApTjeGDqTmU0GXudjkwGmgMuPY7sGWf7HkLRpsQgnHO1/rpSJ7WoaGO8QOLzdFcwH/5vdfrB/kmwngK8I3bAAAAAElFTkSuQmCC","from":[92,83],"to":[70,72],"size":[28,29]},{"id":"right_foot","name":"right foot","png":"iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAABHklEQVR42mNgwA7YGagJGhocWGRkZKbkNizhYxj2gBGb9xsaDvwpbJr/H5/G/rpERqINZWBgYJCWll4Vlt4SSqzL0C1gwqFOmRTvovsKq6GMjIyPkPmltQkMDAwMj3AZeubJTwbbtBn/bdNm/Mdp6P///wOQNUCBHLEuZyJGUXfzAqKDwjZtxn8mtAj6Ly0tjRI+JjLsMO/j9DpBl4altxDUhA/c29qM3fvoBpPifRSXonubWGAiw44/8WMzWMm7FqtGbEF0b2szxFB0g548eQJny8jIkJf3paWl/8MM6k3XQ5EsnnkJhY8uDwP7X/2Dsy+c/gAxtNBbiKJSCd1QJnRBSgyEARaY6QymAhSXoxdOf0DEPrnJCRt4+vQpIwBuwWdHdwNRjAAAAABJRU5ErkJggg==","from":[22,94],"to":[41,87],"size":[21,21]},{"id":"left_foot","name":"left foot","png":"iVBORw0KGgoAAAANSUhEUgAAABEAAAASCAYAAAC9+TVUAAABDUlEQVR42mNkIAIUNs3/j8w/8+Qnw+FZGYwwPiOxGpENgAGYQSzEasYHmGAM27QZ/23TZmA4u7Q2AUWDiQw7bkNwKcAH5OTkBOGG2KTP8ED3Lwx0Ny/AEINZ9vfv39sMDAwMTNLS0tPvb2neTo5LGBgYhBkYGBiYnj59msnAwMBwb2szhkvwGYosx8TAwMDw9OlTRlzRiR6weGMHWzrAFSbogJGBgYFBWlqa5LQBA0+fPmWEJzYDUwEGRzGIw4pnXiLKABkZGQasKRYGetP18BoAs0haWvo/3DvILiEF9G99h9slMLD/1T84G5clLLg04DPQUYwJRS1K7BiYCpDklQunP6CWJ+RG89OnTxkBSTpfKaAtJ8sAAAAASUVORK5CYII=","from":[50,98],"to":[60,89],"size":[17,18]},{"id":"lower_body","name":"lower body","png":"iVBORw0KGgoAAAANSUhEUgAAACMAAAAKCAYAAAA+euenAAABW0lEQVR42sWTv0tCURTHP+clORQOQRC8XFyEIAhz7Y/IwS3QAt2iN7Sl2NOtQRqFQOcaWqQGd4fQpa0hB/VC0NzwKL0N/uhpaQpS3+2e+73nfO6556I1YpqmtjJXa/yzPOelmBcqYCxVT+zivcAOQgutH7qiK5epo6dFFtxLFEK7/mWfdHQznzlsDOKmaWqPyxcUCNbaDuFNLyAHhhYsu/gCVLXwOJ643nZW6RIO+73TCQQfmhBAre0gGjAEyy42gGat5dC4y+LZWnl7Hz97mopxkS0NlhtARDSRb0U0IDO0Q0/MHwACSM9hRKM3nb7ndWB2gSxcva4P1erHBMBwbaz/YJ4n8cxyXdY/MsAASinJp+PDoGUX9V//JKWU/PribrDrwtnH4AIA0WSOr4GfX/l0XEbnfAaNd6qunNvncnZ/kj+azM0FMRfMJLCaco4b5WxCKbU9DX4agFufAMZ7GrfS7SoAAAAASUVORK5CYII=","from":[28,86],"to":[43,78],"size":[35,10]},{"id":"right_arm","name":"right arm","png":"iVBORw0KGgoAAAANSUhEUgAAABAAAAAYCAYAAADzoH0MAAABIklEQVR42mNkwAKkpaX1LTL2XkAXv/XkGwMDAwPD5ZlGjDAxJiya/zMwMFxA1wjTzMDAwKCbfu4/igGrVoUyI2uwyNiLYiM+wMTAwMBw6xWrDJLtGM5Wk+HCb8C/f/+E0G0n1hAmBgYGBhYGFh5skvhsRjaA+S/D72eEFOIKDyYZGRn+2ryVd3FpJOQKpidPnrwjZDvBQEQGJ2Y4EzTk3RZfOJsRR0IiCJ4+fcoIiQBsAbYA0xX9N/6g8Gtyl2H3AgMDAwOXy0IMsUINFuLCgFQwcAYYGxuz4jRARkaGYDgEJqj/YmBgYGbCFT1Egn+UhMEPBgaG/zgNwOUNYgPxM7GGMOFIpnzILsERkBzy8vKSBAMMX9749++fMUWJSEpKKgAA6m9XPjobZ48AAAAASUVORK5CYII=","from":[4,67],"to":[32,58],"size":[16,24]},{"id":"left_arm","name":"left arm","png":"iVBORw0KGgoAAAANSUhEUgAAAA8AAAAbCAYAAACjkdXHAAABNUlEQVR42mNkgALd9HP/YWw1GS4GBgYGhrW1GowMeAALPsng5htwA8tq1INuMDDwVcnILHj69CkjQc3I4CYDw7qejPPE28zAwMBQWqPOcAtNTFpa+v/Tp08ZCWpORbPNImMvw4kZzgwMDAwMTPg03nryDYUPC0iCzkbWiK6JoGZcGpABEwMFgCzNFhl7GaSlpf9TZDMjctyRqhkeYJkV9hiShRqY4cnlspBBRkaG4enTp4z0DbBve+IJa8bm5IGNZy6XhVS0uWVy1H9i/AuLJrhm27QZXdM7DpJkI6wYYvrPwPiVbGcz/v9PlpMhfmZiuEaMLVCNB2BOZmBgYGD5++fPaQYGBgaYv6czMDDcWgApo9QS9iLrP/D06VNHDFNt0mfESUtLv4PlLmRMlOelpaWFSQ0wAId8WiYOVpzmAAAAAElFTkSuQmCC","from":[89,60],"to":[76,58],"size":[15,27]},{"id":"right_shoulder","name":"right shoulder","png":"iVBORw0KGgoAAAANSUhEUgAAAAsAAAAPCAYAAAAyPTUwAAAApUlEQVR42mNgwAPk5OQEZWRkHPQyz1owMDAwMOJSKC0t/Z+BgYFByGczXIwJn8nICnEqhpmKDpiIsR6vydgUYiiWlpb+b5GxF6cfmAi5E6fJa588IayYGFNRTCZkKgMDAwMTsabCTL5okbGXobvlJmHFT58+NWD4z2zEwMDQysDA8AyfYoyEFNp6y+D6468CTP//cTAwMlgw/mVefXG2wVUGBgYGAPMOKwU/b2cOAAAAAElFTkSuQmCC","from":[9,45],"to":[36,49],"size":[11,15]},{"id":"left_shoulder","name":"left shoulder","png":"iVBORw0KGgoAAAANSUhEUgAAAAwAAAAQCAYAAAAiYZ4HAAAApUlEQVR42mNggAJRUVEeBiIAi3HaGa5fjExfGRgYGNi2+DI8ffqUEZ8GRgYGBgbd9HP/1WS4GBgYGBhOzHDGq4kJXcAiYy+DtLT0f6I1ENLEhMskXJqYCIUKuia8Giwy9jKQbAO605gYSAREaUC2hXwbbj35xkBMiME1wJIGoRBjQbYBl6aSGvX8WwwMH0/MQBLUTT/3n4GBgSG4+cb/4OYbONMSAHbQM6o2h4uqAAAAAElFTkSuQmCC","from":[74,57],"to":[76,49],"size":[12,16]},{"id":"body","name":"body","png":"iVBORw0KGgoAAAANSUhEUgAAACUAAAAhCAYAAABeD2IVAAADeUlEQVR42s2XS2gTQRiAv5ms1gdoLRaFbqUUMYJUrYoED1F8gdBURPBYoaCGgoiFIELAoMVLQTzqwYoeFS8mXsSIFBEPtRVPGtGLESxqfaD10SbroZl1stndbtJW/CEk+8/+/3zzv5jAfyZtR4faDIB1x4Y3SIuzCDrHMjEOXhh0NbjVGwUgtnenr+P03fvcvvfEfr727HsgoFu90bcI2WQACIvtCDqrPdXT95Pq52/g0ZsR+zA7qvVVOnATgAGAEIvBKnvp8PrFlYal78TAdfq7u9jYaKil+cAO2qNoYJ6+9Mip6AM0dKQBkFNQVivAGnORJ5BTEgPXXfXN7dFpbZV/BdTQkSYSz9r7q/StVgqAzt2by2pC6YKkUkXKzYfTl4qMvvffSMESpYjEs2WGm9ausF9Wm0RNk/7uLhvGCaQ3im7vBuQmJShRryudYHqU9NNrhe4KpNt17t7sCuSMkgZlNTgXFJhpmhUwqu03Nhq8GRl0BVLvDz8fLYOZDghArj7+sg5Y6raowPzmkZeoDvNKlxcQgJxf+LQMENN1jLPQB/N5Ynt30twetTtOb2+3Vg8CNJaJIY1i3fKxTMzzpUg8W1FjuqhZpY8CvdWd6fIDsiMlihP1QSbudKl0A9JB/GASyTD7k2Fy+fEpqEmMeYCtqDaNbuI1fxRAIhkue84B/fERW2cIWbAjlcuP+54oEs/y+NIu1zXVgQ0daU8YgP6+F75AU1BFuVBXBAWLmqZ9W1BAfil2gznigFljLuIxYAisinGgUukFp0dMjYWgNZfLj1fAOMVAVg7OIHCReJZ0CcwJFLQ+vXwbRWtqcDoXdcdeKfWKTpC2942UgPq5cDwTkVgi9L/d041ajPQ549dlNUdKCMc9OID4bewHHDhSHzOxL7UYeoHNBpTsORV9V4thLj9e8Zmt9BmW4HU1IP+k0IWQn2cKMtvjw5AThVe1RmGuZpmsswqjwITfRc8NZi6Hq+ztvfmj5/T2LuDDWCaGH9xcwyix7+YtLS31B7rPjNy4nGyZye3T675VhUyW/WE4ce5KOGTJfUXBU4o0CyG2grUHCAPcuJwM5PXQsT7f9aH8r+EtZt1XYBXQWtIB8PrOufMiyCaJ1NWVEyG2ySLrXTb4VgxZQ1uaFvg7KVhfL6a6h53qk6mBViskVg29/YmxcvThg1Rq8g+K+3P+nuoxYwAAAABJRU5ErkJggg==","from":[26,47],"to":[42,46],"size":[37,33]},{"id":"head","name":"head","png":"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","from":[73,2],"to":[35,4],"size":[55,48]}];
const FOX_K = 4; // the 128 px pixel art is shown 4x bigger (512 px page), pixels stay sharp
// joints (in 128 px coordinates of the assembled fox) and the part each one follows
const FOX_RIG = {
  body: { joint: [60, 76], parent: null }, head: { joint: [60, 49], parent: 'body' },
  right_shoulder: { joint: [42, 51], parent: 'body' }, left_shoulder: { joint: [82, 51], parent: 'body' },
  right_arm: { joint: [40, 60], parent: 'right_shoulder' }, left_arm: { joint: [83, 60], parent: 'left_shoulder' },
  lower_body: { joint: [60, 80], parent: 'body' }, right_foot: { joint: [51, 89], parent: 'lower_body' },
  left_foot: { joint: [68, 90], parent: 'lower_body' }, tail: { joint: [73, 96], parent: 'lower_body' }
};
const FOX_VIDEO = 'assets/rig-fox.mp4';
const foxLayer = id => state.layers.find(l => l.foxId === id) || state.layers.find(l => l.name === (FOX_PARTS.find(p => p.id === id) || {}).name);
const isFoxDoc = () => !!foxLayer('head');
let foxImgs = null;
async function foxImages() {
  if (!foxImgs) foxImgs = Object.fromEntries(await Promise.all(FOX_PARTS.map(async p => [p.id, await loadImage('data:image/png;base64,' + p.png)])));
  return foxImgs;
}
function foxDraw(cel, img, x, y) { // one part at (x, y) in 128 px units, sharp pixels
  const g = cel.getContext('2d'); g.clearRect(0, 0, cel.width, cel.height); g.imageSmoothingEnabled = false;
  g.drawImage(img, Math.round(x * FOX_K), Math.round(y * FOX_K), img.width * FOX_K, img.height * FOX_K); cel._ink = true; cel._sv = (cel._sv || 0) + 1;
}
/* opens the practice file (a new tab): parts apart, as you would draw them */
async function foxOpen() {
  const imgs = await foxImages();
  newDocument(128 * FOX_K, 128 * FOX_K, 1, 12, false, 'Fox — rig practice');
  state.layers = state.layers.filter(l => l.paper); // keep the white paper only
  for (const p of FOX_PARTS) {
    const l = createLayer(p.name); l.foxId = p.id;
    foxDraw(l.cels.get(0), imgs[p.id], p.from[0], p.from[1]);
    state.layers.push(l);
  }
  state.activeId = foxLayer('body').id; layerCounter = state.layers.length;
  history.undo.length = 0; history.redo.length = 0; dirty = false;
  bindAll(state.frame); refreshAll(); fit(); if (typeof syncTab === 'function') syncTab();
}
const foxEnsure = async () => { if (!isFoxDoc()) await foxOpen(); };
/* step 1: every part slides to its place (the pixels move: no transform left over, ready to rig) */
async function foxAssemble(animate = true) {
  await foxEnsure(); const imgs = await foxImages();
  if (state.mode === 'anim') setMode('draw', true);
  gotoFrame(0);
  const before = snapshotTimeline(), t0 = performance.now(), dur = animate ? 1400 : 0;
  await new Promise(res => {
    const step = () => {
      const k = dur ? clamp((performance.now() - t0) / dur, 0, 1) : 1, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      FOX_PARTS.forEach((p, i) => {
        const l = foxLayer(p.id); if (!l) return;
        const kk = clamp(e * 1.15 - i * 0.015, 0, 1); // parts arrive one after the other
        l.cels = new Map([[0, l.cels.get(0) || makeCel(true)]]); l.parent = null; l.px = l.py = null;
        foxDraw(l.cels.get(0), imgs[p.id], p.from[0] + (p.to[0] - p.from[0]) * kk, p.from[1] + (p.to[1] - p.from[1]) * kk);
      });
      bindAll(0); refreshStage();
      if (k < 1) requestAnimationFrame(step); else res();
    };
    step();
  });
  pushHistory(timelineEntry(before, snapshotTimeline())); refreshAll();
  toast('The fox is together. Each part is still its own layer.');
}
const foxTogether = () => FOX_PARTS.every(p => { const l = foxLayer(p.id), b = l && celBBox(l.cels.get(0)); return b && Math.abs(b.x - p.to[0] * FOX_K) <= FOX_K && Math.abs(b.y - p.to[1] * FOX_K) <= FOX_K; });
/* step 2: bone rig (who follows whom) */
async function foxLink() {
  await foxEnsure(); if (!foxTogether()) await foxAssemble(false);
  timelineOp(() => { for (const id in FOX_RIG) { const l = foxLayer(id), par = FOX_RIG[id].parent && foxLayer(FOX_RIG[id].parent); if (l) setLayerParent(l, par ? par.id : null); } });
  selectTool('bone'); toast('Linked: arm → shoulder → body, head → body, feet and tail → lower body');
}
/* step 3: joints (the orange dot of each part = where it turns) */
async function foxJoints() {
  await foxEnsure(); if (!state.layers.some(l => l.parent)) await foxLink();
  timelineOp(() => { for (const id in FOX_RIG) { const l = foxLayer(id); if (l) { l.px = FOX_RIG[id].joint[0] * FOX_K; l.py = FOX_RIG[id].joint[1] * FOX_K; } } });
  selectTool('bone'); state.activeId = foxLayer('right_shoulder').id; refreshAll(); drawOverlay();
  toast('Joints placed: neck, shoulders, elbows, hips, tail base');
}
const foxRigged = () => FOX_PARTS.every(p => { const l = foxLayer(p.id); return l && l.px != null; });
/* step 4: pose (rotate a part: everything attached follows) */
async function foxPose() {
  await foxEnsure(); if (!foxRigged()) await foxJoints();
  gotoFrame(0);
  const set = (id, rot) => { const x = ensureXf(foxLayer(id).cels.get(0)); x.rot = rot; };
  timelineOp(() => { set('right_shoulder', 0); set('right_arm', 0); set('head', 0); set('tail', 0); });
  const t0 = performance.now();
  await new Promise(res => { const step = () => { const k = clamp((performance.now() - t0) / 900, 0, 1);
    set('right_shoulder', 125 * k); set('right_arm', 25 * k); set('head', -8 * k); set('tail', -15 * k); refreshAll();
    if (k < 1) requestAnimationFrame(step); else res(); }; step(); });
  selectTool('bonepose'); state.activeId = foxLayer('right_shoulder').id; refreshAll(); drawOverlay();
  toast('The shoulder turned and the arm came with it');
}
/* step 5: animate: a wave, a head bob and a tail wag, on 3 keyframes with tweens */
async function foxAnimate() {
  await foxEnsure(); if (!foxRigged()) await foxJoints();
  const N = 16, poses = { // rotation on frames 0, 8, 16
    right_shoulder: [120, 150, 120], right_arm: [30, -10, 30], head: [-6, 6, -6], tail: [-12, 14, -12], left_shoulder: [0, -6, 0], body: [0, 2, 0] };
  timelineOp(() => {
    state.frameCount = Math.max(state.frameCount, N + 1);
    for (const p of FOX_PARTS) {
      const l = foxLayer(p.id), c0 = l.cels.get(0), r = poses[p.id];
      l.cels = new Map([[0, c0]]);
      ensureXf(c0).tween = !!r; if (r) ensureXf(c0).rot = r[0];
      if (!r) continue;
      for (const [i, f] of [[1, 8], [2, N]]) { const c = copyCel(c0, true); c._xf = { ...ensureXf(c0), rot: r[i], tween: i < 2 }; l.cels.set(f, c); }
    }
    state.playIn = 0; state.playOut = N - 1;
  });
  setMode('anim'); gotoFrame(0); refreshAll();
  toast('3 keyframes per moving part, tweens in between. Press Play!');
}
async function foxPlay() { await foxEnsure(); if (!state.layers.some(l => l.cels.size > 1)) await foxAnimate(); if (!playing) play(); }
function foxVideo() {
  const site = typeof siteUrl === 'function' ? siteUrl() : '', src = site ? site + '/' + FOX_VIDEO : FOX_VIDEO;
  let d = $('#foxVideo'); if (d) d.remove();
  d = document.createElement('dialog'); d.id = 'foxVideo'; d.className = 'csdlg wndlg';
  d.innerHTML = `<form method="dialog"><h5>🦊 Rig a character — video</h5><video src="${src}" controls autoplay playsinline style="width:100%;max-height:70vh;background:#000;border-radius:8px"></video>
    <p class="muted small" style="margin:6px 0 0">Needs the internet. The same steps are in Help › Tutorials › Rig the fox, with "Show me" buttons.</p>
    <div class="dialog-actions"><span style="flex:1"></span><button value="ok" class="primary">Close</button></div></form>`;
  document.body.appendChild(d);
  d.querySelector('video').onerror = () => { d.querySelector('p').textContent = 'The video could not load (offline?). Follow Help › Tutorials › Rig the fox instead.'; };
  d.addEventListener('close', () => d.remove()); d.showModal();
}
function installFoxRig() {
  Object.assign(CMD, { foxOpen: () => foxOpen(), foxVideo, foxTut: () => tutStart('fox'), tut_fox: () => tutStart('fox') });
  const H = MENUS.find(m => m[0] === 'Help')[1], i = H.findIndex(x => Array.isArray(x) && x[1] === 'tut_rig');
  const item = ['🦊 Rig the fox (practice file)', 'tut_fox'], vid = ['▶ Video: rig a character', 'foxVideo'];
  if (i >= 0) H.splice(i + 1, 0, item, vid); else H.splice(3, 0, item, vid);
  const A = MENUS.find(m => m[0] === 'Animation')[1], j = A.findIndex(x => Array.isArray(x) && /How to rig/.test(x[0]));
  if (j >= 0) A.splice(j + 1, 0, ['🦊 Practice: rig the fox…', 'foxTut']);
  const vtip = `<br><a href="#" onclick="CMD.foxVideo();return false">▶ Watch the video</a>`;
  TUTORIALS.splice(TUTORIALS.findIndex(t => t.id === 'rig') + 1, 0, { id: 'fox', cat: 'Animation & rigging', icon: '🦊', title: 'Rig the fox (practice)', desc: 'Step by step with a ready-made character: assemble, link, joints, pose, animate.', steps: [
    { el: '#layerList', pre: async () => { await foxEnsure(); tutDock('right'); }, t: '🦊 Your practice fox', x: 'A new tab opened with a fox (art by bluegi). Each body part is on <b>its own layer</b>, look at the Layer panel. That is all a cut-out rig needs.' + vtip },
    { el: toolEl('move'), pre: async () => { await foxEnsure(); tutGroup('move')(); }, t: '1. Put the parts together', x: 'With the <b>Move</b> tool (V), click a part and drag it to its place: head on top, jacket, shoulders and arms on the sides, trousers, feet, tail behind. Then <b>Layer › Bake transform</b>.', demo: ['Show me', () => foxAssemble(true)] },
    { el: toolEl('bone'), pre: async () => { await foxEnsure(); tutNoDock(); selectTool('bone'); }, t: '2. Link the parts (Bone tool)', x: 'Take the <b>🦴 Bone</b> tool (after the Shading pens). <b>Click the arm, then click the shoulder</b>: the arm now follows the shoulder. Same for shoulder → body, head → body, feet and tail → lower body. The joint goes where the parts touch.', demo: ['Show me', foxLink] },
    { el: ['#propBody', '#viewport'], pre: async () => { await foxEnsure(); tutDock('left'); }, t: '3. Place the joints', x: 'Each part has a <b>dot</b>: the point it turns around. With the Bone tool, <b>drag a dot</b> onto the joint you want: neck, shoulder, elbow, hip, base of the tail. Bones join the dots.', demo: ['Show me', foxJoints] },
    { el: ['#propBody', '#viewport'], pre: async () => { await foxEnsure(); tutDock('left'); }, t: '4. Pose', x: 'Sub tool <b>Bone: pose</b>: drag the shoulder to turn it around its joint, the arm turns with it. Turn the head and the tail too.', demo: ['Show me', foxPose] },
    { el: '#timeline', pre: async () => { await foxEnsure(); anim(); }, t: '5. Animate', x: 'Frame 1: pose. Go to frame 9, press <b>K</b> (keyframe) and change the pose. Frame 17: the first pose again. Then <b>Create motion tween</b> on the first keyframes: every frame in between is made for you.', demo: ['Show me', foxAnimate] },
    { el: ['#btnPlay', '#timeline'], pre: foxEnsure, t: '6. Play it', x: 'Press <b>Play</b> (Enter). The fox waves, nods and wags its tail. Export it with <b>File › Export animation</b> (GIF or video).', demo: ['Play', foxPlay] }
  ] });
}
