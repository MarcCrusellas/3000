'use strict';
/* ---------- player ---------- */
const A = $('#track'), PV = $('#preview');
const SILENT = URL.createObjectURL(new Blob([wav(2205)], {type: 'audio/wav'}));
let TRACK = null, building = false, pendingRebuild = null;
const cr = {pos: 0, wall: 0};
function wantKeys() { const o = []; for (const k of SEL) if (!S.known[k]) o.push(k); return o; }
function stale() {
  if (!TRACK || TRACK.sig !== signature()) return true;
  for (const k of wantKeys()) if (!TRACK.cand.has(k)) return true;
  return false;
}
function live() { return TRACK && A.src === TRACK.url; }
function itemAt(pos) {
  const m = TRACK.marks; let lo = 0, hi = m.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (m[mid].s <= pos) lo = mid; else hi = mid - 1; }
  return lo;
}
function creditRange(a, b) { let n = 0; for (const m of TRACK.marks) if (m.e > a && m.e <= b) { hear(m.k); addHist(m); n++; } return n; }
function addHist(m) {
  if (!Array.isArray(S.hist)) S.hist = [];
  if (S.hist[0] && S.hist[0].sid === m.sid && S.hist[0].k === m.k) return;
  S.hist = S.hist.filter(h => h.sid !== m.sid || h.k !== m.k);
  S.hist.unshift({k: m.k, sid: m.sid}); S.hist.length = Math.min(S.hist.length, 10); addHist.dirty = true;
}
function histRow(h) {
    const w = WBY.get(h.k), f = S.flag[h.sid];
    return '<div class="hr' + (f ? ' f-' + f : '') + (S.known[h.k] ? ' hknown' : '') + '" data-key="' + esc(h.k + '|' + h.sid) + '"><div class="t"><div class="d">' + tokText(h.sid, formsFor(w, h.sid)) + '</div><div class="e">' + (f === 'idiom' ? '<span class="fl">≈</span> ' : '') + esc(DATA.sents[h.sid].es) + '</div></div>'
      + '<button class="mb" data-act="menu" data-sid="' + h.sid + '" data-k="' + esc(h.k) + '" data-h="1" aria-label="Opciones de la frase">' + ico('more') + '</button></div>';
}
function renderHist(add) {
  const box = $('#hist'); if (!box) return;
  if (!DATA || S.set.hist === false || !Array.isArray(S.hist) || !S.hist.length) { box.innerHTML = ''; return; }
  const hs = S.hist.filter(h => WBY.get(h.k) && DATA.sents[h.sid]);
  if (add && hs.length && box.children.length) {
    const h = hs[0], key = h.k + '|' + h.sid;
    [...box.children].forEach(r => { if (r.dataset.key === key) r.remove(); });
    box.insertAdjacentHTML('afterbegin', histRow(h));
    while (box.children.length > hs.length) box.lastElementChild.remove();
    return;
  }
  box.innerHTML = hs.map(histRow).join('');
}
function tick() {
  if (!live()) return;
  const pos = A.currentTime, now = performance.now();
  if (cr.wall) {
    const D = TRACK.dur; let delta = pos - cr.pos; const wrapped = delta < -0.5; if (wrapped) delta += D;
    const wall = (now - cr.wall) / 1000 * (A.playbackRate || 1);
    if (delta <= wall + 3) {
      let n = 0;
      const loops = Math.max(0, Math.floor((wall - delta) / D + 0.02));
      logDay().s += delta + loops * D;
      if (loops) { for (const m of TRACK.marks) hear(m.k, loops); n += loops; }
      n += wrapped ? creditRange(cr.pos, D + 1) + creditRange(-1, pos) : creditRange(cr.pos, pos);
      if (n) { save(); renderBadge(); }
      if (addHist.dirty && !MENU) { addHist.dirty = false; renderHist(true); }
    }
  }
  cr.pos = pos; cr.wall = A.paused ? 0 : now;
  skipKnown(); renderNow();
}
A.addEventListener('timeupdate', tick);
A.addEventListener('play', () => { cr.pos = A.currentTime; cr.wall = performance.now(); renderPlay(); });
A.addEventListener('pause', () => { tick(); cr.wall = 0; renderPlay(); });
function curPos() { return TRACK && TRACK.seekTo ? TRACK.seekTo : (A.currentTime || 0); }
function applySeek() {
  const t = TRACK && TRACK.seekTo; if (!t || A.src !== TRACK.url) return;
  if (Math.abs(A.currentTime - t) < 0.5) { TRACK.seekTo = 0; return; }
  try { A.currentTime = t; } catch (e) {}
  if (Math.abs(A.currentTime - t) < 0.5 && !A.paused) TRACK.seekTo = 0;
}
['loadedmetadata', 'canplay', 'playing'].forEach(ev => A.addEventListener(ev, applySeek));
A.addEventListener('seeked', () => { cr.pos = A.currentTime; if (!A.paused) cr.wall = performance.now(); renderNow(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPV(); else { tick(); autoAdd(); } });
window.addEventListener('pagehide', () => { tick(); if (store.mode === 'db') flush(); });

function jump(dir) {
  if (!live()) return;
  let i = itemAt(curPos()); if (TRACK.seekTo) TRACK.seekTo = 0;
  if (dir < 0 && A.currentTime - TRACK.marks[i].s > 2) dir = 0;
  i = (i + dir + TRACK.marks.length) % TRACK.marks.length;
  A.currentTime = TRACK.marks[i].s + 0.01;
}
function media() {
  if (!('mediaSession' in navigator) || !TRACK) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({title: TRACK.title, artist: 'German 3000'});
    navigator.mediaSession.setActionHandler('play', () => A.play());
    navigator.mediaSession.setActionHandler('pause', () => A.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => jump(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => jump(1));
  } catch (e) {}
}
function setRing(f) {
  $('#ring').style.display = f == null ? 'none' : 'block';
  if (f != null) $('#ringFg').style.strokeDashoffset = String(276.5 * (1 - f));
}
async function build(autoplay) {
  if (building) return;
  const cur = TRACK && TRACK.marks.length ? TRACK.marks[itemAt(curPos())] : null, p = plan(cur && cur.k);
  if (!p.items.length) { toast(curGroup() ? 'Nada que escuchar en «' + curGroup().name + '». Revisa sus palabras y pistas.' : 'Nada que escuchar'); return; }
  building = true; setRing(0); renderPlay();
  try {
    const t = await render(p.items, setRing);
    tick();
    const old = TRACK;
    TRACK = {url: URL.createObjectURL(t.blob), blob: t.blob, marks: t.marks, dur: t.dur, day: t.day, sig: signature(), cand: new Set(p.cand), title: (curGroup() || {}).name || 'German 3000'};
    A.src = TRACK.url; A.loop = true; renderNow.last = null;
    if (old) URL.revokeObjectURL(old.url);
    cr.pos = 0; cr.wall = 0; media();
    if (autoplay) await A.play().catch(() => {});
  } catch (e) { toast('Error: ' + (e && e.message || e)); }
  building = false; setRing(null); renderPlayer();
}
function onPlay() {
  if (building || !DATA) return;
  if (!SEL.size) { next10(); return; }
  if (stale() || !live()) {
    try { if (!live()) { A.src = SILENT; const pr = A.play(); pr && pr.catch(() => {}); } } catch (e) {}
    if (stale()) { build(true); return; }
    A.src = TRACK.url;
  }
  if (A.paused) { PV.pause(); PV._resume = false; A.play().then(applySeek, () => {}); } else A.pause();
}
function changed() {
  save(); renderAll();
  if (TRACK && !A.paused && stale()) { clearTimeout(pendingRebuild); pendingRebuild = setTimeout(() => build(true), 700); }
}
let PLAYTOK = 0;
function stopPV() { PLAYTOK++; PV._resume = false; if (!PV.paused) PV.pause(); try { speechSynthesis.cancel(); } catch (e) {} }
function playBlob(blob, rate, tok) {
  if (tok != null && tok !== PLAYTOK) return Promise.resolve();
  if (document.hidden) return Promise.resolve();
  if (!A.paused) { A.pause(); PV._resume = location.hash !== '#check'; }
  if (PV.dataset.url) URL.revokeObjectURL(PV.dataset.url);
  PV.dataset.url = URL.createObjectURL(blob); PV.src = PV.dataset.url;
  try { PV.preservesPitch = true; PV.webkitPreservesPitch = true; PV.defaultPlaybackRate = rate || 1; PV.playbackRate = rate || 1; } catch (e) {}
  return PV.play();
}
PV.addEventListener('ended', () => { if (PV._resume) { PV._resume = false; if (live() && location.hash !== '#check' && !document.hidden) A.play().catch(() => {}); } });
async function previewItem(sid, btn) {
  const tok = ++PLAYTOK;
  try {
    btn && (btn.style.opacity = .5);
    const t = await render([{k: '', sid, bl: PREVB}]);
    await playBlob(t.blob, 1, tok);
  } catch (e) { toast('Error: ' + (e && e.message || e)); }
  btn && (btn.style.opacity = 1);
}
function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = .9;
    const v = speechSynthesis.getVoices().find(x => /^de([-_]|$)/i.test(x.lang)); if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}
async function playWordKey(k, rate) {
  const w = WBY.get(k), e = entry(k), tok = ++PLAYTOK;
  if (w && w.a && w.a.d) {
    try {
      await getPack(w.a.d[0]);
      await playBlob(new Blob([silence(4), wordU8(k)], {type: 'audio/mpeg'}), rate, tok); return;
    } catch (err) {}
  }
  if (tok === PLAYTOK && !document.hidden && e && 'speechSynthesis' in window) speak(e.w);
}
function saveFile(name, blob) {
  if (DL) return DL.save({filename: name, data: blob});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  return Promise.resolve();
}
