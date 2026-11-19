'use strict';
/* ---------- bags + tests ---------- */
const BAGN = ['', 'Significado', 'Escribir', 'Formas', 'Repaso'];
const CASES = {D: 'Dativ', A: 'Akkusativ', W: 'Dativ / Akkusativ', G: 'Genitiv'};
function addDays(d, n) { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv-SE'); }
function markKnown(k) { S.known[k] = today(); S.bag[k] = {b: 1, due: addDays(today(), 1), iv: 1}; }
function unmarkKnown(k) { delete S.known[k]; delete S.bag[k]; }
function relearn(k) {
  unmarkKnown(k); if (!S.sel.includes(k)) S.sel.push(k);
  const p = S.prog[k] || (S.prog[k] = {h: 0, d: []}); p.h = Math.min(p.h, 6); p.d = [today()];
  syncSel();
}
function snap(k) { return {bag: S.bag[k] ? {...S.bag[k]} : null, known: S.known[k] || null, prog: S.prog[k] ? {...S.prog[k], d: S.prog[k].d.slice()} : null, sel: S.sel.slice()}; }
function restore(k, o) {
  if (o.bag) S.bag[k] = o.bag; else delete S.bag[k];
  if (o.known) S.known[k] = o.known; else delete S.known[k];
  if (o.prog) S.prog[k] = o.prog; else delete S.prog[k];
  S.sel = o.sel; syncSel();
}
function bagCounts() { const c = [0, 0, 0, 0, 0]; for (const k in S.bag) c[S.bag[k].b]++; return c; }
function todayDue() {
  const all = dueWords(false), cap = S.set.rmax == null ? 50 : S.set.rmax;
  if (!cap) return all;
  return all.slice(0, Math.max(0, cap - ((S.log[today()] || {}).t || 0)));
}
function streak() {
  const has = d => ((S.log[d] || {}).t || 0) > 0; let d = today(), n = 0; const on = has(d);
  if (!on) d = addDays(d, -1);
  while (has(d)) { n++; d = addDays(d, -1); }
  return {n, on};
}
function fmtDue(d) {
  const n = Math.round((new Date(d + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5);
  if (n <= 0) return 'hoy'; if (n === 1) return 'mañana'; if (n < 7) return 'en ' + n + ' días';
  const x = new Date(d + 'T12:00:00'); return 'el ' + x.getDate() + ' ' + MES[x.getMonth()];
}
function dueWords(early) {
  const t = today();
  return DATA.words.filter(w => { const b = S.bag[w.k], st = status(w.k); return b ? b.due <= t : st === 'check' || (early && st === 'learning'); })
    .sort((a, b) => ((S.bag[a.k] || {}).due || '').localeCompare((S.bag[b.k] || {}).due || '') || a.r - b.r);
}
function grade(k, ok) {
  const t = today(), b = S.bag[k], L = logDay();
  L.t = (L.t || 0) + 1; if (ok) L.ok = (L.ok || 0) + 1;
  if (!ok) { const p = S.prog[k] || (S.prog[k] = {h: 0, d: []}); p.x = (p.x || 0) + 1; }
  if (ok) {
    if (!b) { S.known[k] = t; S.bag[k] = {b: 2, due: addDays(t, BAG_IV[1]), iv: BAG_IV[1]}; }
    else { const iv = b.b < 4 ? BAG_IV[b.b] : Math.min(BAG_IV_MAX, Math.max(BAG_IV[3], b.iv || BAG_IV[3]) * 2); S.bag[k] = {b: Math.min(4, b.b + 1), due: addDays(t, iv), iv}; }
  } else if (!b || b.b === 1) relearn(k);
  else S.bag[k] = {b: b.b - 1, due: addDays(t, 1), iv: 1};
}

function rng(seed) { let h = hash(seed) || 1; return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; }; }
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pickN(pool, n, r, ok) { const out = []; for (const x of shuffle(pool.slice(), r)) { if (out.length >= n) break; if (ok(x, out)) out.push(x); } return out; }
const artOf = w => (/^(der|die|das) /.exec(w.w) || [])[1] || null;
const bare = w => w.w.replace(/^(der|die|das) /, '');
const fold = x => x.trim().toLowerCase().replace(/[’`´]/g, "'").replace(/[.,!?;:"«»„“]/g, '').replace(/\s+/g, ' ').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
const headG = g => g.replace(/^(el|la|los|las|un|una) /, '').split(/[ ,;(]/)[0];
function umlaut(x) {
  const m = /^(.*?)(chen|lein|er|el|en|e)?$/.exec(x), st = m[1], suf = m[2] || '', U = {a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü'};
  for (let i = st.length - 1; i >= 0; i--) {
    const c = st[i];
    if ('aouAOU'.includes(c)) {
      if (c === 'u' && i > 0 && 'aA'.includes(st[i - 1])) return st.slice(0, i - 1) + U[st[i - 1]] + 'u' + st.slice(i + 1) + suf;
      if (c === 'u' && i > 0 && 'eE'.includes(st[i - 1])) return x;
      return st.slice(0, i) + U[c] + st.slice(i + 1) + suf;
    }
    if ('eiyäöüEIÄÖÜ'.includes(c)) return x;
  }
  return x;
}
function sentWith(w, r) { for (const i of shuffle(w.s.map((_, i) => i), r)) if (hasTok(w.s[i], (w.gp || [])[i])) return i; return -1; }
function meanQ(w, r, hard) {
  const pool = DATA.words.filter(x => x !== w && x.c === w.c && headG(x.g) !== headG(w.g));
  const near = pool.filter(x => Math.abs(x.r - w.r) <= 200), fresh = (x, o) => !o.some(y => headG(y.g) === headG(x.g));
  let ds = hard ? simWords(w, r, 3) : pickN(near.length >= 8 ? near : pool, 3, r, fresh);
  if (ds.length < 3) ds = ds.concat(pickN(DATA.words.filter(x => x !== w && headG(x.g) !== headG(w.g)), 3 - ds.length, r, (x, o) => fresh(x, o.concat(ds))));
  return {type: 'mean', opts: shuffle([w.g, ...ds.map(x => x.g)], r), ans: w.g, sid: w.s[Math.floor(r() * w.s.length)], dsw: ds};
}
function writeQ(w, r) {
  const i = sentWith(w, r), ans = [bare(w)]; if (artOf(w)) ans.push(w.w);
  if (i < 0) return {type: 'write', sid: null, gap: null, ans, show: bare(w)};
  return {type: 'write', sid: w.s[i], gap: w.gp[i], ans: [w.gp[i], ...ans], show: w.gp[i]};
}
function nounQ(w, r) {
  const q = {type: 'noun', step: 'art', opts: ['der', 'die', 'das'], ans: artOf(w)};
  if (w.pl && w.pl !== '-') {
    const sg = bare(w), u = umlaut(sg), cand = [sg + 'e', sg + 'er', sg + 's', sg, u + 'e', u + 'er', u, /[elr]$/.test(sg) ? sg + 'n' : sg + 'en'];
    if (/in$/.test(sg)) cand.push(sg + 'nen');
    const ds = pickN([...new Set(cand)].filter(x => x !== w.pl && !/ee$/.test(x)), 3, r, () => true);
    q.plOpts = shuffle([w.pl, ...ds], r).map(x => 'die ' + x); q.plAns = 'die ' + w.pl;
  }
  return q;
}
function verbQ(w, r) {
  const v = w.vf, subs = ['p3', 'perf'], af = a => a === 'sein' ? 'ist' : 'hat'; if (v.st && v.pt) subs.push('pt');
  const sub = subs[Math.floor(r() * subs.length)];
  if (sub === 'p3') return {type: 'type', label: 'Presente', pre: 'er', ans: [v.p3], show: 'er ' + v.p3};
  if (sub === 'pt') return {type: 'type', label: 'Präteritum', pre: 'er', ans: [v.pt], show: 'er ' + v.pt};
  return {type: 'type', label: 'Perfekt', pre: 'er', ans: v.aux.map(a => af(a) + ' ' + v.pp), show: 'er ' + v.aux.map(af).join('/') + ' ' + v.pp};
}
function adjQ(w, r) {
  return r() < .5 ? {type: 'type', label: 'Comparativo', pre: '', ans: [w.cmp[0]], show: w.cmp[0]}
                  : {type: 'type', label: 'Superlativo', pre: 'am', ans: [w.cmp[1]], show: w.cmp[1]};
}
function clozeQ(w, r) {
  const i = sentWith(w, r); if (i < 0) return meanQ(w, r);
  const gap = w.gp[i], cap = /^\p{Lu}/u.test(gap), fix = x => (cap ? x[0].toUpperCase() : x[0].toLowerCase()) + x.slice(1);
  let pool = [];
  for (const x of DATA.words) if (x !== w && x.c === w.c && x.c !== 'N' && (x.p || '') === (w.p || '')) for (const g of x.gp || []) if (g) pool.push(fix(g));
  if (pool.length < 6) for (const x of DATA.words) if (x !== w && x.c === w.c) for (const g of x.gp || []) if (g) pool.push(fix(g));
  const ds = pickN([...new Set(pool)], 3, r, (x, o) => fold(x) !== fold(gap) && !o.some(y => fold(y) === fold(x)));
  if (ds.length < 2) return meanQ(w, r);
  return {type: 'cloze', sid: w.s[i], gap, opts: shuffle([gap, ...ds], r), ans: gap};
}
function formsQ(w, r) {
  if (w.c === 'N' && artOf(w)) return nounQ(w, r);
  if (w.vf) return verbQ(w, r);
  if (w.cmp) return adjQ(w, r);
  if (w.cs) { const i = sentWith(w, r); return {type: 'case', opts: ['D', 'A', 'W', 'G'], ans: w.cs, sid: w.s[Math.max(0, i)]}; }
  return clozeQ(w, r);
}
const isShort = w => w.c === 'F' || (w.c !== 'N' && (bare(w).length <= 3 || RIV.some(g => g.includes(bare(w).toLowerCase()))));
const RIV = [
  ['im', 'am', 'in', 'an', 'ins', 'ans', 'um', 'zum', 'zur', 'vom', 'beim', 'auf', 'aus', 'bei', 'mit', 'nach', 'von', 'zu', 'für', 'über', 'unter', 'vor', 'durch', 'gegen', 'ohne', 'seit', 'bis', 'hinter', 'neben', 'zwischen'],
  ['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines', 'kein', 'keine', 'keinen', 'keinem', 'dieser', 'diese', 'dieses', 'diesen', 'diesem'],
  ['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'mir', 'dir', 'ihn', 'ihm', 'uns', 'euch', 'ihnen', 'sich', 'man'],
  ['mein', 'meine', 'meinen', 'meinem', 'meiner', 'dein', 'deine', 'deinen', 'deinem', 'sein', 'seine', 'seinen', 'seinem', 'seiner', 'unser', 'unsere', 'euer', 'eure', 'ihre', 'ihren', 'ihrem'],
  ['und', 'oder', 'aber', 'denn', 'weil', 'dass', 'wenn', 'als', 'ob', 'damit', 'sondern', 'obwohl', 'bevor', 'nachdem'],
  ['wer', 'was', 'wo', 'wann', 'warum', 'wie', 'welche', 'welcher', 'welches', 'woher', 'wohin', 'wem', 'wen'],
  ['viel', 'viele', 'vielen', 'wenig', 'wenige', 'mehr', 'weniger', 'alle', 'alles', 'nichts', 'etwas', 'genug', 'ganz', 'jeder', 'jede', 'jeden', 'einige', 'manche', 'beide', 'meisten'],
  ['heute', 'morgen', 'gestern', 'immer', 'nie', 'niemals', 'oft', 'manchmal', 'jetzt', 'bald', 'später', 'früher', 'schon', 'noch', 'dann', 'wieder', 'gerade', 'endlich', 'sofort'],
  ['hier', 'dort', 'da', 'oben', 'unten', 'drinnen', 'draußen', 'links', 'rechts', 'weg', 'überall', 'zurück'],
  ['nicht', 'auch', 'nur', 'so', 'sehr', 'doch', 'mal', 'ja', 'gern', 'gerne', 'zu', 'fast', 'wirklich', 'vielleicht', 'leider'],
  ['kann', 'kannst', 'können', 'muss', 'musst', 'müssen', 'will', 'willst', 'wollen', 'soll', 'sollst', 'sollen', 'darf', 'darfst', 'dürfen', 'möchte', 'möchtest', 'konnte', 'musste', 'wollte', 'sollte'],
  ['bin', 'bist', 'ist', 'sind', 'seid', 'war', 'waren', 'habe', 'hast', 'hat', 'haben', 'hatte', 'hatten', 'wird', 'werden', 'wurde']
];
const TOKC = new Map(), KRC = new Map(); let KRK = '';
function knownR(sid, skip) {
  const key = SEL.size + '|' + Object.keys(S.known).length; if (key !== KRK) { KRK = key; KRC.clear(); }
  const ck = sid + '|' + (skip || ''); let v = KRC.get(ck); if (v != null) return v;
  const ks = [...new Set(Object.values(DATA.sents[sid].m || {}))].filter(k => k !== skip);
  v = ks.length ? ks.filter(k => SEL.has(k) || S.known[k]).length / ks.length : .5; KRC.set(ck, v); return v;
}
function bestSent(list, r, wk) { return list.map(sid => [knownR(sid, wk) + r() * .25, sid]).sort((a, b) => b[0] - a[0])[0][1]; }
function toks(sid) { let t = TOKC.get(sid); if (!t) { t = DATA.sents[sid].de.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean); TOKC.set(sid, t); } return t; }
/* sentences grouped by length, so distractor search only looks at similar lengths */
let LENB = null;
function nearLen(L0, span) {
  if (!LENB) { LENB = new Map(); for (const id in DATA.sents) { const n = toks(id).length; if (!LENB.has(n)) LENB.set(n, []); LENB.get(n).push(id); } }
  let out = [];
  for (let w = span; ; w += 4) { out = []; for (let n = Math.max(1, L0 - w); n <= L0 + w; n++) for (const id of LENB.get(n) || []) out.push(id); if (out.length >= 60 || w > 40) return out; }
}
function simSents(sid, r, n, rivals, avoid, wkAvoid) {
  const s0 = DATA.sents[sid], L0 = toks(sid).length, seen = new Set([s0.es, s0.de]), sc = [];
  const lem = wkAvoid ? (invIdx(), new Set(INVL.get(wkAvoid) || [])) : null;
  for (const id of nearLen(L0, 6)) {
    if (id === sid) continue;
    const s = DATA.sents[id]; if (seen.has(s.es) || seen.has(s.de)) continue;
    const t = toks(id); if ((avoid && t.includes(avoid)) || (lem && lem.has(id))) continue;
    sc.push([(rivals && t.some(x => rivals.has(x)) ? 0 : 10) + Math.abs(t.length - L0) - knownR(id) * 4 + r() * 2, id]);
  }
  sc.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [, id] of sc) { const s = DATA.sents[id]; if (out.some(o => DATA.sents[o].es === s.es || DATA.sents[o].de === s.de)) continue; out.push(id); if (out.length >= n) break; }
  return out;
}
let INVT = null, INVL = null;
function invIdx() {
  if (!INVT) {
    INVT = new Map(); INVL = new Map();
    for (const id in DATA.sents) {
      for (const t of new Set(toks(id))) { let a = INVT.get(t); if (!a) INVT.set(t, a = []); a.push(id); }
      for (const k of new Set(Object.values(DATA.sents[id].m || {}))) { let a = INVL.get(k); if (!a) INVL.set(k, a = []); a.push(id); }
    }
  }
}
const ESW = new Map();
function esSet(x) { let v = ESW.get(x); if (!v) { v = new Set(fold(x).split(' ').filter(Boolean)); ESW.set(x, v); } return v; }
function esSim(a, b) { const A = esSet(a), B = esSet(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); }
function hardSents(sid, r, n, lvl, wk, surf, contrast) {
  const grp = surf && RIV.find(g => g.includes(surf)), rivals = grp ? new Set(grp.filter(x => x !== surf)) : null;
  if (!lvl) return simSents(sid, r, n, rivals, contrast || rivals ? surf : null, contrast ? wk : null);
  invIdx();
  const s0 = DATA.sents[sid], t0 = toks(sid), T0 = new Set(t0), f0 = fold(s0.de), lem = new Set(INVL.get(wk) || []);
  const bad = id => contrast && ((surf && toks(id).includes(surf)) || lem.has(id));
  const pool = new Set();
  if (rivals) { for (const x of rivals) for (const id of INVT.get(x) || []) if (!toks(id).includes(surf)) pool.add(id); }
  else if (!contrast) for (const id of lem) pool.add(id);
  if (lvl === 2 || contrast) for (const t of T0) { const a = INVT.get(t) || []; if (a.length < 600) for (const id of a) if (!rivals || !toks(id).includes(surf)) pool.add(id); }
  const sc = [];
  for (const id of pool) {
    if (id === sid || bad(id)) continue;
    const s = DATA.sents[id]; if (s.es === s0.es || fold(s.de) === f0 || esSim(s.es, s0.es) >= .7) continue;
    const t = toks(id), T = new Set(t); let inter = 0; for (const x of T) if (T0.has(x)) inter++;
    const jac = inter / (T.size + T0.size - inter), dl = Math.abs(t.length - t0.length), kr = knownR(id);
    const has = rivals ? t.some(x => rivals.has(x)) : !contrast && lem.has(id);
    sc.push([lvl === 2 || contrast ? jac * 10 + (has ? 1.5 : 0) - dl * .3 + kr * 2 + r() * .3 : (has ? 5 : 0) + jac * 3 - dl * .6 + kr * 2 + r() * .8, id, jac]);
  }
  sc.sort((a, b) => b[0] - a[0]);
  const out = [], seenEs = new Set([s0.es]), seenDe = new Set([f0]);
  for (const [, id, jac] of sc) {
    if (lvl === 2 && !contrast && jac < .25 && out.length < n) break;
    const s = DATA.sents[id], fd = fold(s.de); if (seenEs.has(s.es) || seenDe.has(fd)) continue;
    seenEs.add(s.es); seenDe.add(fd); out.push(id); if (out.length >= n) return out;
  }
  for (const id of hardSents(sid, r, n, contrast ? 0 : lvl - 1, wk, surf, contrast)) { const s = DATA.sents[id], fd = fold(s.de); if (out.length < n && !seenEs.has(s.es) && !seenDe.has(fd)) { seenEs.add(s.es); seenDe.add(fd); out.push(id); } }
  return out;
}
function simWords(w, r, n) {
  const b0 = fold(bare(w)), hd = headG(w.g), sc = [];
  for (const x of DATA.words) {
    if (x === w || headG(x.g) === hd) continue;
    const b = fold(bare(x)); sc.push([lev(b, b0) / Math.max(b.length, b0.length) - (x.c === w.c ? .08 : 0) + r() * .05, x]);
  }
  sc.sort((a, b) => a[0] - b[0]);
  const out = []; for (const [, x] of sc) { if (!out.some(y => headG(y.g) === headG(x.g))) out.push(x); if (out.length >= n) break; }
  return out;
}
function sentQ(w, r, slow, lvl, contrast) {
  const au = w.s.filter(sid => DATA.sents[sid].a && DATA.sents[sid].a.de); if (!au.length) return null;
  const sh = au.filter(sid => toks(sid).length <= 9), sid = bestSent(sh.length ? sh : au, r, w.k);
  const i = w.s.indexOf(sid), surf = ((w.gp || [])[i] || bare(w)).toLowerCase();
  const ds = hardSents(sid, r, 2, lvl == null ? 1 : lvl, w.k, surf, contrast).map(id => DATA.sents[id].es);
  return {type: 'sent', sid, slow, ans: DATA.sents[sid].es, opts: shuffle([DATA.sents[sid].es, ...ds], r)};
}
function transQ(w, r, dir, typed, aud, lvl) {
  const sid = bestSent(w.s, r, w.k), s = DATA.sents[sid], f = dir === 'es' ? 'de' : 'es';
  const i = w.s.indexOf(sid), surf = ((w.gp || [])[i] || bare(w)).toLowerCase();
  const ds = typed ? [] : hardSents(sid, r, 2, lvl || 0, w.k, isShort(w) ? surf : null).map(id => DATA.sents[id][f]);
  return {type: 'trans', sid, dir, typed, aud: aud && dir === 'de' && s.a && s.a.de, ans: s[f], opts: typed ? null : shuffle([s[f], ...ds], r)};
}
function dictQ(w, r, slow) {
  const au = w.s.filter(sid => DATA.sents[sid].a && DATA.sents[sid].a.de); if (!au.length) return null;
  const sh = au.filter(sid => toks(sid).length <= 10), sid = bestSent(sh.length ? sh : au, r, w.k);
  return {type: 'dict', sid, slow, ans: [DATA.sents[sid].de], show: DATA.sents[sid].de};
}
function makeCard(k) {
  if (R.free) return makeFree(k, R.free);
  const w = WBY.get(k), bg = S.bag[k], b = bg ? bg.b : 1, r = rng(k + '|' + today() + '|' + b);
  const ty = b === 1 ? (r() < .5 ? 'listen' : 'mean') : b === 2 ? 'write' : b === 3 ? 'forms' : ['listen', 'mean', 'write', 'forms'][Math.floor(r() * 4)];
  let q = ty === 'write' ? writeQ(w, r) : ty === 'forms' ? formsQ(w, r) : meanQ(w, r);
  if (ty === 'listen' && S.set.lt !== false) {
    const sq = isShort(w) ? sentQ(w, r, false, 2, true) : null;
    if (sq) q = sq; else if (w.a && w.a.d) q.type = 'listen';
  }
  return Object.assign({k, w, b, phase: 'ask', input: ''}, q);
}
