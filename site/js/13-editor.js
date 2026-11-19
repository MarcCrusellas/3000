'use strict';
/* ---------- track editor ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtS = d => String(d).replace('.', ',');
const BT = {snd: {l: 'Sonido', w: .9}, wde: {l: 'Palabra DE', s: 'Pal.', w: 2.3}, wes: {l: 'Palabra ES', s: 'Pal.', w: 2.3}, es: {l: 'Frase ES', s: 'ES', w: 3}, de: {l: 'Frase DE', s: 'DE', w: 3}, slow: {l: 'DE lenta', s: 'Lenta', w: 3.6}, p: {l: 'Pausa'}};
const PALT = ['snd', 'wde', 'wes', 'es', 'de', 'slow', 'p'];
const SNDN = ['Clic', 'Gota', 'Campana'];
const WT = ['n', 'a', 'r'], WLB = {n: 'Nuevas', a: 'Aprendiendo', r: 'Ya sé'};
const LLB = ['Nuevas', 'Aprendiendo', 'Ya sé y rondas extra'];
const FQ = ['Siempre', 'A veces', 'Apagada'], FQI = ['rep', 'shuf', 'off'];
const PRE = [
  {n: 'Vacía', b: ''},
  {n: 'Español primero', b: 'es p2 de p0.6 slow p1.5'},
  {n: 'Alemán primero', b: 'de p2 es p0.7 slow p1.5'},
  {n: 'Solo alemán', b: 'de p3 slow p1.5'},
  {n: 'Con palabra', b: 'wde p0.5 wes p0.9 es p2 de p0.6 slow p1.5'},
  {n: 'Con sonido', b: 'snd p0.3 es p2 de p0.6 slow p1.5'}
];
function parseB(str) {
  return str.split(' ').filter(Boolean).map(t => t[0] === 'p' && !isNaN(+t.slice(1)) ? {id: uid(), t: 'p', d: +t.slice(1)} : {id: uid(), t, v: 0}).filter(b => b.t !== 'p' || b.d > 0);
}
function initGroups(set) {
  const p = set.pause == null ? 2 : +set.pause, rep = set.slow === false ? 'de' : 'slow', wd = set.word ? 'wde p0.9 ' : '';
  const es = wd + 'es p' + p + ' de p0.6 ' + rep + ' p1.5', de = wd + 'de p' + Math.max(p, 1.5) + ' es p0.7 ' + rep + ' p1.5';
  const T = (name, b, s, f) => ({id: uid(), name, s, f: f || 0, b: parseB(b)});
  const loop = set.order === 'sandwich' ? [T('Alemán primero', de, [1, 1, 1])] : [T('Español primero', es, [1, 0, 0]), T('Alemán primero', de, [0, 1, 1])];
  return [
    {id: uid(), name: 'Bucle', w: {n: 1, a: 1, r: set.rev === false ? 0 : 1}, x: 1, tracks: loop},
    {id: uid(), name: 'Nuevas', w: {n: 1, a: 0, r: 0}, x: 0, tracks: [T('Con palabra', PRE[4].b, [1, 0, 0])]},
    {id: uid(), name: 'Repaso', w: {n: 0, a: 1, r: 1}, x: 1, tracks: [T('Solo alemán', PRE[3].b, [0, 1, 1]), T('Alemán primero', PRE[2].b, [0, 1, 1], 1)]}
  ];
}
function curGroup() { const G = S.groups || []; return G.find(g => g.id === S.listen) || G[0]; }
function gApplies(g, j) { return j === 2 ? !!(g.w.r || g.x) : !!g.w[WT[j]]; }
function pickTrack(g, j, r) {
  const c = g.tracks.filter(t => t.s[j] && t.f !== 2 && t.b.length);
  if (!c.length) return null;
  const al = c.filter(t => t.f === 0), so = c.filter(t => t.f === 1);
  const pool = al.length && so.length ? (r() < .25 ? so : al) : c;
  return pool[Math.floor(r() * pool.length)];
}
function eTrack(id) { for (const g of S.groups) { const i = g.tracks.findIndex(t => t.id === id); if (i >= 0) return {g, t: g.tracks[i], i}; } return null; }
function eBlock(id) { for (const g of S.groups) for (const t of g.tracks) { const i = t.b.findIndex(b => b.id === id); if (i >= 0) return {g, t, i, b: t.b[i]}; } return null; }
function reId(o) { o.id = uid(); if (o.b) o.b.forEach(b => { b.id = uid(); }); if (o.tracks) o.tracks.forEach(reId); return o; }
const cloneJ = o => JSON.parse(JSON.stringify(o));
const E = {pop: null, delArm: null, prevT: null, suppress: 0, pend: null, D: null, RZ: null, resetArm: false, dirty: false};
const edOn = () => $('#sheet').classList.contains('on') && !$('#sheet .sg[data-sec=player]').hidden;
function eBlockHtml(b) {
  const m = BT[b.t] || BT.de; let l, s, w;
  if (b.t === 'p') { l = fmtS(b.d) + ' s'; s = fmtS(b.d); w = Math.max(b.d, .35); }
  else if (b.t === 'snd') { l = '♪ ' + SNDN[b.v || 0]; s = '♪'; w = m.w; }
  else { l = m.l; s = m.s; w = m.w; }
  return '<div class="e-blk e-k-' + b.t + '" data-b="' + b.id + '" style="flex:' + w + ' 1 0"><span class="tx" data-l="' + esc(l) + '" data-s="' + esc(s) + '">' + esc(l) + '</span>' + (b.t === 'p' ? '<i class="e-rh" data-rh="' + b.id + '"></i>' : '') + '</div>';
}
function wordsText(g, t) {
  const ap = [0, 1, 2].filter(j => gApplies(g, j)), on = [0, 1, 2].filter(j => t.s[j]);
  if (!on.length) return 'Ninguna';
  if (ap.length && ap.every(j => t.s[j]) && on.every(j => ap.includes(j))) return 'Todas';
  return on.map(j => ['Nuevas', 'Aprendiendo', 'Ya sé'][j]).join(' · ');
}
function eTrackHtml(g, t) {
  const on = E.prevT === t.id, wt = wordsText(g, t);
  return '<div class="e-trk' + (t.f === 2 ? ' off' : '') + '" data-t="' + t.id + '"><div class="e-th">'
    + '<span class="e-grip" data-tdrag="' + t.id + '" aria-label="Mover pista">' + ico('grip') + '</span>'
    + '<button class="e-tn" data-name="t:' + t.id + '" data-etm="' + t.id + '">' + esc(t.name) + '</button>'
    + '<button class="e-wp' + (wt === 'Ninguna' ? ' none' : '') + '" data-wp="' + t.id + '">' + wt + '</button>'
    + '<button class="e-fq" data-fq="' + t.id + '" aria-label="' + FQ[t.f] + '">' + ico(FQI[t.f]) + '</button>'
    + '<button class="e-ic' + (on ? ' on' : '') + '" data-tplay="' + t.id + '" aria-label="Escuchar pista">' + ico(on ? 'stop' : 'play') + '</button></div>'
    + '<div class="e-lane" data-lane="' + t.id + '">' + (t.b.length ? t.b.map(eBlockHtml).join('') : '<span class="e-empty">Arrastra aquí bloques de abajo</span>') + '</div></div>';
}
function edRender() {
  if (!edOn()) return;
  const g = curGroup(); if (!g) return;
  const playing = !A.paused && live(), miss = [];
  WT.forEach((k, j) => { if (gApplies(g, j) && !g.tracks.some(t => t.s[j] && t.f !== 2 && t.b.length)) miss.push(j === 2 ? (g.w.r ? 'Ya sé' : 'Rondas extra') : WLB[k]); });
  $('#edBody').innerHTML = '<div class="e-gh"><label class="e-gsel"><select id="edSel" data-name="g:' + g.id + '" aria-label="Grupo">' + S.groups.map(x => '<option value="' + x.id + '"' + (x.id === g.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>' + ico('chev') + '</label>'
    + '<button class="e-ic" data-egm="' + g.id + '" aria-label="Opciones del grupo">' + ico('more') + '</button>'
    + '<button class="e-play" id="edPlay" data-ea="play" aria-label="Escuchar el grupo">' + ico(playing ? 'pause' : 'play') + '</button></div>'
    + '<div class="seg sm">' + WT.map(k => '<button class="' + (g.w[k] ? 'on' : '') + '" data-gw="' + k + '">' + WLB[k] + '</button>').join('') + '<button class="' + (g.x ? 'on' : '') + '" data-gx="1">Rondas extra</button></div>'
    + (miss.length ? '<div class="e-warn">Sin pista: ' + miss.join(', ') + '. Esas palabras no sonarán.</div>' : '')
    + '<div class="e-tracks">' + g.tracks.map(t => eTrackHtml(g, t)).join('') + '</div>'
    + '<button class="e-addt" data-addt="1">' + ico('plus') + ' Pista</button>'
    + '<div class="e-foot"><button class="' + (E.resetArm ? 'danger' : '') + '" data-ea="reset">' + (E.resetArm ? 'Toca otra vez para volver a las iniciales' : 'Volver a las pistas iniciales') + '</button></div>';
  edFitAll(); if (!$('#sheet').classList.contains('full')) setOff(); if (E.pop) E.pop();
}
function edFit(el) {
  const sp = el.querySelector('.tx'); if (!sp) return;
  sp.textContent = sp.dataset.l;
  if (el.scrollWidth > el.clientWidth + 1) { sp.textContent = sp.dataset.s || ''; if (el.scrollWidth > el.clientWidth + 1) sp.textContent = ''; }
}
function edFitAll() { document.querySelectorAll('#ed .e-lane .e-blk').forEach(edFit); }
window.addEventListener('resize', () => { if (edOn()) edFitAll(); });
function edSave() { E.dirty = true; save(); edRender(); }
/* popups */
const eCk = on => '<span class="e-ck">' + (on ? ico('check') : '') + '</span>';
function edCloseLayer() { $('#edLayer').innerHTML = ''; E.pop = null; }
function edPopup(html, sel, keep) {
  const an = $(sel); if (!an) { edCloseLayer(); return; }
  $('#edLayer').innerHTML = '<div class="e-scrim" data-ea="close"></div><div class="e-menu" id="edMenu">' + html + '</div>';
  const r = an.getBoundingClientRect(), m = $('#edMenu'), mh = m.offsetHeight, mw = m.offsetWidth, palTop = Math.min(innerHeight, $('#edPal').getBoundingClientRect().top);
  let top = r.bottom + 6; if (top + mh > palTop - 8) top = Math.max(8, r.top - mh - 6);
  m.style.top = top + 'px'; m.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.left + r.width / 2 - mw / 2)) + 'px';
  E.pop = keep || null;
}
function edGroupMenu(gid) {
  const it = [['ren', 'Renombrar'], ['dup', 'Duplicar'], ['new', 'Grupo nuevo']];
  if (S.groups.length > 1) it.push(['del', 'Borrar grupo']);
  E.delArm = null;
  edPopup(it.map(([a, l]) => '<button data-emi="' + a + '" data-key="g:' + gid + '" class="' + (a === 'del' ? 'danger' : '') + '">' + l + '</button>').join(''), '[data-egm="' + gid + '"]');
}
function edTrackMenu(tid) {
  const it = [['ren', 'Renombrar'], ['dup', 'Duplicar']];
  if (S.groups.length > 1) it.push(['mv', 'Mover a otro grupo']);
  it.push(['del', 'Borrar pista']);
  E.delArm = null;
  edPopup(it.map(([a, l]) => '<button data-emi="' + a + '" data-key="t:' + tid + '" class="' + (a === 'del' ? 'danger' : '') + '">' + l + '</button>').join(''), '[data-etm="' + tid + '"]');
}
function edWords(tid) {
  const f = eTrack(tid); if (!f) { edCloseLayer(); return; }
  edPopup('<div class="e-mh">Suena para</div>' + LLB.map((l, j) => '<button data-ww="' + tid + ':' + j + '">' + eCk(f.t.s[j]) + '<span>' + l + (gApplies(f.g, j) ? '' : '<small>No están en este grupo</small>') + '</span></button>').join(''), '[data-wp="' + tid + '"]', () => edWords(tid));
}
function edBlockMenu(bid) {
  const f = eBlock(bid); if (!f) { edCloseLayer(); return; }
  const b = f.b; let h;
  if (b.t === 'snd') h = '<div class="e-mh">Sonido</div>' + SNDN.map((n, i) => '<button data-bs="' + bid + ':' + i + '">' + eCk((b.v || 0) === i) + '<span>' + n + '</span></button>').join('');
  else if (b.t === 'p') h = '<div class="e-mh">Pausa</div><div class="e-stp"><button data-bp="' + bid + ':-1" aria-label="Menos">−</button><b>' + fmtS(b.d) + ' s</b><button data-bp="' + bid + ':1" aria-label="Más">+</button></div>'
    + '<div class="e-qv">' + [.5, 1, 1.5, 2, 3].map(v => '<button data-bq="' + bid + ':' + v + '" class="' + (b.d === v ? 'on' : '') + '">' + fmtS(v) + '</button>').join('') + '</div>';
  else h = '<div class="e-mh">Qué dice</div>' + ['es', 'de', 'slow', 'wde', 'wes'].map(t => '<button data-bt="' + bid + ':' + t + '">' + eCk(b.t === t) + '<span>' + BT[t].l + '</span></button>').join('');
  h += '<button data-bdel="' + bid + '" class="danger">Quitar bloque</button>';
  edPopup(h, '#ed .e-lane [data-b="' + bid + '"]', () => edBlockMenu(bid));
}
function edMove(tid) {
  const f = eTrack(tid);
  edPopup('<div class="e-mh">Mover a</div>' + S.groups.filter(g => g !== f.g).map(g => '<button data-mvto="' + tid + ':' + g.id + '">' + esc(g.name) + '</button>').join(''), '[data-etm="' + tid + '"]');
}
function edMenuAction(a, key, btn) {
  const [kind, id] = key.split(':');
  if (a === 'ren') { edCloseLayer(); edRename(key); return; }
  if (a === 'mv') { edMove(id); return; }
  if (a === 'new') {
    edCloseLayer();
    const g = {id: uid(), name: 'Grupo nuevo', w: {n: 1, a: 1, r: 1}, x: 0, tracks: [{id: uid(), name: 'Español primero', s: [1, 1, 1], f: 0, b: parseB(PRE[1].b)}]};
    S.groups.push(g); S.listen = g.id; edSave(); edRename('g:' + g.id); return;
  }
  if (a === 'dup') {
    if (kind === 't') { const f = eTrack(id), c = reId(cloneJ(f.t)); c.name += ' (copia)'; f.g.tracks.splice(f.i + 1, 0, c); }
    else { const i = S.groups.findIndex(g => g.id === id), c = reId(cloneJ(S.groups[i])); c.name += ' (copia)'; S.groups.splice(i + 1, 0, c); S.listen = c.id; }
    edCloseLayer(); edSave(); return;
  }
  if (a === 'del') {
    if (E.delArm !== key) { E.delArm = key; btn.textContent = 'Toca otra vez para borrar'; return; }
    const snapG = JSON.stringify([S.groups, S.listen]);
    const undo = () => { const x = JSON.parse(snapG); S.groups = x[0]; S.listen = x[1]; edSave(); };
    if (kind === 't') { const f = eTrack(id); f.g.tracks.splice(f.i, 1); toast('Pista borrada', 'Deshacer', undo); }
    else { S.groups = S.groups.filter(g => g.id !== id); S.listen = S.groups[0].id; toast('Grupo borrado', 'Deshacer', undo); }
    edCloseLayer(); edSave();
  }
}
function edRename(key) {
  const [kind, id] = key.split(':');
  const obj = kind === 't' ? eTrack(id).t : S.groups.find(g => g.id === id);
  const el = $('#ed [data-name="' + key + '"]'); if (!el || !obj) return;
  const box = kind === 'g' ? el.closest('.e-gsel') : el, inp = document.createElement('input');
  inp.className = 'e-ren' + (kind === 'g' ? ' big' : ''); inp.maxLength = 40; inp.value = obj.name;
  box.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const fin = () => { if (done) return; done = true; const v = inp.value.trim(); if (v) obj.name = v; edSave(); renderPlayer(); };
  inp.addEventListener('blur', fin);
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = obj.name; inp.blur(); } });
}
function edPresets() {
  const g = curGroup();
  E.pop = null;
  $('#edLayer').innerHTML = '<div class="e-scrim dim" data-ea="close"></div><div class="e-sheet"><h2>Pista nueva en ' + esc(g.name) + '</h2>'
    + PRE.map((p, i) => '<button class="e-pre" data-pre="' + i + '"><b>' + p.n + '</b>' + (p.b ? '<div class="e-lane mini">' + parseB(p.b).map(eBlockHtml).join('') + '</div>' : '<div style="font-size:13px;color:var(--muted)">Empiezas sin bloques</div>') + '</button>').join('') + '</div>';
  document.querySelectorAll('#edLayer .e-blk').forEach(edFit);
}
function edAddPreset(i) {
  const g = curGroup(), p = PRE[i];
  const t = {id: uid(), name: i ? p.n : 'Pista nueva', s: WT.map((k, j) => gApplies(g, j) ? 1 : 0), f: 0, b: parseB(p.b)};
  g.tracks.push(t); edCloseLayer(); edSave();
  const el = $('#ed [data-t="' + t.id + '"]'); if (el) el.scrollIntoView({block: 'center', behavior: 'smooth'});
}
async function edPreview(tid) {
  const f = eTrack(tid); if (!f || !f.t.b.length) { toast('Esta pista no tiene bloques'); return; }
  if (E.prevT === tid) { E.prevT = null; PV.pause(); edRender(); return; }
  if (!DATA) return;
  const it = curItem(); let k = it && it.k, sid = it && it.sid;
  if (!k) { const w = DATA.words.find(x => SEL.has(x.k)) || DATA.words[0]; k = w.k; sid = sentFor(w); }
  try { const r = await render([{k, sid, bl: f.t.b}]); E.prevT = tid; edRender(); await playBlob(r.blob); }
  catch (e) { E.prevT = null; edRender(); toast('Error: ' + (e && e.message || e)); }
}
PV.addEventListener('ended', () => { if (E.prevT) { E.prevT = null; edRender(); } });
$('#edPalRow').innerHTML = PALT.map(t => '<div class="e-blk e-k-' + t + '" data-new="' + t + '">' + (t === 'snd' ? '♪ Sonido' : BT[t].l) + '</div>').join('');
$('#ed').addEventListener('change', e => { if (e.target.id === 'edSel') { S.listen = e.target.value; edSave(); renderPlayer(); } });
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#ed, #edLayer')) return;
  if (Date.now() < E.suppress) { e.preventDefault(); e.stopPropagation(); return; }
  const q = s => e.target.closest(s); let el;
  if ((el = q('[data-ea]'))) {
    const a = el.dataset.ea;
    if (a === 'close') edCloseLayer();
    else if (a === 'play') onPlay();
    else if (a === 'reset') {
      if (!E.resetArm) { E.resetArm = true; edRender(); setTimeout(() => { if (E.resetArm) { E.resetArm = false; edRender(); } }, 4000); return; }
      E.resetArm = false;
      const snapG = JSON.stringify([S.groups, S.listen]);
      S.groups = initGroups(S.set); S.listen = S.groups[0].id; edSave();
      toast('Pistas iniciales', 'Deshacer', () => { const x = JSON.parse(snapG); S.groups = x[0]; S.listen = x[1]; edSave(); });
    }
    return;
  }
  if ((el = q('[data-emi]'))) { edMenuAction(el.dataset.emi, el.dataset.key, el); return; }
  if ((el = q('[data-mvto]'))) {
    const [tid, gid] = el.dataset.mvto.split(':'), f = eTrack(tid), to = S.groups.find(g => g.id === gid);
    f.g.tracks.splice(f.i, 1); to.tracks.push(f.t); edCloseLayer(); edSave(); toast('Pista movida a ' + to.name); return;
  }
  if ((el = q('[data-ww]'))) { const [id, j] = el.dataset.ww.split(':'), f = eTrack(id); f.t.s[j] = f.t.s[j] ? 0 : 1; edSave(); return; }
  if ((el = q('[data-bs]'))) { const [id, v] = el.dataset.bs.split(':'), f = eBlock(id); f.b.v = +v; playBlob(new Blob([silence(3), sndU8(+v)], {type: 'audio/mpeg'})).catch(() => {}); edSave(); return; }
  if ((el = q('[data-bp]'))) { const [id, s] = el.dataset.bp.split(':'), f = eBlock(id); f.b.d = Math.min(5, Math.max(.25, f.b.d + .25 * s)); edSave(); return; }
  if ((el = q('[data-bq]'))) { const [id, v] = el.dataset.bq.split(':'), f = eBlock(id); f.b.d = +v; edSave(); return; }
  if ((el = q('[data-bt]'))) { const [id, ty] = el.dataset.bt.split(':'), f = eBlock(id); f.b.t = ty; edSave(); return; }
  if ((el = q('[data-bdel]'))) {
    const f = eBlock(el.dataset.bdel), t = f.t, i = f.i, b = t.b.splice(i, 1)[0];
    edCloseLayer(); edSave(); toast('Bloque quitado', 'Deshacer', () => { t.b.splice(i, 0, b); edSave(); }); return;
  }
  if ((el = q('[data-pre]'))) { edAddPreset(+el.dataset.pre); return; }
  if ((el = q('[data-egm]'))) { edGroupMenu(el.dataset.egm); return; }
  if ((el = q('[data-etm]'))) { edTrackMenu(el.dataset.etm); return; }
  if ((el = q('[data-wp]'))) { edWords(el.dataset.wp); return; }
  if ((el = q('[data-gw]'))) { const g = curGroup(), k = el.dataset.gw; g.w[k] = g.w[k] ? 0 : 1; edSave(); return; }
  if ((el = q('[data-gx]'))) { const g = curGroup(); g.x = g.x ? 0 : 1; edSave(); return; }
  if ((el = q('[data-fq]'))) { const f = eTrack(el.dataset.fq); f.t.f = (f.t.f + 1) % 3; edSave(); toast(FQ[f.t.f]); return; }
  if ((el = q('[data-tplay]'))) { edPreview(el.dataset.tplay); return; }
  if ((el = q('[data-addt]'))) { edPresets(); return; }
  if ((el = q('.e-lane .e-blk'))) { if (!el.closest('.mini')) edBlockMenu(el.dataset.b); return; }
  if (q('.e-pal .e-blk')) toast('Mantén pulsado y arrástralo a una pista');
});
/* drag */
const edInd = $('#edInd'), edPal = $('#edPal');
$('#ed').addEventListener('pointerdown', e => {
  if (e.button > 0 || E.D || E.RZ) return;
  const rh = e.target.closest('[data-rh]');
  if (rh) { edStartResize(e, rh); return; }
  const gr = e.target.closest('[data-tdrag]');
  if (gr) { e.preventDefault(); edStartDrag(e.clientX, e.clientY, {kind: 'track', id: gr.dataset.tdrag, el: gr.closest('.e-trk')}); return; }
  const b = e.target.closest('.e-lane .e-blk, .e-pal .e-blk');
  if (!b || b.closest('.mini')) return;
  const src = b.dataset.new ? {kind: 'new', type: b.dataset.new, el: b} : {kind: 'block', id: b.dataset.b, el: b};
  E.pend = {x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, src, mouse: e.pointerType === 'mouse'};
  if (!E.pend.mouse) E.pend.timer = setTimeout(() => { if (E.pend) { const p = E.pend; E.pend = null; edStartDrag(p.lx, p.ly, p.src); } }, 380);
});
document.addEventListener('pointermove', e => {
  if (E.RZ) { edMoveResize(e); return; }
  if (E.pend) {
    const p = E.pend; p.lx = e.clientX; p.ly = e.clientY;
    const d = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (p.mouse) { if (d > 4) { E.pend = null; edStartDrag(p.x, p.y, p.src); E.D.x = e.clientX; E.D.y = e.clientY; edMoveDrag(); } }
    else if (d > 9) { clearTimeout(p.timer); E.pend = null; }
    return;
  }
  if (E.D) { E.D.x = e.clientX; E.D.y = e.clientY; edMoveDrag(); }
});
document.addEventListener('pointerup', () => {
  if (E.RZ) { edEndResize(); return; }
  if (E.pend) { clearTimeout(E.pend.timer); E.pend = null; }
  if (E.D) edDrop();
});
document.addEventListener('pointercancel', () => {
  if (E.pend) { clearTimeout(E.pend.timer); E.pend = null; }
  if (E.RZ) edEndResize();
  if (E.D) { E.D.tgt = null; E.D.moved = 1; edDrop(); }
});
document.addEventListener('touchmove', e => { if (E.D || E.RZ) e.preventDefault(); }, {passive: false});
document.addEventListener('contextmenu', e => { if (e.target.closest('#ed .e-blk, #ed .e-grip')) e.preventDefault(); });
function edStartDrag(x, y, src) {
  edCloseLayer();
  const r = src.el.getBoundingClientRect(), gh = src.el.cloneNode(true);
  gh.classList.add('e-ghost');
  if (src.kind === 'track') { gh.style.width = Math.min(r.width, 340) + 'px'; gh.querySelectorAll('button').forEach(b => b.remove()); }
  else { gh.style.width = r.width + 'px'; gh.style.height = r.height + 'px'; }
  document.body.appendChild(gh);
  E.D = {...src, x, y, x0: x, y0: y, moved: 0, ox: Math.min(x - r.left, src.kind === 'track' ? 30 : r.width), oy: y - r.top, gh, tgt: null};
  if (src.kind !== 'new') src.el.classList.add('lift');
  document.body.classList.add('edrag');
  if (src.kind === 'block') $('#edHint').textContent = 'Suelta aquí para quitar el bloque';
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (err) {}
  edMoveDrag(); requestAnimationFrame(edAutoScroll);
}
function edShowInd(l, t, w, h) { const s = edInd.style; s.display = 'block'; s.left = l + 'px'; s.top = t + 'px'; s.width = w + 'px'; s.height = h + 'px'; }
function edMoveDrag() {
  const D = E.D; if (!D) return;
  if (Math.hypot(D.x - D.x0, D.y - D.y0) > 6) D.moved = 1;
  D.gh.style.transform = 'translate(' + (D.x - D.ox) + 'px,' + (D.y - D.oy) + 'px) scale(1.04)';
  const el = document.elementFromPoint(D.x, D.y);
  edInd.style.display = 'none'; edPal.classList.remove('drop'); D.tgt = null;
  if (!el) return;
  if (D.kind === 'track') {
    if (!el.closest('#edBody')) return;
    const list = $('#edBody .e-tracks'); if (!list) return;
    const rows = [...list.querySelectorAll(':scope > .e-trk')]; let i = rows.length;
    for (let j = 0; j < rows.length; j++) { const r = rows[j].getBoundingClientRect(); if (D.y < r.top + r.height / 2) { i = j; break; } }
    const lr = list.getBoundingClientRect();
    const y = rows.length ? (i < rows.length ? rows[i].getBoundingClientRect().top : rows[rows.length - 1].getBoundingClientRect().bottom) : lr.top + 4;
    edShowInd(lr.left, y - 1.5, lr.width, 3); D.tgt = {i}; return;
  }
  if (D.kind === 'block' && el.closest('.e-pal')) { edPal.classList.add('drop'); D.tgt = {del: 1}; return; }
  const trk = el.closest('#edBody .e-trk'); if (!trk) return;
  const lane = trk.querySelector('.e-lane'), blks = [...lane.querySelectorAll('.e-blk')];
  let i = blks.length;
  for (let j = 0; j < blks.length; j++) { const r = blks[j].getBoundingClientRect(); if (D.x < r.left + r.width / 2) { i = j; break; } }
  const lr = lane.getBoundingClientRect();
  const x = blks.length ? (i < blks.length ? blks[i].getBoundingClientRect().left - 2.5 : blks[blks.length - 1].getBoundingClientRect().right + .5) : lr.left + 6;
  edShowInd(x - .5, lr.top + 3, 3, lr.height - 6); D.tgt = {lane: lane.dataset.lane, i};
}
function edAutoScroll() {
  if (!E.D) return;
  const sc = $('#sheet'), top = sc.getBoundingClientRect().top + 60, palTop = Math.min(innerHeight, edPal.getBoundingClientRect().top), bot = palTop - 50, y = E.D.y;
  let v = 0;
  if (y < top) v = -Math.ceil((top - y) / 5) - 1;
  else if (y > bot && y < palTop) v = Math.ceil((y - bot) / 5) + 1;
  if (v) { sc.scrollTop += v; edMoveDrag(); }
  requestAnimationFrame(edAutoScroll);
}
function edDrop() {
  const d = E.D; E.D = null;
  d.gh.remove(); edInd.style.display = 'none'; edPal.classList.remove('drop'); document.body.classList.remove('edrag');
  $('#edHint').textContent = 'Mantén pulsado un bloque y arrástralo a una pista';
  if (d.el) d.el.classList.remove('lift');
  E.suppress = Date.now() + 350;
  if (!d.moved && d.kind === 'block') { edBlockMenu(d.id); return; }
  if (!d.moved && d.kind === 'new') { toast('Arrástralo a una pista'); return; }
  const t = d.tgt; if (!t) return;
  if (d.kind === 'track') {
    const f = eTrack(d.id); if (!f) return;
    let i = t.i; if (f.i < i) i--; if (f.i === i) return;
    f.g.tracks.splice(f.i, 1); f.g.tracks.splice(i, 0, f.t);
  } else if (t.del) {
    const f = eBlock(d.id); if (!f) return;
    const tr = f.t, i = f.i, b = tr.b.splice(i, 1)[0];
    toast('Bloque quitado', 'Deshacer', () => { tr.b.splice(i, 0, b); edSave(); });
  } else {
    const dest = eTrack(t.lane); if (!dest) return;
    let i = t.i, blk;
    if (d.kind === 'new') blk = d.type === 'p' ? {id: uid(), t: 'p', d: 1} : {id: uid(), t: d.type, v: 0};
    else {
      const f = eBlock(d.id); if (!f) return;
      if (f.t === dest.t && f.i < i) i--;
      if (f.t === dest.t && f.i === i) return;
      blk = f.t.b.splice(f.i, 1)[0];
    }
    dest.t.b.splice(i, 0, blk);
  }
  edSave();
}
function edTip(on) {
  const t = $('#edTip'); if (!on || !E.RZ) { t.style.display = 'none'; return; }
  const r = E.RZ.el.getBoundingClientRect(); t.textContent = fmtS(E.RZ.b.d) + ' s';
  t.style.display = 'block'; t.style.left = (r.left + r.width / 2) + 'px'; t.style.top = (r.top - 8) + 'px';
}
function edStartResize(e, rh) {
  e.preventDefault(); e.stopPropagation();
  const f = eBlock(rh.dataset.rh); if (!f) return;
  E.RZ = {b: f.b, x0: e.clientX, d0: f.b.d, el: rh.parentElement, id: rh.dataset.rh, moved: false};
  E.RZ.el.classList.add('rz'); document.body.classList.add('edrag'); edTip(true);
}
function edMoveResize(e) {
  const R0 = E.RZ; if (Math.abs(e.clientX - R0.x0) > 4) R0.moved = true;
  const d = Math.min(5, Math.max(.25, Math.round((R0.d0 + (e.clientX - R0.x0) / 34) * 4) / 4));
  if (d !== R0.b.d) {
    R0.b.d = d; R0.el.style.flex = Math.max(d, .35) + ' 1 0';
    const sp = R0.el.querySelector('.tx'); sp.dataset.l = fmtS(d) + ' s'; sp.dataset.s = fmtS(d);
    edFitAll();
  }
  edTip(true);
}
function edEndResize() {
  const R0 = E.RZ;
  R0.el.classList.remove('rz'); document.body.classList.remove('edrag');
  E.RZ = null; edTip(false); E.suppress = Date.now() + 350;
  if (!R0.moved) { edBlockMenu(R0.id); return; }
  E.dirty = true; save();
}
