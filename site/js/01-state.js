'use strict';
/* ---------- state + sync ---------- */
function defaults() {
  return {v: 4, sel: [], skip: {}, known: {}, bag: {}, extra: {}, flag: {}, prog: {}, set: {daily: 10, hist: true, theme: '', nd: 2, cap: 6, lt: true, rs: 10, cd: true}, log: {}, updated: 0};
}
let S = defaults();
function syncSel() {
  for (const f of ['log', 'bag', 'extra', 'known', 'prog', 'skip', 'flag']) if (!S[f] || typeof S[f] !== 'object') S[f] = {};
  if (!Array.isArray(S.sel)) S.sel = [];
  const t = today();
  for (const k in S.known) if (!S.bag[k]) S.bag[k] = {b: 1, due: t, iv: 0};
  for (const k in S.bag) if (!S.known[k]) S.known[k] = t;
  if (!S.v || S.v < 4) S.v = 4; delete S.checkAll;
  S.set = Object.assign(defaults().set, S.set); if (S.v < 5) S.v = 5; delete S.round; SEL = new Set(S.sel);
  if (S.v < 6) {
    for (const k in S.prog) { const p = S.prog[k]; if (!p.td && p.d && p.d.length === 1 && p.d[0] === t) { p.td = t; p.tn = p.h; } }
    if (!S.set.order || S.set.order === 'es') S.set.order = 'auto';
    if (S.set.daily == null) S.set.daily = 10;
    if (!S.auto) S.auto = t;
    S.v = 6;
  }
  if (!Array.isArray(S.groups) || !S.groups.length) { S.groups = initGroups(S.set); S.listen = S.groups[0].id; }
  if (!S.groups.some(g => g.id === S.listen)) S.listen = S.groups[0].id;
  for (const k of ['pause', 'order', 'slow', 'rev', 'mode', 'word']) delete S.set[k]; /* old player settings, now tracks */
  if (S.v < 7) S.v = 7;
  if (S.v < 8) {
    const t = today(), cur = bagCounts(), sum = [0, 0, 0, 0, 0];
    for (const k in S.known) { const d = S.known[k]; if (typeof d === 'string' && d < t && S.bag[k]) { const L = S.log[d] || (S.log[d] = {h: 0, s: 0, a: 0}); L.bg = L.bg || [0, 0, 0, 0, 0]; L.bg[1]++; sum[1]++; } }
    const L = logDay(); L.bg = cur.map((v, i) => v - sum[i]);
    S.bcPrev = cur; S.v = 8;
  }
}
/* ---------- per-word merge between devices ----------
   Every word (bag, known, prog, extra, skip, selected) and every sentence flag carries a timestamp in S.mt,
   set when it changes. When two copies meet, each word comes from the copy that changed it last;
   settings and tracks come from the copy saved last; each day's log from the busier copy. */
const WF = ['bag', 'known', 'prog', 'extra', 'skip'];
let SHADOW = null;
function shadowOf(st) {
  const o = {}, sel = new Set(st.sel || []), keys = new Set(sel);
  for (const f of WF) for (const k in st[f] || {}) keys.add(k);
  for (const k of keys) o[k] = JSON.stringify([...WF.map(f => (st[f] || {})[k]), sel.has(k)]);
  for (const sid in st.flag || {}) o['f:' + sid] = st.flag[sid];
  return o;
}
function stamp() {
  const cur = shadowOf(S), now = Date.now(); S.mt = S.mt || {};
  if (SHADOW) { for (const k in cur) if (SHADOW[k] !== cur[k]) S.mt[k] = now; for (const k in SHADOW) if (!(k in cur)) S.mt[k] = now; }
  SHADOW = cur;
}
function resetShadow() { SHADOW = shadowOf(S); }
function mergeState(a, b) {
  const newer = (b.updated || 0) > (a.updated || 0) ? b : a, out = JSON.parse(JSON.stringify(newer));
  const ma = a.mt || {}, mb = b.mt || {}, keys = new Set([...Object.keys(ma), ...Object.keys(mb)]);
  out.mt = {};
  const sel = new Set(out.sel || []);
  for (const key of keys) {
    const ta = ma[key] || 0, tb = mb[key] || 0, src = ta >= tb ? a : b; out.mt[key] = Math.max(ta, tb);
    if (key.startsWith('f:')) { const sid = key.slice(2), v = (src.flag || {})[sid]; out.flag = out.flag || {}; if (v === undefined) delete out.flag[sid]; else out.flag[sid] = v; continue; }
    for (const f of WF) { const v = (src[f] || {})[key]; out[f] = out[f] || {}; if (v === undefined) delete out[f][key]; else out[f][key] = JSON.parse(JSON.stringify(v)); }
    if ((src.sel || []).includes(key)) sel.add(key); else sel.delete(key);
  }
  out.sel = [...sel];
  const act = L => L ? (L.t || 0) + (L.h || 0) + (L.s || 0) + (L.a || 0) : -1;
  out.log = {};
  for (const d of new Set([...Object.keys(a.log || {}), ...Object.keys(b.log || {})])) {
    const la = (a.log || {})[d], lb = (b.log || {})[d], pick = act(la) >= act(lb) ? la : lb, other = pick === la ? lb : la, x = JSON.parse(JSON.stringify(pick));
    if (other && other.fk) x.fk = [...new Set([...(x.fk || []), ...other.fk])];
    out.log[d] = x;
  }
  out.updated = Math.max(a.updated || 0, b.updated || 0); out.v = Math.max(a.v || 0, b.v || 0);
  return out;
}
function adopt(st) { S = Object.assign(defaults(), st); syncSel(); S.bcPrev = bagCounts(); resetShadow(); saveLocal(); }

