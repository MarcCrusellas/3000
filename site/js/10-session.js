'use strict';
/* ---------- practice tests (do not touch the bags) ---------- */
const FT = [
  {id: 'mean', n: 'Significado', d: 'Palabra y 4 opciones', cf: ['difw', 'aud', 'dir'], sk: '<i class="b" style="width:45%;height:10px"></i><i class="o"></i><i class="o"></i><i class="o"></i><i class="o"></i>'},
  {id: 'listen', n: 'Oído', d: 'Oyes la palabra', cf: ['difw'], sk: '<span class="r"><i class="pl"></i><i class="b" style="width:30%"></i></span><i class="o"></i><i class="o"></i><i class="o"></i><i class="o"></i>'},
  {id: 'sent', n: 'Frase al oído', d: 'Oyes una frase y eliges su traducción', cf: ['dif', 'slow'], sk: '<span class="r"><i class="pl"></i><i class="b" style="flex:1"></i></span><i class="o" style="height:11px"></i><i class="o" style="height:11px"></i><i class="o" style="height:11px"></i>'},
  {id: 'write', n: 'Escribir', d: 'Escribes la palabra en alemán', cf: ['frase'], sk: '<i class="b" style="width:55%;height:10px"></i><i class="b" style="width:35%"></i><i class="f"></i><i class="o" style="height:16px"></i>'},
  {id: 'cloze', n: 'Huecos', d: 'Frase con un hueco', cf: ['ans'], sk: '<span class="r"><i class="b" style="width:30%"></i><i class="o" style="width:22%;height:6px;border-style:dashed"></i><i class="b" style="width:30%"></i></span><i class="o"></i><i class="o"></i><i class="o"></i>'},
  {id: 'forms', n: 'Formas', d: 'Género, plural y verbos', cf: [], sk: '<i class="b" style="width:40%;height:10px"></i><span class="g4"><i class="o"></i><i class="o"></i><i class="o"></i><i class="o"></i></span>'},
  {id: 'trans', n: 'Traducir frase', d: 'Lees una frase y la traduces', cf: ['dif', 'aud', 'dir', 'ans'], sk: '<i class="b" style="width:90%"></i><i class="b" style="width:60%"></i><i class="f"></i><i class="o" style="height:18px"></i>'},
  {id: 'dict', n: 'Dictado', d: 'Oyes una frase y la escribes', cf: ['slow'], sk: '<span class="r"><i class="pl"></i><i class="b" style="width:40%"></i></span><i class="f"></i><i class="o" style="height:18px"></i>'},
  {id: 'mix', n: 'Mezcla', d: 'Tipos variados, como el repaso', cf: [], sk: '<span class="g4"><i class="o"></i><i class="o"></i><i class="o"></i><i class="o"></i></span>'}
];
const FDEF = {dif: 1}, cfv = (o, k) => o[k] != null ? o[k] : FDEF[k] || 0;
const FCF = {dif: ['Dificultad', ['Normal', 'Difícil', 'Muy difícil']], difw: ['Dificultad', ['Normal', 'Difícil']], aud: ['Audio', ['Sí', 'No']], dir: ['Dirección', ['DE → ES', 'ES → DE']], ans: ['Respuesta', ['Elegir', 'Escribir']], slow: ['Velocidad', ['Normal', 'Lenta']], frase: ['Frase', ['Con frase', 'Sin frase']]};
const hasForms = w => (w.c === 'N' && !!artOf(w)) || !!w.vf || !!w.cmp || !!w.cs;
const hasSentAudio = w => w.s.some(sid => DATA.sents[sid].a && DATA.sents[sid].a.de);
function ftOk(t, w) { return t === 'listen' ? !!(w.a && w.a.d) : t === 'sent' || t === 'dict' ? hasSentAudio(w) : t === 'forms' ? hasForms(w) : true; }
const FG = [
  ['due', 'Para repasar hoy'], ['learn', 'Aprendiendo'], ['known', 'Ya sé'], ['today', 'Nuevas de hoy'], ['fail', 'Falladas'], ['short', 'Palabras cortas'], ['all', 'Todas']
];
function fgWords(g) {
  const t = today(), mine = w => SEL.has(w.k) || !!S.known[w.k];
  if (g === 'due') return dueWords(false);
  const f = {learn: w => status(w.k) === 'learning', known: w => !!S.known[w.k], today: w => SEL.has(w.k) && !S.known[w.k] && (S.prog[w.k] || {}).f === t,
    fail: w => mine(w) && ((S.prog[w.k] || {}).x || 0) > 0, short: w => mine(w) && isShort(w), all: mine}[g];
  const out = DATA.words.filter(f);
  if (g === 'fail') out.sort((a, b) => (S.prog[b.k].x || 0) - (S.prog[a.k].x || 0));
  return out;
}
function makeFree(k, F) {
  const w = WBY.get(k), r = rng(k + '|' + Date.now() + '|' + Math.random()), cf = F.cf, bg = S.bag[k];
  let t = F.t, q = null;
  if (t === 'mix') { const o = ['mean', 'write', 'forms', 'cloze'].concat(w.a && w.a.d ? ['listen'] : [], isShort(w) && hasSentAudio(w) ? ['sent'] : []); t = o[Math.floor(r() * o.length)]; }
  if (t === 'mean') { q = meanQ(w, r, cf.difw === 1); if (cf.dir === 1) { q.type = 'meanr'; q.opts = shuffle([w.w, ...q.dsw.map(x => x.w)], r); q.ans = w.w; } q.aud = cf.aud !== 1; }
  else if (t === 'listen') { q = meanQ(w, r, cf.difw === 1); q.type = 'listen'; }
  else if (t === 'sent') q = sentQ(w, r, cf.slow === 1, cf.dif);
  else if (t === 'write') { q = writeQ(w, r); if (cf.frase === 1) { const ans = [bare(w)]; if (artOf(w)) ans.push(w.w); q = {type: 'write', sid: null, gap: null, ans, show: bare(w)}; } }
  else if (t === 'cloze') q = cf.ans === 1 ? writeQ(w, r) : clozeQ(w, r);
  else if (t === 'forms') q = formsQ(w, r);
  else if (t === 'trans') q = transQ(w, r, cf.dir === 1 ? 'es' : 'de', cf.ans === 1, cf.aud !== 1, cf.dif);
  else if (t === 'dict') q = dictQ(w, r, cf.slow === 1);
  if (!q) q = meanQ(w, r);
  return Object.assign({k, w, b: bg ? bg.b : 0, phase: 'ask', input: '', free: true}, q);
}
const TL = {step: 0, t: 0, g: 0, n: 10, cf: {}};
function tlRender() {
  const el = $('#tlBody');
  if (TL.step === 0) {
    el.innerHTML = '<div class="tlh"><h2>Test nuevo</h2><button class="ib" data-act="tlx" aria-label="Cerrar">' + ico('x') + '</button></div><p class="tlp">Solo para practicar: no cambia tus bolsas.</p>'
      + '<div class="tlg">' + FT.map((t, i) => '<button class="tlc" data-tt="' + i + '"><span class="tsk">' + t.sk + '</span><b>' + t.n + '</b><small>' + t.d + '</small></button>').join('') + '</div>';
    return;
  }
  const t = FT[TL.t], cnt = FG.map(([g]) => fgWords(g).filter(w => ftOk(t.id, w)).length);
  if (!cnt[TL.g]) { const j = cnt.findIndex(x => x > 0); if (j >= 0) TL.g = j; }
  const seg = (k, opts, v, dis) => '<div class="seg tls">' + opts.map((o, i) => '<button class="' + (v === i ? 'on' : '') + '" data-tk="' + k + '" data-tv="' + i + '"' + (dis && !dis[i] ? ' disabled' : '') + '>' + o + '</button>').join('') + '</div>';
  el.innerHTML = '<div class="tlh"><button class="ib" data-act="tlback" aria-label="Volver">' + ico('chev') + '</button><h2>' + t.n + '</h2><button class="ib" data-act="tlx" aria-label="Cerrar">' + ico('x') + '</button></div>'
    + '<div class="tll">Qué palabras</div>' + seg('g', FG.map(([, n], i) => n + ' <em>' + cnt[i] + '</em>'), TL.g, cnt)
    + '<div class="tll">Preguntas</div>' + seg('n', ['10', '20', '30'], [10, 20, 30].indexOf(TL.n))
    + t.cf.map(k => '<div class="srow"><span>' + FCF[k][0] + '</span>' + seg('c_' + k, FCF[k][1], cfv(TL.cf, k)) + '</div>').join('')
    + '<button class="btn primary tlgo" data-act="tlgo"' + (cnt[TL.g] ? '' : ' disabled') + '>' + ico('arrow') + 'Empezar</button>';
}
function tlOpen() { TL.step = 0; tlRender(); sheet(true, 'tl'); $('#tl').scrollTop = 0; }
function startFree() {
  const t = FT[TL.t], ws = fgWords(FG[TL.g][0]).filter(w => ftOk(t.id, w));
  if (!ws.length) return;
  clearTimeout(R.t);
  R.free = {t: t.id, n: t.n, cf: Object.fromEntries(t.cf.map(k => [k, cfv(TL.cf, k)])), g: TL.g, cnt: TL.n};
  stopPV(); R.list = shuffle(ws.map(w => w.k), rng('f' + Date.now())).slice(0, TL.n); prefetchFor(R.list);
  R.i = 0; R.ok = 0; R.void = 0; R.card = null; R.end = false;
  sheet(false); renderCheck(); focusWi();
}
function exitFree() { clearTimeout(R.t); R.free = null; R.list = []; R.i = 0; R.ok = 0; R.void = 0; R.card = null; R.end = false; renderCheck(); }
$('#tl').onclick = e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.tt != null) { const i = +b.dataset.tt; if (TL.t !== i) TL.cf = {}; TL.t = i; TL.step = 1; tlRender(); $('#tl').scrollTop = 0; return; }
  if (b.dataset.tk) { const k = b.dataset.tk, v = +b.dataset.tv; if (k === 'g') TL.g = v; else if (k === 'n') TL.n = [10, 20, 30][v]; else TL.cf[k.slice(2)] = v; tlRender(); return; }
  const a = b.dataset.act;
  if (a === 'tlx') sheet(false); else if (a === 'tlback') { TL.step = 0; tlRender(); } else if (a === 'tlgo') startFree();
  else if (a === 'psgo') {
    const d = readStateText($('#psTa').value); if (!d) { toast(readStateText.why || 'Ese texto no es un progreso válido'); return; }
    S = Object.assign(defaults(), d); syncSel(); R.list = []; R.card = null; R.end = false; R.free = null; S.updated = Date.now(); if (store.mode === 'db') flush(); changed(); sheet(false); toast('Progreso cargado');
  }
};

