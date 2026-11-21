"""Single-word audio for the words after 1000 (edge_words.py does 1 to 1000 into pack-40, which stays as it is).
Words 1001+ go to pack-61 + (rank-1001)//1000.
Usage: python3 words_ext.py <site_dir> <cache_dir> [first_rank=1001]   (2001 for the next batch: pack-62 only)"""
import asyncio, json, os, re, ssl, subprocess, sys, zlib
import numpy as np, lameenc
import edge_tts, edge_tts.communicate as ec
_ca = os.environ.get('EDGE_TTS_CA')  # only needed behind a TLS-inspecting proxy
if _ca: ec._SSL_CTX = ssl.create_default_context(cafile=os.path.expanduser(_ca))
SR = 22050; SITE, CACHE = sys.argv[1], sys.argv[2]; os.makedirs(CACHE, exist_ok=True)
def trim_norm(x):
    a = np.abs(x); thr = max(0.012, a.max() * 0.04); idx = np.where(a > thr)[0]
    if len(idx) == 0: return np.zeros(int(0.2 * SR), np.int16)
    pad = int(0.05 * SR); x = x[max(0, idx[0] - pad): idx[-1] + pad]
    g = 0.09 / (np.sqrt(np.mean(x ** 2)) + 1e-9); pk = np.abs(x).max() * g
    if pk > 0.95: g *= 0.95 / pk
    return (np.clip(x * g, -1, 1) * 32767).astype(np.int16)
def to_mp3(pcm):
    e = lameenc.Encoder(); e.set_bit_rate(32); e.set_in_sample_rate(SR); e.set_channels(1); e.set_quality(2)
    return bytes(e.encode(pcm.tobytes()) + e.flush())
def decode(b):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', str(SR), '-f', 'f32le', 'pipe:1'], input=b, capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32)
def clean_es(g): return re.sub(r'\([^)]*\)', '', g.split(';')[0]).strip(' ,')
async def tts(text, voice):
    for att in range(5):
        try:
            buf = bytearray()
            async for m in edge_tts.Communicate(text, voice).stream():
                if m['type'] == 'audio': buf.extend(m['data'])
            if len(buf) > 300: return bytes(buf)
        except Exception: pass
        await asyncio.sleep(2 + att * 3)
    raise RuntimeError('tts failed ' + text)
site = json.load(open(os.path.join(SITE, 'data', 'words.json')))
async def job(w, sem):
    async with sem:
        h = zlib.crc32(w['k'].encode())
        for kind, text, voice in (('d', w['w'].replace('der/die ', 'der ') + '.', ['de-DE-KatjaNeural', 'de-DE-ConradNeural'][h & 1]),
                                  ('e', clean_es(w['g']) + '.', ['es-ES-ElviraNeural', 'es-ES-AlvaroNeural'][(h >> 3) & 1])):
            f = os.path.join(CACHE, re.sub(r'[^\w]', '_', w['k']) + '.' + kind + '.mp3')
            if not os.path.exists(f):
                pcm = trim_norm(await asyncio.to_thread(decode, await tts(text, voice)))
                open(f, 'wb').write(to_mp3(pcm)); open(f + '.ms', 'w').write(str(round(len(pcm) / SR * 1000)))
async def main():
    sem = asyncio.Semaphore(12)
    first = int(sys.argv[3]) if len(sys.argv) > 3 else 1001
    ws = [w for w in site['words'] if w['r'] >= first]
    await asyncio.gather(*[job(w, sem) for w in ws])
    bufs = {}
    for w in ws:
        pk = 61 + (w['r'] - 1001) // 1000; buf = bufs.setdefault(pk, bytearray()); a = {}
        for kind in ('d', 'e'):
            f = os.path.join(CACHE, re.sub(r'[^\w]', '_', w['k']) + '.' + kind + '.mp3'); b = open(f, 'rb').read()
            a[kind] = [pk, len(buf), len(b), int(open(f + '.ms').read())]; buf.extend(b)
        w['a'] = a
    for pk, buf in bufs.items(): open(os.path.join(SITE, 'audio', f'pack-{pk:02d}.mp3'), 'wb').write(buf)
    json.dump(site, open(os.path.join(SITE, 'data', 'words.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print({pk: len(b) for pk, b in bufs.items()})
asyncio.run(main())
