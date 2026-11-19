import { DurableObject } from 'cloudflare:workers';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

/*
  3000 API. One user, passkey only.
  Everything lives in one SQLite-backed Durable Object ("me"):
  passkeys, one-time challenges, sessions and the synced state.

  Routes (all JSON):
    GET  /api/status            -> { registered }
    POST /api/register/options  -> creation options (first passkey, or signed in to add one)
    POST /api/register/verify   -> { token }
    POST /api/login/options     -> request options
    POST /api/login/verify      -> { token }
    GET  /api/me                -> { since, passkeys: [...] }          (signed in)
    POST /api/logout                                                    (signed in)
    GET  /api/state             -> { state, updated }                   (signed in)
    PUT  /api/state  { state }  -> { updated }                          (signed in)
    POST /api/admin/reset       -> removes passkeys and sessions, keeps state
                                   (Authorization: Bearer RESET_TOKEN, used by the reset workflow)
*/

const DAY = 86400000;
const SESSION_DAYS = 180;
const CHALLENGE_MS = 5 * 60000;
const MAX_STATE = 1_900_000; // bytes; one SQLite row in a Durable Object holds up to 2 MB

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = origins(env);
    const cors = allowed.includes(origin)
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        }
      : { Vary: 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404, cors);
    // Browser calls must come from the site; the reset workflow calls without an Origin.
    if (origin && !allowed.includes(origin)) return json({ error: 'origin' }, 403, cors);

    const stub = env.VAULT.get(env.VAULT.idFromName('me'));
    const res = await stub.fetch(req);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    out.headers.set('Cache-Control', 'no-store');
    return out;
  },
};

