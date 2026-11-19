"""End-to-end test of the 3000 app with a virtual passkey (Chrome DevTools WebAuthn domain).

Needs the Worker on :8787 (`npm run dev` in worker/, fresh .wrangler/state) and the site on :8788
(`python3 -m http.server 8788` inside site/). Usage: python3 tests/e2e.py [chrome_path] [shots_dir]
"""
import json, sys, urllib.request
from playwright.sync_api import sync_playwright

SITE = 'http://localhost:8788/'
API = 'http://localhost:8787'
CHROME = sys.argv[1] if len(sys.argv) > 1 else None
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
RESET = 'dev-reset-token-0123456789abcdef0123456789'
AUTH_OPTS = {'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True,
             'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}


def call(path, method='GET', headers=None, body=None):
    req = urllib.request.Request(API + path, method=method, headers=headers or {},
                                 data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'null')


def device(browser, creds=None):
    ctx = browser.new_context(viewport={'width': 390, 'height': 800}, device_scale_factor=2)
    page = ctx.new_page()
    page.on('pageerror', lambda e: print('  page error:', e))
    cdp = ctx.new_cdp_session(page)
    cdp.send('WebAuthn.enable')
    aid = cdp.send('WebAuthn.addVirtualAuthenticator', {'options': AUTH_OPTS})['authenticatorId']
    for c in creds or []:
        cdp.send('WebAuthn.addCredential', {'authenticatorId': aid, 'credential': c})
    return ctx, page, cdp, aid


def gate(page, view):
    page.wait_for_function(f"document.documentElement.classList.contains('locked') && document.getElementById('gate').dataset.view === '{view}'", timeout=10000)


def in_app(page):
    page.wait_for_function("!document.documentElement.classList.contains('locked') && typeof DATA !== 'undefined' && DATA && DATA.words.length > 0", timeout=15000)


def synced(page):
    page.wait_for_function("store.mode === 'db' && document.getElementById('dot').className.includes('ok') && !store.writing && !store.timer || (document.getElementById('dot').className.includes('ok') && !store.writing)", timeout=15000)
    page.wait_for_timeout(2500)  # past the 1.8 s save debounce
    page.wait_for_function("document.getElementById('dot').className.includes('ok') && !store.writing", timeout=15000)


def shot(page, name):
    if SHOTS:
        page.wait_for_timeout(400)
        page.screenshot(path=f'{SHOTS}/{name}.png')


ok = 0
def check(cond, label):
    global ok
    if not cond:
        raise SystemExit(f'FAIL: {label}')
    ok += 1
    print('ok -', label)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME) if CHROME else p.chromium.launch()

    ctx1, ph, cdp1, a1 = device(browser)
    ph.goto(SITE); gate(ph, 'new'); shot(ph, '1-gate-new')
    check(True, 'first visit shows Crear passkey')
    ph.click('#gateCreate'); in_app(ph)
    check(True, 'app opens after creating the passkey')
    synced(ph)
    check(ph.evaluate("store.mode") == 'db', 'sync is on (Worker)')
    ph.evaluate("location.hash = '#words'"); ph.evaluate("document.getElementById('next10').click()")
    n1 = ph.evaluate("S.sel.length")
    check(n1 >= 10, f'added words on the phone ({n1})')
    synced(ph); shot(ph, '2-app-words')

    s, b = call('/api/register/options', 'POST', {'Content-Type': 'application/json'}, {})
    check(s == 403, 'second sign-up is refused')

    synced_creds = cdp1.send('WebAuthn.getCredentials', {'authenticatorId': a1})['credentials']
    ctx2, lp, cdp2, a2 = device(browser, synced_creds)
    lp.goto(SITE); gate(lp, 'signin'); shot(lp, '3-gate-signin')
    lp.click('#gateLogin'); in_app(lp); synced(lp)
    check(lp.evaluate("S.sel.length") == n1, 'second device gets the same words')

    lp.evaluate("location.hash = '#words'"); lp.evaluate("document.getElementById('next10').click()")
    n2 = lp.evaluate("S.sel.length"); synced(lp)
    ph.reload(); in_app(ph); synced(ph)
    check(ph.evaluate("S.sel.length") == n2, f'phone picks up the laptop\'s words after reload ({n2})')

    ph.evaluate("location.hash = '#stats'"); ph.wait_for_timeout(300)
    ph.wait_for_function("document.getElementById('acctN').textContent === '1'", timeout=8000)
    check(True, 'settings show 1 passkey')

    lp.evaluate("document.getElementById('acctOut').click()"); gate(lp, 'signin')
    check(True, 'log out returns to Entrar')

    s, b = call('/api/admin/reset', 'POST', {'Authorization': 'Bearer ' + RESET})
    check(s == 200, 'reset')
    ph.reload(); gate(ph, 'new')
    check(True, 'after reset the old session is dropped and sign-up reopens')

    ctx3, np_, cdp3, a3 = device(browser)
    np_.goto(SITE); gate(np_, 'new'); np_.click('#gateCreate'); in_app(np_); synced(np_)
    check(np_.evaluate("S.sel.length") == n2, 'progress kept across the reset')

    browser.close()
print(f'\n{ok} checks passed')
