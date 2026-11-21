"""Pick 2 more Tatoeba sentences per word (5 total). Prefers sentences whose words are all in the list or the glossed extras,
and whose Spanish translation contains the word's meaning (literal, not an idiom).
Usage: python3 -I add_sents.py <tatoeba_dir> <build_dir> <site_words_json> <out_json>"""
import bz2, collections, json, pickle, re, sys, unicodedata, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dekeys import key_of
D, B, SITE, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2].rstrip('/') + '/', sys.argv[3], sys.argv[4]
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+(?:-[A-Za-zÄÖÜäöüß]+)*")
BAD = re.compile(r'[0-9"„“”«»()\[\]:;/–—…&%$€@#*_=+<>|~^]')
deu = {}
with bz2.open(D + 'deu_sentences_detailed.tsv.bz2', 'rt', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t'); deu[int(p[0])] = p[2].strip()
links = collections.defaultdict(list)
with bz2.open(D + 'deu-spa_links.tsv.bz2', 'rt') as f:
    for line in f:
        a, b = map(int, line.split('\t')); links[a].append(b)
spa = {}
with bz2.open(D + 'spa_sentences.tsv.bz2', 'rt', encoding='utf-8') as f:
    for line in f:
        p = line.rstrip('\n').split('\t'); spa[int(p[0])] = p[2].strip()
parsed = pickle.load(open(B + 'parsed.pkl', 'rb'))
ranks = json.load(open(B + 'ranks.json'))
site = json.load(open(SITE))
listk = {w['k'] for w in site['words']}
allowed = listk | set(site.get('ex', {}))
used = {s['t'] for s in site['sents'].values() if 't' in s}
by_key = collections.defaultdict(list)
for sid, toks in parsed.items():
    for k in {key_of(t) for t in toks}:
        if k in listk: by_key[k].append(sid)

def strip(s): return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')
def heads(g):
    out = []
    for v in re.split(r'[,;/]', re.sub(r'\([^)]*\)', '', g)):
        ws = [w for w in re.findall(r'[a-záéíóúñü]+', v.lower()) if w not in ('el', 'la', 'los', 'las', 'un', 'una', 'de', 'a', 'se', 'lo')]
        if ws: out.append(strip(ws[0]))
    return out
def literal(g, es):
    t = strip(es); toks = re.findall(r'[a-zñ]+', t)
    for h in heads(g):
        if len(h) <= 3:
            if h in toks: return True
        elif h[:max(4, len(h) - 2)] in t: return True
    return False
def nw(text): return [w.lower() for w in WORD.findall(text)]
def dup(a, b):
    ca, cb = collections.Counter(a), collections.Counter(b)
    return sum(((ca - cb) + (cb - ca)).values()) <= 2
def es_of(sid):
    ids = sorted([e for e in links[sid] if e in spa], key=lambda e: (len(spa[e]), e))
    return re.sub(r'([!?¡¿])\1+', r'\1', spa[ids[0]]) if ids else None

res, stat, newx = {}, collections.Counter(), collections.Counter()
for w in site['words']:
    k = w['k']
    have = [site['sents'][s] for s in w['s']]
    have_w = [nw(s['de']) for s in have]
    have_t = {s.get('t') for s in have}
    sc = []
    for sid in by_key.get(k, ()):
        if sid in have_t or sid not in deu or BAD.search(deu[sid]): continue
        toks = parsed[sid]
        if any(t[1] in ('PROPN', 'X', 'SYM') for t in toks): continue
        n = len(nw(deu[sid]))
        if not 3 <= n <= 10: continue
        keys = [key_of(t) for t in toks if key_of(t)]
        out = {x for x in keys if x not in allowed}
        if len(out) > 1 or any(ranks.get(x, 10**6) > 3000 for x in out): continue
        es = es_of(sid)
        if not es: continue
        lit = literal(w['g'], es)
        sc.append((len(out), not lit, sid in used, abs(n - 6), sid, es, out))
    sc.sort()
    picked = []
    for o, nl, u, _, sid, es, out in sc:
        ws = nw(deu[sid])
        if any(dup(ws, h) for h in have_w) or any(dup(ws, nw(deu[p[0]])) for p in picked): continue
        picked.append((sid, es, not nl, out))
        if len(picked) == 2: break
    for p in picked: newx.update(p[3])
    stat[len(picked)] += 1; stat['literal'] += sum(1 for p in picked if p[2])
    res[k] = [{'tid': sid, 'de': deu[sid], 'es': es, 'lit': lit} for sid, es, lit, _ in picked]
print(dict(stat)); print('new extra keys', len(newx), newx.most_common(400))
json.dump({'add': res, 'newx': sorted(newx)}, open(OUT, 'w'), ensure_ascii=False, indent=0)
