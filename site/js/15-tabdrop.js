'use strict';
/* ---------- liquid tab drop ----------
   Two pieces move together on one spring:
   - .tab-pill: the resting selection, under the icons;
   - .tab-drop: the glass, above the icons, only visible while lifted. With LiquidGlass running
     (16-lens.mjs) the library draws it as real refracting glass; otherwise a simple magnifier.
   Tap another tab: the selection slides there, stretching in the direction of travel.
   Press and drag along the bar: the glass lifts out of the bar, follows the finger, magnifies
   what's under it and drops into the nearest tab on release.
   Tapping the tab that's already selected still opens its settings (handled in 12-events). */
(function () {
  const bar = document.querySelector('nav.tabs .in');
  if (!bar) return;
  const tabs = [...bar.querySelectorAll('a[data-v]')];
  tabs.forEach(t => t.setAttribute('draggable', 'false'));

  // inline the icons (<use> references can't be captured for the glass)
  tabs.forEach(t => t.querySelectorAll('svg use').forEach(u => {
    const sym = document.querySelector(u.getAttribute('href'));
    const svg = u.closest('svg');
    if (!sym || !svg) return;
    svg.setAttribute('viewBox', sym.getAttribute('viewBox') || '0 0 24 24');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = sym.innerHTML;
    u.replaceWith(g);
  }));

  const pill = document.createElement('div');
  pill.className = 'tab-pill'; pill.setAttribute('aria-hidden', 'true');
  bar.prepend(pill);
  // the bar's colour as a layer of its own: the glass library never captures its root, only children
  const bg = document.createElement('div');
  bg.className = 'tab-bg'; bg.setAttribute('aria-hidden', 'true');
  bar.prepend(bg);
  const drop = document.createElement('div');
  drop.className = 'tab-drop'; drop.setAttribute('aria-hidden', 'true');
  drop.innerHTML = '<span class="lens"><span class="lv rim"></span><span class="lv core"></span></span>';
  bar.append(drop);
  const lvs = [...drop.querySelectorAll('.lv')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let G = null, x = 0, v = 0, target = 0, lift = 0, liftT = 0, raf = 0, last = 0, drag = null, swallowClick = false;

  function geo() {
    const b = bar.getBoundingClientRect();
    return {b, w: tabs[0].getBoundingClientRect().width, xs: tabs.map(t => t.getBoundingClientRect().left - b.left)};
  }
  const current = () => Math.max(0, tabs.findIndex(t => t.classList.contains('on')));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  // fallback lens (no WebGL): a copy of the bar, magnified in the middle, compressed at the rim
  function fillLens() {
    const html = tabs.map(t => '<span class="' + (t.classList.contains('on') ? 'on' : '') + '">' + t.innerHTML + '</span>').join('');
    const w = bar.getBoundingClientRect().width + 'px';
    lvs.forEach(l => { l.innerHTML = html; l.style.width = w; });
  }

  function render() {
    const s = Math.min(.42, Math.abs(v) / 2400), L = lift;
    pill.style.width = G.w + 'px';
    pill.style.transform = `translate3d(${x}px,0,0) scale(${1 + s}, ${1 - s * .4})`;
    pill.style.opacity = (1 - L).toFixed(3);
    // the glass grows by size, not by scale: the glass library reads the layout box, a scale would throw it off
    const dw = G.w * (1 + s + L * .24), dh = 56 * (1 - s * .4 + L * .3);
    drop.style.width = dw + 'px'; drop.style.height = dh + 'px'; drop.style.borderRadius = dh / 2 + 'px';
    drop.style.transform = `translate3d(${x - (dw - G.w) / 2}px,${-(dh - 56) / 2}px,0)`;
    drop.style.setProperty('--lift', L.toFixed(3));
    const cx = x + G.w / 2, cy = 33, ox = -(x - (dw - G.w) / 2), oy = (dh - 56) / 2;
    lvs[0].style.transform = `translate(${ox}px,${oy}px) translate(${cx}px,${cy}px) scale(.86) translate(${-cx}px,${-cy}px)`;
    lvs[1].style.transform = `translate(${ox}px,${oy}px) translate(${cx}px,${cy}px) scale(1.12) translate(${-cx}px,${-cy}px)`;
  }

  function step(t) {
    const dt = Math.min(.032, (t - last) / 1000 || .016); last = t;
    const k = drag ? 700 : 300, c = drag ? 40 : 20;           // firm while dragging, bouncier when settling
    v += (-k * (x - target) - c * v) * dt; x += v * dt;
    lift += (liftT - lift) * Math.min(1, dt * (liftT > lift ? 18 : 9));
    render();
    if (drag || Math.abs(v) > 3 || Math.abs(x - target) > .3 || Math.abs(lift - liftT) > .004) raf = requestAnimationFrame(step);
    else { x = target; v = 0; lift = liftT; render(); raf = 0; }
  }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } }

  function settle(jump) {
    G = geo(); target = G.xs[current()];
    if (jump || reduce) { x = target; v = 0; lift = liftT = 0; render(); } else kick();
  }

  addEventListener('hashchange', () => setTimeout(() => settle(false), 0));
  addEventListener('resize', () => settle(true));

  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0 || reduce) return;
    if (e.pointerType === 'mouse') e.preventDefault();      // no native link drag / text selection
    G = geo(); fillLens();
    drag = {sx: e.clientX, moved: false};
    liftT = 1; kick();
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp, {once: true});
    addEventListener('pointercancel', onUp, {once: true});
  });
  function onMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.sx) > 8) drag.moved = true;
    if (drag.moved) { target = clamp(e.clientX - G.b.left - G.w / 2, G.xs[0], G.xs[G.xs.length - 1]); kick(); }
  }
  function onUp() {
    removeEventListener('pointermove', onMove);
    const d = drag; drag = null; liftT = 0;
    if (d && d.moved) {
      const c = x + G.w / 2;
      let best = 0; G.xs.forEach((p, i) => { if (Math.abs(p + G.w / 2 - c) < Math.abs(G.xs[best] + G.w / 2 - c)) best = i; });
      swallowClick = true; setTimeout(() => { swallowClick = false; }, 400);
      const v2 = tabs[best].dataset.v;
      if (location.hash !== '#' + v2) location.hash = v2; else settle(false);
    }
    kick();
  }
  // a drag ends on some tab: don't let that turn into a click (which would open settings)
  bar.addEventListener('click', e => { if (swallowClick) { e.preventDefault(); e.stopImmediatePropagation(); swallowClick = false; } }, true);

  requestAnimationFrame(() => settle(true));
  // the bar is hidden behind the sign-in screen: measure again once the app is shown
  new MutationObserver(() => { if (!document.documentElement.classList.contains('locked')) requestAnimationFrame(() => settle(true)); })
    .observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
})();
