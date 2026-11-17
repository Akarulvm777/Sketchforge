/* ---------- time-lapse recording & video export ---------- */
const TL = { on: true, frames: [], max: 1200, busy: false, last: 0, chain: Promise.resolve(), every: 1 };
function tlCapture(force) {
  if (!TL.on || exporting || (typeof state === 'undefined')) return;
  const now = performance.now();
  if (!force && now - TL.last < 150) { clearTimeout(TL.trail); TL.trail = setTimeout(() => tlCapture(true), 200); return; } /* never lose the last edit */
  TL.last = now;
  TL.chain = TL.chain.then(async () => {
    try {
      const src = compositeFrame(state.frame);
      const k = Math.min(1, 960 / Math.max(state.w, state.h));
      const c = makeCanvas(Math.max(2, Math.round(state.w * k) & ~1), Math.max(2, Math.round(state.h * k) & ~1));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height);
      const b = await canvasToBlob(c, 'image/jpeg');
      TL.frames.push({ b, w: c.width, h: c.height });
      if (TL.frames.length > TL.max) TL.frames = TL.frames.filter((_, i) => i % 2 === 0 || i === TL.frames.length - 1);
      tlUpdateBtn();
    } catch (e) { /* ignore capture errors */ }
  });
}
function tlUpdateBtn() {
  const b = $('#tlBtn'); if (!b) return;
  b.textContent = (TL.on ? '● ' : '○ ') + 'Time-lapse ' + TL.frames.length;
  b.classList.toggle('rec', TL.on);
}
function tlReset() { TL.frames = []; TL.chain = Promise.resolve(); tlUpdateBtn(); }
async function tlExport(seconds, prog) {
  if (!window.MediaRecorder) throw new Error('Video recording is not supported in this browser');
  await TL.chain;
  const all = TL.frames;
  if (all.length < 2) throw new Error('Nothing recorded yet — draw something first');
  const fps = 30, want = Math.max(2, Math.round(seconds * fps));
  const n = Math.min(all.length, want);
  const pick = i => all[Math.round(i * (all.length - 1) / (n - 1))];
  const delay = seconds * 1000 / n;
  const { w, h } = all[0];
  const cv = makeCanvas(w, h), g = cv.getContext('2d');
  const stream = cv.captureStream(0), track = stream.getVideoTracks()[0];
  const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 });
  const chunks = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise(r => { rec.onstop = r; });
  rec.start();
  const frame = async fr => { const bm = await createImageBitmap(fr.b); g.drawImage(bm, 0, 0, w, h); bm.close && bm.close(); track.requestFrame(); };
  for (let i = 0; i < n; i++) {
    await frame(pick(i)); prog.textContent = `Recording ${i + 1} / ${n}`;
    await new Promise(r => setTimeout(r, Math.max(8, delay)));
  }
  for (let i = 0; i < 20; i++) { await frame(all[all.length - 1]); await new Promise(r => setTimeout(r, 50)); } // hold final image 1 s
  rec.stop(); await done;
  download(new Blob(chunks, { type: mime.split(';')[0] }), (state.name || 'Untitled').replace(/[^\w\- ]+/g, '_') + '_timelapse.' + ext);
  return ext;
}
function openTimelapse() {
  let d = $('#tlDialog');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'tlDialog'; d.className = 'csdlg';
    d.innerHTML = `<form method="dialog"><h5>Time-lapse video</h5>
      <p class="muted small" id="tlInfo" style="margin:0 0 8px"></p>
      <label><span>Video length</span><input type="range" id="tlSecs" min="3" max="60" value="15"><output id="tlSecsV">15 s</output></label>
      <label style="grid-template-columns:96px 1fr"><span>Recording</span><span><input type="checkbox" id="tlOn"> record while I draw</span></label>
      <p class="muted small" id="tlProg" style="min-height:1.2em"></p>
      <div class="dialog-actions"><button type="button" id="tlClear">Clear</button><button type="button" id="tlClose">Close</button><button type="button" id="tlGo" class="primary">Export video</button></div></form>`;
    document.body.appendChild(d);
    $('#tlSecs').oninput = () => $('#tlSecsV').textContent = $('#tlSecs').value + ' s';
    $('#tlOn').onchange = e => { TL.on = e.target.checked; if (TL.on) tlCapture(true); tlUpdateBtn(); };
    $('#tlClear').onclick = () => { if (confirm('Delete the recorded time-lapse?')) { tlReset(); $('#tlInfo').textContent = 'Cleared.'; } };
    $('#tlClose').onclick = () => d.close();
    $('#tlGo').onclick = async () => {
      $('#tlGo').disabled = true; exporting = true;
      try { const ext = await tlExport(+$('#tlSecs').value, $('#tlProg')); $('#tlProg').textContent = 'Done — saved as .' + ext; }
      catch (e) { $('#tlProg').textContent = e.message; }
      exporting = false; $('#tlGo').disabled = false;
    };
  }
  $('#tlOn').checked = TL.on; $('#tlProg').textContent = '';
  $('#tlInfo').textContent = `${TL.frames.length} snapshots recorded (one per stroke / edit, up to ${TL.max}).`;
  d.showModal();
}
function installTimelapse() {
  CMD.timelapse = openTimelapse;
  CMD.tlToggle = () => { TL.on = !TL.on; if (TL.on) tlCapture(true); tlUpdateBtn(); toast('Time-lapse recording ' + (TL.on ? 'on' : 'off')); };
  MENUS[0][1].push('-', ['Time-lapse video…', 'timelapse'], ['Time-lapse recording on / off', 'tlToggle']);
  const b = document.createElement('button'); b.id = 'tlBtn'; b.title = 'Time-lapse: click to export video'; b.onclick = openTimelapse;
  $('#cmdbar').insertBefore(b, $('#pageBar') || null);
  tlUpdateBtn(); buildMenus();
  setTimeout(() => tlCapture(true), 500);
}
