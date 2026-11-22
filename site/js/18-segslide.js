'use strict';
/* ---------- sliding selection in option rows ----------
   Same feel as the tab bar (15-tabdrop.js), in every single-choice .seg:
   - tap another option: the selected pill (a separate "thumb") springs there, stretching in the direction of
     travel, also from one line to another when the row wraps (17-wrapseg.js);
   - press the row: the pill lifts out as a drop of liquid glass (the same WebGL glass as the tab bar,
     16-lens.mjs) that refracts the options under it; drag and it follows the finger,
     then drops into the nearest option on release. Starting on the selected option it moves freely in every
     direction; starting on another one, a vertical move scrolls the page as usual.
   Multi-choice rows (.multi) and the Palabras type chips keep their plain look. Sheets that rebuild their HTML
   on every tap (the test setup) still animate: the last position is remembered per row. */
(function () {
  const SKIP = '.chips, .multi';   // .multi: several options can be on at once (no single thumb to slide)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mem = new Map();          // row key -> last thumb box, so a rebuilt row starts where the old one was
  const live = new Set();         // rows with a moving thumb
  const Z = () => ({x: 0, y: 0, w: 0, h: 0});
  let raf = 0, last = 0, drag = null, swallow = 0;

  /* real glass while lifted: one LiquidGlass instance per row, made on the first press and dropped a few seconds
     after the drop settles (each one holds a WebGL context). Until it's ready, or without WebGL, the drop shows
     a plain magnifier instead (lensOf). */
  const GLASS = {refraction: .6, chromAberration: .04, fresnel: .3, edgeHighlight: .05, specular: .08, blurAmount: 0,
    zRadius: 24, bevelMode: 0, shadowOpacity: .2, shadowSpread: 8, shadowOffsetY: 2, tintStrength: 0, saturation: .1, brightness: 0};
  function glassFor(sg) {
    clearTimeout(sg._lgIdle);
    if (!window.LiquidGlass || sg._lg || sg._lgP || sg._lgFail) return;
    const t = thumbOf(sg), h = (sg._sl ? sg._sl.t.h : t.offsetHeight) * 1.32;
    t.dataset.config = JSON.stringify(Object.assign({cornerRadius: Math.round(h / 2)}, GLASS));
    sg._lgP = window.LiquidGlass.init({root: sg, glassElements: [t], sceneFill: sceneFill(sg)}).then(inst => {
      sg._lgP = null;
      if (!sg.isConnected || !t.isConnected) { inst.destroy(); return; }
      sg._lg = inst; t.classList.add('lg'); resort(inst);
      const l = t.querySelector(':scope > .lens'); if (l) l.remove();
      inst.markChanged(t); inst.markChanged();
      if (!drag || drag.sg !== sg) idle(sg);
    }).catch(e => { sg._lgP = null; sg._lgFail = 1; console.warn('row glass unavailable', e); });
  }
  // what the glass sees behind the options: the sheet's colour, plus the grey track when the row draws it as its
  // own background (a wrapped row's track is an SVG child, which the glass captures by itself)
  function rgba(str) { const m = (str || '').match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(x => parseFloat(x)); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; }
    const h = (str || '').trim().match(/^#([0-9a-f]{6})$/i); return h ? [0, 2, 4].map(i => parseInt(h[1].slice(i, i + 2), 16)).concat(1) : null; }
  function sceneFill(sg) {
    const cs = getComputedStyle(sg), base = rgba(cs.getPropertyValue('--g-solid')) || [128, 128, 128, 1];
    const tr = sg.classList.contains('wrapped') ? null : rgba(cs.backgroundColor);
    const c = tr && tr[3] > 0 ? base.slice(0, 3).map((v, i) => Math.round(v * (1 - tr[3]) + tr[i] * tr[3])) : base.slice(0, 3);
    return 'rgb(' + c.join(',') + ')';
  }
  function resort(inst) { try { inst._sortedChildren = inst._getSortedChildren(); inst._globalDirty = true; } catch (e) {} }
  function idle(sg) {
    clearTimeout(sg._lgIdle);
    sg._lgIdle = setTimeout(() => {
      if (!sg._lg || (drag && drag.sg === sg) || live.has(sg)) return;
      sg._lg.destroy(); sg._lg = null;
      const t = sg.querySelector(':scope > .seg-thumb'); if (t) t.classList.remove('lg');
    }, 4000);
  }

  const inThumb = n => n && n.closest && n.closest('.seg-thumb');
  const keyOf = sg => sg.id || (sg.querySelector('button[data-tk]') || {dataset: {}}).dataset.tk || null;
  const optBtns = sg => [...sg.querySelectorAll('button')].filter(b => b.closest('.seg') === sg);
  const onBtns = sg => optBtns(sg).filter(b => b.classList.contains('on'));
  function boxOf(sg, b) {
    const s = sg.getBoundingClientRect(), r = b.getBoundingClientRect();
    return {x: r.left - s.left - sg.clientLeft + sg.scrollLeft, y: r.top - s.top - sg.clientTop + sg.scrollTop, w: r.width, h: r.height};
  }
  function thumbOf(sg) {
    let t = sg.querySelector(':scope > .seg-thumb');
    if (!t) {
      t = document.createElement('div'); t.className = 'seg-thumb'; t.setAttribute('aria-hidden', 'true');
      const svg = sg.querySelector(':scope > svg.wtrack'); svg ? svg.after(t) : sg.prepend(t);
    }
    return t;
  }
  // the magnifier inside the lifted drop: a copy of the row's options at their exact spots, scaled up around the
  // drop's centre (each option placed by its measured box, so it works however the row is laid out)
  function lensOf(sg, t) {
    let l = t.querySelector(':scope > .lens');
    if (!l) {
      const c = document.createElement('div');
      c.className = 'seg lens-copy'; c.style.width = sg.scrollWidth + 'px'; c.style.height = sg.scrollHeight + 'px';
      for (const b of optBtns(sg)) {
        const x = b.cloneNode(true), box = boxOf(sg, b);
        x.removeAttribute('id'); x.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
        x.classList.remove('on'); x.tabIndex = -1;
        Object.assign(x.style, {position: 'absolute', left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px', margin: 0});
        c.append(x);
      }
      l = document.createElement('div'); l.className = 'lens'; l.append(c); t.append(l);
    }
    return l;
  }
  function draw(sg) {
    const S = sg._sl, t = thumbOf(sg), L = S.lift;
    const sx = Math.min(.22, Math.abs(S.v.x) / 2600), sy = Math.min(.18, Math.abs(S.v.y) / 2600);
    const w = S.p.w * (1 + sx + L * .22), h = S.p.h * (1 - sx * .35 + sy * .2 + L * .32);
    const x = S.p.x - (w - S.p.w) / 2, y = S.p.y - (h - S.p.h) / 2;
    t.style.width = w + 'px'; t.style.height = h + 'px';
    t.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    t.style.setProperty('--lift', L.toFixed(3));
    const was = t.classList.contains('up');
    t.classList.toggle('up', L > .02);
    if (sg._lg) {
      // lifted, the drop sits above the options (z-index): the glass only refracts what's under it in its own
      // paint order, so let it sort the children again whenever that flips
      if (was !== t.classList.contains('up')) resort(sg._lg);
      sg._lg.markChanged(t); return;
    }
    if (L > .02) {
      const c = lensOf(sg, t).firstChild, cx = x + w / 2, cy = y + h / 2;
      c.style.transform = 'translate(' + -x + 'px,' + -y + 'px) translate(' + cx + 'px,' + cy + 'px) scale(1.14) translate(' + -cx + 'px,' + -cy + 'px)';
    } else { const l = t.querySelector(':scope > .lens'); if (l) l.remove(); }
  }
  function step(now) {
    const dt = Math.min(.032, (now - last) / 1000 || .016); last = now;
    for (const sg of live) {
      const S = sg._sl;
      if (!S) { live.delete(sg); continue; }
      const held = drag && drag.sg === sg, k = held ? 700 : 300, c = held ? 40 : 22; let moving = false;
      for (const q of ['x', 'y', 'w', 'h']) {
        S.v[q] += (-k * (S.p[q] - S.t[q]) - c * S.v[q]) * dt; S.p[q] += S.v[q] * dt;
        if (Math.abs(S.v[q]) > 3 || Math.abs(S.p[q] - S.t[q]) > .3) moving = true;
      }
      S.lift += (S.liftT - S.lift) * Math.min(1, dt * (S.liftT > S.lift ? 18 : 9));
      if (Math.abs(S.lift - S.liftT) > .004) moving = true; else S.lift = S.liftT;
      if (!sg.isConnected || (!moving && !held)) { S.p = {...S.t}; S.v = Z(); live.delete(sg); if (sg._lg) idle(sg); }
      if (sg.isConnected) { draw(sg); const key = keyOf(sg); if (key) mem.set(key, {...S.p}); }
    }
    raf = live.size ? requestAnimationFrame(step) : 0;
  }
  function kick(sg) { live.add(sg); if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } }
  // put the thumb on the selected option: slide from where it was, or jump there
  function place(sg, animate) {
    if (!sg.isConnected || sg.matches(SKIP) || inThumb(sg)) return;
    if (drag && drag.sg === sg) return;            // the finger is in charge
    const on = onBtns(sg);
    if (on.length !== 1 || !sg.offsetParent) {
      sg.classList.remove('slid'); const t = sg.querySelector(':scope > .seg-thumb'); if (t) t.remove(); delete sg._sl; live.delete(sg); return;
    }
    const target = boxOf(sg, on[0]), key = keyOf(sg);
    if (!sg._sl) {
      const from = animate !== false && key && mem.get(key);
      sg._sl = {p: from ? {...from} : {...target}, v: Z(), t: target, lift: 0, liftT: 0};
    } else sg._sl.t = target;
    sg.classList.add('slid');
    if (reduce || animate === false) { sg._sl.p = {...target}; sg._sl.v = Z(); }
    draw(sg); if (key) mem.set(key, {...sg._sl.p});
    const S = sg._sl;
    if (['x', 'y', 'w', 'h'].some(q => Math.abs(S.p[q] - S.t[q]) > .3) || S.lift !== S.liftT) kick(sg);
  }
  function scan(root) { (root || document).querySelectorAll('.seg').forEach(sg => place(sg, false)); }

  /* ---- press the row and drag the drop (like the tab bar: the drop lifts on press, follows the finger once it
     moves, and lands in the nearest option; a press without moving is a normal tap) ---- */
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0 || reduce) return;
    const b = e.target.closest && e.target.closest('.seg.slid button'); if (!b || b.disabled) return;
    const sg = b.closest('.seg'); if (!sg.classList.contains('slid') || !sg._sl || inThumb(sg)) return;
    swallow = 0;
    drag = {sg, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, id: e.pointerId};
    sg._sl.liftT = 1; kick(sg); glassFor(sg);
    addEventListener('pointermove', onMove, {passive: false});
    addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  }, true);
  function nearest(sg, px, py) {
    let best = null;
    for (const b of optBtns(sg)) {
      if (b.disabled) continue;
      const box = boxOf(sg, b), d = Math.hypot(box.x + box.w / 2 - px, (box.y + box.h / 2 - py) * 1.6);
      if (!best || d < best.d) best = {b, box, d};
    }
    return best;
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const sg = drag.sg, S = sg._sl;
    if (!sg.isConnected || !S) return end();
    drag.lx = e.clientX; drag.ly = e.clientY;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) drag.moved = true;
    if (!drag.moved) return;
    e.preventDefault();
    const r = sg.getBoundingClientRect();
    const px = e.clientX - r.left - sg.clientLeft + sg.scrollLeft, py = e.clientY - r.top - sg.clientTop + sg.scrollTop;
    // the drop takes the size of the option it's over and stays inside the row
    const over = nearest(sg, px, py), w = over ? over.box.w : S.t.w, h = over ? over.box.h : S.t.h;
    S.t = {x: Math.min(Math.max(px - w / 2, -4), sg.scrollWidth - w + 4), y: Math.min(Math.max(py - h / 2, -4), sg.scrollHeight - h + 4), w, h};
    kick(sg);
  }
  function onUp(e) { if (drag && e.pointerId === drag.id) end(); }
  function end() {
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
    const d = drag; drag = null;
    if (!d || !d.sg._sl) return;
    const sg = d.sg, S = sg._sl;
    S.liftT = 0;
    if (d.moved) {
      swallow = performance.now();                 // the click that follows this release isn't a tap
      // land where the finger is, not where the (still catching up) drop is
      const r = sg.getBoundingClientRect();
      const n = nearest(sg, d.lx - r.left - sg.clientLeft + sg.scrollLeft, d.ly - r.top - sg.clientTop + sg.scrollTop);
      if (n && !n.b.classList.contains('on')) { S.t = n.box; kick(sg); n.b.click(); return; }
    }
    place(sg, true); kick(sg);
  }
  document.addEventListener('click', e => {
    if (swallow && performance.now() - swallow < 350 && e.isTrusted) { e.preventDefault(); e.stopImmediatePropagation(); swallow = 0; }
  }, true);

  /* ---- follow the page ---- */
  const mo = new MutationObserver(ms => {
    const moved = new Set(), fresh = new Set();
    for (const m of ms) {
      if (inThumb(m.target)) continue;
      if (m.type === 'attributes') { const sg = m.target.closest && m.target.closest('.seg'); if (sg && m.target.tagName === 'BUTTON') moved.add(sg); continue; }
      for (const n of m.addedNodes) if (n.nodeType === 1 && !n.classList.contains('seg-thumb')) {
        if (n.matches('.seg')) fresh.add(n); else n.querySelectorAll && n.querySelectorAll('.seg').forEach(x => fresh.add(x));
      }
    }
    fresh.forEach(sg => place(sg, true));           // rebuilt row: slide from the remembered spot
    moved.forEach(sg => { if (!fresh.has(sg)) place(sg, true); });
    mo.takeRecords();
  });
  mo.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
  // the rows were regrouped: retarget (keeps a running slide going)
  addEventListener('g3000:segwrap', e => place(e.target, true), true);
  // the width changed: follow; a row that was hidden (no size) and is now shown: jump, no slide
  const ro = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => {
    const sz = Math.round(e.contentRect.width) + 'x' + Math.round(e.contentRect.height), was = e.target._sz;
    e.target._sz = sz;
    if (was !== undefined && was !== sz) place(e.target, !was.startsWith('0x'));
  })) : null;
  const observe = sg => { if (!sg._ro && !inThumb(sg)) { sg._ro = 1; if (ro) ro.observe(sg); } };
  new MutationObserver(() => document.querySelectorAll('.seg').forEach(observe)).observe(document.body, {childList: true, subtree: true});
  addEventListener('resize', () => scan());
  addEventListener('hashchange', () => setTimeout(scan, 60));
  window.segSlide = scan;
  document.querySelectorAll('.seg').forEach(observe);
  scan();
})();
