'use strict';
/* ---------- render ---------- */
function toast(t, label, fn) {
  const el = $('#toast'); el.textContent = t;
  if (label) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { el.classList.remove('on'); fn(); }; el.appendChild(b); }
  el.classList.toggle('act', !!label); el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), label ? 5000 : 2600);
}
function applyTheme() {
  const t = S.set.theme || (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  document.querySelectorAll('#segwSeg button').forEach(b => b.classList.toggle('on', +b.dataset.w === (S.set.segw === 1 ? 1 : 0)));
  if (window.wrapSegs) wrapSegs();   // the track colour follows the theme
}
function renderPlayer() {
  applyTheme();
  $('#histTog').classList.toggle('on', S.set.hist !== false); $('#markTog').classList.toggle('on', !!S.set.mark);
  $('#ltTog').classList.toggle('on', S.set.lt !== false); $('#cdTog').classList.toggle('on', S.set.cd !== false);
  for (const k of ['wt', 'wa', 'wb', 'wn', 'wp', 'wx']) $('#' + k + 'Tog').classList.toggle('on', wOn(k));
  $('#waRow').classList.toggle('dim', !wOn('wt'));
  const segOn = (id, k, v) => document.querySelectorAll(id + ' button').forEach(b => b.classList.toggle('on', +b.dataset[k] === v));
  segOn('#capSeg', 'c', S.set.cap || 6); segOn('#ndSeg', 'd', S.set.nd || 2); segOn('#rsSeg', 'r', S.set.rs || 10); segOn('#rmSeg', 'm', S.set.rmax == null ? 50 : S.set.rmax);
  const gp = $('#gpick'), gk = JSON.stringify(S.groups.map(g => [g.id, g.name]));
  if (gp.dataset.k !== gk) { gp.dataset.k = gk; gp.innerHTML = S.groups.map(g => '<option value="' + g.id + '">' + esc(g.name) + '</option>').join(''); }
  gp.value = curGroup().id;
  document.querySelectorAll('#dailySeg button').forEach(b => b.classList.toggle('on', +b.dataset.n === (S.set.daily == null ? 10 : S.set.daily)));
  if (!DATA) return;
  $('#prevBtn').disabled = $('#nextBtn').disabled = !TRACK || stale();
  $('#exportBtn').disabled = !TRACK || stale(); $('#exportBtn').style.opacity = TRACK && !stale() ? 1 : .35;
  renderPlay(); renderNow(true); renderHist();
}
function renderPlay() {
  const playing = !A.paused && live();
  $('#playIco').innerHTML = '<use href="#i-' + (playing ? 'pause' : 'play') + '"/>';
  $('#playBtn').setAttribute('aria-label', playing ? 'Pausa' : 'Play');
  const ep = $('#edPlay'); if (ep) ep.innerHTML = ico(playing ? 'pause' : 'play');
}
function wordLine(w) { return '<b>' + esc(w.w) + (w.pl ? ', ' + esc(w.pl) : '') + '</b> <span>' + esc(w.g) + '</span>'; }
function renderNow(force) {
  const box = $('#now');
  if (!DATA) return;
  if (!SEL.size) {
    if (renderNow.last !== 'empty') { renderNow.last = 'empty'; box.innerHTML = '<div class="empty-now"><button class="btn primary" id="emptyAdd" aria-label="Añadir 10 palabras">' + ico('plus') + '10</button></div>'; }
    return;
  }
  const ready = !!TRACK;
  let i = 0, pos = 0, m, total;
  if (ready) { pos = curPos(); i = itemAt(pos); m = TRACK.marks[i]; total = TRACK.marks.length; }
  else { const p = plan(); m = p.items[0]; total = p.day || p.items.length; if (!m) { box.innerHTML = ''; renderNow.last = 'none'; return; } }
  const kn = !!S.known[m.k], key = (ready ? 'T' : 'P') + i + m.sid + m.k + (S.flag[m.sid] || '') + kn;
  if (force || renderNow.last !== key) {
    renderNow.last = key;
    const s = DATA.sents[m.sid], w = WBY.get(m.k);
    box.innerHTML = '<div class="w"><span class="wl">' + wordLine(w) + '</span><button class="kn' + (kn ? ' on' : '') + '" id="knowBtn" aria-label="Ya la sé"' + (kn ? ' disabled' : '') + '>' + ico('check') + '</button></div><div class="de">' + tokText(m.sid, formsFor(w, m.sid)) + '</div><div class="es">' + (S.flag[m.sid] === 'idiom' ? '<span class="fl">≈</span> ' : '') + esc(s.es) + '</div><div class="sp"></div>'
      + '<div class="foot"><button class="mb" data-act="menu" data-sid="' + m.sid + '" data-k="' + esc(m.k) + '" aria-label="Opciones de la frase">' + ico('more') + '</button></div>';
  }
  $('#tItem').textContent = !m ? '' : !ready ? '1 / ' + total : m.x ? 'Extra · ' + m.n : m.n + ' / ' + TRACK.day;
}
function renderBadge() {
  const n = DATA ? todayDue().length : 0;
  const b = $('#checkBadge'); b.style.display = n ? 'block' : 'none'; b.textContent = n;
}

/* words */
const W = {f: 'all', q: '', lim: 120, t: '', xa: false};
/* Palabras options, all on unless switched off in Ajustes: wt type chips, wa +10 follows the type, wb blocks of 100,
   wn rank on each row, wp the Sin empezar tab, wx browse every extra word in Otras */
const wOn = k => S.set[k] !== false;
const TYPES = [['n', 'Sustantivos'], ['v', 'Verbos'], ['a', 'Adjetivos'], ['d', 'Adverbios'], ['g', 'Gramática']];
function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function bagDots(k) { const b = S.bag[k] || {b: 1, due: ''}; return '<span class="bd' + (b.due <= today() ? ' due' : '') + '">' + [1, 2, 3, 4].map(i => '<i' + (i <= b.b ? ' class="on"' : '') + '></i>').join('') + '</span>'; }
function stIcon(k) {
  const st = status(k);
  if (st === 'known') return '<span class="st">' + bagDots(k) + '</span>';
  if (st === 'off') return '<span class="st"></span>';
  if (st === 'check') return '<span class="st"><span class="ready"></span></span>';
  const f = Math.min(1, prog(k).h / GOAL), C = 62.8;
  return '<span class="st"><svg viewBox="0 0 26 26"><circle class="bg" cx="13" cy="13" r="10"/><circle class="fg" cx="13" cy="13" r="10" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - f)).toFixed(1) + '"/></svg></span>';
}
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); W.lim += 150; renderWords(); } }, {rootMargin: '600px'}) : null;
const tabF = {all: () => true, sel: w => SEL.has(w.k) && !S.known[w.k], known: w => !!S.known[w.k], todo: w => !SEL.has(w.k) && !S.known[w.k]};
const typeOk = t => !W.t || t === W.t;
function exKeys() { return Object.keys(W.xa ? DATA.ex : S.extra).filter(k => DATA.ex[k]); }
function renderWords() {
  if (!DATA) return;
  if (!wOn('wt')) W.t = '';
  if (!wOn('wp') && W.f === 'todo') W.f = 'all';
  if (!wOn('wx')) W.xa = false;
  $('#fTodo').hidden = !wOn('wp');
  document.querySelectorAll('#fSeg button').forEach(b => b.classList.toggle('on', b.dataset.f === W.f));
  const cnt = f => DATA.words.reduce((n, w) => n + (typeOk(w.t) && tabF[f](w) ? 1 : 0), 0);
  $('#cAll').textContent = cnt('all'); $('#cSel').textContent = cnt('sel'); $('#cKnown').textContent = cnt('known'); $('#cTodo').textContent = cnt('todo');
  $('#cX').textContent = Object.keys(S.extra).filter(k => DATA.ex[k] && typeOk(DATA.ex[k].t)).length;
  const ts = $('#tSeg'); ts.hidden = !wOn('wt');
  if (wOn('wt')) {
    const inTab = W.f === 'x' ? exKeys().map(k => DATA.ex[k].t) : DATA.words.filter(tabF[W.f]).map(w => w.t);
    ts.innerHTML = TYPES.map(([t, l]) => '<button data-t="' + t + '"' + (W.t === t ? ' class="on"' : '') + '>' + l + ' <b>' + inTab.filter(x => x === t).length + '</b></button>').join('');
  }
  if (W.f === 'x') { $('#list').innerHTML = extraRows(); return; }
  let ws = DATA.words.filter(w => typeOk(w.t) && tabF[W.f](w));
  if (W.q) { const q = norm(W.q); ws = ws.filter(w => norm(w.w + ' ' + w.g + ' ' + w.pl).includes(q)); }
  const lim = io ? W.lim : 3000, blocks = wOn('wb') && !W.q;
  let h = '', last = -1;
  for (const w of ws.slice(0, lim)) {
    const bk = Math.floor((w.r - 1) / 100);
    if (blocks && bk !== last) { h += blockHead(bk); last = bk; }
    h += rowHtml(w);
  }
  $('#list').classList.toggle('rkd', wOn('wn'));
  $('#list').innerHTML = ws.length ? h + (ws.length > lim ? '<div class="more" id="more"></div>' : '') : '<div class="emptyc">' + ico('list') + '</div>';
  const m = $('#more'); if (m && io) { io.disconnect(); io.observe(m); }
}
function blockKnown(bk) { let n = 0; for (const w of DATA.words) if (Math.floor((w.r - 1) / 100) === bk && S.known[w.k]) n++; return n; }
function blockHead(bk) {
  return '<button class="bh" data-b="' + bk + '"><span>' + (bk * 100 + 1) + '–' + (bk * 100 + 100) + '</span><small>' + blockKnown(bk) + ' sé</small>' + ico('chev') + '</button>';
}
function openBlocks(btn) {
  const m = $('#bjump'), have = new Set(DATA.words.filter(w => typeOk(w.t) && tabF[W.f](w)).map(w => Math.floor((w.r - 1) / 100)));
  m.innerHTML = [...have].sort((a, b) => a - b).map(bk => '<button data-jb="' + bk + '"' + (+btn.dataset.b === bk ? ' class="on"' : '') + '>' + (bk * 100 + 1) + '–' + (bk * 100 + 100) + '<small>' + blockKnown(bk) + ' sé</small></button>').join('');
  m.hidden = false; const r = btn.getBoundingClientRect(), mh = m.offsetHeight;
  m.style.left = Math.max(8, (innerWidth - m.offsetWidth) / 2) + 'px';
  m.style.top = (r.bottom + mh + 6 > innerHeight - 76 ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px';
}
function closeBlocks() { $('#bjump').hidden = true; }
function jumpBlock(bk) {
  closeBlocks();
  const ws = DATA.words.filter(w => typeOk(w.t) && tabF[W.f](w)), i = ws.findIndex(w => Math.floor((w.r - 1) / 100) === bk);
  if (i < 0) return;
  if (W.q) { W.q = ''; $('#q').value = ''; }
  if (W.lim < i + 60) W.lim = i + 60;
  renderWords();
  const hd = document.querySelector('#list .bh[data-b="' + bk + '"]');
  if (hd) window.scrollTo(0, hd.getBoundingClientRect().top + scrollY - 12);
}
function rowHtml(w) {
  const st = status(w.k);
  return '<div class="wr' + (SEL.has(w.k) && st !== 'known' ? ' sel' : '') + (st === 'known' ? ' known' : '') + '" data-k="' + esc(w.k) + '">'
    + (wOn('wn') ? '<span class="rk">' + w.r + '</span>' : '')
    + '<button class="tick" data-act="tick" aria-label="Aprender">' + ico('check') + '</button>'
    + '<div class="tx"><div class="wd">' + esc(w.w) + (w.pl ? '<small>' + esc(w.pl) + '</small>' : '') + '</div><div class="gl">' + esc(w.g) + '</div></div>'
    + stIcon(w.k) + '</div>';
}
function extraRows() {
  const rk = k => (DATA.ex[k] || {}).r || 1e9, q = W.q ? norm(W.q) : '', st = k => (S.extra[k] || {}).s;
  const top = wOn('wx') ? '<button class="xall" data-act="xall">' + (W.xa ? 'Solo las guardadas' : 'Ver las ' + Object.keys(DATA.ex).filter(k => typeOk(DATA.ex[k].t)).length) + '</button>' : '';
  const rows = exKeys().filter(k => typeOk(DATA.ex[k].t) && (!q || norm(DATA.ex[k].w + ' ' + DATA.ex[k].g).includes(q)))
    .sort((a, b) => W.xa ? rk(a) - rk(b) : (st(a) === 'want' ? 0 : 1) - (st(b) === 'want' ? 0 : 1) || rk(a) - rk(b)).map(k => {
      const e = DATA.ex[k], s = st(k);
      return '<div class="wr" data-x="' + esc(k) + '"><span class="xi ' + (s || 'none') + '">' + (s ? ico(s === 'known' ? 'check' : 'plus') : '') + '</span>'
        + '<div class="tx"><div class="wd">' + esc(e.w) + (e.pl ? '<small>' + esc(e.pl) + '</small>' : '') + '</div><div class="gl">' + esc(e.g) + '</div></div></div>';
    }).join('');
  return top + (rows || '<div class="emptyc">' + ico('list') + '</div>');
}
function toggleSel(k) {
  if (S.known[k]) { unmarkKnown(k); if (!SEL.has(k)) S.sel.push(k); }
  else if (SEL.has(k)) S.sel = S.sel.filter(x => x !== k); else S.sel.push(k);
  syncSel(); changed();
}
/* words saved under Otras that are now list words: "quiero aprenderla" joins the list, "ya la sé" counts as known */
function promoteExtras() {
  if (!DATA) return;
  let n = 0;
  for (const k of Object.keys(S.extra)) {
    if (!WBY.has(k)) continue;
    if (S.extra[k].s === 'known') { if (!S.known[k]) markKnown(k); }
    else if (!S.known[k] && !S.sel.includes(k)) S.sel.push(k);
    delete S.extra[k]; n++;
  }
  if (n) { syncSel(); changed(); }
}
function autoAdd() {
  if (!DATA) return;
  const t = today(); if (S.auto === t) return;
  S.auto = t;
  const n = S.set.daily == null ? 10 : S.set.daily;
  if (n > 0) {
    const fresh = DATA.words.filter(w => SEL.has(w.k) && !S.known[w.k] && prog(w.k).h < 4).length;
    const add = DATA.words.filter(w => !SEL.has(w.k) && !S.known[w.k]).slice(0, Math.max(0, n - fresh));
    if (add.length) { S.sel.push(...add.map(w => w.k)); syncSel(); logDay().a += add.length; toast('+ ' + add.map(w => w.w).join(', ')); }
  }
  changed();
}
function next10(fromWords) {
  const t = fromWords === true && wOn('wt') && wOn('wa') ? W.t : '';
  const add = DATA.words.filter(w => !SEL.has(w.k) && !S.known[w.k] && (!t || w.t === t)).slice(0, 10);
  if (!add.length) return;
  S.sel.push(...add.map(w => w.k)); syncSel(); logDay().a += add.length;
  toast('+ ' + add.map(w => w.w).join(', '));
  changed();
}
