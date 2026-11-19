'use strict';
/* ---------- words ---------- */
function prog(k) { return S.prog[k] || {h: 0, d: []}; }
function status(k) {
  if (S.known[k]) return 'known';
  if (!SEL.has(k)) return 'off';
  const p = prog(k);
  if (p.h >= GOAL && p.d.length >= 3) return 'check';
  return p.h < 4 ? 'new' : 'learning';
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const dayNo = d => Math.round(new Date(d + 'T12:00:00') / 864e5);
function usable(w) {
  const ok = [], idi = [];
  w.s.forEach((sid, i) => { const f = S.flag[sid]; if (f === 'skip' || f === 'bad') return; (f === 'idiom' ? idi : ok).push(i); });
  const u = ok.concat(idi); return u.length ? u : w.s.map((_, i) => i);
}
function sentIndex(w) {
  const u = usable(w), p = prog(w.k), first = p.f || p.d[0];
  const n = S.known[w.k] ? dayNo(today()) + hash(w.k) % 7 : first ? dayNo(today()) - dayNo(first) : 0;
  const x = n + (S.skip[w.k] || 0) + (S.shift || 0);
  return u[(x % u.length + u.length) % u.length];
}
const TOK = /([\p{L}\p{M}'-]+)/u;
function tokText(sid, forms, gap) {
  const s = DATA.sents[sid], m = s.m || {}, f = new Set(forms || []); let g = !!gap;
  return s.de.split(TOK).map(p => {
    if (!p) return '';
    if (g && p === gap) { g = false; return '<span class="gap" style="width:' + Math.max(2.4, p.length * .6).toFixed(1) + 'em"></span>'; }
    const k = m[p], t = f.has(p) ? 'mark' : 'span';
    if (!k) return t === 'mark' ? '<mark>' + esc(p) + '</mark>' : esc(p);
    const nw = S.set.mark && t === 'span' && !S.known[k] && !SEL.has(k) && !(S.extra[k] && S.extra[k].s === 'known');
    return '<' + t + (nw ? ' class="nw"' : '') + ' data-lk="' + esc(k) + '">' + esc(p) + '</' + t + '>';
  }).join('');
}
function hasTok(sid, form) { return !!form && DATA.sents[sid].de.split(TOK).includes(form); }
function formsFor(w, sid) { const i = w.s.indexOf(sid); return w.hl && i >= 0 ? w.hl[i] : []; }
function sentFor(w) { return w.s[sentIndex(w)]; }
function hear(k, n = 1) {
  const p = S.prog[k] || (S.prog[k] = {h: 0, d: []});
  p.h += n; logDay().h += n; const t = today(); if (!p.f) p.f = t;
  if (p.td !== t) { p.td = t; p.tn = 0; } p.tn += n;
  if (!p.d.includes(t)) { p.d.push(t); if (p.d.length > 6) p.d.shift(); }
}
function counts() {
  let all = 0, fresh = 0;
  for (const w of DATA.words) if (SEL.has(w.k) && !S.known[w.k]) { all++; if (prog(w.k).h < 4) fresh++; }
  return {all, fresh};
}