const LKEY = 'g3000.state.v1';
function loadLocal() { try { const t = localStorage.getItem(LKEY); if (t) S = Object.assign(defaults(), JSON.parse(t)); } catch (e) {} syncSel(); resetShadow(); }
function saveLocal() { try { localStorage.setItem(LKEY, JSON.stringify(S)); } catch (e) {} }
const store = {ref: null, mode: 'local', writing: null, pending: false, timer: null, seenAt: 0};
function setDot(c) { const d = $('#dot'); if (d) d.className = 'dot ' + (c || ''); const t = $('#syncTxt'); if (t) t.textContent = {ok: 'Guardado en tu cuenta', busy: 'Guardando…', err: 'Sin conexión'}[c] || 'Solo en este dispositivo'; }
function save() {
  S.updated = Date.now();
  if (S.bcPrev) { const c = bagCounts(); if (c.some((v, i) => v !== S.bcPrev[i])) { const L = logDay(); L.bg = L.bg || [0, 0, 0, 0, 0]; c.forEach((v, i) => { L.bg[i] += v - (S.bcPrev[i] || 0); }); S.bcPrev = c; } }
  stamp(); saveLocal();
  if (store.mode !== 'db') return;
  clearTimeout(store.timer); store.timer = setTimeout(flush, 1800);
}
function flush() {
  if (store.writing) { store.pending = true; return; }
  setDot('busy'); stamp();
  store.writing = store.ref.get().then(snap => {
    const d = snap.exists ? snap.data() : null;
    if (d && d.state && (d.at || 0) > store.seenAt) { adopt(mergeState(S, JSON.parse(d.state))); setTimeout(renderAll, 0); }
    const at = S.updated = Math.max(Date.now(), S.updated || 0);
    return store.ref.set({state: JSON.stringify(S), at}).then(() => { store.seenAt = at; });
  })
    .then(() => setDot('ok'))
    .catch(e => { setDot('err'); if (e && e.code === 'invalid_argument') store.mode = 'local'; else if (e && e.code === 'unavailable') store.pending = true; })
    .finally(() => { store.writing = null; if (store.pending) { store.pending = false; setTimeout(flush, 1500); } });
}
/* Sync goes through the 3000 Worker: one JSON document per account, {state, at}.
   Same get/set shape the merge code expects; mergeState() keeps each word's newest change. */
async function initStore() {
  await AUTH.ready;
  store.ref = {
    get: async () => { const r = await AUTH.api('/api/state'); const d = r.state && r.state.state ? r.state : null; return {exists: !!d, data: () => d}; },
    set: obj => AUTH.api('/api/state', {method: 'PUT', body: {state: obj}}),
  };
  try {
    const timer = setTimeout(() => setDot('err'), 10000);
    const snap = await store.ref.get();
    clearTimeout(timer);
    store.mode = 'db';
    const d = snap.exists ? snap.data() : null;
    if (d && d.state) {
      store.seenAt = d.at || 0;
      const m = mergeState(S, JSON.parse(d.state)), same = JSON.stringify(m) === d.state;
      adopt(m); renderAll();
      if (same) setDot('ok'); else flush();
    } else if (S.updated) flush(); else setDot('ok');
  } catch (e) { setDot('err'); if (e && e.code === 'unavailable') setTimeout(initStore, 15000); }
}
