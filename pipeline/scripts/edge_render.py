"""Render sentence clips with Microsoft neural voices (edge-tts) + native recordings.
Usage: python3 edge_render.py <plan.json> <words.json> <native_dir> <clips_dir> [limit]"""
import asyncio, json, os, ssl, subprocess, sys, time, zlib
import numpy as np
import edge_tts, edge_tts.communicate as ec
_ca = os.environ.get('EDGE_TTS_CA')  # only needed behind a TLS-inspecting proxy
if _ca: ec._SSL_CTX = ssl.create_default_context(cafile=os.path.expanduser(_ca))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
SR = 22050
plan = json.load(open(sys.argv[1])); S = json.load(open(sys.argv[2]))['sents']; NAT = sys.argv[3]; C = sys.argv[4]
LIM = int(sys.argv[5]) if len(sys.argv) > 5 else None
os.makedirs(C, exist_ok=True)
def trim_norm(x):
    a = np.abs(x); thr = max(0.012, a.max() * 0.04); idx = np.where(a > thr)[0]
    if len(idx) == 0: return np.zeros(int(0.2 * SR), np.int16)
    pad = int(0.05 * SR); x = x[max(0, idx[0] - pad): idx[-1] + pad]
    g = 0.09 / (np.sqrt(np.mean(x ** 2)) + 1e-9); pk = np.abs(x).max() * g
    if pk > 0.95: g *= 0.95 / pk
    return (np.clip(x * g, -1, 1) * 32767).astype(np.int16)
def to_mp3(pcm):
    import lameenc
    e = lameenc.Encoder(); e.set_bit_rate(32); e.set_in_sample_rate(SR); e.set_channels(1); e.set_quality(2)
    return bytes(e.encode(pcm.tobytes()) + e.flush())
def decode(path_or_bytes, tempo=None):
    args = ['ffmpeg', '-v', 'error', '-i', 'pipe:0' if isinstance(path_or_bytes, bytes) else path_or_bytes]
    if tempo: args += ['-af', f'atempo={tempo}']
    args += ['-ac', '1', '-ar', str(SR), '-f', 'f32le', 'pipe:1']
    r = subprocess.run(args, input=path_or_bytes if isinstance(path_or_bytes, bytes) else None, capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32)
def write(sid, kind, x):
    pcm = trim_norm(x); open(os.path.join(C, f'{sid}.{kind}.mp3'), 'wb').write(to_mp3(pcm))
    return round(len(pcm) / SR * 1000)
def voice_de(sid, text):
    h = zlib.crc32(sid.encode()) & 1
    if len(text.split()) <= 3: return ['de-DE-KatjaNeural', 'de-DE-ConradNeural'][h]
    return ['de-DE-SeraphinaMultilingualNeural', 'de-DE-FlorianMultilingualNeural'][h]
def voice_es(sid): return ['es-ES-ElviraNeural', 'es-ES-AlvaroNeural'][(zlib.crc32(sid.encode()) >> 3) & 1]
log = open(os.path.join(C, 'log.jsonl'), 'a')
async def tts(text, voice, rate='+0%'):
    for att in range(5):
        try:
            buf = bytearray()
            async for m in edge_tts.Communicate(text, voice, rate=rate).stream():
                if m['type'] == 'audio': buf.extend(m['data'])
            if len(buf) > 500: return bytes(buf)
        except Exception as e:
            err = e
        await asyncio.sleep(2 + att * 3)
    raise RuntimeError(f'tts failed: {text[:40]} {voice}')
async def job(sid, sem):
    async with sem:
        s, p = S[sid], plan[sid]; out = {}
        def need(k): return not os.path.exists(os.path.join(C, f'{sid}.{k}.mp3'))
        if p.get('native'):
            f = os.path.join(NAT, p['native'][0] + '.mp3')
            if not os.path.exists(f): return sid, None
            if need('de'): out['de'] = write(sid, 'de', decode(f))
            if need('ds'): out['ds'] = write(sid, 'ds', decode(f, 0.8))
            vd = 'native'
        else:
            vd = voice_de(sid, s['de'])
            if need('de'): out['de'] = write(sid, 'de', await asyncio.to_thread(decode, await tts(s['de'], vd)))
            if need('ds'): out['ds'] = write(sid, 'ds', await asyncio.to_thread(decode, await tts(s['de'], vd, '-30%')))
        if need('es'): out['es'] = write(sid, 'es', await asyncio.to_thread(decode, await tts(s['es'], voice_es(sid))))
        log.write(json.dumps({'id': sid, 'v': vd, 'd': out}) + '\n'); log.flush()
        return sid, out
async def main():
    sem = asyncio.Semaphore(int(os.environ.get('CONC', '8')))
    ids = sorted(S)[:LIM] if LIM else sorted(S)
    t0 = time.time(); done = 0; skipped = 0; fails = 0
    tasks = [asyncio.create_task(job(sid, sem)) for sid in ids]
    for f in asyncio.as_completed(tasks):
        try:
            sid, out = await f
            if out is None: skipped += 1
        except Exception as e:
            fails += 1; print('FAIL', e, flush=True)
        done += 1
        if done % 100 == 0: print(done, len(ids), f'{time.time()-t0:.0f}s', 'skip', skipped, 'fail', fails, flush=True)
    print('DONE', done, f'{time.time()-t0:.0f}s', 'skip', skipped, 'fail', fails, flush=True)
asyncio.run(main())
