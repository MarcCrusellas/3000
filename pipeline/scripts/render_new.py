"""Render es/de/ds clips for new sentences (one worker = every Nth sentence), then pack.
Usage: python3 -I render_new.py work <render_list> <voices_dir> <clips_dir> <worker> <nworkers>
       python3 -I render_new.py pack <render_list> <clips_dir> <site_dir>"""
import json, os, sys, time
ns = {}
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'render.py')
code = open(src).read().split("if ROLE == 'pack':")[0].replace("ROLE = sys.argv[1]\nB = sys.argv[2].rstrip('/') + '/'", "")
exec(compile(code, 'render', 'exec'), ns)
role, RL = sys.argv[1], sys.argv[2]
items = json.load(open(RL))
if role == 'work':
    V, C, wi, nw = sys.argv[3].rstrip('/') + '/', sys.argv[4], int(sys.argv[5]), int(sys.argv[6])
    os.makedirs(C, exist_ok=True)
    vde = ns['load_voice'](V + 'de_DE-thorsten-high.onnx'); ves = ns['load_voice'](V + 'es_ES-davefx-medium.onnx'); vds = ns['load_voice'](V + 'de_DE-thorsten-medium.onnx')
    t0 = time.time(); log = open(os.path.join(C, f'log_{wi}.jsonl'), 'a')
    mine = items[wi::nw]
    for i, s in enumerate(mine):
        for kind, v, text, ls in (('de', vde, s['de'], None), ('es', ves, s['es'], None), ('ds', vds, s['de'], 1.45)):
            fp = os.path.join(C, f"{s['id']}.{kind}.mp3")
            if os.path.exists(fp): continue
            d = ns['write_clip'](C, s['id'], kind, ns['trim_norm'](ns['synth'](v, text, ls)))
            log.write(json.dumps({'id': s['id'], 'k': kind, 'd': d}) + '\n')
        if i % 50 == 0: log.flush(); print(f'w{wi} {i}/{len(mine)} {time.time() - t0:.0f}s', flush=True)
    print(f'w{wi} DONE {time.time() - t0:.0f}s', flush=True)
else:
    C, OUT = sys.argv[3], sys.argv[4]
    p = os.path.join(OUT, 'data', 'words.json'); site = json.load(open(p))
    dur = {}
    for fn in os.listdir(C):
        if fn.startswith('log_'):
            for line in open(os.path.join(C, fn)):
                r = json.loads(line); dur[(r['id'], r['k'])] = r['d']
    owner = {}
    for w in sorted(site['words'], key=lambda w: w['r']):
        for sid in w['s']: owner.setdefault(sid, 11 + (w['r'] - 1) // 100)
    packs, miss = {}, []
    for s in sorted(items, key=lambda s: (owner[s['id']], s['id'])):
        pk = owner[s['id']]; buf = packs.setdefault(pk, bytearray()); a = {}
        for k in ('es', 'de', 'ds'):
            fp = os.path.join(C, f"{s['id']}.{k}.mp3")
            if not os.path.exists(fp): miss.append((s['id'], k)); continue
            b = open(fp, 'rb').read(); a[k] = [pk, len(buf), len(b), round(dur.get((s['id'], k), 0) * 1000)]; buf.extend(b)
        site['sents'][s['id']]['a'] = a
    for pk, buf in packs.items(): open(os.path.join(OUT, 'audio', f'pack-{pk:02d}.mp3'), 'wb').write(buf)
    json.dump(site, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('packs', {k: len(v) for k, v in packs.items()}, 'missing', len(miss), miss[:5])
