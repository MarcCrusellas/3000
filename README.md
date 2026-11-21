# 3000

Personal language-learning site: the German 3000 app (listening loop, Repasar, word list, stats) behind a passkey sign-in, with progress synced between devices.

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
python3 tests/e2e.py [chrome_path] [shots_dir]  # virtual passkey test: sign-in, sync between two devices, reset
```

`npm run dev` keeps data in `worker/.wrangler/state`; delete it to start from zero.

## Layout

| path | what |
|---|---|
| `site/` | the app: `index.html`, `css/`, `js/` (00 to 14 from German 3000 v2, plus `auth.js`), `data/` (words, forms), `audio/` (MP3 packs), `config.js` (API URL), `vendor/` (SimpleWebAuthn browser) |
| `worker/src/index.js` | routes, CORS, the `Vault` Durable Object |
| `worker/wrangler.toml` | RP ID, allowed origins, Durable Object binding |
| `.github/workflows/` | `deploy.yml`, `reset-passkeys.yml` |
| `scripts/worker-url.sh` | finds the Worker's workers.dev URL |
| `tests/e2e.py` | Playwright test with Chrome's virtual authenticator |
| `pipeline/` | scripts and inputs that build `site/data/` and `site/audio/`; `pipeline/ADD_WORDS.md` explains how to add words 1001 to 3000 |
