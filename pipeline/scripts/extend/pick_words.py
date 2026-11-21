"""Pick the next N list words from ranks.json (skipping lemmatizer artefacts, rude words and keys that REMAP folds
into an existing word), with display form, gender and plural for nouns.
Usage: python3 -I pick_words.py <build_dir> <parsed.pkl> <nouns_csv> <words.json> <n_new> <out.json> [sharp_s.json]
sharp_s.json (from sharp_s.py) adds the ß words that ranks.json lost, in frequency order among the others."""
import collections, csv, json, os, pickle, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path[:0] = [HERE, os.path.join(HERE, '..')]
from dekeys import key_of
B, PK, NOUNS, SITE, N, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]), sys.argv[6]
from remap import REMAP, DROP
ranks = json.load(open(B + 'ranks.json'))
site = json.load(open(SITE))
listk = {w['k'] for w in site['words']}
top = max(w['r'] for w in site['words'])
P = pickle.load(open(PK, 'rb'))
gender, cnt = collections.defaultdict(collections.Counter), collections.Counter()
for sid, x in P.items():
    for t in x['toks']:
        k = key_of(t)
        if not k: continue
        k = REMAP.get(k, k); cnt[k] += 1
        if t[3]: gender[k][t[3]] += 1
nouns = collections.defaultdict(list)
with open(NOUNS, encoding='utf-8') as f:
    for row in csv.DictReader(f):
        nouns[row['lemma']].append((row['pos'], row.get('genus') or row.get('genus 1') or '',
                                    row.get('nominativ plural') or row.get('nominativ plural 1') or '',
                                    row.get('nominativ singular') or row.get('nominativ singular 1') or ''))
SPG = {'Masc': 'm', 'Fem': 'f', 'Neut': 'n'}
ART = {'m': 'der', 'f': 'die', 'n': 'das', 'pl': 'die'}
def noun_info(lem, spg):
    rows = nouns.get(lem, []); pref = [r for r in rows if r[0] == 'Substantiv'] or rows
    gs = []
    for r in pref:
        if r[1] and r[1] not in gs: gs.append(r[1])
    if len(gs) > 1 and spg in gs:
        r = next(r for r in pref if r[1] == spg); return r[1], r[2]
    if pref:
        r = next((r for r in pref if r[1]), pref[0])
        if not r[1] and not r[3] and r[2]: return 'pl', r[2]
        return (r[1] or spg), r[2]
    return spg, ''
SH = json.load(open(sys.argv[7])) if len(sys.argv) > 7 else []
cand = sorted(list(ranks.items()) + [(k, max(r, top + 0.5) - 0.01) for r, k, _ in SH if k not in DROP and REMAP.get(k, k) == k],
              key=lambda x: x[1])
out, skipped = [], []
for k, r0 in cand:
    if r0 <= top or k in listk: continue
    kk = REMAP.get(k, k)
    if k in DROP or kk != k or kk in listk or kk in {w['k'] for w in out}: skipped.append(k); continue
    c, lem = k.split(':', 1)
    e = {'r': top + len(out) + 1, 'k': k, 'r0': r0, 'n': cnt[k]}
    if c == 'N':
        spg = SPG.get(gender[k].most_common(1)[0][0], '') if gender[k] else ''
        g, pl = noun_info(lem, spg)
        e['w'] = (ART[g] + ' ' + lem) if g in ART else lem
        e['pl'] = pl if pl and pl not in ('—', '-') and g != 'pl' else ''
        e['gen'] = g
    else:
        e['w'] = lem; e['pl'] = ''
    out.append(e)
    if len(out) == N: break
print('picked', len(out), 'ranks', out[0]['r0'], '..', out[-1]['r0'], '| skipped', len(skipped), skipped)
print('no gender:', [e['k'] for e in out if e['k'].startswith('N:') and e.get('gen') not in ART])
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=0)
