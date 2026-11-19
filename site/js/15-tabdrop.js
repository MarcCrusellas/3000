'use strict';
/* ---------- liquid tab drop ----------
   The selected tab is a drop of glass that moves on a spring:
   - tap another tab: it slides there, stretching in the direction of travel and settling with a little wobble;
   - press and drag along the bar: it lifts out of the bar like a lens, follows the finger,
     magnifies the icon under it, and drops into the nearest tab on release.
   Tapping the tab that's already selected still opens its settings (handled in 12-events). */
(function () {
  const bar = document.querySelector('nav.tabs .in');
  if (!bar) return;
  const tabs = [...bar.querySelectorAll('a[data-v]')];
  tabs.forEach(t => t.setAttribute('draggable', 'false'));
  const drop = document.createElement('div');
  drop.className = 'tab-drop'; drop.setAttribute('aria-hidden', 'true');
  drop.innerHTML = '<span class="base"></span><i class="lens"></i>';
  bar.prepend(drop);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let G = null, x = 0, v = 0, target = 0, lift = 0, liftT = 0, raf = 0, last = 0, drag = null, swallowClick = false;

  function geo() {
    const b = bar.getBoundingClientRect();
    const xs = tabs.map(t => t.getBoundingClientRect().left - b.left);
    return {b, w: tabs[0].getBoundingClientRect().width, xs};
  }
  const current = () => Math.max(0, tabs.findIndex(t => t.classList.contains('on')));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  function render() {
    const s = Math.min(.42, Math.abs(v) / 2400);              // stretch from speed
    const L = lift;
    drop.style.width = G.w + 'px';
    drop.style.transform = `translate3d(${x}px,0,0) scale(${1 + s + L * .14}, ${1 - s * .4 + L * .24})`;
    drop.style.setProperty('--lift', L.toFixed(3));
    const c = x + G.w / 2;                                    // magnify what's under the drop
    tabs.forEach((t, i) => {
      const d = Math.abs(G.xs[i] + G.w / 2 - c), k = Math.max(0, 1 - d / (G.w * .85));
      t.style.setProperty('--mag', (1 + k * (L * .22 + s * .25)).toFixed(3));
    });
  }

  function step(t) {
    const dt = Math.min(.032, (t - last) / 1000 || .016); last = t;
    const k = drag ? 700 : 300, c = drag ? 40 : 20;           // spring: firm while dragging, bouncier when settling
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
    G = geo();
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
})();
