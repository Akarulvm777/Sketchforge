// Comic pages out (p10pgb): PDF with one page per frame at the print size, PNG pages in a ZIP, print; draft
// layers (guides) left out.
const H = require('./harness.cjs');
const path = require('path'), fs = require('fs'), cp = require('child_process');
(async () => {
  const root = process.argv[2], out = process.argv[3] || '/tmp';
  const { pg, errors, done } = await H.open(root, 8921, { width: 1300, height: 860 });
  const ok = []; const check = (n, c) => { ok.push(!!c); console.log((c ? 'ok   ' : 'FAIL ') + n); };
  const S = src => pg.evaluate(s => window.__sketchforge.scope(s), src);
  // a 3-page comic at 300 dpi (600 × 900 px = 2 × 3 inches): red, green, blue pages, and a draft guide
  await S(`(() => { newDocument(600, 900, 3, 12, false, 'Book'); state.projectType = 'comic'; state.dpi = 300;
    const l = activeLayer(); ['#ff0000', '#00ff00', '#0000ff'].forEach((c, f) => { const cel = makeCel(true), g = cel.getContext('2d'); g.fillStyle = c; g.fillRect(100, 100, 400, 700); l.cels.set(f, cel); });
    const gd = createLayer('Guides'); gd.draft = true; const gg = gd.cels.get(0).getContext('2d'); gg.fillStyle = '#ff00ff'; gg.fillRect(0, 0, 600, 40); state.layers.push(gd); refreshAll(); })()`);
  const run = async fmt => { await S('CMD.exportPages()'); await pg.waitForTimeout(200); await pg.selectOption('#pagesOutDlg .pfmt', fmt);
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 30000 }), pg.click('#pagesOutDlg [data-a=go]')]); const p = path.join(out, dl.suggestedFilename()); await dl.saveAs(p); return p; };
  const pdf = await run('pdf');
  check('File › Export pages › PDF downloads ' + path.basename(pdf), /Book\.pdf$/.test(pdf) && fs.readFileSync(pdf).subarray(0, 5).toString() === '%PDF-');
  const info = JSON.parse(cp.execFileSync('python3', ['-I', '-c', `
import sys, json, io
from pypdf import PdfReader
r = PdfReader(sys.argv[1]); pg = r.pages
out = {'n': len(pg), 'size': [float(pg[0].mediabox.width), float(pg[0].mediabox.height)], 'title': r.metadata.title}
from PIL import Image
im = Image.open(io.BytesIO(list(pg[1].images)[0].data)).convert('RGB')
out['img'] = im.size; out['mid'] = im.getpixel((300, 450)); out['top'] = im.getpixel((300, 10))
print(json.dumps(out))`, pdf]).toString());
  console.log('     ' + JSON.stringify(info));
  check('3 pages, each 2 × 3 inches (144 × 216 points) from 300 dpi', info.n === 3 && Math.abs(info.size[0] - 144) < 0.5 && Math.abs(info.size[1] - 216) < 0.5 && info.title === 'Book');
  check('page 2 is the green page at full resolution', info.img[0] === 600 && info.mid[1] > 230 && info.mid[0] < 30);
  check('the draft guide layer is left out', info.top.every(v => v > 240));
  const zip = await run('png');
  const names = cp.execFileSync('python3', ['-I', '-c', 'import sys,zipfile; print(",".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zip]).toString().trim();
  check('pictures: one PNG per page in a ZIP (' + names + ')', names === 'Book p001.png,Book p002.png,Book p003.png');
  // print: the pages go to a print frame
  await S('CMD.printPages()'); await pg.waitForTimeout(200);
  await pg.evaluate(() => { window.__printed = 0; const o = HTMLIFrameElement.prototype; const d = Object.getOwnPropertyDescriptor(o, 'contentWindow'); Object.defineProperty(o, 'contentWindow', { get() { const w = d.get.call(this); try { w.print = () => { window.__printed = w.document.images.length; }; } catch (e) {} return w; }, configurable: true }); });
  await pg.click('#pagesOutDlg [data-a=go]');
  await pg.waitForFunction(() => window.__printed > 0, null, { timeout: 15000 }).catch(() => {});
  check('Print sends every page to the print window', await pg.evaluate(() => window.__printed) === 3);
  console.log(errors.length ? errors : 'no errors', ok.every(Boolean) && !errors.length ? 'PASS' : 'FAIL');
  await done();
})();
