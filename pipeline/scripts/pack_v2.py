"""Pack v2 clips into audio/pack-30.. and update words.json. Usage: python3 pack_v2.py <plan.json> <clips_dir> <site_dir>"""
import json, os, sys
plan = json.load(open(sys.argv[1])); C = sys.argv[2]; OUT = sys.argv[3]
p = os.path.join(OUT, 'data', 'words.json'); site = json.load(open(p))
dur = {}
for line in open(os.path.join(C, 'log.jsonl')):
    r = json.loads(line)
    for k, d in r['d'].items(): dur[(r['id'], k)] = d
owner = {}
for w in sorted(site['words'], key=lambda w: w['r']):
    for sid in w['s']: owner.setdefault(sid, 30 + (w['r'] - 1) // 100)
if any(v >= 40 for v in owner.values()):
    sys.exit('Words past 1000 would land in pack-40, which holds the single-word audio. '
             'Pick new pack numbers first: see pipeline/ADD_WORDS.md, step 0.')
packs, miss = {}, []
for sid in sorted(site['sents'], key=lambda s: (owner.get(s, 39), s)):
    pk = owner.get(sid, 39); buf = packs.setdefault(pk, bytearray()); a = {}
    for k in ('es', 'de', 'ds'):
        fp = os.path.join(C, f'{sid}.{k}.mp3')
        if not os.path.exists(fp): miss.append((sid, k)); continue
        b = open(fp, 'rb').read(); a[k] = [pk, len(buf), len(b), dur.get((sid, k), 0)]; buf.extend(b)
    s = site['sents'][sid]; s['a'] = a
    nat = plan[sid].get('native')
    s['n'] = [nat[1], nat[2]] if nat else None
for pk, buf in packs.items(): open(os.path.join(OUT, 'audio', f'pack-{pk:02d}.mp3'), 'wb').write(buf)
site['v'] = 'rc4'
json.dump(site, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
print('packs', {k: round(len(v) / 1e6, 1) for k, v in sorted(packs.items())}, 'missing', len(miss), miss[:5])
print('native', sum(1 for s in site['sents'].values() if s.get('n')))
