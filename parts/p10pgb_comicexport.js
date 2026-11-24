/* ---------- comic pages out: PDF, page images, print (3.6) ----------
   File › 📖 Export pages…: every page (frame) of the file, or a range, as one PDF (each page a picture at the file's
   print size: pixels / dpi; 144 dpi when the file has none), as numbered PNG files in a ZIP, or printed (🖨: the
   pages go to the browser / system print window, one per sheet). Draft and reference layers are left out, like
   in every export. pdfBuild is a small PDF writer (JPEG pictures, DCTDecode) — no library. */
/* pure: a PDF from JPEG pages [{ jpeg: Uint8Array, w, h (pixels), wPt, hPt (page size in points) }] */
function pdfBuild(pages, title = 'Comic') {
  const enc = new TextEncoder(), parts = [], offs = []; let n = 0;
  const add = b => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); n += u.length; };
  const obj = (id, body) => { offs[id] = n; add(`${id} 0 obj\n`); for (const b of [].concat(body)) add(b); add('\nendobj\n'); };
  add('%PDF-1.4\n'); add(new Uint8Array([37, 226, 227, 207, 211, 10])); // second line: binary marker
  const N = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  obj(2, `<< /Type /Pages /Count ${N} /Kids [${kids}] >>`);
  pages.forEach((p, i) => {
    const pg = 3 + i * 3, im = pg + 1, ct = pg + 2, w = +p.wPt.toFixed(2), h = +p.hPt.toFixed(2);
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    obj(im, [`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream']);
    const cs = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    obj(ct, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
  });
  const infoId = 3 + N * 3; obj(infoId, `<< /Title (${String(title).replace(/[()\\]/g, '')}) /Producer (Nexilune) >>`);
  const xref = n, count = infoId + 1;
  add(`xref\n0 ${count}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join(''));
  add(`trailer\n<< /Size ${count} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(n); let p = 0; for (const u of parts) { out.set(u, p); p += u.length; }
  return out;
}
/* a page as a white-backed picture (draft / reference layers left out) */
function pagePicture(f) { const c = compositeFrame(f, {}), o = makeCanvas(c.width, c.height), g = o.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, o.width, o.height); g.drawImage(c, 0, 0); return o; }
const blobOf = (cv, type, q) => new Promise(res => cv.toBlob(res, type, q));
async function exportPages(fmt, from, to) {
  const name = state.name || 'comic', dpi = state.dpi || 144, list = [];
  for (let f = from; f <= to; f++) list.push(f);
  if (!list.length) return;
  toast(`Preparing ${list.length} page${list.length > 1 ? 's' : ''}…`);
  if (fmt === 'pdf') {
    const pages = [];
    for (const f of list) { const cv = pagePicture(f); pages.push({ jpeg: new Uint8Array(await (await blobOf(cv, 'image/jpeg', 0.92)).arrayBuffer()), w: cv.width, h: cv.height, wPt: cv.width / dpi * 72, hPt: cv.height / dpi * 72 }); await new Promise(r => setTimeout(r, 0)); }
    download(new Blob([pdfBuild(pages, name)], { type: 'application/pdf' }), name + '.pdf');
  } else if (fmt === 'png') {
    const files = [];
    for (const f of list) files.push({ name: `${name} p${String(f + 1).padStart(3, '0')}.png`, data: new Uint8Array(await (await blobOf(pagePicture(f), 'image/png')).arrayBuffer()) });
    download(new Blob([makeZip(files)], { type: 'application/zip' }), name + ' pages.zip');
  } else if (fmt === 'print') {
    const urls = []; for (const f of list) urls.push(URL.createObjectURL(await blobOf(pagePicture(f), 'image/png')));
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'; document.body.appendChild(fr);
    const wIn = state.w / dpi, hIn = state.h / dpi;
    fr.contentDocument.open();
    fr.contentDocument.write(`<!doctype html><html><head><title>${escHtml(name)}</title><style>@page{size:${wIn}in ${hIn}in;margin:0}html,body{margin:0}img{display:block;width:${wIn}in;height:${hIn}in;page-break-after:always;object-fit:contain}</style></head><body>${urls.map(u => `<img src="${u}">`).join('')}</body></html>`);
    fr.contentDocument.close();
    await Promise.all([...fr.contentDocument.images].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    fr.contentWindow.focus(); fr.contentWindow.print();
    setTimeout(() => { fr.remove(); urls.forEach(u => URL.revokeObjectURL(u)); }, 60000);
    return;
  }
  toast(`Exported ${list.length} page${list.length > 1 ? 's' : ''}`);
}
function exportPagesDialog(fmt0) {
  const d = document.createElement('dialog'); d.className = 'csdlg'; d.id = 'pagesOutDlg';
  const N = state.frameCount;
  d.innerHTML = `<form method="dialog"><h2>📖 Export pages</h2>
    <label class="select"><span>As</span><select class="pfmt"><option value="pdf">One PDF (for print / sharing)</option><option value="png">Picture files, one per page (ZIP)</option><option value="print">Print 🖨</option></select></label>
    <label class="select"><span>Pages</span><select class="prange"><option value="all">All ${N} page${N > 1 ? 's' : ''}</option><option value="cur">This page (${state.frame + 1})</option><option value="some">From … to …</option></select></label>
    <div class="psome" hidden><label class="slider"><span>From</span><input type="number" class="pfrom" min="1" max="${N}" value="1"></label><label class="slider"><span>To</span><input type="number" class="pto" min="1" max="${N}" value="${N}"></label></div>
    <p class="muted small">Size: ${state.w} × ${state.h} px at ${state.dpi || 144} dpi = ${(state.w / (state.dpi || 144) * 25.4).toFixed(0)} × ${(state.h / (state.dpi || 144) * 25.4).toFixed(0)} mm. Draft and reference layers (guides…) are left out.</p>
    <div class="dialog-actions"><button type="button" data-a="cancel">Cancel</button><button type="button" data-a="go" class="primary">Export</button></div></form>`;
  document.body.appendChild(d);
  const fmt = d.querySelector('.pfmt'), range = d.querySelector('.prange'); if (fmt0) fmt.value = fmt0;
  range.onchange = () => { d.querySelector('.psome').hidden = range.value !== 'some'; };
  d.querySelector('[data-a=cancel]').onclick = () => d.remove();
  d.querySelector('[data-a=go]').onclick = () => {
    let a = 0, b = N - 1;
    if (range.value === 'cur') a = b = state.frame;
    if (range.value === 'some') { a = clamp(+d.querySelector('.pfrom').value - 1, 0, N - 1); b = clamp(+d.querySelector('.pto').value - 1, a, N - 1); }
    const f = fmt.value; d.remove(); exportPages(f, a, b);
  };
  d.showModal();
}
function installComicExport() {
  CMD.exportPages = () => exportPagesDialog();
  CMD.exportPDF = () => exportPagesDialog('pdf');
  CMD.printPages = () => exportPagesDialog('print');
  const F = MENUS.find(m => m[0] === 'File');
  if (F && !F[1].some(x => Array.isArray(x) && x[1] === 'exportPages')) {
    const i = F[1].findIndex(x => Array.isArray(x) && x[1] === 'exportPSD');
    F[1].splice(i < 0 ? F[1].length : i + 1, 0, ['📖 Export pages (PDF / pictures)…', 'exportPages'], ['🖨 Print…', 'printPages', 'Ctrl+P']);
  }
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !e.shiftKey && !e.altKey) { e.preventDefault(); exportPagesDialog('print'); } });
}
