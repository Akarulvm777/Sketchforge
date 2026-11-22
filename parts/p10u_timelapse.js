/* ---------- time-lapse recording & video export ----------
   One recording per document: reset on New, loaded from / saved into the .sketchforge file (doc.timelapse).
   Modes: 'canvas'  = the flat picture;
          'view'    = the workspace as you see it: zoom, pan, rotation, cursor, tool, brush size, colour;
          'screen'  = real screen capture (getDisplayMedia; desktop browsers and the Electron app).
   Snapshots are taken after every edit, and in view / screen modes also when the view or the tool changes. */
const TL_KEY = 'sketchforge.tl.v1';
const TL = { on: true, mode: 'view', keep: true, frames: [], gen: 0, max: 1200, last: 0, chain: Promise.resolve(), stream: null, video: null, timer: 0, cursor: null };
function tlPrefsLoad() { try { const o = JSON.parse(localStorage.getItem(TL_KEY) || 'null'); if (o) { TL.on = o.on !== false; if (['canvas', 'view', 'screen'].includes(o.mode)) TL.mode = o.mode === 'screen' ? 'view' : o.mode; TL.keep = o.keep !== false; } } catch (e) { /* ignore */ } }
function tlPrefsSave() { try { localStorage.setItem(TL_KEY, JSON.stringify({ on: TL.on, mode: TL.mode, keep: TL.keep })); } catch (e) { /* ignore */ } }
const tlScreenSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

/* ---- snapshot renderers ---- */
function tlRenderCanvas() {
  const k = Math.min(1, 960 / Math.max(state.w, state.h));
  const src = compositeFrame(state.frame, { scale: k });
  const c = makeCanvas(Math.max(2, Math.round(state.w * k) & ~1), Math.max(2, Math.round(state.h * k) & ~1));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
/* The viewport as the user sees it, plus a cursor and a small HUD with tool / size / colour / zoom / angle. */
function tlRenderView() {
  const vr = vpRect();
  if (vr.width < 10 || vr.height < 10) return tlRenderCanvas();
  const k = Math.min(1, 1280 / vr.width), W = Math.max(2, Math.round(vr.width * k) & ~1), H = Math.max(2, Math.round(vr.height * k) & ~1);
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = getComputedStyle(viewport).backgroundColor || '#4b4b4b'; g.fillRect(0, 0, W, H);
  const m = vmat();
  g.save(); g.scale(k, k); g.transform(m.a, m.b, m.c, m.d, view.x, view.y);
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 18 / view.scale;
  g.fillStyle = '#fff'; g.fillRect(0, 0, state.w, state.h); g.shadowColor = 'transparent';
  // the drawing at about the size it appears in the picture (not full resolution: huge pages made this very slow)
  g.drawImage(compositeFrame(state.frame, { scale: Math.min(1, view.scale * k * 1.25) }), 0, 0, state.w, state.h);
  if (stroke && bufCanvas) { g.globalAlpha = +bufCanvas.style.opacity || 1; g.drawImage(bufCanvas, 0, 0); g.globalAlpha = 1; }
  g.restore();
  // cursor: brush outline + crosshair
  const cur = TL.cursor;
  if (cur) {
    const x = cur.x * k, y = cur.y * k, def = TOOLDEF[state.tool] || {}, s = def.kind === 'brush' ? curSettings() : null;
    const r = def.kind === 'brush' && s ? Math.max(3, s.size * view.scale * k / 2) : 6;
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,.7)'; g.beginPath(); g.arc(x, y, r + 1, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.stroke();
  }
  // HUD
  const def = TOOLDEF[state.tool] || { name: state.tool }, s = def.kind === 'brush' ? curSettings() : null;
  const fs = Math.max(11, Math.round(13 * Math.max(0.8, k))), pad = 8;
  g.font = `600 ${fs}px system-ui, sans-serif`; g.textBaseline = 'middle';
  const left = def.name + (def.kind === 'brush' && s ? `  ${Math.round(s.size)} px` : '');
  const right = `${Math.round(view.scale * 100)}%  ${Math.round(((view.rot % 360) + 360) % 360)}°${view.flip ? '  flipped' : ''}`;
  const pill = (txt, x, alignRight, swatch) => {
    const tw = g.measureText(txt).width + (swatch ? fs + 6 : 0), h = fs + 10, x0 = alignRight ? x - tw - pad * 2 : x;
    g.fillStyle = 'rgba(20,20,22,.72)'; g.beginPath(); g.roundRect ? g.roundRect(x0, pad, tw + pad * 2, h, h / 2) : g.rect(x0, pad, tw + pad * 2, h); g.fill();
    let tx = x0 + pad;
    if (swatch) { g.fillStyle = swatch; g.beginPath(); g.arc(tx + fs / 2, pad + h / 2, fs / 2 - 1, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); tx += fs + 6; }
    g.fillStyle = '#fff'; g.fillText(txt, tx, pad + h / 2 + 1);
  };
  pill(left, pad, false, def.kind === 'brush' && !def.erase ? state.color : null);
  pill(right, W - pad, true);
  return c;
}
function tlRenderScreen() {
  const v = TL.video;
  if (!v || !v.videoWidth) return tlRenderView();
  const k = Math.min(1, 1280 / v.videoWidth), c = makeCanvas(Math.max(2, Math.round(v.videoWidth * k) & ~1), Math.max(2, Math.round(v.videoHeight * k) & ~1));
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  return c;
}

