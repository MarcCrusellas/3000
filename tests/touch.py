"""Option rows on an iPhone-like browser (WebKit, iPhone 15 emulation, touch): taps, rapid taps, hold, and that a
quick tap doesn't change the page under the finger (iOS drops the click when it does, which made the first tap
on another option not count).

Signs in with a fake token and answers the Worker API from the test, so only the site server is needed:
    cd site && python3 -m http.server 8788
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 tests/touch.py [shots_dir]
(needs `python3 -m playwright install webkit`)"""
import json, sys
from playwright.sync_api import sync_playwright
SITE = 'http://localhost:8788/'
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
ok = 0
def landed(ph, q, timeout=5000):
    # headless WebKit draws few frames right after a touch, so wait for the pill to settle instead of a fixed time
    try: ph.wait_for_function(ALIGN + '(%r) < 1.5' % q, timeout=timeout); return True
    except Exception: return False
def check(cond, what):
    global ok
    if not cond: print('FAIL:', what); sys.exit(1)
    ok += 1; print('ok -', what)

ALIGN = """(sel => { const sg = document.querySelector(sel), t = sg && sg.querySelector(':scope > .seg-thumb'), on = sg && [...sg.querySelectorAll('button.on')].find(b => b.closest('.seg') === sg);
  if (!t || !on) return 99; const a = t.getBoundingClientRect(), b = on.getBoundingClientRect();
  return Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)); })"""
# records every change inside option rows from touchstart until the click: a quick tap must not change anything
WATCH = """(() => { window.__mut = []; window.__clicked = false; let on = false;
  const mo = new MutationObserver(ms => { if (on) for (const m of ms) if (m.target.closest && m.target.closest('.seg')) window.__mut.push(m.type + ':' + (m.attributeName || m.target.className)); });
  mo.observe(document.body, {subtree: true, childList: true, attributes: true});
  document.addEventListener('touchstart', () => { on = true; window.__mut = []; window.__clicked = false; }, true);
  document.addEventListener('click', () => { if (on) { mo.takeRecords().forEach(m => { if (m.target.closest && m.target.closest('.seg')) window.__mut.push(m.type + ':' + (m.attributeName || m.target.className)); }); on = false; window.__clicked = true; } }, true);
})()"""

