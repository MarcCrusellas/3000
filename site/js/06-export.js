'use strict';
/* ---------- export (the track is already an MP3) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function hdr(size, fields) { const v = new DataView(new ArrayBuffer(size)); fields.forEach(([o, x, b]) => b === 4 ? v.setUint32(o, x, true) : v.setUint16(o, x, true)); return v; }
function zip(name, data) {
  const fn = new TextEncoder().encode(name), crc = crc32(data), sz = data.length;
  const lh = hdr(30, [[0, 0x04034b50, 4], [4, 20, 2], [12, 0x21, 2], [14, crc, 4], [18, sz, 4], [22, sz, 4], [26, fn.length, 2]]);
  const cd = hdr(46, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [14, 0x21, 2], [16, crc, 4], [20, sz, 4], [24, sz, 4], [28, fn.length, 2]]);
  const eo = hdr(22, [[0, 0x06054b50, 4], [8, 1, 2], [10, 1, 2], [12, 46 + fn.length, 4], [16, 30 + fn.length + sz, 4]]);
  return new Blob([lh, fn, data, cd, fn, eo]);
}
let exporting = false;
async function exportTrack() {
  if (!TRACK || exporting) return;
  exporting = true;
  try {
    const name = 'german3000-' + today();
    if (DL) await DL.save({filename: name + '.zip', data: zip(name + '.mp3', new Uint8Array(await TRACK.blob.arrayBuffer()))});
    else await saveFile(name + '.mp3', TRACK.blob);
  } catch (e) { if (!(e && e.code === 'declined')) toast('Error: ' + (e && (e.message || e.code) || e)); }
  exporting = false;
}
