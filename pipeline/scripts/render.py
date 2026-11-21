"""Render audio clips for every sentence, then pack them.

Usage:
  python3 -I render.py A <build_dir> <voices_dir> <clips_dir>        German (high) for sentences without native audio
  python3 -I render.py B <build_dir> <voices_dir> <clips_dir> <native_dir>   native downloads + Spanish + slow German
  python3 -I render.py pack <build_dir> <clips_dir> <out_dir>         MP3 packs + index
"""
import json, os, subprocess, sys, time, urllib.request
import numpy as np

ROLE = sys.argv[1]
B = sys.argv[2].rstrip('/') + '/'
SR = 22050

def trim_norm(x):
    x = x.astype(np.float32)
    if x.dtype != np.float32 or np.abs(x).max() > 2:
        x = x / 32768.0
    a = np.abs(x)
    thr = max(0.012, a.max() * 0.04)
    idx = np.where(a > thr)[0]
    if len(idx) == 0:
        return np.zeros(int(0.2 * SR), np.int16)
    pad = int(0.04 * SR)
    x = x[max(0, idx[0] - pad): idx[-1] + pad]
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    g = 0.09 / rms
    pk = np.abs(x).max() * g
    if pk > 0.95:
        g *= 0.95 / pk
    y = np.clip(x * g, -1, 1)
    return (y * 32767).astype(np.int16)

def to_mp3(pcm):
    import lameenc
    e = lameenc.Encoder()
    e.set_bit_rate(32)
    e.set_in_sample_rate(SR)
    e.set_channels(1)
    e.set_quality(5)
    return bytes(e.encode(pcm.tobytes()) + e.flush())

def load_voice(path):
    import onnxruntime as ort
    from piper import PiperVoice
    v = PiperVoice.load(path)
    so = ort.SessionOptions()
    so.intra_op_num_threads = 1
    so.inter_op_num_threads = 1
    v.session = ort.InferenceSession(path, sess_options=so, providers=['CPUExecutionProvider'])
    return v

def synth(voice, text, length_scale=None):
    from piper import SynthesisConfig
    cfg = SynthesisConfig(length_scale=length_scale) if length_scale else None
    chunks = [c.audio_int16_array for c in voice.synthesize(text, syn_config=cfg)]
    return np.concatenate(chunks) if chunks else np.zeros(1, np.int16)

def write_clip(clips, sid, kind, pcm):
    mp3 = to_mp3(pcm)
    with open(os.path.join(clips, f'{sid}.{kind}.mp3'), 'wb') as f:
        f.write(mp3)
    return len(pcm) / SR