/* ---- capture ---- */
function tlCapture(force) {
  if (!TL.on || TL.restoring || exporting || (typeof state === 'undefined')) return;
  const now = performance.now();
  if (!force && now - TL.last < 150) { clearTimeout(TL.trail); TL.trail = setTimeout(() => tlCapture(true), 200); return; } /* never lose the last edit */
  TL.last = now;
  const gen = TL.gen;
  const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 3000 }) : setTimeout(r, 60)));
  TL.chain = TL.chain.then(async () => {
    try {
      await idle(); // let drawing go first
      for (let i = 0; i < 400 && !TL.hurry && (stroke || active || !inputQuiet(2000)); i++) await new Promise(r => setTimeout(r, 150)); // wait for a real pause (up to a minute): never while drawing, hovering or picking a colour
      if (gen !== TL.gen) return; // a new / other file was opened meanwhile
      const c = TL.mode === 'screen' ? tlRenderScreen() : TL.mode === 'view' ? tlRenderView() : tlRenderCanvas();
      const b = await canvasToBlob(c, 'image/jpeg');
      if (gen !== TL.gen) return;
      TL.frames.push({ b, w: c.width, h: c.height });
      if (TL.frames.length > TL.max) TL.frames = TL.frames.filter((_, i) => i % 2 === 0 || i === TL.frames.length - 1);
      tlUpdateBtn();
    } catch (e) { /* ignore capture errors */ }
  });
}
/* View / tool changes only matter for the workspace and screen modes; throttled. */
function tlViewChanged() {
  if (!TL.on || TL.restoring || TL.mode === 'canvas') return;
  clearTimeout(TL.vt); TL.vt = setTimeout(() => tlCapture(true), 250);
}
async function tlStartScreen() {
  if (!tlScreenSupported()) throw new Error('Screen recording is not supported here (use Workspace view)');
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = stream; await v.play();
  TL.stream = stream; TL.video = v;
  stream.getVideoTracks()[0].addEventListener('ended', () => { tlStopScreen(); if (TL.mode === 'screen') { TL.mode = 'view'; tlPrefsSave(); tlUpdateBtn(); toast('Screen sharing stopped — time-lapse continues in Workspace view'); } });
  clearInterval(TL.timer); TL.timer = setInterval(() => { if (TL.on && TL.mode === 'screen') tlCapture(true); }, 1000);
}
function tlStopScreen() {
  clearInterval(TL.timer); TL.timer = 0;
  if (TL.stream) TL.stream.getTracks().forEach(t => t.stop());
  TL.stream = null; TL.video = null;
}
async function tlSetMode(mode) {
  if (mode === 'screen') {
    try { if (!TL.stream) await tlStartScreen(); }
    catch (e) { toast(e.name === 'NotAllowedError' ? 'Screen recording was not allowed' : e.message); mode = 'view'; }
  } else tlStopScreen();
  TL.mode = mode; tlPrefsSave(); tlUpdateBtn(); tlCapture(true);
  const sel = $('#tlMode'); if (sel) sel.value = mode;
}
function tlSetOn(on) {
  TL.on = !!on; tlPrefsSave();
  if (TL.on) tlCapture(true);
  else if (TL.mode === 'screen') tlStopScreen();
  tlUpdateBtn();
}
function tlUpdateBtn() {
  const b = $('#tlBtn'); if (!b) return;
  b.querySelector('.lbl').textContent = (TL.on ? '● REC ' : '○ ') + 'Time-lapse ' + TL.frames.length;
  b.classList.toggle('rec', TL.on);
  b.title = TL.on ? 'Time-lapse is recording (' + ({ canvas: 'canvas only', view: 'workspace view', screen: 'whole screen' })[TL.mode] + '). Click to stop, ▾ for options / export.' : 'Time-lapse is off. Click to record, ▾ for options / export.';
}
function tlReset() { TL.gen++; TL.frames = []; clearTimeout(TL.vt); clearTimeout(TL.trail); tlUpdateBtn(); }
/* resolves once pending snapshots are stored (used by save and tests) */
async function tlIdle() { await new Promise(r => setTimeout(r, 450)); await tlFlush(); }
/* a pending snapshot is taken now instead of waiting for a pause (export / tests) */
async function tlFlush() { TL.hurry = true; try { await TL.chain; } finally { TL.hurry = false; } }