export class Vault extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS creds (
        id TEXT PRIMARY KEY, pubkey BLOB NOT NULL, counter INTEGER NOT NULL,
        transports TEXT, device_type TEXT, backed_up INTEGER, created INTEGER, last_used INTEGER);
      CREATE TABLE IF NOT EXISTS challenges (challenge TEXT PRIMARY KEY, kind TEXT, expires INTEGER);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, created INTEGER, expires INTEGER);
      CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT, updated INTEGER);
    `);
  }

  async fetch(req) {
    const url = new URL(req.url);
    const route = `${req.method} ${url.pathname}`;
    const origin = req.headers.get('Origin') || '';
    try {
      switch (route) {
        case 'GET /api/status':
          return json({ registered: this.count() > 0 });

        case 'POST /api/register/options': {
          if (this.count() > 0 && !(await this.session(req))) return json({ error: 'closed' }, 403);
          const opts = await generateRegistrationOptions({
            rpName: this.env.RP_NAME || '3000',
            rpID: this.env.RP_ID,
            userID: this.userId(),
            userName: this.env.USER_NAME || 'marc',
            userDisplayName: this.env.USER_DISPLAY || 'Marc',
            attestationType: 'none',
            excludeCredentials: this.creds().map(c => ({ id: c.id, transports: c.transports })),
            authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
          });
          this.putChallenge(opts.challenge, 'reg');
          return json(opts);
        }

        case 'POST /api/register/verify': {
          const signedIn = !!(await this.session(req));
          if (this.count() > 0 && !signedIn) return json({ error: 'closed' }, 403);
          const body = await req.json();
          const v = await verifyRegistrationResponse({
            response: body,
            expectedChallenge: c => this.takeChallenge(c, 'reg'),
            expectedOrigin: origins(this.env),
            expectedRPID: this.env.RP_ID,
            requireUserVerification: false,
          });
          if (!v.verified || !v.registrationInfo) return json({ error: 'not_verified' }, 400);
          const { credential, credentialDeviceType, credentialBackedUp } = v.registrationInfo;
          const now = Date.now();
          this.sql.exec(
            'INSERT INTO creds (id, pubkey, counter, transports, device_type, backed_up, created, last_used) VALUES (?,?,?,?,?,?,?,?)',
            credential.id, credential.publicKey, credential.counter,
            JSON.stringify(credential.transports || []), credentialDeviceType, credentialBackedUp ? 1 : 0, now, now,
          );
          if (!this.meta('since')) this.setMeta('since', String(now));
          return json({ token: signedIn ? null : (await this.newSession()) });
        }

        case 'POST /api/login/options': {
          const opts = await generateAuthenticationOptions({
            rpID: this.env.RP_ID,
            allowCredentials: [],
            userVerification: 'preferred',
          });
          this.putChallenge(opts.challenge, 'auth');
          return json(opts);
        }

        case 'POST /api/login/verify': {
          const body = await req.json();
          const cred = this.creds().find(c => c.id === body.id);
          if (!cred) return json({ error: 'unknown_passkey' }, 400);
          const v = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge: c => this.takeChallenge(c, 'auth'),
            expectedOrigin: origins(this.env),
            expectedRPID: this.env.RP_ID,
            credential: { id: cred.id, publicKey: cred.publicKey, counter: cred.counter, transports: cred.transports },
            requireUserVerification: false,
          });
          if (!v.verified) return json({ error: 'not_verified' }, 400);
          this.sql.exec('UPDATE creds SET counter = ?, last_used = ? WHERE id = ?',
            v.authenticationInfo.newCounter, Date.now(), cred.id);
          return json({ token: (await this.newSession()) });
        }

        case 'GET /api/me': {
          if (!(await this.session(req))) return json({ error: 'signed_out' }, 401);
          return json({
            since: Number(this.meta('since') || 0),
            passkeys: this.creds().map(c => ({ created: c.created, lastUsed: c.lastUsed, synced: c.backedUp })),
          });
        }

        case 'POST /api/logout': {
          const s = (await this.session(req));
          if (s) this.sql.exec('DELETE FROM sessions WHERE hash = ?', s);
          return json({ ok: true });
        }

        case 'GET /api/state': {
          if (!(await this.session(req))) return json({ error: 'signed_out' }, 401);
          const row = this.sql.exec('SELECT data, updated FROM state WHERE id = 1').toArray()[0];
          return json({ state: row ? JSON.parse(row.data) : null, updated: row ? row.updated : 0 });
        }

        case 'PUT /api/state': {
          if (!(await this.session(req))) return json({ error: 'signed_out' }, 401);
          const text = await req.text();
          if (text.length > MAX_STATE) return json({ error: 'too_big' }, 413);
          const { state } = JSON.parse(text);
          const now = Date.now();
          this.sql.exec('INSERT INTO state (id, data, updated) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated',
            JSON.stringify(state), now);
          return json({ updated: now });
        }

        case 'POST /api/admin/reset': {
          const want = this.env.RESET_TOKEN;
          const got = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
          if (!want || want.length < 32 || !(await sameText(got, want))) return json({ error: 'forbidden' }, 403);
          this.sql.exec('DELETE FROM creds; DELETE FROM sessions; DELETE FROM challenges;');
          return json({ ok: true });
        }

        default:
          return json({ error: 'not_found' }, 404);
      }
    } catch (e) {
      return json({ error: 'bad_request', detail: String(e && e.message || e).slice(0, 200) }, 400);
    }
  }

  /* ---------- helpers ---------- */
  count() { return this.sql.exec('SELECT COUNT(*) AS n FROM creds').one().n; }

  creds() {
    return this.sql.exec('SELECT * FROM creds').toArray().map(r => ({
      id: r.id,
      publicKey: new Uint8Array(r.pubkey),
      counter: r.counter,
      transports: JSON.parse(r.transports || '[]'),
      created: r.created,
      lastUsed: r.last_used,
      backedUp: !!r.backed_up,
    }));
  }

  meta(k) { const r = this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray()[0]; return r ? r.v : null; }
  setMeta(k, v) { this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v); }

  userId() {
    let id = this.meta('user_id');
    if (!id) { id = b64url(crypto.getRandomValues(new Uint8Array(16))); this.setMeta('user_id', id); }
    return new TextEncoder().encode(id);
  }

  putChallenge(c, kind) {
    const now = Date.now();
    this.sql.exec('DELETE FROM challenges WHERE expires < ?', now);
    this.sql.exec('INSERT OR REPLACE INTO challenges (challenge, kind, expires) VALUES (?, ?, ?)', c, kind, now + CHALLENGE_MS);
  }

  // One use only: a challenge is removed the moment it is checked.
  takeChallenge(c, kind) {
    const row = this.sql.exec('SELECT kind, expires FROM challenges WHERE challenge = ?', c).toArray()[0];
    this.sql.exec('DELETE FROM challenges WHERE challenge = ?', c);
    return !!row && row.kind === kind && row.expires > Date.now();
  }

  async newSession() {
    const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const now = Date.now();
    this.sql.exec('DELETE FROM sessions WHERE expires < ?', now);
    this.sql.exec('INSERT INTO sessions (hash, created, expires) VALUES (?, ?, ?)', await sha256(token), now, now + SESSION_DAYS * DAY);
    return token;
  }

  // Returns the session's hash when the Bearer token is valid. Sessions slide: each use pushes expiry out.
  async session(req) {
    const t = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!t || t.length < 20) return null;
    const h = await sha256(t);
    const row = this.sql.exec('SELECT expires FROM sessions WHERE hash = ?', h).toArray()[0];
    if (!row || row.expires < Date.now()) return null;
    const next = Date.now() + SESSION_DAYS * DAY;
    if (next - row.expires > DAY) this.sql.exec('UPDATE sessions SET expires = ? WHERE hash = ?', next, h);
    return h;
  }
}

/* ---------- utils ---------- */
function origins(env) { return String(env.ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean); }

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sameText(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const ua = new Uint8Array(x), ub = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < ua.length; i++) d |= ua[i] ^ ub[i];
  return d === 0;
}
