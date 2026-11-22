'use strict';
/* ---------- segmented controls that don't fit on one line ----------
   Every .seg (except the tab row and chips in Palabras, which scroll on their own) is watched. When its options
   wrap onto several lines, the buttons are grouped into one row per line and the grey track is drawn behind them
   as a shrink-wrapped shape: a pill around each line, merged with a blur + threshold filter, so the outline
   follows the chips on both sides and pinches in where two lines meet.
   Ajustes (Datos) > "Opciones largas": Envolver (this, default) or Deslizar (one line that scrolls sideways). */
(function () {
  const SKIP = '.scr, .chips';
  const NS = 'http://www.w3.org/2000/svg', M = 12;   // the track can spill M px past the rows (blur needs room)
  let busy = false, uid = 0;
  const scrollMode = () => typeof S !== 'undefined' && S.set && S.set.segw === 1;

  function flatten(sg) {
    sg.querySelector(':scope > svg.wtrack')?.remove();
    for (const r of sg.querySelectorAll(':scope > .srw')) r.replaceWith(...r.childNodes);
    sg.classList.remove('wrapped');
  }
  function trackColour(sg) {
    const m = getComputedStyle(sg).getPropertyValue('--g-track').match(/rgba?\(([^)]+)\)/);
    const c = m ? m[1].split(',').map(x => x.trim()) : ['118', '118', '128', '0.2'];
    return {rgb: 'rgb(' + c.slice(0, 3).join(',') + ')', a: c[3] === undefined ? 1 : +c[3]};
  }
  function wrapOne(sg) {
    if (busy) return;
    busy = true;
    try {
      flatten(sg);
      sg.classList.toggle('segscroll', scrollMode());
      if (scrollMode() || !sg.offsetParent) return;
      const bs = [...sg.children].filter(b => b.tagName === 'BUTTON');
      const rows = []; let top = null;
      for (const b of bs) { if (top === null || Math.abs(b.offsetTop - top) > 4) { rows.push([]); top = b.offsetTop; } rows[rows.length - 1].push(b); }
      if (rows.length < 2) return;
      sg.classList.add('wrapped');
      const ds = rows.map(r => { const d = document.createElement('div'); d.className = 'srw'; d.append(...r); sg.append(d); return d; });
      const W = sg.offsetWidth + 2 * M, H = sg.offsetHeight + 2 * M, id = 'wt' + (++uid), col = trackColour(sg);
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'wtrack'); svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', -M + ' ' + -M + ' ' + W + ' ' + H);
      svg.style.opacity = col.a;
      svg.innerHTML = '<filter id="' + id + '" x="' + -M + '" y="' + -M + '" width="' + W + '" height="' + H + '" filterUnits="userSpaceOnUse">'
        + '<feGaussianBlur stdDeviation="6"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -12"/></filter>'
        + '<g filter="url(#' + id + ')" fill="' + col.rgb + '">'
        + ds.map(d => '<rect x="' + d.offsetLeft + '" y="' + d.offsetTop + '" width="' + d.offsetWidth + '" height="' + d.offsetHeight + '" rx="' + d.offsetHeight / 2 + '"/>').join('')
        + '</g>';
      sg.prepend(svg);
    } finally { busy = false; if (mo) mo.takeRecords(); }   // our own changes aren't news
    sg.dispatchEvent(new Event('g3000:segwrap', {bubbles: true}));   // the sliding thumb (18-segslide.js) follows
  }
  let mo = null;
  const ro = 'ResizeObserver' in window ? new ResizeObserver(es => {
    for (const e of es) { const w = Math.round(e.contentRect.width); if (w && e.target._ww !== w) { e.target._ww = w; wrapOne(e.target); } }
  }) : null;
  function watch(sg) {
    if (sg.matches(SKIP)) return;
    if (!sg._wr) { sg._wr = 1; if (ro) ro.observe(sg); }
    wrapOne(sg);
  }
  function scan(root) { (root || document).querySelectorAll('.seg').forEach(watch); }
  // new segments (sheets re-render their contents) and segments whose buttons change
  mo = new MutationObserver(ms => {
    if (busy) return;
    const todo = new Set();
    const thumbOnly = m => [...m.addedNodes, ...m.removedNodes].every(n => n.nodeType === 1 && n.classList.contains('seg-thumb'));
    for (const m of ms) {
      if (thumbOnly(m)) continue;
      const own = m.target.closest && m.target.closest('.seg');
      if (own) todo.add(own);
      for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches('.seg')) todo.add(n); n.querySelectorAll && n.querySelectorAll('.seg').forEach(x => todo.add(x)); }
    }
    todo.forEach(sg => { if (sg.isConnected) watch(sg); });
  });
  mo.observe(document.body, {childList: true, subtree: true});
  // a segment inside a hidden sheet or view has no size yet: its ResizeObserver entry fires once it's shown
  addEventListener('hashchange', () => setTimeout(scan, 50));
  window.wrapSegs = scan;
  scan();
})();
