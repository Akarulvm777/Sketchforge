/* ---------- Core helpers shared by every module ----------
   • hookAfter(name, fn, order): run fn after the core function `name` (listed in HOOKABLE) (fn(out, args)). Modules add behaviour to core
     functions (refreshStage, refreshProps, renderTimeline, saveDocument…) through hooks instead of replacing them:
     one wrapper per function, hooks run in `order` (then registration order), a hook that throws is logged and the
     others still run, and an async function's hooks run once its promise resolves. Replacing a core function by hand
     (`x = function () { … x0() … }`) is kept only where a module must change the arguments or skip the original.
   • prefs: the app's settings in localStorage ('sketchforge.' + key), never throwing (private windows, blocked storage).
   • escHtml: text → safe HTML. */
const HOOKS = Object.create(null);
/* the functions modules may hook (the app runs in one shared scope, so each needs a getter / setter here; the
   function declarations are visible everywhere in that scope) */
const HOOKABLE = {
  refreshStage: [() => refreshStage, f => { refreshStage = f; }],
  refreshProps: [() => refreshProps, f => { refreshProps = f; }],
  refreshAll: [() => refreshAll, f => { refreshAll = f; }],
  renderTimeline: [() => renderTimeline, f => { renderTimeline = f; }],
  setMode: [() => setMode, f => { setMode = f; }],
  gotoFrame: [() => gotoFrame, f => { gotoFrame = f; }],
  markDirty: [() => markDirty, f => { markDirty = f; }],
  saveDocument: [() => saveDocument, f => { saveDocument = f; }],
  render3D: [() => render3D, f => { render3D = f; }],
  setPoseOnCanvas: [() => setPoseOnCanvas, f => { setPoseOnCanvas = f; }],
  syncLayerControls: [() => syncLayerControls, f => { syncLayerControls = f; }]
};
function hookAfter(name, fn, order = 0) {
  let h = HOOKS[name];
  if (!h) {
    const acc = HOOKABLE[name]; if (!acc) throw new Error('hookAfter: ' + name + ' is not in HOOKABLE');
    const base = acc[0]();
    if (typeof base !== 'function') throw new Error('hookAfter: no function ' + name);
    h = HOOKS[name] = { list: [], seq: 0 };
    const run = (self, out, args) => { for (const x of h.list) { try { x.fn.call(self, out, args); } catch (e) { console.error('hook ' + name + ':', e); } } };
    acc[1](function () {
      const out = base.apply(this, arguments), args = arguments;
      if (out && typeof out.then === 'function') return out.then(v => { run(this, v, args); return v; });
      run(this, out, args); return out;
    });
  }
  h.list.push({ fn, order, i: h.seq++ });
  h.list.sort((a, b) => a.order - b.order || a.i - b.i);
}
const prefs = {
  get(k, d = null) { try { const v = localStorage.getItem('sketchforge.' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('sketchforge.' + k); else localStorage.setItem('sketchforge.' + k, String(v)); } catch (e) { /* storage blocked */ } },
  json(k, d = null) { try { const v = localStorage.getItem('sketchforge.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  setJson(k, v) { try { localStorage.setItem('sketchforge.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
};
const escHtml = s => String(s == null ? '' : s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
