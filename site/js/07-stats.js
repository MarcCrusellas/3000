'use strict';
/* ---------- stats ---------- */
function logDay() { const t = today(); return S.log[t] || (S.log[t] = {h: 0, s: 0, a: 0}); }
const charts = {}; let metric = 'h', cumDay = false;
document.addEventListener('click', e => { if (e.target.id === 'cumChart') { cumDay = !cumDay; renderStats(); } });
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dlabel = d => +d.slice(8) + ' ' + MES[+d.slice(5, 7) - 1];
function daysBetween(a, b) {
  const out = [], d = new Date(a + 'T12:00:00'), end = new Date(b + 'T12:00:00');
  while (d <= end && out.length < 2000) { out.push(d.toLocaleDateString('sv-SE')); d.setDate(d.getDate() + 1); }
  return out;
}
function lastDays(n) { const d = new Date(); d.setDate(d.getDate() - n + 1); return daysBetween(d.toLocaleDateString('sv-SE'), today()); }
function cssv(k) { return getComputedStyle(document.documentElement).getPropertyValue(k).trim(); }
function fmtMin(sec) { const m = Math.round(sec / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
function renderStats() {
  if (!DATA || !$('#v-stats').classList.contains('on')) return;
  const L = S.log, knownDates = Object.values(S.known).filter(x => typeof x === 'string');
  const learnedOn = {}; knownDates.forEach(d => { learnedOn[d] = (learnedOn[d] || 0) + 1; });
  const K = Object.keys(S.known).length, t = today(), lg = d => L[d] || {h: 0, s: 0, a: 0};
  const inProg = DATA.words.filter(w => SEL.has(w.k) && !S.known[w.k]).length;
  const wk = lastDays(7).reduce((s, d) => s + (learnedOn[d] || 0), 0);
  $('#sKnown').innerHTML = K + '<small>sé</small>';
  $('#sDelta').innerHTML = '<b>+' + wk + '</b> esta semana · <b>' + inProg + '</b> en curso · <b>' + (K / 10).toFixed(1).replace('.', ',') + '%</b> de las 1.000';
  const first = [...Object.keys(L), ...knownDates, t].sort()[0];
  const all = daysBetween(first, t); let acc = 0;
  const cum = all.map(d => (acc += learnedOn[d] || 0));
  const sp = $('#spark'), W = 300, H = 84, mx = Math.max(1, ...cum);
  const pts = cum.map((v, i) => [cum.length === 1 ? W : i / (cum.length - 1) * W, H - 4 - v / mx * (H - 10)]);
  if (pts.length === 1) pts.unshift([0, pts[0][1]]);
  sp.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  sp.innerHTML = '<path d="' + line + 'L' + W + ' ' + H + 'L0 ' + H + 'Z" fill="' + cssv('--acc-soft') + '"/><path d="' + line + '" fill="none" stroke="' + cssv('--acc') + '" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>';
  let streak = 0; { const ds = lastDays(400).reverse(); let i = lg(ds[0]).h ? 0 : 1; for (; i < ds.length && lg(ds[i]).h > 0; i++) streak++; }
  const w7 = lastDays(7), avg = w7.reduce((s, d) => s + lg(d).h, 0) / 7;
  const totS = Object.values(L).reduce((s, x) => s + (x.s || 0), 0), totH = Object.values(L).reduce((s, x) => s + (x.h || 0), 0);
  const tile = (l, v, s) => '<div class="tile"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>';
  $('#tiles').innerHTML = tile('Hoy', lg(t).h, 'escuchas · ' + fmtMin(lg(t).s)) + tile('Racha', streak, streak === 1 ? 'día' : 'días seguidos')
    + tile('Media 7 días', Math.round(avg), 'escuchas al día') + tile('Total', fmtMin(totS), totH + ' escuchas');
  document.querySelectorAll('#metricSeg button').forEach(b => b.classList.toggle('on', b.dataset.x === metric));
  const d30 = lastDays(30), val = d => metric === 'h' ? lg(d).h : metric === 'm' ? Math.round(lg(d).s / 60) : (learnedOn[d] || 0);
  const vals = d30.map(val), active = d30.filter(d => lg(d).h > 0).length;
  const best = d30.reduce((b, d) => (val(d) > val(b) ? d : b), d30[0]);
  const unit = metric === 'h' ? ' escuchas' : metric === 'm' ? ' min' : ' palabras';
  $('#dayStats').innerHTML = '<dt>Mejor día</dt><dd>' + (val(best) ? dlabel(best) + ' · ' + val(best) + unit : '–') + '</dd><dt>Días activos</dt><dd>' + active + ' de 30</dd>'
    + '<dt>Total 30 días</dt><dd>' + vals.reduce((a, b) => a + b, 0) + unit + '</dd>';
  const bc = bagCounts(), bmx = Math.max(1, ...bc.slice(1));
  $('#bagChart').innerHTML = [1, 2, 3, 4].map(b => '<div class="band bw"><span class="lb">' + b + ' · ' + BAGN[b] + '</span><span class="tr"><i style="width:' + (bc[b] / bmx * 100) + '%;background:var(--good);opacity:' + (.4 + b * .15) + '"></i></span><span class="ct">' + bc[b] + '</span></div>').join('');
  const t7 = lastDays(7).reduce((a, d) => [a[0] + (lg(d).t || 0), a[1] + (lg(d).ok || 0)], [0, 0]);
  const xs = Object.values(S.extra), xk = xs.filter(x => x.s === 'known').length;
  $('#bagStats').innerHTML = '<dt>Para hoy</dt><dd>' + todayDue().length + '</dd><dt>Aciertos 7 días</dt><dd>' + (t7[0] ? Math.round(t7[1] / t7[0] * 100) + '% de ' + t7[0] : '–') + '</dd>'
    + '<dt>Fuera de las 1.000</dt><dd>' + (xs.length ? xk + ' sé · ' + (xs.length - xk) + ' por aprender' : '–') + '</dd>';
  if (!window.Chart) return;
  Chart.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif'; Chart.defaults.color = cssv('--muted');
  const grid = cssv('--grid'), ink = cssv('--ink'), accC = cssv('--acc');
  const axes = {x: {grid: {display: false}, border: {display: false}, ticks: {maxRotation: 0, autoSkip: true, maxTicksLimit: 6}},
                y: {beginAtZero: true, grid: {color: grid}, border: {display: false}, ticks: {precision: 0, maxTicksLimit: 5}}};
  const base = {responsive: true, maintainAspectRatio: false, animation: false, plugins: {legend: {display: false}, tooltip: {displayColors: false}}, scales: axes};
  charts.day && charts.day.destroy();
  charts.day = new Chart($('#dayChart'), {type: 'bar', data: {labels: d30.map(dlabel), datasets: [{data: vals, backgroundColor: d30.map(d => d === t ? accC : ink), borderRadius: 4, maxBarThickness: 14}]},
    options: {...base, plugins: {...base.plugins, tooltip: {displayColors: false, callbacks: {label: c => c.parsed.y + unit}}}}});
  charts.cum && charts.cum.destroy();
  $('#cumH').textContent = cumDay ? 'Aprendidas por día' : 'Aprendidas';
  $('#cumHint').textContent = cumDay ? 'Barras: cuántas palabras entraron (o salieron, en negativo) de cada bolsa. Toca para ver el total.' : 'Toca la gráfica para verlo día a día, con las bolsas.';
  if (cumDay) {
    const gc = cssv('--good'), bgv = (d, b) => ((lg(d).bg || [])[b]) || 0;
    const ds = [1, 2, 3, 4].map(b => ({type: 'bar', label: 'Bolsa ' + b + ' · ' + BAGN[b], data: all.map(d => bgv(d, b)), backgroundColor: gc, stack: 'b', borderRadius: 2, maxBarThickness: 18, order: 2}));
    const hx = gc.replace('#', ''), rgb = hx.length === 6 ? [0, 2, 4].map(i => parseInt(hx.slice(i, i + 2), 16)).join(',') : null;
    ds.forEach((x, i) => { x.backgroundColor = rgb ? 'rgba(' + rgb + ',' + (.3 + i * .23) + ')' : gc; });
    ds.push({type: 'line', label: 'Aprendidas', data: all.map(d => learnedOn[d] || 0), borderColor: accC, backgroundColor: accC, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, tension: .2, order: 1});
    charts.cum = new Chart($('#cumChart'), {type: 'bar', data: {labels: all.map(dlabel), datasets: ds},
      options: {...base, scales: {x: {...axes.x, stacked: true}, y: {...axes.y, beginAtZero: true, stacked: true}}, interaction: {mode: 'index', intersect: false},
        plugins: {legend: {display: true, position: 'bottom', labels: {boxWidth: 10, boxHeight: 10, font: {size: 11}}}, tooltip: {displayColors: true, filter: i => i.parsed.y !== 0, callbacks: {label: c => c.dataset.label + ': ' + (c.parsed.y > 0 && c.dataset.type === 'bar' ? '+' : '') + c.parsed.y}}}}});
  } else
  charts.cum = new Chart($('#cumChart'), {type: 'line', data: {labels: all.map(dlabel), datasets: [{data: cum, borderColor: accC, backgroundColor: cssv('--acc-soft'), fill: true, tension: .25, pointRadius: 0, borderWidth: 2.5, stepped: false}]},
    options: {...base, plugins: {...base.plugins, tooltip: {displayColors: false, callbacks: {label: c => c.parsed.y + ' palabras'}}}}});
  let h = '';
  for (let b = 0; b < 10; b++) {
    const ws = DATA.words.filter(w => Math.floor((w.r - 1) / 100) === b), n = ws.length;
    const kn = ws.filter(w => S.known[w.k]).length, ip = ws.filter(w => SEL.has(w.k) && !S.known[w.k]).length;
    h += '<div class="band"><span class="lb">' + (b * 100 + 1) + '–' + (b + 1) * 100 + '</span><span class="tr"><i style="width:' + kn / n * 100 + '%;background:var(--good)"></i><i style="width:' + ip / n * 100 + '%;background:var(--acc)"></i></span><span class="ct">' + kn + '/' + n + '</span></div>';
  }
  $('#bandsChart').innerHTML = h;
}
