'use strict';
/* ---------- events ---------- */
const VIEWS = ['player', 'words', 'check', 'stats'];
function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'player';
  VIEWS.forEach(x => $('#v-' + x).classList.toggle('on', x === v));
  document.querySelectorAll('nav.tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  window.scrollTo(0, 0); sheet(false); stopPV();
  if (v !== 'check' && R.end) { R.list = []; R.end = false; }
  if (v === 'stats') renderStats();
  if (v === 'check') renderCheck();
}
window.addEventListener('hashchange', route);
function sheet(on, id) {
  id = id || 'sheet';
  document.querySelectorAll('.sheet').forEach(x => x.classList.toggle('on', !!on && x.id === id));
  $('#scrim').classList.toggle('on', !!on);
  if (!on && LK.el) { LK.el.classList.remove('on'); LK.el = null; }
  if (!on) {
    edCloseLayer();
    if (E.prevT) { E.prevT = null; if (!PV.paused) PV.pause(); }
    if (E.dirty) { E.dirty = false; setTimeout(changed, 0); }
  }
  if (!on) { closeMenu(); setTimeout(() => { if (!$('#lk').classList.contains('on')) $('#lk').classList.remove('full'); if (!$('#sheet').classList.contains('on')) $('#sheet').classList.remove('full'); }, 260); }
}
(function () {
  const el = $('#lk'); let y0 = 0, base = 0, y = 0, drag = false, moved = false, pts = [], raf = 0;
  const off = () => parseFloat(el.style.getPropertyValue('--off')) || 0;
  const zone = e => e.target.closest('.grabz') || (e.target.closest('.lkh') && !e.target.closest('button'));
  el.addEventListener('pointerdown', e => {
    if (!zone(e)) return;
    drag = true; moved = false; y0 = e.clientY; base = el.classList.contains('full') ? 0 : off(); y = base; pts = [[e.timeStamp, e.clientY]];
    try { el.setPointerCapture(e.pointerId); } catch (x) {}
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = e.clientY - y0;
    if (!moved && Math.abs(dy) < 5) return;
    if (!moved) { moved = true; el.classList.add('drag'); if (el.classList.contains('full')) { el.scrollTop = 0; } }
    y = Math.max(0, base + dy); pts.push([e.timeStamp, e.clientY]); if (pts.length > 6) pts.shift();
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.transform = 'translate3d(0,' + y + 'px,0)'; });
  });
  const end = () => {
    if (!drag) return; drag = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const full = el.classList.contains('full');
    if (!moved) { lkFull(!full); return; }
    const a = pts[0], b = pts[pts.length - 1], v = (b[1] - a[1]) / Math.max(16, b[0] - a[0]), o = off();
    el.classList.remove('drag'); el.style.transform = '';
    const dy = y - base;
    if (!full) { if (v < -0.35 || dy < -50) lkFull(true); else if (v > 0.35 || dy > 90) sheet(false); else lkFull(false); }
    else if (dy > o + 100) sheet(false);
    else lkFull(!(v > 0.35 || dy > 90));
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
})();
$('#menu').onclick = e => {
  const nx = e.target.closest('[data-nx]');
  if (nx) {
    const k = nx.dataset.nx; S.skip[k] = (S.skip[k] || 0) + 1; closeMenu();
    if (!nx.dataset.h && TRACK) { TRACK.sig = ''; if (A.paused) setTimeout(() => build(false), 0); }
    changed(); renderNow(true); toast(nx.dataset.h ? 'Otra frase en la próxima vuelta ✓' : 'Otra frase ✓'); return;
  }
  const kn = e.target.closest('[data-kn]');
  if (kn) {
    const k = kn.dataset.kn, w = WBY.get(k), prev = snap(k); closeMenu();
    markKnown(k); changed(); skipKnown();
    toast(w.w + ' ✓', 'Deshacer', () => { restore(k, prev); changed(); }); return;
  }
  const b = e.target.closest('[data-fl]'); if (!b || !MENU) return;
  const v = b.dataset.fl, sid = MENU, on = S.flag[sid] !== v;
  if (on) S.flag[sid] = v; else delete S.flag[sid];
  closeMenu(); changed(); renderNow(true); if ($('#lk').classList.contains('on')) renderLookup();
  toast(on ? FL.find(x => x[0] === v)[1] + ' ✓' : '✓');
};
document.addEventListener('pointerdown', e => { if (MENU && !e.target.closest('#menu') && !e.target.closest('[data-act="menu"]')) closeMenu(); }, true);
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-lk]'); if (!t) return;
  e.stopPropagation(); e.preventDefault(); openLookup(t.dataset.lk, t);
}, true);
$('#lk').onclick = e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'lkplay') playWordKey(LK.k); else if (a === 'lkwant') lkWant(); else if (a === 'lkknown') lkKnown();
  else if (a === 'full') lkFull(true); else if (a === 'lkclose') sheet(false); else if (a === 'pv') previewItem(b.dataset.sid, b);
  else if (a === 'menu') openMenu(b.dataset.sid, b); else if (a === 'lkmore') { LK.lim += 20; renderLookup(); }
};
$('#expBtn').onclick = () => saveFile('german3000-progreso-' + today() + '.json', new Blob([JSON.stringify(S)], {type: 'application/json'}))
  .catch(e => { if (!(e && e.code === 'declined')) toast('Error: ' + (e && (e.message || e.code) || e)); });
