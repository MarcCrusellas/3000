'use strict';
/* ---------- plan: the chosen group's words and tracks, today's session, then extra rounds ---------- */
const MAXI = 1100, TJ = {n: 0, a: 1, r: 2, x: 2};
const PREVB = [{t: 'es'}, {t: 'p', d: 1}, {t: 'de'}];
function todayN(k) { const p = prog(k); return p.td === today() ? p.tn || 0 : 0; }
function spread(a) { for (let i = 1; i < a.length - 1; i++) if (a[i].k === a[i - 1].k) { const x = a[i]; a[i] = a[i + 1]; a[i + 1] = x; } return a; }
function plan(first) {
  const t = today(), g = curGroup(), cap = S.set.cap || 6, nd = S.set.nd || 2;
  const all = DATA.words.filter(w => SEL.has(w.k) && !S.known[w.k]);
  if (!g) return {items: [], words: 0, day: 0, cand: all.map(w => w.k)};
  const ty = w => S.known[w.k] ? 'r' : prog(w.k).d.filter(d => d < t).length < nd ? 'n' : 'a';
  const wl = all.filter(w => g.w[ty(w)]);
  const kn = (g.w.r ? DATA.words.filter(w => S.known[w.k]) : []).sort((a, b) => hash(a.k + t) - hash(b.k + t)).slice(0, 60);
  const mk = (w, sid, x, tag) => {
    const tr = pickTrack(g, TJ[x ? 'x' : ty(w)], rng(t + '|' + w.k + '|' + sid + '|' + tag));
    return tr ? {k: w.k, sid, rv: !!S.known[w.k], x: x ? 1 : 0, bl: tr.b} : null;
  };
  const fresh = [], rest = [], ev = [];
  for (const w of wl) { const n = cap - todayN(w.k); if (n > 0) (prog(w.k).h < 4 ? fresh : rest).push([w, n]); }
  const knDay = kn.filter(w => !todayN(w.k));
  let L = knDay.length; for (const [, n] of fresh.concat(rest)) L += n;
  const push = (it, pos) => { if (it) ev.push({it, pos}); };
  fresh.forEach(([w, n], i) => {
    const sid = sentFor(w), gap = Math.max(20, (L - i * 2 - 60) / Math.max(1, n - 3));
    for (let j = 0; j < n; j++) push(mk(w, sid, false, 'd' + j), j < 4 ? i * 2 + [0, 3, 12, 60][j] : i * 2 + 60 + (j - 3) * gap);
  });
  rest.forEach(([w, n]) => { const sid = sentFor(w), off = (hash(w.k + t) % 997) / 997; for (let j = 0; j < n; j++) push(mk(w, sid, false, 'd' + j), (j + off) * L / n); });
  knDay.forEach((w, j) => push(mk(w, sentFor(w), false, 'k'), (j + 0.5) * L / knDay.length));
  ev.sort((a, b) => a.pos - b.pos);
  const day = spread(ev.map(e => e.it)), items = day.slice();
  if (g.x) for (let r = 0; r < 40 && (r === 0 || items.length < MAXI); r++) {
    const round = [];
    for (const w of wl.concat(kn)) { const u = usable(w), c = Math.max(0, u.indexOf(sentIndex(w))), it = mk(w, w.s[u[(c + 1 + r) % u.length]], true, 'x' + r); if (it) round.push(it); }
    if (!round.length) break;
    items.push(...spread(shuffle(round, rng(t + '|x' + r))));
  }
  if (first) { const i = items.findIndex(it => it.k === first); if (i > 0) items.unshift(items.splice(i, 1)[0]); }
  return {items, words: wl.length, day: day.length, cand: all.map(w => w.k)};
}
function signature() {
  const g = curGroup();
  return JSON.stringify([today(), [...SEL].sort(), S.shift || 0, S.set.nd || 2, S.set.cap || 6, g && [g.id, g.w, g.x, g.tracks.map(x => [x.s, x.f, x.b.map(b => [b.t, b.d, b.v])])]]);
}
