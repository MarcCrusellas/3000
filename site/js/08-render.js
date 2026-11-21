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
}
function renderPlayer() {
  applyTheme();
  $('#histTog').classList.toggle('on', S.set.hist !== false); $('#markTog').classList.toggle('on', !!S.set.mark);
  $('#ltTog').classList.toggle('on', S.set.lt !== false); $('#cdTog').classList.toggle('on', S.set.cd !== false);
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
const W = {f: 'all', q: '', lim: 120};
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
function renderWords() {
  if (!DATA) return;
  document.querySelectorAll('#fSeg button').forEach(b => b.classList.toggle('on', b.dataset.f === W.f));
  $('#cSel').textContent = counts().all; $('#cKnown').textContent = Object.keys(S.known).length; $('#cX').textContent = Object.keys(S.extra).length;
  if (W.f === 'x') { $('#list').innerHTML = extraRows(); return; }
  let ws = DATA.words;
  if (W.q) { const q = norm(W.q); ws = ws.filter(w => norm(w.w + ' ' + w.g + ' ' + w.pl).includes(q)); }
  if (W.f === 'sel') ws = ws.filter(w => SEL.has(w.k) && !S.known[w.k]);
  else if (W.f === 'known') ws = ws.filter(w => S.known[w.k]);
  const lim = io ? W.lim : 1000;
  $('#list').innerHTML = ws.length ? ws.slice(0, lim).map(rowHtml).join('') + (ws.length > lim ? '<div class="more" id="more"></div>' : '') : '<div class="emptyc">' + ico('list') + '</div>';
  const m = $('#more'); if (m && io) { io.disconnect(); io.observe(m); }
}
function rowHtml(w) {
  const st = status(w.k);
  return '<div class="wr' + (SEL.has(w.k) && st !== 'known' ? ' sel' : '') + (st === 'known' ? ' known' : '') + '" data-k="' + esc(w.k) + '">'
    + '<button class="tick" data-act="tick" aria-label="Aprender">' + ico('check') + '</button>'
    + '<div class="tx"><div class="wd">' + esc(w.w) + (w.pl ? '<small>' + esc(w.pl) + '</small>' : '') + '</div><div class="gl">' + esc(w.g) + '</div></div>'
    + stIcon(w.k) + '</div>';
}
function extraRows() {
  const rk = k => (DATA.ex[k] || {}).r || 1e9, q = W.q ? norm(W.q) : '';
  return Object.keys(S.extra).filter(k => DATA.ex[k] && (!q || norm(DATA.ex[k].w + ' ' + DATA.ex[k].g).includes(q))).sort((a, b) => (S.extra[a].s === 'want' ? 0 : 1) - (S.extra[b].s === 'want' ? 0 : 1) || rk(a) - rk(b)).map(k => {
    const e = DATA.ex[k], x = S.extra[k];
    return '<div class="wr" data-x="' + esc(k) + '"><span class="xi ' + x.s + '">' + ico(x.s === 'known' ? 'check' : 'plus') + '</span>'
      + '<div class="tx"><div class="wd">' + esc(e.w) + (e.pl ? '<small>' + esc(e.pl) + '</small>' : '') + '</div><div class="gl">' + esc(e.g) + '</div></div></div>';
  }).join('') || '<div class="emptyc">' + ico('list') + '</div>';
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
function next10() {
  const add = DATA.words.filter(w => !SEL.has(w.k) && !S.known[w.k]).slice(0, 10);
  if (!add.length) return;
  S.sel.push(...add.map(w => w.k)); syncSel(); logDay().a += add.length;
  toast('+ ' + add.map(w => w.w).join(', '));
  changed();
}