with sync_playwright() as p:
    browser = p.webkit.launch()
    ctx = browser.new_context(**p.devices['iPhone 15'])
    ctx.add_init_script("localStorage.setItem('3000.token', 'test')")
    ctx.route('**/api/**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'state': None, 'count': 1})))
    ph = ctx.new_page()
    errs = []; ph.on('pageerror', lambda e: errs.append(str(e)))
    ph.goto(SITE)
    ph.wait_for_function("typeof DATA !== 'undefined' && DATA && DATA.words.length > 0 && !document.documentElement.classList.contains('locked')", timeout=20000)
    ph.evaluate(WATCH)
    ph.evaluate("S.sel.push(...DATA.words.slice(0, 260).map(w => w.k)); DATA.words.slice(0, 158).forEach(w => markKnown(w.k)); syncSel(); location.hash = '#review'")
    ph.wait_for_timeout(500)
    ph.evaluate("TL.step = 1; TL.t = FT.findIndex(t => t.n === 'Frase al oído'); TL.g = 2; tlRender(); sheet(true, 'tl')")
    ph.wait_for_timeout(900)
    sel = '#tlBody .seg.tls'
    check(ph.evaluate(ALIGN + '(%r)' % sel) < 1.5, 'pill on the selected option (wrapped row)')

    # 1. one quick tap on each other option, in order: every first tap must select
    for tv in [6, 5, 2, 6, 2, 5]:
        ph.tap('%s button[data-tv="%d"]' % (sel, tv)); ph.wait_for_timeout(300)
        got = ph.evaluate('TL.g')
        check(got == tv, 'tap on option %d selects it the first time (got %s)' % (tv, got))
        check(ph.evaluate('__clicked') and ph.evaluate('__mut.length') == 0, 'nothing in the row changed between touch and click %s' % ph.evaluate('__mut.slice(0, 4)'))
        check(landed(ph, sel), 'pill landed on option %d' % tv)

    # 2. rapid taps (no waiting for the slide to finish)
    for tv in [5, 6, 2]:
        ph.tap('%s button[data-tv="%d"]' % (sel, tv)); ph.wait_for_timeout(90)
    ph.wait_for_timeout(900)
    check(ph.evaluate('TL.g') == 2, 'rapid taps: the last one wins')
    check(landed(ph, sel), 'rapid taps: the pill ends on the last one')

    # 3. one-line rows in the same sheet
    for row in ['#tlBody .srow .seg.tls']:
        b = ph.evaluate("(q => { const sg = document.querySelector(q); const b = [...sg.querySelectorAll('button')].find(x => !x.classList.contains('on') && !x.disabled); return b.dataset.tk + ':' + b.dataset.tv; })(%r)" % row)
        k, v = b.split(':')
        ph.tap('%s button[data-tk="%s"][data-tv="%s"]' % (row, k, v)); ph.wait_for_timeout(700)
        check(ph.evaluate("(q => document.querySelector(q).querySelector('button.on').dataset.tv)(%r)" % row) == v, 'one-line row: first tap selects')
        check(landed(ph, row), 'one-line row: pill landed')

    # 4. settings rows (not rebuilt on tap)
    ph.evaluate("sheet(false)"); ph.wait_for_timeout(300); ph.evaluate("openSettings('stats')"); ph.wait_for_timeout(700)
    for t in ['light', 'dark', 'light']:
        ph.tap('#themeSeg button[data-t="%s"]' % t); ph.wait_for_timeout(700)
        check(ph.evaluate("S.set.theme") == t, 'theme row: first tap selects %s' % t)
        check(landed(ph, '#themeSeg'), 'theme row: pill landed')
    for w in ['1', '0']:
        ph.tap('#segwSeg button[data-w="%s"]' % w); ph.wait_for_timeout(700)
        check(str(ph.evaluate("S.set.segw || 0")) == w, 'Opciones largas: first tap selects %s' % w)

    # 5. Palabras tabs (a row that scrolls)
    ph.evaluate("sheet(false); location.hash = '#words'"); ph.wait_for_timeout(600)
    for f in ['known', 'todo', 'sel', 'all']:
        ph.tap('#fSeg button[data-f="%s"]' % f); ph.wait_for_timeout(600)
        check(ph.evaluate("W.f") == f, 'Palabras tab %s: first tap selects' % f)
        check(landed(ph, '#fSeg'), 'Palabras tab %s: pill landed' % f)

    # 6. hold on a row lifts the drop; letting go without moving keeps the selection
    ph.evaluate("location.hash = '#review'"); ph.wait_for_timeout(400)
    ph.evaluate("TL.step = 1; tlRender(); sheet(true, 'tl')"); ph.wait_for_timeout(800)
    g0 = ph.evaluate('TL.g')
    box = ph.evaluate("(q => { const r = document.querySelector(q + ' button.on').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })(%r)" % sel)
    ph.evaluate("""([x, y]) => { const el = document.elementFromPoint(x, y);
      el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, button: 0, isPrimary: true})); }""", box)
    ph.wait_for_timeout(450)
    check(ph.evaluate("document.querySelector('%s > .seg-thumb').classList.contains('up')" % sel), 'holding lifts the drop')
    SHOTS and ph.screenshot(path=SHOTS + '/touch-hold.png')
    ph.evaluate("([x, y]) => document.elementFromPoint(x, y).dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, button: 0, isPrimary: true}))", box)
    try: ph.wait_for_function("!document.querySelector('%s > .seg-thumb').classList.contains('up')" % sel, timeout=5000); settled = True
    except Exception: settled = False
    check(ph.evaluate('TL.g') == g0 and settled and landed(ph, sel), 'letting go without moving keeps the selection and settles')
    check(not errs, 'no page errors ' + str(errs[:2]))
    print(ok, 'checks passed')
    browser.close()
