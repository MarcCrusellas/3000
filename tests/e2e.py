"""End-to-end test with a virtual passkey (Chrome DevTools WebAuthn domain).

Needs the Worker on :8787 (`npx wrangler dev --env dev`) and the site on :8788
(`python3 -m http.server 8788` inside site/). Usage: python3 tests/e2e.py [chrome_path] [shots_dir]
"""
import json, sys, time, urllib.request
from playwright.sync_api import sync_playwright

SITE = 'http://localhost:8788/'
API = 'http://localhost:8787'
CHROME = sys.argv[1] if len(sys.argv) > 1 else None
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
RESET = 'dev-reset-token-0123456789abcdef0123456789'


def call(path, method='GET', headers=None, body=None):
    req = urllib.request.Request(API + path, method=method, headers=headers or {},
                                 data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'null')


def device(browser, creds=None):
    ctx = browser.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    cdp.send('WebAuthn.enable')
    aid = cdp.send('WebAuthn.addVirtualAuthenticator', {'options': {
        'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True,
        'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}})['authenticatorId']
    for c in creds or []:
        cdp.send('WebAuthn.addCredential', {'authenticatorId': aid, 'credential': c})
    return ctx, page, cdp, aid


def view(page, name):
    page.wait_for_function(f"document.querySelector('#app').dataset.view === '{name}'", timeout=10000)


def shot(page, name):
    if SHOTS:
        page.wait_for_timeout(300)
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

    # Phone: first visit creates the passkey
    ctx1, ph, cdp1, a1 = device(browser)
    ph.goto(SITE); view(ph, 'new'); shot(ph, '1-new')
    check(True, 'first visit offers Crear passkey')
    ph.click('#createBtn'); view(ph, 'home')
    check(ph.text_content('#count') == '0', 'signed in after creating the passkey')
    for _ in range(3): ph.click('#incBtn')
    ph.wait_for_timeout(1200); shot(ph, '2-home')
    s, st = call('/api/state')
    check(s == 401, 'state needs a session')

    # Registration is closed for anyone without a session
    s, b = call('/api/register/options', 'POST', {'Content-Type': 'application/json'}, {})
    check(s == 403 and b['error'] == 'closed', 'second sign-up is refused')
    s, b = call('/api/status', headers={'Origin': 'https://evil.example'})
    check(s == 403, 'other origins are refused')

    # Laptop: same passkey (as iCloud Keychain would sync it), new browser
    synced = cdp1.send('WebAuthn.getCredentials', {'authenticatorId': a1})['credentials']
    check(len(synced) == 1 and synced[0]['isResidentCredential'], 'passkey is discoverable')
    ctx2, lp, cdp2, a2 = device(browser, synced)
    lp.goto(SITE); view(lp, 'signin'); shot(lp, '3-signin')
    lp.click('#loginBtn'); view(lp, 'home')
    check(lp.text_content('#count') == '3', 'second device sees the same state')
    lp.click('#incBtn'); lp.wait_for_timeout(1200)

    # Phone comes back to the foreground and picks up the change
    ph.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    ph.wait_for_function("document.querySelector('#count').textContent === '4'", timeout=5000)
    check(True, 'first device picks up the change')

    # Reload keeps the session
    ph.reload(); view(ph, 'home')
    check(ph.text_content('#count') == '4', 'session survives a reload')

    # Same device trying to add its passkey again is refused by the authenticator
    ph.click('#addKeyBtn'); ph.wait_for_function("document.querySelector('#toast').textContent.includes('ya tiene')", timeout=8000)
    check(True, 'same device cannot add a duplicate passkey')

    # Signed in on a device with another authenticator (e.g. a non-Apple device): a second passkey can be added
    cdp2.send('WebAuthn.removeVirtualAuthenticator', {'authenticatorId': a2})
    cdp2.send('WebAuthn.addVirtualAuthenticator', {'options': {
        'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True,
        'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}})
    lp.click('#addKeyBtn'); lp.wait_for_function("document.querySelector('#nKeys').textContent === '2'", timeout=8000)
    check(True, 'signed-in device can add another passkey')

    # Log out
    lp.click('#logoutBtn'); view(lp, 'signin')
    check(True, 'log out returns to Entrar')

    # Reset (what the GitHub workflow does): passkeys go, state stays
    s, b = call('/api/admin/reset', 'POST', {'Authorization': 'Bearer wrong-token-wrong-token-wrong-token'})
    check(s == 403, 'reset refuses a wrong token')
    s, b = call('/api/admin/reset', 'POST', {'Authorization': 'Bearer ' + RESET})
    check(s == 200, 'reset with the right token')
    s, b = call('/api/status')
    check(b['registered'] is False, 'sign-up is open again after reset')
    ph.reload(); view(ph, 'new')
    check(True, 'old session is gone after reset')

    ctx3, np_, cdp3, a3 = device(browser)
    np_.goto(SITE); view(np_, 'new'); np_.click('#createBtn'); view(np_, 'home')
    check(np_.text_content('#count') == '4', 'state kept across the reset')

    browser.close()
print(f'\n{ok} checks passed')