/* ---- per-document storage (inside the .sketchforge file) ---- */
async function tlSerialize(frames) {
  if (!TL.keep) return null;
  if (!frames) frames = TL.frames.slice(); // saving never waits for a snapshot that is waiting for a pause (it joins the next save)
  if (!frames || !frames.length) return null;
  const toURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  // each snapshot is encoded once (the session autosave serialises often)
  return { mode: TL.mode, frames: await Promise.all(frames.map(async f => ({ w: f.w, h: f.h, d: f.d || (f.d = await toURL(f.b)) }))) };
}
async function tlRestore(data) {
  tlReset();
  if (!data || !Array.isArray(data.frames)) return;
  TL.restoring = true; // no live snapshots may slip in between the restored ones
  const out = [];
  for (const f of data.frames) {
    try { const b = await (await fetch(f.d)).blob(); out.push({ b, w: f.w, h: f.h }); } catch (e) { /* skip a broken frame */ }
  }
  TL.frames = out; TL.restoring = false; clearTimeout(TL.vt); clearTimeout(TL.trail);
  tlUpdateBtn();
}

/* ---- export ---- */
async function tlExport(seconds, prog) {
  if (!window.MediaRecorder) throw new Error('Video recording is not supported in this browser');
  await tlFlush();
  const all = TL.frames;
  if (all.length < 2) throw new Error('Nothing recorded yet — draw something first');
  const fps = 30, want = Math.max(2, Math.round(seconds * fps));
  const n = Math.min(all.length, want);
  const pick = i => all[Math.round(i * (all.length - 1) / (n - 1))];
  const delay = seconds * 1000 / n;
  // output size = the largest snapshot; every snapshot is letterboxed into it (window size or mode may have changed)
  const w = Math.max(...all.map(f => f.w)), h = Math.max(...all.map(f => f.h));
  const cv = makeCanvas(w, h), g = cv.getContext('2d');
  const stream = cv.captureStream(0), track = stream.getVideoTracks()[0];
  const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 });
  const chunks = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise(r => { rec.onstop = r; });
  rec.start();
  const frame = async fr => {
    const bm = await createImageBitmap(fr.b), k = Math.min(w / fr.w, h / fr.h), dw = fr.w * k, dh = fr.h * k;
    g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.drawImage(bm, (w - dw) / 2, (h - dh) / 2, dw, dh); bm.close && bm.close(); track.requestFrame();
  };
  for (let i = 0; i < n; i++) {
    await frame(pick(i)); prog.textContent = `Recording ${i + 1} / ${n}`;
    await new Promise(r => setTimeout(r, Math.max(8, delay)));
  }
  for (let i = 0; i < 20; i++) { await frame(all[all.length - 1]); await new Promise(r => setTimeout(r, 50)); } // hold final image 1 s
  rec.stop(); await done;
  download(new Blob(chunks, { type: mime.split(';')[0] }), (state.name || 'Untitled').replace(/[^\w\- ]+/g, '_') + '_timelapse.' + ext);
  return ext;
}

