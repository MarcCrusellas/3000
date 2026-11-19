'use strict';
const API = String(window.API_BASE || '').replace(/\/$/, '');
const WA = window.SimpleWebAuthnBrowser;
const TKEY = '3000.token';
const $ = s => document.querySelector(s);
const app = $('#app');

let token = load();
let count = 0, saveTimer = null;

function load() { try { return localStorage.getItem(TKEY); } catch (e) { return null; } }
function keep(t) { token = t; try { t ? localStorage.setItem(TKEY, t) : localStorage.removeItem(TKEY); } catch (e) {} }
function show(v) { app.dataset.view = v; }

let toastT;
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) { const err = new Error((data && data.error) || 'http_' + res.status); err.status = res.status; throw err; }
  return data;
}

const MSG = {
  closed: 'Ya hay una passkey en esta cuenta',
  unknown_passkey: 'Esa passkey ya no existe',
  not_verified: 'No se pudo verificar',
  signed_out: 'Sesión caducada',
};
function fail(e) {
  if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return; // cancelled in the system sheet
  if (e && (e.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || e.name === 'InvalidStateError')) return toast('Este dispositivo ya tiene la passkey');
  toast(MSG[e && e.message] || 'Sin conexión', true);
}

/* ---------- start ---------- */
async function boot() {
  show('loading');
  try {
    if (token) {
      try { await home(); return; }
      catch (e) { if (e.status === 401) keep(null); else throw e; }
    }
    const s = await api('/api/status');
    show(s.registered ? 'signin' : 'new');
  } catch (e) {
    fail(e);
    setTimeout(boot, 4000);
  }
}

async function home() {
  const [me, st] = await Promise.all([api('/api/me'), api('/api/state')]);
  $('#nKeys').textContent = me.passkeys.length;
  $('#since').textContent = me.since ? new Date(me.since).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
  count = (st.state && st.state.count) || 0;
  $('#count').textContent = count;
  show('home');
}

/* ---------- passkeys ---------- */
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

function busy(btn, fn) {
  return async () => {
    btn.disabled = true;
    try { await fn(); } catch (e) { fail(e); } finally { btn.disabled = false; }
  };
}

$('#createBtn').addEventListener('click', busy($('#createBtn'), async () => {
  if (!WA.browserSupportsWebAuthn()) return toast('Este navegador no admite passkeys', true);
  await register(false); await home();
}));
$('#loginBtn').addEventListener('click', busy($('#loginBtn'), async () => { await login(); await home(); }));
$('#addKeyBtn').addEventListener('click', busy($('#addKeyBtn'), async () => {
  await register(true); await home(); toast('Passkey añadida');
}));
$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST', body: {} }); } catch (e) {}
  keep(null); boot();
});

/* ---------- synced counter (the state test) ---------- */
$('#incBtn').addEventListener('click', () => {
  count++; $('#count').textContent = count;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    api('/api/state', { method: 'PUT', body: { state: { count } } }).catch(fail);
  }, 400);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && app.dataset.view === 'home' && !saveTimer) home().catch(() => {});
});

boot();
