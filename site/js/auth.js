'use strict';
/* ---------- passkey sign-in + API (Cloudflare Worker) ----------
   The app boots behind #gate. Sync starts once AUTH.ready resolves (signed in). */
const AUTH = (() => {
  const API = String(window.API_BASE || '').replace(/\/$/, '');
  const WA = window.SimpleWebAuthnBrowser;
  const KEY = '3000.token';
  let token = null, resolveReady;
  try { token = localStorage.getItem(KEY); } catch (e) {}
  const ready = new Promise(r => { resolveReady = r; });
  try { history.scrollRestoration = 'manual'; } catch (e) {}

  function keep(t) { token = t; try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (e) {} }

  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try { res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { const err = new Error('offline'); err.code = 'unavailable'; throw err; }
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || 'http_' + res.status);
      err.status = res.status; err.code = res.status === 401 ? 'signed_out' : res.status >= 500 ? 'unavailable' : 'invalid_argument';
      if (res.status === 401 && token) { keep(null); location.reload(); }
      throw err;
    }
    return data;
  }

  const MSG = {
    closed: 'Ya hay una passkey en esta cuenta',
    unknown_passkey: 'Esa passkey ya no existe',
    not_verified: 'No se pudo verificar',
    offline: 'Sin conexión',
  };
  function fail(e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return;
    if (e && (e.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || e.name === 'InvalidStateError')) { gateMsg('Este dispositivo ya tiene la passkey'); return; }
    gateMsg(MSG[e && e.message] || 'Sin conexión');
  }

  // Portrait screens crop the painting to fill; wider ones show it whole, with the landscape extended sideways.
  function fitArt() {
    const a = document.getElementById('gArt');
    if (a) a.setAttribute('preserveAspectRatio', innerWidth / innerHeight > 0.6 ? 'xMidYMid meet' : 'xMidYMid slice');
  }
  addEventListener('resize', () => { fitArt(); placeLens(); }); fitArt();

  /* Liquid glass: the lens is drawn inside the painting, right under the visible button.
     A displacement map bends the landscape near the rim (stronger toward the edge, like a thick
     glass lip) and the three colour channels bend by slightly different amounts, which gives the
     thin rainbow fringe at the edge. */
  let mapKey = '';
  function lensMap(w, h) {
    const k = w + 'x' + h; if (k === mapKey) return null; mapKey = k;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    const r = h / 2, edge = h * 0.42;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = Math.min(Math.max(x + .5, r), w - r), vx = x + .5 - cx, vy = y + .5 - r, len = Math.hypot(vx, vy) || 1;
      const inside = r - len;                                   // distance from the rim, px
      const t = Math.max(0, Math.min(1, 1 - inside / edge));     // 1 at the rim, 0 in the flat middle
      const m = t * t * (3 - 2 * t);                             // smooth falloff
      const i = (y * w + x) * 4;
      d[i] = 128 - (vx / len) * m * 127;                         // sample toward the middle: rim magnifies
      d[i + 1] = 128 - (vy / len) * m * 127;
      d[i + 2] = 128; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }
  function placeLens() {
    const art = document.getElementById('gArt'), lens = document.getElementById('gLens'), g = document.getElementById('gate');
    if (!art || !lens || !g) return;
    const btn = g.dataset.view === 'new' ? document.getElementById('gateCreate') : g.dataset.view === 'signin' ? document.getElementById('gateLogin') : null;
    const br = btn && btn.getBoundingClientRect();
    if (!br || !br.width) { lens.style.display = 'none'; return; }
    const m = art.getScreenCTM(); if (!m) return;
    const inv = m.inverse(), pt = art.createSVGPoint();
    pt.x = br.left; pt.y = br.top; const a = pt.matrixTransform(inv);
    pt.x = br.right; pt.y = br.bottom; const b = pt.matrixTransform(inv);
    const x = a.x, y = a.y, w = b.x - a.x, h = b.y - a.y, rx = h / 2, set = (id, o) => { const el = document.getElementById(id); for (const k in o) el.setAttribute(k, o[k]); };
    const box = {x, y, width: w, height: h, rx};
    set('gLensClipR', box); set('gLensVeil', box); set('gLensGlow', box); set('gLensRim', box);
    set('gLensShadow', {x: x + w * .04, y: y + h * .18, width: w * .92, height: h, rx});
    set('gLensF', {x: x - 2, y: y - 2, width: w + 4, height: h + 4});
    const url = lensMap(Math.round(br.width * 2), Math.round(br.height * 2));
    set('gLensMap', Object.assign({x, y, width: w, height: h}, url ? {href: url} : {}));
    const cx = x + w / 2, cy = y + h / 2;   // slight overall magnification, like looking through a thick pane
    set('gLensUse', {transform: `translate(${cx} ${cy}) scale(1.05) translate(${-cx} ${-cy})`});
    lens.style.display = '';
  }
  ['gateCreate', 'gateLogin'].forEach(id => {
    const b = document.getElementById(id); if (!b) return;
    const on = () => document.getElementById('gLens').classList.add('press'), off = () => document.getElementById('gLens').classList.remove('press');
    b.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => b.addEventListener(e, off));
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeLens);

  function gate(view) {
    const g = document.getElementById('gate');
    if (!g) return;
    g.dataset.view = view || '';
    document.documentElement.classList.toggle('locked', !!view);
    if (view) window.scrollTo(0, 0);
    requestAnimationFrame(placeLens);
  }
  function gateMsg(t) { const m = document.getElementById('gateMsg'); if (m) { m.textContent = t; m.classList.add('on'); clearTimeout(gateMsg.t); gateMsg.t = setTimeout(() => m.classList.remove('on'), 3000); } }

  async function register(signedIn) {
    const optionsJSON = await api('/api/register/options', { method: 'POST', body: {} });
    const att = await WA.startRegistration({ optionsJSON });
    const r = await api('/api/register/verify', { method: 'POST', body: att });
    if (!signedIn) keep(r.token);
  }
  async function login() {
    const optionsJSON = await api('/api/login/options', { method: 'POST', body: {} });
    const asr = await WA.startAuthentication({ optionsJSON });
    const r = await api('/api/login/verify', { method: 'POST', body: asr });
    keep(r.token);
  }
  function enter() { gate(''); resolveReady(); }

  async function start() {
    if (token) { enter(); return; }   // a stale token is caught by the first API call (401 -> back to the gate)
    gate('loading');
    for (;;) {
      try { const s = await api('/api/status'); gate(s.registered ? 'signin' : 'new'); return; }
      catch (e) { gateMsg('Sin conexión'); await new Promise(r => setTimeout(r, 4000)); }
    }
  }

  function wire() {
    const busy = (btn, fn) => async () => {
      btn.disabled = true;
      try { await fn(); } catch (e) { fail(e); } finally { btn.disabled = false; }
    };
    const c = document.getElementById('gateCreate'), l = document.getElementById('gateLogin');
    c.addEventListener('click', busy(c, async () => {
      if (!WA.browserSupportsWebAuthn()) { gateMsg('Este navegador no admite passkeys'); return; }
      await register(false); enter();
    }));
    l.addEventListener('click', busy(l, async () => { await login(); enter(); }));
    const out = document.getElementById('acctOut'), add = document.getElementById('acctAdd'), n = document.getElementById('acctN');
    const count = () => passkeys().then(k => { if (n) n.textContent = k; }).catch(() => {});
    if (out) out.addEventListener('click', logout);
    if (add) add.addEventListener('click', async () => {
      add.disabled = true;
      try { await addPasskey(); await count(); if (typeof toast === 'function') toast('Passkey añadida'); }
      catch (e) {
        if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) {}
        else if (typeof toast === 'function') toast(e && (e.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || e.name === 'InvalidStateError') ? 'Este dispositivo ya tiene la passkey' : 'No se pudo añadir');
      } finally { add.disabled = false; }
    });
    ready.then(count);
  }

  // Log out: push any unsaved progress first, then remove this device's copy so nothing is left to see.
  async function logout() {
    try {
      if (typeof store !== 'undefined' && store.mode === 'db') {
        clearTimeout(store.timer); flush();
        await Promise.race([store.writing || Promise.resolve(), new Promise(r => setTimeout(r, 4000))]);
      }
    } catch (e) {}
    try { await api('/api/logout', { method: 'POST', body: {} }); } catch (e) {}
    keep(null);
    try { localStorage.removeItem('g3000.state.v1'); } catch (e) {}
    window.scrollTo(0, 0); location.replace(location.pathname);
  }
  async function addPasskey() { await register(true); }
  async function passkeys() { return (await api('/api/me')).passkeys.length; }

  return { api, ready, start, wire, logout, addPasskey, passkeys, fail, get signedIn() { return !!token; } };
})();
