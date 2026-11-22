'use strict';
/* ---------- sliding selection in option rows ----------
   Same feel as the tab bar (15-tabdrop.js): in every single-choice .seg the selected option's pill is a separate
   "thumb" that springs from the old option to the new one, stretching in the direction of travel, also from one
   line to another when the row wraps (17-wrapseg.js). Segments where several options can be on at once (or
   none) keep their plain per-button look. Sheets that rebuild their HTML on every tap (the test setup) still
   animate: the last position is remembered per segment. */
(function () {
  const SKIP = '.chips, .multi';   // .multi: several options can be on at once (no single thumb to slide)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mem = new Map();          // segment key -> last thumb box, so a rebuilt segment starts where the old one was
  const live = new Set();         // segments with a moving thumb
  let raf = 0, last = 0;

  const keyOf = sg => sg.id || (sg.querySelector('button[data-tk]') || {dataset: {}}).dataset.tk || null;
  const onBtns = sg => [...sg.querySelectorAll('button')].filter(b => b.classList.contains('on') && b.closest('.seg') === sg);
  function boxOf(sg, b) {
    const s = sg.getBoundingClientRect(), r = b.getBoundingClientRect();
    return {x: r.left - s.left - sg.clientLeft + sg.scrollLeft, y: r.top - s.top - sg.clientTop + sg.scrollTop, w: r.width, h: r.height};
  }
  function thumbOf(sg) {
    let t = sg.querySelector(':scope > .seg-thumb');
    if (!t) { t = document.createElement('div'); t.className = 'seg-thumb'; t.setAttribute('aria-hidden', 'true'); const svg = sg.querySelector(':scope > svg.wtrack'); svg ? svg.after(t) : sg.prepend(t); }
    return t;
  }
  function draw(sg) {
    const S = sg._sl, t = thumbOf(sg), sx = Math.min(.22, Math.abs(S.v.x) / 2600), sy = Math.min(.18, Math.abs(S.v.y) / 2600);
    const w = S.p.w * (1 + sx), h = S.p.h * (1 - sx * .35 + sy * .2);
    t.style.width = w + 'px'; t.style.height = h + 'px';
    t.style.transform = 'translate3d(' + (S.p.x - (w - S.p.w) / 2) + 'px,' + (S.p.y - (h - S.p.h) / 2) + 'px,0)';
  }
  function step(now) {
    const dt = Math.min(.032, (now - last) / 1000 || .016); last = now;
    for (const sg of live) {
      const S = sg._sl; let moving = false;
      for (const k of ['x', 'y', 'w', 'h']) {
        S.v[k] += (-300 * (S.p[k] - S.t[k]) - 22 * S.v[k]) * dt; S.p[k] += S.v[k] * dt;
        if (Math.abs(S.v[k]) > 3 || Math.abs(S.p[k] - S.t[k]) > .3) moving = true;
      }
      if (!moving || !sg.isConnected) { S.p = {...S.t}; S.v = {x: 0, y: 0, w: 0, h: 0}; live.delete(sg); }
      if (sg.isConnected) { draw(sg); const k = keyOf(sg); if (k) mem.set(k, {...S.p}); }
    }
    raf = live.size ? requestAnimationFrame(step) : 0;
  }
  // put the thumb on the selected option: animate from where it was, or jump there
  function place(sg, animate) {
    if (!sg.isConnected || sg.matches(SKIP)) return;
    const on = onBtns(sg);
    if (on.length !== 1 || !sg.offsetParent) {
      sg.classList.remove('slid'); const t = sg.querySelector(':scope > .seg-thumb'); if (t) t.remove(); delete sg._sl; live.delete(sg); return;
    }
    const target = boxOf(sg, on[0]), k = keyOf(sg);
    if (!sg._sl) {
      const from = animate !== false && k && mem.get(k);
      sg._sl = {p: from ? {...from} : {...target}, v: {x: 0, y: 0, w: 0, h: 0}, t: target};
    } else sg._sl.t = target;
    sg.classList.add('slid');
    if (reduce || animate === false) { sg._sl.p = {...target}; sg._sl.v = {x: 0, y: 0, w: 0, h: 0}; }
    draw(sg); if (k) mem.set(k, {...sg._sl.p});
    const S = sg._sl, far = ['x', 'y', 'w', 'h'].some(q => Math.abs(S.p[q] - S.t[q]) > .3);
    if (far) { live.add(sg); if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } }
  }
  function scan(root) { (root || document).querySelectorAll('.seg').forEach(sg => place(sg, false)); }

  const mo = new MutationObserver(ms => {
    const moved = new Set(), fresh = new Set();
    for (const m of ms) {
      if (m.type === 'attributes') { const sg = m.target.closest && m.target.closest('.seg'); if (sg && m.target.tagName === 'BUTTON') moved.add(sg); continue; }
      for (const n of m.addedNodes) if (n.nodeType === 1 && !n.classList.contains('seg-thumb')) {
        if (n.matches('.seg')) fresh.add(n); else n.querySelectorAll && n.querySelectorAll('.seg').forEach(x => fresh.add(x));
      }
    }
    fresh.forEach(sg => place(sg, true));           // rebuilt segment: slide from the remembered spot
    moved.forEach(sg => { if (!fresh.has(sg)) place(sg, true); });
    mo.takeRecords();
  });
  mo.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
  // the rows were regrouped: retarget; the width changed or a sheet was shown: put thumbs back without animating
  addEventListener('g3000:segwrap', e => place(e.target, true), true);   // keeps a running slide going
  const ro = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => {
    const sz = Math.round(e.contentRect.width) + 'x' + Math.round(e.contentRect.height), was = e.target._sz;
    e.target._sz = sz;
    if (was !== undefined && was !== sz) place(e.target, !was.startsWith('0x'));   // first look (just shown): no slide
  })) : null;
  new MutationObserver(() => document.querySelectorAll('.seg:not(.slid-seen)').forEach(sg => { sg.classList.add('slid-seen'); if (ro) ro.observe(sg); }))
    .observe(document.body, {childList: true, subtree: true});
  addEventListener('resize', () => scan());
  addEventListener('hashchange', () => setTimeout(scan, 60));
  window.segSlide = scan;
  document.querySelectorAll('.seg').forEach(sg => { sg.classList.add('slid-seen'); if (ro) ro.observe(sg); });
  scan();
})();