/* ---- dialog ---- */
function openTimelapse() {
  let d = $('#tlDialog');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'tlDialog'; d.className = 'csdlg';
    d.innerHTML = `<form method="dialog"><h5>Time-lapse</h5>
      <p class="muted small" id="tlInfo" style="margin:0 0 8px"></p>
      <label style="grid-template-columns:96px 1fr"><span>Recording</span><span><input type="checkbox" id="tlOn"> record while I draw</span></label>
      <label style="grid-template-columns:96px 1fr"><span>Record</span><select id="tlMode">
        <option value="view">Workspace view — zoom, rotation, tool, cursor</option>
        <option value="screen">Whole screen (asks permission)</option>
        <option value="canvas">Canvas only</option></select></label>
      <p class="muted small" id="tlModeHint" style="margin:2px 0 8px"></p>
      <label style="grid-template-columns:96px 1fr"><span>File</span><span><input type="checkbox" id="tlKeep"> keep this time-lapse inside the saved .sketchforge file</span></label>
      <label><span>Video length</span><input type="range" id="tlSecs" min="3" max="60" value="15"><output id="tlSecsV">15 s</output></label>
      <p class="muted small" id="tlProg" style="min-height:1.2em"></p>
      <div class="dialog-actions"><button type="button" id="tlClear">Clear</button><button type="button" id="tlClose">Close</button><button type="button" id="tlGo" class="primary">Export video</button></div></form>`;
    document.body.appendChild(d);
    $('#tlSecs').oninput = () => $('#tlSecsV').textContent = $('#tlSecs').value + ' s';
    $('#tlOn').onchange = e => tlSetOn(e.target.checked);
    $('#tlMode').onchange = async e => { await tlSetMode(e.target.value); tlDlgInfo(); };
    $('#tlKeep').onchange = e => { TL.keep = e.target.checked; tlPrefsSave(); };
    $('#tlClear').onclick = () => { if (confirm('Delete the recorded time-lapse of this file?')) { tlReset(); tlDlgInfo(); $('#tlInfo').textContent = 'Cleared.'; } };
    $('#tlClose').onclick = () => d.close();
    $('#tlGo').onclick = async () => {
      $('#tlGo').disabled = true; exporting = true;
      try { const ext = await tlExport(+$('#tlSecs').value, $('#tlProg')); $('#tlProg').textContent = 'Done — saved as .' + ext; }
      catch (e) { $('#tlProg').textContent = e.message; }
      exporting = false; $('#tlGo').disabled = false;
    };
  }
  $('#tlOn').checked = TL.on; $('#tlKeep').checked = TL.keep; $('#tlMode').value = TL.mode; $('#tlProg').textContent = '';
  $('#tlMode').querySelector('[value=screen]').disabled = !tlScreenSupported();
  tlDlgInfo();
  d.showModal();
}
function tlDlgInfo() {
  const i = $('#tlInfo'); if (!i) return;
  i.textContent = `"${state.name}": ${TL.frames.length} snapshots (one per stroke / edit${TL.mode !== 'canvas' ? ', zoom, rotation and tool change' : ''}, up to ${TL.max}). Each file has its own time-lapse.`;
  $('#tlModeHint').textContent = TL.mode === 'screen' ? 'Records the real screen (menus, panels, everything) once a second and after each edit. Stop sharing to switch back to Workspace view.'
    : TL.mode === 'view' ? 'Records the canvas as you see it — zoom, pan, rotation — with the cursor, current tool, brush size and colour.'
    : 'Records only the picture, always upright and full size.';
  if (!tlScreenSupported()) $('#tlModeHint').textContent += ' (Whole screen is not available on this device.)';
}
function installTimelapse() {
  tlPrefsLoad();
  CMD.timelapse = openTimelapse;
  CMD.tlToggle = () => { tlSetOn(!TL.on); toast('Time-lapse recording ' + (TL.on ? 'on' : 'off')); };
  MENUS[0][1].push('-', ['Time-lapse…', 'timelapse'], ['Time-lapse recording on / off', 'tlToggle']);
  const b = document.createElement('button'); b.id = 'tlBtn';
  b.innerHTML = '<span class="lbl"></span><span class="caret">▾</span>';
  b.onclick = e => { if (e.target.classList.contains('caret')) openTimelapse(); else CMD.tlToggle(); };
  $('#cmdbar').insertBefore(b, $('#pageBar') || null);
  viewport.addEventListener('pointermove', e => { const r = vpRect(); TL.cursor = { x: e.clientX - r.left, y: e.clientY - r.top }; }, { passive: true });
  viewport.addEventListener('pointerleave', () => { TL.cursor = null; });
  tlUpdateBtn(); buildMenus();
  setTimeout(() => tlCapture(true), 500);
}
