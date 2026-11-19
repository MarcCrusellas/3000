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

  function gate(view) {
    const g = document.getElementById('gate');
    if (!g) return;
    g.dataset.view = view || '';
    document.documentElement.classList.toggle('locked', !!view);
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

  async function logout() {
    try { await api('/api/logout', { method: 'POST', body: {} }); } catch (e) {}
    keep(null); location.reload();
  }
  async function addPasskey() { await register(true); }
  async function passkeys() { return (await api('/api/me')).passkeys.length; }

  return { api, ready, start, wire, logout, addPasskey, passkeys, fail, get signedIn() { return !!token; } };
})();