const R = {list: [], i: 0, ok: 0, card: null, end: false, t: 0, void: 0, free: null};
function prefetchFor(keys) { const ps = new Set(); for (const k of keys) { const w = WBY.get(k); if (!w) continue; if (w.a && w.a.d) ps.add(w.a.d[0]); for (const sid of w.s) { const a = DATA.sents[sid].a || {}; for (const x of ['de', 'ds']) if (a[x]) ps.add(a[x][0]); } } for (const p of ps) getPack(p).catch(() => {}); }
function startSession(early) { clearTimeout(R.t); stopPV(); R.free = null; R.list = (early ? dueWords(true) : todayDue()).slice(0, S.set.rs || 10).map(w => w.k); prefetchFor(R.list); R.i = 0; R.ok = 0; R.void = 0; R.card = null; R.end = false; }
function nextCard() { clearTimeout(R.t); stopPV(); R.i++; R.card = null; if (R.i >= R.list.length) R.end = true; renderCheck(); }
function finish(ok) {
  const c = R.card; c.phase = ok ? 'ok' : 'bad';
  if (ok) { R.ok++; c.t0 = performance.now(); clearTimeout(R.t); if (S.set.cd === false) c.hold = true; else R.t = setTimeout(() => { if (R.card === c && !c.hold) nextCard(); }, 2500); }
  if (c.free) { renderCheck(); return; }
  c.prev = snap(c.k); grade(c.k, ok); logAns(c, ok, 1); c.move = moveInfo(c); changed();
}
function logAns(c, ok, d) {
  const L = logDay(), b0 = c.prev && c.prev.bag ? c.prev.bag.b : 0;
  L.bk = L.bk || {}; const x = L.bk[b0] || (L.bk[b0] = [0, 0]); x[0] += d; if (ok) x[1] += d;
  L.fk = L.fk || [];
  if (!ok && d > 0 && !L.fk.includes(c.k)) L.fk.push(c.k);
  if (!ok && d < 0) L.fk = L.fk.filter(k => k !== c.k);
}
function moveInfo(c) {
  const nb = S.bag[c.k], pb = c.prev && c.prev.bag;
  if (c.phase === 'ok' && nb) return {up: 1, t: (pb && pb.b === nb.b ? 'Sigue en ' : pb ? 'Sube a ' : 'Pasa a ') + BAGN[nb.b] + ' · vuelve ' + fmtDue(nb.due)};
  if (nb) return {up: 0, t: 'Baja a ' + BAGN[nb.b] + ' · vuelve mañana'};
  return {up: 0, t: 'Vuelve a escucharse en el bucle'};
}
function voidCard() {
  const c = R.card; if (!c) return;
  if (c.phase !== 'ask' && !c.free && c.prev) {
    restore(c.k, c.prev); const L = logDay(); L.t = Math.max(0, (L.t || 0) - 1); if (c.phase === 'ok') L.ok = Math.max(0, (L.ok || 0) - 1);
    logAns(c, c.phase === 'ok', -1); save();
  }
  if (c.phase === 'ok') R.ok--;
  R.void++; nextCard(); if (!c.free) renderAll();
}
function dunno() { const c = R.card; if (!c || c.phase !== 'ask') return; c.pick = null; c.input = ''; c.dk = true; finish(false); }
function hold() { const c = R.card; if (!c) return; clearTimeout(R.t); c.hold = true; renderCheck(); }
function choose(i) {
  const c = R.card; if (!c || c.phase !== 'ask' || !c.opts) return;
  const v = c.opts[i]; if (v == null) return;
  c.pick = v;
  if (c.type === 'noun' && c.step === 'art' && v === c.ans && c.plOpts) { c.step = 'pl'; c.opts = c.plOpts; c.ans = c.plAns; c.pick = null; renderCheck(); return; }
  finish(v === c.ans);
}
function lev(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let p = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { const q = [i]; for (let j = 1; j <= b.length; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; }
  return p[b.length];
}
const ARTS = /^(der|die|das|den|dem|des) /;
function closeTo(a, t, sentence) {
  if (a === t || a.replace(/ /g, '') === t.replace(/ /g, '')) return a === t ? 2 : 1;
  const ma = ARTS.exec(a), mt = ARTS.exec(t); if (ma && mt && ma[1] !== mt[1]) return 0;
  const n = t.replace(/ /g, '').length, lim = sentence ? Math.max(1, Math.floor(n / 12)) : n >= 10 ? 2 : n >= 4 ? 1 : 0;
  return lev(a, t) <= lim ? 1 : 0;
}
function matchScore(c, input) {
  const a = fold(input), pre = c.pre ? fold(c.pre) + ' ' : '', ins = [a];
  if (c.pre === 'er' && /^(er|sie|es) /.test(a)) ins.push(a.replace(/^(er|sie|es) /, ''));
  let best = 0;
  for (const x of c.ans) {
    const t = fold(x), ts = [t]; if (pre) ts.push(pre + t);
    for (const i of ins) for (const tt of ts) { best = Math.max(best, closeTo(i, tt, c.type === 'dict'), pre ? closeTo(pre + i, tt, false) : 0); if (best === 2) return 2; }
  }
  return best;
}
function matches(c, input) { return matchScore(c, input) === 2; }
function submitTyped() {
  const c = R.card, wi = $('#wi'); if (!c || c.phase !== 'ask' || !wi) return;
  const v = wi.value; if (!v.trim()) { wi.focus(); return; }
  c.input = v; wi.blur();
  if (c.type === 'trans') { c.phase = 'self'; renderCheck(); return; }
  const m = matchScore(c, v); c.near = m === 1; finish(m > 0);
}
function override() {
  const c = R.card; if (!c || c.phase !== 'bad') return;
  if (c.free) { R.ok++; nextCard(); return; }
  if (!c.prev) return;
  restore(c.k, c.prev); const L = logDay(); L.t = Math.max(0, (L.t || 0) - 1); logAns(c, false, -1);
  grade(c.k, true); logAns(c, true, 1); R.ok++; changed(); nextCard();
}
function insertKey(ch) {
  const wi = $('#wi'); if (!wi || !R.card || R.card.phase !== 'ask') return;
  const a = wi.selectionStart == null ? wi.value.length : wi.selectionStart, b = wi.selectionEnd == null ? a : wi.selectionEnd;
  wi.value = wi.value.slice(0, a) + ch + wi.value.slice(b); R.card.input = wi.value;
  wi.focus(); try { wi.setSelectionRange(a + 1, a + 1); } catch (e) {}
}
function lcsT(a, b) {
  const L = Array.from({length: a.length + 1}, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  return L;
}
function diffHtml(inp, tgt) {
  const a = inp.toLowerCase(), b = tgt.toLowerCase(), L = lcsT(a, b); let i = 0, j = 0, out = '';
  if (L[0][0] * 2 < b.length) return esc(tgt);
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) { out += esc(tgt[j]); i++; j++; }
    else if (i < a.length && L[i + 1][j] >= L[i][j + 1]) i++;
    else { out += '<u>' + esc(tgt[j]) + '</u>'; j++; }
  }
  return out;
}
const KEYS = '<div class="keys">' + ['ä', 'ö', 'ü', 'ß'].map(k => '<button data-key="' + k + '">' + k + '</button>').join('') + '</div>';
function inputHtml(c, ph) {
  return '<div class="wrow">' + (c.pre ? '<span class="pre">' + esc(c.pre) + '</span>' : '')
    + '<input class="wi" id="wi" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Respuesta"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>'
    + '<button class="go" data-act="go" aria-label="Comprobar">' + ico('check') + '</button></div>' + KEYS;
}
function typedHtml(c) {
  if (c.phase === 'ask') return inputHtml(c);
  const strip = x => c.pre ? x.trim().replace(/^(er|sie|es) /i, '').replace(/^am /i, '') : x.trim();
  const inp = strip(c.input || ''), best = () => c.ans.map(strip).sort((x, y) => lcsT(fold(inp), fold(y))[0][0] - lcsT(fold(inp), fold(x))[0][0])[0];
  if (c.phase === 'ok') return c.near ? '<div class="fix ok near">' + ico('check') + '<span class="nl2">Casi</span><b>' + (c.pre ? esc(c.pre) + ' ' : '') + diffHtml(inp, best()) + '</b></div>'
    : '<div class="fix ok">' + ico('check') + '<b>' + esc(c.show) + '</b></div>';
  if (!c.input.trim()) return '<div class="fix"><b>' + esc(c.show) + '</b></div>';
  return '<div class="fix"><s>' + esc(c.input.trim()) + '</s><b>' + (c.pre ? esc(c.pre) + ' ' : '') + diffHtml(inp, best()) + '</b></div>';
}
function miniRow(c) {
  const hasW = c.w && c.w.a && c.w.a.d, isS = c.type === 'sent' || c.type === 'dict' || c.type === 'trans';
  const other = c.w.s.some(sid => sid !== c.sid && DATA.sents[sid].a && DATA.sents[sid].a.de);
  if (!(isS || hasW) && !other) return '';
  return '<div class="mini">' + (isS || hasW ? '<button data-act="slow">' + ico('play') + 'Lento</button>' : '') + (other ? '<button data-act="other">' + ico('play') + 'En frase</button>' : '') + '</div>';
}
const TYL = {listen: 'Oído', sent: 'Frase al oído', trans: 'Traducir frase', dict: 'Dictado', meanr: 'Significado'};
function cardHtml(c) {
  const w = c.w, done = c.phase !== 'ask' && c.phase !== 'self';
  const label = c.free ? R.free.n : (TYL[c.type] || BAGN[c.b]);
  let h = '<div class="sec rv"><div class="rvh">' + (c.free ? '<span class="prx">Práctica</span>' : '<span class="dots">' + [1, 2, 3, 4].map(i => '<i' + (i <= c.b ? ' class="on"' : '') + '></i>').join('') + '</span>')
    + '<span>' + label + '</span><span class="cnt">' + (R.i + 1) + '/' + R.list.length + '</span></div>';
  const opt = (v, label) => {
    let cl = 'op'; if (done) { if (v === c.ans) cl += ' ok'; else if (v === c.pick) cl += ' bad'; }
    return '<button class="' + cl + '" data-i="' + c.opts.indexOf(v) + '"' + (done ? ' disabled' : '') + '>' + esc(label) + '</button>';
  };
  const sent = (sid, fill) => sid ? '<div class="rvs">' + tokText(sid, fill ? formsFor(w, sid) : [], fill ? null : c.gap) + '</div><div class="rve">' + esc(DATA.sents[sid].es) + '</div>' : '';
  const wordLine = '<div class="rvwl"><b>' + esc(w.w) + '</b> ' + esc(w.g) + '</div>';
  if (c.type === 'listen') {
    h += '<div class="rvw lis"><button class="pv xl" data-act="wplay" aria-label="Escuchar">' + ico('play') + '</button>' + (done ? '<span>' + esc(w.w) + '</span>' : '<span class="hid"></span>') + '</div>'
      + miniRow(c) + '<div class="ops">' + c.opts.map(v => opt(v, v)).join('') + '</div>' + (done ? sent(c.sid, true) : '');
  } else if (c.type === 'sent') {
    h += '<div class="rvw lis"><button class="pv xl" data-act="wplay" aria-label="Escuchar la frase">' + ico('play') + '</button>' + (done ? '' : '<span class="hid wide"></span>') + '</div>' + miniRow(c)
      + (done ? '<div class="rvs">' + tokText(c.sid, formsFor(w, c.sid), null) + '</div>' + wordLine : '')
      + '<div class="ops">' + c.opts.map(v => opt(v, v)).join('') + '</div>';
  } else if (c.type === 'dict') {
    h += '<div class="rvw lis"><button class="pv xl" data-act="wplay" aria-label="Escuchar la frase">' + ico('play') + '</button>' + (c.phase === 'ask' ? '<span class="hid wide"></span>' : '') + '</div>' + miniRow(c)
      + (c.phase === 'ask' ? inputHtml(c, 'Escribe lo que oyes') : typedHtml(c) + '<div class="rve">' + esc(DATA.sents[c.sid].es) + '</div>');
  } else if (c.type === 'trans') {
    const s = DATA.sents[c.sid];
    h += (c.dir === 'de' ? '<div class="rvw"><span class="rvsl">' + esc(s.de) + '</span>' + (s.a && s.a.de ? '<button class="pv lg" data-act="wplay" aria-label="Escuchar">' + ico('play') + '</button>' : '') + '</div>'
                         : '<div class="rvw"><span class="rvsl">' + esc(s.es) + '</span></div>') + (c.aud || (c.dir === 'es' && done) ? miniRow(c) : '');
    if (!c.typed) h += '<div class="ops">' + c.opts.map(v => opt(v, v)).join('') + '</div>';
    else if (c.phase === 'ask') h += inputHtml(c, c.dir === 'de' ? 'Tu traducción' : 'Escríbela en alemán');
    else h += '<div class="selfc"><div><small>Tu respuesta</small>' + esc(c.input) + '</div><div><small>Traducción</small><b>' + esc(c.ans) + '</b></div></div>';
  } else if (c.type === 'mean') {
    h += '<div class="rvw"><span>' + esc(w.w) + '</span><button class="pv lg" data-act="wplay" aria-label="Escuchar">' + ico('play') + '</button></div>' + miniRow(c)
      + '<div class="ops">' + c.opts.map(v => opt(v, v)).join('') + '</div>' + (done ? sent(c.sid, true) : '');
  } else if (c.type === 'meanr') {
    h += '<div class="rvw"><span>' + esc(w.g) + '</span>' + (done ? '<button class="pv lg" data-act="wplay" aria-label="Escuchar">' + ico('play') + '</button>' : '') + '</div>' + (done ? miniRow(c) : '')
      + '<div class="ops">' + c.opts.map(v => opt(v, v)).join('') + '</div>' + (done ? sent(c.sid, true) : '');
  } else if (c.type === 'write') {
    h += '<div class="rvg">' + esc(w.g) + '</div>' + sent(c.sid, done) + typedHtml(c);
  } else if (c.type === 'type') {
    h += '<div class="rvw"><span>' + esc(w.w) + '</span></div><div class="rvg">' + esc(w.g) + '</div><div class="rvt">' + esc(c.label) + '</div>' + typedHtml(c);
  } else if (c.type === 'noun') {
    h += c.step === 'art' ? '<div class="rvw"><span><span class="gap" style="width:2em"></span>' + esc(bare(w)) + '</span></div>'
                          : '<div class="rvw"><span>' + esc(w.w) + '</span></div>';
    h += '<div class="rvg">' + esc(w.g) + '</div>' + (c.step === 'art' ? '' : '<div class="rvt">Plural</div>') + '<div class="ops ' + (c.step === 'art' ? 'row' : 'two') + '">' + c.opts.map(v => opt(v, v)).join('') + '</div>';
    if (done) h += '<div class="rvs">' + esc(w.w) + (w.pl ? ' · die ' + esc(w.pl) : '') + '</div>';
  } else if (c.type === 'case') {
    h += '<div class="rvw"><span>' + esc(w.w) + ' + ?</span></div><div class="rvg">' + esc(w.g) + '</div>'
      + '<div class="ops two">' + c.opts.map(v => opt(v, CASES[v])).join('') + '</div>' + (done ? sent(c.sid, true) : '');
  } else {
    h += sent(c.sid, done) + '<div class="ops two">' + c.opts.map(v => opt(v, v)).join('') + '</div>';
  }
  if (done && c.move && !c.free) h += '<div class="mv ' + (c.move.up ? 'up' : 'dn') + '">' + ico(c.move.up ? 'up' : 'down') + esc(c.move.t) + '</div>';
  const typed = c.type === 'write' || c.type === 'type' || c.type === 'dict';
  const vd = '<button class="btn vd" data-act="void">No cuenta</button>';
  if (c.phase === 'self') h += '<div class="rvf">' + vd + '<span class="sp"></span><button class="btn" data-act="selfbad">' + ico('x') + 'Mal</button><button class="btn primary" data-act="selfok">' + ico('check') + 'Bien</button></div>';
  else if (!done) h += '<div class="rvf">' + vd + '<span class="sp"></span><button class="btn nk" data-act="dunno">No la sé</button></div>';
  else {
    const cd = c.phase === 'ok' && !c.hold, sp = c.sid && c.type !== 'type' && !['sent', 'dict'].includes(c.type);
    h += '<div class="rvf">' + (sp ? '<button class="pv lg" data-act="splay" aria-label="Escuchar la frase">' + ico('play') + '</button>' : '') + vd
      + '<span class="sp"></span>' + (c.phase === 'bad' && typed && !c.dk ? '<button class="btn" data-act="fix">' + ico('check') + 'Dar por buena</button>' : '')
      + (cd ? '<button class="btn" data-act="hold">Cancelar</button>' : '')
      + '<button class="nx" data-act="next" aria-label="Siguiente">' + (cd ? '<svg class="cd" viewBox="0 0 68 68"><circle cx="34" cy="34" r="31" style="animation-delay:-' + Math.round(performance.now() - c.t0) + 'ms"/></svg>' : '') + ico('arrow') + '</button></div>';
  }
  return h + '</div>';
}
async function playSentDe(sid, slow) {
  const a = DATA.sents[sid].a; if (!a || !a.de) return;
  const kind = slow && a.ds ? 'ds' : 'de', tok = ++PLAYTOK;
  try { await getPack(a[kind][0]); await playBlob(new Blob([silence(4), clipU8(sid, kind)], {type: 'audio/mpeg'}), slow && !a.ds ? .72 : 1, tok); } catch (e) {}
}
function playSlow(c) {
  if (c.type === 'sent' || c.type === 'dict' || c.type === 'trans') playSentDe(c.sid, true);
  else playWordKey(c.k, .65);
}
function playOther(c) {
  const w = c.w, au = w.s.filter(sid => sid !== c.sid && DATA.sents[sid].a && DATA.sents[sid].a.de);
  if (!au.length) { if (c.sid) playSentDe(c.sid, false); return; }
  const sorted = au.map(sid => [knownR(sid, w.k), sid]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  c.fi = ((c.fi == null ? -1 : c.fi) + 1) % sorted.length; playSentDe(sorted[c.fi], false);
}
function playCard(c) {
  if (c.type === 'sent' || c.type === 'dict' || c.type === 'trans') playSentDe(c.sid, c.slow);
  else playWordKey(c.k);
}
function startFreeList(keys, name) {
  if (!keys.length) return;
  clearTimeout(R.t);
  R.free = {t: 'mix', n: name, cf: {}, g: -1, cnt: keys.length, keys: keys.slice()};
  stopPV(); R.list = shuffle(keys.slice(), rng('f' + Date.now())); prefetchFor(R.list); R.i = 0; R.ok = 0; R.void = 0; R.card = null; R.end = false;
  renderCheck(); focusWi();
}
function hbar(okn, bad, tot) {
  return '<div class="hbar">' + (tot ? '<i class="ok" style="width:' + okn / tot * 100 + '%"></i><i class="bad" style="width:' + bad / tot * 100 + '%"></i>' : '') + '</div>';
}
function stripHtml() {
  const L = S.log[today()] || {}, done = L.t || 0, okn = L.ok || 0, tot = done + todayDue().length;
  return '<div class="hstrip"><span>Hoy ' + done + ' / ' + tot + '</span>' + hbar(okn, done - okn, tot) + '</div>';
}
function homeHtml() {
  const t = today(), L = S.log[t] || {}, done = L.t || 0, okn = L.ok || 0, bad = done - okn;
  const all = dueWords(false), list = todayDue(), n = list.length, cap = S.set.rmax == null ? 50 : S.set.rmax, capped = all.length - n;
  const st = streak(), rs = S.set.rs || 10;
  let h = '<div class="sec hoy"><div class="hoyh"><span>Hoy</span>'
    + (st.n ? '<span class="stk' + (st.on ? ' on' : '') + '">' + ico('flame') + st.n + (st.n === 1 ? ' día seguido' : ' días seguidos') + '</span>' : '') + '</div>';
  if (R.end && !R.free) { const tot = Math.max(0, R.list.length - R.void); h += '<div class="hlast">' + ico('check') + 'Sesión terminada: <b>' + R.ok + ' de ' + tot + '</b> bien</div>'; }
  h += '<div class="hoym"><div><b class="hn">' + n + '</b><span>' + (n ? 'por repasar · unos ' + Math.max(1, Math.round(n * 8 / 60)) + ' min' : 'Estás al día') + '</span></div>'
    + (n ? '<button class="btn primary" data-act="more">' + ico('arrow') + 'Empezar ' + Math.min(n, rs) + '</button>' : '') + '</div>';
  if (capped > 0) h += '<p class="hcap">' + capped + ' más esperan a mañana por el límite de ' + cap + ' al día.</p>';
  else if (!n) { const nx = Object.values(S.bag).map(b => b.due).filter(d => d > t).sort()[0]; if (nx) h += '<p class="hnx">Lo próximo: ' + fmtDue(nx) + '.</p>'; }
  if (done || n) h += hbar(okn, bad, done + n);
  if (done) h += '<div class="hst"><span>' + done + ' hechas · ' + okn + ' bien · ' + bad + ' mal</span><span>' + Math.round(okn / done * 100) + ' %</span></div>';
  h += '</div>';
  const c = bagCounts(), dueB = [0, 0, 0, 0, 0]; for (const w of list) { const b = S.bag[w.k]; dueB[b ? b.b : 1]++; }
  if (c.some(x => x) || all.length) {
    h += '<div class="sec"><div class="hoyh"><span>Bolsas</span><span>si aciertas, sube</span></div><div class="bgs">'
      + [1, 2, 3, 4].map(b => '<div class="bgc"><span class="bgn">' + b + ' · ' + BAGN[b] + '</span><span class="bgv"><b>' + c[b] + '</b>' + (dueB[b] ? '<em>' + dueB[b] + ' hoy</em>' : '') + '</span><span class="bgi">' + (b < 4 ? 'Al acertar vuelve en ' + BAG_IV[b] + ' días' : 'Al acertar, cada vez más tarde') + '</span></div>').join('')
      + '</div><p class="bgx">Si fallas: desde la bolsa 1 vuelve al bucle de escucha; desde las demás baja una bolsa y sale mañana.</p></div>';
    const days = [n]; for (let i = 1; i < 7; i++) { const d = addDays(t, i); days.push(Object.values(S.bag).filter(b => b.due === d).length + (i === 1 ? Math.max(0, capped) : 0)); }
    const mx = Math.max(1, ...days), avg = Math.round(days.reduce((x, y) => x + y, 0) / 7), WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    h += '<div class="sec"><div class="hoyh"><span>Próximos 7 días</span><span>media ' + avg + ' al día</span></div><div class="fc7">'
      + days.map((v, i) => '<div><em>' + (v || '') + '</em><i' + (i ? '' : ' class="t"') + ' style="height:' + Math.max(3, v / mx * 58) + 'px"></i><span>' + (i ? WD[new Date(addDays(t, i) + 'T12:00:00').getDay()] : 'hoy') + '</span></div>').join('') + '</div></div>';
  }
  const fk = (L.fk || []).filter(k => WBY.has(k));
  if (fk.length) h += '<div class="sec"><div class="hoyh"><span>Fallos de hoy</span><button class="btn sm" data-act="failp">' + ico('cards') + 'Practicar</button></div><div class="fls">'
    + fk.map(k => '<button data-lkw="' + esc(k) + '">' + esc(WBY.get(k).w) + '</button>').join('') + '</div></div>';
  const nl = DATA.words.filter(w => status(w.k) === 'learning').length;
  if (nl) h += '<div class="early"><button class="btn" data-act="early">' + ico('eye') + 'Adelantar las que aún escuchas<b style="font-weight:400;opacity:.7">' + nl + '</b></button></div>';
  return h;
}
function renderCheck() {
  if (!DATA) return;
  const box = $('#checkBox');
  const tlb = '<div class="tlb">' + (R.free ? '<button class="btn" data-act="fexit">' + ico('x') + 'Salir de la práctica</button>' : '<button class="btn" data-act="tl">' + ico('plus') + 'Test nuevo</button>') + '</div>';
  if (R.list.length && !R.end) {
    if (!R.card) R.card = makeCard(R.list[R.i]);
    const had = document.activeElement && document.activeElement.id === 'wi';
    box.innerHTML = (R.free ? '' : stripHtml()) + cardHtml(R.card) + tlb;
    const wi = $('#wi'); if (wi) { wi.value = R.card.input || ''; if (had) wi.focus(); }
    const c = R.card;
    if (!c.played && location.hash === '#check' && (c.type === 'listen' || c.type === 'sent' || c.type === 'dict' || (c.type === 'trans' && c.aud) || (c.type === 'mean' && c.aud))) { c.played = true; playCard(c); }
    return;
  }
  if (R.free && R.end) {
    const tot = Math.max(0, R.list.length - R.void);
    box.innerHTML = '<div class="sec rvend"><div class="prx">Práctica · ' + esc(R.free.n) + '</div><div class="big">' + R.ok + '<small>/' + tot + '</small></div><button class="btn primary" data-act="fagain">' + ico('cycle') + 'Otra vez</button></div>' + tlb;
    return;
  }
  box.innerHTML = homeHtml() + tlb;
  if (location.hash === '#check') prefetchFor(todayDue().slice(0, S.set.rs || 10).map(w => w.k));
}
