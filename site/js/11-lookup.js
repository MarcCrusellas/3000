'use strict';
/* ---------- lookup (tap any word) ---------- */
const LK = {k: null, el: null};
function entry(k) {
  const w = WBY.get(k); if (w) return {list: true, w: w.w, pl: w.pl, g: w.g, r: w.r, vf: w.vf, cmp: w.cmp, cs: w.cs};
  const e = DATA && DATA.ex && DATA.ex[k]; return e ? {list: false, w: e.w, pl: e.pl, g: e.g, r: e.r} : null;
}
function formsLine(e) {
  if (e.vf) { const v = e.vf; return [v.p3, v.pt, v.aux.map(a => a === 'sein' ? 'ist' : 'hat').join('/') + ' ' + v.pp].join(' · '); }
  if (e.cmp) return e.cmp.join(' · ');
  return e.cs ? '+ ' + CASES[e.cs] : '';
}
function openLookup(k, el) {
  if (!entry(k)) return;
  if (LK.el) LK.el.classList.remove('on');
  LK.k = k; LK.el = el || null; LK.lim = 12; if (LK.el) LK.el.classList.add('on');
  const lk = $('#lk'); if (!lk.classList.contains('on')) lk.classList.remove('full'); lk.scrollTop = 0;
  if (!FORMS) loadForms().then(() => { if (lk.classList.contains('on')) renderLookup(); });
  renderLookup(); sheet(true, 'lk');
}
function renderLookup() {
  const k = LK.k, e = k && entry(k); if (!e) return;
  const x = S.extra[k], w = WBY.get(k);
  const known = e.list ? !!S.known[k] : !!(x && x.s === 'known'), want = e.list ? SEL.has(k) && !S.known[k] : !!(x && x.s === 'want');
  const meta = e.list ? '#' + e.r + (S.bag[k] ? ' · bolsa ' + S.bag[k].b : '') : (e.r ? '#' + e.r + ' · ' : '') + 'fuera de las 1.000';
  const fl = formsLine(e), canPlay = (w && w.a && w.a.d) || 'speechSynthesis' in window;
  $('#lkMore').innerHTML = moreHtml(k);
  $('#lkBody').innerHTML = '<div class="lkh"><div class="lkw">' + esc(e.w) + (e.pl ? '<span class="lkp">die ' + esc(e.pl) + '</span>' : '') + '</div>'
    + '<div class="lkb">' + (canPlay ? '<button class="pv lg" data-act="lkplay" aria-label="Escuchar">' + ico('play') + '</button>' : '') + '<button class="pv lg" data-act="lkclose" aria-label="Cerrar">' + ico('x') + '</button></div></div>'
    + '<div class="lkg">' + esc(e.g) + '</div>' + (fl ? '<div class="lkf">' + esc(fl) + '</div>' : '') + '<div class="lkm">' + esc(meta) + '</div>'
    + '<div class="lka"><button class="btn' + (want ? ' on' : '') + '" data-act="lkwant">' + ico('plus') + 'Aprender</button>'
    + '<button class="btn okb' + (known ? ' on' : '') + '" data-act="lkknown">' + ico('check') + 'La sé</button></div>'
    + '<button class="lkup" data-act="full" aria-label="Ver ficha completa">' + ico('chev') + '</button>';
  lkOff();
}
function lkOff() {
  const el = $('#lk'), b = $('#lkBody');
  el.style.setProperty('--off', Math.max(0, el.offsetHeight - (b.offsetTop + b.offsetHeight + 26)) + 'px');
}
window.addEventListener('resize', () => { if ($('#lk').classList.contains('on')) lkOff(); });
let FORMS = null, formsP = null, SIDX = null;
function loadForms() { return formsP || (formsP = fetch('data/forms.json').then(r => r.ok ? r.json() : {}).catch(() => ({})).then(f => (FORMS = f))); }
function sentsOf(k) {
  if (!SIDX) { SIDX = new Map(); for (const [sid, x] of Object.entries(DATA.sents)) for (const kk of new Set(Object.values(x.m || {}))) { if (!SIDX.has(kk)) SIDX.set(kk, []); SIDX.get(kk).push(sid); } }
  const w = WBY.get(k), own = w ? w.s : [];
  return own.concat((SIDX.get(k) || []).filter(x => !own.includes(x)).sort((a, b) => DATA.sents[a].de.length - DATA.sents[b].de.length));
}
function formsIn(sid, k) { const m = DATA.sents[sid].m || {}; return Object.keys(m).filter(x => m[x] === k); }
const PRON = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
const tbl = (title, rows, wide) => '<div class="tb' + (wide ? ' wide' : '') + '"><h4>' + title + '</h4><table>' + rows.map(([a, b]) => '<tr><td>' + esc(a) + '</td><td>' + esc(b) + '</td></tr>').join('') + '</table></div>';
const dfmt = d => d <= today() ? 'hoy' : dlabel(d);
function moreHtml(k) {
  const e = entry(k), f = FORMS && FORMS[k], w = WBY.get(k); let h = '';
  const pr = a => a.map((x, i) => [PRON[i], x]);
  if (f && f.pr) h += '<div class="ft">' + tbl('Presente', pr(f.pr)) + (f.pt ? tbl('Präteritum', pr(f.pt)) : '') + tbl('Perfekt', pr(f.pf), true)
    + (f.imp ? tbl('Imperativo', [['du', f.imp[0]], ['ihr', f.imp[1]], ['Sie', f.imp[2]]], !f.k2) : '') + (f.k2 ? tbl('Konjunktiv II', pr(f.k2)) : '') + '</div>';
  else if (f && f.sg) { const C = [['Nom.', 0], ['Akk.', 3], ['Dat.', 2], ['Gen.', 1]]; h += '<div class="ft">' + tbl('Singular', C.map(([n, i]) => [n, f.sg[i]])) + (f.pl ? tbl('Plural', C.map(([n, i]) => [n, f.pl[i]])) : '') + '</div>'; }
  else if (e.cmp) h += '<div class="ft">' + tbl('Grados', [['', e.w], ['más', e.cmp[0]], ['el más', e.cmp[1]]], true) + '</div>';
  else if (!FORMS) h += '<p class="lkm">…</p>';
  const ss = sentsOf(k);
  if (ss.length) h += '<h3>Frases <b>' + ss.length + '</b></h3><div class="fs">' + ss.slice(0, LK.lim).map(sid => '<div class="sent' + (S.flag[sid] ? ' f-' + S.flag[sid] : '') + '"><div class="t"><div class="d">' + tokText(sid, formsIn(sid, k)) + '</div><div class="e">' + (S.flag[sid] === 'idiom' ? '<span class="fl">≈</span> ' : '') + esc(DATA.sents[sid].es) + '</div></div>'
    + '<button class="pv" data-act="pv" data-sid="' + sid + '" aria-label="Escuchar">' + ico('play') + '</button><button class="mb" data-act="menu" data-sid="' + sid + '" aria-label="Opciones de la frase">' + ico('more') + '</button></div>').join('') + '</div>'
    + (ss.length > LK.lim ? '<div style="text-align:center;margin-top:10px"><button class="btn" data-act="lkmore">' + (ss.length - LK.lim) + ' más</button></div>' : '');
  if (w) {
    const p = prog(k), b = S.bag[k];
    h += '<h3>Tu progreso</h3><dl><dt>Escuchas</dt><dd>' + p.h + '</dd>' + (b ? '<dt>Bolsa</dt><dd>' + b.b + ' · ' + BAGN[b.b] + '</dd><dt>Próximo repaso</dt><dd>' + dfmt(b.due) + '</dd>' : '') + '<dt>Fallos</dt><dd>' + (p.x || 0) + '</dd></dl>';
  }
  return h;
}
function lkFull(on) {
  const el = $('#lk'); if (!on) el.scrollTop = 0; el.classList.toggle('full', on);
}
const FL = [['idiom', 'Frase hecha'], ['bad', 'Mala traducción'], ['skip', 'No usar']];
let MENU = null;
function openMenu(sid, btn) {
  const m = $('#menu'); MENU = sid;
  const k = btn.dataset.k, h = btn.dataset.h ? ' data-h="1"' : '';
  m.innerHTML = (k ? '<button data-nx="' + esc(k) + '"' + h + '>Otra frase' + ico('cycle') + '</button>' : '')
    + (k && h && !S.known[k] ? '<button data-kn="' + esc(k) + '">Ya la sé' + ico('check') + '</button>' : '') + FL.map(([v, l]) => '<button data-fl="' + v + '"' + (S.flag[sid] === v ? ' class="on"' : '') + '>' + l + (S.flag[sid] === v ? ico('check') : '') + '</button>').join('');
  m.hidden = false; const r = btn.getBoundingClientRect(), mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - 228, r.right - 220)) + 'px';
  const lim = innerHeight - ($('#lk').classList.contains('on') ? 10 : 76);
  m.style.top = (r.bottom + mh + 6 > lim ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px';
}
function closeMenu() { $('#menu').hidden = true; MENU = null; if (addHist.dirty) { addHist.dirty = false; renderHist(); } }
function lkWant() {
  const k = LK.k, e = entry(k); if (!e) return;
  if (e.list) {
    if (S.known[k]) { unmarkKnown(k); if (!S.sel.includes(k)) S.sel.push(k); }
    else if (SEL.has(k)) S.sel = S.sel.filter(x => x !== k);
    else { S.sel.push(k); logDay().a++; }
    syncSel();
  } else if (S.extra[k] && S.extra[k].s === 'want') delete S.extra[k];
  else { S.extra[k] = {s: 'want', d: today()}; toast('Guardada en Otras'); }
  changed(); renderLookup();
}
function lkKnown() {
  const k = LK.k, e = entry(k); if (!e) return;
  if (e.list) { if (S.known[k]) unmarkKnown(k); else markKnown(k); }
  else if (S.extra[k] && S.extra[k].s === 'known') delete S.extra[k];
  else { S.extra[k] = {s: 'known', d: today()}; toast('Guardada en Otras'); }
  changed(); renderLookup();
}
function renderAll() { renderPlayer(); renderWords(); renderCheck(); renderBadge(); renderStats(); }
