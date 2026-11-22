"""Option rows (.seg): sliding selection (js/18-segslide.js) and wrapped rows (js/17-wrapseg.js).
Same setup as e2e.py (site on :8788, `npm run dev` Worker on :8787). Usage: python3 tests/segments.py [chrome] [shots_dir]"""
import os
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'e2e.py')).read().split('with sync_playwright() as p:')[0]
exec(src)
ALIGN = """(sel => { const sg = document.querySelector(sel), t = sg.querySelector(':scope > .seg-thumb'), on = [...sg.querySelectorAll('button.on')][0];
  if (!t || !on) return 'no thumb/on'; const a = t.getBoundingClientRect(), b = on.getBoundingClientRect();
  return Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)); })"""
def track(ph, sel, n=12):
    return ph.evaluate("""(sel) => new Promise(res => { const out = []; let i = 0; const f = () => { const t = document.querySelector(sel + ' > .seg-thumb'); const r = t && t.getBoundingClientRect(); out.push(r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width)] : null); if (++i < %d) requestAnimationFrame(f); else res(out); }; requestAnimationFrame(f); })""" % n, sel)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    ctx, ph, cdp, aid = device(browser)
    errs = []; ph.on('pageerror', lambda e: errs.append(str(e)))
    ph.emulate_media(color_scheme='dark')
    ph.goto(SITE); gate(ph, 'new'); ph.click('#gateCreate'); in_app(ph); synced(ph)
    ph.evaluate("S.sel.push(...DATA.words.slice(0, 260).map(w => w.k)); DATA.words.slice(0, 158).forEach(w => markKnown(w.k)); syncSel(); location.hash = '#review'")
    ph.wait_for_timeout(500)
    ph.evaluate("TL.step = 1; TL.t = FT.findIndex(t => t.n === 'Frase al oído'); TL.g = 2; tlRender(); sheet(true, 'tl')")
    ph.wait_for_timeout(1000)
    sel = '#tlBody .seg.tls'
    check(ph.evaluate("document.querySelector('#tlBody .seg.tls').classList.contains('wrapped') && !!document.querySelector('#tlBody .seg.tls > svg.wtrack')"), 'long row wraps with its track')
    check(ph.evaluate(ALIGN + "(%r)" % sel) < 1.5, 'thumb sits on the selected option (wrapped row)')
    ph.click(sel + ' button[data-tv="6"]')
    path = track(ph, sel)
    print('  path', path[:8])
    check(len({tuple(x) for x in path if x}) > 3, 'thumb moves through intermediate positions (rebuilt sheet)')
    ph.wait_for_timeout(120); SHOTS and ph.screenshot(path=SHOTS + '/mid.png')
    ph.wait_for_timeout(1200)
    check(ph.evaluate(ALIGN + "(%r)" % sel) < 1.5, 'thumb lands on the new option on another line')
    SHOTS and ph.screenshot(path=SHOTS + '/tl-after.png')
    ph.click('#tlBody .srow .seg.tls button:not(.on)'); ph.wait_for_timeout(1200)
    check(ph.evaluate(ALIGN + "('#tlBody .srow .seg.tls')") < 1.5, 'one-line segment slides too')
    ph.evaluate("S.set.segw = 1; applyTheme()"); ph.wait_for_timeout(300)
    check(ph.evaluate("document.querySelector('#tlBody .seg.tls').classList.contains('segscroll')"), 'Deslizar: one line that scrolls')
    ph.evaluate("S.set.segw = 0; applyTheme(); sheet(false)"); ph.wait_for_timeout(300)
    ph.evaluate("openSettings('stats')"); ph.wait_for_timeout(700)
    ph.click('#themeSeg button[data-t="light"]'); ph.wait_for_timeout(1200)
    check(ph.evaluate(ALIGN + "('#themeSeg')") < 1.5, 'settings segment (theme) slides and lands')
    SHOTS and ph.screenshot(path=SHOTS + '/settings-light.png')
    ph.evaluate("sheet(false); location.hash = '#words'"); ph.wait_for_timeout(600)
    ph.click('#fSeg button[data-f="known"]'); ph.wait_for_timeout(1200)
    check(ph.evaluate(ALIGN + "('#fSeg')") < 1.5, 'Palabras tabs slide')
    check(ph.evaluate("!document.querySelector('#tSeg > .seg-thumb')"), 'type chips keep their own look')
    ph.evaluate("location.hash = '#listen'"); ph.wait_for_timeout(500); ph.evaluate("openSettings('player')"); ph.wait_for_timeout(700)
    multi = ph.evaluate("[...document.querySelectorAll('#sheet .seg')].filter(s => s.querySelectorAll('button.on').length > 1).map(s => !!s.querySelector(':scope > .seg-thumb'))")
    check(not any(multi), 'multi-choice segments have no thumb (%d checked)' % len(multi))
    SHOTS and ph.screenshot(path=SHOTS + '/player.png')
    check(not errs, 'no page errors ' + str(errs[:2]))
    print(ok, 'checks passed')
