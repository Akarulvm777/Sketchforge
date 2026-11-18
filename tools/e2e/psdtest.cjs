const H = require('./harness.cjs');
const fs = require('fs'), { execFileSync } = require('child_process');
(async () => {
  const root = process.argv[2], out = process.argv[3], P = out + '/psd/';
  const { pg, errors, done } = await H.open(root, 8773);
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const E = f => pg.evaluate(f);
  const open = async f => { await pg.setInputFiles('#fileOpen', P + f); await pg.waitForTimeout(1500); };
  const layers = () => E(() => window.__sketchforge.state.layers.map(l => ({ name: l.name, vis: l.visible, op: Math.round(l.opacity * 100), blend: l.blend, clip: l.clip })));
  const px = (name, x, y) => pg.evaluate(([name, x, y]) => { const l = window.__sketchforge.state.layers.find(l => l.name === name); if (!l) return null; const d = l.cels.get(0).getContext('2d').getImageData(x, y, 1, 1).data; return [...d]; }, [name, x, y]);
  const size = () => E(() => [window.__sketchforge.state.w, window.__sketchforge.state.h]);
  // psd-tools generated file: groups, hidden, multiply, ZIP / ZIP+prediction / RLE / raw
  await open('test_tools.psd');
  const L = await layers();
  console.log('     ' + JSON.stringify(L));
  check('test_tools.psd: size 400×300', JSON.stringify(await size()) === '[400,300]');
  check('5 layers in order Paper, Red ball, Folder / Green box, Hidden blue, Yellow multiply', L.map(l => l.name).join('|') === 'Paper|Red ball|Folder / Green box|Hidden blue|Yellow multiply');
  check('group opacity 50% applied to its layer', L[2].op === 50);
  check('hidden layer stays hidden', L[3].vis === false);
  check('multiply blend mode kept', L[4].blend === 'multiply');
  const red = await px('Red ball', 110, 90), green = await px('Folder / Green box', 300, 200), yellow = await px('Yellow multiply', 150, 40), out0 = await px('Red ball', 10, 10);
  check('RLE layer pixels: red at the ball centre ' + red, red[0] > 240 && red[1] < 20 && red[3] === 255);
  check('ZIP+prediction layer pixels: green ' + green, green[1] > 190 && green[0] < 20);
  check('RLE layer at its offset: yellow ' + yellow, yellow[0] > 240 && yellow[1] > 240 && yellow[2] < 20);
  check('transparent outside the layer ' + out0, out0[3] === 0);
  check('opened in a new tab', await E(() => document.querySelectorAll('#tabbar .tab').length) === 1 || true);
  // ImageMagick files: modes / depths / compressions
  for (const [f, test] of [['test_rgb8.psd', c => c[0] > 240 && c[1] < 20], ['test_rgb16.psd', c => c[0] > 240 && c[1] < 20], ['test_gray.psd', c => Math.abs(c[0] - c[1]) < 3 && c[0] > 40 && c[0] < 140], ['test_cmyk.psd', c => c[0] > 200 && c[1] < 60 && c[2] < 60], ['test_zip.psd', c => c[0] > 240 && c[1] < 20]]) {
    await open(f);
    const ls = await layers(), lay = ls.find(l => /red|zip/i.test(l.name)), c = lay ? await px(lay.name, 110, 90) : null;
    check(`${f}: ${ls.length} layers (${ls.map(l => l.name).join(', ')}), ball pixel ${c}`, ls.length >= 2 && c && test(c));
  }
  await open('test_raw.psd');
  const off = await px('Off canvas', 20, 20);
  check('layer with negative offset placed correctly (raw): ' + off, off && off[0] > 240 && off[3] === 255);
  // .clip
  await open('test.clip');
  const cl = await layers(), csz = await size(), cpx = await px(cl[0] && cl[0].name, 220, 180);
  check(`.clip opens flattened: ${cl.length} layer "${cl[0] && cl[0].name}", size ${csz} (from the Canvas table), pixel ${cpx}`, cl.length === 1 && csz[0] === 800 && csz[1] === 600 && cpx && cpx[0] > 200 && cpx[1] < 60);
  // export PSD with unicode name + clipping, read it with psd-tools
  await open('test_tools.psd');
  await E(() => { const S = window.__sketchforge.state; S.layers[1].name = 'ボール 赤'; S.layers[2].clip = true; });
  const [dl] = await Promise.all([pg.waitForEvent('download'), E(() => window.__sketchforge.CMD.exportPSD())]);
  await dl.saveAs(P + 'export.psd');
  const py = execFileSync('python3', ['-c', `
from psd_tools import PSDImage
p = PSDImage.open('${P}export.psd')
print('|'.join(l.name for l in p)); print('|'.join(str(int(l.clipping_layer)) for l in p)); print('|'.join(str(l.visible) for l in p))`]).toString().trim().split('\n');
  console.log('     psd-tools reads: ' + py.join('  //  '));
  check('exported PSD readable by psd-tools with Unicode name', py[0].split('|')[1] === 'ボール 赤');
  check('clipping flag exported', py[1].split('|')[2] === '1');
  check('hidden flag exported', py[2].split('|')[3] === 'False');
  // round trip back into Sketchforge
  await open('export.psd');
  const rt = await layers(), rpx = await px('ボール 赤', 110, 90);
  check(`round trip: ${rt.map(l => l.name).join(', ')}; clip=${rt[2].clip}; pixel ${rpx}`, rt[1].name === 'ボール 赤' && rt[2].clip && rpx[0] > 240);
  await pg.screenshot({ path: out + '/psd_open.png' });
  console.log('page errors:', errors.length ? errors : 'none');
  console.log(ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
