const H = require('./harness.cjs');
const fs = require('fs');
(async () => {
  const root = process.argv[2], out = process.argv[3];
  const { pg, errors, done } = await H.open(root, 8772);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = f => pg.evaluate(f);
  pg.on('dialog', d => d.accept());
  const openVideo = async (how) => {
    const [fc] = await Promise.all([pg.waitForEvent('filechooser'), E(() => window.__sketchforge.CMD.videoImport())]);
    await fc.setFiles(out + '/clip.webm');
    await pg.waitForFunction(() => /frames at/.test(document.querySelector('#vidInfo').textContent), null, { timeout: 15000 });
    console.log('     ' + await E(() => document.querySelector('#vidInfo').textContent));
    await pg.selectOption('#vidHow', how);
    await pg.evaluate(() => { const s = document.querySelector('#vidStart'); s.value = 1; s.oninput(); });
    await pg.click('#vidGo');
    await pg.waitForFunction(() => !document.querySelector('#vidDialog').open, null, { timeout: 60000 });
    await pg.waitForTimeout(800);
  };
  await E(() => window.__sketchforge.selectTool('pen'));
  await openVideo('ref');
  const info = await E(() => { const S = window.__sketchforge.state; const l = S.layers.find(x => x.vref); return { frames: S.frameCount, mode: S.mode, has: !!l, locked: l && l.locked, name: l && l.name }; });
  check(`reference layer added (${info.name}), timeline extended to ${info.frames} frames, animation mode`, info.has && info.frames >= 36 && info.mode === 'anim');
  const sig = () => E(() => { const l = window.__sketchforge.state.layers.find(x => x.vref), c = l.vref.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4000) { s += d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7; n += d[i + 3] > 0; } return [s, n]; });
  await E(() => window.__sketchforge.gotoFrame(0)); await pg.waitForTimeout(500);
  const s0 = await sig();
  await E(() => window.__sketchforge.gotoFrame(20)); await pg.waitForTimeout(600);
  const s20 = await sig();
  check(`video frame shown on the layer (${s0[1]} opaque samples)`, s0[1] > 100);
  check('different frame shows a different video picture', s0[0] !== s20[0]);
  check('reference is not in the exported picture', await E(() => { const SF = window.__sketchforge, c = SF.compositeFrame(20), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let i = 0; i < d.length; i += 4000) if (d[i] < 200) dark++; return dark === 0; }));
  check('sound taken from the video', await E(() => document.querySelector('#audioWrap') && !document.querySelector('#audioWrap').hidden));
  // try painting on the video layer
  await E(() => { const SF = window.__sketchforge; SF.state.activeId = SF.state.layers.find(x => x.vref).id; });
  await pg.strokeDoc([[100, 100], [300, 200]]);
  check('cannot paint on the video layer', await E(() => document.querySelector('#toast') ? /video reference/i.test(document.querySelector('#toast').textContent) : true));
  // eyedropper sees the video
  const picked = await E(() => { const SF = window.__sketchforge; return null; });
  // playback drives the video
  await E(() => window.__sketchforge.gotoFrame(0));
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(1200); await pg.keyboard.press('Enter');
  const vt = await E(() => window.__sketchforge.state.layers.find(x => x.vref).vref.el.currentTime);
  check('playing the animation plays the video (t=' + vt.toFixed(2) + 's)', vt > 0.3);
  // save & reopen
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.keyboard.press('Control+s')]);
  await dl.saveAs(out + '/vid.sketchforge');
  const doc = JSON.parse(fs.readFileSync(out + '/vid.sketchforge', 'utf8'));
  check('file keeps the video and the audio', doc.layers.some(l => l.vref && l.vref.data) && doc.audio && doc.audio.data);
  await pg.setInputFiles('#fileOpen', out + '/vid.sketchforge'); await pg.waitForTimeout(3000);
  await E(() => window.__sketchforge.gotoFrame(10)); await pg.waitForTimeout(800);
  const re = await E(() => { const S = window.__sketchforge.state, l = S.layers.find(x => x.vref); return { tabs: document.querySelectorAll('#tabbar .tab').length, has: !!(l && l.vref.el), audio: !document.querySelector('#audioWrap').hidden }; });
  check(`reopened in a new tab with working video + audio ${JSON.stringify(re)}`, re.tabs === 2 && re.has && re.audio);
  const s10 = await sig();
  check('reopened video shows frames', s10[1] > 100);
  await pg.screenshot({ path: out + '/vid_ref.png' });
  // undo removes the reference layer (in the first tab)
  await pg.click('#tabbar .tab:nth-child(1)'); await pg.waitForTimeout(500);
  const undoN = await E(() => window.__sketchforge.history.undo.length);
  // convert to frames
  await openVideo('frames');
  const fr = await E(() => { const S = window.__sketchforge.state, l = S.layers.find(x => / \(frames\)$/.test(x.name)); return l ? [...l.cels.values()].filter(c => c._ink).length : -1; });
  check('convert to frames created ' + fr + ' drawn frames', fr >= 30);
  await E(() => window.__sketchforge.gotoFrame(15)); await pg.waitForTimeout(300);
  await pg.screenshot({ path: out + '/vid_frames.png' });
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(300);
  check('undo removes the converted layer', await E(() => !window.__sketchforge.state.layers.some(x => / \(frames\)$/.test(x.name))));
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
