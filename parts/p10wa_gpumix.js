/* ---------- Colour-mixing / blend brushes on the graphics card (WebGL2) ----------
   Same maths as smudgeDab (p10w_csfeatures), done by the GPU: the stroke's 256 px tiles (st.mir) get two textures each
   (src + dst, the dab is written to dst then copied back to src), the carried colour is a G×G float texture
   (ping-pong), the tip and the paper texture are textures too. Per dab: one "pick" pass (the layer under the brush,
   per tile, added up), one "carry" pass, one "apply" pass per tile. The CPU only reads the changed tiles back once per
   screen frame (mirFlush, wrapped) to show them, and at the end of the stroke. A big blend brush costs the same as a
   small one. Off: localStorage sketchforge.gpumix.v1 = 'off' (or no WebGL2 / an error → the CPU engine, smudgeDab). */
const GPUMIX = { ok: null, gl: null };
const GM_VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const GM_PICK = `#version 300 es
precision highp float; uniform sampler2D uTile; uniform vec4 uRect; uniform vec3 uDab; uniform float uG, uSub; out vec4 o;
vec4 at(ivec2 q) { ivec2 s = textureSize(uTile, 0); vec4 c = texelFetch(uTile, clamp(q, ivec2(0), s - 1), 0); return vec4(c.rgb * c.a, c.a); }
void main() {
  float cell = uDab.z / uG; vec2 base = uDab.xy + (gl_FragCoord.xy - 0.5) * cell; vec4 sum = vec4(0.0);
  for (float j = 0.0; j < 2.0; j++) for (float i = 0.0; i < 2.0; i++) {
    if (i >= uSub || j >= uSub) continue;
    vec2 p = base + cell * (vec2(i, j) + 0.5) / uSub; // document point
    if (p.x < uRect.x || p.y < uRect.y || p.x >= uRect.x + uRect.z || p.y >= uRect.y + uRect.w) continue; // another tile's part
    vec2 X = p - 0.5 - uRect.xy; ivec2 q = ivec2(floor(X)); vec2 f = X - floor(X);
    sum += mix(mix(at(q), at(q + ivec2(1, 0)), f.x), mix(at(q + ivec2(0, 1)), at(q + ivec2(1, 1)), f.x), f.y);
  }
  o = sum / (uSub * uSub);
}`;
const GM_CARRY = `#version 300 es
precision highp float; uniform sampler2D uPick, uCarry; uniform float uK, uInit; out vec4 o;
void main() { ivec2 q = ivec2(gl_FragCoord.xy); vec4 t = texelFetch(uPick, q, 0), c = texelFetch(uCarry, q, 0); o = uInit > 0.5 ? t : t * uK + c * (1.0 - t.a * uK); }`;
const GM_APPLY = `#version 300 es
precision highp float; uniform sampler2D uSrc, uCarry, uTip, uPaper; uniform vec4 uRect; uniform vec3 uDab, uRGB;
uniform float uStrength, uPaint, uP, uD, uTexOn, uTexK, uTexA, uTexN, uCN, uCS; out vec4 o;
void main() {
  vec4 old = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0); o = old;
  vec2 p = uRect.xy + gl_FragCoord.xy, uv = (p - uDab.xy) / uDab.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return;
  float km = uStrength * texture(uTip, uv).a; if (km <= 0.0005) return;
  if (uTexOn > 0.5) { vec2 tc = mod(floor(p / uTexK), uTexN); km *= 1.0 - uTexA * (1.0 - texelFetch(uPaper, ivec2(tc), 0).r); }
  vec4 c = texture(uCarry, clamp(uv * uCN, vec2(0.5), vec2(uCN - 0.5)) / uCS); float ca = c.a; vec3 cc = ca > 0.0001 ? c.rgb / ca : vec3(0.0); ca = min(1.0, ca);
  float oa = old.a; vec3 oc = old.rgb;
  if (uPaint > 0.5) {
    float wp = (1.0 - uP) * ca, ws = uP + wp; if (ws > 0.0001) cc = (uRGB * uP + cc * wp) / ws; ca = uD * min(1.0, ws);
    float da = km * ca, na = da + oa * (1.0 - da); if (na > 0.0001) oc = (cc * da + oc * oa * (1.0 - da)) / na;
    o = vec4(oc, na); return;
  }
  float keep = 1.0 - km, na = oa * keep + km * ca; if (na > 0.0001) oc = (oc * oa * keep + cc * km * ca) / na;
  o = vec4(oc, na);
}`;
function gpuMixInit() {
  if (GPUMIX.ok !== null) return GPUMIX.ok;
  GPUMIX.ok = false;
  try { if (localStorage.getItem('sketchforge.gpumix.v1') === 'off') return false; } catch (e) { /* no storage */ }
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const gl = cv.getContext('webgl2', { premultipliedAlpha: false, antialias: false, depth: false, stencil: false, alpha: true });
    if (!gl) return false;
    const fl = gl.getExtension('EXT_color_buffer_float');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, GM_VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; };
    Object.assign(GPUMIX, { gl, cv, pick: prog(GM_PICK), carry: prog(GM_CARRY), apply: prog(GM_APPLY), vao: gl.createVertexArray(),
      ffmt: fl ? [gl.RGBA16F, gl.HALF_FLOAT] : [gl.RGBA8, gl.UNSIGNED_BYTE], papers: new Map() });
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); GPUMIX.ok = false; });
    GPUMIX.ok = true;
  } catch (e) { console.warn('GPU mixing off:', e && e.message); GPUMIX.ok = false; }
  return GPUMIX.ok;
}
function gmTex(w, h, fmt, data, filter) {
  const gl = GPUMIX.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  const [ifmt, type] = fmt || [gl.RGBA8, gl.UNSIGNED_BYTE];
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, gl.RGBA, type, data || null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function gmFb(tex) { const gl = GPUMIX.gl, f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); return f; }
/* per stroke: tip texture (with mipmaps), carry and pick textures */
function gmStroke(st) {
  if (st.gm) return st.gm;
  const gl = GPUMIX.gl, s = st.s, M = st.sm, G = Math.max(M.G, 8);
  const t0 = s.tipId && customTips.has(s.tipId) ? customTips.get(s.tipId) : getTip('#000000', s.hardness);
  const tip = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tip);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, t0);
  gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const F = GPUMIX.ffmt, mk = n => { const t = gmTex(n, n, F, null, gl.LINEAR); return { t, f: gmFb(t), n }; };
  st.gm = { G, tip, carry: [mk(G), mk(G)], cc: 0, pick: mk(G), pickN: mk(64), init: false, tiles: new Set() };
  return st.gm;
}
function gmTile(st, t) {
  if (t.g) return t.g;
  const gl = GPUMIX.gl, a = gmTex(t.w, t.h, null, t.im), b = gmTex(t.w, t.h, null, t.im);
  t.g = { src: a, dst: b, fs: gmFb(a), fd: gmFb(b) }; st.gm.tiles.add(t);
  return t.g;
}
function gmPaper(id) {
  let t = GPUMIX.papers.get(id); if (t) return t;
  const gl = GPUMIX.gl, v = texBaseFor(id)._vals, N = TEX_N, d = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) d[i * 4] = clamp(v[i], 0, 1) * 255;
  t = gmTex(N, N, null, d); GPUMIX.papers.set(id, t); return t;
}
/* one dab on the GPU; false = not handled (CPU engine) */
function gpuDab(st, sx, sy, d, o) {
  if (st.gpu === false) return false;
  if (st.gpu === undefined) { st.gpu = gpuMixInit(); if (!st.gpu) return false; }
  try {
    const gl = GPUMIX.gl, g = gmStroke(st), cv = st.t.ctx.canvas;
    const bx0 = Math.max(0, Math.floor(sx)), by0 = Math.max(0, Math.floor(sy)), bx1 = Math.min(cv.width, Math.ceil(sx + d) + 1), by1 = Math.min(cv.height, Math.ceil(sy + d) + 1);
    if (bx1 <= bx0 || by1 <= by0) return true;
    const tiles = [];
    for (let ty = Math.floor(by0 / MIR_T); ty * MIR_T < by1; ty++) for (let tx = Math.floor(bx0 / MIR_T); tx * MIR_T < bx1; tx++) { const t = mirTile(st, tx, ty); gmTile(st, t); tiles.push(t); }
    gl.bindVertexArray(GPUMIX.vao); gl.disable(gl.SCISSOR_TEST);
    // 1. pick: the layer under the brush, at G×G (blur: n×n), added up over the tiles
    const n = o.blur ? clamp(Math.round(d / 7), 3, 64) : g.G, pk = o.blur ? g.pickN : g.pick;
    gl.bindFramebuffer(gl.FRAMEBUFFER, pk.f); gl.viewport(0, 0, n, n); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const P = GPUMIX.pick; gl.useProgram(P.p); gl.uniform3f(P.u.uDab, sx, sy, d); gl.uniform1f(P.u.uG, n); gl.uniform1f(P.u.uSub, d / n > 3 || o.blur ? 2 : 1); gl.uniform1i(P.u.uTile, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (const t of tiles) { gl.bindTexture(gl.TEXTURE_2D, t.g.src); gl.uniform4f(P.u.uRect, t.x, t.y, t.w, t.h); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    gl.disable(gl.BLEND);
    // 2. carry: the brush keeps part of the colour it already had
    let carryTex = pk.t;
    if (!o.blur) {
      const C = GPUMIX.carry, cur = g.carry[g.cc], nx = g.carry[1 - g.cc];
      gl.bindFramebuffer(gl.FRAMEBUFFER, nx.f); gl.viewport(0, 0, g.G, g.G); gl.useProgram(C.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.pick.t); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cur.t);
      gl.uniform1i(C.u.uPick, 0); gl.uniform1i(C.u.uCarry, 1); gl.uniform1f(C.u.uK, 1 - o.smudge); gl.uniform1f(C.u.uInit, g.init ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3); g.cc = 1 - g.cc; g.init = true; carryTex = nx.t;
    }
    // 3. apply: through the tip, on every tile under the dab (written to dst, copied back to src)
    const A = GPUMIX.apply; gl.useProgram(A.p);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, carryTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, g.tip);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, o.tex ? gmPaper(o.tex) : g.tip);
    gl.uniform1i(A.u.uSrc, 0); gl.uniform1i(A.u.uCarry, 1); gl.uniform1i(A.u.uTip, 2); gl.uniform1i(A.u.uPaper, 3);
    gl.uniform3f(A.u.uDab, sx, sy, d); gl.uniform3f(A.u.uRGB, o.rgb[0] / 255, o.rgb[1] / 255, o.rgb[2] / 255);
    gl.uniform1f(A.u.uStrength, o.strength); gl.uniform1f(A.u.uPaint, o.paint ? 1 : 0); gl.uniform1f(A.u.uP, o.P); gl.uniform1f(A.u.uD, o.D);
    gl.uniform1f(A.u.uCN, n); gl.uniform1f(A.u.uCS, o.blur ? 64 : g.G); gl.uniform1f(A.u.uTexOn, o.tex ? 1 : 0); gl.uniform1f(A.u.uTexK, o.tk || 1); gl.uniform1f(A.u.uTexA, o.tA || 0); gl.uniform1f(A.u.uTexN, o.tN || 256);
    gl.enable(gl.SCISSOR_TEST);
    for (const t of tiles) {
      const ax = Math.max(bx0, t.x), ay = Math.max(by0, t.y), ex = Math.min(bx1, t.x + t.w), ey = Math.min(by1, t.y + t.h); if (ex <= ax || ey <= ay) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.g.fd); gl.viewport(0, 0, t.w, t.h); gl.scissor(ax - t.x, ay - t.y, ex - ax, ey - ay);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.g.src); gl.uniform4f(A.u.uRect, t.x, t.y, t.w, t.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.g.fd); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, t.g.fs);
      gl.blitFramebuffer(ax - t.x, ay - t.y, ex - t.x, ey - t.y, ax - t.x, ay - t.y, ex - t.x, ey - t.y, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      t.gdirty = true;
    }
    gl.disable(gl.SCISSOR_TEST);
    if (!st.mirRaf) st.mirRaf = requestAnimationFrame(() => { st.mirRaf = 0; mirFlush(st); });
    return true;
  } catch (e) { console.warn('GPU mixing failed, back to the CPU engine:', e && e.message); gmReadback(st); st.gpu = false; GPUMIX.ok = false; return false; }
}
/* changed tiles → their CPU copy (t.im), then mirFlush shows / writes them as usual */
function gmReadback(st) {
  if (!st || !st.gm || !GPUMIX.gl) return;
  const gl = GPUMIX.gl;
  for (const t of st.gm.tiles) if (t.gdirty) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.g.fs);
    gl.readPixels(0, 0, t.w, t.h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(t.im.data.buffer, t.im.data.byteOffset, t.im.data.byteLength));
    t.d0 = [t.x, t.y, t.x + t.w, t.y + t.h]; t.gdirty = false;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function gmFree(st) {
  if (!st || !st.gm || !GPUMIX.gl) return;
  const gl = GPUMIX.gl, g = st.gm;
  for (const t of g.tiles) { gl.deleteTexture(t.g.src); gl.deleteTexture(t.g.dst); gl.deleteFramebuffer(t.g.fs); gl.deleteFramebuffer(t.g.fd); t.g = null; }
  for (const x of [...g.carry, g.pick, g.pickN]) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); }
  gl.deleteTexture(g.tip); st.gm = null;
}
function installGpuMix() {
  CMD.toggleGpuMix = () => {
    let off = false; try { off = localStorage.getItem('sketchforge.gpumix.v1') === 'off'; localStorage.setItem('sketchforge.gpumix.v1', off ? 'on' : 'off'); } catch (e) { /* no storage */ }
    GPUMIX.ok = null; const on = off && gpuMixInit();
    toast(on ? 'Blend and colour-mixing brushes now use the graphics card (faster, smoother on big pages).' : off ? 'This device cannot use the graphics card for mixing brushes; they stay on the processor.' : 'Blend and colour-mixing brushes now use the processor (turn the graphics card back on in View).', 4500);
  };
  const V = MENUS.find(m => m[0] === 'View'); if (V) V[1].push(['Graphics card for blend / mixing brushes (on / off)', 'toggleGpuMix']);
  const f0 = mirFlush; mirFlush = function (st) { if (st && st.gm) gmReadback(st); return f0.apply(this, arguments); };
  const e0 = mirFinish; mirFinish = function (st) { const out = e0.apply(this, arguments); gmFree(st); return out; };
}
