# 3000

Personal language-learning site. For now it's a small test: sign in with a passkey and a counter that syncs between devices.

- Site: https://marccrusellas.github.io/3000/ (GitHub Pages, from `site/`)
- API: Cloudflare Worker `api-3000` (from `worker/`), one SQLite Durable Object that holds the passkeys, sessions and synced state

## How sign-in works

- No email, no password. The first visit creates the only account and its passkey. After that, sign-up is closed.
- The passkey belongs to `marccrusellas.github.io`. Apple Passwords syncs it to your other Apple devices.
- Signed in, the key-plus button adds another passkey, for a device outside iCloud.
- Lost every device: run **Actions → Reset passkeys** (type `BORRAR`). Passkeys and sessions are removed, progress stays, and the next visit creates a new passkey.

## Setup (once)

1. **Cloudflare**: open *Workers & Pages* once so the account gets its `workers.dev` subdomain.
2. **Cloudflare API token**: *My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"* template.
3. **GitHub secrets** in the `github-pages` environment (*Settings → Environments → github-pages*):
   - `CLOUDFLARE_API_TOKEN`: the token from step 2
   - `CLOUDFLARE_ACCOUNT_ID`: on the Workers & Pages overview page
4. **GitHub Pages**: *Settings → Pages → Source: GitHub Actions*.
5. Run **Actions → Deploy** (or push to `main`). It deploys the Worker, writes its URL into `site/config.js` and publishes the site.

## Local development

```
cd worker && npm ci && npm run dev            # API on :8787 (RP ID localhost)
cd site && python3 -m http.server 8788        # site on :8788
python3 tests/e2e.py [chrome_path] [shots_dir]  # virtual passkey test, 17 checks
```

`npm run dev` keeps data in `worker/.wrangler/state`; delete it to start from zero.

## Layout

| path | what |
|---|---|
| `site/` | static site: `index.html`, `app.js`, `style.css`, `config.js` (API URL), `vendor/` (SimpleWebAuthn browser) |
| `worker/src/index.js` | routes, CORS, the `Vault` Durable Object |
| `worker/wrangler.toml` | RP ID, allowed origins, Durable Object binding |
| `.github/workflows/` | `deploy.yml`, `reset-passkeys.yml` |
| `scripts/worker-url.sh` | finds the Worker's workers.dev URL |
| `tests/e2e.py` | Playwright test with Chrome's virtual authenticator |
