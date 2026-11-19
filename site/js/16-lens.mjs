/* ---------- real glass for the tab drop ----------
   LiquidGlass (WebGL) renders the drop as glass that refracts the tab bar under it.
   15-tabdrop.js keeps doing the movement (spring, stretch, lift, finger following);
   the library just redraws the glass wherever the drop is each frame.
   If WebGL isn't available, the drop keeps its plain look. */
import { LiquidGlass } from '../vendor/liquidglass.js';

const bar = document.querySelector('nav.tabs .in');
const drop = bar && bar.querySelector('.tab-drop');

async function start() {
  if (!drop || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
  // wait until the app is visible and the drop has its real size (the bar is hidden while signed out)
  await new Promise(res => { const tick = () => (drop.getBoundingClientRect().width > 20 ? res() : setTimeout(tick, 200)); tick(); });
  drop.dataset.config = JSON.stringify({
    refraction: 0.6, chromAberration: 0.04, fresnel: 0.3, edgeHighlight: 0.02, specular: 0,
    blurAmount: 0, zRadius: 30, cornerRadius: 36, bevelMode: 0,
    shadowOpacity: 0, shadowSpread: 0, shadowOffsetY: 0, tintStrength: 0, saturation: 0.1, brightness: -0.08,
  });
  try {
    const inst = await LiquidGlass.init({ root: bar, glassElements: [drop] });
    document.documentElement.classList.add('lg-on');
    // the active tab's colour changes on navigation: the library can't see class changes on other children
    addEventListener('hashchange', () => setTimeout(() => inst.markChanged(), 0));
    addEventListener('g3000:tabs', () => inst.markChanged());
    window.TAB_GLASS = inst;
    // the drop moves by transform (15-tabdrop.js), which the library doesn't notice: tell it on every move
    new MutationObserver(() => inst.markChanged(drop)).observe(drop, {attributes: true, attributeFilter: ['style']});
  } catch (e) {
    console.warn('LiquidGlass unavailable', e);
  }
}
start();