$('#impBtn').onclick = () => $('#impFile').click();
$('#impFile').onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  let d = null; try { d = JSON.parse(await f.text()); } catch (err) {}
  if (!d || typeof d !== 'object' || !Array.isArray(d.sel) || !d.known || typeof d.known !== 'object') { toast('Archivo no válido'); return; }
  toast('¿Reemplazar el progreso?', 'Sí', () => { S = Object.assign(defaults(), d); syncSel(); R.list = []; R.card = null; R.end = false; changed(); sheet(false); });
};
const SECT = {player: 'Escuchar', check: 'Repasar', words: 'Palabras', stats: 'Datos'};
function openSettings(v) {
  $('#setTitle').textContent = SECT[v] || 'Ajustes';
  document.querySelectorAll('#sheet .sg').forEach(x => { x.hidden = x.dataset.sec !== v; });
  $('#sheet').classList.remove('full');
  renderPlayer(); sheet(true); $('#sheet').scrollTop = 0;
  if (v === 'player') edRender();
  setOff();
}
function setOff() {
  const el = $('#sheet'), sg = el.querySelector('.sg:not([hidden])'); if (!sg) return;
  const h = sg.offsetTop + sg.offsetHeight + 26;
  el.style.setProperty('--off', Math.max(0, el.offsetHeight - Math.min(h, innerHeight * .62)) + 'px');
}
function setFull(on) { const el = $('#sheet'); if (!on) el.scrollTop = 0; el.classList.toggle('full', on); }
window.addEventListener('resize', () => { if ($('#sheet').classList.contains('on')) setOff(); });
(function () {
  const el = $('#sheet'); let y0 = 0, base = 0, y = 0, drag = false, moved = false, pts = [], raf = 0;
  const off = () => parseFloat(el.style.getPropertyValue('--off')) || 0;
  const zone = e => e.target.closest('#sheet .grabz') || e.target.closest('#sheet .sh');
  el.addEventListener('pointerdown', e => {
    if (!zone(e)) return;
    drag = true; moved = false; y0 = e.clientY; base = el.classList.contains('full') ? 0 : off(); y = base; pts = [[e.timeStamp, e.clientY]];
    try { el.setPointerCapture(e.pointerId); } catch (x) {}
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = e.clientY - y0;
    if (!moved && Math.abs(dy) < 5) return;
    if (!moved) { moved = true; el.classList.add('drag'); if (el.classList.contains('full')) el.scrollTop = 0; }
    y = Math.max(0, base + dy); pts.push([e.timeStamp, e.clientY]); if (pts.length > 6) pts.shift();
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.transform = 'translate3d(0,' + y + 'px,0)'; });
  });
  const end = () => {
    if (!drag) return; drag = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const full = el.classList.contains('full');
    if (!moved) { setFull(!full); return; }
    const a = pts[0], b = pts[pts.length - 1], v = (b[1] - a[1]) / Math.max(16, b[0] - a[0]), o = off();
    el.classList.remove('drag'); el.style.transform = '';
    const dy = y - base;
    if (!full) { if (v < -0.35 || dy < -50) setFull(true); else if (v > 0.35 || dy > 90) sheet(false); else setFull(false); }
    else if (dy > o + 100) sheet(false);
    else setFull(!(v > 0.35 || dy > 90));
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
})();
document.querySelector('nav.tabs').addEventListener('click', e => { const a = e.target.closest('a[data-v]'); if (a && a.classList.contains('on')) { e.preventDefault(); openSettings(a.dataset.v); } });
$('#scrim').onclick = () => sheet(false);
$('#dailySeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.set.daily = +b.dataset.n; save(); renderPlayer(); };
const segH = (id, f) => { $(id).onclick = e => { const b = e.target.closest('button'); if (b) f(b); }; };
segH('#capSeg', b => { S.set.cap = +b.dataset.c; changed(); });
segH('#ndSeg', b => { S.set.nd = +b.dataset.d; changed(); });
segH('#rsSeg', b => { S.set.rs = +b.dataset.r; save(); renderPlayer(); });
segH('#rmSeg', b => { S.set.rmax = +b.dataset.m; save(); renderPlayer(); renderBadge(); renderCheck(); });
$('#ltTog').onclick = () => { S.set.lt = S.set.lt === false; save(); renderPlayer(); };
$('#cdTog').onclick = () => { S.set.cd = S.set.cd === false; save(); renderPlayer(); };
$('#gpick').onchange = e => { S.listen = e.target.value; changed(); };
$('#shiftBtn').onclick = () => { S.shift = (S.shift || 0) + 1; changed(); renderNow(true); toast('Frases nuevas ✓'); };
$('#markTog').onclick = () => { S.set.mark = !S.set.mark; save(); renderAll(); if ($('#lk').classList.contains('on')) renderLookup(); };
$('#histTog').onclick = () => { S.set.hist = S.set.hist === false; save(); renderPlayer(); };
$('#themeSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.set.theme = b.dataset.t; save(); applyTheme(); renderStats(); };
$('#metricSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; metric = b.dataset.x; renderStats(); };
$('#credBtn').onclick = () => { const c = $('#credits'), open = c.hidden; c.hidden = !open; $('#credBtn').setAttribute('aria-expanded', String(open)); };
$('#playBtn').onclick = onPlay;
$('#hist').onclick = e => { const mb = e.target.closest('[data-act="menu"]'); if (mb) openMenu(mb.dataset.sid, mb); };
$('#prevBtn').onclick = () => jump(-1);
$('#nextBtn').onclick = () => jump(1);
$('#exportBtn').onclick = exportTrack;
$('#now').onclick = e => {
  const mb = e.target.closest('[data-act="menu"]'); if (mb) { openMenu(mb.dataset.sid, mb); return; }
  if (e.target.closest('#emptyAdd')) next10(); if (e.target.closest('#knowBtn')) knowCurrent();
};
function curItem() { if (TRACK && !stale()) return TRACK.marks[itemAt(curPos())]; const p = plan(); return p.items[0]; }
function skipKnown() {
  if (!live() || A.paused) return;
  const m = TRACK.marks, i = itemAt(A.currentTime), ok = x => !S.known[x.k] || x.rv;
  if (ok(m[i])) return;
  for (let d = 1; d < m.length; d++) { const j = (i + d) % m.length; if (ok(m[j])) { A.currentTime = m[j].s + 0.01; return; } }
}
function knowCurrent() {
  const it = curItem(); if (!it || !it.k || S.known[it.k]) return;
  const k = it.k, w = WBY.get(k), prev = snap(k);
  markKnown(k); save(); renderBadge(); renderWords(); renderCheck(); renderPlayer(); skipKnown();
  toast(w.w + ' ✓', 'Deshacer', () => { restore(k, prev); save(); renderAll(); });
}
$('#next10').onclick = next10;
$('#q').oninput = e => { W.q = e.target.value.trim(); W.lim = 120; renderWords(); };
$('#fSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; W.f = b.dataset.f; W.lim = 120; renderWords(); window.scrollTo(0, 0); };
$('#list').onclick = e => {
  const xr = e.target.closest('[data-x]'); if (xr) { openLookup(xr.dataset.x); return; }
  const row = e.target.closest('[data-k]'); if (!row) return;
  const k = row.dataset.k;
  if (e.target.closest('[data-act="tick"]')) { toggleSel(k); return; }
  openLookup(k);
};
const focusWi = () => { const wi = $('#wi'); if (wi) wi.focus(); };
$('#checkBox').onclick = e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.i != null) { choose(+b.dataset.i); return; }
  if (b.dataset.key) { insertKey(b.dataset.key); return; }
  if (b.dataset.lkw) { openLookup(b.dataset.lkw); return; }
  const a = b.dataset.act;
  if (a === 'go') submitTyped();
  else if (a === 'next') { nextCard(); focusWi(); }
  else if (a === 'dunno') dunno();
  else if (a === 'hold') hold();
  else if (a === 'fix') { override(); focusWi(); }
  else if (a === 'more') { startSession(false); renderCheck(); focusWi(); }
  else if (a === 'early') { startSession(true); renderCheck(); focusWi(); }
  else if (a === 'wplay' || a === 'splay' || a === 'slow' || a === 'other') {
    const c = R.card; if (c.phase === 'ok' && !c.hold) hold();
    if (a === 'wplay') playCard(c); else if (a === 'splay') previewItem(c.sid, null); else if (a === 'slow') playSlow(c); else playOther(c);
  }
  else if (a === 'void') { voidCard(); focusWi(); }
  else if (a === 'selfok') finish(true);
  else if (a === 'selfbad') finish(false);
  else if (a === 'tl') tlOpen();
  else if (a === 'fexit') exitFree();
  else if (a === 'failp') startFreeList((S.log[today()] || {}).fk || [], 'Fallos de hoy');
  else if (a === 'fagain' && R.free && R.free.keys) startFreeList(R.free.keys, R.free.n);
  else if (a === 'fagain') { const F = R.free; TL.t = FT.findIndex(x => x.id === F.t); TL.cf = {...F.cf}; TL.g = F.g; TL.n = F.cnt; startFree(); }
};
$('#checkBox').addEventListener('mousedown', e => { if (e.target.closest('[data-key]')) e.preventDefault(); });
$('#checkBox').addEventListener('input', e => { if (e.target.id === 'wi' && R.card) R.card.input = e.target.value; });
$('#checkBox').addEventListener('keydown', e => { if (e.target.id === 'wi' && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submitTyped(); } });
$('#resetBtn').onclick = () => {
  const b = $('#resetBtn');
  if (b.dataset.armed) {
    const keep = {set: S.set, groups: S.groups, listen: S.listen, v: 7, auto: today()};
    S = Object.assign(defaults(), keep); syncSel(); R.list = []; R.card = null; R.end = false;
    if (store.mode === 'db') flush(); changed(); b.textContent = 'Borrar'; delete b.dataset.armed; sheet(false); toast('Progreso borrado');
  }
  else { b.dataset.armed = 1; b.textContent = '¿Seguro?'; setTimeout(() => { b.textContent = 'Borrar'; delete b.dataset.armed; }, 3000); }
};
function stateText() { return 'G3000:' + btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
function readStateText(x) {
  x = (x || '').trim(); let d = null;
  try { d = JSON.parse(x.startsWith('G3000:') ? decodeURIComponent(escape(atob(x.slice(6)))) : x); } catch (e) {}
  return d && typeof d === 'object' && Array.isArray(d.sel) && d.known && typeof d.known === 'object' ? d : null;
}
$('#cpBtn').onclick = () => {
  const txt = stateText();
  const show = () => { $('#tlBody').innerHTML = '<div class="tlh"><h2>Copiar progreso</h2><button class="ib" data-act="tlx" aria-label="Cerrar">' + ico('x') + '</button></div><p class="tlp">Selecciona el texto, cópialo y pégalo en «Pegar» en el otro dispositivo.</p><textarea class="cpt" readonly>' + esc(txt) + '</textarea>'; sheet(true, 'tl'); const ta = $('#tlBody textarea'); ta.focus(); ta.select(); };
  try { navigator.clipboard.writeText(txt).then(() => toast('Progreso copiado. Pégalo en «Pegar» en el otro dispositivo.'), show); } catch (e) { show(); }
};
$('#psBtn').onclick = () => {
  $('#tlBody').innerHTML = '<div class="tlh"><h2>Pegar progreso</h2><button class="ib" data-act="tlx" aria-label="Cerrar">' + ico('x') + '</button></div><p class="tlp">Pega aquí el texto copiado desde el otro dispositivo. Reemplaza el progreso de este.</p><textarea class="cpt" id="psTa" placeholder="G3000:…"></textarea><button class="btn primary tlgo" data-act="psgo">' + ico('check') + 'Cargar</button>';
  sheet(true, 'tl'); setTimeout(() => $('#psTa').focus(), 300);
};
$('#resetAllBtn').onclick = () => {
  const b = $('#resetAllBtn');
  if (b.dataset.armed) {
    S = defaults(); syncSel(); R.list = []; R.card = null; R.end = false;
    if (store.mode === 'db') flush(); changed(); b.textContent = 'Restablecer'; delete b.dataset.armed; sheet(false); toast('Todo restablecido');
  }
  else { b.dataset.armed = 1; b.textContent = '¿Seguro?'; setTimeout(() => { b.textContent = 'Restablecer'; delete b.dataset.armed; }, 3000); }
};
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if (e.key === 'Escape') { if ($('#edLayer').innerHTML) { edCloseLayer(); return; } if (MENU) closeMenu(); else sheet(false); return; }
  if (e.code === 'Space' && !typing && !/BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); onPlay(); return; }
  const c = R.card;
  if (!typing && location.hash === '#check' && c && c.phase === 'ask' && c.opts && /^[1-4]$/.test(e.key)) choose(+e.key - 1);
  if (e.key === 'Enter' && !typing && !/BUTTON/.test(document.activeElement.tagName) && location.hash === '#check' && c && c.phase !== 'ask') { e.preventDefault(); nextCard(); focusWi(); }
});