def work(role):
    data = json.load(open(B + 'final.json'))
    V = sys.argv[3].rstrip('/') + '/'
    clips = sys.argv[4]
    os.makedirs(clips, exist_ok=True)
    sents = sorted(data['sentences'].values(), key=lambda s: s['id'])
    log = open(os.path.join(clips, f'log_{role}.jsonl'), 'a')
    done = {f for f in os.listdir(clips)}
    t0 = time.time()
    if role == 'A':
        v = load_voice(V + 'de_DE-thorsten-high.onnx')
        todo = [s for s in sents if not s['audio'] and f"{s['id']}.de.mp3" not in done]
        for i, s in enumerate(todo):
            d = write_clip(clips, s['id'], 'de', trim_norm(synth(v, s['de'])))
            log.write(json.dumps({'id': s['id'], 'k': 'de', 'd': d}) + '\n')
            if i % 100 == 0:
                log.flush(); print(f'A {i}/{len(todo)} {time.time() - t0:.0f}s', flush=True)
    elif role == 'fill':
        native = sys.argv[5]
        vde = load_voice(V + 'de_DE-thorsten-medium.onnx')
        nn = nt = 0
        for s in sents:
            if not s['audio'] or f"{s['id']}.de.mp3" in done:
                continue
            p = os.path.join(native, f"{s['audio']['id']}.mp3")
            if os.path.exists(p):
                raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'],
                                     capture_output=True).stdout
                d = write_clip(clips, s['id'], 'de', trim_norm(np.frombuffer(raw, np.int16)))
                log.write(json.dumps({'id': s['id'], 'k': 'de', 'd': d, 'native': True}) + '\n'); nn += 1
            else:
                d = write_clip(clips, s['id'], 'de', trim_norm(synth(vde, s['de'])))
                log.write(json.dumps({'id': s['id'], 'k': 'de', 'd': d, 'native': False}) + '\n'); nt += 1
        print('fill: native', nn, 'tts', nt, flush=True)
    elif role == 'B2':
        ves = load_voice(V + 'es_ES-davefx-medium.onnx')
        vds = load_voice(V + 'de_DE-thorsten-medium.onnx')
        for i, s in enumerate(sents):
            if f"{s['id']}.es.mp3" not in done:
                d = write_clip(clips, s['id'], 'es', trim_norm(synth(ves, s['es'])))
                log.write(json.dumps({'id': s['id'], 'k': 'es', 'd': d}) + '\n')
            if f"{s['id']}.ds.mp3" not in done:
                d = write_clip(clips, s['id'], 'ds', trim_norm(synth(vds, s['de'], 1.45)))
                log.write(json.dumps({'id': s['id'], 'k': 'ds', 'd': d}) + '\n')
            if i % 100 == 0:
                log.flush(); print(f'B2 {i}/{len(sents)} {time.time() - t0:.0f}s', flush=True)
    else:
        native = sys.argv[5]
        os.makedirs(native, exist_ok=True)
        from concurrent.futures import ThreadPoolExecutor
        need = [s for s in sents if s['audio'] and not os.path.exists(os.path.join(native, f"{s['audio']['id']}.mp3"))]
        def fetch(s):
            aid = s['audio']['id']
            for attempt in range(4):
                try:
                    req = urllib.request.Request(f'https://tatoeba.org/audio/download/{aid}',
                                                 headers={'User-Agent': 'personal-study-build/1.0'})
                    with urllib.request.urlopen(req, timeout=30) as r:
                        b = r.read()
                    with open(os.path.join(native, f'{aid}.mp3'), 'wb') as f:
                        f.write(b)
                    return True
                except Exception:
                    time.sleep(2 + attempt * 3)
            return False
        with ThreadPoolExecutor(4) as ex:
            ok = list(ex.map(fetch, need))
        print('native downloads', sum(ok), 'failed', len(ok) - sum(ok), flush=True)
        for s in sents:
            if s['audio'] and f"{s['id']}.de.mp3" not in done:
                p = os.path.join(native, f"{s['audio']['id']}.mp3")
                if not os.path.exists(p):
                    continue
                raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'],
                                     capture_output=True).stdout
                pcm = np.frombuffer(raw, np.int16)
                d = write_clip(clips, s['id'], 'de', trim_norm(pcm))
                log.write(json.dumps({'id': s['id'], 'k': 'de', 'd': d, 'native': True}) + '\n')
        log.flush(); print('native processed', flush=True)
        ves = load_voice(V + 'es_ES-davefx-medium.onnx')
        vds = load_voice(V + 'de_DE-thorsten-medium.onnx')
        for i, s in enumerate(sents):
            if f"{s['id']}.es.mp3" not in done:
                d = write_clip(clips, s['id'], 'es', trim_norm(synth(ves, s['es'])))
                log.write(json.dumps({'id': s['id'], 'k': 'es', 'd': d}) + '\n')
            if f"{s['id']}.ds.mp3" not in done:
                d = write_clip(clips, s['id'], 'ds', trim_norm(synth(vds, s['de'], 1.45)))
                log.write(json.dumps({'id': s['id'], 'k': 'ds', 'd': d}) + '\n')
            if i % 100 == 0:
                log.flush(); print(f'B {i}/{len(sents)} {time.time() - t0:.0f}s', flush=True)
    log.close()
    print(role, 'DONE', f'{time.time() - t0:.0f}s', flush=True)

def pack():
    data = json.load(open(B + 'final.json'))
    clips, out = sys.argv[3], sys.argv[4]
    os.makedirs(os.path.join(out, 'audio'), exist_ok=True)
    dur, native_used = {}, {}
    for fn in os.listdir(clips):
        if fn.startswith('log_'):
            for line in open(os.path.join(clips, fn)):
                r = json.loads(line)
                dur[(r['id'], r['k'])] = r['d']
                if r['k'] == 'de' and 'native' in r:
                    native_used[r['id']] = r['native']
    owner = {}
    for w in sorted(data['words'], key=lambda w: w['r']):
        for sid in w['s']:
            owner.setdefault(sid, (w['r'] - 1) // 100)
    packs = {}
    missing = []
    for sid, p in sorted(owner.items(), key=lambda kv: (kv[1], kv[0])):
        s = data['sentences'][sid]
        s['a'] = {}
        buf = packs.setdefault(p, bytearray())
        for k in ('es', 'de', 'ds'):
            fp = os.path.join(clips, f'{sid}.{k}.mp3')
            if not os.path.exists(fp):
                missing.append((sid, k)); continue
            b = open(fp, 'rb').read()
            s['a'][k] = [p, len(buf), len(b), round(dur.get((sid, k), 0) * 1000)]
            buf.extend(b)
    for p, buf in packs.items():
        open(os.path.join(out, 'audio', f'pack-{p:02d}.mp3'), 'wb').write(buf)
    sents = {}
    for sid, s in data['sentences'].items():
        e = {'de': s['de'], 'es': s['es'], 'a': s.get('a', {})}
        if s['src'] == 'claude':
            e['src'] = 'c'
        else:
            e['t'] = s['tid']
        if s['audio'] and native_used.get(sid):
            e['n'] = [s['audio']['user'], s['audio']['license']]
        sents[sid] = e
    os.makedirs(os.path.join(out, 'data'), exist_ok=True)
    json.dump({'v': 'rc1', 'words': data['words'], 'sents': sents}, open(os.path.join(out, 'data', 'words.json'), 'w'),
              ensure_ascii=False, separators=(',', ':'))
    print('packs', {p: len(b) for p, b in packs.items()}, 'missing', len(missing), missing[:5])

if ROLE == 'pack':
    pack()
else:
    work(ROLE)
