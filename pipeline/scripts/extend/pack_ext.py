"""Pack the new sentence clips into new packs and point words.json at them. Existing packs are never touched.
Usage: python3 -I pack_ext.py <plan.json> <render.json> <clips_dir> <site_dir>
Packs: sentences of words 1001+ go to pack-41 + (rank-1001)//100 (41..50);
       new sentences of words 1..1000 (the longer ones and top-ups) go to pack-71 + (rank-1)//100 (71..80),
       so words 2001-3000 can use 51..60 later.
A sentence belongs to the first word (by rank) that uses it."""
import json, os, sys
plan = json.load(open(sys.argv[1])); render = set(json.load(open(sys.argv[2]))); C = sys.argv[3]; OUT = sys.argv[4]
p = os.path.join(OUT, 'data', 'words.json'); site = json.load(open(p))
dur = {}
for line in open(os.path.join(C, 'log.jsonl')):
    r = json.loads(line)
    for k, d in r['d'].items(): dur[(r['id'], k)] = d
def pack_for(r): return 41 + (r - 1001) // 100 if r > 1000 else 71 + (r - 1) // 100
owner = {}
for w in sorted(site['words'], key=lambda w: w['r']):
    for sid in w['s']:
        if sid in render: owner.setdefault(sid, pack_for(w['r']))
assert set(owner) == render, 'render list and words.json disagree'
for pk in set(owner.values()):
    f = os.path.join(OUT, 'audio', f'pack-{pk:02d}.mp3')
    if os.path.exists(f) and pk <= 40: sys.exit(f'{f} exists: refusing to overwrite an old pack')
packs, miss = {}, []
for sid in sorted(owner, key=lambda s: (owner[s], s)):
    pk = owner[sid]; buf = packs.setdefault(pk, bytearray()); a = {}
    for k in ('es', 'de', 'ds'):
        fp = os.path.join(C, f'{sid}.{k}.mp3')
        if not os.path.exists(fp) or (sid, k) not in dur: miss.append((sid, k)); continue
        b = open(fp, 'rb').read(); a[k] = [pk, len(buf), len(b), dur[(sid, k)]]; buf.extend(b)
    s = site['sents'][sid]; s['a'] = a
    nat = plan[sid].get('native')
    s['n'] = [nat[1], nat[2]] if nat else None
if miss: sys.exit(f'{len(miss)} clips missing, e.g. {miss[:5]}: run edge_render.py again')
for pk, buf in packs.items(): open(os.path.join(OUT, 'audio', f'pack-{pk:02d}.mp3'), 'wb').write(buf)
json.dump(site, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
print('packs', {k: round(len(v) / 1e6, 1) for k, v in sorted(packs.items())}, 'native', sum(1 for s in render if site['sents'][s].get('n')))
