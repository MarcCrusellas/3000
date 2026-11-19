'use strict';
/* ---------- audio: one long MP3 made by joining the clips' frames ---------- */
const packs = new Map(), packBuf = new Map(), fcount = new WeakMap(), u8c = new Map(), silc = new Map();
const SPF = 576, MSR = 22050;
function getPack(p) {
  if (!packs.has(p)) packs.set(p, fetch((window.AUDIO_BASE || 'audio/') + 'pack-' + String(p).padStart(2, '0') + '.mp3').then(r => { if (!r.ok) throw new Error('audio ' + p); return r.arrayBuffer(); }).then(b => { packBuf.set(p, b); return b; }));
  return packs.get(p);
}
const BRT = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0], SRT = [22050, 24000, 16000, 0];
function frames(u) {
  let n = fcount.get(u); if (n != null) return n;
  n = 0;
  for (let i = 0; i + 4 <= u.length; n++) {
    if (u[i] !== 0xFF || (u[i + 1] & 0xE0) !== 0xE0) break;
    const br = BRT[u[i + 2] >> 4], sr = SRT[(u[i + 2] >> 2) & 3]; if (!br || !sr) break;
    i += Math.floor(72 * br * 1000 / sr) + ((u[i + 2] >> 1) & 1);
  }
  fcount.set(u, n); return n;
}
function silence(n, k) {
  if (k == null) k = Math.round(n * (72 * 32000 / 22050 - 104));
  const key = n + '|' + k;
  if (!silc.has(key)) {
    const u = new Uint8Array(n * 104 + k); let o = 0;
    for (let i = 0; i < n; i++) { const p = i < k ? 1 : 0; u[o] = 0xFF; u[o + 1] = 0xF3; u[o + 2] = 0x40 | (p << 1); u[o + 3] = 0xC4; o += 104 + p; }
    silc.set(key, u); fcount.set(u, n);
  }
  return silc.get(key);
}
function slice(a, key) {
  if (!a || !packBuf.has(a[0])) return null;
  if (!u8c.has(key)) u8c.set(key, new Uint8Array(packBuf.get(a[0]), a[1], a[2]));
  return u8c.get(key);
}
const clipU8 = (sid, kind) => slice(DATA.sents[sid].a[kind], sid + '.' + kind);
function wordU8(k) { const w = WBY.get(k); return slice(w && w.a && w.a.d, 'w:' + k); }
function wav(n) {
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 2, true);
  return buf;
}
const SNDB = ["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FgSoDZC4CjIjvs6Isn2qh87dNVbvXV8k13JuU5d0h1V3K9O7StoTGJM61NLhJQZbcCIiIW7iAAAp03bXrFiyk3XnZmYGBhE2C4XBgdWMDbQPXRLaBcLhMFwuG70EEEEEH0H/80DE3xLiuhFgDUq4BBBBupCaUAgEMoCGoMakCv/SbGOSn3svvy/fv9f6ktstof6JAIBAIBAJFiUahp/n+h6XcrQ07TlOU70PWpprSwxf4uUYSBcU6LxamQIylrVisRd2W6lUZhmHY//zQsTuF6MWCAANSrgy2z9ampaWlpceayrVbOOOPK1NTYiuBQUC/CCgl2QUFfkN9/wgr/yVTEFNRTQuMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMTrFXEaOBYbKHBVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTQuMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxPAYESYcADYycVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FNC4wVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NAxKQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80DEpAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ=="], sndC = [];
function sndU8(v) {
  if (!sndC[v]) { const b = atob(SNDB[v] || SNDB[0]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); sndC[v] = u; }
  return sndC[v];
}
function wordEsU8(k) { const w = WBY.get(k); return slice(w && w.a && w.a.e, 'we:' + k); }
async function render(items, onProg) {
  const need = new Set();
  for (const it of items) {
    const a = DATA.sents[it.sid].a, w = it.k && WBY.get(it.k), wa = w && w.a || {};
    for (const b of it.bl) {
      const r = b.t === 'es' ? a.es : b.t === 'de' ? a.de : b.t === 'slow' ? a.ds || a.de : b.t === 'wde' ? wa.d : b.t === 'wes' ? wa.e : null;
      if (r) need.add(r[0]);
    }
  }
  const ps = [...need]; let done = 0;
  await Promise.all(ps.map(p => getPack(p).then(() => { onProg && onProg(++done / ps.length); })));
  const parts = [], marks = [], FB = 72 * 32000 / 22050; let fr = 0, by = 0, dn = 0, xn = 0;
  const put = u => { if (u) { parts.push(u); fr += frames(u); by += u.byteLength; } };
  const sil = sec => { const n = Math.round(sec * MSR / SPF); if (n > 0) put(silence(n, Math.max(0, Math.min(n, Math.round((fr + n) * FB - by - n * 104))))); };
  sil(0.4);
  for (const it of items) {
    const start = fr, c = k => clipU8(it.sid, k);
    for (const b of it.bl) {
      if (b.t === 'p') sil(b.d);
      else if (b.t === 'snd') put(sndU8(b.v || 0));
      else if (b.t === 'es' || b.t === 'de') put(c(b.t));
      else if (b.t === 'slow') put(c('ds') || c('de'));
      else if (b.t === 'wde') put(it.k && wordU8(it.k));
      else if (b.t === 'wes') put(it.k && wordEsU8(it.k));
    }
    if (fr === start) sil(0.5);
    marks.push({k: it.k, sid: it.sid, rv: it.rv, x: it.x, n: it.x ? ++xn : ++dn, s: start * SPF / MSR, e: fr * SPF / MSR});
  }
  return {blob: new Blob(parts, {type: 'audio/mpeg'}), marks, dur: fr * SPF / MSR, day: dn};
}
