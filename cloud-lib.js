/* Sketchforge cloud client: sign-in (Google / GitHub), cloud files, settings, shared brushes & themes,
   talking to Supabase's REST endpoints directly (no library). Used by the app and by the website. Settings in
   cloud-config.js (window.SF_CLOUD). The session is kept in localStorage 'sketchforge.auth.v1'. */
(function () {
  const C = window.SF_CLOUD || {};
  const base = (C.supabaseUrl || '').replace(/\/+$/, ''), key = C.supabaseAnonKey || '';
  const SKEY = 'sketchforge.auth.v1';
  const SB = { ready: !!(base && key), site: (C.site || '').replace(/\/+$/, '') };
  let sess = null;
  try { sess = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { /* ignore */ }
  const now = () => Math.floor(Date.now() / 1000);
  function save(s) {
    sess = s;
    try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) { /* ignore */ }
    window.dispatchEvent(new CustomEvent('sf-auth', { detail: SB.user() }));
  }
  const need = () => { if (!SB.ready) throw new Error('Online features are not set up in this copy of Sketchforge yet.'); };
  async function raw(path, { method = 'GET', body, token, headers = {}, type = 'json' } = {}) {
    need();
    const h = { apikey: key, Authorization: 'Bearer ' + (token || key), ...headers };
    let data = body;
    if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer) && typeof body !== 'string') { h['content-type'] = 'application/json'; data = JSON.stringify(body); }
    const r = await fetch(base + path, { method, headers: h, body: data });
    if (!r.ok) {
      let msg = r.status + ' ' + r.statusText;
      try { const j = await r.json(); msg = j.error_description || j.message || j.msg || j.error || msg; } catch (e) { /* not json */ }
      const err = new Error(msg); err.status = r.status; throw err;
    }
    if (type === 'blob') return r.blob();
    const t = await r.text();
    try { return t ? JSON.parse(t) : null; } catch (e) { return t; }
  }
  const sessFrom = (j, user) => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: now() + (+j.expires_in || 3600), user: user || j.user || null });
  async function refresh() {
    if (!sess || !sess.refresh_token) throw new Error('Not signed in');
    try {
      const j = await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh_token } });
      save(sessFrom(j));
    } catch (e) { if (e.status && e.status < 500) save(null); throw new Error('Your session ended — please sign in again.'); }
  }
  SB.token = async () => { if (!sess) return null; if ((sess.expires_at || 0) - 60 < now()) await refresh(); return sess && sess.access_token; };
  const authed = async (path, opts = {}) => { const t = await SB.token(); if (!t) throw new Error('Please sign in first.'); return raw(path, { ...opts, token: t }); };

  /* who */
  SB.user = () => (sess && sess.user) || null;
  SB.profile = () => {
    const u = SB.user(); if (!u) return null;
    const m = u.user_metadata || {};
    return { id: u.id, email: u.email || '', name: m.full_name || m.name || m.user_name || (u.email || '').split('@')[0], avatar: m.avatar_url || m.picture || '', provider: (u.app_metadata || {}).provider || '' };
  };
  /* sign in: browsers go to the provider and come back with the session in the URL (#access_token=…) */
  SB.authorizeUrl = (provider, redirectTo) => `${base}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}`;
  SB.sessionFromHash = async (hash) => {
    const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    if (p.get('error_description')) throw new Error(p.get('error_description'));
    if (!p.get('access_token')) return null;
    const j = { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in') };
    const user = await raw('/auth/v1/user', { token: j.access_token });
    return sessFrom(j, user);
  };
  SB.useSession = s => save(s);
  SB.signInWithRefresh = async rt => { sess = { refresh_token: rt, expires_at: 0 }; await refresh(); const u = await raw('/auth/v1/user', { token: sess.access_token }); save({ ...sess, user: u }); return SB.profile(); };
  SB.signOut = async () => { try { const t = await SB.token(); if (t) await raw('/auth/v1/logout', { method: 'POST', token: t }); } catch (e) { /* ignore */ } save(null); };
  /* installed apps: a secret code links this app to a sign-in done on the website */
  SB.newLinkCode = () => { const b = new Uint8Array(24); crypto.getRandomValues(b); return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); };
  SB.handOver = async (code, s) => raw('/rest/v1/device_links', { method: 'POST', token: s.access_token, body: { id: code, refresh_token: s.refresh_token }, headers: { Prefer: 'return=minimal' } });
  SB.claim = async code => raw('/rest/v1/rpc/claim_device_link', { method: 'POST', body: { link_id: code } });

  /* data */
  SB.rest = (path, opts) => authed('/rest/v1/' + path, opts);
  SB.restPublic = (path, opts) => raw('/rest/v1/' + path, opts);
  SB.rpc = (fn, args) => raw('/rest/v1/rpc/' + fn, { method: 'POST', body: args || {} });
  SB.upload = (bucket, path, blob, contentType) => authed(`/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`,
    { method: 'POST', body: blob, headers: { 'x-upsert': 'true', 'content-type': contentType || blob.type || 'application/octet-stream' } });
  SB.list = (bucket, prefix) => authed(`/storage/v1/object/list/${bucket}`, { method: 'POST', body: { prefix, limit: 200, offset: 0, sortBy: { column: 'updated_at', order: 'desc' } } });
  SB.download = (bucket, path) => authed(`/storage/v1/object/authenticated/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, { type: 'blob' });
  SB.publicUrl = (bucket, path) => `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  SB.remove = (bucket, paths) => authed(`/storage/v1/object/${bucket}`, { method: 'DELETE', body: { prefixes: paths } });
  window.SFSB = SB;
})();
